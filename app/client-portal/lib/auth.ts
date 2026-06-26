import {
  type AppUser,
  signInWithEmail,
  signOutUser,
  onAuthChange,
  sendPasswordReset,
  changePassword,
  getAuthorizedUserByEmail,
  ensureSessionPersistence,
} from "@/lib/authClient";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/firestore";
import { getAuthorizedUserProfile, waitForAuthUser } from "@/lib/authRoles";

export const CLIENT_PORTAL_BYPASS_UID = "__client_portal_viewer__";
let cachedClientPortalSession: ClientPortalSession | null = null;

export type ClientPortalSession = {
  email: string;
  name: string;
  loggedInAt: string;
  companyId: string;
};

export type LoginResult = { success: true } | { success: false; error: string };
export type ResetResult = { success: true } | { success: false; error: string };
export type ChangePasswordResult = { success: true } | { success: false; error: string };

export type FirestoreProfile = {
  name: string;
  position: string;
  department: string;
  company: string;
};

// Synchronous fast-check used in page useEffects for immediate redirect.
// Only ever written after the backend + authorized-user lookup verify role === "client".
export function getClientPortalSession(): ClientPortalSession | null {
  return cachedClientPortalSession;
}

export async function getClientPortalSessionAsync(): Promise<ClientPortalSession | null> {
  if (cachedClientPortalSession) return cachedClientPortalSession;

  const user = await waitForAuthUser();
  if (!user?.email) return null;

  const profile = await getAuthorizedUserProfile(user);
  if (!profile || profile.role !== "client") return null;

  const session = {
    email: user.email,
    name: profile.name || user.displayName || user.email,
    loggedInAt: new Date().toISOString(),
    companyId: DEFAULT_ORGANIZATION_ID,
  };
  setClientPortalSession(session);
  return session;
}

function setClientPortalSession(session: ClientPortalSession): void {
  cachedClientPortalSession = session;
}

export function clearClientPortalSession(): void {
  cachedClientPortalSession = null;
}

export function ensureBypassAdminUser(name = "Client Viewer"): void {
  void name;
}

export async function loginClientPortal(email: string, password: string): Promise<LoginResult> {
  try {
    await ensureSessionPersistence();
    const result = await signInWithEmail(email, password);
    if (!result.success) return { success: false, error: result.error };

    const data = await getAuthorizedUserByEmail(result.user.email ?? email);
    if (!data) {
      await signOutUser();
      return { success: false, error: "Access denied. Contact your administrator." };
    }
    if (data.role === "admin") {
      await signOutUser();
      return { success: false, error: "Please use the Admin portal to log in." };
    }
    if (data.role !== "client") {
      await signOutUser();
      return { success: false, error: "Access denied. Contact your administrator." };
    }

    setClientPortalSession({
      email: result.user.email || email,
      name: data.name || result.user.displayName || result.user.email || "Client",
      loggedInAt: new Date().toISOString(),
      companyId: DEFAULT_ORGANIZATION_ID,
    });

    return { success: true };
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? "";
    return { success: false, error: `Error: ${message}` };
  }
}

export async function logoutClientPortal(): Promise<void> {
  clearClientPortalSession();
  try {
    sessionStorage.clear();
  } catch {
    // ignore — sign-out still completes
  }
  await signOutUser();
}

export async function sendClientPortalPasswordReset(email: string): Promise<ResetResult> {
  const res = await sendPasswordReset(email);
  if (res.success) return { success: true };
  return { success: false, error: res.error ?? "Failed to send reset email. Try again." };
}

export function onClientPortalAuthStateChanged(
  callback: (user: AppUser | null) => void
): () => void {
  return onAuthChange(callback);
}

// Fetches the authorized-user record to pre-fill the settings profile.
export async function getClientPortalFirestoreProfile(email: string): Promise<FirestoreProfile> {
  try {
    const data = await getAuthorizedUserByEmail(email);
    if (!data) return { name: "", position: "", department: "", company: "" };
    return {
      name: String(data.name || ""),
      position: String(data.position || ""),
      department: String(data.department || ""),
      company: String(data.company || ""),
    };
  } catch {
    return { name: "", position: "", department: "", company: "" };
  }
}

export async function changeClientPortalPassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const res = await changePassword(currentPassword, newPassword);
  if (res.success) return { success: true };
  return { success: false, error: res.error };
}
