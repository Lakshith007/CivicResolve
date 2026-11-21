import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { authenticateUser } from '@/lib/authGuards';
import { getAuditLogs } from '@/lib/auditStore';
import { getAllIssues, getDashboardStats } from '@/lib/issueStore';
import { AdminCommandClient } from '@/components/AdminCommandClient';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const user = authenticateUser();

  if (!user || user.role !== 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section
          aria-labelledby="access-denied-heading"
          className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 id="access-denied-heading" className="mt-4 text-xl font-extrabold text-slate-900">
            Access Denied — Administrator Required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {user
              ? `Your account (${user.email}) has role CITIZEN and does not have administrative permissions.`
              : 'You must sign in with an authorized municipal administrator account to view Admin Command.'}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Return to Citizen Portal</span>
            </Link>
          </div>
        </section>
      </main>
    );
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
