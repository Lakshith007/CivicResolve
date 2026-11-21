'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  DEPARTMENTS,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type CivicIssue,
  type Department,
  type IssuePriority,
  type IssueStatus,
} from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatDateTime } from '@/lib/dateFormat';
import { compressImageFile } from '@/lib/imageCompress';

interface AdminTriageModalProps {
  editingIssue: CivicIssue;
  modalFocusHint: 'general' | 'department' | 'priority';
  onUpdateIssue: (
    id: string,
    payload: {
      status: IssueStatus;
      department: Department;
      priority: IssuePriority;
      priorityOverrideReason?: string;
      adminNotes: string;
      resolutionEvidenceUrl?: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onVerifyFieldWork?: (
    id: string,
    payload: {
      verificationDecision: 'approve' | 'reject';
      adminNotes?: string;
      rejectionReason?: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  onNotify: (message: string) => void;
  onClose: () => void;
}

export function AdminTriageModal({
  editingIssue,
  modalFocusHint,
  onUpdateIssue,
  onVerifyFieldWork,
  onNotify,
  onClose,
}: AdminTriageModalProps) {
  const [status, setStatus] = useState<IssueStatus>(editingIssue.status);
  const [department, setDepartment] = useState<Department>(editingIssue.department);
  const [priority, setPriority] = useState<IssuePriority>(editingIssue.priority);
  const [priorityOverrideReason, setPriorityOverrideReason] = useState('');
  const [adminNotes, setAdminNotes] = useState(editingIssue.adminNotes ?? '');
  const [resolutionEvidenceUrl, setResolutionEvidenceUrl] = useState<string | undefined>(
    editingIssue.resolutionEvidenceUrl
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectingMode, setRejectingMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const modalCloseBtnRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setStatus(editingIssue.status);
    setDepartment(editingIssue.department);
    setPriority(editingIssue.priority);
    setPriorityOverrideReason('');
    setAdminNotes(editingIssue.adminNotes ?? '');
    setResolutionEvidenceUrl(editingIssue.resolutionEvidenceUrl);
    setRejectingMode(false);
    setRejectionReason('');
    setModalError(null);
  }, [editingIssue]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    let frame: number | null = null;
    if (modalFocusHint === 'general') {
      frame = requestAnimationFrame(() => {
        modalCloseBtnRef.current?.focus();
      });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [modalFocusHint]);

  const handleFieldVerificationDecision = async (decision: 'approve' | 'reject') => {
    if (!onVerifyFieldWork) return;
    setModalError(null);
    if (decision === 'reject' && rejectionReason.trim().length < 5) {
      setModalError('Please enter a clear rework reason (5+ characters) for the field crew.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await onVerifyFieldWork(editingIssue.id, {
        verificationDecision: decision,
        adminNotes: adminNotes.trim() || undefined,
        rejectionReason: decision === 'reject' ? rejectionReason.trim() : undefined,
      });
      if (!res.ok) {
        setModalError(res.error || 'Verification update failed.');
        return;
      }
      onNotify(
        decision === 'approve'
          ? `Verified completion photo for ${editingIssue.id} — ticket marked Resolved!`
          : `Sent rework request back to field crew for ${editingIssue.id}.`
      );
      onClose();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setModalError('Resolution evidence must be a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 10_000_000) {
      setModalError('Resolution evidence image must be under 10 MB.');
      return;
    }
    try {
      const compressed = await compressImageFile(file);
      setResolutionEvidenceUrl(compressed);
      setModalError(null);
    } catch {
      setModalError('Unable to process the resolution evidence photo.');
    }
  };

  const handleSaveTriage = async (event: React.FormEvent) => {
    event.preventDefault();
    setModalError(null);

    if (priority !== editingIssue.priority && priorityOverrideReason.trim().length < 5) {
      setModalError(
        'A clear justification (5+ characters) is mandatory when overriding AI priority.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const result = await onUpdateIssue(editingIssue.id, {
        status,
        department,
        priority,
        priorityOverrideReason:
          priority !== editingIssue.priority ? priorityOverrideReason.trim() : undefined,
        adminNotes,
        resolutionEvidenceUrl,
      });

      if (!result.ok) {
        setModalError(result.error || 'Failed to update complaint.');
        return;
      }

      onNotify(`Updated ${editingIssue.id} → ${status} (${department})`);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="triage-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 pt-5 pb-3.5 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-700">{editingIssue.id}</span>
              <PriorityBadge priority={editingIssue.priority} />
              <StatusBadge status={editingIssue.status} />
            </div>
            <h3
              id="triage-modal-title"
              className="mt-1.5 text-base font-bold leading-snug text-slate-900"
            >
              {editingIssue.title}
            </h3>
            <p suppressHydrationWarning className="mt-0.5 text-xs text-slate-600">
              {editingIssue.location} · {editingIssue.ward} · Reported{' '}
              {formatDateTime(editingIssue.createdAt)}
            </p>
          </div>
          <button
            ref={modalCloseBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close complaint triage dialog"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Complaint Context & Gemini AI Summary */}
        <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-xs">
          <p className="leading-relaxed text-slate-800">{editingIssue.description}</p>
          <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-violet-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-violet-900">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Gemini AI Triage ({editingIssue.urgencyScore}/100)
              </span>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-900">
                SLA: {editingIssue.aiAnalysis.estimatedResolutionSla}
              </span>
            </div>
            <p className="mt-1.5 leading-relaxed">{editingIssue.aiAnalysis.aiSummary}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-violet-900">
              <strong>Recommended Action:</strong> {editingIssue.aiAnalysis.suggestedAction}
            </p>
          </div>

          {(editingIssue.imageUrl || editingIssue.fieldVerification) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
                <span className="mb-2 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                  Before · Citizen Reported Photo
                </span>
                {editingIssue.imageUrl ? (
                  <img
                    src={editingIssue.imageUrl}
                    alt="Citizen submitted evidence"
                    className="h-44 w-full rounded-lg border border-slate-200 bg-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                    No citizen photo attached
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-violet-200 bg-white p-2.5 shadow-xs">
                <span className="mb-2 inline-flex items-center rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
                  After · Field Crew Proof
                  {editingIssue.fieldVerification?.crewUnitId
                    ? ` (${editingIssue.fieldVerification.crewUnitId})`
                    : ''}
                </span>
                {editingIssue.fieldVerification?.completionPhotoUrl ? (
                  <img
                    src={editingIssue.fieldVerification.completionPhotoUrl}
                    alt="Field crew completed work proof"
                    className="h-44 w-full rounded-lg border-2 border-violet-300 bg-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-3 text-center text-[11px] text-slate-600">
                    Awaiting field crew completion photo
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Field Crew Verification Decision Bar */}
        {editingIssue.fieldVerification && (
          <div className="mt-4 rounded-xl border border-violet-300 bg-violet-50/70 p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-violet-950">
                <ClipboardCheck className="h-4 w-4 text-violet-700" aria-hidden="true" />
                Field Crew Completion Submission
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {editingIssue.fieldVerification.plagiarismStatus && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    {editingIssue.fieldVerification.plagiarismStatus}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    editingIssue.fieldVerification.verificationStatus === 'Approved'
                      ? 'bg-emerald-100 text-emerald-900'
                      : editingIssue.fieldVerification.verificationStatus === 'Rejected'
                      ? 'bg-red-100 text-red-900'
                      : 'bg-violet-700 text-white'
                  }`}
                >
                  {editingIssue.fieldVerification.verificationStatus}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-slate-800">
              <strong>
                {editingIssue.fieldVerification.crewName} (
                {editingIssue.fieldVerification.crewUnitId}):
              </strong>{' '}
              {editingIssue.fieldVerification.completionNotes}
            </p>
            <p suppressHydrationWarning className="mt-0.5 text-[11px] text-slate-500">
              Submitted {formatDateTime(editingIssue.fieldVerification.submittedAt)}
            </p>

            {editingIssue.fieldVerification.verificationStatus === 'Pending Verification' &&
              onVerifyFieldWork && (
                <div className="mt-3 space-y-2.5 border-t border-violet-200 pt-3">
                  {!rejectingMode ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => handleFieldVerificationDecision('approve')}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>Verify Photo &amp; Mark Completed</span>
                      </button>
                      <button
                        type="button"
                        disabled={isVerifying}
                        onClick={() => setRejectingMode(true)}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reject &amp; Request Rework</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-white p-3">
                      <label
                        htmlFor="rework-reason-input"
                        className="block text-xs font-bold text-red-900"
                      >
                        Rework Feedback for Field Crew *
                      </label>
                      <input
                        id="rework-reason-input"
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Debris still blocking drainage grating; please clear and re-photograph."
                        className="focus-ring w-full rounded-lg border border-red-300 px-3 py-1.5 text-xs text-slate-900 focus:border-red-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isVerifying}
                          onClick={() => handleFieldVerificationDecision('reject')}
                          className="focus-ring rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {isVerifying ? 'Sending...' : 'Confirm Reject & Send Back'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingMode(false);
                            setRejectionReason('');
                          }}
                          className="focus-ring rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Administrative Action Form */}
        <form onSubmit={handleSaveTriage} className="mt-4 space-y-4">
          {modalError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-status" className="block text-xs font-semibold text-slate-700">
                Complaint Status
              </label>
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as IssueStatus)}
                className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500"
              >
                {ISSUE_STATUSES.map((s) => {
                  const canResolve =
                    editingIssue.status === 'Resolved' ||
                    editingIssue.fieldVerification?.verificationStatus === 'Approved';
                  return (
                    <option key={s} value={s} disabled={s === 'Resolved' && !canResolve}>
                      {s === 'Resolved' && !canResolve
                        ? 'Resolved (Requires Crew Proof & Approval)'
                        : s}
                    </option>
                  );
                })}
              </select>
              {editingIssue.status !== 'Resolved' &&
                editingIssue.fieldVerification?.verificationStatus !== 'Approved' && (
                  <p className="mt-1 text-[10px] text-amber-800">
                    Tickets can only be marked Resolved after Field Crew posts a completion photo
                    and you approve it above.
                  </p>
                )}
            </div>

            <div>
              <label htmlFor="modal-priority" className="block text-xs font-semibold text-slate-700">
                Priority Tier {modalFocusHint === 'priority' ? '(Override Active)' : ''}
              </label>
              <select
                id="modal-priority"
                autoFocus={modalFocusHint === 'priority'}
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500"
              >
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {priority !== editingIssue.priority && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <label
                htmlFor="modal-override-reason"
                className="block text-xs font-bold text-amber-950"
              >
                Mandatory Priority Override Reason *
              </label>
              <input
                id="modal-override-reason"
                type="text"
                required
                value={priorityOverrideReason}
                onChange={(e) => setPriorityOverrideReason(e.target.value)}
                placeholder="Explain why AI priority is being overridden (recorded in immutable audit log)"
                className="focus-ring mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="modal-department" className="block text-xs font-semibold text-slate-700">
              Assigned Municipal Department
            </label>
            <select
              id="modal-department"
              autoFocus={modalFocusHint === 'department'}
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="modal-notes" className="block text-xs font-semibold text-slate-700">
              Official Dispatch / Resolution Notes
            </label>
            <textarea
              id="modal-notes"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Enter crew ID, dispatch details, or field resolution verification..."
              className="focus-ring mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="modal-evidence-upload"
              className="block text-xs font-semibold text-slate-700"
            >
              Resolution Evidence Photo (Optional · PNG/JPEG/WebP)
            </label>
            <div className="mt-1 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Upload Evidence</span>
                <input
                  id="modal-evidence-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleEvidenceUpload}
                  className="sr-only"
                />
              </label>
              {resolutionEvidenceUrl && (
                <span className="text-xs font-medium text-emerald-700">
                  Evidence image attached ✓
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="focus-ring inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Saving &amp; Recording Audit...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Save Official Update</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
