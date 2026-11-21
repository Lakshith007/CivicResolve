'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HardHat,
  Landmark,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { DEPARTMENTS, type CivicIssue, type Department, type SessionUser } from '@/types/civic';
import { WorkerJobCard } from '@/components/worker/WorkerJobCard';
import { WorkerProofModal } from '@/components/worker/WorkerProofModal';

interface WorkerPortalClientProps {
  initialIssues: CivicIssue[];
  workerUser: SessionUser;
}

type WorkerTab = 'active' | 'pending_review' | 'completed';

/** Field Crew Portal orchestrator with division scoping, queue tabs, and completion proof modal. */
export function WorkerPortalClient({ initialIssues, workerUser }: WorkerPortalClientProps) {
  const lockedDepartment =
    workerUser.role === 'WORKER' &&
    workerUser.assignedDepartment &&
    workerUser.assignedDepartment !== 'ALL'
      ? workerUser.assignedDepartment
      : null;

  const [issues, setIssues] = useState<CivicIssue[]>(initialIssues);
  const [selectedDepartment, setSelectedDepartment] = useState<'All' | Department>(
    lockedDepartment || 'All'
  );
  const [activeTab, setActiveTab] = useState<WorkerTab>('active');
  const crewName = workerUser.name;
  const crewUnitId = workerUser.crewUnitId || (workerUser.role === 'ADMIN' ? 'ADMIN-FIELD' : 'CREW');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState<CivicIssue | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/worker';
  };

  const refreshIssues = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/issues', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.issues)) setIssues(data.issues);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const deptIssues = useMemo(() => {
    return issues.filter((i) =>
      selectedDepartment === 'All' ? true : i.department === selectedDepartment
    );
  }, [issues, selectedDepartment]);

  const counts = useMemo(() => {
    const activeDispatches = deptIssues.filter(
      (i) =>
        i.status === 'In Progress' &&
        i.fieldVerification?.verificationStatus !== 'Pending Verification'
    ).length;
    const reworkRequested = deptIssues.filter(
      (i) =>
        i.status === 'In Progress' && i.fieldVerification?.verificationStatus === 'Rejected'
    ).length;
    const pendingReview = deptIssues.filter(
      (i) =>
        i.status === 'In Progress' &&
        i.fieldVerification?.verificationStatus === 'Pending Verification'
    ).length;
    const completed = deptIssues.filter((i) => i.status === 'Resolved').length;
    return { activeDispatches, reworkRequested, pendingReview, completed };
  }, [deptIssues]);

  const visibleJobs = useMemo(() => {
    return [...deptIssues]
      .filter((i) => {
        if (activeTab === 'active') {
          return (
            i.status === 'In Progress' &&
            i.fieldVerification?.verificationStatus !== 'Pending Verification'
          );
        }
        if (activeTab === 'pending_review') {
          return (
            i.status === 'In Progress' &&
            i.fieldVerification?.verificationStatus === 'Pending Verification'
          );
        }
        return i.status === 'Resolved';
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [deptIssues, activeTab]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-700 text-white shadow-sm">
              <HardHat className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                  CivicResolve
                </h1>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                  Field Crew Portal
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Dispatched Work Teams · Upload Completion Proof for Administrator Verification
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 md:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>{crewUnitId} · Authenticated</span>
            </span>
            <button
              type="button"
              onClick={refreshIssues}
              disabled={isRefreshing}
              className="focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-100 disabled:opacity-60 sm:min-h-[38px]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-amber-700' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/"
              className="focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors duration-150 hover:bg-slate-50 sm:min-h-[38px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-slate-800 sm:min-h-[38px]"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className="focus-ring inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-emerald-100 sm:min-h-[32px] sm:min-w-[32px]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Authenticated Crew Profile & Division Scope Bar */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label
                htmlFor="worker-dept-select"
                className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                Authorized Municipal Division {lockedDepartment ? '(Locked)' : ''}
              </label>
              {lockedDepartment ? (
                <div className="mt-1 flex min-h-[44px] items-center rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-bold text-amber-950 sm:min-h-[38px]">
                  {lockedDepartment}
                </div>
              ) : (
                <select
                  id="worker-dept-select"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value as 'All' | Department)}
                  className="focus-ring mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 transition-colors focus:border-blue-500 focus:bg-white sm:min-h-[38px]"
                >
                  <option value="All">All Dispatched Divisions</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Verified Crew / Team Identity
              </span>
              <div className="mt-1 flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 sm:min-h-[38px]">
                {crewName}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Authorized Crew Unit ID
              </span>
              <div className="mt-1 flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-bold text-blue-800 sm:min-h-[38px]">
                {crewUnitId}
              </div>
            </div>
          </div>
        </section>

        {/* Field Crew KPI Strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 shadow-sm transition-shadow duration-150 hover:shadow-md sm:p-4">
            <p className="text-[11px] font-semibold uppercase text-blue-800">Active Dispatches</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-blue-950">{counts.activeDispatches}</p>
            <p className="text-[11px] text-blue-800">Awaiting completion photo</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3.5 shadow-sm transition-shadow duration-150 hover:shadow-md sm:p-4">
            <p className="text-[11px] font-semibold uppercase text-red-800">Rework Requested</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-red-900">{counts.reworkRequested}</p>
            <p className="text-[11px] text-red-800">Supervisor feedback pending</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5 shadow-sm transition-shadow duration-150 hover:shadow-md sm:p-4">
            <p className="text-[11px] font-semibold uppercase text-violet-800">
              Awaiting Admin Review
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-violet-950">{counts.pendingReview}</p>
            <p className="text-[11px] text-violet-800">Proof photo submitted</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-sm transition-shadow duration-150 hover:shadow-md sm:p-4">
            <p className="text-[11px] font-semibold uppercase text-emerald-800">
              Verified &amp; Closed
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-950">{counts.completed}</p>
            <p className="text-[11px] text-emerald-800">Approved by administrator</p>
          </div>
        </section>

        {/* Tabs */}
        <div role="tablist" aria-label="Field crew dispatch queues" className="flex flex-wrap gap-2">
          <button
            type="button"
            role="tab"
            id="worker-tab-active"
            aria-selected={activeTab === 'active'}
            aria-controls="worker-jobs-panel"
            onClick={() => setActiveTab('active')}
            className={`focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 sm:min-h-[38px] ${
              activeTab === 'active'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Active Dispatches ({counts.activeDispatches})</span>
          </button>
          <button
            type="button"
            role="tab"
            id="worker-tab-pending"
            aria-selected={activeTab === 'pending_review'}
            aria-controls="worker-jobs-panel"
            onClick={() => setActiveTab('pending_review')}
            className={`focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 sm:min-h-[38px] ${
              activeTab === 'pending_review'
                ? 'bg-violet-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Awaiting Admin Verification ({counts.pendingReview})</span>
          </button>
          <button
            type="button"
            role="tab"
            id="worker-tab-completed"
            aria-selected={activeTab === 'completed'}
            aria-controls="worker-jobs-panel"
            onClick={() => setActiveTab('completed')}
            className={`focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 sm:min-h-[38px] ${
              activeTab === 'completed'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Verified &amp; Completed ({counts.completed})</span>
          </button>
        </div>

        <div
          id="worker-jobs-panel"
          role="tabpanel"
          aria-labelledby={
            activeTab === 'active'
              ? 'worker-tab-active'
              : activeTab === 'pending_review'
              ? 'worker-tab-pending'
              : 'worker-tab-completed'
          }
        >
          {visibleJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/90 p-10 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Landmark className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No jobs in this queue right now.
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
                Tickets appear under Active Dispatches once a Municipal Administrator dispatches them
                (Status: In Progress).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visibleJobs.map((issue) => (
                <WorkerJobCard
                  key={issue.id}
                  issue={issue}
                  onOpenProofModal={setSubmittingIssue}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <WorkerProofModal
        issue={submittingIssue}
        crewName={crewName}
        crewUnitId={crewUnitId}
        onClose={() => setSubmittingIssue(null)}
        onSubmitted={(updatedIssue) => {
          setIssues((prev) =>
            prev.map((item) => (item.id === updatedIssue.id ? updatedIssue : item))
          );
          setToastMessage(
            `Proof photo posted for ${updatedIssue.id}! Sent to Municipal Administrator for verification.`
          );
          setSubmittingIssue(null);
          setActiveTab('pending_review');
        }}
      />
    </div>
  );
}
