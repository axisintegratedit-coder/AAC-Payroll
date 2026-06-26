"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Mail, Pencil, Save, User, X } from "lucide-react";
import {
  changeClientPortalPassword,
  getClientPortalFirestoreProfile,
  getClientPortalSessionAsync,
  sendClientPortalPasswordReset,
} from "../lib/auth";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";
import { getConfigItem, setConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type ClientPortalProfile = {
  name: string;
  position: string;
  department: string;
  company: string;
};

const DEFAULT_PROFILE: ClientPortalProfile = { name: "", position: "", department: "", company: "" };

export default function ClientPortalSettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [sessionEmail, setSessionEmail] = useState("");

  // Profile state
  const [profile, setProfile] = useState<ClientPortalProfile>(DEFAULT_PROFILE);
  const [profileForm, setProfileForm] = useState<ClientPortalProfile>(DEFAULT_PROFILE);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password reset state
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resetError, setResetError] = useState("");

  // Change password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const email = session.email;
      setSessionEmail(email);

      const [raw, saved, fsProfile] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getConfigItem<ClientPortalProfile>(storageKeys.clientPortalProfile, DEFAULT_PROFILE),
        getClientPortalFirestoreProfile(email),
      ]);
      const t = normalizeTheme(raw);
      setTheme(t);
      applyAppTheme(t);
      const merged: ClientPortalProfile = {
        name: saved.name || fsProfile.name,
        position: saved.position || fsProfile.position,
        department: saved.department || fsProfile.department,
        company: saved.company || fsProfile.company,
      };
      setProfile(merged);
      setProfileForm(merged);
    }
    load();
  }, [router]);

  function handleSaveProfile() {
    const next: ClientPortalProfile = {
      name: profileForm.name.trim(),
      position: profileForm.position.trim(),
      department: profileForm.department.trim(),
      company: profileForm.company.trim(),
    };
    setConfigItem(storageKeys.clientPortalProfile, next);
    setProfile(next);
    setIsEditingProfile(false);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 4000);
  }

  async function handleSendReset() {
    setResetStatus("sending");
    setResetError("");
    const result = await sendClientPortalPasswordReset(sessionEmail);
    if (!result.success) {
      setResetStatus("error");
      setResetError(result.error);
      return;
    }
    setResetStatus("sent");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwStatus("idle");

    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw === currentPw) {
      setPwError("New password must be different from your current password.");
      return;
    }

    setPwStatus("loading");

    try {
      const result = await changeClientPortalPassword(currentPw, newPw);
      if (!result.success) {
        setPwStatus("error");
        const msg = result.error || "";
        if (/wrong-password|invalid-credential|incorrect/i.test(msg)) {
          setPwError("Current password is incorrect.");
        } else if (/too-many-requests/i.test(msg)) {
          setPwError("Too many attempts. Please try again later.");
        } else if (/session expired/i.test(msg)) {
          setPwError("Session expired. Please log out and log in again.");
        } else {
          setPwError(msg || "Could not change password. Please try again.");
        }
        return;
      }
      setPwStatus("success");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const message = (err as { message?: string }).message ?? "";
      setPwStatus("error");
      setPwError(`Error: ${message}`);
    }
  }

  const inp = "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]";

  const pwStrength = newPw.length >= 12 ? 4 : newPw.length >= 10 ? 3 : newPw.length >= 8 ? 2 : newPw.length > 0 ? 1 : 0;
  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong"][pwStrength];
  const pwStrengthColor = ["", "bg-rose-400", "bg-amber-400", "bg-sky-500", "bg-emerald-500"][pwStrength];

  return (
    <div className="min-h-screen pg-bg">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{ backgroundColor: theme.bannerColor, borderColor: `${theme.accentColor}33` }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold" style={{ color: theme.bannerTextColor }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />User Settings
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Account & Profile</h1>
          <p className="mt-1 text-sm opacity-85" style={{ color: theme.bannerTextColor }}>Manage your display name, position, and portal password.</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 space-y-5">

        {/* Logged-in chip */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0a4f8f15]">
            <User className="h-5 w-5 text-[#0a4f8f]" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logged in as</div>
            <div className="font-semibold text-slate-800">{sessionEmail || "—"}</div>
          </div>
          <span className="ml-auto rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Read-only Portal</span>
        </div>

        {/* Profile card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Your Profile</h2>
              <p className="mt-0.5 text-sm text-slate-500">Name shown in the audit log and throughout the portal.</p>
            </div>
            {isEditingProfile ? (
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveProfile}
                  className="flex items-center gap-1.5 rounded-lg bg-[#0a4f8f] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#0c3460]">
                  <Save className="h-3.5 w-3.5" />Save
                </button>
                <button type="button" onClick={() => { setProfileForm(profile); setIsEditingProfile(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  <X className="h-3.5 w-3.5" />Cancel
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => { setProfileForm(profile); setIsEditingProfile(true); }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
            )}
          </div>

          <div className="p-6">
            {isEditingProfile ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">Full Name</span>
                  <input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Juan dela Cruz" className={inp} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">Position / Title</span>
                  <input value={profileForm.position} onChange={(e) => setProfileForm((p) => ({ ...p, position: e.target.value }))}
                    placeholder="e.g. Finance Manager" className={inp} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">Department</span>
                  <input value={profileForm.department} onChange={(e) => setProfileForm((p) => ({ ...p, department: e.target.value }))}
                    placeholder="e.g. Finance" className={inp} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">Company</span>
                  <input value={profileForm.company} onChange={(e) => setProfileForm((p) => ({ ...p, company: e.target.value }))}
                    placeholder="e.g. ABC Corporation" className={inp} />
                </label>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Full Name", profile.name || "—"],
                  ["Position / Title", profile.position || "—"],
                  ["Department", profile.department || "—"],
                  ["Company", profile.company || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-1 font-semibold text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
            )}

            {profileSuccess && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Profile saved. Your name will now appear in the audit log.
              </p>
            )}
          </div>
        </div>

        {/* Send Reset Link card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Mail className="h-5 w-5 text-[#0a4f8f]" />
            <div>
              <h2 className="text-base font-semibold text-slate-800">Reset Password via Email</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                We&apos;ll send a reset link to <span className="font-semibold text-slate-700">{sessionEmail || "your email"}</span>.
              </p>
            </div>
          </div>
          <div className="p-6">
            {resetStatus === "sent" ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                Reset link sent to <strong>{sessionEmail}</strong>. Check your inbox (and spam folder).
              </p>
            ) : (
              <div className="space-y-3">
                {resetStatus === "error" && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{resetError}</p>
                )}
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={resetStatus === "sending" || !sessionEmail}
                  className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460] disabled:opacity-60"
                >
                  {resetStatus === "sending" ? "Sending…" : "Send Reset Link"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Change Password card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <KeyRound className="h-5 w-5 text-[#0a4f8f]" />
            <div>
              <h2 className="text-base font-semibold text-slate-800">Change Password</h2>
              <p className="mt-0.5 text-sm text-slate-500">Enter your current password and choose a new one.</p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="p-6">
            <div className="grid gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Current Password</span>
                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPw}
                    onChange={(e) => { setCurrentPw(e.target.value); setPwError(""); setPwStatus("idle"); }}
                    placeholder="Enter current password"
                    required
                    autoComplete="current-password"
                    className={`${inp} pr-10`}
                  />
                  <button type="button" onClick={() => setShowCurrentPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">New Password</span>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => { setNewPw(e.target.value); setPwError(""); setPwStatus("idle"); }}
                    placeholder="Min. 8 characters"
                    required
                    autoComplete="new-password"
                    className={`${inp} pr-10`}
                  />
                  <button type="button" onClick={() => setShowNewPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPw && (
                  <div className="mt-1 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${level <= pwStrength ? pwStrengthColor : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">{pwStrengthLabel}</p>
                  </div>
                )}
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Confirm New Password</span>
                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); setPwError(""); setPwStatus("idle"); }}
                    placeholder="Re-enter new password"
                    required
                    autoComplete="new-password"
                    className={`${inp} pr-10`}
                  />
                  <button type="button" onClick={() => setShowConfirmPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {pwError && (pwStatus === "error" || pwStatus === "idle") && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pwError}</p>
              )}
              {pwStatus === "success" && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Password updated successfully!
                </p>
              )}

              <button
                type="submit"
                disabled={pwStatus === "loading"}
                className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460] disabled:opacity-60"
              >
                {pwStatus === "loading" ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Contact your administrator if you need further help with your account.
        </p>
      </div>
    </div>
  );
}
