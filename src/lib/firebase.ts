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
import {
  firebaseConfig,
  initAnalytics,
  isFirebaseConfigured,
} from '@/lib/firebaseClient';

export { initAnalytics, isFirebaseConfigured };

const ISSUES_CACHE_TTL_MS = 3000;

const globalForFirestoreCache = globalThis as unknown as {
  __civicFirestoreIssuesCache?: { data: CivicIssue[]; expiresAt: number } | null;
};

export function invalidateFirestoreIssuesCache(): void {
  globalForFirestoreCache.__civicFirestoreIssuesCache = null;
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
  invalidateFirestoreIssuesCache();
  try {
    const db = getFirebaseDb();
    if (!db) return false;
    const issueRef = doc(db, 'civic_issues', issue.id);
    const cleaned = removeUndefinedFields({
      ...issue,
      syncedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await withTimeout(setDoc(issueRef, cleaned, { merge: true }));
    invalidateFirestoreIssuesCache();
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase Firestore Sync] Notice for ${issue.id}: ${errorMsg}`);
    return false;
  }
}

/**
 * Fetches all issues stored in Firestore across serverless containers,
 * using a short 3s TTL read cache that clears immediately on writes.
 */
export async function fetchIssuesFromFirestore(): Promise<CivicIssue[] | null> {
  if (!isFirebaseConfigured()) return null;
  const cached = globalForFirestoreCache.__civicFirestoreIssuesCache;
  if (cached && cached.expiresAt > Date.now()) {
    return [...cached.data];
  }

  try {
    const db = getFirebaseDb();
    if (!db) return null;
    const snap = await withTimeout(getDocs(collection(db, 'civic_issues')));
    const issues = snap.empty
      ? []
      : snap.docs.map((d) => d.data() as CivicIssue).filter((i) => Boolean(i?.id && i?.title));
    globalForFirestoreCache.__civicFirestoreIssuesCache = {
      data: issues,
      expiresAt: Date.now() + ISSUES_CACHE_TTL_MS,
    };
    return [...issues];
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
