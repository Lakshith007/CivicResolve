'use client';

import React from 'react';
import { BarChart3, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { ISSUE_PRIORITIES, type CivicIssue } from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatDateTime, formatDurationHours } from '@/lib/dateFormat';
import { AdminKpiGrid, type AdminKpis } from '@/components/admin/AdminKpiGrid';
import type { DepartmentMetric } from '@/components/admin/AdminDepartmentPanel';

interface AdminResolutionReportsProps {
  issues: CivicIssue[];
  kpis: AdminKpis;
  averageUrgency: number;
  departmentMetrics: DepartmentMetric[];
  onOpenModal: (issue: CivicIssue, focus?: 'general' | 'department' | 'priority') => void;
}

export function AdminResolutionReports({
  issues,
  kpis,
  averageUrgency,
  departmentMetrics,
  onOpenModal,
}: AdminResolutionReportsProps) {
  const resolvedIssues = issues.filter((i) => i.status === 'Resolved');
  const priorityCounts = ISSUE_PRIORITIES.map((p) => ({
    priority: p,
    total: issues.filter((i) => i.priority === p).length,
    resolved: issues.filter((i) => i.priority === p && i.status === 'Resolved').length,
  }));

  return (
    <div className="space-y-6">
      <AdminKpiGrid kpis={kpis} averageUrgency={averageUrgency} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Priority Closure Breakdown */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Resolution Rate by Priority Tier</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Calculated directly from live database ticket statuses
          </p>
          <div className="mt-4 space-y-3">
            {priorityCounts.map((row) => {
              const pct = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
              return (
                <div key={row.priority} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <PriorityBadge priority={row.priority} />
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {row.resolved} / {row.total} resolved ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Department Resolution Summary */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Department Turnaround Summary</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Resolved volume &amp; average closure time per municipal division
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/90">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="px-3 py-2.5">Division</th>
                  <th className="px-3 py-2.5 text-center">Resolved</th>
                  <th className="px-3 py-2.5 text-center">Overdue</th>
                  <th className="px-3 py-2.5 text-right">Avg Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {departmentMetrics.map((m) => (
                  <tr key={m.department} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{m.department}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-700 tabular-nums">
                      {m.resolved}/{m.total}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-red-700 tabular-nums">
                      {m.overdue}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                      {formatDurationHours(m.avgResHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Resolved Archive */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          Resolved Complaints Archive ({resolvedIssues.length})
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Completed municipal work orders with official closure notes and uploaded evidence
        </p>
        {resolvedIssues.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-slate-400" aria-hidden="true" />
            <p className="text-xs font-medium text-slate-700">No resolved complaints recorded yet.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {resolvedIssues.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-blue-700">{item.id}</span>
                  <StatusBadge status={item.status} />
                </div>
                <h3 className="mt-1.5 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-0.5 text-slate-600">
                  {item.department} · {item.location}
                </p>
                {item.adminNotes && (
                  <p className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-700">
                    <strong>Resolution Note:</strong> {item.adminNotes}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span suppressHydrationWarning>Closed {formatDateTime(item.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={() => onOpenModal(item, 'general')}
                    className="focus-ring rounded px-1 py-0.5 font-semibold text-blue-700 hover:underline"
                  >
                    Inspect Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
