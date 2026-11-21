'use client';

import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardEdit,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  DEPARTMENTS,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type CivicIssue,
  type DashboardStats,
  type Department,
  type IssuePriority,
  type IssueStatus,
} from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';

interface AdminDashboardProps {
  issues: CivicIssue[];
  stats: DashboardStats;
  onUpdateIssue: (
    id: string,
    payload: {
      status: IssueStatus;
      department: Department;
      priority: IssuePriority;
      adminNotes: string;
    }
  ) => Promise<void>;
}

export function AdminDashboard({ issues, stats, onUpdateIssue }: AdminDashboardProps) {
  const [queueFilter, setQueueFilter] = useState<'active' | 'all' | 'resolved'>('active');
  const [editingIssue, setEditingIssue] = useState<CivicIssue | null>(null);
  const [status, setStatus] = useState<IssueStatus>('In Progress');
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [priority, setPriority] = useState<IssuePriority>('High');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const sortedQueue = useMemo(() => {
    return [...issues]
      .filter((issue) => {
        if (queueFilter === 'active') return issue.status !== 'Resolved';
        if (queueFilter === 'resolved') return issue.status === 'Resolved';
        return true;
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [issues, queueFilter]);

  const openTriageModal = (issue: CivicIssue) => {
    setEditingIssue(issue);
    setStatus(issue.status);
    setDepartment(issue.department);
    setPriority(issue.priority);
    setAdminNotes(issue.adminNotes ?? '');
  };

  const handleSaveTriage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingIssue) return;
    setIsSaving(true);
    try {
      await onUpdateIssue(editingIssue.id, {
        status,
        department,
        priority,
        adminNotes,
      });
      setToastMessage(
        `Updated ${editingIssue.id} → ${status} (${department})`
      );
      setEditingIssue(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAdvance = async (issue: CivicIssue, nextStatus: IssueStatus) => {
    await onUpdateIssue(issue.id, {
      status: nextStatus,
      department: issue.department,
      priority: issue.priority,
      adminNotes:
        nextStatus === 'In Progress'
          ? `Dispatched ${issue.department} crew.`
          : `Verified completed and closed by municipal supervisor.`,
    });
    setToastMessage(`Quick action: ${issue.id} marked ${nextStatus}.`);
  };

  const resolutionRate =
    stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss status notification"
            className="focus-ring rounded p-1 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Authority Overview + Department Workload */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section
          aria-label="Department workload breakdown"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">Department Workload Routing</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {Object.keys(stats.departmentBreakdown).length} active divisions
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {Object.entries(stats.departmentBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([dept, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{dept}</span>
                      <span className="font-bold text-slate-700">
                        {count} ticket{count === 1 ? '' : 's'} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section
          aria-label="Municipal SLA performance"
          className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm lg:col-span-5"
        >
          <div>
            <div className="flex items-center gap-2 text-blue-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-base font-bold text-white">Authority Command Metrics</h2>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              Tickets are automatically prioritized by Gemini AI urgency score (0–100) and
              community upvotes.
            </p>
          </div>

          <div className="my-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-[11px] text-slate-400">Critical Alerts</p>
              <p className="mt-1 text-xl font-extrabold text-red-400">{stats.criticalCount}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-[11px] text-slate-400">Open Backlog</p>
              <p className="mt-1 text-xl font-extrabold text-amber-300">
                {stats.reported + stats.inProgress}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-[11px] text-slate-400">Resolution Rate</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-400">{resolutionRate}%</p>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Click <strong>Manage / Dispatch</strong> on any queue item to reassign departments,
            override priority, or post official field resolution notes.
          </p>
        </section>
      </div>

      {/* Priority Triage Queue */}
      <section
        aria-label="Priority triage queue"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Priority Triage Queue (Sorted by AI Urgency)
              </h2>
              <p className="text-xs text-slate-500">
                Highest-risk infrastructure hazards appear at the top for immediate dispatch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { id: 'active', label: 'Active Queue' },
                { id: 'all', label: 'All Tickets' },
                { id: 'resolved', label: 'Resolved' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQueueFilter(tab.id)}
                className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  queueFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">Ticket / Urgency</th>
                <th className="py-3 pr-4">Issue &amp; Location</th>
                <th className="py-3 pr-4">Assigned Department</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Dispatch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedQueue.map((issue) => (
                <tr key={issue.id} className="align-top hover:bg-slate-50/70">
                  <td className="py-3.5 pr-4">
                    <div className="font-bold text-slate-900">{issue.id}</div>
                    <div className="mt-1">
                      <PriorityBadge priority={issue.priority} />
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-600">
                      Score: {issue.urgencyScore}/100
                    </div>
                  </td>
                  <td className="max-w-xs py-3.5 pr-4">
                    <div className="font-semibold text-slate-900">{issue.title}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{issue.location}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Upvotes: {issue.upvotes} • {issue.category}
                    </div>
                    {issue.adminNotes && (
                      <div className="mt-1.5 rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-900">
                        <strong>Note:</strong> {issue.adminNotes}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 pr-4 text-xs font-semibold text-slate-800">
                    {issue.department}
                    <div className="mt-1 font-normal text-slate-500">
                      SLA: {issue.aiAnalysis.estimatedResolutionSla}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <StatusBadge status={issue.status} />
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {issue.status === 'Reported' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance(issue, 'In Progress')}
                          className="focus-ring rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100"
                        >
                          Dispatch Crew
                        </button>
                      )}
                      {issue.status === 'In Progress' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance(issue, 'Resolved')}
                          className="focus-ring rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Mark Resolved
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openTriageModal(issue)}
                        className="focus-ring inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <ClipboardEdit className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Manage</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Triage Edit Modal */}
      {editingIssue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="triage-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 id="triage-modal-title" className="text-base font-bold text-slate-900">
                  Manage Ticket {editingIssue.id}
                </h3>
                <p className="text-xs text-slate-600">{editingIssue.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingIssue(null)}
                aria-label="Close triage dialog"
                className="focus-ring rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveTriage} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="admin-status" className="block text-xs font-semibold text-slate-800">
                    Workflow Status
                  </label>
                  <select
                    id="admin-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IssueStatus)}
                    className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {ISSUE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="admin-priority" className="block text-xs font-semibold text-slate-800">
                    Priority Override
                  </label>
                  <select
                    id="admin-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as IssuePriority)}
                    className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="admin-dept" className="block text-xs font-semibold text-slate-800">
                  Assigned Municipal Department
                </label>
                <select
                  id="admin-dept"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-notes" className="block text-xs font-semibold text-slate-800">
                  Official Dispatch / Resolution Note
                </label>
                <textarea
                  id="admin-notes"
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter crew ID, action taken, or verification remarks..."
                  className="focus-ring mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingIssue(null)}
                  className="focus-ring rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  <span>Save &amp; Update Timeline</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
