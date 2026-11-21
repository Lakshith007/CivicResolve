'use client';

import React from 'react';
import { AlertTriangle, Building2, Camera, MapPin, Sparkles } from 'lucide-react';
import type { CivicIssue } from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatDateTime } from '@/lib/dateFormat';

interface WorkerJobCardProps {
  issue: CivicIssue;
  onOpenProofModal: (issue: CivicIssue) => void;
}

/** Dispatched work order card for the Field Crew Portal. */
export function WorkerJobCard({ issue, onOpenProofModal }: WorkerJobCardProps) {
  const verification = issue.fieldVerification;
  const isRejected = verification?.verificationStatus === 'Rejected';
  const isPending = verification?.verificationStatus === 'Pending Verification';

  return (
    <article
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

        <h2 className="mt-3 text-base font-bold leading-snug text-slate-900">{issue.title}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{issue.description}</p>

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
            <p className="mt-1 text-[11px] text-red-800">Reviewed by {verification.reviewedBy}</p>
          </div>
        )}

        {/* Pending Verification Preview */}
        {isPending && verification && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-950">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-bold text-violet-900">Submitted for Admin Verification</span>
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
            onClick={() => onOpenProofModal(issue)}
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
}
