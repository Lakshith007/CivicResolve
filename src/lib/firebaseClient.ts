export const firebaseConfig = {
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

/**
 * Initializes Firebase Analytics on the client side without pulling firebase/firestore
 * into client page bundles.
 */
export async function initAnalytics() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) return null;
  try {
    const { getApp, getApps, initializeApp } = await import('firebase/app');
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    if (await isSupported()) {
      return getAnalytics(app);
    }
  } catch {
    // Analytics unavailable in testing or unsupported environments
  }
  return null;
}
