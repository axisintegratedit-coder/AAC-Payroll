import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordReset,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, ensureSessionAuthPersistence } from "@/lib/firebase";
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
// This flag is only ever written after Firebase + Firestore verify role === "client".
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

export async function loginClientPortal(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    await ensureSessionAuthPersistence();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    const q = query(
      collection(db, "authorizedUsers"),
      where("email", "==", user.email)
    );
    const snaps = await getDocs(q);
    if (snaps.empty) {
      await firebaseSignOut(auth);
      return { success: false, error: "Access denied. Contact your administrator." };
    }

    const data = snaps.docs[0].data();
    if (data.role === "admin") {
      await firebaseSignOut(auth);
      return { success: false, error: "Please use the Admin portal to log in." };
    }

    if (data.role !== "client") {
      await firebaseSignOut(auth);
      return { success: false, error: "Access denied. Contact your administrator." };
    }

    setClientPortalSession({
      email: user.email || email,
      name: data.name || user.displayName || user.email || "Client",
      loggedInAt: new Date().toISOString(),
      companyId: DEFAULT_ORGANIZATION_ID,
    });

    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    const message = (err as { message?: string }).message ?? "";
    console.error("Firebase error code:", code);
    console.error("Firebase error message:", message);
    return { success: false, error: `Error: ${code} — ${message}` };
  }
}

export async function logoutClientPortal(): Promise<void> {
  clearClientPortalSession();
  try {
    sessionStorage.clear();
  } catch {
    // ignore — Firebase sign-out still completes
  }
  try {
    await firebaseSignOut(auth);
  } catch {
    // ignore — session is already cleared
  }
}

export async function sendClientPortalPasswordReset(
  email: string
): Promise<ResetResult> {
  try {
    await firebaseSendPasswordReset(auth, email);
    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? "";
    if (code === "auth/user-not-found" || code === "auth/invalid-email") {
      return { success: true }; // don't reveal whether email exists
    }
    return { success: false, error: "Failed to send reset email. Try again." };
  }
}

export function onClientPortalAuthStateChanged(
  callback: (user: User | null) => void
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

// Fetches the user's Firestore document fields to pre-fill the settings profile.
// Returns empty strings for any field not present in the document.
export async function getClientPortalFirestoreProfile(
  email: string
): Promise<FirestoreProfile> {
  try {
    const q = query(collection(db, "authorizedUsers"), where("email", "==", email));
    const snaps = await getDocs(q);
    if (snaps.empty) return { name: "", position: "", department: "", company: "" };
    const data = snaps.docs[0].data();
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
  try {
    const user = auth.currentUser;
    console.log("Current user:", user?.email);
    console.log("User provider:", user?.providerData);

    if (!user || !user.email) {
      return { success: false, error: "Session expired. Please log in again." };
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    console.log("Attempting reauthentication...");
    await reauthenticateWithCredential(user, credential);
    console.log("Reauthentication successful");

    await updatePassword(user, newPassword);
    console.log("Password updated successfully");

    return { success: true };
  } catch (err: unknown) {
    console.error("Full error:", err);
    console.error("Error code:", (err as { code?: string }).code);
    console.error("Error message:", (err as { message?: string }).message);
    const code = (err as { code?: string }).code ?? "";
    const message = (err as { message?: string }).message ?? "";
    return { success: false, error: `Error: ${code} — ${message}` };
  }
}
