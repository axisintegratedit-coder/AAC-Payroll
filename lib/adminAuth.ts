import { getCurrentUser } from "./authClient";
import { getAuthorizedUserProfile, waitForAuthUser } from "./authRoles";

export type AdminRole =
  | "Owner"
  | "Super User"
  | "HR Admin"
  | "Payroll Admin"
  | "Support Admin"
  | "Pending";

export type AdminUser = {
  uid: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "Approved" | "Pending Approval" | "Rejected" | "Disabled";
  isBackupRecovery?: boolean;
};

export function getCurrentAdminUser(): AdminUser | null {
  const user = getCurrentUser();
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.displayName || user.email || "Admin",
    email: user.email || "",
    role: "Owner",
    status: "Approved",
  };
}

export function clearCurrentAdminUser() {
  // Firebase Auth owns the signed-in session.
}

export function canAccessAdminPage(allowedRoles: AdminRole[]) {
  const user = getCurrentAdminUser();

  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }

  if (user.status === "Disabled") {
    return { allowed: false, redirectTo: "/unauthorized" };
  }

  if (user.status !== "Approved") {
    return { allowed: false, redirectTo: "/pending-approval" };
  }

  if (!allowedRoles.includes(user.role)) {
    return { allowed: false, redirectTo: "/unauthorized" };
  }

  return { allowed: true, redirectTo: "" };
}

export async function canAccessAdminPageAsync(allowedRoles: AdminRole[]) {
  const user = await waitForAuthUser();

  if (!user) {
    return { allowed: false, redirectTo: "/login" };
  }

  const profile = await getAuthorizedUserProfile(user);

  if (!profile || profile.role !== "admin") {
    return { allowed: false, redirectTo: "/unauthorized" };
  }

  const adminRole: AdminRole = "Owner";
  const status = profile.status || "Approved";

  if (status === "Disabled") {
    return { allowed: false, redirectTo: "/unauthorized" };
  }

  if (status !== "Approved") {
    return { allowed: false, redirectTo: "/pending-approval" };
  }

  if (!allowedRoles.includes(adminRole)) {
    return { allowed: false, redirectTo: "/unauthorized" };
  }

  return { allowed: true, redirectTo: "" };
}
