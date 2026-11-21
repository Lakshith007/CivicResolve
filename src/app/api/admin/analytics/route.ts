import { NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/auditStore';
import { requireAdmin } from '@/lib/authGuards';
import { getAllIssues, getDashboardStats } from '@/lib/issueStore';

export async function GET(request: Request) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response;

  const issues = getAllIssues();
  const stats = getDashboardStats(issues);
  const auditLogs = getAuditLogs(50);

  return NextResponse.json({
    stats,
    auditLogs,
    admin: guard.user,
  });
}
