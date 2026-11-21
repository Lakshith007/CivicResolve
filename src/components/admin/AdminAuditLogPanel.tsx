'use client';

import React from 'react';
import { FileClock } from 'lucide-react';
import type { AuditLogEntry } from '@/types/civic';
import { formatDateTime } from '@/lib/dateFormat';

interface AdminAuditLogPanelProps {
  auditLogs: AuditLogEntry[];
  auditFilter: string;
  onAuditFilterChange: (filter: string) => void;
  maxRows?: number;
  onViewFullHistory?: () => void;
}

export function AdminAuditLogPanel({
  auditLogs,
  auditFilter,
  onAuditFilterChange,
  maxRows,
  onViewFullHistory,
}: AdminAuditLogPanelProps) {
  const visible = maxRows ? auditLogs.slice(0, maxRows) : auditLogs;

  return (
    <section
      aria-labelledby="audit-log-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="audit-log-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <FileClock className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Administrative Activity &amp; Immutable Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-500">
            Append-only municipal log of assignments, priority overrides, status transitions &amp;
            admin auth events
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!maxRows && (
            <select
              value={auditFilter}
              onChange={(e) => onAuditFilterChange(e.target.value)}
              aria-label="Filter audit logs by action"
              className="focus-ring rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
            >
              <option value="ALL">All Actions</option>
              <option value="ADMIN_TRIAGE">Triage &amp; Dispatch Updates</option>
              <option value="PRIORITY_OVERRIDE">Priority Overrides</option>
              <option value="ADMIN_VERIFY_AND_RESOLVE">Verified Resolutions</option>
              <option value="ADMIN_REJECT_FIELD_WORK">Rework Requests</option>
              <option value="WORKER_LOGIN">Crew Sign-Ins</option>
              <option value="WORKER_PROOF_SUBMITTED">Crew Proof Submissions</option>
              <option value="WORKER_PLAGIARISM_BLOCKED">Plagiarism Blocks</option>
              <option value="ADMIN_2FA_LOGIN">Admin 2FA Logins</option>
              <option value="ADMIN_LOGOUT">Admin Logouts</option>
            </select>
          )}
          {maxRows && onViewFullHistory && (
            <button
              type="button"
              onClick={onViewFullHistory}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Full audit history →
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
          <FileClock className="mx-auto mb-1.5 h-5 w-5 text-slate-400" aria-hidden="true" />
          <p className="text-xs font-medium text-slate-700">
            No administrative actions recorded yet in this session. Sign-ins, dispatches, and
            priority overrides will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/90">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3.5 py-2.5">Timestamp</th>
                <th className="px-3.5 py-2.5">Administrator</th>
                <th className="px-3.5 py-2.5">Action</th>
                <th className="px-3.5 py-2.5">Target</th>
                <th className="px-3.5 py-2.5">Changes &amp; Override Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visible.map((log) => (
                <tr key={log.id} className="align-top transition-colors hover:bg-slate-50/80">
                  <td
                    suppressHydrationWarning
                    className="whitespace-nowrap px-3.5 py-3 text-slate-600 tabular-nums"
                  >
                    {formatDateTime(log.timestamp)}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="font-semibold text-slate-900">{log.actorEmail}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-600">
                      ID: {log.actorId}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                        log.action.includes('OVERRIDE')
                          ? 'bg-amber-100 text-amber-900'
                          : log.action.includes('LOGIN') || log.action.includes('LOGOUT')
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3 font-mono font-bold text-blue-700">
                    {log.targetTicketId}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {log.previousValues && log.updatedValues && (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {log.previousValues.status !== log.updatedValues.status && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">
                            Status: {String(log.previousValues.status)} →{' '}
                            <strong>{String(log.updatedValues.status)}</strong>
                          </span>
                        )}
                        {log.previousValues.priority !== log.updatedValues.priority && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                            Priority: {String(log.previousValues.priority)} →{' '}
                            <strong>{String(log.updatedValues.priority)}</strong>
                          </span>
                        )}
                        {log.previousValues.department !== log.updatedValues.department && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-900">
                            Dept: {String(log.previousValues.department)} →{' '}
                            <strong>{String(log.updatedValues.department)}</strong>
                          </span>
                        )}
                      </div>
                    )}
                    {log.reason && (
                      <p className="mt-1 text-[11px] font-medium text-amber-900">
                        Reason: &ldquo;{log.reason}&rdquo;
                      </p>
                    )}
                    {!log.previousValues && !log.reason && (
                      <span className="text-[11px] text-slate-500">
                        Authenticated municipal event
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
