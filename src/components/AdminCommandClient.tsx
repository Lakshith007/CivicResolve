'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FileClock,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCircle2,
} from 'lucide-react';
import type {
  AuditLogEntry,
  CivicIssue,
  DashboardStats,
  Department,
  IssuePriority,
  IssueStatus,
  SessionUser,
} from '@/types/civic';
import { AdminDashboard, type AdminSection } from '@/components/AdminDashboard';

interface AdminCommandClientProps {
  initialIssues: CivicIssue[];
  initialStats: DashboardStats;
  initialAuditLogs: AuditLogEntry[];
  adminUser: SessionUser;
}

const ADMIN_NAV_ITEMS: Array<{
  key: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'complaints', label: 'Complaint Management', icon: ClipboardList },
  { key: 'departments', label: 'Department Management', icon: Building2 },
  { key: 'geography', label: 'Geographic Insights', icon: MapPin },
  { key: 'reports', label: 'Resolution Reports', icon: BarChart3 },
  { key: 'audit', label: 'Audit Logs', icon: FileClock },
];

export function AdminCommandClient({
  initialIssues,
  initialStats,
  initialAuditLogs,
  adminUser,
}: AdminCommandClientProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [issues, setIssues] = useState<CivicIssue[]>(initialIssues);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Header popovers
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedIssueFromHeader, setSelectedIssueFromHeader] = useState<CivicIssue | null>(null);

  const urgentNotifications = useMemo(() => {
    return issues
      .filter(
        (i) =>
          i.status !== 'Resolved' &&
          (i.fieldVerification?.verificationStatus === 'Pending Verification' ||
            i.priority === 'Critical' ||
            i.status === 'Reported')
      )
      .sort((a, b) => {
        const aPending = a.fieldVerification?.verificationStatus === 'Pending Verification' ? 1 : 0;
        const bPending = b.fieldVerification?.verificationStatus === 'Pending Verification' ? 1 : 0;
        if (bPending !== aPending) return bPending - aPending;
        return b.urgencyScore - a.urgencyScore;
      })
      .slice(0, 6);
  }, [issues]);

  const refreshAnalyticsOnly = async () => {
    try {
      const analyticsRes = await fetch('/api/admin/analytics', { cache: 'no-store' });
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        if (aData.stats) setStats(aData.stats);
        if (Array.isArray(aData.auditLogs)) setAuditLogs(aData.auditLogs);
      }
    } catch {
      // Non-blocking audit/analytics refresh
    }
  };

  const refreshCommandData = async () => {
    setIsRefreshing(true);
    try {
      const [complaintsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/complaints', { cache: 'no-store' }),
        fetch('/api/admin/analytics', { cache: 'no-store' }),
      ]);
      if (complaintsRes.ok) {
        const cData = await complaintsRes.json();
        if (Array.isArray(cData.issues)) setIssues(cData.issues);
        if (cData.stats) setStats(cData.stats);
      }
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        if (aData.stats) setStats(aData.stats);
        if (Array.isArray(aData.auditLogs)) setAuditLogs(aData.auditLogs);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const submitAdminPatch = async (
    id: string,
    payload: Record<string, unknown>,
    fallbackError: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || fallbackError };
    }
    setIssues((prev) => prev.map((item) => (item.id === id ? data.issue : item)));
    if (data.stats) setStats(data.stats);
    await refreshAnalyticsOnly();
    return { ok: true };
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
    return submitAdminPatch(id, payload, 'Failed to update issue.');
  };

  const handleVerifyFieldWork = async (
    id: string,
    payload: {
      verificationDecision: 'approve' | 'reject';
      adminNotes?: string;
      rejectionReason?: string;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    return submitAdminPatch(id, payload, 'Failed to record verification decision.');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dedicated Administrative Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
            {/* Brand & Subtitle */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                    CivicResolve
                  </h1>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Command Center
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Municipal Operations Command Center · Triage, Dispatch &amp; Audit Control
                </p>
              </div>
            </div>

            {/* Right Utility Bar: Refresh, Notifications, Profile Menu */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshCommandData}
                disabled={isRefreshing}
                title="Refresh live operational metrics"
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-700' : ''}`}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Sync</span>
              </button>

              {/* Notifications Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((prev) => !prev);
                    setProfileOpen(false);
                  }}
                  aria-label="Open operational notifications"
                  aria-expanded={notifOpen}
                  className="focus-ring relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {urgentNotifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {urgentNotifications.length}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">
                        Active Dispatch Alerts ({urgentNotifications.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
                      >
                        Close
                      </button>
                    </div>
                    <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
                      {urgentNotifications.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-500">
                          No pending urgent dispatch alerts.
                        </p>
                      ) : (
                        urgentNotifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedIssueFromHeader(item);
                              setNotifOpen(false);
                            }}
                            className="w-full rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold text-blue-700">
                                {item.id}
                              </span>
                              <span
                                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  item.priority === 'Critical'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                {item.priority} · {item.urgencyScore}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-900">
                              {item.title}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {item.department} · {item.status}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Administrator Profile Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNotifOpen(false);
                  }}
                  aria-expanded={profileOpen}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left hover:bg-slate-100"
                >
                  <UserCircle2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold leading-tight text-slate-900">
                      {adminUser.name}
                    </p>
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      ADMIN · 2FA VERIFIED
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="border-b border-slate-100 pb-2.5">
                      <p className="text-xs font-bold text-slate-900">{adminUser.name}</p>
                      <p className="text-[11px] text-slate-500">{adminUser.email}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                        Role: {adminUser.role} (2FA Active)
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <Link
                        href="/"
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <span>Open Public Citizen Portal</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Secure Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Administrator Navigation Tabs */}
          <nav
            aria-label="Municipal Operations Command Center navigation"
            className="-mb-px flex gap-1 overflow-x-auto pb-0.5"
          >
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`focus-ring inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'border-blue-700 text-blue-700'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.key === 'complaints' && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {issues.filter((i) => i.status !== 'Resolved').length}
                    </span>
                  )}
                  {item.key === 'audit' && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {auditLogs.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Operations Command Center Main Content */}
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AdminDashboard
          activeSection={activeSection}
          onNavigateSection={setActiveSection}
          issues={issues}
          stats={stats}
          auditLogs={auditLogs}
          selectedIssueFromHeader={selectedIssueFromHeader}
          onClearHeaderSelection={() => setSelectedIssueFromHeader(null)}
          onUpdateIssue={handleUpdateIssue}
          onVerifyFieldWork={handleVerifyFieldWork}
        />
      </main>
    </div>
  );
}
