'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { DEPARTMENTS, type CivicIssue, type Department } from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatDurationHours } from '@/lib/dateFormat';
import { computeAvgResolutionHours } from '@/components/admin/AdminKpiGrid';

export function isIssueOverdue(issue: CivicIssue): boolean {
  if (issue.status === 'Resolved') return false;
  const ageHours = (Date.now() - new Date(issue.createdAt).getTime()) / 3_600_000;
  // SLA thresholds: Critical > 6h, High > 24h, Medium/Low > 72h
  if (issue.priority === 'Critical') return ageHours > 6;
  if (issue.priority === 'High') return ageHours > 24;
  return ageHours > 72;
}

export function computeDepartmentMetrics(issues: CivicIssue[]): DepartmentMetric[] {
  const totalActive = issues.filter((i) => i.status !== 'Resolved').length;
  return DEPARTMENTS.map((dept) => {
    const deptIssues = issues.filter((i) => i.department === dept);
    const pending = deptIssues.filter((i) => i.status === 'Reported').length;
    const inProgress = deptIssues.filter((i) => i.status === 'In Progress').length;
    const resolved = deptIssues.filter((i) => i.status === 'Resolved').length;
    const active = pending + inProgress;
    const overdue = deptIssues.filter(isIssueOverdue).length;
    const critical = deptIssues.filter(
      (i) => i.priority === 'Critical' && i.status !== 'Resolved'
    ).length;
    const avgResHours = computeAvgResolutionHours(deptIssues);
    const activeSharePct = totalActive > 0 ? Math.round((active / totalActive) * 100) : 0;

    return {
      department: dept,
      total: deptIssues.length,
      pending,
      inProgress,
      resolved,
      active,
      overdue,
      critical,
      avgResHours,
      activeSharePct,
      issues: deptIssues,
    };
  }).sort((a, b) => b.active - a.active || b.total - a.total);
}

export interface DepartmentMetric {
  department: Department;
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  active: number;
  overdue: number;
  critical: number;
  avgResHours: number | null;
  activeSharePct: number;
  issues: CivicIssue[];
}

interface AdminDepartmentPanelProps {
  departmentMetrics: DepartmentMetric[];
  expanded?: boolean;
  inspectedDepartment: Department | null;
  onToggleInspect: (department: Department) => void;
  onFilterDepartment: (department: Department) => void;
  onInspectDivisions?: () => void;
  onOpenModal: (issue: CivicIssue, focus?: 'general' | 'department' | 'priority') => void;
}

export function AdminDepartmentPanel({
  departmentMetrics,
  expanded = false,
  inspectedDepartment,
  onToggleInspect,
  onFilterDepartment,
  onInspectDivisions,
  onOpenModal,
}: AdminDepartmentPanelProps) {
  return (
    <section
      aria-labelledby="department-workload-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="department-workload-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <Building2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Department Workload &amp; Performance</span>
          </h2>
          <p className="text-xs text-slate-500">
            Live division assignments calculated from database records (workload bar = share of
            active citywide queue)
          </p>
        </div>
        {!expanded && onInspectDivisions && (
          <button
            type="button"
            onClick={onInspectDivisions}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Inspect divisions →
          </button>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${expanded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {departmentMetrics.map((m) => {
          const isInspected = inspectedDepartment === m.department;
          return (
            <div
              key={m.department}
              className={`rounded-xl border p-3.5 transition ${
                isInspected
                  ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{m.department}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Total Assigned: <strong className="text-slate-800">{m.total}</strong> · Avg
                    Resolution:{' '}
                    <strong className="text-slate-800">{formatDurationHours(m.avgResHours)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {m.overdue > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                      {m.overdue} overdue
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (expanded) {
                        onToggleInspect(m.department);
                      } else {
                        onFilterDepartment(m.department);
                      }
                    }}
                    className="focus-ring rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {expanded ? (isInspected ? 'Hide Tickets' : 'Inspect') : 'Filter Queue'}
                  </button>
                </div>
              </div>

              {/* Counts row */}
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                <div className="rounded-lg border border-slate-200/80 bg-white px-2 py-1">
                  <span className="block font-bold text-amber-800 tabular-nums">{m.pending}</span>
                  <span className="text-[10px] text-slate-500">Pending</span>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-2 py-1">
                  <span className="block font-bold text-blue-800 tabular-nums">{m.inProgress}</span>
                  <span className="text-[10px] text-slate-500">In Progress</span>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-2 py-1">
                  <span className="block font-bold text-emerald-800 tabular-nums">{m.resolved}</span>
                  <span className="text-[10px] text-slate-500">Resolved</span>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-2 py-1">
                  <span className="block font-bold text-slate-900 tabular-nums">
                    {m.activeSharePct}%
                  </span>
                  <span className="text-[10px] text-slate-500">Active Share</span>
                </div>
              </div>

              {/* Visual workload bar */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    m.critical > 0
                      ? 'bg-red-600'
                      : m.activeSharePct >= 30
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, m.activeSharePct)}%` }}
                />
              </div>

              {/* Inline expanded ticket inspection */}
              {expanded && isInspected && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  {m.issues.length === 0 ? (
                    <p className="text-xs text-slate-500">No complaints currently assigned.</p>
                  ) : (
                    m.issues.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-700">{item.id}</span>
                            <PriorityBadge priority={item.priority} />
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="mt-0.5 truncate font-semibold text-slate-900">
                            {item.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenModal(item, 'general')}
                          className="focus-ring shrink-0 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          Manage
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Note: Individual division crew headcount/capacity ceilings are not stored in the current
        database; workload utilization reflects each division&apos;s live share of active municipal
        complaints.
      </p>
    </section>
  );
}
