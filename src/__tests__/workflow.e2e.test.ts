import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as analyzePost } from '@/app/api/analyze/route';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { GET as adminComplaintsGet } from '@/app/api/admin/complaints/route';
import { GET as adminAnalyticsGet } from '@/app/api/admin/analytics/route';
import { GET as issuesGet, POST as issuesPost } from '@/app/api/issues/route';
import { GET as issueByIdGet, PATCH as issueByIdPatch } from '@/app/api/issues/[id]/route';
import { resetAuditStoreForTesting } from '@/lib/auditStore';
import { resetRateLimitsForTesting } from '@/lib/authGuards';
import { resetAuthStoreForTesting, SESSION_COOKIE_NAME } from '@/lib/authStore';
import { resetIssueStoreForTesting } from '@/lib/issueStore';

function extractCookieValue(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function makeRequest(
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

const SAMPLE_PNG = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString('base64')}`;

describe('CivicResolve End-to-End Core Workflow', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@civicresolve.gov';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'TestAdmin#2026!Secure';
    process.env.ADMIN_BOOTSTRAP_NAME = 'Municipal Chief Admin';
    delete process.env.GEMINI_API_KEY;

    resetAuthStoreForTesting();
    resetIssueStoreForTesting();
    resetAuditStoreForTesting();
    resetRateLimitsForTesting();
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it('completes full lifecycle: citizen report -> AI triage -> community upvote -> admin dispatch -> resolution -> citizen verification', async () => {
    // 1. Citizen registers & signs in
    const regRes = await registerPost(
      makeRequest('http://localhost/api/auth/register', 'POST', {
        name: 'Kiran Patel',
        email: 'kiran@example.com',
        password: 'Password123!',
      })
    );
    expect(regRes.status).toBe(201);
    const citizenCookie = extractCookieValue(regRes, SESSION_COOKIE_NAME);
    expect(citizenCookie).toBeTruthy();

    // 2. Citizen previews AI classification via /api/analyze
    const analyzeRes = await analyzePost(
      makeRequest(
        'http://localhost/api/analyze',
        'POST',
        {
          title: 'Burst drinking water pipeline outside City General Hospital',
          description: 'Clean water main burst flooding ambulance approach road.',
          location: 'Hospital Approach Road',
          imageBase64: SAMPLE_PNG,
        },
        citizenCookie
      )
    );
    expect(analyzeRes.status).toBe(200);
    const analyzeJson = await analyzeRes.json();
    expect(analyzeJson.analysis.category).toBe('Water Supply & Leakage');
    expect(analyzeJson.analysis.department).toBe('Water Works & Hydraulic Engineering');
    expect(analyzeJson.analysis.priority).toBe('Critical');

    // Rejects invalid SVG image payload on /api/analyze
    const badAnalyze = await analyzePost(
      makeRequest('http://localhost/api/analyze', 'POST', {
        title: 'Water leak',
        description: 'Water leaking near hospital road.',
        imageBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      })
    );
    expect(badAnalyze.status).toBe(400);

    // 3. Citizen submits civic complaint with valid PNG photo
    const createRes = await issuesPost(
      makeRequest(
        'http://localhost/api/issues',
        'POST',
        {
          title: 'Burst drinking water pipeline outside City General Hospital',
          description: 'Clean water main burst flooding ambulance approach road.',
          location: 'Hospital Approach Road',
          ward: 'Ward 12 — Hospital & University Zone',
          reporterName: 'Kiran Patel',
          reporterContact: 'kiran@example.com',
          imageUrl: SAMPLE_PNG,
        },
        citizenCookie
      )
    );
    expect(createRes.status).toBe(201);
    const { issue: created } = await createRes.json();
    expect(created.status).toBe('Reported');
    expect(created.department).toBe('Water Works & Hydraulic Engineering');

    // Citizen sees their complaint in ?scope=mine
    const mineRes = await issuesGet(
      makeRequest('http://localhost/api/issues?scope=mine', 'GET', undefined, citizenCookie)
    );
    expect(mineRes.status).toBe(200);
    const mineJson = await mineRes.json();
    expect(mineJson.issues.some((i: { id: string }) => i.id === created.id)).toBe(true);

    // 4. Another citizen upvotes the ticket without seeing reporterContact
    const upvoteRes = await issueByIdPatch(
      makeRequest(`http://localhost/api/issues/${created.id}`, 'PATCH', { action: 'upvote' }),
      { params: { id: created.id } }
    );
    expect(upvoteRes.status).toBe(200);
    const upvoteJson = await upvoteRes.json();
    expect(upvoteJson.issue.upvotes).toBe(2);
    expect(upvoteJson.issue.reporterContact).toBeUndefined();

    // 5. Administrator logs in, views queue, dispatches crew (In Progress), and resolves with PNG evidence
    const adminLoginRes = await loginPost(
      makeRequest('http://localhost/api/auth/login', 'POST', {
        email: 'admin@civicresolve.gov',
        password: 'TestAdmin#2026!Secure',
      })
    );
    expect(adminLoginRes.status).toBe(200);
    const adminCookie = extractCookieValue(adminLoginRes, SESSION_COOKIE_NAME);

    const queueRes = await adminComplaintsGet(
      makeRequest('http://localhost/api/admin/complaints', 'GET', undefined, adminCookie)
    );
    expect(queueRes.status).toBe(200);

    const dispatchRes = await issueByIdPatch(
      makeRequest(
        `http://localhost/api/issues/${created.id}`,
        'PATCH',
        {
          status: 'In Progress',
          department: 'Water Works & Hydraulic Engineering',
          adminNotes: 'Emergency Hydraulic Squad H-1 dispatched.',
        },
        adminCookie
      ),
      { params: { id: created.id } }
    );
    expect(dispatchRes.status).toBe(200);

    const resolveRes = await issueByIdPatch(
      makeRequest(
        `http://localhost/api/issues/${created.id}`,
        'PATCH',
        {
          status: 'Resolved',
          department: 'Water Works & Hydraulic Engineering',
          adminNotes: 'Main collar replaced and pressure verified.',
          resolutionEvidenceUrl: SAMPLE_PNG,
        },
        adminCookie
      ),
      { params: { id: created.id } }
    );
    expect(resolveRes.status).toBe(200);

    // 6. Citizen inspects final Resolved state, 3-stage timeline, and resolution evidence
    const trackRes = await issueByIdGet(
      makeRequest(`http://localhost/api/issues/${created.id}`, 'GET', undefined, citizenCookie),
      { params: { id: created.id } }
    );
    expect(trackRes.status).toBe(200);
    const trackJson = await trackRes.json();
    expect(trackJson.issue.status).toBe('Resolved');
    expect(trackJson.issue.statusHistory).toHaveLength(3);
    expect(trackJson.issue.resolutionEvidenceUrl).toBe(SAMPLE_PNG);

    // 7. Admin verifies immutable audit log recorded both dispatch & resolution
    const analyticsRes = await adminAnalyticsGet(
      makeRequest('http://localhost/api/admin/analytics', 'GET', undefined, adminCookie)
    );
    expect(analyticsRes.status).toBe(200);
    const analyticsJson = await analyticsRes.json();
    const ticketLogs = analyticsJson.auditLogs.filter(
      (l: { targetTicketId: string }) => l.targetTicketId === created.id
    );
    expect(ticketLogs).toHaveLength(2);
  });
});
