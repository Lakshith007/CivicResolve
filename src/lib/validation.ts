import {
  DEPARTMENTS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Department,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
  type AIAnalysisResult,
} from '@/types/civic';

export interface SanitizedIssueSubmission {
  title: string;
  description: string;
  location: string;
  ward: string;
  coordinates: { lat: number; lng: number };
  userCategory?: IssueCategory;
  imageUrl?: string;
  reporterName: string;
  reporterContact?: string;
  aiAnalysis?: AIAnalysisResult;
}

export interface SanitizedStatusUpdate {
  status: IssueStatus;
  department?: Department;
  priority?: IssuePriority;
  adminNotes?: string;
  updatedBy: string;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: string[] };

/**
 * Strips potentially dangerous HTML/script tags, collapses redundant whitespace,
 * and caps length to protect API routes and stored records.
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isValidImageInput(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:image/') && trimmed.length <= 2_500_000) {
    return trimmed;
  }
  if ((trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) && trimmed.length <= 1024) {
    return trimmed;
  }
  return undefined;
}

export function validateIssueSubmission(payload: unknown): ValidationResult<SanitizedIssueSubmission> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Request payload must be a JSON object.'] };
  }

  const raw = payload as Record<string, unknown>;
  const errors: string[] = [];

  const title = sanitizeText(raw.title, 140);
  const description = sanitizeText(raw.description, 2000);
  const location = sanitizeText(raw.location, 200);
  const ward = sanitizeText(raw.ward, 100) || 'Ward 01 — Central Civic Core';
  const reporterName = sanitizeText(raw.reporterName, 80) || 'Concerned Citizen';
  const reporterContact = sanitizeText(raw.reporterContact, 100) || undefined;

  if (title.length < 5) {
    errors.push('Issue title must be at least 5 characters.');
  }
  if (description.length < 10) {
    errors.push('Issue description must be at least 10 characters.');
  }
  if (location.length < 3) {
    errors.push('Location must be at least 3 characters.');
  }

  let userCategory: IssueCategory | undefined;
  if (typeof raw.userCategory === 'string' && raw.userCategory !== 'auto' && raw.userCategory.trim() !== '') {
    if ((ISSUE_CATEGORIES as readonly string[]).includes(raw.userCategory)) {
      userCategory = raw.userCategory as IssueCategory;
    } else {
      errors.push('Selected issue category is invalid.');
    }
  }

  let coordinates = { lat: 12.9716, lng: 77.5946 };
  if (raw.coordinates && typeof raw.coordinates === 'object') {
    const coords = raw.coordinates as Record<string, unknown>;
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      coordinates = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
    }
  }

  const imageUrl = isValidImageInput(raw.imageUrl);
  if (raw.imageUrl && typeof raw.imageUrl === 'string' && raw.imageUrl.trim() !== '' && !imageUrl) {
    errors.push('Image attachment must be a valid image URL or base64 data URI under 2MB.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const aiAnalysis =
    raw.aiAnalysis && typeof raw.aiAnalysis === 'object'
      ? (raw.aiAnalysis as AIAnalysisResult)
      : undefined;

  return {
    valid: true,
    data: {
      title,
      description,
      location,
      ward,
      coordinates,
      userCategory,
      imageUrl,
      reporterName,
      reporterContact,
      aiAnalysis,
    },
  };
}

export function validateStatusUpdate(payload: unknown): ValidationResult<SanitizedStatusUpdate> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Status update payload must be a JSON object.'] };
  }

  const raw = payload as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof raw.status !== 'string' || !(ISSUE_STATUSES as readonly string[]).includes(raw.status)) {
    errors.push('Status must be one of: Reported, In Progress, Resolved.');
  }

  let department: Department | undefined;
  if (raw.department !== undefined) {
    if (typeof raw.department === 'string' && (DEPARTMENTS as readonly string[]).includes(raw.department)) {
      department = raw.department as Department;
    } else {
      errors.push('Selected department is invalid.');
    }
  }

  let priority: IssuePriority | undefined;
  if (raw.priority !== undefined) {
    if (typeof raw.priority === 'string' && (ISSUE_PRIORITIES as readonly string[]).includes(raw.priority)) {
      priority = raw.priority as IssuePriority;
    } else {
      errors.push('Selected priority is invalid.');
    }
  }

  const adminNotes = sanitizeText(raw.adminNotes, 600) || undefined;
  const updatedBy = sanitizeText(raw.updatedBy, 80) || 'Municipal Control Desk';

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      status: raw.status as IssueStatus,
      department,
      priority,
      adminNotes,
      updatedBy,
    },
  };
}
