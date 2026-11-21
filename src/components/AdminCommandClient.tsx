'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Landmark, LogOut, ShieldCheck } from 'lucide-react';
import type {
  AuditLogEntry,
  CivicIssue,
  DashboardStats,
  Department,
  IssuePriority,
  IssueStatus,
  SessionUser,
} from '@/types/civic';
import { AdminDashboard } from '@/components/AdminDashboard';

interface AdminCommandClientProps {
  initialIssues: CivicIssue[];
  initialStats: DashboardStats;
  initialAuditLogs: AuditLogEntry[];
  adminUser: SessionUser;
}

export function AdminCommandClient({
  initialIssues,
  initialStats,
  initialAuditLogs,
  adminUser,
}: AdminCommandClientProps) {
  const [issues, setIssues] = useState<CivicIssue[]>(initialIssues);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);

  const refreshAnalytics = async () => {
    const res = await fetch('/api/admin/analytics', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.stats) setStats(data.stats);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
    }
  };

  const handleUpdateIssue = async (
    id: string,
    payload: {
      status: IssueStatus;
      department: Department;
      priority: IssuePriority;
      priorityOverrideReason?: string;
      adminNotes: string;
      resolutionEvidenceUrl?: string;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Failed to update issue.' };
    }
    setIssues((prev) => prev.map((item) => (item.id === id ? data.issue : item)));
    if (data.stats) setStats(data.stats);
    await refreshAnalytics();
    return { ok: true };
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  CivicResolve Admin Command
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  Authorized: {adminUser.name}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Municipal Authority Triage, Departmental Dispatch &amp; Immutable Audit Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Citizen Portal</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AdminDashboard
          issues={issues}
          stats={stats}
          auditLogs={auditLogs}
          onUpdateIssue={handleUpdateIssue}
        />
      </main>
    </div>
  );
}
