import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { AuditLogEntry, CivicIssue } from '@/types/civic';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim() || '',
};

export function isFirebaseConfigured(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

let firestoreInstance: Firestore | null = null;

export function getFirebaseDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(app);
  }
  return firestoreInstance;
}

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Initializes Firebase Analytics on the client side if supported by the browser environment.
 */
export async function initAnalytics() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return null;
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const supported = await isSupported();
    if (supported) {
      return getAnalytics(app);
    }
  } catch {
    // Analytics unavailable in testing or unsupported environments
  }
  return null;
}

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        cleaned[key] = removeUndefinedFields(val as Record<string, unknown>);
      } else {
        cleaned[key] = val;
      }
    }
  }
  return cleaned;
}

/**
 * Persists a newly created or updated issue to Google Cloud Firestore (collection 'civic_issues').
 * Uses setDoc with merge: true so both new and seeded issues persist cleanly across serverless containers.
 */
export async function syncIssueToFirestore(issue: CivicIssue): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    if (!db) return false;
    const issueRef = doc(db, 'civic_issues', issue.id);
    const cleaned = removeUndefinedFields({
      ...issue,
      syncedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await withTimeout(setDoc(issueRef, cleaned, { merge: true }));
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase Firestore Sync] Notice for ${issue.id}: ${errorMsg}`);
    return false;
  }
}

/**
 * Persists an issue update (status, triage, upvotes, or field verification) to Firestore.
 */
export async function syncStatusUpdateToFirestore(
  ticketId: string,
  updateData: Partial<CivicIssue>
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    if (!db) return false;
    const issueRef = doc(db, 'civic_issues', ticketId);
    const cleaned = removeUndefinedFields({
      ...updateData,
      id: ticketId,
      updatedAt: updateData.updatedAt || new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await withTimeout(setDoc(issueRef, cleaned, { merge: true }));
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase Firestore Update] Notice for ${ticketId}: ${errorMsg}`);
    return false;
  }
}

/**
 * Fetches all issues stored in Firestore across serverless containers.
 */
export async function fetchIssuesFromFirestore(): Promise<CivicIssue[] | null> {
  try {
    const db = getFirebaseDb();
    if (!db) return null;
    const snap = await withTimeout(getDocs(collection(db, 'civic_issues')));
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as CivicIssue).filter((i) => Boolean(i?.id && i?.title));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase Firestore Fetch] Notice: ${errorMsg}`);
    return null;
  }
}

/**
 * Mirrors an immutable audit log entry to Firestore (collection 'civic_audit_logs').
 */
export async function syncAuditLogToFirestore(entry: AuditLogEntry): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    if (!db) return false;
    const ref = doc(db, 'civic_audit_logs', entry.id);
    const cleaned = removeUndefinedFields(entry as unknown as Record<string, unknown>);
    await withTimeout(setDoc(ref, cleaned, { merge: true }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches immutable audit logs from Firestore.
 */
export async function fetchAuditLogsFromFirestore(): Promise<AuditLogEntry[] | null> {
  try {
    const db = getFirebaseDb();
    if (!db) return null;
    const snap = await withTimeout(getDocs(collection(db, 'civic_audit_logs')));
    if (snap.empty) return [];
    return snap.docs
      .map((d) => d.data() as AuditLogEntry)
      .filter((e) => Boolean(e?.id && e?.timestamp));
  } catch {
    return null;
  }
}
