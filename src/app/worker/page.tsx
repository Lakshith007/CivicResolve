import React from 'react';
import { authenticateUser } from '@/lib/authGuards';
import { getAllIssues, toPublicIssue } from '@/lib/issueStore';
import { WorkerAccessGate } from '@/components/WorkerAccessGate';
import { WorkerPortalClient } from '@/components/WorkerPortalClient';

export const dynamic = 'force-dynamic';

export default function WorkerPage() {
  const user = authenticateUser();

  if (!user || (user.role !== 'WORKER' && user.role !== 'ADMIN')) {
    return <WorkerAccessGate currentUser={user ?? null} />;
  }

  const allIssues = getAllIssues().map((issue) => toPublicIssue(issue, user));
  const scopedIssues =
    user.role === 'WORKER' && user.assignedDepartment && user.assignedDepartment !== 'ALL'
      ? allIssues.filter((i) => i.department === user.assignedDepartment)
      : allIssues;

  return <WorkerPortalClient initialIssues={scopedIssues} workerUser={user} />;
}
