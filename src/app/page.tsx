'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  FilePlus2,
  Landmark,
  Loader2,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { CivicIssue, DashboardStats, SessionUser } from '@/types/civic';
import { ReportIssueForm } from '@/components/ReportIssueForm';
import { TrackingDashboard } from '@/components/TrackingDashboard';
import { AuthModal } from '@/components/AuthModal';

type TabKey = 'report' | 'track';

const INITIAL_STATS: DashboardStats = {
  total: 0,
  reported: 0,
  inProgress: 0,
  resolved: 0,
  criticalCount: 0,
  averageUrgency: 0,
  departmentBreakdown: {},
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('report');
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch('/api/issues', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setIssues(data.issues || []);
      setStats(data.stats || INITIAL_STATS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser(data.user ?? null);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
    void fetchIssues();
  }, [fetchSession, fetchIssues]);

  const handleIssueCreated = (newIssue: CivicIssue) => {
    setIssues((prev) => [newIssue, ...prev]);
    setHighlightedId(newIssue.id);
    void fetchIssues();
  };

  const handleUpvote = async (id: string) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upvote' }),
    });
    if (res.ok) {
      const data = await res.json();
      setIssues((prev) => prev.map((item) => (item.id === id ? data.issue : item)));
      if (data.stats) setStats(data.stats);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    void fetchIssues();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Accessible Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
              <Landmark className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  CivicResolve
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Intelligent Civic Issue Reporting, Automated Triage &amp; Transparent Resolution
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <nav
              role="tablist"
              aria-label="CivicResolve navigation views"
              className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'report'}
                onClick={() => setActiveTab('report')}
                className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                  activeTab === 'report'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Report Issue</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'track'}
                onClick={() => setActiveTab('track')}
                className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                  activeTab === 'track'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <Activity className="h-4 w-4" aria-hidden="true" />
                <span>Track Issues ({stats.total})</span>
              </button>

              {/* Admin Command link rendered ONLY when server session verifies role === ADMIN */}
              {currentUser?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:text-sm"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Admin Command</span>
                </Link>
              )}
            </nav>

            {currentUser ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                <UserCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">{currentUser.name}</span>
                  <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="focus-ring ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 sm:text-sm"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading && issues.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-slate-600">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
            <span className="text-sm font-medium">Loading CivicResolve command board...</span>
          </div>
        ) : (
          <>
            {activeTab === 'report' && (
              <ReportIssueForm
                onIssueCreated={handleIssueCreated}
                onSwitchToTrack={(ticketId) => {
                  if (ticketId) setHighlightedId(ticketId);
                  setActiveTab('track');
                }}
                onUpvoteExisting={handleUpvote}
              />
            )}

            {activeTab === 'track' && (
              <TrackingDashboard
                issues={issues}
                stats={stats}
                highlightedId={highlightedId}
                currentUser={currentUser}
                onUpvote={handleUpvote}
              />
            )}
          </>
        )}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          void fetchIssues();
        }}
      />
    </div>
  );
}
