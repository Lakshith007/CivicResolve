import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/auditStore';
import { checkRateLimit, getClientIp, verifySameOrigin } from '@/lib/authGuards';
import {
  authenticateWorkerCredentials,
  createSessionToken,
  getSessionCookieOptions,
} from '@/lib/authStore';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`worker-login:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many crew sign-in attempts. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const crewUnitId = typeof body.crewUnitId === 'string' ? body.crewUnitId.trim() : '';
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';

    if (!crewUnitId || !passcode) {
      return NextResponse.json(
        { error: 'Crew Unit ID and Dispatch Passcode are required.' },
        { status: 400 }
      );
    }

    const worker = authenticateWorkerCredentials(crewUnitId, passcode);
    if (!worker) {
      return NextResponse.json(
        { error: 'Invalid Crew Unit ID or Dispatch Passcode.' },
        { status: 401 }
      );
    }

    const token = createSessionToken(worker);
    recordAuditLog({
      actor: worker,
      action: 'WORKER_LOGIN',
      targetTicketId: 'AUTH-SESSION',
      updatedValues: {
        crewUnitId: worker.crewUnitId,
        assignedDepartment: worker.assignedDepartment,
      },
    });

    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');
    const cookieOpts = getSessionCookieOptions(undefined, isHttps);
    const response = NextResponse.json({ ok: true, user: worker }, { status: 200 });
    response.cookies.set(cookieOpts.name, token, cookieOpts);
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid crew sign-in payload.' }, { status: 400 });
  }
}
