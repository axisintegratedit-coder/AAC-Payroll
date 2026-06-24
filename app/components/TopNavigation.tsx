"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  Home,
  Settings,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { canAccessAdminPageAsync } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { getConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type SubItem = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href?: string;
  subItems?: SubItem[];
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Employees",
    icon: Users,
    subItems: [
      { label: "Add employee", href: "/add-employee" },
      { label: "View employees", href: "/employees" },
    ],
  },
  {
    label: "Payroll Runs",
    icon: WalletCards,
    subItems: [
      { label: "Add Payroll", href: "/add-payroll" },
      { label: "Payroll records", href: "/payroll-records" },
      { label: "Year-End Tax Annualization", href: "/year-end-tax-annualization" },
      { label: "Leave Management", href: "/leave-management" },
      { label: "Loan Monitoring", href: "/loan-monitoring" },
      { label: "Standing Allowances", href: "/standing-allowances" },
      { label: "De Minimis", href: "/de-minimis" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    subItems: [
      { label: "Certificates of Employment", href: "/reports/certificates-of-employment" },
      { label: "Payslips", href: "/reports/payslips" },
      { label: "Tax Info on 1601-C", href: "/reports/1601-c" },
      { label: "Tax Info on 1604-C", href: "/reports/1604-c" },
      { label: "Alphalist", href: "/reports/alphalist" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    subItems: [
      { label: "User Settings", href: "/user-settings" },
      { label: "Company Settings", href: "/company" },
      { label: "Payroll Settings", href: "/payroll-settings" },
      { label: "Audit Log", href: "/audit-log" },
    ],
  },
];

const publicRoutes = ["/login", "/pending-approval", "/unauthorized", "/employee-portal", "/client-portal"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function isNavItemActive(pathname: string, item: NavItem) {
  if (item.href && isRouteActive(pathname, item.href)) return true;
  return item.subItems?.some((sub) => isRouteActive(pathname, sub.href)) || false;
}

export default function TopNavigation() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const router = useRouter();
  const pathname = usePathname();

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

  useEffect(() => {
    if (isPublicRoute(pathname)) return;
    let cancelled = false;

    async function guardAdminRoute() {
      const access = await canAccessAdminPageAsync(["Owner", "Super User", "HR Admin", "Payroll Admin"]);

      if (!cancelled && !access.allowed) {
        router.replace(access.redirectTo);
      }
    }

    guardAdminRoute();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (isPublicRoute(pathname)) {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-40 w-full border-b shadow-[0_20px_55px_-38px_rgba(14,165,233,0.75)] backdrop-blur-xl"
      style={{ backgroundColor: `${theme.topNavColor}f2`, borderColor: `${theme.accentColor}33` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--theme-accent)] to-transparent" />
      <div className="flex items-center justify-between gap-5 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div
            className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border bg-white shadow-[0_18px_35px_-22px_rgba(56,189,248,0.75)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_24px_45px_-26px_rgba(56,189,248,0.85)]"
            style={{ borderColor: `${theme.accentColor}55` }}
          >
            <Image
              src="/axis-logo-topnav.png"
              alt="AXIS Integrated IT Solutions logo"
              fill
              sizes="48px"
              className="object-cover"
              priority
            />
          </div>
          <div className="hidden min-w-0 leading-tight sm:block">
            <h1 className="truncate text-base font-semibold tracking-tight" style={{ color: theme.topNavTextColor }}>
              Axis Payroll System
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.accentColor }}>
              Business Operations
            </p>
          </div>
        </Link>

        <nav className="flex max-w-full flex-wrap items-center justify-end gap-1 rounded-2xl border border-white/10 bg-white/[0.08] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_35px_-32px_rgba(56,189,248,0.75)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);

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
                      style={openDropdown === item.label || active ? undefined : { color: theme.topNavTextColor }}
                    >
                      <Icon className={`h-4 w-4 ${openDropdown === item.label || active ? "" : "text-cyan-200"}`} aria-hidden="true" style={openDropdown === item.label || active ? { color: theme.accentColor } : undefined} />
                      <span className="whitespace-nowrap">{item.label}</span>
                      <ChevronDown size={16} className={`transition ${openDropdown === item.label ? "rotate-180" : ""}`} />
                    </button>

                    {openDropdown === item.label && (
                      <div className="absolute left-0 top-full z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.98] p-2 shadow-[0_28px_70px_-36px_rgba(8,47,73,0.85)] ring-1 ring-slate-900/[0.04] backdrop-blur">
                        <div className="border-b border-slate-100 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accentColor }}>{item.label}</p>
                        </div>
                        <div className="mt-2 grid gap-1">
                          {item.subItems.map((sub) => {
                            const subActive = isRouteActive(pathname, sub.href);

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
                                <span className={`h-2 w-2 rounded-full bg-[var(--theme-accent)] transition ${subActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
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
                    <Icon className={`h-4 w-4 ${active ? "" : "text-cyan-200"}`} aria-hidden="true" style={active ? { color: theme.accentColor } : undefined} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
