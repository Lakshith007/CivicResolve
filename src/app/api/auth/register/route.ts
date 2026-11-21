import { NextResponse } from 'next/server';
import { getClientIp, checkRateLimit, verifySameOrigin } from '@/lib/authGuards';
import {
  createSessionToken,
  getSessionCookieOptions,
  registerCitizen,
} from '@/lib/authStore';
import { validateRegistrationInput } from '@/lib/validation';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`register:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Explicitly block any attempt to specify or elevate role during public signup
    if (body && typeof body === 'object' && 'role' in body && body.role !== undefined) {
      return NextResponse.json(
        { error: 'Forbidden: role assignment is controlled by the server.' },
        { status: 403 }
      );
    }

    const validation = validateRegistrationInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' '), errors: validation.errors },
        { status: 400 }
      );
    }

    const created = registerCitizen(validation.data);
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 409 });
    }

    const token = createSessionToken(created.user);
    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');
    const cookieOpts = getSessionCookieOptions(undefined, isHttps);
    const response = NextResponse.json({ user: created.user }, { status: 201 });
    response.cookies.set(cookieOpts.name, token, cookieOpts);
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid registration payload.' }, { status: 400 });
  }
}
