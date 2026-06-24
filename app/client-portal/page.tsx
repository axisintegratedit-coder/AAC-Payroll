"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronLeft, ChevronRight, FileText, Users, WalletCards } from "lucide-react";
import { getClientPortalSessionAsync } from "./lib/auth";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";
import { getConfigItem, getCollectionItems, getDataArray } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type Employee = {
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  archived?: boolean;
  department?: string;
  employmentStatus?: string;
  dateOfBirth?: string;
  birthday?: string;
  birthDate?: string;
  birthdate?: string;
};

type PayrollRecord = {
  id?: string;
  payrollReference?: string;
  netPay?: number | string;
  adjustedNetPay?: number | string;
  month?: string;
  year?: string;
  payrollDate?: string;
  payrollPeriod?: string;
  bulkRunId?: string;
  createdAt?: string;
};

type PayrollRunApproval = {
  status?: string;
};

type Announcement = {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  pinned: boolean;
  createdAt: string;
  expiryDate?: string;
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: "Holiday" | "Payroll" | "Company Event" | "Training" | "Deadline" | "Birthday" | "Anniversary";
  description?: string;
};

const DEFAULT_PH_HOLIDAYS_2026: CalendarEvent[] = [
  { id: "HOL-2026-01-01", title: "New Year's Day", date: "2026-01-01", type: "Holiday" },
  { id: "HOL-2026-04-09", title: "Araw ng Kagitingan", date: "2026-04-09", type: "Holiday" },
  { id: "HOL-2026-05-01", title: "Labor Day", date: "2026-05-01", type: "Holiday" },
  { id: "HOL-2026-06-12", title: "Independence Day", date: "2026-06-12", type: "Holiday" },
  { id: "HOL-2026-08-31", title: "National Heroes Day", date: "2026-08-31", type: "Holiday" },
  { id: "HOL-2026-11-30", title: "Bonifacio Day", date: "2026-11-30", type: "Holiday" },
  { id: "HOL-2026-12-25", title: "Christmas Day", date: "2026-12-25", type: "Holiday" },
  { id: "HOL-2026-12-30", title: "Rizal Day", date: "2026-12-30", type: "Holiday" },
];

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodayKey() {
  return getLocalDateKey(new Date());
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function getYearMonthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getYearMonthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function getMonthLabel(d: Date) {
  return d.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
}

function getRecurringDateForYear(dateValue: string | undefined, year: number) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getEmployeeName(e: Employee) {
  if (e.employeeName) return e.employeeName;
  const last = String(e.lastName || "").trim();
  const given = [e.firstName, e.middleName].map((n) => String(n || "").trim()).filter(Boolean).join(" ");
  if (last && given) return `${last}, ${given}`;
  return last || given || e.employeeNo || e.employeeId || "Employee";
}

function getEmployeeBirthday(e: Employee) {
  return e.birthdate || e.dateOfBirth || e.birthday || e.birthDate || "";
}

function hashPayrollRunKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildPayrollRunIdentity(groupKey: string, recs: PayrollRecord[]) {
  const src = recs.map((r) => `${r.id || ""}:${r.createdAt || ""}`).sort().join("|");
  return `${groupKey}-${hashPayrollRunKey(src || groupKey)}`;
}

function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[₱,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function peso(v: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(v || 0);
}

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

const CATEGORY_COLORS: Record<string, string> = {
  Urgent: "border-rose-200 bg-rose-50 text-rose-700",
  "HR Memo": "border-violet-200 bg-violet-50 text-violet-700",
  Payroll: "border-blue-200 bg-blue-50 text-blue-700",
  Holiday: "border-amber-200 bg-amber-50 text-amber-700",
  General: "border-slate-200 bg-slate-100 text-slate-600",
};

const eventDotColor: Record<string, string> = {
  Birthday: "#f9a8d4",
  Holiday: "#fca5a5",
  Payroll: "#bfdbfe",
  "Company Event": "#99f6e4",
  Training: "#c7d2fe",
  Deadline: "#fde68a",
  Anniversary: "#ddd6fe",
};

const eventTypeLabel: Record<string, string> = {
  Birthday: "Birthday",
  Holiday: "Holiday",
  Payroll: "Payroll date",
  "Company Event": "Company event",
  Training: "Training",
  Deadline: "Compliance deadline",
  Anniversary: "Work anniversary",
};

export default function ClientPortalHomePage() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [approvals, setApprovals] = useState<Record<string, PayrollRunApproval>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(DEFAULT_PH_HOLIDAYS_2026);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) {
        router.replace("/client-portal/login");
        return;
      }

      const [themeRaw, emps, recs, approvals, announcements, events] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getCollectionItems<Employee>(storageKeys.employees),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getConfigItem<Record<string, PayrollRunApproval>>(storageKeys.payrollRunApprovals, {}),
        getDataArray<Announcement>(storageKeys.homeAnnouncements, []),
        getDataArray<CalendarEvent>(storageKeys.homeCalendarEvents, DEFAULT_PH_HOLIDAYS_2026),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setEmployees(emps);
      setRecords(recs);
      setApprovals(approvals);
      setAnnouncements(announcements);
      setCalendarEvents(events);
    }
    load();
  }, [router]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => !e.archived),
    [employees]
  );

  const payrollRuns = useMemo(() => {
    const groups = new Map<string, PayrollRecord[]>();
    for (const r of records) {
      const period = (r.payrollPeriod || "Monthly Payroll").trim();
      const key = `${r.year || ""}-${r.month || ""}-${period}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries()).map(([key, recs]) => ({
      key,
      id: buildPayrollRunIdentity(key, recs),
      records: recs,
      net: recs.reduce(
        (s, r) => s + money(r.adjustedNetPay ?? r.netPay),
        0
      ),
    }));
  }, [records]);

  const approvedRuns = payrollRuns.filter(
    (g) =>
      approvals[g.id]?.status === "Approved" ||
      approvals[g.id]?.status === "Locked"
  ).length;
  const pendingRuns = payrollRuns.length - approvedRuns;
  const latestRun = payrollRuns[payrollRuns.length - 1];

  const visibleAnnouncements = useMemo(
    () =>
      announcements
        .filter((a) => {
          if (a.expiryDate && new Date(a.expiryDate) < new Date()) return false;
          return true;
        })
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, 6),
    [announcements]
  );

  // Calendar logic
  const calDays = useMemo(() => getCalendarDays(calMonth), [calMonth]);

  const calEventMap = useMemo(() => {
    const year = calMonth.getFullYear();
    const map = new Map<string, Array<{ type: string; label: string; description?: string }>>();
    function addEntry(dateKey: string, type: string, label: string, description?: string) {
      if (!dateKey) return;
      const arr = map.get(dateKey) || [];
      map.set(dateKey, [...arr, { type, label, description }]);
    }
    activeEmployees.forEach((e) => {
      const bKey = getRecurringDateForYear(getEmployeeBirthday(e), year);
      if (bKey) addEntry(bKey, "Birthday", getEmployeeName(e));
    });
    calendarEvents.forEach((ev) => addEntry(ev.date, ev.type, ev.title, ev.description));
    return map;
  }, [activeEmployees, calendarEvents, calMonth]);

  const selectedCalendarDetails = useMemo(() => {
    if (!selectedCalendarDate) return null;
    const events = calEventMap.get(selectedCalendarDate) || [];
    if (events.length === 0) return null;
    const selectedDate = new Date(`${selectedCalendarDate}T00:00:00`);
    return {
      dateLabel: selectedDate.toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      events,
    };
  }, [calEventMap, selectedCalendarDate]);

  const upcomingEvents = useMemo(() => {
    const displayedMonthKey = getYearMonthKey(calMonth);
    const today = getTodayKey();
    const isCurrentMonth = displayedMonthKey === getYearMonthKeyFromDateKey(today);
    const rows: Array<{ date: string; type: string; label: string; description?: string }> = [];
    const year = calMonth.getFullYear();
    activeEmployees.forEach((e) => {
      const bKey = getRecurringDateForYear(getEmployeeBirthday(e), year);
      if (
        bKey &&
        getYearMonthKeyFromDateKey(bKey) === displayedMonthKey &&
        (!isCurrentMonth || bKey >= today)
      ) {
        rows.push({ date: bKey, type: "Birthday", label: getEmployeeName(e) });
      }
    });
    calendarEvents.forEach((ev) => {
      if (
        getYearMonthKeyFromDateKey(ev.date) === displayedMonthKey &&
        (!isCurrentMonth || ev.date >= today)
      ) {
        rows.push({ date: ev.date, type: ev.type, label: ev.title, description: ev.description });
      }
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }, [activeEmployees, calendarEvents, calMonth]);

  function changeCalendarMonth(offset: number) {
    setSelectedCalendarDate(null);
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + offset, 1));
  }

  function toggleCalendarDate(dateKey: string, events: Array<{ type: string; label: string; description?: string }>) {
    if (events.length === 0) return;
    setSelectedCalendarDate((cur) => (cur === dateKey ? null : dateKey));
  }

  const bannerStyle: React.CSSProperties = { backgroundColor: theme.bannerColor };

  const quickLinks = [
    { label: "View Employees", href: "/client-portal/employees", icon: Users },
    { label: "Payroll Records", href: "/client-portal/payroll-records", icon: WalletCards },
    { label: "Payslips", href: "/client-portal/reports/payslips", icon: FileText },
    { label: "Reports", href: "/client-portal/reports/coe", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen pg-bg text-[#0b2742]">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{ ...bannerStyle, borderColor: `${theme.accentColor}33` }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: `${theme.accentColor}24`,
                  color: theme.bannerTextColor,
                  border: `0.5px solid ${theme.accentColor}66`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                Client Portal — Read-only View
              </span>
            </div>
            <h1
              className="mt-3 text-2xl font-semibold tracking-tight"
              style={{ color: theme.bannerTextColor }}
            >
              Payroll & HR Overview
            </h1>
            <p className="mt-1 text-sm opacity-85" style={{ color: theme.bannerTextColor }}>
              {activeEmployees.length} active employees · {payrollRuns.length} payroll runs
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex h-9 items-center justify-center gap-1.5 rounded border border-white/20 bg-white/10 px-3 text-xs font-semibold transition hover:bg-white/20"
                style={{ color: theme.bannerButtonTextColor }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div className="flex divide-x divide-slate-200 border-b border-slate-200 bg-white">
        <div className="flex-1 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Active Employees
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {activeEmployees.length}
          </p>
        </div>
        <div className="flex-1 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Latest Payroll Net
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {latestRun ? peso(latestRun.net) : "₱0.00"}
          </p>
        </div>
        <div className="flex-[1.4] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Payroll Runs
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4">
            <p className="text-xl font-bold text-slate-900">
              {approvedRuns}{" "}
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                approved
              </span>
            </p>
            <p className="text-xl font-bold text-slate-900">
              {pendingRuns}{" "}
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                pending
              </span>
            </p>
          </div>
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full"
              style={{
                width: `${payrollRuns.length > 0 ? Math.round((approvedRuns / payrollRuns.length) * 100) : 0}%`,
                background: "var(--axis-blue)",
              }}
            />
            <div
              className="h-full bg-amber-400"
              style={{
                width: `${payrollRuns.length > 0 ? Math.round((pendingRuns / payrollRuns.length) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="flex-1 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Payroll Runs Total
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {payrollRuns.length}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_288px]">

          {/* Left column: announcements + departments */}
          <div className="grid gap-6">

            {/* Announcements */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-800">Announcements</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleAnnouncements.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-500">No announcements.</p>
                ) : (
                  visibleAnnouncements.map((a) => (
                    <div key={a.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.General}`}
                        >
                          {a.category}
                        </span>
                        {a.pinned && (
                          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.message}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatDate(a.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Departments summary */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-800">Employees by Department</h2>
              </div>
              <div className="p-5">
                {(() => {
                  const deptCounts = new Map<string, number>();
                  for (const e of activeEmployees) {
                    const d = e.department || "Unassigned";
                    deptCounts.set(d, (deptCounts.get(d) || 0) + 1);
                  }
                  const entries = Array.from(deptCounts.entries()).sort((a, b) => b[1] - a[1]);
                  if (entries.length === 0)
                    return <p className="text-sm text-slate-500">No employees found.</p>;
                  return (
                    <div className="grid gap-2">
                      {entries.map(([dept, count]) => (
                        <div key={dept} className="flex items-center gap-3">
                          <div className="min-w-[140px] text-sm font-semibold text-slate-700">{dept}</div>
                          <div className="flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${Math.round((count / activeEmployees.length) * 100)}%`,
                                background: "linear-gradient(90deg, var(--axis-navy), var(--axis-cyan))",
                              }}
                            />
                          </div>
                          <span className="w-8 text-right text-sm font-bold text-slate-700">{count}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="border-t border-slate-100 px-5 py-3">
                <Link
                  href="/client-portal/employees"
                  className="text-xs font-semibold text-[var(--theme-accent)] hover:underline"
                >
                  View all employees →
                </Link>
              </div>
            </div>
          </div>

          {/* Right column: Calendar */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm self-start">
            {/* Calendar header */}
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">{getMonthLabel(calMonth)}</h2>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(-1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeCalendarMonth(1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="grid grid-cols-7 gap-y-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-semibold uppercase text-slate-400">
                    {d}
                  </div>
                ))}
                {calDays.map((day) => {
                  const key = getLocalDateKey(day);
                  const isCurrentMonth = getYearMonthKey(day) === getYearMonthKey(calMonth);
                  const isToday = key === getTodayKey();
                  const events = calEventMap.get(key) || [];
                  const hasPayroll = events.some((e) => e.type === "Payroll");
                  const hasClickableInfo = events.length > 0;
                  const isSelected = selectedCalendarDate === key;
                  const eventDots = Array.from(new Set(events.map((e) => e.type))).slice(0, 4);

                  return (
                    <div key={key} className="relative flex flex-col items-center py-0.5">
                      <button
                        type="button"
                        onClick={() => toggleCalendarDate(key, events)}
                        disabled={!hasClickableInfo}
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium outline-none transition ${
                          hasClickableInfo ? "cursor-pointer hover:ring-2 hover:ring-sky-100" : "cursor-default"
                        } ${isSelected ? "ring-2 ring-cyan-300 ring-offset-2" : ""}`}
                        style={{
                          background: isToday ? "var(--axis-navy)" : hasPayroll ? "#dbeafe" : "transparent",
                          color: isToday ? "white" : isCurrentMonth ? "#1e293b" : "#cbd5e1",
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {day.getDate()}
                      </button>
                      <div className="flex gap-px pt-0.5">
                        {eventDots.map((type) => (
                          <span
                            key={type}
                            className="h-1 w-1 rounded-full"
                            style={{ background: eventDotColor[type] || "#e2e8f0" }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedCalendarDetails && (
                <div className="mt-3 rounded border border-sky-100 bg-sky-50 px-3 py-3 shadow-[0_12px_28px_-24px_rgba(8,47,73,0.8)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0a4f8f]">
                    Selected date
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {selectedCalendarDetails.dateLabel}
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedCalendarDetails.events.map((event, index) => {
                      const dot = eventDotColor[event.type] || "#e2e8f0";
                      const typeLabel = eventTypeLabel[event.type] || event.type;
                      return (
                        <div key={`${event.type}-${event.label}-${index}`} className="flex items-start gap-2">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-5 text-slate-700">{event.label}</p>
                            <p className="text-xs font-medium text-slate-500">{typeLabel}</p>
                            {event.description && (
                              <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Legend</p>
              <div className="mt-2 space-y-1.5">
                {[
                  { dot: "var(--axis-navy)", label: "Today", fill: true },
                  { dot: "#dbeafe", label: "Payroll date", fill: true },
                  { dot: "#f9a8d4", label: "Birthday" },
                  { dot: "#fca5a5", label: "Holiday" },
                  { dot: "#99f6e4", label: "Company event" },
                ].map(({ dot, label, fill }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: dot, border: fill ? "none" : "1px solid #e2e8f0" }}
                    />
                    <span className="text-xs text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming events */}
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">Upcoming Events This Month</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{getMonthLabel(calMonth)}</p>
              {upcomingEvents.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">No upcoming events this month.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {upcomingEvents.map((ev, i) => {
                    const d = new Date(`${ev.date}T00:00:00`);
                    const dot = eventDotColor[ev.type] || "#e2e8f0";
                    const typeLabel = eventTypeLabel[ev.type] || ev.type;
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="shrink-0 text-center">
                          <p className="text-sm font-bold leading-none text-slate-800">{d.getDate()}</p>
                          <p className="text-[10px] uppercase text-slate-400">
                            {d.toLocaleDateString("en-PH", { month: "short" })}
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-1 items-start gap-1.5 pt-0.5">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">{ev.label}</p>
                            <p className="text-xs text-slate-400">{typeLabel}</p>
                            {ev.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Payroll Runs — full width */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Recent Payroll Runs</h2>
            <Link
              href="/client-portal/payroll-records"
              className="text-xs font-semibold text-[var(--theme-accent)] hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Run
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employees
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total Net Pay
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollRuns.slice(-8).reverse().map((g) => {
                  const sample = g.records[0];
                  const label =
                    [sample?.month, sample?.year, sample?.payrollPeriod]
                      .filter(Boolean)
                      .join(" ") || g.key;
                  const status = approvals[g.id]?.status || "Draft";
                  return (
                    <tr key={g.key} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-800">{label}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{g.records.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{peso(g.net)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${
                            status === "Approved" || status === "Locked"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : status === "For Review" || status === "Checked"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {payrollRuns.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                      No payroll runs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
