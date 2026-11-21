import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { CivicIssue } from '@/types/civic';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB25m5vaMQTbgqLYxR-293hwtC9GKDLFMM',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'civic-sence-4ef70.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'civic-sence-4ef70',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'civic-sence-4ef70.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '789272533653',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:789272533653:web:8435eb5e08289162de599c',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-H4VMM78W6X',
};

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

let firestoreInstance: Firestore | null = null;

export function getFirebaseDb(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(getFirebaseApp());
  }
  return firestoreInstance;
}

/**
 * Initializes Firebase Analytics on the client side if supported by the browser environment.
 */
export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const supported = await isSupported();
    if (supported) {
      return getAnalytics(getFirebaseApp());
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
 * Asynchronously mirrors a newly created issue to Google Cloud Firestore (collection 'civic_issues').
 * Resilient: if Firestore rules are locked or offline, logs diagnostic warning and does not block the app.
 */
export async function syncIssueToFirestore(issue: CivicIssue): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const issueRef = doc(db, 'civic_issues', issue.id);
    const cleaned = removeUndefinedFields({
      ...issue,
      syncedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await setDoc(issueRef, cleaned);
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Non-blocking fallback: never fail citizen reporting if external Firestore rules reject
    console.warn(`[Firebase Firestore Sync] Notice for ${issue.id}: ${errorMsg}`);
    return false;
  }
}

/**
 * Asynchronously mirrors an issue status/admin update to Firestore.
 */
export async function syncStatusUpdateToFirestore(
  ticketId: string,
  updateData: Partial<CivicIssue>
): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const issueRef = doc(db, 'civic_issues', ticketId);
    const cleaned = removeUndefinedFields({
      ...updateData,
      updatedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>);
    await updateDoc(issueRef, cleaned);
    return true;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Firebase Firestore Update] Notice for ${ticketId}: ${errorMsg}`);
    return false;
  }
}

/**
 * Fetches issues stored in Firestore if available.
 */
export async function fetchIssuesFromFirestore(): Promise<CivicIssue[] | null> {
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(collection(db, 'civic_issues'));
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as CivicIssue);
  } catch {
    return null;
  }
}
