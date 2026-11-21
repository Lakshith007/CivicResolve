'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardEdit,
  Clock,
  FileClock,
  Filter,
  Loader2,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Upload,
  X,
} from 'lucide-react';
import {
  DEPARTMENTS,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type AuditLogEntry,
  type CivicIssue,
  type DashboardStats,
  type Department,
  type IssuePriority,
  type IssueStatus,
} from '@/types/civic';
import { PriorityBadge, StatusBadge } from '@/components/CivicBadges';
import { AdminHotspotMap } from '@/components/AdminHotspotMap';
import { compressImageFile } from '@/lib/imageCompress';

export type AdminSection =
  | 'overview'
  | 'complaints'
  | 'departments'
  | 'geography'
  | 'reports'
  | 'audit';

interface AdminDashboardProps {
  activeSection: AdminSection;
  onNavigateSection: (section: AdminSection) => void;
  issues: CivicIssue[];
  stats: DashboardStats;
  auditLogs?: AuditLogEntry[];
  selectedIssueFromHeader?: CivicIssue | null;
  onClearHeaderSelection?: () => void;
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
}

type QueueFilter = 'active' | 'all' | 'resolved' | IssuePriority;

function formatRelativeAge(isoDate: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(isoDate).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(isoDate));
}

function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(isoDate));
}

function formatDurationHours(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return 'N/A';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
  }
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

function isIssueOverdue(issue: CivicIssue): boolean {
  if (issue.status === 'Resolved') return false;
  const ageHours = (Date.now() - new Date(issue.createdAt).getTime()) / 3_600_000;
  // SLA thresholds: Critical > 6h, High > 24h, Medium/Low > 72h
  if (issue.priority === 'Critical') return ageHours > 6;
  if (issue.priority === 'High') return ageHours > 24;
  return ageHours > 72;
}

function computeAvgResolutionHours(list: CivicIssue[]): number | null {
  const resolved = list.filter((i) => i.status === 'Resolved');
  if (resolved.length === 0) return null;
  const totalHours = resolved.reduce((acc, issue) => {
    const start = new Date(issue.createdAt).getTime();
    const end = new Date(issue.updatedAt).getTime();
    const diffHours = Math.max(0, (end - start) / 3_600_000);
    return acc + diffHours;
  }, 0);
  return totalHours / resolved.length;
}

export function AdminDashboard({
  activeSection,
  onNavigateSection,
  issues,
  stats,
  auditLogs = [],
  selectedIssueFromHeader,
  onClearHeaderSelection,
  onUpdateIssue,
  onVerifyFieldWork,
}: AdminDashboardProps) {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'All' | Department>('All');
  const [inspectedDepartment, setInspectedDepartment] = useState<Department | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

  // Triage modal state
  const [editingIssue, setEditingIssue] = useState<CivicIssue | null>(null);
  const [modalFocusHint, setModalFocusHint] = useState<'general' | 'department' | 'priority'>(
    'general'
  );
  const [status, setStatus] = useState<IssueStatus>('In Progress');
  const [department, setDepartment] = useState<Department>(DEPARTMENTS[0]);
  const [priority, setPriority] = useState<IssuePriority>('High');
  const [priorityOverrideReason, setPriorityOverrideReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolutionEvidenceUrl, setResolutionEvidenceUrl] = useState<string | undefined>(undefined);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectingMode, setRejectingMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef(false);

  const closeTriageModal = () => {
    setEditingIssue(null);
    setModalError(null);
    setRejectingMode(false);
    setRejectionReason('');
  };

  useEffect(() => {
    if (editingIssue) {
      if (!wasModalOpenRef.current) {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }
      wasModalOpenRef.current = true;

      let frame: number | null = null;
      if (modalFocusHint === 'general') {
        frame = requestAnimationFrame(() => {
          modalCloseBtnRef.current?.focus();
        });
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeTriageModal();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        if (frame !== null) cancelAnimationFrame(frame);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    if (wasModalOpenRef.current) {
      wasModalOpenRef.current = false;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [editingIssue, modalFocusHint]);

  const openTriageModal = (
    issue: CivicIssue,
    focus: 'general' | 'department' | 'priority' = 'general'
  ) => {
    setEditingIssue(issue);
    setModalFocusHint(focus);
    setStatus(issue.status);
    setDepartment(issue.department);
    setPriority(issue.priority);
    setPriorityOverrideReason('');
    setAdminNotes(issue.adminNotes ?? '');
    setResolutionEvidenceUrl(issue.resolutionEvidenceUrl);
    setRejectingMode(false);
    setRejectionReason('');
    setModalError(null);
  };

  const pendingVerifications = useMemo(
    () =>
      issues.filter(
        (i) =>
          i.status !== 'Resolved' &&
          i.fieldVerification?.verificationStatus === 'Pending Verification'
      ),
    [issues]
  );

  const handleFieldVerificationDecision = async (
    issue: CivicIssue,
    decision: 'approve' | 'reject'
  ) => {
    if (!onVerifyFieldWork) return;
    setModalError(null);
    if (decision === 'reject' && rejectionReason.trim().length < 5) {
      setModalError('Please enter a clear rework reason (5+ characters) for the field crew.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await onVerifyFieldWork(issue.id, {
        verificationDecision: decision,
        adminNotes: adminNotes.trim() || undefined,
        rejectionReason: decision === 'reject' ? rejectionReason.trim() : undefined,
      });
      if (!res.ok) {
        setModalError(res.error || 'Verification update failed.');
        return;
      }
      setToastMessage(
        decision === 'approve'
          ? `Verified completion photo for ${issue.id} — ticket marked Resolved!`
          : `Sent rework request back to field crew for ${issue.id}.`
      );
      closeTriageModal();
    } finally {
      setIsVerifying(false);
    }
  };

  // Open modal when header notification selects a complaint
  React.useEffect(() => {
    if (selectedIssueFromHeader) {
      openTriageModal(selectedIssueFromHeader, 'general');
      onClearHeaderSelection?.();
    }
  }, [selectedIssueFromHeader, onClearHeaderSelection]);

  // Real calculated KPIs from live issue records
  const kpis = useMemo(() => {
    const total = issues.length;
    const awaitingDispatch = issues.filter((i) => i.status === 'Reported').length;
    const inProgress = issues.filter((i) => i.status === 'In Progress').length;
    const resolved = issues.filter((i) => i.status === 'Resolved').length;
    const activeOpen = awaitingDispatch + inProgress;
    const criticalActive = issues.filter(
      (i) => i.priority === 'Critical' && i.status !== 'Resolved'
    ).length;
    const avgResolutionHours = computeAvgResolutionHours(issues);
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return {
      total,
      activeOpen,
      awaitingDispatch,
      inProgress,
      resolved,
      criticalActive,
      avgResolutionHours,
      resolutionRate,
    };
  }, [issues]);

  // Critical & High priority active alerts sorted by priority & urgency score
  const criticalAlerts = useMemo(() => {
    const weight: Record<IssuePriority, number> = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1,
    };
    return [...issues]
      .filter((i) => i.status !== 'Resolved' && (i.priority === 'Critical' || i.priority === 'High'))
      .sort((a, b) => {
        if (weight[b.priority] !== weight[a.priority]) {
          return weight[b.priority] - weight[a.priority];
        }
        return b.urgencyScore - a.urgencyScore;
      });
  }, [issues]);

  // Department workload metrics derived strictly from actual records
  const departmentMetrics = useMemo(() => {
    const totalActive = issues.filter((i) => i.status !== 'Resolved').length;
    return DEPARTMENTS.map((dept) => {
      const deptIssues = issues.filter((i) => i.department === dept);
      const pending = deptIssues.filter((i) => i.status === 'Reported').length;
      const inProgress = deptIssues.filter((i) => i.status === 'In Progress').length;
      const resolved = deptIssues.filter((i) => i.status === 'Resolved').length;
      const active = pending + inProgress;
      const overdue = deptIssues.filter(isIssueOverdue).length;
      const critical = deptIssues.filter(
        (i) => i.priority === 'Critical' && i.status !== 'Resolved'
      ).length;
      const avgResHours = computeAvgResolutionHours(deptIssues);
      const activeSharePct = totalActive > 0 ? Math.round((active / totalActive) * 100) : 0;

      return {
        department: dept,
        total: deptIssues.length,
        pending,
        inProgress,
        resolved,
        active,
        overdue,
        critical,
        avgResHours,
        activeSharePct,
        issues: deptIssues,
      };
    }).sort((a, b) => b.active - a.active || b.total - a.total);
  }, [issues]);

  // Filtered Priority Triage Queue
  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...issues]
      .filter((issue) => {
        if (queueFilter === 'active' && issue.status === 'Resolved') return false;
        if (queueFilter === 'resolved' && issue.status !== 'Resolved') return false;
        if (
          ISSUE_PRIORITIES.includes(queueFilter as IssuePriority) &&
          issue.priority !== queueFilter
        ) {
          return false;
        }
        if (departmentFilter !== 'All' && issue.department !== departmentFilter) return false;
        if (q) {
          const hay = `${issue.id} ${issue.title} ${issue.description} ${issue.location} ${issue.ward} ${issue.department} ${issue.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }, [issues, queueFilter, departmentFilter, searchQuery]);

  const filteredAuditLogs = useMemo(() => {
    if (auditFilter === 'ALL') return auditLogs;
    return auditLogs.filter((l) => l.action.includes(auditFilter));
  }, [auditLogs, auditFilter]);

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
    if (!editingIssue) return;
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

      setToastMessage(`Updated ${editingIssue.id} → ${status} (${department})`);
      closeTriageModal();
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAdvance = async (issue: CivicIssue, nextStatus: IssueStatus) => {
    const result = await onUpdateIssue(issue.id, {
      status: nextStatus,
      department: issue.department,
      priority: issue.priority,
      adminNotes:
        nextStatus === 'In Progress'
          ? `Field crew dispatched by Municipal Command (${issue.department}).`
          : `Resolution verified and ticket closed by Municipal Supervisor.`,
    });
    if (result.ok) {
      setToastMessage(`${issue.id} updated to ${nextStatus}.`);
    }
  };

  // ---------- REUSABLE SECTIONS ----------

  const renderKpiCards = () => (
    <section aria-label="Municipal performance KPIs" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active Complaints
          </p>
          <Activity className="h-4 w-4 text-blue-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">{kpis.activeOpen}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Total logged: {kpis.total} · Avg Urgency: {stats.averageUrgency}/100
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Awaiting Dispatch
          </p>
          <Clock className="h-4 w-4 text-amber-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-amber-950">{kpis.awaitingDispatch}</p>
        <p className="mt-0.5 text-[11px] text-amber-800">Requires crew assignment</p>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">
            In Progress
          </p>
          <Send className="h-4 w-4 text-blue-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-blue-950">{kpis.inProgress}</p>
        <p className="mt-0.5 text-[11px] text-blue-800">Active field operations</p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Resolved
          </p>
          <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-emerald-950">{kpis.resolved}</p>
        <p className="mt-0.5 text-[11px] text-emerald-800">{kpis.resolutionRate}% closure rate</p>
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-800">
            Critical Active
          </p>
          <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-red-900">{kpis.criticalActive}</p>
        <p className="mt-0.5 text-[11px] text-red-800">Immediate SLA escalation</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avg Resolution
          </p>
          <Timer className="h-4 w-4 text-slate-700" aria-hidden="true" />
        </div>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">
          {formatDurationHours(kpis.avgResolutionHours)}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Based on {kpis.resolved} resolved ticket{kpis.resolved === 1 ? '' : 's'}
        </p>
      </div>
    </section>
  );

  const renderCriticalAlerts = () => (
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
            High-impact public safety &amp; infrastructure complaints sorted by Gemini AI urgency score
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setQueueFilter('Critical');
            onNavigateSection('complaints');
          }}
          className="text-xs font-semibold text-blue-700 hover:underline"
        >
          View full triage queue →
        </button>
      </div>

      {criticalAlerts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center text-xs font-medium text-emerald-900">
          All Critical and High priority civic alerts have been resolved.
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
                      <span className="font-mono text-xs font-bold text-blue-700">{alert.id}</span>
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
                    onClick={() => openTriageModal(alert, 'general')}
                    className="focus-ring rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                  >
                    Review Complaint
                  </button>
                  <button
                    type="button"
                    onClick={() => openTriageModal(alert, 'department')}
                    className="focus-ring rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Assign Department
                  </button>
                  {alert.status === 'Reported' && (
                    <button
                      type="button"
                      onClick={() => handleQuickAdvance(alert, 'In Progress')}
                      className="focus-ring rounded-lg bg-blue-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-800"
                    >
                      Dispatch Crew
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openTriageModal(alert, 'priority')}
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
  );

  const renderDepartmentWorkload = (expanded = false) => (
    <section
      aria-labelledby="department-workload-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="department-workload-heading"
            className="flex items-center gap-2 text-base font-bold text-slate-900"
          >
            <Building2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>Department Workload &amp; Performance</span>
          </h2>
          <p className="text-xs text-slate-500">
            Live division assignments calculated from database records (workload bar = share of active citywide queue)
          </p>
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={() => onNavigateSection('departments')}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Inspect divisions →
          </button>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${expanded ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {departmentMetrics.map((m) => {
          const isInspected = inspectedDepartment === m.department;
          return (
            <div
              key={m.department}
              className={`rounded-xl border p-3.5 transition ${
                isInspected
                  ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{m.department}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Total Assigned: <strong className="text-slate-800">{m.total}</strong> · Avg
                    Resolution:{' '}
                    <strong className="text-slate-800">{formatDurationHours(m.avgResHours)}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {m.overdue > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                      {m.overdue} overdue
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (expanded) {
                        setInspectedDepartment(isInspected ? null : m.department);
                      } else {
                        setDepartmentFilter(m.department);
                        onNavigateSection('complaints');
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {expanded ? (isInspected ? 'Hide Tickets' : 'Inspect') : 'Filter Queue'}
                  </button>
                </div>
              </div>

              {/* Counts row */}
              <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                <div className="rounded-lg bg-white px-2 py-1 border border-slate-200/80">
                  <span className="block font-bold text-amber-800">{m.pending}</span>
                  <span className="text-[10px] text-slate-500">Pending</span>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 border border-slate-200/80">
                  <span className="block font-bold text-blue-800">{m.inProgress}</span>
                  <span className="text-[10px] text-slate-500">In Progress</span>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 border border-slate-200/80">
                  <span className="block font-bold text-emerald-800">{m.resolved}</span>
                  <span className="text-[10px] text-slate-500">Resolved</span>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 border border-slate-200/80">
                  <span className="block font-bold text-slate-900">{m.activeSharePct}%</span>
                  <span className="text-[10px] text-slate-500">Active Share</span>
                </div>
              </div>

              {/* Visual workload bar */}
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    m.critical > 0
                      ? 'bg-red-600'
                      : m.activeSharePct >= 30
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, m.activeSharePct)}%` }}
                />
              </div>

              {/* Inline expanded ticket inspection */}
              {expanded && isInspected && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  {m.issues.length === 0 ? (
                    <p className="text-xs text-slate-500">No complaints currently assigned.</p>
                  ) : (
                    m.issues.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-700">{item.id}</span>
                            <PriorityBadge priority={item.priority} />
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="mt-0.5 truncate font-semibold text-slate-900">
                            {item.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTriageModal(item, 'general')}
                          className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                        >
                          Manage
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Note: Individual division crew headcount/capacity ceilings are not stored in the current
        database; workload utilization reflects each division&apos;s live share of active municipal
        complaints.
      </p>
    </section>
  );

  const renderTriageQueue = (maxRows?: number) => {
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
              Ranked by Gemini AI urgency score · Protected mutations persist to database &amp; audit trail
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, location, keyword, dept..."
                aria-label="Search complaints"
                className="focus-ring w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:bg-white"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value as 'All' | Department)}
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
          {(
            [
              { key: 'active', label: 'Active Queue' },
              { key: 'all', label: 'All Tickets' },
              { key: 'resolved', label: 'Resolved' },
              { key: 'Critical', label: 'Critical' },
              { key: 'High', label: 'High' },
              { key: 'Medium', label: 'Medium' },
              { key: 'Low', label: 'Low' },
            ] as Array<{ key: QueueFilter; label: string }>
          ).map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setQueueFilter(pill.key)}
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
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Complaint</th>
                <th className="px-3 py-2.5">AI Score &amp; Priority</th>
                <th className="px-3 py-2.5">Assigned Department</th>
                <th className="px-3 py-2.5">Reported</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Dispatch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No complaints match the current filter criteria.
                  </td>
                </tr>
              ) : (
                visibleRows.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/70">
                    <td className="max-w-xs px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">{issue.id}</span>
                        {isIssueOverdue(issue) && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-semibold text-slate-900">{issue.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                        {issue.description}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {issue.location} · {issue.ward.split('—')[0].trim()}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <PriorityBadge priority={issue.priority} />
                        <span className="font-semibold text-slate-700">
                          Urgency: {issue.urgencyScore}/100
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <span className="font-medium">{issue.department}</span>
                      <span className="block text-[11px] text-slate-500">{issue.category}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      <span suppressHydrationWarning className="block font-medium">
                        {formatRelativeAge(issue.createdAt)}
                      </span>
                      <span suppressHydrationWarning className="text-[10px] text-slate-600">
                        {formatShortDate(issue.createdAt)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {issue.status === 'Reported' && (
                          <button
                            type="button"
                            onClick={() => handleQuickAdvance(issue, 'In Progress')}
                            className="focus-ring rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                          >
                            Dispatch
                          </button>
                        )}
                        {issue.status === 'In Progress' &&
                          issue.fieldVerification?.verificationStatus === 'Pending Verification' && (
                            <button
                              type="button"
                              onClick={() => openTriageModal(issue, 'general')}
                              className="focus-ring rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-900 hover:bg-violet-100"
                            >
                              Verify Proof &amp; Resolve
                            </button>
                          )}
                        {issue.status === 'In Progress' &&
                          issue.fieldVerification?.verificationStatus !== 'Pending Verification' && (
                            <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                              Awaiting Crew Photo
                            </span>
                          )}
                        <button
                          type="button"
                          onClick={() => openTriageModal(issue, 'general')}
                          className="focus-ring inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
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

        {maxRows && filteredQueue.length > maxRows && (
          <div className="mt-3 text-right">
            <button
              type="button"
              onClick={() => onNavigateSection('complaints')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Show all {filteredQueue.length} complaints in Complaint Management →
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderAuditLogs = (maxRows?: number) => {
    const visible = maxRows ? filteredAuditLogs.slice(0, maxRows) : filteredAuditLogs;
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
              Append-only municipal log of assignments, priority overrides, status transitions &amp; admin auth events
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!maxRows && (
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
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
            {maxRows && (
              <button
                type="button"
                onClick={() => onNavigateSection('audit')}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Full audit history →
              </button>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500">
            No administrative actions recorded yet in this session. Sign-ins, dispatches, and
            priority overrides will appear here automatically.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Administrator</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Changes &amp; Override Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td suppressHydrationWarning className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-900">{log.actorEmail}</span>
                      <span className="block font-mono text-[10px] text-slate-500">
                        ID: {log.actorId}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
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
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-bold text-blue-700">
                      {log.targetTicketId}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
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
  };

  const renderResolutionReports = () => {
    const resolvedIssues = issues.filter((i) => i.status === 'Resolved');
    const priorityCounts = ISSUE_PRIORITIES.map((p) => ({
      priority: p,
      total: issues.filter((i) => i.priority === p).length,
      resolved: issues.filter((i) => i.priority === p && i.status === 'Resolved').length,
    }));

    return (
      <div className="space-y-6">
        {renderKpiCards()}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Priority Closure Breakdown */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <BarChart3 className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Resolution Rate by Priority Tier</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Calculated directly from live database ticket statuses
            </p>
            <div className="mt-4 space-y-3">
              {priorityCounts.map((row) => {
                const pct = row.total > 0 ? Math.round((row.resolved / row.total) * 100) : 0;
                return (
                  <div key={row.priority} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <PriorityBadge priority={row.priority} />
                      <span className="font-semibold text-slate-700">
                        {row.resolved} / {row.total} resolved ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Department Resolution Summary */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ClipboardCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Department Turnaround Summary</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Resolved volume &amp; average closure time per municipal division
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2">Division</th>
                    <th className="px-2.5 py-2 text-center">Resolved</th>
                    <th className="px-2.5 py-2 text-center">Overdue</th>
                    <th className="px-2.5 py-2 text-right">Avg Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentMetrics.map((m) => (
                    <tr key={m.department}>
                      <td className="px-2.5 py-2 font-medium text-slate-800">{m.department}</td>
                      <td className="px-2.5 py-2 text-center font-bold text-emerald-700">
                        {m.resolved}/{m.total}
                      </td>
                      <td className="px-2.5 py-2 text-center font-bold text-red-700">
                        {m.overdue}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-slate-700">
                        {formatDurationHours(m.avgResHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Resolved Archive */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">
            Resolved Complaints Archive ({resolvedIssues.length})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Completed municipal work orders with official closure notes and uploaded evidence
          </p>
          {resolvedIssues.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">No resolved complaints recorded yet.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {resolvedIssues.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-blue-700">{item.id}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-0.5 text-slate-600">
                    {item.department} · {item.location}
                  </p>
                  {item.adminNotes && (
                    <p className="mt-2 rounded-lg bg-white p-2 text-slate-700 border border-slate-200">
                      <strong>Resolution Note:</strong> {item.adminNotes}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span suppressHydrationWarning>Closed {formatDateTime(item.updatedAt)}</span>
                    <button
                      type="button"
                      onClick={() => openTriageModal(item, 'general')}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Inspect Record
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="focus-ring rounded p-1 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* VIEW ROUTING */}
      {activeSection === 'overview' && (
        <>
          {renderKpiCards()}
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
                    Dispatched teams have uploaded completed work photos — inspect and approve to
                    mark Resolved
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
                        onClick={() => openTriageModal(item, 'general')}
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
          {renderCriticalAlerts()}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <AdminHotspotMap
                issues={issues}
                onInspectComplaint={(issue) => openTriageModal(issue, 'general')}
              />
            </div>
            <div className="xl:col-span-5">{renderDepartmentWorkload(false)}</div>
          </div>
          {renderAuditLogs(6)}
          {renderTriageQueue(8)}
        </>
      )}

      {activeSection === 'complaints' && (
        <>
          {renderKpiCards()}
          {renderTriageQueue()}
        </>
      )}

      {activeSection === 'departments' && (
        <>
          {renderKpiCards()}
          {renderDepartmentWorkload(true)}
        </>
      )}

      {activeSection === 'geography' && (
        <>
          {renderKpiCards()}
          <AdminHotspotMap
            issues={issues}
            onInspectComplaint={(issue) => openTriageModal(issue, 'general')}
          />
        </>
      )}

      {activeSection === 'reports' && renderResolutionReports()}

      {activeSection === 'audit' && renderAuditLogs()}

      {/* FULL COMPLAINT DETAILS & TRIAGE MODAL */}
      {editingIssue && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="triage-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700">
                    {editingIssue.id}
                  </span>
                  <PriorityBadge priority={editingIssue.priority} />
                  <StatusBadge status={editingIssue.status} />
                </div>
                <h3 id="triage-modal-title" className="mt-1 text-base font-bold text-slate-900">
                  {editingIssue.title}
                </h3>
                <p suppressHydrationWarning className="mt-0.5 text-xs text-slate-500">
                  {editingIssue.location} · {editingIssue.ward} · Reported{' '}
                  {formatDateTime(editingIssue.createdAt)}
                </p>
              </div>
              <button
                ref={modalCloseBtnRef}
                type="button"
                onClick={closeTriageModal}
                aria-label="Close complaint triage dialog"
                className="focus-ring rounded-lg p-1 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Complaint Context & Gemini AI Summary */}
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <p className="text-slate-800 leading-relaxed">{editingIssue.description}</p>
              <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 text-violet-950">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-bold text-violet-900">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Gemini AI Triage ({editingIssue.urgencyScore}/100)
                  </span>
                  <span className="text-[11px] font-semibold">
                    SLA: {editingIssue.aiAnalysis.estimatedResolutionSla}
                  </span>
                </div>
                <p className="mt-1">{editingIssue.aiAnalysis.aiSummary}</p>
                <p className="mt-1 text-[11px] text-violet-900/90">
                  <strong>Recommended Action:</strong> {editingIssue.aiAnalysis.suggestedAction}
                </p>
              </div>
              {(editingIssue.imageUrl || editingIssue.fieldVerification) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {editingIssue.imageUrl && (
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Before · Citizen Reported Photo
                      </span>
                      <img
                        src={editingIssue.imageUrl}
                        alt="Citizen submitted evidence"
                        className="h-40 w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </div>
                  )}
                  {editingIssue.fieldVerification?.completionPhotoUrl && (
                    <div>
                      <span className="mb-1 block text-[11px] font-semibold text-violet-800">
                        After · Field Crew Proof ({editingIssue.fieldVerification.crewUnitId})
                      </span>
                      <img
                        src={editingIssue.fieldVerification.completionPhotoUrl}
                        alt="Field crew completed work proof"
                        className="h-40 w-full rounded-lg border-2 border-violet-300 object-cover"
                      />
                    </div>
                  )}
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
                            onClick={() =>
                              handleFieldVerificationDecision(editingIssue, 'approve')
                            }
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
                              onClick={() =>
                                handleFieldVerificationDecision(editingIssue, 'reject')
                              }
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
                  <label
                    htmlFor="modal-status"
                    className="block text-xs font-semibold text-slate-700"
                  >
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
                  <label
                    htmlFor="modal-priority"
                    className="block text-xs font-semibold text-slate-700"
                  >
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
                <label
                  htmlFor="modal-department"
                  className="block text-xs font-semibold text-slate-700"
                >
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
                <label
                  htmlFor="modal-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
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

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeTriageModal}
                  className="focus-ring rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
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
      )}
    </div>
  );
}
