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

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'issues.json');

const SEED_ISSUES: CivicIssue[] = [
  {
    id: 'CR-2026-1001',
    title: 'Exposed sparking streetlight pole wire outside PSG School Gate',
    description:
      'Streetlight pole #42 on Avinashi Road has broken junction casing with exposed live wire sparking intermittently near the school pedestrian crossing after rain.',
    location: 'Avinashi Road, Peelamedu PSG School Gate',
    ward: 'Ward 07 — Peelamedu & Avinashi Corridor',
    coordinates: { lat: 11.0246, lng: 77.0028 },
    category: 'Streetlights & Electrical',
    priority: 'Critical',
    urgencyScore: 94,
    department: 'Electrical & Streetlighting Division',
    status: 'In Progress',
    reporterName: 'Ananya Krishnan',
    upvotes: 34,
    aiAnalysis: {
      category: 'Streetlights & Electrical',
      priority: 'Critical',
      urgencyScore: 94,
      department: 'Electrical & Streetlighting Division',
      aiSummary:
        'Critical-priority streetlights & electrical issue reported at Avinashi Road, Peelamedu PSG School Gate, routed to Electrical & Streetlighting Division.',
      impactAssessment:
        'Elevated urgency driven by electrocution risk from exposed live wire; active electrical sparking / fire hazard; high vulnerability near student pedestrian zone.',
      suggestedAction:
        'Dispatch electrical maintenance crew to isolate power hazard, inspect pole wiring, and restore illumination.',
      estimatedResolutionSla: '2–4 hours (Emergency Dispatch)',
      confidence: 0.96,
      detectedKeywords: ['streetlight', 'wire', 'sparking', 'live wire', 'school'],
      engine: 'gemini-ai',
    },
    adminNotes: 'Emergency linemen team E-4 dispatched; feeder breaker temporarily isolated.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T06:15:00.000Z',
        note: 'Complaint submitted via Citizen Portal and auto-triaged as Critical.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-21T06:40:00.000Z',
        note: 'Emergency linemen team E-4 dispatched; feeder breaker temporarily isolated.',
        updatedBy: 'Dispatcher Suresh K.',
      },
    ],
    createdAt: '2026-11-21T06:15:00.000Z',
    updatedAt: '2026-11-21T06:40:00.000Z',
  },
  {
    id: 'CR-2026-1002',
    title: 'Major water main burst flooding Coimbatore Medical College GH road',
    description:
      'Pressurized underground drinking water pipeline has burst, sending heavy water flow onto the main ambulance approach road outside Coimbatore Medical College GH and reducing neighborhood pressure.',
    location: 'Trichy Road, Coimbatore Medical College GH Entrance',
    ward: 'Ward 12 — RS Puram & GH Medical Zone',
    coordinates: { lat: 10.9964, lng: 76.9698 },
    category: 'Water Supply & Leakage',
    priority: 'Critical',
    urgencyScore: 91,
    department: 'Water Works & Hydraulic Engineering',
    status: 'Reported',
    reporterName: 'Dr. Karthik Subramanian',
    upvotes: 28,
    aiAnalysis: {
      category: 'Water Supply & Leakage',
      priority: 'Critical',
      urgencyScore: 91,
      department: 'Water Works & Hydraulic Engineering',
      aiSummary:
        'Critical-priority water supply & leakage issue reported at Trichy Road, Coimbatore Medical College GH Entrance, routed to Water Works & Hydraulic Engineering.',
      impactAssessment:
        'Elevated urgency driven by active infrastructure rupture causing resource loss; proximity to emergency healthcare access; active flooding threatening commuters.',
      suggestedAction:
        'Dispatch hydraulic emergency unit to shut isolation valve, repair ruptured pipeline, and check pressure.',
      estimatedResolutionSla: '2–4 hours (Emergency Dispatch)',
      confidence: 0.95,
      detectedKeywords: ['water', 'pipeline', 'burst', 'hospital', 'flooding'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T07:10:00.000Z',
        note: 'Complaint logged and escalated to Hydraulic Engineering Rapid Response.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-21T07:10:00.000Z',
    updatedAt: '2026-11-21T07:10:00.000Z',
  },
  {
    id: 'CR-2026-1003',
    title: 'Deep arterial pothole causing two-wheeler swerves near Gandhipuram Flyover',
    description:
      'A 4-foot wide deep pothole filled with rainwater on the left lane near Gandhipuram 100 Feet Road ramp is forcing two-wheelers to swerve abruptly into fast-moving traffic.',
    location: '100 Feet Road, Gandhipuram Flyover Ramp',
    ward: 'Ward 01 — Gandhipuram Central Core',
    coordinates: { lat: 11.0183, lng: 76.9674 },
    category: 'Potholes & Road Damage',
    priority: 'High',
    urgencyScore: 76,
    department: 'Roads & Bridges Department (PWD)',
    status: 'Reported',
    reporterName: 'Aravindh Natarajan',
    upvotes: 42,
    aiAnalysis: {
      category: 'Potholes & Road Damage',
      priority: 'High',
      urgencyScore: 76,
      department: 'Roads & Bridges Department (PWD)',
      aiSummary:
        'High-priority potholes & road damage issue reported at 100 Feet Road, Gandhipuram Flyover Ramp, routed to Roads & Bridges Department (PWD).',
      impactAssessment:
        'Elevated urgency driven by high-speed traffic accident risk on major commuter ramp.',
      suggestedAction:
        'Place reflective safety barricades immediately and schedule cold-mix/hot-mix asphalt patching crew.',
      estimatedResolutionSla: '24 hours (Priority Queue)',
      confidence: 0.93,
      detectedKeywords: ['pothole', 'road', 'highway', 'traffic'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-21T05:45:00.000Z',
        note: 'Submitted by commuter; flagged for Priority PWD Road Patching.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-21T05:45:00.000Z',
    updatedAt: '2026-11-21T05:45:00.000Z',
  },
  {
    id: 'CR-2026-1004',
    title: 'Overflowing community garbage bins at Ukkadam Market vegetable wing',
    description:
      'Three municipal waste containers along Oppanakara Street near Ukkadam Market have not been cleared for 2 days, spilling organic waste onto the footpath and creating strong foul odor.',
    location: 'Oppanakara Street, Ukkadam Market Gate',
    ward: 'Ward 04 — Town Hall & Oppanakara Market',
    coordinates: { lat: 10.9905, lng: 76.9606 },
    category: 'Garbage & Sanitation',
    priority: 'High',
    urgencyScore: 64,
    department: 'Solid Waste Management (SWM)',
    status: 'In Progress',
    reporterName: 'Meenakshi Sundaram',
    upvotes: 19,
    aiAnalysis: {
      category: 'Garbage & Sanitation',
      priority: 'High',
      urgencyScore: 64,
      department: 'Solid Waste Management (SWM)',
      aiSummary:
        'High-priority garbage & sanitation issue reported at Oppanakara Street, Ukkadam Market Gate, routed to Solid Waste Management (SWM).',
      impactAssessment:
        'Elevated urgency driven by escalating sanitation/spillover spread and prolonged unresolved community impact.',
      suggestedAction:
        'Assign compactor collection truck for immediate clearance, area sanitization spray, and bin replacement.',
      estimatedResolutionSla: '24 hours (Priority Queue)',
      confidence: 0.91,
      detectedKeywords: ['garbage', 'bin', 'overflowing', 'market', 'days'],
      engine: 'gemini-ai',
    },
    adminNotes: 'SWM Zone-2 compactor route diverted for afternoon clearance.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-20T16:20:00.000Z',
        note: 'Reported by market traders association.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-21T04:50:00.000Z',
        note: 'SWM Zone-2 compactor route diverted for afternoon clearance.',
        updatedBy: 'Sanitation Supervisor',
      },
    ],
    createdAt: '2026-11-20T16:20:00.000Z',
    updatedAt: '2026-11-21T04:50:00.000Z',
  },
  {
    id: 'CR-2026-1005',
    title: 'Blocked stormwater drain causing stagnant sewage near DB Road bus stop',
    description:
      'Plastic debris has choked the stormwater grating near DB Road Junction in RS Puram, causing stagnant greywater backup across the curb.',
    location: 'DB Road, RS Puram Head Post Office Shelter',
    ward: 'Ward 12 — RS Puram & GH Medical Zone',
    coordinates: { lat: 11.0086, lng: 76.9511 },
    category: 'Drainage & Sewage',
    priority: 'Medium',
    urgencyScore: 54,
    department: 'Stormwater & Sewerage Board',
    status: 'Resolved',
    reporterName: 'Vikramaditya R.',
    upvotes: 15,
    aiAnalysis: {
      category: 'Drainage & Sewage',
      priority: 'Medium',
      urgencyScore: 54,
      department: 'Stormwater & Sewerage Board',
      aiSummary:
        'Medium-priority drainage & sewage issue reported at DB Road, RS Puram Head Post Office Shelter, routed to Stormwater & Sewerage Board.',
      impactAssessment:
        'Standard municipal impact affecting commuter access and local hygiene.',
      suggestedAction:
        'Deploy jetting/suction unit to clear blockage, secure manhole cover, and disinfect affected stretch.',
      estimatedResolutionSla: '48–72 hours (Standard SLA)',
      confidence: 0.89,
      detectedKeywords: ['drain', 'stormwater', 'sewage', 'stagnant'],
      engine: 'gemini-ai',
    },
    adminNotes: 'Desilting complete and anti-larval spray applied on Nov 21.',
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-19T11:00:00.000Z',
        note: 'Issue logged and assigned to Stormwater & Sewerage Board.',
        updatedBy: 'CivicResolve AI',
      },
      {
        status: 'In Progress',
        timestamp: '2026-11-20T09:15:00.000Z',
        note: 'Jetting crew deployed for silt and plastic extraction.',
        updatedBy: 'Ward 12 Engineer',
      },
      {
        status: 'Resolved',
        timestamp: '2026-11-21T03:30:00.000Z',
        note: 'Desilting complete and anti-larval spray applied on Nov 21.',
        updatedBy: 'Ward 12 Engineer',
      },
    ],
    createdAt: '2026-11-19T11:00:00.000Z',
    updatedAt: '2026-11-21T03:30:00.000Z',
  },
  {
    id: 'CR-2026-1006',
    title: 'Broken wooden park bench and uneven paver tiles on Race Course walkway',
    description:
      'Two concrete paver slabs along the Thomas Park walking track on Race Course Road have settled slightly, and a bench slat is broken.',
    location: 'Race Course Road, Thomas Park Walking Loop',
    ward: 'Ward 15 — Race Course & VOC Park Belt',
    coordinates: { lat: 11.0018, lng: 76.9762 },
    category: 'Parks & Public Spaces',
    priority: 'Low',
    urgencyScore: 26,
    department: 'Horticulture & Parks Department',
    status: 'Reported',
    reporterName: 'Priya Venkatesh',
    upvotes: 6,
    aiAnalysis: {
      category: 'Parks & Public Spaces',
      priority: 'Low',
      urgencyScore: 26,
      department: 'Horticulture & Parks Department',
      aiSummary:
        'Low-priority parks & public spaces issue reported at Race Course Road, Thomas Park Walking Loop, routed to Horticulture & Parks Department.',
      impactAssessment:
        'Localized recreational amenity wear with low immediate safety risk.',
      suggestedAction:
        'Schedule park maintenance inspection to repair civic amenities and level walkway pavers.',
      estimatedResolutionSla: '5–7 business days (Scheduled Maintenance)',
      confidence: 0.87,
      detectedKeywords: ['park', 'bench', 'walkway'],
      engine: 'gemini-ai',
    },
    statusHistory: [
      {
        status: 'Reported',
        timestamp: '2026-11-20T14:05:00.000Z',
        note: 'Logged into scheduled Parks maintenance queue.',
        updatedBy: 'CivicResolve AI',
      },
    ],
    createdAt: '2026-11-20T14:05:00.000Z',
    updatedAt: '2026-11-20T14:05:00.000Z',
  },
];

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
  const seeded = cloneIssues(SEED_ISSUES);
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
  memoryCache = cloneIssues(SEED_ISSUES);
}
