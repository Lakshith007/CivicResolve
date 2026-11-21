'use client';

import React from 'react';
import { ClipboardEdit, Search, SlidersHorizontal } from 'lucide-react';
import {
  DEPARTMENTS,
  type CivicIssue,
  type Department,
  type IssuePriority,
  type IssueStatus,
} from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatRelativeAge, formatShortDate } from '@/lib/dateFormat';

export type QueueFilter = 'active' | 'all' | 'resolved' | IssuePriority;

const QUEUE_FILTER_PILLS: Array<{ key: QueueFilter; label: string }> = [
  { key: 'active', label: 'Active Queue' },
  { key: 'all', label: 'All Tickets' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'Critical', label: 'Critical' },
  { key: 'High', label: 'High' },
  { key: 'Medium', label: 'Medium' },
  { key: 'Low', label: 'Low' },
];

interface AdminTriageQueueProps {
  filteredQueue: CivicIssue[];
  queueFilter: QueueFilter;
  onQueueFilterChange: (filter: QueueFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  departmentFilter: 'All' | Department;
  onDepartmentFilterChange: (department: 'All' | Department) => void;
  maxRows?: number;
  isIssueOverdue: (issue: CivicIssue) => boolean;
  onQuickAdvance: (issue: CivicIssue, nextStatus: IssueStatus) => Promise<void>;
  onOpenModal: (issue: CivicIssue, focus?: 'general' | 'department' | 'priority') => void;
  onViewAllComplaints?: () => void;
}

export function AdminTriageQueue({
  filteredQueue,
  queueFilter,
  onQueueFilterChange,
  searchQuery,
  onSearchQueryChange,
  departmentFilter,
  onDepartmentFilterChange,
  maxRows,
  isIssueOverdue,
  onQuickAdvance,
  onOpenModal,
  onViewAllComplaints,
}: AdminTriageQueueProps) {
  const visibleRows = maxRows ? filteredQueue.slice(0, maxRows) : filteredQueue;

  return (
    <section
      aria-labelledby="triage-queue-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2
            id="triage-queue-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <SlidersHorizontal className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Priority Triage Queue</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {filteredQueue.length} ticket{filteredQueue.length === 1 ? '' : 's'}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Ranked by Gemini AI urgency score · Protected mutations persist to database &amp; audit
            trail
          </p>
        </div>

        {/* Search & Department Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search ID, location, keyword, dept..."
              aria-label="Search complaints"
              className="focus-ring w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:bg-white"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value as 'All' | Department)}
            aria-label="Filter queue by department"
            className="focus-ring rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUEUE_FILTER_PILLS.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => onQueueFilterChange(pill.key)}
            className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              queueFilter === pill.key
                ? 'bg-blue-700 text-white shadow-sm'
                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/90">
        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3.5 py-3">Complaint</th>
              <th className="px-3.5 py-3">AI Score &amp; Priority</th>
              <th className="px-3.5 py-3">Assigned Department</th>
              <th className="px-3.5 py-3">Reported</th>
              <th className="px-3.5 py-3">Status</th>
              <th className="px-3.5 py-3 text-right">Dispatch Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <SlidersHorizontal className="mx-auto mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                  <p className="text-xs font-semibold text-slate-700">
                    No complaints match the current filter criteria.
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Try clearing your search query or switching to All Tickets.
                  </p>
                </td>
              </tr>
            ) : (
              visibleRows.map((issue) => (
                <tr key={issue.id} className="align-top transition-colors hover:bg-slate-50/80">
                  <td className="max-w-xs px-3.5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-700">{issue.id}</span>
                      {isIssueOverdue(issue) && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold leading-snug text-slate-900">{issue.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600">
                      {issue.description}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {issue.location} · {issue.ward.split('—')[0].trim()}
                    </p>
                  </td>
                  <td className="px-3.5 py-3.5">
                    <div className="flex flex-col items-start gap-1.5">
                      <PriorityBadge priority={issue.priority} />
                      <span className="font-semibold text-slate-700 tabular-nums">
                        Urgency: {issue.urgencyScore}/100
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-3.5 text-slate-700">
                    <span className="font-medium text-slate-900">{issue.department}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-600">
                      {issue.category}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3.5 text-slate-700">
                    <span suppressHydrationWarning className="block font-medium tabular-nums">
                      {formatRelativeAge(issue.createdAt)}
                    </span>
                    <span suppressHydrationWarning className="mt-0.5 block text-[10px] text-slate-600">
                      {formatShortDate(issue.createdAt)}
                    </span>
                  </td>
                  <td className="px-3.5 py-3.5">
                    <StatusBadge status={issue.status} />
                  </td>
                  <td className="px-3.5 py-3.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {issue.status === 'Reported' && (
                        <button
                          type="button"
                          onClick={() => onQuickAdvance(issue, 'In Progress')}
                          className="focus-ring min-h-[32px] rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
                        >
                          Dispatch
                        </button>
                      )}
                      {issue.status === 'In Progress' &&
                        issue.fieldVerification?.verificationStatus === 'Pending Verification' && (
                          <button
                            type="button"
                            onClick={() => onOpenModal(issue, 'general')}
                            className="focus-ring min-h-[32px] rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-900 transition hover:bg-violet-100"
                          >
                            Verify Proof &amp; Resolve
                          </button>
                        )}
                      {issue.status === 'In Progress' &&
                        issue.fieldVerification?.verificationStatus !== 'Pending Verification' && (
                          <span className="inline-flex min-h-[32px] items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900">
                            Awaiting Crew Photo
                          </span>
                        )}
                      <button
                        type="button"
                        onClick={() => onOpenModal(issue, 'general')}
                        className="focus-ring inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                      >
                        <ClipboardEdit className="h-3 w-3" aria-hidden="true" />
                        <span>Manage</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {maxRows && filteredQueue.length > maxRows && onViewAllComplaints && (
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={onViewAllComplaints}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Show all {filteredQueue.length} complaints in Complaint Management →
          </button>
        </div>
      )}
    </section>
  );
}
