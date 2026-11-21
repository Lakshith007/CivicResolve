import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/auditStore';
import { checkRateLimit, getClientIp, requireWorker, verifySameOrigin } from '@/lib/authGuards';
import { syncIssueToFirestore } from '@/lib/firebase';
import {
  getDashboardStats,
  getIssueById,
  hydrateIssuesFromFirestore,
  submitFieldCompletionProof,
  toPublicIssue,
} from '@/lib/issueStore';
import { isValidImageInput, sanitizeText } from '@/lib/validation';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  // Enforce authenticated WORKER (or ADMIN) session — never allow anonymous submissions
  const workerGuard = requireWorker(request);
  if (!workerGuard.ok) return workerGuard.response;
  const actor = workerGuard.user;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`worker-proof:${ip}`, 30, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Submission rate limit reached. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const ticketId = typeof body.ticketId === 'string' ? sanitizeText(body.ticketId, 40) : '';
    const completionNotes =
      typeof body.completionNotes === 'string' ? sanitizeText(body.completionNotes, 600) : '';
    const completionPhotoUrl =
      typeof body.completionPhotoUrl === 'string' ? body.completionPhotoUrl.trim() : '';

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required.' }, { status: 400 });
    }
    if (completionNotes.length < 5) {
      return NextResponse.json(
        { error: 'Please enter a brief completion work summary (5+ chars).' },
        { status: 400 }
      );
    }
    if (!completionPhotoUrl || !isValidImageInput(completionPhotoUrl)) {
      return NextResponse.json(
        {
          error:
            'A valid completion proof photo (PNG, JPEG, or WebP under 1.5 MB) is required.',
        },
        { status: 400 }
      );
    }

    await hydrateIssuesFromFirestore();
    const existing = getIssueById(ticketId);
    if (!existing) {
      return NextResponse.json({ error: 'Complaint ticket not found.' }, { status: 404 });
    }

    // Department ownership check: division-scoped crews cannot submit proof for another division
    if (
      actor.role === 'WORKER' &&
      actor.assignedDepartment &&
      actor.assignedDepartment !== 'ALL' &&
      actor.assignedDepartment !== existing.department
    ) {
      return NextResponse.json(
        {
          error: `Forbidden: Crew unit ${actor.crewUnitId} is assigned to ${actor.assignedDepartment} and cannot submit proof for ${existing.department}.`,
        },
        { status: 403 }
      );
    }

    // Stamp authoritative crew identity from verified server session (never trust client spoofing)
    const crewName = actor.name;
    const crewUnitId = actor.crewUnitId || (actor.role === 'ADMIN' ? 'ADMIN-FIELD' : 'CREW');

    const result = submitFieldCompletionProof(ticketId, {
      crewName,
      crewUnitId,
      completionNotes,
      completionPhotoUrl,
    });

    if (!result.ok) {
      if (result.plagiarismDetected) {
        recordAuditLog({
          actor,
          action: 'WORKER_PLAGIARISM_BLOCKED',
          targetTicketId: ticketId,
          updatedValues: { crewUnitId, blocked: true },
          reason: result.error,
        });
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    recordAuditLog({
      actor,
      action: 'WORKER_PROOF_SUBMITTED',
      targetTicketId: ticketId,
      updatedValues: {
        crewUnitId,
        verificationStatus: 'Pending Verification',
        plagiarismStatus: result.issue.fieldVerification?.plagiarismStatus,
      },
      reason: completionNotes,
    });

    await syncIssueToFirestore(result.issue);

    return NextResponse.json(
      {
        ok: true,
        issue: toPublicIssue(result.issue, actor),
        stats: getDashboardStats(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid field proof submission payload.' }, { status: 400 });
  }
}
