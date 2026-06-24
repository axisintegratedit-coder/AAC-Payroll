"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ClipboardList,
  Home,
  Image as ImageIcon,
  KeyRound,
  Palette,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  getClientPortalSession,
  getClientPortalSessionAsync,
  logoutClientPortal,
  onClientPortalAuthStateChanged,
} from "../lib/auth";
import {
  applyAppTheme,
  BANNER_IMAGE_RECOMMENDED_SIZE,
  DEFAULT_APP_THEME,
  isHexColor,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";
import { getConfigItem, setConfigItem, uploadBannerImage, deleteBannerImage } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

const LOGIN_PATH = "/client-portal/login";

const BASIC_TEXT_COLORS = [
  "#ffffff", "#f8fafc", "#111827", "#0b2742", "#1f2937",
  "#475569", "#7f1d1d", "#713f12", "#14532d", "#164e63",
  "#1e3a8a", "#581c87",
];

type SubItem = { label: string; href: string };
type NavItem = {
  label: string;
  href?: string;
  subItems?: SubItem[];
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/client-portal", icon: Home },
  {
    label: "Employees",
    icon: Users,
    subItems: [{ label: "View Employees", href: "/client-portal/employees" }],
  },
  {
    label: "Payroll Runs",
    icon: WalletCards,
    subItems: [
      { label: "Payroll Records", href: "/client-portal/payroll-records" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    subItems: [
      { label: "Certificates of Employment", href: "/client-portal/reports/coe" },
      { label: "Payslips", href: "/client-portal/reports/payslips" },
      { label: "Tax Info on 1601-C", href: "/client-portal/reports/1601c" },
      { label: "Tax Info on 1604-C", href: "/client-portal/reports/1604c" },
      { label: "Alphalist", href: "/client-portal/reports/alphalist" },
    ],
  },
  { label: "Audit Log", href: "/client-portal/audit-log", icon: ClipboardList },
];

export default function ClientPortalNav() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [themeImageError, setThemeImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Load theme from Firestore
  useEffect(() => {
    async function load() {
      const t = normalizeTheme(
        await getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME)
      );
      setTheme(t);
      applyAppTheme(t);
    }
    load();
    window.addEventListener(`${storageKeys.clientPortalTheme}-updated`, load as EventListener);
    return () =>
      window.removeEventListener(`${storageKeys.clientPortalTheme}-updated`, load as EventListener);
  }, []);

  // Client portal auth guard
  useEffect(() => {
    if (pathname === LOGIN_PATH) return;
    let cancelled = false;

    async function guardClientRoute() {
      const session = await getClientPortalSessionAsync();
      if (!cancelled && !session) {
        router.replace(LOGIN_PATH);
      }
    }

    guardClientRoute();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Firebase definitive auth guard
  useEffect(() => {
    if (pathname === LOGIN_PATH) return;
    const unsubscribe = onClientPortalAuthStateChanged((user) => {
      if (!user && getClientPortalSession()) {
        logoutClientPortal().then(() => router.replace(LOGIN_PATH));
      }
    });
    return unsubscribe;
  }, [pathname, router]);

  if (pathname === LOGIN_PATH) return null;

  // ── Theme helpers ─────────────────────────────────────────────────────────

  const activeTheme = normalizeTheme(theme);

  async function saveTheme(next: AppTheme) {
    const normalized = normalizeTheme(next);
    setTheme(normalized);
    applyAppTheme(normalized);
    await setConfigItem(storageKeys.clientPortalTheme, normalized);
  }

  function updateThemeColor(
    key: "topNavColor" | "bannerColor" | "accentColor" | "topNavTextColor" | "bannerTextColor" | "bannerButtonTextColor",
    value: string
  ) {
    const next = { ...theme, [key]: value };
    setTheme(next);
    if (isHexColor(value)) saveTheme(next);
  }

  function updateBannerOverlayOpacity(value: number) {
    saveTheme({ ...theme, bannerOverlayOpacity: Math.min(100, Math.max(0, value)) });
  }

  function updatePageOverlayOpacity(value: number) {
    saveTheme({ ...theme, pageOverlayOpacity: Math.min(100, Math.max(0, value)) });
  }

  function handleBannerImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setThemeImageError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setThemeImageError("Please select an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setThemeImageError("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = String(ev.target?.result || "");
      try {
        const url = await uploadBannerImage("client-banner", dataUrl);
        await saveTheme({ ...theme, bannerImageDataUrl: url });
      } catch {
        setThemeImageError("Failed to upload image. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  }

  function resetTheme() {
    if (!window.confirm("Reset the client portal theme to defaults?")) return;
    saveTheme(DEFAULT_APP_THEME);
    setThemeImageError("");
  }

  // ── Nav helpers ───────────────────────────────────────────────────────────

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/client-portal" && pathname.startsWith(href + "/"))
    );
  }

  function isItemActive(item: NavItem) {
    if (item.href) return isActive(item.href);
    return item.subItems?.some((s) => isActive(s.href)) ?? false;
  }

  function handleLogout() {
    logoutClientPortal().then(() => router.replace(LOGIN_PATH));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full border-b shadow-[0_20px_55px_-38px_rgba(14,165,233,0.75)] backdrop-blur-xl"
        style={{
          backgroundColor: `${theme.topNavColor}f2`,
          borderColor: `${theme.accentColor}33`,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--theme-accent)] to-transparent" />

        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Logo */}
          <Link href="/client-portal" className="group flex min-w-0 items-center gap-3">
            <div
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border bg-white shadow-[0_18px_35px_-22px_rgba(56,189,248,0.75)] transition group-hover:-translate-y-0.5"
              style={{ borderColor: `${theme.accentColor}55` }}
            >
              <Image
                src="/axis-logo-topnav.png"
                alt="Axis Payroll System"
                fill
                sizes="48px"
                className="object-cover"
                priority
              />
            </div>
            <div className="hidden min-w-0 leading-tight sm:block">
              <h1
                className="truncate text-base font-semibold tracking-tight"
                style={{ color: theme.topNavTextColor }}
              >
                Axis Payroll System
              </h1>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: theme.accentColor }}
              >
                Client Portal
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Navigation */}
            <nav className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.08] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_35px_-32px_rgba(56,189,248,0.75)]">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item);
                return (
                  <div
                    key={item.label}
                    className="relative -mb-2 pb-2"
                    onMouseEnter={() => item.subItems && setOpenDropdown(item.label)}
                    onMouseLeave={() => item.subItems && setOpenDropdown(null)}
                    onFocus={() => item.subItems && setOpenDropdown(item.label)}
                  >
                    {item.subItems ? (
                      <>
                        <button
                          type="button"
                          className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                            openDropdown === item.label || active
                              ? "bg-white text-[#0b2742] shadow-[0_14px_28px_-22px_rgba(56,189,248,0.85)]"
                              : "hover:bg-white/10"
                          }`}
                          style={
                            openDropdown === item.label || active
                              ? undefined
                              : { color: theme.topNavTextColor }
                          }
                        >
                          <Icon
                            className={`h-4 w-4 ${openDropdown === item.label || active ? "" : "text-cyan-200"}`}
                            style={
                              openDropdown === item.label || active
                                ? { color: theme.accentColor }
                                : undefined
                            }
                          />
                          <span className="whitespace-nowrap">{item.label}</span>
                          <ChevronDown
                            size={16}
                            className={`transition ${openDropdown === item.label ? "rotate-180" : ""}`}
                          />
                        </button>

                        {openDropdown === item.label && (
                          <div className="absolute left-0 top-full z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.98] p-2 shadow-[0_28px_70px_-36px_rgba(8,47,73,0.85)] ring-1 ring-slate-900/[0.04] backdrop-blur">
                            <div className="border-b border-slate-100 px-3 py-2">
                              <p
                                className="text-xs font-semibold uppercase tracking-[0.16em]"
                                style={{ color: theme.accentColor }}
                              >
                                {item.label}
                              </p>
                            </div>
                            <div className="mt-2 grid gap-1">
                              {item.subItems.map((sub) => {
                                const subActive = isActive(sub.href);
                                return (
                                  <Link
                                    key={sub.label}
                                    href={sub.href}
                                    className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                                      subActive
                                        ? "bg-sky-50 text-[var(--theme-accent)]"
                                        : "text-slate-700 hover:bg-sky-50 hover:text-[var(--theme-accent)]"
                                    }`}
                                  >
                                    <span>{sub.label}</span>
                                    <span
                                      className={`h-2 w-2 rounded-full bg-[var(--theme-accent)] transition ${subActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                    />
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href || "#"}
                        className={`flex min-h-10 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                          active
                            ? "bg-white text-[#0b2742] shadow-[0_14px_28px_-22px_rgba(56,189,248,0.85)]"
                            : "hover:bg-white/10"
                        }`}
                        style={active ? undefined : { color: theme.topNavTextColor }}
                      >
                        <Icon
                          className={`h-4 w-4 ${active ? "" : "text-cyan-200"}`}
                          style={active ? { color: theme.accentColor } : undefined}
                        />
                        <span className="whitespace-nowrap">{item.label}</span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Read-only badge + settings + logout */}
            <span
              className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold sm:inline"
              style={{ color: theme.topNavTextColor }}
            >
              Read-only View
            </span>
            <Link
              href="/client-portal/settings"
              className={`flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold transition hover:bg-white/20 ${pathname === "/client-portal/settings" ? "bg-white/20" : ""}`}
              style={{ color: theme.topNavTextColor }}
              title="User Settings"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold transition hover:bg-white/20"
              style={{ color: theme.topNavTextColor }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Theme panel ──────────────────────────────────────────────────── */}
      {showThemePanel && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[min(340px,calc(100vw-48px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-800">Theme</p>
              <p className="text-[11px] text-slate-500">Client portal colors and background.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowThemePanel(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close theme customizer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-[68vh] space-y-3 overflow-y-auto p-3">
            {/* Color pickers */}
            {([
              ["topNavColor", "Top nav"],
              ["bannerColor", "Banner"],
              ["accentColor", "Accent"],
            ] as const).map(([key, label]) => {
              const value = theme[key];
              const valid = isHexColor(value);
              return (
                <label key={key} className="grid grid-cols-[82px_28px_1fr] items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                  <span className="relative h-7 w-7 overflow-hidden rounded-md border border-slate-200 bg-white">
                    <input
                      type="color"
                      value={valid ? value : activeTheme[key]}
                      onChange={(e) => updateThemeColor(key, e.target.value)}
                      className="absolute -inset-1 h-9 w-9 cursor-pointer"
                      aria-label={`${label} color picker`}
                    />
                  </span>
                  <input
                    value={value}
                    onChange={(e) => updateThemeColor(key, e.target.value)}
                    className={`h-8 w-full rounded-md border bg-white px-2 font-mono text-xs uppercase text-slate-800 outline-none focus:border-[var(--axis-blue)] focus:ring-1 focus:ring-[var(--axis-blue)] ${valid ? "border-slate-300" : "border-rose-300"}`}
                    placeholder="#323423"
                  />
                  {!valid && <span className="col-span-3 text-[11px] text-rose-600">Use a 6-digit hex code.</span>}
                </label>
              );
            })}

            {/* Text color swatches */}
            {([
              ["topNavTextColor", "Top nav text"],
              ["bannerTextColor", "Banner text"],
              ["bannerButtonTextColor", "Button text"],
            ] as const).map(([key, label]) => {
              const value = theme[key];
              const valid = isHexColor(value);
              return (
                <div key={key} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                    <div className="flex gap-1">
                      {BASIC_TEXT_COLORS.map((color) => (
                        <button
                          key={`${key}-${color}`}
                          type="button"
                          onClick={() => updateThemeColor(key, color)}
                          aria-label={`${label} ${color}`}
                          className={`h-4 w-4 rounded-full border transition hover:scale-110 ${
                            value.toLowerCase() === color.toLowerCase()
                              ? "border-slate-900 ring-2 ring-slate-300"
                              : "border-slate-200"
                          }`}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[28px_1fr] gap-2">
                    <span className="relative h-7 w-7 overflow-hidden rounded-md border border-slate-200 bg-white">
                      <input
                        type="color"
                        value={valid ? value : activeTheme[key]}
                        onChange={(e) => updateThemeColor(key, e.target.value)}
                        className="absolute -inset-1 h-9 w-9 cursor-pointer"
                        aria-label={`${label} color picker`}
                      />
                    </span>
                    <input
                      value={value}
                      onChange={(e) => updateThemeColor(key, e.target.value)}
                      className={`h-8 rounded-md border bg-white px-2 font-mono text-xs uppercase text-slate-800 outline-none focus:border-[var(--axis-blue)] focus:ring-1 focus:ring-[var(--axis-blue)] ${valid ? "border-slate-300" : "border-rose-300"}`}
                      placeholder="#ffffff"
                    />
                  </div>
                  {!valid && <span className="text-[11px] text-rose-600">Use a 6-digit hex code.</span>}
                </div>
              );
            })}

            {/* Background photo */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Background photo</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Applied as full-page background and banner. Best fit: {BANNER_IMAGE_RECOMMENDED_SIZE}.
              </p>
              {theme.bannerImageDataUrl && (
                <div className="mt-2 h-14 overflow-hidden rounded-md border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={theme.bannerImageDataUrl} alt="Background photo preview" className="h-full w-full object-cover" />
                </div>
              )}
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{theme.bannerImageDataUrl ? "Replace photo" : "Upload background photo"}</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleBannerImageUpload} />
              </label>
              {themeImageError && <p className="mt-1.5 text-[11px] text-rose-600">{themeImageError}</p>}
              {theme.bannerImageDataUrl && (
                <>
                  <label className="mt-3 grid gap-1.5">
                    <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Banner Overlay Opacity
                      <span className="font-mono text-slate-600">{activeTheme.bannerOverlayOpacity}%</span>
                    </span>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={activeTheme.bannerOverlayOpacity}
                      onChange={(e) => updateBannerOverlayOpacity(Number(e.target.value))}
                      className="w-full accent-[var(--theme-accent)]"
                    />
                  </label>
                  <label className="mt-2 grid gap-1.5">
                    <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Page Color Overlay
                      <span className="font-mono text-slate-600">{activeTheme.pageOverlayOpacity}%</span>
                    </span>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={activeTheme.pageOverlayOpacity}
                      onChange={(e) => updatePageOverlayOpacity(Number(e.target.value))}
                      className="w-full accent-[var(--theme-accent)]"
                    />
                    <span className="text-[10px] leading-4 text-slate-400">Higher = more color, less photo visible</span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => { await deleteBannerImage("client-banner"); await saveTheme({ ...theme, bannerImageDataUrl: "" }); }}
                    className="mt-2 text-[11px] font-semibold text-slate-500 underline hover:text-slate-800"
                  >
                    Remove photo
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
              <div className="flex items-center gap-2">
                {[activeTheme.topNavColor, activeTheme.bannerColor, activeTheme.accentColor,
                  activeTheme.topNavTextColor, activeTheme.bannerTextColor, activeTheme.bannerButtonTextColor
                ].map((c, i) => (
                  <span key={i} className="h-4 w-4 rounded-full border border-slate-200" style={{ background: c }} />
                ))}
              </div>
              <button
                type="button"
                onClick={resetTheme}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Reset default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Palette FAB */}
      <button
        type="button"
        onClick={() => setShowThemePanel((open) => !open)}
        title="Customize colors and background"
        aria-expanded={showThemePanel}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        style={{ background: showThemePanel ? activeTheme.accentColor : activeTheme.topNavColor }}
      >
        <Palette className="h-5 w-5" />
      </button>
    </>
  );
}
