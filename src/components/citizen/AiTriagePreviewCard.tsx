'use client';

import React from 'react';
import { ShieldAlert, Sparkles, ThumbsUp } from 'lucide-react';
import type { AIAnalysisResult, IssuePriority, IssueStatus } from '@/types/civic';
import { EngineBadge, PriorityBadge } from '@/components/CivicBadges';

export interface DuplicateMatch {
  id: string;
  title: string;
  location: string;
  status: IssueStatus;
  priority: IssuePriority;
  upvotes: number;
}

interface AiTriagePreviewCardProps {
  analysis: AIAnalysisResult | null;
  duplicates: DuplicateMatch[];
  isAnalyzing: boolean;
  upvotedDupId: string | null;
  onUpvoteDuplicate: (id: string) => Promise<void>;
}

/** Sticky Gemini AI Triage Preview and nearby duplicate complaint guard. */
export function AiTriagePreviewCard({
  analysis,
  duplicates,
  isAnalyzing,
  upvotedDupId,
  onUpvoteDuplicate,
}: AiTriagePreviewCardProps) {
  return (
    <aside
      className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:col-span-5 lg:self-start"
      aria-label="AI Classification Preview"
    >
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Triage Preview</h2>
              <p className="text-xs text-slate-600">Powered by Google Gemini</p>
            </div>
          </div>
          {analysis && <EngineBadge engine={analysis.engine} />}
        </div>

        <div aria-live="polite">
          {isAnalyzing && (
            <p className="sr-only">Analyzing civic issue details with Gemini AI...</p>
          )}
          {!analysis ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-9 text-center">
              <Sparkles className="mx-auto h-9 w-9 text-violet-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No AI preview generated yet
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Select a 1-click preset or fill out the complaint, then click{' '}
                <strong>Analyze with Gemini AI</strong> to inspect category, priority, urgency
                score, and department routing before submitting.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PriorityBadge priority={analysis.priority} />
                <span className="text-xs font-semibold tabular-nums text-slate-600">
                  AI Confidence: {Math.round(analysis.confidence * 100)}%
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">Public Urgency Score</span>
                  <span className="tabular-nums text-slate-900">{analysis.urgencyScore} / 100</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      analysis.urgencyScore >= 80
                        ? 'bg-red-600'
                        : analysis.urgencyScore >= 60
                          ? 'bg-amber-500'
                          : analysis.urgencyScore >= 35
                            ? 'bg-blue-600'
                            : 'bg-slate-500'
                    }`}
                    style={{ width: `${analysis.urgencyScore}%` }}
                  />
                </div>
              </div>

              <dl className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-600">
                    Detected Category
                  </dt>
                  <dd className="mt-0.5 text-sm font-bold text-slate-900">{analysis.category}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-600">
                    Recommended Department
                  </dt>
                  <dd className="mt-0.5 text-sm font-bold text-blue-900">{analysis.department}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-slate-600">
                    Target Resolution SLA
                  </dt>
                  <dd className="mt-0.5 font-medium text-slate-800">
                    {analysis.estimatedResolutionSla}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2.5 text-xs text-slate-700">
                <div>
                  <span className="font-semibold text-slate-900">AI Summary: </span>
                  {analysis.aiSummary}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Impact Assessment: </span>
                  {analysis.impactAssessment}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Suggested Crew Action: </span>
                  {analysis.suggestedAction}
                </div>
              </div>

              {analysis.detectedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {analysis.detectedKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {duplicates.length > 0 && (
        <div
          role="region"
          aria-label="Potential duplicate complaints"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                Similar Active Issue Nearby ({duplicates.length})
              </h3>
              <p className="mt-0.5 text-xs text-amber-900">
                Upvote an existing ticket to boost dispatch urgency instead of creating a duplicate.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {duplicates.map((dup) => (
              <div
                key={dup.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span>{dup.id}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                      {dup.status}
                    </span>
                  </div>
                  <p className="truncate text-xs font-medium text-slate-700">{dup.title}</p>
                  <p className="truncate text-[11px] text-slate-600">{dup.location}</p>
                </div>
                <button
                  type="button"
                  disabled={upvotedDupId === dup.id}
                  onClick={() => void onUpvoteDuplicate(dup.id)}
                  className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-200 disabled:opacity-60"
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{upvotedDupId === dup.id ? 'Boosted' : '+1 Boost'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
