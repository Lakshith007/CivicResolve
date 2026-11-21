import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authGuards';
import { getAllIssues, getDashboardStats } from '@/lib/issueStore';

export async function GET(request: Request) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response;

  const issues = getAllIssues();
  return NextResponse.json({
    issues,
    stats: getDashboardStats(issues),
    admin: guard.user,
  });
}
