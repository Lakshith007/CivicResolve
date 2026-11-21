import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AIAnalysisResult,
  CivicIssue,
  DashboardStats,
  Department,
  IssuePriority,
  IssueStatus,
  SessionUser,
} from '@/types/civic';
import type { SanitizedIssueSubmission, SanitizedStatusUpdate } from '@/lib/validation';
import { classifyWithHeuristic } from '@/lib/aiClassifier';
import { fetchIssuesFromFirestore } from '@/lib/firebase';
import { INITIAL_COIMBATORE_ISSUES } from './seedIssues';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'issues.json');

let memoryCache: CivicIssue[] | null = null;

function cloneIssues(list: CivicIssue[]): CivicIssue[] {
  return JSON.parse(JSON.stringify(list)) as CivicIssue[];
}

function persistIssues(issues: CivicIssue[]): void {
  memoryCache = cloneIssues(issues);
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(issues, null, 2), 'utf-8');
  } catch {
    // Graceful fallback when running in read-only serverless filesystems
  }
}

function loadIssues(): CivicIssue[] {
  if (memoryCache) {
    return cloneIssues(memoryCache);
  }
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as CivicIssue[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = cloneIssues(parsed);
        return parsed;
      }
    }
  } catch {
    // Fallback to seed issues
  }
  const seeded = cloneIssues(INITIAL_COIMBATORE_ISSUES);
  persistIssues(seeded);
  return seeded;
}

export function getAllIssues(): CivicIssue[] {
  return loadIssues().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getIssueById(id: string): CivicIssue | undefined {
  return loadIssues().find((issue) => issue.id === id);
}

function generateNextTicketId(issues: CivicIssue[]): string {
  let maxNum = 1000;
  for (const item of issues) {
    const match = item.id.match(/CR-\d{4}-(\d+)/);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  return `CR-2026-${maxNum + 1}`;
}

export function canAccessPrivateIssue(
  issue: CivicIssue,
  viewer: SessionUser | null
): boolean {
  if (!viewer) return false;
  if (viewer.role === 'ADMIN') return true;
  return Boolean(issue.reporterUserId && issue.reporterUserId === viewer.id);
}

/**
 * Strips private reporter contact details and internal user identifiers unless
 * the viewer is an Administrator or the ticket's authenticated creator.
 */
export function toPublicIssue(issue: CivicIssue, viewer: SessionUser | null): CivicIssue {
  if (canAccessPrivateIssue(issue, viewer)) {
    return issue;
  }
  const { reporterContact: _contact, reporterUserId: _uid, ...publicFields } = issue;
  return publicFields;
}

export function createIssue(
  submission: SanitizedIssueSubmission,
  options?: { aiAnalysis?: AIAnalysisResult; reporterUserId?: string }
): CivicIssue {
  const issues = loadIssues();
  const now = new Date().toISOString();
  const analysis =
    options?.aiAnalysis ??
    classifyWithHeuristic({
      title: submission.title,
      description: submission.description,
      location: submission.location,
      userCategory: submission.userCategory,
    });

  const newIssue: CivicIssue = {
    id: generateNextTicketId(issues),
    title: submission.title,
    description: submission.description,
    location: submission.location,
    ward: submission.ward,
    coordinates: submission.coordinates,
    category: analysis.category,
    priority: analysis.priority,
    urgencyScore: analysis.urgencyScore,
    department: analysis.department,
    status: 'Reported',
    imageUrl: submission.imageUrl,
    reporterUserId: options?.reporterUserId,
    reporterName: submission.reporterName,
    reporterContact: submission.reporterContact,
    upvotes: 1,
    aiAnalysis: analysis,
    statusHistory: [
      {
        status: 'Reported',
        timestamp: now,
        note: `Complaint submitted and classified (${analysis.priority} priority) for ${analysis.department}.`,
        updatedBy: analysis.engine === 'gemini-ai' ? 'CivicResolve Gemini AI' : 'CivicResolve Triage Engine',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  issues.unshift(newIssue);
  persistIssues(issues);
  return newIssue;
}

export function updateIssueStatus(
  id: string,
  update: SanitizedStatusUpdate
): CivicIssue | null {
  const issues = loadIssues();
  const idx = issues.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  const existing = issues[idx];
  const now = new Date().toISOString();

  const nextStatus: IssueStatus = update.status;
  const nextDepartment: Department = update.department ?? existing.department;
  const nextPriority: IssuePriority = update.priority ?? existing.priority;

  const defaultNote =
    nextStatus === 'In Progress'
      ? `Assigned to ${nextDepartment} field team for active remediation.`
      : nextStatus === 'Resolved'
        ? `Issue verified and marked resolved by ${nextDepartment}.`
        : 'Ticket reopened for municipal review.';

  const overrideTag =
    update.priority && update.priority !== existing.priority && update.priorityOverrideReason
      ? ` [Priority overridden ${existing.priority} → ${update.priority}: ${update.priorityOverrideReason}]`
      : '';

  const note = `${update.adminNotes || defaultNote}${overrideTag}`;

  const updated: CivicIssue = {
    ...existing,
    status: nextStatus,
    department: nextDepartment,
    priority: nextPriority,
    adminNotes: update.adminNotes ?? existing.adminNotes,
    resolutionEvidenceUrl: update.resolutionEvidenceUrl ?? existing.resolutionEvidenceUrl,
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      {
        status: nextStatus,
        timestamp: now,
        note,
        updatedBy: update.updatedBy,
      },
    ],
  };

  issues[idx] = updated;
  persistIssues(issues);
  return updated;
}

function hashImageData(dataUrl: string): string {
  return crypto.createHash('sha256').update(dataUrl.trim()).digest('hex');
}

export function submitFieldCompletionProof(
  id: string,
  payload: {
    crewName: string;
    crewUnitId: string;
    completionNotes: string;
    completionPhotoUrl: string;
  }
):
  | { ok: true; issue: CivicIssue }
  | { ok: false; error: string; status: number; plagiarismDetected?: boolean } {
  const issues = loadIssues();
  const idx = issues.findIndex((item) => item.id === id);
  if (idx === -1) {
    return { ok: false, error: 'Complaint ticket not found.', status: 404 };
  }

  const existing = issues[idx];
  if (existing.status !== 'In Progress') {
    return {
      ok: false,
      error:
        existing.status === 'Resolved'
          ? 'This complaint is already verified and resolved.'
          : 'Completion proof can only be submitted after an administrator dispatches the ticket (In Progress).',
      status: 400,
    };
  }

  // Cryptographic Photo Plagiarism & Reuse Detection (SHA-256)
  const photoHash = hashImageData(payload.completionPhotoUrl);

  // Check 1: Cannot re-upload the citizen's original "Before" photo as completion proof
  if (existing.imageUrl && hashImageData(existing.imageUrl) === photoHash) {
    return {
      ok: false,
      error:
        'Plagiarism Detected: Submitted completion photo is identical to the citizen\'s original "Before" complaint photo. Please upload a genuine photo of the completed repair.',
      status: 400,
      plagiarismDetected: true,
    };
  }

  // Check 2: Cannot reuse a completion photo already submitted on another ticket
  for (const other of issues) {
    if (other.id === existing.id) continue;
    const otherProofHash =
      other.fieldVerification?.photoHash ||
      (other.fieldVerification?.completionPhotoUrl
        ? hashImageData(other.fieldVerification.completionPhotoUrl)
        : null);
    const otherResolvedHash = other.resolutionEvidenceUrl
      ? hashImageData(other.resolutionEvidenceUrl)
      : null;

    if (otherProofHash === photoHash || otherResolvedHash === photoHash) {
      return {
        ok: false,
        error: `Plagiarism Detected: This completion photo was already submitted as proof for ticket ${other.id}. Reusing photos across complaints is prohibited.`,
        status: 400,
        plagiarismDetected: true,
      };
    }
  }

  const now = new Date().toISOString();
  const updated: CivicIssue = {
    ...existing,
    fieldVerification: {
      crewName: payload.crewName,
      crewUnitId: payload.crewUnitId,
      completionNotes: payload.completionNotes,
      completionPhotoUrl: payload.completionPhotoUrl,
      photoHash,
      plagiarismStatus: 'Unique (SHA-256 Verified)',
      submittedAt: now,
      verificationStatus: 'Pending Verification',
    },
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      {
        status: 'In Progress',
        timestamp: now,
        note: `Field crew ${payload.crewName} (${payload.crewUnitId}) posted unique completion photo (SHA-256 verified) for administrator review: "${payload.completionNotes}"`,
        updatedBy: `Field Crew · ${payload.crewUnitId}`,
      },
    ],
  };

  issues[idx] = updated;
  persistIssues(issues);
  return { ok: true, issue: updated };
}

export function reviewFieldCompletionProof(
  id: string,
  params: {
    decision: 'approve' | 'reject';
    reviewerName: string;
    adminNotes?: string;
    rejectionReason?: string;
  }
): { ok: true; issue: CivicIssue } | { ok: false; error: string; status: number } {
  const issues = loadIssues();
  const idx = issues.findIndex((item) => item.id === id);
  if (idx === -1) {
    return { ok: false, error: 'Complaint ticket not found.', status: 404 };
  }

  const existing = issues[idx];
  if (!existing.fieldVerification) {
    return {
      ok: false,
      error: 'No field completion proof has been submitted for this ticket.',
      status: 400,
    };
  }

  const now = new Date().toISOString();

  if (params.decision === 'approve') {
    const note =
      params.adminNotes?.trim() ||
      `Supervisor verified field completion photo from ${existing.fieldVerification.crewName} (${existing.fieldVerification.crewUnitId}) and closed ticket.`;

    const updated: CivicIssue = {
      ...existing,
      status: 'Resolved',
      adminNotes: note,
      resolutionEvidenceUrl: existing.fieldVerification.completionPhotoUrl,
      fieldVerification: {
        ...existing.fieldVerification,
        verificationStatus: 'Approved',
        reviewedBy: params.reviewerName,
        reviewedAt: now,
        rejectionReason: undefined,
      },
      updatedAt: now,
      statusHistory: [
        ...existing.statusHistory,
        {
          status: 'Resolved',
          timestamp: now,
          note,
          updatedBy: params.reviewerName,
        },
      ],
    };

    issues[idx] = updated;
    persistIssues(issues);
    return { ok: true, issue: updated };
  }

  // Reject & request rework
  const reason = params.rejectionReason?.trim() || 'Additional field remediation required.';
  const updated: CivicIssue = {
    ...existing,
    status: 'In Progress',
    adminNotes: `Rework requested: ${reason}`,
    fieldVerification: {
      ...existing.fieldVerification,
      verificationStatus: 'Rejected',
      reviewedBy: params.reviewerName,
      reviewedAt: now,
      rejectionReason: reason,
    },
    updatedAt: now,
    statusHistory: [
      ...existing.statusHistory,
      {
        status: 'In Progress',
        timestamp: now,
        note: `Supervisor rejected field completion proof and requested rework: "${reason}"`,
        updatedBy: params.reviewerName,
      },
    ],
  };

  issues[idx] = updated;
  persistIssues(issues);
  return { ok: true, issue: updated };
}

export function upvoteIssue(id: string): CivicIssue | null {
  const issues = loadIssues();
  const idx = issues.findIndex((item) => item.id === id);
  if (idx === -1) return null;

  issues[idx] = {
    ...issues[idx],
    upvotes: issues[idx].upvotes + 1,
    updatedAt: new Date().toISOString(),
  };
  persistIssues(issues);
  return issues[idx];
}

export function getDashboardStats(issuesList?: CivicIssue[]): DashboardStats {
  const issues = issuesList ?? loadIssues();
  const departmentBreakdown: Record<string, number> = {};

  let reported = 0;
  let inProgress = 0;
  let resolved = 0;
  let criticalCount = 0;
  let urgencySum = 0;

  for (const issue of issues) {
    if (issue.status === 'Reported') reported++;
    else if (issue.status === 'In Progress') inProgress++;
    else if (issue.status === 'Resolved') resolved++;

    if (issue.priority === 'Critical') criticalCount++;
    urgencySum += issue.urgencyScore;
    departmentBreakdown[issue.department] = (departmentBreakdown[issue.department] ?? 0) + 1;
  }

  return {
    total: issues.length,
    reported,
    inProgress,
    resolved,
    criticalCount,
    averageUrgency: issues.length > 0 ? Math.round(urgencySum / issues.length) : 0,
    departmentBreakdown,
  };
}

export async function hydrateIssuesFromFirestore(): Promise<CivicIssue[]> {
  const local = loadIssues();
  const remote = await fetchIssuesFromFirestore();
  if (!remote || remote.length === 0) {
    return local;
  }

  const mergedMap = new Map<string, CivicIssue>();
  for (const issue of local) {
    mergedMap.set(issue.id, issue);
  }
  for (const rIssue of remote) {
    const existing = mergedMap.get(rIssue.id);
    if (!existing) {
      mergedMap.set(rIssue.id, rIssue);
    } else {
      const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
      const remoteTime = new Date(rIssue.updatedAt || rIssue.createdAt).getTime();
      if (remoteTime >= existingTime) {
        mergedMap.set(rIssue.id, { ...existing, ...rIssue });
      }
    }
  }

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  memoryCache = cloneIssues(merged);
  return merged;
}

export function resetIssueStoreForTesting(): void {
  memoryCache = cloneIssues(INITIAL_COIMBATORE_ISSUES);
}
