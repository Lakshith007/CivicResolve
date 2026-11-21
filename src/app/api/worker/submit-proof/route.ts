import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, verifySameOrigin } from '@/lib/authGuards';
import { syncStatusUpdateToFirestore } from '@/lib/firebase';
import { getDashboardStats, submitFieldCompletionProof, toPublicIssue } from '@/lib/issueStore';
import { isValidImageInput, sanitizeText } from '@/lib/validation';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

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
    const crewName = typeof body.crewName === 'string' ? sanitizeText(body.crewName, 80) : '';
    const crewUnitId = typeof body.crewUnitId === 'string' ? sanitizeText(body.crewUnitId, 40) : '';
    const completionNotes =
      typeof body.completionNotes === 'string' ? sanitizeText(body.completionNotes, 600) : '';
    const completionPhotoUrl =
      typeof body.completionPhotoUrl === 'string' ? body.completionPhotoUrl.trim() : '';

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required.' }, { status: 400 });
    }
    if (crewName.length < 2 || crewUnitId.length < 2) {
      return NextResponse.json(
        { error: 'Please provide both Crew / Team Name and Crew Unit ID (2+ chars).' },
        { status: 400 }
      );
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
            'A valid completion proof photo (PNG, JPEG, or WebP under 1.4 MB) is required.',
        },
        { status: 400 }
      );
    }

    const result = submitFieldCompletionProof(ticketId, {
      crewName,
      crewUnitId,
      completionNotes,
      completionPhotoUrl,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Non-blocking Firestore mirror
    void syncStatusUpdateToFirestore(ticketId, {
      fieldVerification: result.issue.fieldVerification,
      statusHistory: result.issue.statusHistory,
    });

    return NextResponse.json(
      {
        ok: true,
        issue: toPublicIssue(result.issue, null),
        stats: getDashboardStats(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid field proof submission payload.' }, { status: 400 });
  }
}
