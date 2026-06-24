import { getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, GoogleAuthProvider, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
// Validate that required public env vars are present. If not, mark as not configured
const missing = [
  ...(!process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? ["NEXT_PUBLIC_FIREBASE_API_KEY"] : []),
  ...(!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] : []),
  ...(!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? ["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] : []),
  ...(!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] : []),
  ...(!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] : []),
  ...(!process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? ["NEXT_PUBLIC_FIREBASE_APP_ID"] : []),
];
export const firebaseConfigured = missing.length === 0;

if (!firebaseConfigured) {
  // Only log detailed errors in development to avoid noisy console output
  // in production or CI. Keep silent in production and return guarded values.
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error(
      "Firebase not configured. Missing env vars:",
      missing,
      "\nSet NEXT_PUBLIC_FIREBASE_* variables in your environment."
    );
  }
}

const app = firebaseConfigured ? (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)) : undefined;

export const auth = app ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>);
export const db = app ? getFirestore(app) : (null as unknown as ReturnType<typeof getFirestore>);
export const storage = app ? getStorage(app) : (null as unknown as ReturnType<typeof getStorage>);
export const googleProvider = new GoogleAuthProvider();

export async function ensureSessionAuthPersistence() {
  if (typeof window === "undefined") return;
  if (!firebaseConfigured || !auth) return;
  await setPersistence(auth, browserSessionPersistence);
}
