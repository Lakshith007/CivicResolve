import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/auditStore';
import {
  authenticateUser,
  requireAdmin,
  requireAuth,
  verifySameOrigin,
} from '@/lib/authGuards';
import {
  canAccessPrivateIssue,
  getDashboardStats,
  getIssueById,
  hydrateIssuesFromFirestore,
  reviewFieldCompletionProof,
  toPublicIssue,
  updateIssueStatus,
  upvoteIssue,
} from '@/lib/issueStore';
import { syncIssueToFirestore } from '@/lib/firebase';
import { sanitizeText, validateStatusUpdate, validateTicketId } from '@/lib/validation';

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  if (!validateTicketId(context.params.id)) {
    return NextResponse.json({ error: 'Invalid civic ticket ID format.' }, { status: 400 });
  }

  await hydrateIssuesFromFirestore();
  const issue = getIssueById(context.params.id);
  if (!issue) {
    return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('private') === 'true') {
    const authGuard = requireAuth(request);
    if (!authGuard.ok) return authGuard.response;
    if (!canAccessPrivateIssue(issue, authGuard.user)) {
      return NextResponse.json(
        { error: 'Forbidden: you cannot access private details of another citizen complaint.' },
        { status: 403 }
      );
    }
    return NextResponse.json({ issue });
  }

  const viewer = authenticateUser(request);
  return NextResponse.json({ issue: toPublicIssue(issue, viewer) });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  if (!validateTicketId(context.params.id)) {
    return NextResponse.json({ error: 'Invalid civic ticket ID format.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const hasAdminFields =
      body &&
      typeof body === 'object' &&
      ('status' in body ||
        'department' in body ||
        'priority' in body ||
        'adminNotes' in body ||
        'resolutionEvidenceUrl' in body ||
        'verificationDecision' in body);

    if (body?.action === 'upvote' && !hasAdminFields) {
      await hydrateIssuesFromFirestore();
      const updated = upvoteIssue(context.params.id);
      if (!updated) {
        return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
      }
      await syncIssueToFirestore(updated);
      const viewer = authenticateUser(request);
      return NextResponse.json({
        issue: toPublicIssue(updated, viewer),
        stats: getDashboardStats(),
      });
    }

    // All administrative triage, assignment, priority override, and status mutations require ADMIN role
    const adminGuard = requireAdmin(request);
    if (!adminGuard.ok) return adminGuard.response;

    await hydrateIssuesFromFirestore();
    const existing = getIssueById(context.params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
    }

    // Handle Admin Field Crew Photo Verification (Approve & Mark Resolved OR Reject for Rework)
    if (body.verificationDecision === 'approve' || body.verificationDecision === 'reject') {
      const decision = body.verificationDecision;
      const rejectionReason =
        typeof body.rejectionReason === 'string' ? sanitizeText(body.rejectionReason, 400) : '';
      const adminNotes =
        typeof body.adminNotes === 'string' ? sanitizeText(body.adminNotes, 500) : undefined;

      if (decision === 'reject' && rejectionReason.length < 5) {
        return NextResponse.json(
          { error: 'Please provide a clear rework reason (5+ characters) when rejecting field proof.' },
          { status: 400 }
        );
      }

      const reviewRes = reviewFieldCompletionProof(context.params.id, {
        decision,
        reviewerName: `${adminGuard.user.name} (${adminGuard.user.email})`,
        adminNotes,
        rejectionReason: decision === 'reject' ? rejectionReason : undefined,
      });

      if (!reviewRes.ok) {
        return NextResponse.json({ error: reviewRes.error }, { status: reviewRes.status });
      }

      await syncIssueToFirestore(reviewRes.issue);

      recordAuditLog({
        actor: adminGuard.user,
        action: decision === 'approve' ? 'ADMIN_VERIFY_AND_RESOLVE' : 'ADMIN_REJECT_FIELD_WORK',
        targetTicketId: existing.id,
        previousValues: {
          status: existing.status,
          verificationStatus: existing.fieldVerification?.verificationStatus,
        },
        updatedValues: {
          status: reviewRes.issue.status,
          verificationStatus: reviewRes.issue.fieldVerification?.verificationStatus,
          crewUnitId: reviewRes.issue.fieldVerification?.crewUnitId,
        },
        reason: decision === 'reject' ? rejectionReason : adminNotes || 'Field photo verified',
      });

      return NextResponse.json({ issue: reviewRes.issue, stats: getDashboardStats() });
    }

    const validation = validateStatusUpdate(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' '), errors: validation.errors },
        { status: 400 }
      );
    }

    // Strict Field-Crew-First Resolution Gate:
    // Cannot directly mark a ticket Resolved unless an authenticated Field Crew uploaded
    // completion proof and the Administrator explicitly approved it via verificationDecision: 'approve'.
    if (
      validation.data.status === 'Resolved' &&
      existing.status !== 'Resolved' &&
      existing.fieldVerification?.verificationStatus !== 'Approved'
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot mark Resolved directly: Dispatched Field Crew must first upload a verified completion proof photo via the Field Crew Portal (/worker), which the administrator must then approve.',
        },
        { status: 400 }
      );
    }

    const isPriorityChanged =
      validation.data.priority !== undefined &&
      validation.data.priority !== existing.priority;

    if (isPriorityChanged && !validation.data.priorityOverrideReason) {
      return NextResponse.json(
        {
          error:
            'A documented reason (priorityOverrideReason) is required when overriding AI-recommended priority.',
        },
        { status: 400 }
      );
    }

    const updated = updateIssueStatus(context.params.id, {
      ...validation.data,
      updatedBy: `${adminGuard.user.name} (${adminGuard.user.email})`,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Civic issue ticket not found.' }, { status: 404 });
    }

    await syncIssueToFirestore(updated);

    recordAuditLog({
      actor: adminGuard.user,
      action: isPriorityChanged
        ? 'ADMIN_TRIAGE_AND_PRIORITY_OVERRIDE'
        : 'ADMIN_TRIAGE_UPDATE',
      targetTicketId: existing.id,
      previousValues: {
        status: existing.status,
        department: existing.department,
        priority: existing.priority,
      },
      updatedValues: {
        status: updated.status,
        department: updated.department,
        priority: updated.priority,
        hasResolutionEvidence: Boolean(updated.resolutionEvidenceUrl),
      },
      reason: validation.data.priorityOverrideReason || validation.data.adminNotes,
    });

    return NextResponse.json({ issue: updated, stats: getDashboardStats() });
  } catch {
    return NextResponse.json({ error: 'Invalid status update payload.' }, { status: 400 });
  }
}
