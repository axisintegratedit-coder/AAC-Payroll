/**
 * Auth dispatcher — backend-agnostic auth facade.
 *
 * Selected at build time by NEXT_PUBLIC_BACKEND:
 *   - "supabase" → Supabase Auth
 *   - default    → Firebase Auth
 *
 * Pages and lib code import from here instead of "firebase/auth" directly,
 * so the same components work against either backend. Supabase users are
 * normalized to the same { uid, email, displayName } shape Firebase exposes.
 */

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  sendPasswordResetEmail as fbSendPasswordReset,
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection as fbCollection,
  getDocs as fbGetDocs,
  query as fbQuery,
  where as fbWhere,
} from "firebase/firestore";
import {
  auth as fbAuth,
  db as fbDb,
  googleProvider,
  firebaseConfigured,
  ensureSessionAuthPersistence,
} from "./firebase";
import { supabase, supabaseConfigured } from "./supabase";

const USE_SUPABASE = process.env.NEXT_PUBLIC_BACKEND === "supabase";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type AuthorizedUserRecord = {
  email: string;
  name?: string;
  role?: "admin" | "client" | string;
  status?: string;
  position?: string;
  department?: string;
  company?: string;
  [k: string]: unknown;
};

export type AuthResult =
  | { success: true; user: AppUser }
  | { success: false; error: string };

// ─── Supabase user normalization + cached current user ────────────────────────

type SupaUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

let cachedSupaUser: SupaUser | null = null;

function normalizeSupa(u: SupaUser | null): AppUser | null {
  if (!u) return null;
  const name = (u.user_metadata?.name ?? u.user_metadata?.full_name) as string | undefined;
  return { uid: u.id, email: u.email ?? null, displayName: name ?? null };
}

/** Used by supabase-impl.logAudit to stamp performedBy without importing this whole module's UI deps. */
export function getSupabaseUserId(): string | null {
  return cachedSupaUser?.id ?? null;
}

// ─── Configured / persistence ─────────────────────────────────────────────────

export function isBackendConfigured(): boolean {
  return USE_SUPABASE ? supabaseConfigured : firebaseConfigured && !!fbAuth;
}

export async function ensureSessionPersistence(): Promise<void> {
  if (USE_SUPABASE) return; // supabase-js persists by default (see lib/supabase.ts)
  await ensureSessionAuthPersistence();
}

// ─── Current user ─────────────────────────────────────────────────────────────

export function getCurrentUser(): AppUser | null {
  if (USE_SUPABASE) return normalizeSupa(cachedSupaUser);
  const u = fbAuth?.currentUser;
  return u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null;
}

export function onAuthChange(callback: (user: AppUser | null) => void): () => void {
  if (USE_SUPABASE) {
    // seed immediately, then subscribe
    supabase.auth.getUser().then(({ data }) => {
      cachedSupaUser = (data.user as SupaUser) ?? null;
      callback(normalizeSupa(cachedSupaUser));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedSupaUser = (session?.user as SupaUser) ?? null;
      callback(normalizeSupa(cachedSupaUser));
    });
    return () => sub.subscription.unsubscribe();
  }
  return fbOnAuthStateChanged(fbAuth, (u) =>
    callback(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)
  );
}

export function waitForUser(): Promise<AppUser | null> {
  if (USE_SUPABASE) {
    return supabase.auth.getUser().then(({ data }) => {
      cachedSupaUser = (data.user as SupaUser) ?? null;
      return normalizeSupa(cachedSupaUser);
    });
  }
  if (!firebaseConfigured || !fbAuth) return Promise.resolve(null);
  if (fbAuth.currentUser) {
    const u = fbAuth.currentUser;
    return Promise.resolve({ uid: u.uid, email: u.email, displayName: u.displayName });
  }
  return new Promise((resolve) => {
    const unsub = fbOnAuthStateChanged(fbAuth, (u) => {
      unsub();
      resolve(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null);
    });
  });
}

// ─── Sign in / out ────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    if (USE_SUPABASE) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) return { success: false, error: error?.message ?? "Sign in failed." };
      cachedSupaUser = data.user as SupaUser;
      return { success: true, user: normalizeSupa(cachedSupaUser)! };
    }
    await ensureSessionAuthPersistence();
    const res = await signInWithEmailAndPassword(fbAuth, email, password);
    return { success: true, user: { uid: res.user.uid, email: res.user.email, displayName: res.user.displayName } };
  } catch (err: unknown) {
    return { success: false, error: messageOf(err) };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    if (USE_SUPABASE) {
      // OAuth redirect flow; resolves after redirect. Callback handled on return.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: typeof window !== "undefined" ? window.location.origin + "/login" : undefined },
      });
      if (error) return { success: false, error: error.message };
      return { success: false, error: "__redirecting__" }; // page will reload via redirect
    }
    await ensureSessionAuthPersistence();
    const res = await signInWithPopup(fbAuth, googleProvider);
    return { success: true, user: { uid: res.user.uid, email: res.user.email, displayName: res.user.displayName } };
  } catch (err: unknown) {
    return { success: false, error: messageOf(err) };
  }
}

export async function signOutUser(): Promise<void> {
  try {
    if (USE_SUPABASE) {
      await supabase.auth.signOut();
      cachedSupaUser = null;
      return;
    }
    if (firebaseConfigured && fbAuth) await fbSignOut(fbAuth);
  } catch {
    // ignore — session is being torn down anyway
  }
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    if (USE_SUPABASE) {
      const current = normalizeSupa(cachedSupaUser);
      if (!current?.email) return { success: false, error: "Session expired. Please log in again." };
      // reauthenticate by re-signing in with the current password
      const reauth = await supabase.auth.signInWithPassword({ email: current.email, password: currentPassword });
      if (reauth.error) return { success: false, error: "Current password is incorrect." };
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true, user: current };
    }
    const user = fbAuth.currentUser;
    if (!user || !user.email) return { success: false, error: "Session expired. Please log in again." };
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await fbUpdatePassword(user, newPassword);
    return { success: true, user: { uid: user.uid, email: user.email, displayName: user.displayName } };
  } catch (err: unknown) {
    return { success: false, error: messageOf(err) };
  }
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (USE_SUPABASE) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? window.location.origin + "/login" : undefined,
      });
      if (error) return { success: false, error: "Failed to send reset email. Try again." };
      return { success: true };
    }
    await fbSendPasswordReset(fbAuth, email);
    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/user-not-found" || code === "auth/invalid-email") return { success: true };
    return { success: false, error: "Failed to send reset email. Try again." };
  }
}

// ─── Authorized-user lookup (replaces direct Firestore queries in pages) ──────

export async function getAuthorizedUserByEmail(email: string | null | undefined): Promise<AuthorizedUserRecord | null> {
  if (!email) return null;
  if (USE_SUPABASE) {
    const { data } = await supabase
      .from("collections")
      .select("id, data")
      .eq("org_id", "default-org")
      .eq("collection", "authorizedUsers");
    const rows = (data ?? []).map(
      (r) => ({ id: r.id, ...(r.data as Record<string, unknown>) } as unknown as AuthorizedUserRecord)
    );
    return rows.find((r) => r.email === email) ?? null;
  }
  if (!firebaseConfigured || !fbDb) return null;
  const q = fbQuery(fbCollection(fbDb, "authorizedUsers"), fbWhere("email", "==", email));
  const snaps = await fbGetDocs(q);
  return snaps.empty ? null : (snaps.docs[0].data() as AuthorizedUserRecord);
}

export async function getAuthorizedUserByUid(uid: string): Promise<AuthorizedUserRecord | null> {
  if (USE_SUPABASE) {
    const { data } = await supabase
      .from("collections")
      .select("data")
      .eq("org_id", "default-org")
      .eq("collection", "authorizedUsers")
      .eq("id", uid)
      .maybeSingle();
    return data ? (data.data as AuthorizedUserRecord) : null;
  }
  // Firebase: caller falls back to email lookup; kept for symmetry.
  return null;
}

function messageOf(err: unknown): string {
  const code = (err as { code?: string }).code ?? "";
  const message = (err as { message?: string }).message ?? String(err);
  return code ? `Error: ${code} — ${message}` : message;
}
