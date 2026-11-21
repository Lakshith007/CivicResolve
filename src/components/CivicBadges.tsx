'use client';

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { IssuePriority, IssueStatus, StatusHistoryEntry } from '@/types/civic';

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const styles: Record<IssuePriority, { bg: string; icon: React.ReactNode }> = {
    Critical: {
      bg: 'bg-red-100 text-red-900 border-red-300',
      icon: <AlertOctagon className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />,
    },
    High: {
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />,
    },
    Medium: {
      bg: 'bg-blue-100 text-blue-900 border-blue-300',
      icon: <Info className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />,
    },
    Low: {
      bg: 'bg-slate-100 text-slate-800 border-slate-300',
      icon: <Info className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />,
    },
  };

  const current = styles[priority];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${current.bg}`}
    >
      {current.icon}
      <span>{priority}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const styles: Record<IssueStatus, { bg: string; icon: React.ReactNode }> = {
    Reported: {
      bg: 'bg-rose-50 text-rose-800 border-rose-200',
      icon: <Clock className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />,
    },
    'In Progress': {
      bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      icon: <Wrench className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />,
    },
    Resolved: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />,
    },
  };

  const current = styles[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${current.bg}`}
    >
      {current.icon}
      <span>{status}</span>
    </span>
  );
}

export function EngineBadge({ engine }: { engine: 'gemini-ai' | 'smart-civic-fallback' }) {
  const isGemini = engine === 'gemini-ai';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        isGemini
          ? 'border-violet-200 bg-violet-50 text-violet-800'
          : 'border-cyan-200 bg-cyan-50 text-cyan-800'
      }`}
    >
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      <span>{isGemini ? 'Gemini AI Analyzed' : 'Smart Civic Triage'}</span>
    </span>
  );
}

export function ResolutionTimeline({
  currentStatus,
  history,
}: {
  currentStatus: IssueStatus;
  history: StatusHistoryEntry[];
}) {
  const steps: IssueStatus[] = ['Reported', 'In Progress', 'Resolved'];
  const activeIdx = steps.indexOf(currentStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2" aria-label="Resolution stages">
        {steps.map((step, index) => {
          const completed = index <= activeIdx;
          return (
            <div key={step} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  completed
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-600'
                }`}
              >
                {index < activeIdx || currentStatus === 'Resolved' ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`text-xs font-semibold ${
                  completed ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded ${
                    index < activeIdx ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
        {history.map((entry, i) => (
          <li key={`${entry.timestamp}-${i}`} className="relative text-xs">
            <span
              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600"
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-slate-800">{entry.status}</span>
              <span className="text-slate-600">• {entry.updatedBy}</span>
              <time suppressHydrationWarning className="text-slate-600" dateTime={entry.timestamp}>
                {new Intl.DateTimeFormat('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(entry.timestamp))}
              </time>
            </div>
            <p className="mt-0.5 text-slate-600">{entry.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
