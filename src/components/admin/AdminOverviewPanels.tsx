'use client';

import React from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import type { CivicIssue, IssueStatus } from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatRelativeAge } from '@/lib/dateFormat';

interface AdminOverviewPanelsProps {
  pendingVerifications: CivicIssue[];
  criticalAlerts: CivicIssue[];
  onOpenModal: (issue: CivicIssue, focus?: 'general' | 'department' | 'priority') => void;
  onQuickAdvance: (issue: CivicIssue, nextStatus: IssueStatus) => Promise<void>;
  onViewFullQueue: () => void;
}

export function AdminOverviewPanels({
  pendingVerifications,
  criticalAlerts,
  onOpenModal,
  onQuickAdvance,
  onViewFullQueue,
}: AdminOverviewPanelsProps) {
  return (
    <>
      {pendingVerifications.length > 0 && (
        <section
          aria-labelledby="field-verification-heading"
          className="rounded-2xl border border-violet-300 bg-violet-50/40 p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/80 pb-3">
            <div>
              <h2
                id="field-verification-heading"
                className="flex items-center gap-2 text-base font-bold text-slate-900"
              >
                <ClipboardCheck className="h-4 w-4 text-violet-700" aria-hidden="true" />
                <span>Pending Field Crew Verifications</span>
                <span className="rounded-full bg-violet-700 px-2.5 py-0.5 text-xs font-bold text-white">
                  {pendingVerifications.length} awaiting review
                </span>
              </h2>
              <p className="text-xs text-slate-600">
                Dispatched teams have uploaded completed work photos — inspect and approve to mark
                Resolved
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {pendingVerifications.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-violet-200 bg-white p-4 shadow-sm sm:flex-row"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{item.id}</span>
                    <PriorityBadge priority={item.priority} />
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                      {item.fieldVerification?.crewUnitId}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    <strong>{item.fieldVerification?.crewName}:</strong>{' '}
                    {item.fieldVerification?.completionNotes}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenModal(item, 'general')}
                    className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verify Photo &amp; Approve</span>
                  </button>
                </div>
                {item.fieldVerification?.completionPhotoUrl && (
                  <img
                    src={item.fieldVerification.completionPhotoUrl}
                    alt="Field crew completion proof"
                    className="h-28 w-full shrink-0 rounded-lg border border-slate-200 object-cover sm:w-36"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section
        aria-labelledby="critical-alerts-heading"
        className="rounded-2xl border border-red-200/80 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="critical-alerts-heading"
              className="flex items-center gap-2 text-base font-bold text-slate-900"
            >
              <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />
              <span>Critical Infrastructure Alerts</span>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                {criticalAlerts.length} active
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              High-impact public safety &amp; infrastructure complaints sorted by Gemini AI urgency
              score
            </p>
          </div>
          <button
            type="button"
            onClick={onViewFullQueue}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            View full triage queue →
          </button>
        </div>

        {criticalAlerts.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center text-xs font-medium text-emerald-900">
            <CheckCircle2 className="mb-1.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
            <span>All Critical and High priority civic alerts have been resolved.</span>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {criticalAlerts.slice(0, 4).map((alert) => {
              const isCritical = alert.priority === 'Critical';
              return (
                <div
                  key={alert.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    isCritical
                      ? 'border-red-200 bg-red-50/30 hover:border-red-300'
                      : 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {alert.id}
                        </span>
                        <PriorityBadge priority={alert.priority} />
                        <StatusBadge status={alert.status} />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        AI Urgency {alert.urgencyScore}/100
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-bold text-slate-900">{alert.title}</h3>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {alert.location} ({alert.ward.split('—')[0].trim()})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {alert.department}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatRelativeAge(alert.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-3">
                    <button
                      type="button"
                      onClick={() => onOpenModal(alert, 'general')}
                      className="focus-ring rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                    >
                      Review Complaint
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenModal(alert, 'department')}
                      className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Assign Department
                    </button>
                    {alert.status === 'Reported' && (
                      <button
                        type="button"
                        onClick={() => onQuickAdvance(alert, 'In Progress')}
                        className="focus-ring rounded-lg bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800"
                      >
                        Dispatch Crew
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenModal(alert, 'priority')}
                      className="focus-ring rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Update Priority
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
