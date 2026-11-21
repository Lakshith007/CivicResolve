import React from 'react';
import { authenticateUser } from '@/lib/authGuards';
import { hydrateIssuesFromFirestore, toPublicIssue } from '@/lib/issueStore';
import { WorkerAccessGate } from '@/components/WorkerAccessGate';
import { WorkerPortalClient } from '@/components/WorkerPortalClient';

export const dynamic = 'force-dynamic';

export default async function WorkerPage() {
  const user = authenticateUser();

  if (!user || (user.role !== 'WORKER' && user.role !== 'ADMIN')) {
    return <WorkerAccessGate currentUser={user ?? null} />;
  }

  const allIssues = (await hydrateIssuesFromFirestore()).map((issue) => toPublicIssue(issue, user));
  const scopedIssues =
    user.role === 'WORKER' && user.assignedDepartment && user.assignedDepartment !== 'ALL'
      ? allIssues.filter((i) => i.department === user.assignedDepartment)
      : allIssues;

  return <WorkerPortalClient initialIssues={scopedIssues} workerUser={user} />;
}
