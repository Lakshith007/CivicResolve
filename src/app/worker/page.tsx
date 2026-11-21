import React from 'react';
import { getAllIssues, toPublicIssue } from '@/lib/issueStore';
import { WorkerPortalClient } from '@/components/WorkerPortalClient';

export const dynamic = 'force-dynamic';

export default function WorkerPage() {
  const issues = getAllIssues().map((issue) => toPublicIssue(issue, null));
  return <WorkerPortalClient initialIssues={issues} />;
}
