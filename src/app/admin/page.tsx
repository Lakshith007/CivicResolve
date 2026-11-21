import React from 'react';
import { authenticateUser } from '@/lib/authGuards';
import { getAuditLogs } from '@/lib/auditStore';
import { getAllIssues, getDashboardStats } from '@/lib/issueStore';
import { AdminCommandClient } from '@/components/AdminCommandClient';
import { AdminAccessGate } from '@/components/AdminAccessGate';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const user = authenticateUser();

  if (!user || user.role !== 'ADMIN') {
    return <AdminAccessGate currentUser={user ?? null} />;
  }

  const issues = getAllIssues();
  const stats = getDashboardStats(issues);
  const auditLogs = getAuditLogs(50);

  return (
    <AdminCommandClient
      initialIssues={issues}
      initialStats={stats}
      initialAuditLogs={auditLogs}
      adminUser={user}
    />
  );
}
