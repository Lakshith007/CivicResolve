import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as meGet, PATCH as mePatch } from '@/app/api/auth/me/route';
import { GET as adminComplaintsGet } from '@/app/api/admin/complaints/route';
import { GET as adminAnalyticsGet } from '@/app/api/admin/analytics/route';
import { GET as issuesGet, POST as issuesPost } from '@/app/api/issues/route';
import { GET as issueByIdGet, PATCH as issueByIdPatch } from '@/app/api/issues/[id]/route';
import { resetAuditStoreForTesting } from '@/lib/auditStore';
import { resetRateLimitsForTesting } from '@/lib/authGuards';
import { createSessionToken, resetAuthStoreForTesting, SESSION_COOKIE_NAME } from '@/lib/authStore';
import { resetIssueStoreForTesting } from '@/lib/issueStore';
import { isValidImageInput, validateIssueSubmission } from '@/lib/validation';

function extractCookieValue(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function makeJsonRequest(
  url: string,
  method: string,
  body?: unknown,
  cookieToken?: string | null
): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookieToken) {
    headers.Cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieToken)}`;
  }
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('CivicResolve RBAC & Application Security Verification', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@civicresolve.gov';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'TestAdmin#2026!Secure';
    process.env.ADMIN_BOOTSTRAP_NAME = 'Chief Municipal Admin';
    delete process.env.GEMINI_API_KEY;

    resetAuthStoreForTesting();
    resetIssueStoreForTesting();
    resetAuditStoreForTesting();
    resetRateLimitsForTesting();
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it('rejects unauthenticated access to all admin APIs with HTTP 401', async () => {
    const r1 = await adminComplaintsGet(new Request('http://localhost/api/admin/complaints'));
    expect(r1.status).toBe(401);

    const r2 = await adminAnalyticsGet(new Request('http://localhost/api/admin/analytics'));
    expect(r2.status).toBe(401);

    const r3 = await issueByIdPatch(
      makeJsonRequest('http://localhost/api/issues/CR-2026-1001', 'PATCH', {
        status: 'Resolved',
      }),
      { params: { id: 'CR-2026-1001' } }
    );
    expect(r3.status).toBe(401);
  });

  it('rejects invalid, tampered, expired, or revoked sessions with HTTP 401', async () => {
    // 1. Tampered token
    const tampered = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, 'tampered.token')
    );
    expect(tampered.status).toBe(401);

    // 2. Expired token for admin user
    const loginRes = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'admin@civicresolve.gov',
        password: 'TestAdmin#2026!Secure',
      })
    );
    expect(loginRes.status).toBe(200);
    const { user: adminUser } = await loginRes.json();
    const validToken = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
    expect(validToken).toBeTruthy();

    const expiredToken = createSessionToken(adminUser, -10);
    const expiredRes = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, expiredToken)
    );
    expect(expiredRes.status).toBe(401);

    // 3. Logged-out / revoked session token must fail immediately
    const logoutRes = await logoutPost(
      makeJsonRequest('http://localhost/api/auth/logout', 'POST', undefined, validToken)
    );
    expect(logoutRes.status).toBe(200);

    const afterLogout = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, validToken)
    );
    expect(afterLogout.status).toBe(401);
  });

  it('assigns CITIZEN role on public registration and blocks privilege escalation', async () => {
    // Attempt to self-assign ADMIN during registration -> 403
    const escalationReg = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Mallory',
        email: 'mallory@example.com',
        password: 'Password123!',
        role: 'ADMIN',
      })
    );
    expect(escalationReg.status).toBe(403);

    // Standard registration -> CITIZEN role enforced
    const regRes = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Alice Citizen',
        email: 'alice@example.com',
        password: 'Password123!',
      })
    );
    expect(regRes.status).toBe(201);
    const regJson = await regRes.json();
    expect(regJson.user.role).toBe('CITIZEN');
    const citizenCookie = extractCookieValue(regRes, SESSION_COOKIE_NAME);
    expect(citizenCookie).toBeTruthy();

    // Attempt to elevate role via profile update -> 403
    const rolePatchRes = await mePatch(
      makeJsonRequest('http://localhost/api/auth/me', 'PATCH', { role: 'ADMIN' }, citizenCookie)
    );
    expect(rolePatchRes.status).toBe(403);

    const meRes = await meGet(
      makeJsonRequest('http://localhost/api/auth/me', 'GET', undefined, citizenCookie)
    );
    const meJson = await meRes.json();
    expect(meJson.user.role).toBe('CITIZEN');
  });

  it('blocks Citizens (HTTP 403) from all administrative APIs and complaint mutations', async () => {
    const regRes = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Bob Citizen',
        email: 'bob@example.com',
        password: 'Password123!',
      })
    );
    const citizenCookie = extractCookieValue(regRes, SESSION_COOKIE_NAME);

    // Citizen cannot read admin complaints or analytics
    const adminList = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, citizenCookie)
    );
    expect(adminList.status).toBe(403);

    const adminAnalytics = await adminAnalyticsGet(
      makeJsonRequest('http://localhost/api/admin/analytics', 'GET', undefined, citizenCookie)
    );
    expect(adminAnalytics.status).toBe(403);

    // Citizen cannot change issue status, reassign department, or modify AI priority
    const statusMutation = await issueByIdPatch(
      makeJsonRequest(
        'http://localhost/api/issues/CR-2026-1002',
        'PATCH',
        { status: 'Resolved' },
        citizenCookie
      ),
      { params: { id: 'CR-2026-1002' } }
    );
    expect(statusMutation.status).toBe(403);

    const deptMutation = await issueByIdPatch(
      makeJsonRequest(
        'http://localhost/api/issues/CR-2026-1002',
        'PATCH',
        {
          status: 'In Progress',
          department: 'Horticulture & Parks Department',
        },
        citizenCookie
      ),
      { params: { id: 'CR-2026-1002' } }
    );
    expect(deptMutation.status).toBe(403);

    const mixedUpvoteSneak = await issueByIdPatch(
      makeJsonRequest(
        'http://localhost/api/issues/CR-2026-1002',
        'PATCH',
        { action: 'upvote', priority: 'Low' },
        citizenCookie
      ),
      { params: { id: 'CR-2026-1002' } }
    );
    expect(mixedUpvoteSneak.status).toBe(403);
  });

  it('enforces IDOR protection and strips private contact PII from public responses', async () => {
    const citizenARes = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Citizen A',
        email: 'citizena@example.com',
        password: 'Password123!',
      })
    );
    const cookieA = extractCookieValue(citizenARes, SESSION_COOKIE_NAME);

    const citizenBRes = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Citizen B',
        email: 'citizenb@example.com',
        password: 'Password123!',
      })
    );
    const cookieB = extractCookieValue(citizenBRes, SESSION_COOKIE_NAME);

    // Citizen A submits a complaint with private contact info and attempts to spoof Critical priority
    const createRes = await issuesPost(
      makeJsonRequest(
        'http://localhost/api/issues',
        'POST',
        {
          title: 'Slightly faded paint on park bench',
          description: 'Routine cosmetic touch-up needed on a park bench near garden corner.',
          location: 'Rose Garden Walkway',
          reporterName: 'Citizen A',
          reporterContact: '+91 99999 00000',
          aiAnalysis: {
            priority: 'Critical',
            urgencyScore: 99,
          },
        },
        cookieA
      )
    );
    expect(createRes.status).toBe(201);
    const { issue: created } = await createRes.json();
    // Server recomputed AI classification; client spoofing ignored
    expect(created.priority).toBe('Low');

    // Citizen B attempting to read Citizen A's private ticket details -> 403 Forbidden
    const idorAttempt = await issueByIdGet(
      makeJsonRequest(
        `http://localhost/api/issues/${created.id}?private=true`,
        'GET',
        undefined,
        cookieB
      ),
      { params: { id: created.id } }
    );
    expect(idorAttempt.status).toBe(403);

    // Public list must NOT leak Citizen A's reporterContact to Citizen B or anonymous users
    const publicListRes = await issuesGet(
      makeJsonRequest('http://localhost/api/issues', 'GET', undefined, cookieB)
    );
    const publicList = await publicListRes.json();
    const publicItem = publicList.issues.find((i: { id: string }) => i.id === created.id);
    expect(publicItem).toBeDefined();
    expect(publicItem.reporterContact).toBeUndefined();
    expect(publicItem.reporterUserId).toBeUndefined();

    // Citizen A CAN view their own private complaint
    const ownerRes = await issueByIdGet(
      makeJsonRequest(
        `http://localhost/api/issues/${created.id}?private=true`,
        'GET',
        undefined,
        cookieA
      ),
      { params: { id: created.id } }
    );
    expect(ownerRes.status).toBe(200);
    const ownerJson = await ownerRes.json();
    expect(ownerJson.issue.reporterContact).toBe('+91 99999 00000');
  });

  it('rejects SVG/scriptable uploads and spoofed magic bytes, while accepting real PNG headers', () => {
    const svgUri = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=';
    expect(isValidImageInput(svgUri)).toBeUndefined();

    const fakePng = `data:image/png;base64,${Buffer.from('not-a-real-png-header').toString('base64')}`;
    expect(isValidImageInput(fakePng)).toBeUndefined();

    // Valid PNG magic header bytes + minimal payload
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52,
    ]);
    const validPng = `data:image/png;base64,${pngBytes.toString('base64')}`;
    expect(isValidImageInput(validPng)).toBe(validPng);

    const badSubmission = validateIssueSubmission({
      title: 'Pothole near gate',
      description: 'Deep pothole near school gate needs urgent repair.',
      location: 'School Road',
      imageUrl: svgUri,
    });
    expect(badSubmission.valid).toBe(false);
  });

  it('allows authenticated Administrator to view all complaints, override priority with reason, and logs immutable audit trail', async () => {
    const loginRes = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'admin@civicresolve.gov',
        password: 'TestAdmin#2026!Secure',
      })
    );
    expect(loginRes.status).toBe(200);
    const adminCookie = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
    expect(adminCookie).toBeTruthy();

    const adminListRes = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, adminCookie)
    );
    expect(adminListRes.status).toBe(200);

    // Changing priority without priorityOverrideReason -> 400
    const missingReason = await issueByIdPatch(
      makeJsonRequest(
        'http://localhost/api/issues/CR-2026-1003',
        'PATCH',
        {
          status: 'In Progress',
          priority: 'Critical',
          department: 'Roads & Bridges Department (PWD)',
        },
        adminCookie
      ),
      { params: { id: 'CR-2026-1003' } }
    );
    expect(missingReason.status).toBe(400);

    // Valid Admin update with priorityOverrideReason -> 200 and recorded in audit log
    const validUpdate = await issueByIdPatch(
      makeJsonRequest(
        'http://localhost/api/issues/CR-2026-1003',
        'PATCH',
        {
          status: 'In Progress',
          priority: 'Critical',
          priorityOverrideReason: 'Multiple two-wheeler accidents reported during morning peak',
          department: 'Roads & Bridges Department (PWD)',
          adminNotes: 'Emergency asphalt crew PWD-02 dispatched.',
        },
        adminCookie
      ),
      { params: { id: 'CR-2026-1003' } }
    );
    expect(validUpdate.status).toBe(200);
    const updatedJson = await validUpdate.json();
    expect(updatedJson.issue.status).toBe('In Progress');
    expect(updatedJson.issue.priority).toBe('Critical');

    const analyticsRes = await adminAnalyticsGet(
      makeJsonRequest('http://localhost/api/admin/analytics', 'GET', undefined, adminCookie)
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsJson = await analyticsRes.json();
    expect(analyticsJson.auditLogs.length).toBeGreaterThanOrEqual(1);
    expect(analyticsJson.auditLogs[0].actorEmail).toBe('admin@civicresolve.gov');
    expect(analyticsJson.auditLogs[0].targetTicketId).toBe('CR-2026-1003');
    expect(analyticsJson.auditLogs[0].action).toBe('ADMIN_TRIAGE_AND_PRIORITY_OVERRIDE');
  });

  it('enforces municipal 2-step verification (2FA) for administrators and blocks citizens from admin login', async () => {
    // 1. Citizen account cannot log in through Admin authentication -> 403 Forbidden
    const citizenReg = await registerPost(
      makeJsonRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Regular Citizen',
        email: 'regular.citizen@example.com',
        password: 'Password123!',
      })
    );
    expect(citizenReg.status).toBe(201);

    const citizenLoginAttempt = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'regular.citizen@example.com',
        password: 'Password123!',
        step: 'credentials',
      })
    );
    expect(citizenLoginAttempt.status).toBe(403);
    const citizenLoginJson = await citizenLoginAttempt.json();
    expect(citizenLoginJson.error).toContain('Access restricted');

    // 2. Admin valid credentials -> Step 1 returns 2FA challenge
    const adminStep1 = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'admin@civicresolve.gov',
        password: 'TestAdmin#2026!Secure',
        step: 'credentials',
      })
    );
    expect(adminStep1.status).toBe(200);
    const step1Json = await adminStep1.json();
    expect(step1Json.requires2FA).toBe(true);
    expect(step1Json.challengeId).toBeTruthy();
    expect(step1Json.maskedEmail).toBe('ad***@civicresolve.gov');
    expect(step1Json.demoCode).toMatch(/^\d{6}$/);

    const challengeId = step1Json.challengeId;
    const validOtp = step1Json.demoCode;

    // 3. Step 2: Invalid 2FA code is rejected -> 400
    const invalidOtpRes = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        step: 'verify_2fa',
        challengeId,
        code: '000000',
      })
    );
    expect(invalidOtpRes.status).toBe(400);
    const invalidJson = await invalidOtpRes.json();
    expect(invalidJson.error).toContain('Incorrect 6-digit security code');

    // 4. Step 2: Correct 2FA code succeeds -> 200, returns admin user & sets HTTP-only cookie
    const validOtpRes = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        step: 'verify_2fa',
        challengeId,
        code: validOtp,
      })
    );
    expect(validOtpRes.status).toBe(200);
    const validJson = await validOtpRes.json();
    expect(validJson.success).toBe(true);
    expect(validJson.user.email).toBe('admin@civicresolve.gov');
    expect(validJson.user.role).toBe('ADMIN');
    const admin2FACookie = extractCookieValue(validOtpRes, SESSION_COOKIE_NAME);
    expect(admin2FACookie).toBeTruthy();

    // 5. Code replay / re-use must fail (single-use OTP burned)
    const replayRes = await loginPost(
      makeJsonRequest('http://localhost/api/auth/login', 'POST', {
        step: 'verify_2fa',
        challengeId,
        code: validOtp,
      })
    );
    expect(replayRes.status).toBe(400);

    // 6. Verified admin session cookie has full access to Admin Command
    const testAdminAccess = await adminComplaintsGet(
      makeJsonRequest('http://localhost/api/admin/complaints', 'GET', undefined, admin2FACookie)
    );
    expect(testAdminAccess.status).toBe(200);
  });
});
