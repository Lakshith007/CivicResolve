'use client';

import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Send, Timer } from 'lucide-react';
import type { CivicIssue } from '@/types/civic';
import { formatDurationHours } from '@/lib/dateFormat';

export interface AdminKpis {
  total: number;
  activeOpen: number;
  awaitingDispatch: number;
  inProgress: number;
  resolved: number;
  criticalActive: number;
  avgResolutionHours: number | null;
  resolutionRate: number;
}

export function computeAvgResolutionHours(list: CivicIssue[]): number | null {
  const resolved = list.filter((i) => i.status === 'Resolved');
  if (resolved.length === 0) return null;
  const totalHours = resolved.reduce((acc, issue) => {
    const start = new Date(issue.createdAt).getTime();
    const end = new Date(issue.updatedAt).getTime();
    const diffHours = Math.max(0, (end - start) / 3_600_000);
    return acc + diffHours;
  }, 0);
  return totalHours / resolved.length;
}

export function computeAdminKpis(issues: CivicIssue[]): AdminKpis {
  const total = issues.length;
  const awaitingDispatch = issues.filter((i) => i.status === 'Reported').length;
  const inProgress = issues.filter((i) => i.status === 'In Progress').length;
  const resolved = issues.filter((i) => i.status === 'Resolved').length;
  const activeOpen = awaitingDispatch + inProgress;
  const criticalActive = issues.filter(
    (i) => i.priority === 'Critical' && i.status !== 'Resolved'
  ).length;
  const avgResolutionHours = computeAvgResolutionHours(issues);
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    total,
    activeOpen,
    awaitingDispatch,
    inProgress,
    resolved,
    criticalActive,
    avgResolutionHours,
    resolutionRate,
  };
}

interface AdminKpiGridProps {
  kpis: AdminKpis;
  averageUrgency: number;
}

export function AdminKpiGrid({ kpis, averageUrgency }: AdminKpiGridProps) {
  return (
    <section
      aria-label="Municipal performance KPIs"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Active Complaints
          </p>
          <Activity className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            {kpis.activeOpen}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-600">
            Total logged: {kpis.total} · Avg Urgency: {averageUrgency}/100
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-amber-200/90 bg-amber-50/50 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Awaiting Dispatch
          </p>
          <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-amber-950 tabular-nums">
            {kpis.awaitingDispatch}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-amber-900">Requires crew assignment</p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-blue-200/90 bg-blue-50/50 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-900">
            In Progress
          </p>
          <Send className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-blue-950 tabular-nums">
            {kpis.inProgress}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-blue-900">Active field operations</p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/90 bg-emerald-50/50 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
            Resolved
          </p>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-emerald-950 tabular-nums">
            {kpis.resolved}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-emerald-900">
            {kpis.resolutionRate}% closure rate
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-red-200/90 bg-red-50/60 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-900">
            Critical Active
          </p>
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-red-950 tabular-nums">
            {kpis.criticalActive}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-red-900">Immediate SLA escalation</p>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Avg Resolution
          </p>
          <Timer className="h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
        </div>
        <div className="mt-2.5">
          <p className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            {formatDurationHours(kpis.avgResolutionHours)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-600">
            Based on {kpis.resolved} resolved ticket{kpis.resolved === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </section>
  );
}
