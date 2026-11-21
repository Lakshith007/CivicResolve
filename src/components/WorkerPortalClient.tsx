'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  HardHat,
  Landmark,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { DEPARTMENTS, type CivicIssue, type Department, type SessionUser } from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { compressImageFile } from '@/lib/imageCompress';

interface WorkerPortalClientProps {
  initialIssues: CivicIssue[];
  workerUser: SessionUser;
}

type WorkerTab = 'active' | 'pending_review' | 'completed';

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(isoDate));
}

function generateSampleProofPng(ticketId: string, crewUnitId: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 380;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean municipal field verification card graphic
  const grad = ctx.createLinearGradient(0, 0, 640, 380);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 380);

  // Subtle grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 640; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 380);
    ctx.stroke();
  }
  for (let y = 0; y < 380; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(640, y);
    ctx.stroke();
  }

  // Green verified badge circle
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(320, 125, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(302, 126);
  ctx.lineTo(315, 139);
  ctx.lineTo(340, 112);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FIELD WORK COMPLETED — PROOF', 320, 210);

  ctx.fillStyle = '#93c5fd';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`TICKET: ${ticketId}  |  UNIT: ${crewUnitId}`, 320, 250);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '15px sans-serif';
  ctx.fillText('CivicResolve Municipal Field Operations Evidence', 320, 290);

  ctx.fillStyle = '#6ee7b7';
  ctx.font = '13px monospace';
  ctx.fillText(`Captured: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, 320, 330);

  return canvas.toDataURL('image/png');
}

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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/worker';
  };

  // Proof submission modal state
  const [submittingIssue, setSubmittingIssue] = useState<CivicIssue | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const proofCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasProofOpenRef = useRef(false);

  const closeSubmitModal = () => {
    setSubmittingIssue(null);
    setCompletionNotes('');
    setCompletionPhotoUrl('');
    setModalError(null);
  };

  useEffect(() => {
    if (submittingIssue) {
      if (!wasProofOpenRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }
      wasProofOpenRef.current = true;
      const frame = requestAnimationFrame(() => {
        proofCloseBtnRef.current?.focus();
      });
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSubmitModal();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    if (wasProofOpenRef.current) {
      wasProofOpenRef.current = false;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [submittingIssue]);

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

  const openSubmitModal = (issue: CivicIssue) => {
    setSubmittingIssue(issue);
    setCompletionNotes('');
    setCompletionPhotoUrl('');
    setModalError(null);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setModalError('Completion photo must be a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 10_000_000) {
      setModalError('Completion photo must be under 10 MB.');
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      setCompletionPhotoUrl(compressed);
      setModalError(null);
    } catch {
      setModalError('Unable to process the completion photo.');
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingIssue) return;
    setModalError(null);

    if (crewName.trim().length < 2 || crewUnitId.trim().length < 2) {
      setModalError('Please enter your Crew / Team Name and Crew Unit ID.');
      return;
    }
    if (completionNotes.trim().length < 5) {
      setModalError('Please enter a brief completion work note (5+ characters).');
      return;
    }
    if (!completionPhotoUrl) {
      setModalError('Please upload a completion proof photo (or generate a sample proof photo).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/worker/submit-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: submittingIssue.id,
          crewName: crewName.trim(),
          crewUnitId: crewUnitId.trim(),
          completionNotes: completionNotes.trim(),
          completionPhotoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to submit completion proof.');
        return;
      }

      setIssues((prev) => prev.map((item) => (item.id === submittingIssue.id ? data.issue : item)));
      setToastMessage(
        `Proof photo posted for ${submittingIssue.id}! Sent to Municipal Administrator for verification.`
      );
      closeSubmitModal();
      setActiveTab('pending_review');
    } catch {
      setModalError('Network error while uploading completion proof.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dedicated Field Crew Header */}
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
        <div
          role="tablist"
          aria-label="Field crew dispatch queues"
          className="flex flex-wrap gap-2"
        >
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

        {/* Dispatched Job Cards */}
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
            {visibleJobs.map((issue) => {
              const verification = issue.fieldVerification;
              const isRejected = verification?.verificationStatus === 'Rejected';
              const isPending = verification?.verificationStatus === 'Pending Verification';

              return (
                <article
                  key={issue.id}
                  className={`min-w-0 flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isRejected
                      ? 'border-red-300 ring-1 ring-red-200'
                      : isPending
                      ? 'border-violet-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-800">
                          {issue.id}
                        </span>
                        <PriorityBadge priority={issue.priority} />
                        <StatusBadge status={issue.status} />
                        {isRejected && (
                          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-900">
                            Rework Required
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                            Proof Submitted
                          </span>
                        )}
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">
                        Urgency {issue.urgencyScore}/100
                      </span>
                    </div>

                    <h2 className="mt-3 text-base font-bold leading-snug text-slate-900">
                      {issue.title}
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {issue.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>
                          {issue.location} ({issue.ward.split('—')[0].trim()})
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                        <span>{issue.department}</span>
                      </span>
                    </div>

                    {/* AI Suggested Remediation Action */}
                    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950">
                      <span className="inline-flex items-center gap-1 font-bold text-blue-900">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Dispatch Instructions
                      </span>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        {issue.adminNotes || issue.aiAnalysis.suggestedAction}
                      </p>
                    </div>

                    {/* Supervisor Rework Feedback Banner */}
                    {isRejected && verification?.rejectionReason && (
                      <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                          <span>Supervisor Rework Requested</span>
                        </div>
                        <p className="mt-1">&ldquo;{verification.rejectionReason}&rdquo;</p>
                        <p className="mt-1 text-[11px] text-red-800">
                          Reviewed by {verification.reviewedBy}
                        </p>
                      </div>
                    )}

                    {/* Pending Verification Preview */}
                    {isPending && verification && (
                      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-950">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold text-violet-900">
                            Submitted for Admin Verification
                          </span>
                          <span suppressHydrationWarning className="text-[11px] text-violet-800">
                            {formatDateTime(verification.submittedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px]">
                          <strong>{verification.crewName}</strong> ({verification.crewUnitId}):{' '}
                          {verification.completionNotes}
                        </p>
                        {verification.completionPhotoUrl && (
                          <img
                            src={verification.completionPhotoUrl}
                            alt="Submitted completion proof"
                            className="mt-2 max-h-36 rounded-lg border border-violet-200 object-cover"
                          />
                        )}
                      </div>
                    )}

                    {/* Verified Completed Evidence */}
                    {issue.status === 'Resolved' && issue.resolutionEvidenceUrl && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-950">
                        <span className="font-bold text-emerald-900">
                          Verified &amp; Approved by Administrator
                        </span>
                        <img
                          src={issue.resolutionEvidenceUrl}
                          alt="Verified completed repair"
                          className="mt-2 max-h-36 rounded-lg border border-emerald-200 object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Card Footer CTA */}
                  {issue.status === 'In Progress' && (
                    <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openSubmitModal(issue)}
                        className="focus-ring inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-800 active:scale-[0.98] sm:min-h-[38px] sm:w-auto sm:py-2"
                      >
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {isRejected
                            ? 'Post Updated Proof Photo'
                            : isPending
                            ? 'Replace Submitted Photo'
                            : 'Post Completed Work Photo'}
                        </span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        </div>
      </main>

      {/* Post Completed Work Photo Modal */}
      {submittingIssue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="worker-proof-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-blue-700">
                  {submittingIssue.id}
                </span>
                <h2
                  id="worker-proof-modal-title"
                  className="mt-0.5 text-base font-bold text-slate-900"
                >
                  Post Completed Work Proof
                </h2>
                <p className="text-xs text-slate-600">{submittingIssue.title}</p>
              </div>
              <button
                ref={proofCloseBtnRef}
                type="button"
                onClick={closeSubmitModal}
                aria-label="Close proof upload modal"
                className="focus-ring inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 sm:min-h-[36px] sm:min-w-[36px]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="mt-4 space-y-4">
              {modalError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
                <span className="text-slate-600">
                  Submitting as: <strong className="text-slate-900">{crewName}</strong>
                </span>
                <span className="font-mono font-bold text-blue-800">{crewUnitId}</span>
              </div>

              <div>
                <label
                  htmlFor="worker-proof-photo-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Completed Work Photo * (PNG, JPEG, or WebP)
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors duration-150 hover:bg-slate-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 sm:min-h-[38px]">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Upload Photo</span>
                    <input
                      id="worker-proof-photo-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const png = generateSampleProofPng(submittingIssue.id, crewUnitId || 'CREW-01');
                      if (png) {
                        setCompletionPhotoUrl(png);
                        setModalError(null);
                      }
                    }}
                    className="focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition-colors duration-150 hover:bg-blue-100 sm:min-h-[38px]"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Use Sample Proof Photo</span>
                  </button>
                </div>

                {completionPhotoUrl && (
                  <div className="mt-3">
                    <img
                      src={completionPhotoUrl}
                      alt="Completed work preview"
                      className="max-h-48 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="worker-completion-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Work Completed Summary *
                </label>
                <textarea
                  id="worker-completion-notes"
                  rows={3}
                  required
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Describe the repair completed, parts replaced, and safety verification performed on site..."
                  className="focus-ring mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 transition-colors focus:border-blue-500"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900">
                <strong>Verification Policy:</strong> Posting proof moves this job to the Municipal
                Administrator&apos;s Verification Queue. The ticket will be marked{' '}
                <strong>Resolved</strong> once the administrator verifies your photo.
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={closeSubmitModal}
                  className="focus-ring min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 sm:min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="focus-ring inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-700 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-800 active:scale-[0.98] disabled:opacity-50 sm:min-h-[38px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      <span>Submitting Proof...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Submit to Administrator</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
