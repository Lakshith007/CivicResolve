import { NextResponse } from 'next/server';
import { hydrateAuditLogsFromFirestore } from '@/lib/auditStore';
import { requireAdmin } from '@/lib/authGuards';
import { getDashboardStats, hydrateIssuesFromFirestore } from '@/lib/issueStore';

export async function GET(request: Request) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response;

  const [issues, auditLogs] = await Promise.all([
    hydrateIssuesFromFirestore(),
    hydrateAuditLogsFromFirestore(50),
  ]);
  const stats = getDashboardStats(issues);

  return NextResponse.json({
    stats,
    auditLogs,
    admin: guard.user,
  });
}
