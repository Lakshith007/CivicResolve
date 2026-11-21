import React from 'react';
import { authenticateUser } from '@/lib/authGuards';
import { hydrateAuditLogsFromFirestore } from '@/lib/auditStore';
import { getDashboardStats, hydrateIssuesFromFirestore } from '@/lib/issueStore';
import { AdminCommandClient } from '@/components/AdminCommandClient';
import { AdminAccessGate } from '@/components/AdminAccessGate';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = authenticateUser();

  if (!user || user.role !== 'ADMIN') {
    return <AdminAccessGate currentUser={user ?? null} />;
  }

  const [issues, auditLogs] = await Promise.all([
    hydrateIssuesFromFirestore(),
    hydrateAuditLogsFromFirestore(50),
  ]);
  const stats = getDashboardStats(issues);

  return (
    <AdminCommandClient
      initialIssues={issues}
      initialStats={stats}
      initialAuditLogs={auditLogs}
      adminUser={user}
    />
  );
}
