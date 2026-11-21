'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  FilePlus2,
  Landmark,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  CivicIssue,
  DashboardStats,
  Department,
  IssuePriority,
  IssueStatus,
} from '@/types/civic';
import { ReportIssueForm } from '@/components/ReportIssueForm';
import { TrackingDashboard } from '@/components/TrackingDashboard';
import { AdminDashboard } from '@/components/AdminDashboard';

type TabKey = 'report' | 'track' | 'admin';

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

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

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

  const handleUpdateIssue = async (
    id: string,
    payload: {
      status: IssueStatus;
      department: Department;
      priority: IssuePriority;
      adminNotes: string;
    }
  ) => {
    const res = await fetch(`/api/issues/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        updatedBy: 'Municipal Command Desk',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setIssues((prev) => prev.map((item) => (item.id === id ? data.issue : item)));
      if (data.stats) setStats(data.stats);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Accessible Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'admin'}
              onClick={() => setActiveTab('admin')}
              className={`focus-ring inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Admin Command</span>
            </button>
          </nav>
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
                onUpvote={handleUpvote}
              />
            )}

            {activeTab === 'admin' && (
              <AdminDashboard
                issues={issues}
                stats={stats}
                onUpdateIssue={handleUpdateIssue}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
