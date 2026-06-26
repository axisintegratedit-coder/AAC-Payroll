"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { KeyRound, LogOut, Pencil, Save, ShieldCheck, UserCog, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOutUser, changePassword } from "@/lib/authClient";
import { clearCurrentAdminUser, getCurrentAdminUser, type AdminRole, type AdminUser } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { getConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { logAudit } from "@/lib/auditTrail";

const editableRoles: AdminRole[] = ["Owner", "Super User", "HR Admin", "Payroll Admin", "Support Admin", "Pending"];
const editableStatuses: AdminUser["status"][] = ["Approved", "Pending Approval", "Rejected", "Disabled"];

export default function UserSettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [userForm, setUserForm] = useState<AdminUser | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  useEffect(() => {
    const user = getCurrentAdminUser();
    setCurrentUser(user);
    setUserForm(user);

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.status !== "Approved") {
      router.replace("/pending-approval");
    }
  }, [router]);

  useEffect(() => {
    async function loadTheme() {
      const savedTheme = normalizeTheme(
        await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME)
      );
      setTheme(savedTheme);
      applyAppTheme(savedTheme);
    }

    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    };
  }, []);

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = activeTheme.bannerOverlayOpacity / 100;

  async function handleLogout() {
    try {
      sessionStorage.clear();
    } catch {
      // ignore — Firebase sign-out still completes
    }
    await signOutUser();

    clearCurrentAdminUser();
    router.replace("/login");
  }

  function handleEditSignedInUser() {
    if (!currentUser) return;
    setUserForm(currentUser);
    setIsEditingUser(true);
  }

  function handleCancelSignedInUser() {
    setUserForm(currentUser);
    setIsEditingUser(false);
  }

  function updateUserForm<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
    setUserForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleSaveSignedInUser() {
    if (!userForm) return;

    const nextUser: AdminUser = {
      ...userForm,
      name: userForm.name.trim(),
      email: userForm.email.trim().toLowerCase(),
    };

    if (!nextUser.name) {
      window.alert("Please enter the signed-in user's name.");
      return;
    }

    if (!nextUser.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextUser.email)) {
      window.alert("Please enter a valid email address.");
      return;
    }

    if (!window.confirm("Save signed-in user details for this screen?")) return;

    setCurrentUser(nextUser);
    setUserForm(nextUser);
    setIsEditingUser(false);
    logAudit({ action: "SAVED", entityType: "Settings", entityId: nextUser.uid || "admin-user", entityName: nextUser.name || nextUser.email || "Admin User", details: "Signed-in user profile updated" });
    window.alert("Signed-in user details updated.");
  }

  async function handleChangePassword() {
    const user = getCurrentUser();
    if (!user || !user.email) {
      window.alert("No signed-in account found. Please log in again.");
      return;
    }

    if (!currentPassword) {
      window.alert("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      window.alert("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      window.alert("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      window.alert("New password must be different from your current password.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (!result.success) {
        const msg = result.error || "";
        if (/wrong-password|invalid-credential|incorrect/i.test(msg)) {
          window.alert("Your current password is incorrect.");
        } else if (/weak-password/i.test(msg)) {
          window.alert("New password is too weak. Use at least 6 characters.");
        } else if (/too-many-requests/i.test(msg)) {
          window.alert("Too many attempts. Please wait a moment and try again.");
        } else {
          window.alert("Could not change password. Please try again.");
        }
        return;
      }

      logAudit({
        action: "EDITED",
        entityType: "Settings",
        entityId: user.uid,
        entityName: currentUser?.name || user.email,
        details: "Account password changed",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.alert("Password changed successfully.");
    } catch (error) {
      console.error(error);
      window.alert("Could not change password. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <main
      className="axis-user-settings-page"
      style={{
        "--user-top-nav": activeTheme.topNavColor,
        "--user-banner": activeTheme.bannerColor,
        "--user-accent": activeTheme.accentColor,
        "--user-top-nav-text": activeTheme.topNavTextColor,
        "--user-banner-text": activeTheme.bannerTextColor,
        "--user-button-text": activeTheme.bannerButtonTextColor,
        minHeight: "100vh",
        padding: "24px 16px",
      } as React.CSSProperties}
    >
      <style>{`
        .axis-user-settings-page {
          background: linear-gradient(180deg, var(--user-top-nav) 0%, var(--user-banner) 330px, #f4f8fc 330px, #f4f8fc 100%);
        }

        .axis-user-settings-shell {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }

        .axis-user-settings-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--user-accent) 42%, transparent);
          border-radius: 16px;
          color: var(--user-banner-text);
          box-shadow: 0 28px 80px -38px rgba(14, 165, 233, 0.7);
          background-size: cover;
          background-position: center;
        }

        .axis-user-settings-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.35;
          background-image: linear-gradient(color-mix(in srgb, var(--user-accent) 24%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--user-accent) 24%, transparent) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        .axis-user-settings-hero::after {
          content: "";
          position: absolute;
          right: 0;
          top: 0;
          width: 112px;
          height: 112px;
          border-left: 1px solid color-mix(in srgb, var(--user-accent) 36%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--user-accent) 36%, transparent);
          border-bottom-left-radius: 42px;
          background: color-mix(in srgb, var(--user-accent) 14%, transparent);
        }

        .axis-user-settings-hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 20px 24px;
        }

        .axis-user-settings-hero-copy {
          display: flex;
          align-items: center;
          gap: 20px;
          max-width: 780px;
        }

        .axis-user-settings-logo {
          position: relative;
          width: 100px;
          height: 52px;
          flex: 0 0 auto;
          overflow: hidden;
          border: 1px solid rgba(186, 230, 253, 0.28);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 14px 30px -18px rgba(56, 189, 248, 0.6);
        }

        .axis-user-settings-eyebrow {
          margin: 0;
          color: color-mix(in srgb, var(--user-banner-text) 72%, var(--user-accent));
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .axis-user-settings-title {
          margin: 6px 0 0;
          color: var(--user-banner-text);
          font-size: 26px;
          line-height: 1.15;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .axis-user-settings-subtitle {
          margin: 6px 0 0;
          max-width: 760px;
          color: color-mix(in srgb, var(--user-banner-text) 80%, transparent);
          font-size: 13px;
          line-height: 1.5;
          font-weight: 500;
        }

        .axis-user-settings-hero-card {
          min-width: 220px;
          border: 1px solid color-mix(in srgb, var(--user-accent) 28%, transparent);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.10);
          padding: 14px 16px;
          box-shadow: 0 20px 48px -28px rgba(56, 189, 248, 0.6);
          backdrop-filter: blur(16px);
        }

        .axis-user-settings-icon-tile {
          display: inline-flex;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          border: 1px solid color-mix(in srgb, var(--user-accent) 30%, transparent);
          border-radius: 8px;
          background: color-mix(in srgb, var(--user-accent) 12%, transparent);
          color: color-mix(in srgb, var(--user-banner-text) 70%, var(--user-accent));
        }

        .axis-user-settings-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.88);
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 4px 24px -8px rgba(8, 47, 73, 0.12);
          ring: 1px solid rgba(15, 23, 42, 0.04);
        }

        .axis-user-settings-card-icon {
          color: var(--user-accent);
        }

        .axis-user-settings-edit-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .axis-user-settings-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
          gap: 18px;
        }

        .axis-user-settings-actions {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr 180px auto auto;
          gap: 12px;
          align-items: end;
        }

        @media (max-width: 900px) {
          .axis-user-settings-hero-inner,
          .axis-user-settings-hero-copy {
            align-items: flex-start;
            flex-direction: column;
          }

          .axis-user-settings-hero-card {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .axis-user-settings-title {
            font-size: 22px;
          }

          .axis-user-settings-grid,
          .axis-user-settings-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="axis-user-settings-shell">
        <div
          className="axis-user-settings-hero"
          style={{
            backgroundColor: activeTheme.bannerColor,
            backgroundImage: activeTheme.bannerImageDataUrl
              ? `linear-gradient(rgba(0,0,0,${bannerOverlayAlpha}), rgba(0,0,0,${bannerOverlayAlpha})), url("${activeTheme.bannerImageDataUrl}")`
              : `radial-gradient(circle at 82% 20%, color-mix(in srgb, ${activeTheme.accentColor} 24%, transparent), transparent 32%), linear-gradient(135deg, color-mix(in srgb, ${activeTheme.accentColor} 18%, transparent), transparent 46%)`,
          }}
        >
          <div className="axis-user-settings-hero-inner">
            <div className="axis-user-settings-hero-copy">
              <div>
                <p className="axis-user-settings-eyebrow">Super User Account</p>
                <h1 className="axis-user-settings-title">User Settings</h1>
                <p className="axis-user-settings-subtitle">
                  Manage your signed-in account, ownership recovery details, and temporary support access settings.
                </p>
              </div>
            </div>

            <div className="axis-user-settings-hero-card">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="axis-user-settings-icon-tile">
                  <UserCog size={22} aria-hidden="true" />
                </span>
                <div>
                  <div style={{ color: "color-mix(in srgb, var(--user-banner-text) 65%, var(--user-accent))", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                    Session Mode
                  </div>
                  <div style={{ marginTop: 4, color: "var(--user-banner-text)", fontSize: 16, fontWeight: 600 }}>
                    {currentUser?.role || "Checking access"}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <StatusBadge status={currentUser?.status || "No Session"} />
              </div>
            </div>
          </div>
        </div>

        <section className="axis-user-settings-card">
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Signed-in User</h2>
                <p style={sectionSubtitleStyle}>Current account recognized by the system.</p>
              </div>
              {isEditingUser ? (
                <div className="axis-user-settings-edit-actions">
                  <button type="button" onClick={handleSaveSignedInUser} style={primaryButtonStyle}>
                    <Save size={15} aria-hidden="true" />
                    Save
                  </button>
                  <button type="button" onClick={handleCancelSignedInUser} style={secondaryButtonStyle}>
                    <X size={15} aria-hidden="true" />
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="axis-user-settings-edit-actions">
                  <ShieldCheck className="axis-user-settings-card-icon" size={24} aria-hidden="true" />
                  <button type="button" onClick={handleEditSignedInUser} style={secondaryButtonStyle}>
                    <Pencil size={15} aria-hidden="true" />
                    Edit
                  </button>
                </div>
              )}
            </div>

            {isEditingUser && userForm ? (
              <div style={{ display: "grid", gap: 14 }}>
                <label>
                  <div style={inputLabelStyle}>Name</div>
                  <input
                    value={userForm.name}
                    onChange={(event) => updateUserForm("name", event.target.value)}
                    placeholder="Enter name"
                    style={inputStyle}
                  />
                </label>
                <label>
                  <div style={inputLabelStyle}>Email</div>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) => updateUserForm("email", event.target.value)}
                    placeholder="name@example.com"
                    style={inputStyle}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                  <label>
                    <div style={inputLabelStyle}>Role</div>
                    <select
                      value={userForm.role}
                      onChange={(event) => updateUserForm("role", event.target.value as AdminRole)}
                      style={inputStyle}
                    >
                      {editableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </label>
                  <label>
                    <div style={inputLabelStyle}>Status</div>
                    <select
                      value={userForm.status}
                      onChange={(event) => updateUserForm("status", event.target.value as AdminUser["status"])}
                      style={inputStyle}
                    >
                      {editableStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
                <InfoRow label="UID" value={userForm.uid || "—"} />
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <InfoRow label="Name" value={currentUser?.name || "—"} />
                <InfoRow label="Email" value={currentUser?.email || "—"} />
                <InfoRow label="Role" value={currentUser?.role || "—"} />
                <InfoRow label="Status" value={currentUser?.status || "—"} />
                <InfoRow label="UID" value={currentUser?.uid || "—"} />
              </div>
            )}

            <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
              <LogOut size={16} aria-hidden="true" />
              Logout
            </button>
          </section>

        <section className="axis-user-settings-card">
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Change Password</h2>
              <p style={sectionSubtitleStyle}>Update the password for your signed-in account.</p>
            </div>
            <KeyRound className="axis-user-settings-card-icon" size={24} aria-hidden="true" />
          </div>

          <div style={{ display: "grid", gap: 14, maxWidth: 480 }}>
            <label>
              <div style={inputLabelStyle}>Current Password</div>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
                style={inputStyle}
              />
            </label>
            <label>
              <div style={inputLabelStyle}>New Password</div>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                style={inputStyle}
              />
            </label>
            <label>
              <div style={inputLabelStyle}>Confirm New Password</div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                style={inputStyle}
              />
            </label>

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              style={{ ...primaryButtonStyle, opacity: isChangingPassword ? 0.6 : 1, cursor: isChangingPassword ? "not-allowed" : "pointer" }}
            >
              <KeyRound size={15} aria-hidden="true" />
              {isChangingPassword ? "Updating…" : "Update Password"}
            </button>
          </div>
        </section>

      </section>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "190px 1fr",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13, fontWeight: 900 }}>{label}</div>
      <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 800, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const lowerStatus = status.toLowerCase();
  const style = lowerStatus.includes("approved") || lowerStatus.includes("enabled")
    ? { border: "1px solid #bbf7d0", background: "#dcfce7", color: "#047857" }
    : lowerStatus.includes("disabled") || lowerStatus.includes("unauthorized")
      ? { border: "1px solid #fecdd3", background: "#fff1f2", color: "#be123c" }
      : { border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309" };

  return (
    <span
      style={{
        ...style,
        borderRadius: 999,
        padding: "7px 11px",
        fontSize: 12,
        fontWeight: 950,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--user-top-nav)",
  fontSize: 21,
  lineHeight: 1.2,
  fontWeight: 950,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 700,
};


const inputLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #dbe4ef",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#0f172a",
  fontWeight: 700,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 24px -22px rgba(8, 47, 73, 0.65)",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid var(--user-accent)",
  background: "var(--user-accent)",
  color: "var(--user-button-text)",
  borderRadius: 8,
  padding: "12px 16px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 18px 35px -20px rgba(14, 116, 144, 0.8)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4ef",
  background: "#ffffff",
  color: "var(--user-top-nav)",
  borderRadius: 8,
  padding: "12px 16px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 14px 28px -22px rgba(8, 47, 73, 0.75)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const logoutButtonStyle: React.CSSProperties = {
  marginTop: 22,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid #fecdd3",
  background: "#fff1f2",
  color: "#be123c",
  borderRadius: 8,
  padding: "12px 16px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 12px 24px -22px rgba(190, 18, 60, 0.7)",
};
