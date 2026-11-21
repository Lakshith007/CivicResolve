import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/auditStore';
import { authenticateUser, extractSessionToken, verifySameOrigin } from '@/lib/authGuards';
import { getSessionCookieOptions, revokeSessionToken } from '@/lib/authStore';

export async function POST(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  const currentUser = authenticateUser(request);
  const token = extractSessionToken(request);
  if (token) {
    revokeSessionToken(token);
  }

  if (currentUser?.role === 'ADMIN') {
    recordAuditLog({
      actor: currentUser,
      action: 'ADMIN_LOGOUT',
      targetTicketId: 'AUTH-SESSION',
      updatedValues: { sessionState: 'revoked' },
    });
  }

  const isHttps =
    request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https://');
  const cookieOpts = getSessionCookieOptions(0, isHttps);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieOpts.name, '', cookieOpts);
  return response;
}
