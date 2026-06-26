import {
  type AppUser,
  getCurrentUser,
  waitForUser,
  getAuthorizedUserByEmail,
} from "./authClient";

export type AuthorizedUserRole = "admin" | "client";

export type AuthorizedUserProfile = {
  uid: string;
  email: string;
  name: string;
  role: AuthorizedUserRole;
  status?: string;
};

export function waitForAuthUser(): Promise<AppUser | null> {
  return waitForUser();
}

export async function getAuthorizedUserProfile(
  user: AppUser | null = getCurrentUser()
): Promise<AuthorizedUserProfile | null> {
  if (!user?.email) return null;

  const data = await getAuthorizedUserByEmail(user.email);
  if (!data || (data.role !== "admin" && data.role !== "client")) return null;

  return {
    uid: user.uid,
    email: user.email,
    name: String(data.name || user.displayName || user.email),
    role: data.role as AuthorizedUserRole,
    status: String(data.status || "Approved"),
  };
}
