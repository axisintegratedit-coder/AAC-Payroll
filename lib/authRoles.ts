import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

export type AuthorizedUserRole = "admin" | "client";

export type AuthorizedUserProfile = {
  uid: string;
  email: string;
  name: string;
  role: AuthorizedUserRole;
  status?: string;
};

export function waitForAuthUser(): Promise<User | null> {
  if (!firebaseConfigured || !auth) return Promise.resolve(null);

  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getAuthorizedUserProfile(user = auth.currentUser): Promise<AuthorizedUserProfile | null> {
  if (!user?.email) return null;

  if (!firebaseConfigured || !db) return null;

  const byUid = await getDoc(doc(db, "authorizedUsers", user.uid)).catch(() => null);
  const snapData = byUid?.exists() ? byUid.data() : null;

  const data = snapData ?? await (async () => {
    const byEmail = query(collection(db, "authorizedUsers"), where("email", "==", user.email));
    const snaps = await getDocs(byEmail);
    return snaps.empty ? null : snaps.docs[0].data();
  })();

  if (!data || (data.role !== "admin" && data.role !== "client")) return null;

  return {
    uid: user.uid,
    email: user.email,
    name: String(data.name || user.displayName || user.email),
    role: data.role,
    status: String(data.status || "Approved"),
  };
}

