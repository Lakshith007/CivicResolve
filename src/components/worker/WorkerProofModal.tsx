'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Send, Sparkles, Upload, X } from 'lucide-react';
import type { CivicIssue } from '@/types/civic';
import { compressImageFile } from '@/lib/imageCompress';

function generateSampleProofPng(ticketId: string, crewUnitId: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 380;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, 640, 380);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 380);

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

interface WorkerProofModalProps {
  issue: CivicIssue | null;
  crewName: string;
  crewUnitId: string;
  onClose: () => void;
  onSubmitted: (updatedIssue: CivicIssue) => void;
}

/** Field Crew completion photo upload dialog with Escape close, focus restoration & compression. */
export function WorkerProofModal({
  issue,
  crewName,
  crewUnitId,
  onClose,
  onSubmitted,
}: WorkerProofModalProps) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionPhotoUrl, setCompletionPhotoUrl] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const proofCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (issue) {
      if (!wasOpenRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }
      wasOpenRef.current = true;
      setCompletionNotes('');
      setCompletionPhotoUrl('');
      setModalError(null);
      setIsSubmitting(false);

      const frame = requestAnimationFrame(() => {
        proofCloseBtnRef.current?.focus();
      });
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseRef.current();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [issue]);

  if (!issue) return null;

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
          ticketId: issue.id,
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
      onSubmitted(data.issue);
    } catch {
      setModalError('Network error while uploading completion proof.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-proof-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <span className="font-mono text-xs font-bold text-blue-700">{issue.id}</span>
            <h2
              id="worker-proof-modal-title"
              className="mt-0.5 text-base font-bold text-slate-900"
            >
              Post Completed Work Proof
            </h2>
            <p className="text-xs text-slate-600">{issue.title}</p>
          </div>
          <button
            ref={proofCloseBtnRef}
            type="button"
            onClick={onClose}
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
                  const png = generateSampleProofPng(issue.id, crewUnitId || 'CREW-01');
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
              onClick={onClose}
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
  );
}
