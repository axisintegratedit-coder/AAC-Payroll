"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getClientPortalSessionAsync,
  loginClientPortal,
  sendClientPortalPasswordReset,
} from "../lib/auth";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";
import { getConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

export default function ClientPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [forgotError, setForgotError] = useState("");

  const router = useRouter();

  useEffect(() => {
    getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME).then((raw) => {
      const t = normalizeTheme(raw);
      setTheme(t);
      applyAppTheme(t);
    });

    getClientPortalSessionAsync().then((session) => {
      if (session) router.replace("/client-portal");
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await loginClientPortal(email.trim(), password);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.replace("/client-portal");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotStatus("sending");
    setForgotError("");

    const result = await sendClientPortalPasswordReset(forgotEmail.trim());
    if (!result.success) {
      setForgotStatus("error");
      setForgotError(result.error);
      return;
    }
    setForgotStatus("sent");
  }

  const bannerStyle: React.CSSProperties = { backgroundColor: theme.bannerColor };

  return (
    <div className="flex min-h-screen flex-col pg-bg text-slate-900">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-10 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={bannerStyle}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />

        <div className="relative mx-auto max-w-md text-center">
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold"
            style={{ color: theme.bannerTextColor }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Read-only Access
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: theme.bannerTextColor }}
          >
            Client Portal Login
          </h1>
          <p className="mt-2 text-sm opacity-75" style={{ color: theme.bannerTextColor }}>
            Axis Payroll System — view-only access to HR and payroll data.
          </p>
        </div>
      </section>

      {/* Login card */}
      <div className="mx-auto mt-10 w-full max-w-sm px-4">
        {!showForgot ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(8,47,73,0.12)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">Sign in</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Use your email and password to access the portal.
              </p>
            </div>
            <form onSubmit={handleLogin} className="p-5">
              <div className="grid gap-4">
                <label>
                  <div className="mb-1.5 text-sm font-semibold text-slate-700">Email</div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
                  />
                </label>
                <label>
                  <div className="mb-1.5 text-sm font-semibold text-slate-700">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
                  />
                </label>

                {error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460] disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotStatus("idle"); setForgotError(""); }}
                  className="text-center text-sm text-[#0a4f8f] hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(8,47,73,0.12)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-800">Reset Password</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>
            {forgotStatus === "sent" ? (
              <div className="p-5 space-y-4">
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                  Reset link sent. Check your inbox (and spam folder).
                </p>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setForgotStatus("idle"); }}
                  className="w-full rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Back to Sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="p-5">
                <div className="grid gap-4">
                  <label>
                    <div className="mb-1.5 text-sm font-semibold text-slate-700">Email</div>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="your@email.com"
                      autoComplete="email"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
                    />
                  </label>

                  {forgotStatus === "error" && (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {forgotError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={forgotStatus === "sending"}
                    className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460] disabled:opacity-60"
                  >
                    {forgotStatus === "sending" ? "Sending…" : "Send Reset Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="text-center text-sm text-slate-500 hover:underline"
                  >
                    Back to Sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          This portal provides read-only access. Contact your administrator to request changes.
        </p>
      </div>
    </div>
  );
}
