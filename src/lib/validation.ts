import {
  DEPARTMENTS,
  ISSUE_CATEGORIES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type Department,
  type IssueCategory,
  type IssuePriority,
  type IssueStatus,
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
}

export interface SanitizedStatusUpdate {
  status: IssueStatus;
  department?: Department;
  priority?: IssuePriority;
  priorityOverrideReason?: string;
  adminNotes?: string;
  resolutionEvidenceUrl?: string;
  updatedBy: string;
}

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: string[] };

const TICKET_ID_REGEX = /^CR-\d{4}-\d{1,6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_IMAGE_BYTES = 1_500_000;

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

export function validateTicketId(id: string): boolean {
  return TICKET_ID_REGEX.test(id);
}

function hasValidMagicBytes(mime: string, buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mime === 'image/webp') {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }
  return false;
}

/**
 * Strictly validates uploaded images:
 * - Blocks scriptable formats like SVG (data:image/svg+xml)
 * - Permits only PNG, JPEG, or WebP base64 data URIs with matching magic bytes <= 1.5MB
 * - Or safe HTTPS/local relative image URLs
 */
export function isValidImageInput(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const dataMatch = trimmed.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    const b64 = dataMatch[2];
    const approxBytes = Math.floor((b64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) return undefined;

    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length > MAX_IMAGE_BYTES || !hasValidMagicBytes(mime, decoded)) {
      return undefined;
    }
    return trimmed;
  }

  if (
    (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) &&
    !trimmed.toLowerCase().endsWith('.svg') &&
    trimmed.length <= 1024
  ) {
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
  if (
    typeof raw.userCategory === 'string' &&
    raw.userCategory !== 'auto' &&
    raw.userCategory.trim() !== ''
  ) {
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
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      coordinates = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
    }
  }

  const imageUrl = isValidImageInput(raw.imageUrl);
  if (raw.imageUrl && typeof raw.imageUrl === 'string' && raw.imageUrl.trim() !== '' && !imageUrl) {
    errors.push(
      'Image attachment must be a valid PNG, JPEG, or WebP image under 1.5MB.'
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Explicitly omit any client-supplied aiAnalysis, priority, status, department, or role
  // to prevent mass assignment or AI score tampering.
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

  const priorityOverrideReason = sanitizeText(raw.priorityOverrideReason, 300) || undefined;
  const adminNotes = sanitizeText(raw.adminNotes, 600) || undefined;
  const updatedBy = sanitizeText(raw.updatedBy, 80) || 'Municipal Control Desk';

  const resolutionEvidenceUrl = isValidImageInput(raw.resolutionEvidenceUrl);
  if (
    raw.resolutionEvidenceUrl &&
    typeof raw.resolutionEvidenceUrl === 'string' &&
    raw.resolutionEvidenceUrl.trim() !== '' &&
    !resolutionEvidenceUrl
  ) {
    errors.push(
      'Resolution evidence must be a valid PNG, JPEG, or WebP image under 1.5MB.'
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      status: raw.status as IssueStatus,
      department,
      priority,
      priorityOverrideReason,
      adminNotes,
      resolutionEvidenceUrl,
      updatedBy,
    },
  };
}

export function validateRegistrationInput(
  payload: unknown
): ValidationResult<{ name: string; email: string; password: string }> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Registration payload must be a JSON object.'] };
  }
  const raw = payload as Record<string, unknown>;
  const errors: string[] = [];

  const name = sanitizeText(raw.name, 80);
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase().slice(0, 140) : '';
  const password = typeof raw.password === 'string' ? raw.password : '';

  if (name.length < 2) errors.push('Full name must be at least 2 characters.');
  if (!EMAIL_REGEX.test(email)) errors.push('Please enter a valid email address.');
  if (password.length < 8 || password.length > 128) {
    errors.push('Password must be between 8 and 128 characters.');
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, email, password } };
}

export function validateLoginInput(
  payload: unknown
): ValidationResult<{ email: string; password: string }> {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Login payload must be a JSON object.'] };
  }
  const raw = payload as Record<string, unknown>;
  const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase().slice(0, 140) : '';
  const password = typeof raw.password === 'string' ? raw.password : '';

  if (!EMAIL_REGEX.test(email) || password.length < 1) {
    return { valid: false, errors: ['Valid email and password are required.'] };
  }
  return { valid: true, data: { email, password } };
}
