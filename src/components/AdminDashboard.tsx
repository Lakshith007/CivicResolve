'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import {
  ISSUE_PRIORITIES,
  type AuditLogEntry,
  type CivicIssue,
  type DashboardStats,
  type Department,
  type IssuePriority,
  type IssueStatus,
} from '@/types/civic';
import { AdminHotspotMap } from '@/components/AdminHotspotMap';
import { AdminKpiGrid, computeAdminKpis } from '@/components/admin/AdminKpiGrid';
import { AdminOverviewPanels } from '@/components/admin/AdminOverviewPanels';
import { AdminTriageQueue, type QueueFilter } from '@/components/admin/AdminTriageQueue';
import {
  AdminDepartmentPanel,
  computeDepartmentMetrics,
  isIssueOverdue,
} from '@/components/admin/AdminDepartmentPanel';
import { AdminResolutionReports } from '@/components/admin/AdminResolutionReports';
import { AdminAuditLogPanel } from '@/components/admin/AdminAuditLogPanel';
import { AdminTriageModal } from '@/components/admin/AdminTriageModal';

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [editingIssue, setEditingIssue] = useState<CivicIssue | null>(null);
  const [modalFocusHint, setModalFocusHint] = useState<'general' | 'department' | 'priority'>(
    'general'
  );

  const openTriageModal = useCallback(
    (issue: CivicIssue, focus: 'general' | 'department' | 'priority' = 'general') => {
      setEditingIssue(issue);
      setModalFocusHint(focus);
    },
    []
  );

  useEffect(() => {
    if (selectedIssueFromHeader) {
      openTriageModal(selectedIssueFromHeader, 'general');
      onClearHeaderSelection?.();
    }
  }, [selectedIssueFromHeader, onClearHeaderSelection, openTriageModal]);

  const pendingVerifications = useMemo(
    () =>
      issues.filter(
        (i) =>
          i.status !== 'Resolved' &&
          i.fieldVerification?.verificationStatus === 'Pending Verification'
      ),
    [issues]
  );

  const kpis = useMemo(() => computeAdminKpis(issues), [issues]);

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

  const departmentMetrics = useMemo(() => computeDepartmentMetrics(issues), [issues]);

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

      {activeSection === 'overview' && (
        <>
          <AdminKpiGrid kpis={kpis} averageUrgency={stats.averageUrgency} />
          <AdminOverviewPanels
            pendingVerifications={pendingVerifications}
            criticalAlerts={criticalAlerts}
            onOpenModal={openTriageModal}
            onQuickAdvance={handleQuickAdvance}
            onViewFullQueue={() => {
              setQueueFilter('Critical');
              onNavigateSection('complaints');
            }}
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <AdminHotspotMap
                issues={issues}
                onInspectComplaint={(issue) => openTriageModal(issue, 'general')}
              />
            </div>
            <div className="xl:col-span-5">
              <AdminDepartmentPanel
                departmentMetrics={departmentMetrics}
                expanded={false}
                inspectedDepartment={inspectedDepartment}
                onToggleInspect={(dept) =>
                  setInspectedDepartment(inspectedDepartment === dept ? null : dept)
                }
                onFilterDepartment={(dept) => {
                  setDepartmentFilter(dept);
                  onNavigateSection('complaints');
                }}
                onInspectDivisions={() => onNavigateSection('departments')}
                onOpenModal={openTriageModal}
              />
            </div>
          </div>
          <AdminAuditLogPanel
            auditLogs={filteredAuditLogs}
            auditFilter={auditFilter}
            onAuditFilterChange={setAuditFilter}
            maxRows={6}
            onViewFullHistory={() => onNavigateSection('audit')}
          />
          <AdminTriageQueue
            filteredQueue={filteredQueue}
            queueFilter={queueFilter}
            onQueueFilterChange={setQueueFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            maxRows={8}
            isIssueOverdue={isIssueOverdue}
            onQuickAdvance={handleQuickAdvance}
            onOpenModal={openTriageModal}
            onViewAllComplaints={() => onNavigateSection('complaints')}
          />
        </>
      )}

      {activeSection === 'complaints' && (
        <>
          <AdminKpiGrid kpis={kpis} averageUrgency={stats.averageUrgency} />
          <AdminTriageQueue
            filteredQueue={filteredQueue}
            queueFilter={queueFilter}
            onQueueFilterChange={setQueueFilter}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            isIssueOverdue={isIssueOverdue}
            onQuickAdvance={handleQuickAdvance}
            onOpenModal={openTriageModal}
          />
        </>
      )}

      {activeSection === 'departments' && (
        <>
          <AdminKpiGrid kpis={kpis} averageUrgency={stats.averageUrgency} />
          <AdminDepartmentPanel
            departmentMetrics={departmentMetrics}
            expanded={true}
            inspectedDepartment={inspectedDepartment}
            onToggleInspect={(dept) =>
              setInspectedDepartment(inspectedDepartment === dept ? null : dept)
            }
            onFilterDepartment={(dept) => {
              setDepartmentFilter(dept);
              onNavigateSection('complaints');
            }}
            onOpenModal={openTriageModal}
          />
        </>
      )}

      {activeSection === 'geography' && (
        <>
          <AdminKpiGrid kpis={kpis} averageUrgency={stats.averageUrgency} />
          <AdminHotspotMap
            issues={issues}
            onInspectComplaint={(issue) => openTriageModal(issue, 'general')}
          />
        </>
      )}

      {activeSection === 'reports' && (
        <AdminResolutionReports
          issues={issues}
          kpis={kpis}
          averageUrgency={stats.averageUrgency}
          departmentMetrics={departmentMetrics}
          onOpenModal={openTriageModal}
        />
      )}

      {activeSection === 'audit' && (
        <AdminAuditLogPanel
          auditLogs={filteredAuditLogs}
          auditFilter={auditFilter}
          onAuditFilterChange={setAuditFilter}
        />
      )}

      {editingIssue && (
        <AdminTriageModal
          editingIssue={editingIssue}
          modalFocusHint={modalFocusHint}
          onUpdateIssue={onUpdateIssue}
          onVerifyFieldWork={onVerifyFieldWork}
          onNotify={setToastMessage}
          onClose={() => setEditingIssue(null)}
        />
      )}
    </div>
  );
}
