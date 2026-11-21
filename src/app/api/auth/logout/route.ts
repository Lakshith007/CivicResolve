import { NextResponse } from 'next/server';
import { extractSessionToken, verifySameOrigin } from '@/lib/authGuards';
import { getSessionCookieOptions, revokeSessionToken } from '@/lib/authStore';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const token = extractSessionToken(request);
  if (token) {
    revokeSessionToken(token);
  }

  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https://');
  const cookieOpts = getSessionCookieOptions(0, isHttps);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieOpts.name, '', cookieOpts);
  return response;
}
