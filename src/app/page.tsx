'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Building2,
  FilePlus2,
  HardHat,
  Home,
  Landmark,
  Loader2,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { CivicIssue, DashboardStats, SessionUser } from '@/types/civic';
import { initAnalytics } from '@/lib/firebase';
import { ReportIssueForm } from '@/components/ReportIssueForm';
import { TrackingDashboard } from '@/components/TrackingDashboard';
import { AdminAuthModal } from '@/components/AdminAuthModal';

type TabKey = 'home' | 'report' | 'track';

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
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [adminAuthOpen, setAdminAuthOpen] = useState(false);

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
    void initAnalytics();
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

  const handleOfficialEntry = () => {
    if (currentUser?.role === 'ADMIN') {
      window.location.href = '/admin';
    } else {
      setAdminAuthOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Clean Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="focus-ring flex items-center gap-2.5 rounded-xl text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-sm">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                CivicResolve
              </span>
              <span className="hidden items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 sm:inline-flex">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                Gemini AI
              </span>
            </div>
          </button>

          {/* Center Navigation Links */}
          <nav
            role="tablist"
            aria-label="CivicResolve navigation views"
            className="flex items-center gap-1 sm:gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                activeTab === 'home'
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Home</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'track'}
              onClick={() => setActiveTab('track')}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                activeTab === 'track'
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Map &amp; Track ({stats.reported + stats.inProgress})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'report'}
              onClick={() => setActiveTab('report')}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                activeTab === 'report'
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Report Issue</span>
            </button>

            <Link
              href="/worker"
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-amber-50 hover:text-amber-800 sm:text-sm"
            >
              <HardHat className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              <span>Field Crew</span>
            </Link>
          </nav>

          {/* Right Admin Control */}
          <div className="flex items-center gap-2">
            {currentUser?.role === 'ADMIN' ? (
              <>
                <Link
                  href="/admin"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span>Admin Command</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  className="focus-ring inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAdminAuthOpen(true)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Official Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Role-Selection Landing View */}
      {activeTab === 'home' ? (
        <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white via-slate-50/60 to-slate-100/70 px-4 py-14 sm:px-6 lg:px-8">
          <div className="w-full max-w-6xl text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-emerald-600 bg-clip-text text-transparent">
                CivicResolve
              </span>
            </h1>
            <p className="mt-3 text-sm font-medium text-slate-600 sm:text-base">
              AI-Driven Civic Issue Reporting &amp; Resolution Platform
            </p>

            {/* Role Selection Cards */}
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Citizen Role Card */}
              <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-500/20">
                      <User className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                      No Login Required
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                    I am a Citizen
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Report civic issues with photo &amp; GPS and track their live resolution across your city.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('report')}
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('track')}
                    className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Activity className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    <span>Explore Live Issue Map &amp; Tracker ({stats.total})</span>
                  </button>
                </div>
              </div>

              {/* Field Crew / Worker Role Card */}
              <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20">
                      <HardHat className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                      Field Operations
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                    I am a Field Crew
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    View dispatched work orders and upload completed repair photos for administrator verification.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5">
                  <Link
                    href="/worker"
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <span>Open Crew Portal</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  <p className="text-center text-[11px] text-slate-500">
                    {stats.inProgress} active dispatch{stats.inProgress === 1 ? '' : 'es'} in progress
                  </p>
                </div>
              </div>

              {/* Government Official Role Card */}
              <div className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-md shadow-indigo-500/20">
                      <Building2 className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-800">
                      2-Step Verification (2FA)
                    </span>
                  </div>

                  <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                    I am a Government Official
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Access the Municipal Operations Command Center to prioritize, dispatch crews, and resolve civic issues.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleOfficialEntry}
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <span>
                      {currentUser?.role === 'ADMIN'
                        ? 'Open Command Center'
                        : 'Get Started'}
                    </span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                  <p className="text-center text-[11px] text-slate-500">
                    Protected by municipal RBAC &amp; immutable audit logging
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-8 text-xs font-medium text-slate-500">
              Select your role to continue
            </p>
          </div>
        </main>
      ) : (
        <>
          {/* Citizen Friction-Free Banner */}
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50/80 via-slate-50 to-blue-50/80 py-2">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  <strong>Public Citizen Access:</strong> Zero login or account creation required.
                  Report issues and track live resolutions instantly.
                </span>
              </p>
              <span className="hidden text-[11px] font-semibold text-blue-700 md:inline">
                Municipal Corporation of CivicResolve
              </span>
            </div>
          </div>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {isLoading && issues.length === 0 ? (
              <div className="flex items-center justify-center py-24 text-slate-600">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-700" aria-hidden="true" />
                <span className="text-sm font-medium">Loading CivicResolve portal...</span>
              </div>
            ) : (
              <>
                {activeTab === 'report' && (
                  <ReportIssueForm
                    currentUser={currentUser}
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
        </>
      )}

      <AdminAuthModal
        isOpen={adminAuthOpen}
        onClose={() => setAdminAuthOpen(false)}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          void fetchIssues();
        }}
        redirectToAdmin={true}
      />
    </div>
  );
}
