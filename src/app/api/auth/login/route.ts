import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, verifySameOrigin } from '@/lib/authGuards';
import {
  authenticateCredentials,
  createSessionToken,
  getSessionCookieOptions,
} from '@/lib/authStore';
import { validateLoginInput } from '@/lib/validation';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const ip = getClientIp(request);
  const rl = checkRateLimit(`login:${ip}`, 15, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-in attempts. Please wait before retrying.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const validation = validateLoginInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(' ') },
        { status: 400 }
      );
    }

    const user = authenticateCredentials(validation.data.email, validation.data.password);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);
    const isHttps =
      request.headers.get('x-forwarded-proto') === 'https' ||
      request.url.startsWith('https://');
    const cookieOpts = getSessionCookieOptions(undefined, isHttps);
    const response = NextResponse.json({ user }, { status: 200 });
    response.cookies.set(cookieOpts.name, token, cookieOpts);
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid sign-in payload.' }, { status: 400 });
  }
}
