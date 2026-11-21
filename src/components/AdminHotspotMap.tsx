'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardEdit,
  Clock,
  Filter,
  Globe,
  Layers,
  MapPin,
  Repeat,
  Sparkles,
} from 'lucide-react';
import {
  DEPARTMENTS,
  ISSUE_PRIORITIES,
  type CivicIssue,
  type Department,
  type IssuePriority,
} from '@/types/civic';
import { CivicGoogleMap } from '@/components/CivicGoogleMap';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { formatDateTime } from '@/lib/dateFormat';
import { computeSpatialBounds, haversineKm, projectToSpatialGrid } from '@/lib/geoUtils';

interface AdminHotspotMapProps {
  issues: CivicIssue[];
  onInspectComplaint: (issue: CivicIssue) => void;
  compact?: boolean;
}

type TimeRange = 'all' | '24h' | '7d' | '30d';

export function AdminHotspotMap({
  issues,
  onInspectComplaint,
  compact = false,
}: AdminHotspotMapProps) {
  const [departmentFilter, setDepartmentFilter] = useState<'All' | Department>('All');
  const [wardFilter, setWardFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | IssuePriority>('All');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [mapMode, setMapMode] = useState<'google' | 'spatial'>('google');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availableWards = useMemo(() => {
    const set = new Set<string>();
    issues
      .filter((i) => (showResolved ? true : i.status !== 'Resolved'))
      .forEach((i) => {
        if (i.ward) set.add(i.ward);
      });
    return Array.from(set).sort();
  }, [issues, showResolved]);

  const filteredIssues = useMemo(() => {
    const now = Date.now();
    const cutoffMs =
      timeRange === '24h'
        ? 24 * 60 * 60 * 1000
        : timeRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
        ? 30 * 24 * 60 * 60 * 1000
        : null;

    return issues.filter((issue) => {
      if (!showResolved && issue.status === 'Resolved') return false;
      if (departmentFilter !== 'All' && issue.department !== departmentFilter) return false;
      if (wardFilter !== 'All' && issue.ward !== wardFilter) return false;
      if (priorityFilter !== 'All' && issue.priority !== priorityFilter) return false;
      if (cutoffMs !== null) {
        const ageMs = now - new Date(issue.createdAt).getTime();
        if (ageMs > cutoffMs) return false;
      }
      return true;
    });
  }, [issues, showResolved, departmentFilter, wardFilter, priorityFilter, timeRange]);

  const geolocatedIssues = useMemo(
    () =>
      filteredIssues.filter(
        (i) =>
          i.coordinates &&
          typeof i.coordinates.lat === 'number' &&
          typeof i.coordinates.lng === 'number'
      ),
    [filteredIssues]
  );

  // Cluster nearby complaints (within 1.5km) and repeated ward+category issues
  const hotspotClusters = useMemo(() => {
    const visited = new Set<string>();
    const proximityClusters: Array<{
      id: string;
      label: string;
      count: number;
      criticalCount: number;
      issues: CivicIssue[];
    }> = [];

    for (let i = 0; i < geolocatedIssues.length; i++) {
      const seed = geolocatedIssues[i];
      if (visited.has(seed.id) || !seed.coordinates) continue;
      const group = [seed];
      visited.add(seed.id);

      for (let j = i + 1; j < geolocatedIssues.length; j++) {
        const candidate = geolocatedIssues[j];
        if (visited.has(candidate.id) || !candidate.coordinates) continue;
        if (haversineKm(seed.coordinates, candidate.coordinates) <= 1.5) {
          group.push(candidate);
          visited.add(candidate.id);
        }
      }

      if (group.length >= 2) {
        proximityClusters.push({
          id: `cluster-${seed.id}`,
          label: `${seed.ward.split('—')[0].trim()} · Nearby Cluster`,
          count: group.length,
          criticalCount: group.filter((g) => g.priority === 'Critical').length,
          issues: group,
        });
      }
    }

    // Repeated category within the same ward
    const wardCatMap = new Map<string, CivicIssue[]>();
    filteredIssues.forEach((issue) => {
      const key = `${issue.ward}||${issue.category}`;
      const list = wardCatMap.get(key) || [];
      list.push(issue);
      wardCatMap.set(key, list);
    });

    const repeatedIssues = Array.from(wardCatMap.entries())
      .filter(([, list]) => list.length >= 2)
      .map(([key, list]) => {
        const [ward, category] = key.split('||');
        return {
          id: `repeat-${key}`,
          ward: ward.split('—')[0].trim(),
          category,
          count: list.length,
          issues: list,
        };
      });

    return { proximityClusters, repeatedIssues };
  }, [filteredIssues, geolocatedIssues]);

  const selectedIssue = useMemo(() => {
    if (selectedId) {
      const found = filteredIssues.find((i) => i.id === selectedId);
      if (found) return found;
    }
    return filteredIssues[0] ?? null;
  }, [filteredIssues, selectedId]);

  // Compute real spatial bounds for fallback coordinate plot (never fake coordinates)
  const spatialBounds = useMemo(
    () =>
      computeSpatialBounds(
        geolocatedIssues
          .map((i) => i.coordinates)
          .filter((coords): coords is { lat: number; lng: number } => Boolean(coords))
      ),
    [geolocatedIssues]
  );

  return (
    <section
      aria-labelledby="hotspot-map-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="hotspot-map-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <MapPin className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Citywide Hotspot Map</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {geolocatedIssues.length} geolocated / {filteredIssues.length} filtered
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Real complaint coordinates, severity markers, nearby clustering &amp; repeated-issue detection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
            />
            <span>Show Resolved</span>
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMapMode('google')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                mapMode === 'google'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Google Map</span>
            </button>
            <button
              type="button"
              onClick={() => setMapMode('spatial')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                mapMode === 'spatial'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Coordinate Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <label htmlFor="map-dept-filter" className="sr-only">
            Filter by Department
          </label>
          <select
            id="map-dept-filter"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value as 'All' | Department)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
          >
            <option value="All">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="map-ward-filter" className="sr-only">
            Filter by Ward
          </label>
          <select
            id="map-ward-filter"
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
          >
            <option value="All">All Municipal Wards</option>
            {availableWards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="map-priority-filter" className="sr-only">
            Filter by Priority
          </label>
          <select
            id="map-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'All' | IssuePriority)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
          >
            <option value="All">All Priorities</option>
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="map-time-filter" className="sr-only">
            Filter by Timeframe
          </label>
          <select
            id="map-time-filter"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Clusters & Repeated Issues Strip */}
      {(hotspotClusters.proximityClusters.length > 0 ||
        hotspotClusters.repeatedIssues.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
          <span className="inline-flex items-center gap-1 font-bold text-amber-900">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Detected Clusters:
          </span>
          {hotspotClusters.proximityClusters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.issues[0].id)}
              className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
            >
              {c.label} ({c.count} reports
              {c.criticalCount > 0 ? ` · ${c.criticalCount} Critical` : ''})
            </button>
          ))}
          {hotspotClusters.repeatedIssues.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.issues[0].id)}
              className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 hover:bg-red-100"
            >
              Repeated: {r.category} in {r.ward} ({r.count}x)
            </button>
          ))}
        </div>
      )}

      {/* Map + Selected Marker Inspector */}
      <div className={`mt-4 grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        <div className={compact ? '' : 'lg:col-span-2'}>
          {mapMode === 'google' ? (
            <CivicGoogleMap
              issues={filteredIssues}
              selectedIssueId={selectedId}
              onSelectIssue={(id) => setSelectedId(id)}
              includeResolved={showResolved}
            />
          ) : (
            <div className="relative h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 p-4">
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />
              {geolocatedIssues.length === 0 || !spatialBounds ? (
                <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-xs text-slate-300">
                  <Filter className="mb-2 h-5 w-5 text-slate-400" aria-hidden="true" />
                  No geolocated complaints match the current filter criteria.
                </div>
              ) : (
                geolocatedIssues.map((issue) => {
                  if (!issue.coordinates) return null;
                  const { x: xPct, y: yPct } = projectToSpatialGrid(
                    issue.coordinates.lat,
                    issue.coordinates.lng,
                    spatialBounds,
                    { x: 10, y: 12 }
                  );
                  const isSelected = selectedIssue?.id === issue.id;
                  const dotColor =
                    issue.priority === 'Critical'
                      ? 'bg-red-500 ring-red-300/60'
                      : issue.priority === 'High'
                      ? 'bg-amber-400 ring-amber-200/60'
                      : issue.priority === 'Medium'
                      ? 'bg-blue-500 ring-blue-300/60'
                      : 'bg-slate-400 ring-slate-300/60';

                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => setSelectedId(issue.id)}
                      style={{ left: `${xPct}%`, top: `${yPct}%` }}
                      title={`${issue.id}: ${issue.title} (${issue.priority})`}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform ${dotColor} ${
                        isSelected
                          ? 'z-20 h-5 w-5 scale-125 ring-4'
                          : 'z-10 h-3.5 w-3.5 ring-2 hover:scale-125'
                      }`}
                    >
                      <span className="sr-only">
                        {issue.id} {issue.title}
                      </span>
                    </button>
                  );
                })
              )}
              <div className="absolute bottom-2.5 left-3 z-10 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-medium text-slate-300">
                Plotted from verified GPS coordinates ({geolocatedIssues.length} pins)
              </div>
            </div>
          )}
        </div>

        {/* Selected Complaint Inspector */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {selectedIssue ? (
            <>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700">
                    {selectedIssue.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge priority={selectedIssue.priority} />
                    <StatusBadge status={selectedIssue.status} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedIssue.title}</h3>
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span>
                      {selectedIssue.location} · {selectedIssue.ward}
                    </span>
                  </p>
                  {selectedIssue.coordinates && (
                    <p className="mt-0.5 pl-5 font-mono text-[10px] text-slate-500">
                      GPS: {selectedIssue.coordinates.lat.toFixed(5)},{' '}
                      {selectedIssue.coordinates.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    <span className="font-semibold">{selectedIssue.department}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                    <span>
                      AI Urgency: <strong>{selectedIssue.urgencyScore}/100</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span suppressHydrationWarning>
                      Reported {formatDateTime(selectedIssue.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 text-xs text-violet-950">
                  <div className="flex items-center gap-1 font-semibold text-violet-900">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Suggested Administrative Action</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90">
                    {selectedIssue.aiAnalysis.suggestedAction}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onInspectComplaint(selectedIssue)}
                className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                <ClipboardEdit className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Open Complete Complaint &amp; Triage</span>
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center py-8 text-center text-xs text-slate-500">
              Select a marker on the map to inspect complaint details and recommended actions.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
