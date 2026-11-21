export const ISSUE_CATEGORIES = [
  'Potholes & Road Damage',
  'Garbage & Sanitation',
  'Streetlights & Electrical',
  'Water Supply & Leakage',
  'Drainage & Sewage',
  'Public Safety & Hazards',
  'Parks & Public Spaces',
  'Other Civic Issue',
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export const ISSUE_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const ISSUE_STATUSES = ['Reported', 'In Progress', 'Resolved'] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const DEPARTMENTS = [
  'Roads & Bridges Department (PWD)',
  'Solid Waste Management (SWM)',
  'Electrical & Streetlighting Division',
  'Water Works & Hydraulic Engineering',
  'Stormwater & Sewerage Board',
  'Disaster & Public Safety Cell',
  'Horticulture & Parks Department',
  'General Municipal Administration',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const WARDS = [
  'Ward 01 — Central Civic Core',
  'Ward 04 — Market & Commercial District',
  'Ward 07 — Indiranagar East',
  'Ward 12 — Hospital & University Zone',
  'Ward 15 — Greenbelt & Parks Corridor',
  'Ward 19 — Industrial Ring Road',
] as const;

export interface AIAnalysisResult {
  category: IssueCategory;
  priority: IssuePriority;
  urgencyScore: number;
  department: Department;
  aiSummary: string;
  impactAssessment: string;
  suggestedAction: string;
  estimatedResolutionSla: string;
  confidence: number;
  detectedKeywords: string[];
  engine: 'gemini-ai' | 'smart-civic-fallback';
}

export interface StatusHistoryEntry {
  status: IssueStatus;
  timestamp: string;
  note: string;
  updatedBy: string;
}

export type FieldVerificationStatus = 'Pending Verification' | 'Approved' | 'Rejected';

export interface FieldCompletionSubmission {
  crewName: string;
  crewUnitId: string;
  completionNotes: string;
  completionPhotoUrl: string;
  submittedAt: string;
  verificationStatus: FieldVerificationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export type UserRole = 'CITIZEN' | 'ADMIN';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserRecord extends SessionUser {
  passwordHash: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole;
  action: string;
  targetTicketId: string;
  previousValues?: Record<string, unknown>;
  updatedValues?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  location: string;
  ward: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: IssueCategory;
  priority: IssuePriority;
  urgencyScore: number;
  department: Department;
  status: IssueStatus;
  imageUrl?: string;
  resolutionEvidenceUrl?: string;
  fieldVerification?: FieldCompletionSubmission;
  reporterUserId?: string;
  reporterName: string;
  reporterContact?: string;
  upvotes: number;
  aiAnalysis: AIAnalysisResult;
  adminNotes?: string;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  total: number;
  reported: number;
  inProgress: number;
  resolved: number;
  criticalCount: number;
  averageUrgency: number;
  departmentBreakdown: Record<string, number>;
}
