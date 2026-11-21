'use client';

import React, { useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Search,
  ThumbsUp,
} from 'lucide-react';
import {
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type CivicIssue,
  type DashboardStats,
  type SessionUser,
} from '@/types/civic';
import {
  EngineBadge,
  PriorityBadge,
  ResolutionTimeline,
  StatusBadge,
} from '@/components/CivicBadges';
import { CivicGoogleMap } from '@/components/CivicGoogleMap';

interface TrackingDashboardProps {
  issues: CivicIssue[];
  stats: DashboardStats;
  highlightedId: string | null;
  currentUser?: SessionUser | null;
  onUpvote: (id: string) => Promise<void>;
}

const PIN_BOUNDS = {
  minLat: 10.975,
  maxLat: 11.045,
  minLng: 76.925,
  maxLng: 77.025,
};

function projectCoordinates(lat: number, lng: number): { x: number; y: number } {
  const normX = (lng - PIN_BOUNDS.minLng) / (PIN_BOUNDS.maxLng - PIN_BOUNDS.minLng);
  const normY = 1 - (lat - PIN_BOUNDS.minLat) / (PIN_BOUNDS.maxLat - PIN_BOUNDS.minLat);
  return {
    x: Math.max(8, Math.min(92, normX * 100)),
    y: Math.max(10, Math.min(90, normY * 100)),
  };
}

export function TrackingDashboard({
  issues,
  stats,
  highlightedId,
  currentUser,
  onUpvote,
}: TrackingDashboardProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [onlyMine, setOnlyMine] = useState(false);
  const [mapMode, setMapMode] = useState<'google' | 'grid'>('google');
  const [selectedMapIssueId, setSelectedMapIssueId] = useState<string | null>(highlightedId);
  const [expandedId, setExpandedId] = useState<string | null>(highlightedId);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues
      .filter((issue) => {
        if (onlyMine && currentUser && issue.reporterUserId !== currentUser.id) return false;
        if (statusFilter !== 'All' && issue.status !== statusFilter) return false;
        if (categoryFilter !== 'All' && issue.category !== categoryFilter) return false;
        if (priorityFilter !== 'All' && issue.priority !== priorityFilter) return false;
        if (q) {
          const hay =
            `${issue.id} ${issue.title} ${issue.description} ${issue.location} ${issue.ward} ${issue.department}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aResolved = a.status === 'Resolved' ? 1 : 0;
        const bResolved = b.status === 'Resolved' ? 1 : 0;
        if (aResolved !== bResolved) return aResolved - bResolved;
        return b.urgencyScore - a.urgencyScore;
      });
  }, [issues, search, statusFilter, categoryFilter, priorityFilter, onlyMine, currentUser]);

  const activeMapIssues = useMemo(
    () => filteredIssues.filter((i) => i.status !== 'Resolved'),
    [filteredIssues]
  );

  const activeCriticalCount = useMemo(
    () => issues.filter((i) => i.priority === 'Critical' && i.status !== 'Resolved').length,
    [issues]
  );

  const selectedMapIssue =
    activeMapIssues.find((i) => i.id === selectedMapIssueId) ??
    filteredIssues.find((i) => i.id === selectedMapIssueId) ??
    activeMapIssues[0] ??
    filteredIssues[0] ??
    null;

  const handleUpvote = async (id: string) => {
    setUpvotingId(id);
    try {
      await onUpvote(id);
    } finally {
      setUpvotingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live KPI Strip */}
      <section aria-label="Civic metrics summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Active Open Issues
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {stats.reported + stats.inProgress}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {stats.reported} awaiting dispatch · {stats.total} logged
          </p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            In Progress
          </p>
          <p className="mt-1 text-2xl font-extrabold text-indigo-950">{stats.inProgress}</p>
          <p className="mt-0.5 text-xs text-indigo-800">Active municipal crews</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Resolved
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-950">{stats.resolved}</p>
          <p className="mt-0.5 text-xs text-emerald-800">Verified closed tickets</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Avg AI Urgency
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">
            {stats.averageUrgency}
            <span className="text-sm font-semibold text-amber-800"> / 100</span>
          </p>
          <p className="mt-0.5 text-xs text-amber-900">{activeCriticalCount} Critical active</p>
        </div>
      </section>

      {/* Interactive City Hotspot Map */}
      <section
        aria-label="City civic issue hotspot map"
        className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-12"
      >
        <div className="lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  City Hotspot Map ({activeMapIssues.length} active plotted)
                </h2>
                <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    aria-pressed={mapMode === 'google'}
                    onClick={() => setMapMode('google')}
                    className={`focus-ring rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                      mapMode === 'google'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Google Map
                  </button>
                  <button
                    type="button"
                    aria-pressed={mapMode === 'grid'}
                    onClick={() => setMapMode('grid')}
                    className={`focus-ring rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                      mapMode === 'grid'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Spatial Grid
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Click any pin to inspect issue details and department assignment.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Critical
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> High
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Medium
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Low
              </span>
            </div>
          </div>

          {mapMode === 'google' ? (
            <CivicGoogleMap
              issues={activeMapIssues}
              selectedIssueId={selectedMapIssueId}
              onSelectIssue={(id) => {
                setSelectedMapIssueId(id);
                setExpandedId(id);
              }}
            />
          ) : (
            <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
              {/* Subtle street/ward grid */}
              <svg
                className="absolute inset-0 h-full w-full opacity-25"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern id="civicGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#civicGrid)" />
                <line x1="0" y1="52%" x2="100%" y2="48%" stroke="#38bdf8" strokeWidth="2" />
                <line x1="45%" y1="0" x2="55%" y2="100%" stroke="#38bdf8" strokeWidth="2" />
              </svg>

              <div className="pointer-events-none absolute left-3 top-2.5 rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                Coimbatore Municipal Spatial Grid
              </div>

              {activeMapIssues.map((issue) => {
                const pos = projectCoordinates(issue.coordinates.lat, issue.coordinates.lng);
                const isSelected = selectedMapIssue?.id === issue.id;
                const pinColor =
                  issue.priority === 'Critical'
                    ? 'bg-red-500'
                    : issue.priority === 'High'
                      ? 'bg-amber-400'
                      : issue.priority === 'Medium'
                        ? 'bg-blue-500'
                        : 'bg-slate-400';

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      setSelectedMapIssueId(issue.id);
                      setExpandedId(issue.id);
                    }}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    aria-label={`Select ticket ${issue.id}: ${issue.title}`}
                    className={`focus-ring group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1 transition ${
                      isSelected ? 'z-20 scale-125 ring-4 ring-white' : 'z-10 hover:scale-110'
                    }`}
                  >
                    <span className={`block h-4 w-4 rounded-full border-2 border-white ${pinColor}`} />
                    {issue.priority === 'Critical' && issue.status !== 'Resolved' && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Map Detail Spotlight */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-5">
          {selectedMapIssue ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-blue-700">{selectedMapIssue.id}</span>
                <div className="flex items-center gap-1.5">
                  <PriorityBadge priority={selectedMapIssue.priority} />
                  <StatusBadge status={selectedMapIssue.status} />
                </div>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{selectedMapIssue.title}</h3>
              <p className="text-xs text-slate-600">{selectedMapIssue.description}</p>
              <div className="space-y-1 text-xs text-slate-700">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <span>
                    {selectedMapIssue.location} ({selectedMapIssue.ward})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  <span className="font-semibold text-blue-900">{selectedMapIssue.department}</span>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Suggested Crew Action: </span>
                {selectedMapIssue.aiAnalysis.suggestedAction}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No issues match your current filters.
            </div>
          )}
        </div>
      </section>

      {/* Search & Filters */}
      <section
        aria-label="Filter reported issues"
        className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="track-search" className="sr-only">
            Search issues by ticket ID, title, or location
          </label>
          <input
            id="track-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Ticket ID (CR-2026-...), street, keyword, or department..."
            className="focus-ring w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser && (
            <button
              type="button"
              aria-pressed={onlyMine}
              onClick={() => setOnlyMine((prev) => !prev)}
              className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                onlyMine
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              My Reports
            </button>
          )}
          {(['All', ...ISSUE_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === status
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}

          <label htmlFor="track-category" className="sr-only">
            Filter by category
          </label>
          <select
            id="track-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="All">All Categories</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label htmlFor="track-priority" className="sr-only">
            Filter by priority
          </label>
          <select
            id="track-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
          >
            <option value="All">All Priorities</option>
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Issues List */}
      <section aria-label="Civic issue tickets" className="space-y-4">
        <p aria-live="polite" className="text-xs font-medium text-slate-600">
          Showing {filteredIssues.length} of {issues.length} civic issue
          {issues.length === 1 ? '' : 's'}
          {statusFilter !== 'All' ? ` (${statusFilter})` : ''}
        </p>
        {filteredIssues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
            No civic complaints match your search criteria. Try clearing filters.
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isExpanded = expandedId === issue.id;
            return (
              <article
                key={issue.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                  highlightedId === issue.id
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                        {issue.id}
                      </span>
                      <PriorityBadge priority={issue.priority} />
                      <StatusBadge status={issue.status} />
                      <EngineBadge engine={issue.aiAnalysis.engine} />
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        Urgency {issue.urgencyScore}/100
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{issue.title}</h3>
                    <p className="text-sm text-slate-600">{issue.description}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        {issue.location} • {issue.ward}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-900">
                        <Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        {issue.department}
                      </span>
                      <span>Category: {issue.category}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <button
                      type="button"
                      disabled={upvotingId === issue.id}
                      onClick={() => handleUpvote(issue.id)}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>I&apos;m affected too ({issue.upvotes})</span>
                    </button>

                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                      className="focus-ring inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <span>{isExpanded ? 'Hide Timeline' : 'View Timeline & AI'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-12">
                    <div className="lg:col-span-7">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                        Resolution Progress Timeline
                      </h4>
                      <ResolutionTimeline
                        currentStatus={issue.status}
                        history={issue.statusHistory}
                      />
                    </div>
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs lg:col-span-5">
                      <h4 className="font-bold uppercase tracking-wide text-slate-600">
                        Gemini AI Assessment &amp; SLA
                      </h4>
                      <p className="text-slate-700">
                        <strong>Impact:</strong> {issue.aiAnalysis.impactAssessment}
                      </p>
                      <p className="text-slate-700">
                        <strong>Action Plan:</strong> {issue.aiAnalysis.suggestedAction}
                      </p>
                      <p className="text-slate-700">
                        <strong>Target SLA:</strong> {issue.aiAnalysis.estimatedResolutionSla}
                      </p>
                      {issue.imageUrl && (
                        <img
                          src={issue.imageUrl}
                          alt={`Evidence for ${issue.id}`}
                          className="mt-2 h-28 w-full rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                      {issue.resolutionEvidenceUrl && (
                        <div className="mt-2 space-y-1">
                          <span className="block font-semibold text-emerald-800">
                            Verified Resolution Photo:
                          </span>
                          <img
                            src={issue.resolutionEvidenceUrl}
                            alt={`Resolution proof for ${issue.id}`}
                            className="h-28 w-full rounded-lg border border-emerald-200 object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
