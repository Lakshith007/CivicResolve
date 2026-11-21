import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/authStore';
import type { SessionUser } from '@/types/civic';

type GuardSuccess = { ok: true; user: SessionUser; token: string };
type GuardFailure = { ok: false; response: NextResponse };
export type GuardResult = GuardSuccess | GuardFailure;

function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const idx = segment.indexOf('=');
    if (idx === -1) continue;
    const key = segment.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(segment.slice(idx + 1).trim());
    }
  }
  return null;
}

export function extractSessionToken(request?: Request): string | null {
  if (request) {
    const fromHeader = parseCookieHeader(request.headers.get('cookie'), SESSION_COOKIE_NAME);
    if (fromHeader) return fromHeader;
  }
  try {
    const cookieStore = cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the authenticated session user from the signed HttpOnly cookie, or null.
 * Never trusts user IDs, roles, or headers supplied directly by the frontend.
 */
export function authenticateUser(request?: Request): SessionUser | null {
  const token = extractSessionToken(request);
  return verifySessionToken(token);
}

export function requireAuth(request?: Request): GuardResult {
  const token = extractSessionToken(request);
  const user = verifySessionToken(token);
  if (!user || !token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required. Please sign in to continue.' },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user, token };
}

export function requireCitizen(request?: Request): GuardResult {
  const auth = requireAuth(request);
  if (!auth.ok) return auth;
  if (auth.user.role !== 'CITIZEN' && auth.user.role !== 'ADMIN') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: valid citizen or administrator role required.' },
        { status: 403 }
      ),
    };
  }
  return auth;
}

export function requireAdmin(request?: Request): GuardResult {
  const auth = requireAuth(request);
  if (!auth.ok) return auth;
  if (auth.user.role !== 'ADMIN') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: Administrator privileges are required for this operation.' },
        { status: 403 }
      ),
    };
  }
  return auth;
}

/**
 * CSRF origin check: if an Origin header is supplied on a mutating request,
 * verify it matches the target Host header.
 */
export function verifySameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return null;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.host !== host) {
      return NextResponse.json(
        { error: 'Forbidden: cross-origin request rejected.' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid Origin header.' }, { status: 403 });
  }
  return null;
}

const globalRateLimiter = globalThis as unknown as {
  __civicRateLimits?: Map<string, { count: number; resetAt: number }>;
};

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim() || 'unknown';
  }
  return 'local';
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  if (!globalRateLimiter.__civicRateLimits) {
    globalRateLimiter.__civicRateLimits = new Map();
  }
  const store = globalRateLimiter.__civicRateLimits;
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRateLimitsForTesting(): void {
  globalRateLimiter.__civicRateLimits?.clear();
}
