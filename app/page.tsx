"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Palette,
  Paperclip,
  Plus,
  Settings,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, setConfigItem, getDataArray, setDataArray, getCollectionItems, uploadBannerImage, deleteBannerImage } from "@/lib/firestore";
import { canAccessAdminPageAsync } from "@/lib/adminAuth";
import {
  applyAppTheme,
  BANNER_IMAGE_RECOMMENDED_SIZE,
  DEFAULT_APP_THEME,
  isHexColor,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";

type Employee = {
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  department?: string;
  jobTitle?: string;
  dateOfBirth?: string;
  birthday?: string;
  birthDate?: string;
  birthdate?: string;
  hireDate?: string;
  regularizationDate?: string;
  tin?: string;
  sss?: string;
  sssNumber?: string;
  sssNo?: string;
  philhealth?: string;
  philhealthNumber?: string;
  philhealthNo?: string;
  pagibig?: string;
  pagibigNumber?: string;
  pagibigNo?: string;
  hdmfNo?: string;
  employmentStatus?: string;
  archived?: boolean;
};

type Announcement = {
  id: string;
  title: string;
  message: string;
  category: "General" | "Payroll" | "HR Memo" | "Holiday" | "Urgent";
  priority: "Normal" | "Important" | "Urgent";
  audience: string;
  pinned: boolean;
  photos?: string[];
  attachmentName?: string;
  postedBy?: string;
  createdAt: string;
  expiryDate?: string;
};

type PayrollRecord = {
  id?: string;
  employeeNo?: string;
  employeeName?: string;
  jobTitle?: string;
  department?: string;
  payrollReference?: string;
  payrollPeriod?: string;
  monthYear?: string;
  bulkRunId?: string;
  createdAt?: string;
  payrollDate?: string;
  payDate?: string;
  payoutDate?: string;
  datePaid?: string;
  month?: string;
  year?: string;
  adjustedNetPay?: number;
  netPay?: number;
  grossPay?: number;
  status?: string;
};

type PayrollRunApproval = {
  status?: "Draft" | "For Review" | "Checked" | "Approved" | "Locked" | "Returned for Revision" | string;
  approvedAt?: string;
  checkedAt?: string;
  preparedAt?: string;
  lockedAt?: string;
  returnedAt?: string;
};

type PayrollRunSummary = {
  id: string;
  title: string;
  month: string;
  year: string;
  payrollPeriod: string;
  payrollDate: string;
  createdAt: string;
  records: PayrollRecord[];
  employeesCount: number;
  netPay: number;
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

const PAYROLL_STATUS_STEPS = [
  { label: "Draft", key: "draft", description: "Payroll records created & being prepared" },
  { label: "For Checking", key: "checking", description: "Records under review before final approval" },
  { label: "Approved", key: "approved", description: "Payroll signed off and ready for release" },
];

const CALENDAR_EVENT_TYPES: CalendarEvent["type"][] = [
  "Company Event",
  "Holiday",
  "Birthday",
  "Payroll",
  "Training",
  "Deadline",
  "Anniversary",
];

const BASIC_TEXT_COLORS = [
  "#ffffff",
  "#f8fafc",
  "#111827",
  "#0b2742",
  "#1f2937",
  "#475569",
  "#7f1d1d",
  "#713f12",
  "#14532d",
  "#164e63",
  "#1e3a8a",
  "#581c87",
];

function money(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[₱,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function peso(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}


function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getTodayKey() {
  return getLocalDateKey(new Date());
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hashPayrollRunKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildPayrollRunIdentity(groupKey: string, records: PayrollRecord[]) {
  const identitySource = records
    .map((record) => `${record.id || ""}:${record.createdAt || ""}`)
    .sort()
    .join("|");

  return `${groupKey}-${hashPayrollRunKey(identitySource || groupKey)}`;
}

function getPayrollRunGroupKey(record: PayrollRecord) {
  const payrollPeriod = normalizeString(record.payrollPeriod || record.payrollReference) || "Monthly Payroll";
  const monthYear = normalizeString(record.monthYear);
  const [monthYearPartOne, monthYearPartTwo] = monthYear.includes("-")
    ? monthYear.split("-")
    : monthYear.split(" ");
  const yearFromMonthYear = monthYear.includes("-") ? monthYearPartOne : monthYearPartTwo;
  const monthFromMonthYear = monthYear.includes("-")
    ? new Date(Number(monthYearPartOne), Number(monthYearPartTwo) - 1, 1).toLocaleDateString("en-PH", { month: "long" })
    : monthYearPartOne;
  const dateValue = record.payrollDate || record.payDate || record.payoutDate || record.datePaid || "";
  const parsedDate = dateValue ? new Date(dateValue) : null;
  const monthFromDate = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleDateString("en-PH", { month: "long" })
    : "";
  const yearFromDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? String(parsedDate.getFullYear()) : "";
  const month = normalizeString(record.month || monthFromMonthYear || monthFromDate) || "Payroll";
  const year = normalizeString(record.year || yearFromMonthYear || yearFromDate);

  return `${year}-${month}-${payrollPeriod}`;
}

function getPayrollRunStatus(run: PayrollRunSummary, approvals: Record<string, PayrollRunApproval>) {
  const approvalStatus = normalizeString(approvals[run.id]?.status).toLowerCase();
  if (approvalStatus) return approvalStatus;

  const recordStatus = run.records
    .map((record) => normalizeString(record.status).toLowerCase())
    .find(Boolean);

  return recordStatus || "draft";
}

function isApprovedPayrollRun(run: PayrollRunSummary, approvals: Record<string, PayrollRunApproval>) {
  const status = getPayrollRunStatus(run, approvals);
  return status === "approved" || status === "locked";
}

function isPendingPayrollRun(run: PayrollRunSummary, approvals: Record<string, PayrollRunApproval>) {
  return !isApprovedPayrollRun(run, approvals) && getPayrollRunStatus(run, approvals) !== "deleted";
}

function getPayrollRunSortValue(run: PayrollRunSummary) {
  const rawDate = run.payrollDate || run.createdAt;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();

  const monthIndex = run.month
    ? new Date(`${run.month} 1, ${run.year || new Date().getFullYear()}`).getMonth()
    : -1;
  const yearNumber = Number(run.year) || 0;
  return yearNumber * 100 + monthIndex;
}

function getPayrollRunDisplayPeriod(run?: PayrollRunSummary) {
  if (!run) return "No saved payroll run";
  const monthYear = [run.month, run.year].filter(Boolean).join(" ");
  return [monthYear, run.payrollPeriod].filter(Boolean).join(" • ") || run.title;
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

function getRecurringDateForYear(dateValue: string | undefined, year: number) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPayPeriod() {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleDateString("en-PH", { month: "long" });
  const year = today.getFullYear();
  if (day <= 15) return `${month} 1–15, ${year}`;
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
  return `${month} 16–${lastDay}, ${year}`;
}

function sssMoney(value: number) {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const SSS_2026_CONTRIBUTION_ROWS = Array.from({ length: 61 }, (_, index) => {
  const totalMsc = 5000 + index * 500;
  const regularMsc = Math.min(totalMsc, 20000);
  const mpfMsc = Math.max(0, totalMsc - 20000);
  const lowerRange = totalMsc - 250;
  const upperRange = totalMsc + 249.99;
  const range =
    index === 0
      ? "Below ₱5,250"
      : index === 60
      ? "₱34,750 and above"
      : `₱${lowerRange.toLocaleString("en-PH")} – ₱${upperRange.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
  const employerRegular = regularMsc * 0.1;
  const employerMpf = mpfMsc * 0.1;
  const ec = totalMsc <= 14500 ? 10 : 30;
  const employeeRegular = regularMsc * 0.05;
  const employeeMpf = mpfMsc * 0.05;

  return {
    range,
    regularMsc,
    mpfMsc,
    totalMsc,
    employerRegular,
    employerMpf,
    ec,
    employerTotal: employerRegular + employerMpf + ec,
    employeeRegular,
    employeeMpf,
    employeeTotal: employeeRegular + employeeMpf,
  };
});



export default function HomePage() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(DEFAULT_PH_HOLIDAYS_2026);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollRunApprovals, setPayrollRunApprovals] = useState<Record<string, PayrollRunApproval>>({});

  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annCategory, setAnnCategory] = useState<Announcement["category"]>("General");
  const [annPriority, setAnnPriority] = useState<Announcement["priority"]>("Normal");
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);

  const [calMonth, setCalMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => getTodayKey());
  const [eventType, setEventType] = useState<CalendarEvent["type"]>("Company Event");
  const [eventDescription, setEventDescription] = useState("");
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [themeImageError, setThemeImageError] = useState("");

  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedStatutoryRates, setExpandedStatutoryRates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadTheme() {
      const savedTheme = normalizeTheme(await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME));
      setTheme(savedTheme);
      applyAppTheme(savedTheme);
    }
    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    };
  }, []);

  function toggleStatutoryRate(key: string) {
    setExpandedStatutoryRates((current) => ({ ...current, [key]: !current[key] }));
  }

  async function saveTheme(nextTheme: AppTheme) {
    const normalizedTheme = normalizeTheme(nextTheme);
    setTheme(normalizedTheme);
    applyAppTheme(normalizedTheme);
    await setConfigItem(storageKeys.appTheme, normalizedTheme);
  }

  function updateThemeColor(
    key:
      | "topNavColor"
      | "bannerColor"
      | "accentColor"
      | "topNavTextColor"
      | "bannerTextColor"
      | "bannerButtonTextColor",
    value: string
  ) {
    const nextTheme = { ...theme, [key]: value };
    setTheme(nextTheme);
    if (isHexColor(value)) {
      saveTheme(nextTheme);
    }
  }

  function updateBannerOverlayOpacity(value: number) {
    saveTheme({ ...theme, bannerOverlayOpacity: Math.min(100, Math.max(0, value)) });
  }

  function updatePageOverlayOpacity(value: number) {
    saveTheme({ ...theme, pageOverlayOpacity: Math.min(100, Math.max(0, value)) });
  }

  async function handleBannerImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setThemeImageError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setThemeImageError("Please select an image file.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setThemeImageError("Banner image must be under 5 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = String(event.target?.result || "");
      const downloadUrl = await uploadBannerImage("admin-banner", dataUrl);
      await saveTheme({ ...theme, bannerImageDataUrl: downloadUrl });
    };
    reader.readAsDataURL(file);
  }

  async function resetTheme() {
    const confirmed = window.confirm("Reset the theme to default colors and remove the banner photo?");
    if (!confirmed) return;
    await deleteBannerImage("admin-banner");
    await saveTheme(DEFAULT_APP_THEME);
    setThemeImageError("");
  }

  function changeCalendarMonth(monthOffset: number) {
    setSelectedCalendarDate(null);
    setCalMonth((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + monthOffset, 1);
      setEventDate(getLocalDateKey(nextMonth));
      return nextMonth;
    });
  }

  function toggleCalendarDate(dateKey: string, events: Array<{ type: string; label: string; description?: string }>) {
    if (events.length === 0) return;
    setSelectedCalendarDate((current) => (current === dateKey ? null : dateKey));
  }

  function getAnnouncementCategoryForEvent(type: CalendarEvent["type"]): Announcement["category"] {
    if (type === "Holiday") return "Holiday";
    if (type === "Payroll") return "Payroll";
    if (type === "Deadline") return "Urgent";
    return "General";
  }

  async function addCalendarEvent() {
    const title = eventTitle.trim();
    const description = eventDescription.trim();
    if (!title || !eventDate) {
      window.alert("Event title and date are required.");
      return;
    }

    const event: CalendarEvent = {
      id: `EV-${Date.now()}`,
      title,
      date: eventDate,
      type: eventType,
      description,
    };
    const dateLabel = new Date(`${eventDate}T00:00:00`).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const announcement: Announcement = {
      id: `ANN-${Date.now()}`,
      title: `${eventType}: ${title}`,
      message: description || `${title} is scheduled on ${dateLabel}.`,
      category: getAnnouncementCategoryForEvent(eventType),
      priority: eventType === "Deadline" ? "Urgent" : "Normal",
      audience: "All Employees",
      pinned: false,
      postedBy: "HR Admin",
      createdAt: new Date().toISOString(),
    };

    const nextCalendarEvents = [...calendarEvents, event].sort((a, b) => a.date.localeCompare(b.date));
    const nextAnnouncements = [announcement, ...announcements];
    setCalendarEvents(nextCalendarEvents);
    setAnnouncements(nextAnnouncements);
    await setDataArray(storageKeys.homeCalendarEvents, nextCalendarEvents);
    await setDataArray(storageKeys.homeAnnouncements, nextAnnouncements);
    setCalMonth(new Date(`${eventDate}T00:00:00`));
    setSelectedCalendarDate(eventDate);
    setEventTitle("");
    setEventDescription("");
    setEventType("Company Event");
    setShowEventForm(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function guard() {
      const access = await canAccessAdminPageAsync(["Owner", "Super User", "HR Admin", "Payroll Admin"]);
      if (!cancelled && !access.allowed) router.replace(access.redirectTo);
    }

    guard();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadData = useCallback(async () => {
    const [employees, announcements, calendarEvents, payrollRecords, payrollRunApprovals] = await Promise.all([
      getCollectionItems<Employee>(storageKeys.employees),
      getDataArray<Announcement>(storageKeys.homeAnnouncements, []),
      getDataArray<CalendarEvent>(storageKeys.homeCalendarEvents, DEFAULT_PH_HOLIDAYS_2026),
      getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
      getConfigItem<Record<string, PayrollRunApproval>>(storageKeys.payrollRunApprovals, {}),
    ]);
    setEmployees(employees);
    setAnnouncements(announcements);
    setCalendarEvents(calendarEvents);
    setPayrollRecords(payrollRecords);
    setPayrollRunApprovals(payrollRunApprovals);
  }, []);

  useEffect(() => {
    loadData();
    const keys = [
      storageKeys.employees, storageKeys.homeAnnouncements, storageKeys.homeCalendarEvents,
      storageKeys.payrollRecords, storageKeys.payrollRunApprovals,
    ];
    keys.forEach((k) => window.addEventListener(`${k}-updated`, loadData as EventListener));
    return () => {
      keys.forEach((k) => window.removeEventListener(`${k}-updated`, loadData as EventListener));
    };
  }, [loadData]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.archived !== true), [employees]);

  const activePayrollRecords = useMemo(
    () => payrollRecords.filter((record) => normalizeString(record.status).toLowerCase() !== "deleted"),
    [payrollRecords]
  );

  const payrollRunSummaries = useMemo(() => {
    const grouped = new Map<string, PayrollRecord[]>();

    activePayrollRecords.forEach((record) => {
      const groupKey = getPayrollRunGroupKey(record);
      const currentRecords = grouped.get(groupKey) || [];
      currentRecords.push(record);
      grouped.set(groupKey, currentRecords);
    });

    return Array.from(grouped.entries()).map(([groupKey, groupRecords]) => {
      const firstRecord = groupRecords[0];
      const [groupYear, groupMonth, ...groupPeriodParts] = groupKey.split("-");
      const payrollPeriod = firstRecord?.payrollPeriod || "Monthly Payroll";
      const month = firstRecord?.month || groupMonth || "";
      const year = firstRecord?.year || groupYear || "";
      const title = `${month || "Payroll"} ${payrollPeriod || groupPeriodParts.join("-")} ${year}`.trim();

      return groupRecords.reduce<PayrollRunSummary>(
        (summary, record) => {
          summary.netPay += money(record.adjustedNetPay ?? record.netPay);
          return summary;
        },
        {
          id: buildPayrollRunIdentity(groupKey, groupRecords),
          title,
          month,
          year,
          payrollPeriod: payrollPeriod || groupPeriodParts.join("-"),
          payrollDate: firstRecord?.payrollDate || firstRecord?.payDate || "",
          createdAt: firstRecord?.createdAt || "",
          records: groupRecords,
          employeesCount: groupRecords.length,
          netPay: 0,
        }
      );
    }).sort((a, b) => getPayrollRunSortValue(b) - getPayrollRunSortValue(a));
  }, [activePayrollRecords]);

  const latestPayrollRun = payrollRunSummaries[0];


  // Payroll status counts for the 3-step flow
  const payrollStatusCounts = useMemo(() => {
    return {
      draft: payrollRunSummaries.filter((run) => {
        const status = getPayrollRunStatus(run, payrollRunApprovals);
        return status.includes("draft") || status === "" || status.includes("returned");
      }).length,
      checking: payrollRunSummaries.filter((run) => {
        const status = getPayrollRunStatus(run, payrollRunApprovals);
        return status.includes("check") || status.includes("review") || status === "pending" || status === "for review";
      }).length,
      approved: payrollRunSummaries.filter((run) => isApprovedPayrollRun(run, payrollRunApprovals)).length,
    };
  }, [payrollRunSummaries, payrollRunApprovals]);

  const payrollTotal = payrollStatusCounts.draft + payrollStatusCounts.checking + payrollStatusCounts.approved;
  const approvalPct = payrollTotal > 0 ? Math.round((payrollStatusCounts.approved / payrollTotal) * 100) : 0;
  const pendingPayrollRuns = payrollRunSummaries.filter((run) => isPendingPayrollRun(run, payrollRunApprovals)).length;


  const recentPayroll = useMemo(
    () => [...activePayrollRecords]
      .sort((a, b) => (b.payrollDate || b.payDate || "").localeCompare(a.payrollDate || a.payDate || ""))
      .slice(0, 6),
    [activePayrollRecords]
  );

  const sortedAnnouncements = useMemo(
    () => [...announcements].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    }),
    [announcements]
  );

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
    const isDisplayedCurrentMonth = displayedMonthKey === getYearMonthKeyFromDateKey(today);
    const rows: Array<{ date: string; type: string; label: string; description?: string }> = [];
    const year = calMonth.getFullYear();
    activeEmployees.forEach((e) => {
      const bKey = getRecurringDateForYear(getEmployeeBirthday(e), year);
      if (
        bKey &&
        getYearMonthKeyFromDateKey(bKey) === displayedMonthKey &&
        (!isDisplayedCurrentMonth || bKey >= today)
      ) {
        rows.push({ date: bKey, type: "Birthday", label: getEmployeeName(e) });
      }
    });
    calendarEvents.forEach((ev) => {
      if (
        getYearMonthKeyFromDateKey(ev.date) === displayedMonthKey &&
        (!isDisplayedCurrentMonth || ev.date >= today)
      ) {
        rows.push({ date: ev.date, type: ev.type, label: ev.title, description: ev.description });
      }
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  }, [activeEmployees, calendarEvents, calMonth]);

  async function postAnnouncement() {
    if (!annTitle.trim() || !annMessage.trim()) {
      window.alert("Title and message are required.");
      return;
    }
    const confirmed = window.confirm(editingAnnId ? "Save changes?" : "Post this announcement?");
    if (!confirmed) return;
    const next: Announcement = {
      id: editingAnnId || `ANN-${Date.now()}`,
      title: annTitle.trim(),
      message: annMessage.trim(),
      category: annCategory,
      priority: annPriority,
      audience: "All Employees",
      pinned: false,
      postedBy: "HR Admin",
      createdAt: editingAnnId
        ? announcements.find((a) => a.id === editingAnnId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
    };
    const nextList = editingAnnId
      ? announcements.map((a) => (a.id === editingAnnId ? next : a))
      : [next, ...announcements];
    setAnnouncements(nextList);
    await setDataArray(storageKeys.homeAnnouncements, nextList);
    setEditingAnnId(null);
    setAnnTitle("");
    setAnnMessage("");
    setAnnCategory("General");
    setAnnPriority("Normal");
    setShowAnnouncementForm(false);
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm("Delete this announcement?")) return;
    const nextList = announcements.filter((a) => a.id !== id);
    setAnnouncements(nextList);
    await setDataArray(storageKeys.homeAnnouncements, nextList);
  }

  function startEditAnn(ann: Announcement) {
    setEditingAnnId(ann.id);
    setAnnTitle(ann.title);
    setAnnMessage(ann.message);
    setAnnCategory(ann.category);
    setAnnPriority(ann.priority);
    setShowAnnouncementForm(true);
  }

  function annTag(ann: Announcement): { label: string; bg: string; color: string } {
    if (ann.priority === "Urgent" || ann.category === "Urgent") return { label: "Urgent", bg: "#fff1f2", color: "#9f1239" };
    if (ann.priority === "Important") return { label: "Info", bg: "#eff6ff", color: "#1d4ed8" };
    return { label: "Reminder", bg: "#f0fdf4", color: "#166534" };
  }

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

  const paidLabelStyle = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("paid") || s.includes("approved") || s.includes("released"))
      return { bg: "#f0fdf4", color: "#166534", label: "Paid" };
    return { bg: "#fffbeb", color: "#92400e", label: "Pending" };
  };

  const inputCls = "w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[var(--axis-blue)] focus:ring-1 focus:ring-[var(--axis-blue)]";
  const ghostBtn = "inline-flex h-9 items-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-3.5 text-[13px] font-medium transition hover:border-cyan-200/50 hover:bg-white/12";
  const sectionTitleCls = "text-base font-semibold text-slate-700";
  const thinBorder = "border border-slate-200";
  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = Math.round((activeTheme.bannerOverlayOpacity / 100) * 255).toString(16).padStart(2, "0");
  const bannerStyle: React.CSSProperties = activeTheme.bannerImageDataUrl
    ? {
        backgroundColor: activeTheme.bannerColor,
        backgroundImage: `linear-gradient(90deg, ${activeTheme.bannerColor}${bannerOverlayAlpha} 0%, ${activeTheme.bannerColor}${bannerOverlayAlpha} 100%), url(${activeTheme.bannerImageDataUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : { backgroundColor: activeTheme.bannerColor };

  return (
    <div className="flex min-h-screen pg-bg text-[#0b2742]">
      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        {/* DASHBOARD BANNER */}
        <section
          className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderColor: `${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 82% 20%, ${activeTheme.accentColor}33, transparent 30%), linear-gradient(135deg, ${activeTheme.accentColor}22, transparent 45%)`,
            }}
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${activeTheme.accentColor}24`, color: activeTheme.bannerTextColor, border: `0.5px solid ${activeTheme.accentColor}66` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                  Active · {getPayPeriod()}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Dashboard
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Good day, HR Admin</h1>
              <p className="mt-1 text-sm opacity-85">
                {activeEmployees.length} employees · {pendingPayrollRuns} payroll{pendingPayrollRuns !== 1 ? "s" : ""} pending · {payrollStatusCounts.approved} approved
              </p>
            </div>

            <div className="shrink-0 lg:min-w-[520px]">
              <Link
                href="/add-payroll"
                className="flex h-10 w-full items-center justify-center gap-2 rounded bg-[var(--theme-accent)] px-5 text-sm font-semibold shadow-[0_18px_36px_-28px_rgba(58,190,255,0.9)] transition hover:-translate-y-0.5 hover:opacity-95"
                style={{ color: activeTheme.bannerButtonTextColor }}
              >
                <WalletCards className="h-4 w-4" />
                Run bulk payroll
              </Link>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Link href="/reports/payslips" className={ghostBtn} style={{ color: activeTheme.bannerButtonTextColor }}>
                  <FileText className="h-3.5 w-3.5" />
                  Payslips
                </Link>
                <Link href="/add-employee" className={ghostBtn} style={{ color: activeTheme.bannerButtonTextColor }}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add employee
                </Link>
                <Link href="/reports/1601-c" className={ghostBtn} style={{ color: activeTheme.bannerButtonTextColor }}>
                  <BarChart3 className="h-3.5 w-3.5" />
                  Reports
                </Link>
                <Link href="/user-settings" className={ghostBtn} style={{ color: activeTheme.bannerButtonTextColor }}>
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* STATS STRIP */}
        <div className="flex divide-x divide-slate-300 border-b border-slate-200 bg-white">
          <div className="flex-1 px-4 py-4">
            <p className="text-[13px] font-medium uppercase tracking-wide text-slate-500">Total employees</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{activeEmployees.length}</p>
          </div>
          <div className="flex-1 px-4 py-4">
            <p className="text-[13px] font-medium uppercase tracking-wide text-slate-500">Latest payroll</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{latestPayrollRun ? peso(latestPayrollRun.netPay) : "₱0.00"}</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{getPayrollRunDisplayPeriod(latestPayrollRun)}</p>
          </div>
          <div className="flex-[1.35] px-4 py-4">
            <p className="text-[13px] font-medium uppercase tracking-wide text-slate-500">Payroll approval status</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <p className="text-xl font-bold text-slate-900">
                {payrollStatusCounts.approved} / {payrollTotal} <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">approved</span>
              </p>
              <p className="text-xl font-bold text-slate-900">
                {pendingPayrollRuns} / {payrollTotal} <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">pending</span>
              </p>
            </div>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full"
                style={{ width: `${approvalPct}%`, background: "var(--axis-blue)" }}
              />
              <div
                className="h-full bg-amber-400"
                style={{ width: `${payrollTotal > 0 ? Math.round((pendingPayrollRuns / payrollTotal) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT — two columns */}
        <div className="grid grid-cols-2 divide-x divide-slate-300 border-t border-slate-200">

          {/* LEFT COLUMN */}
          <div className="space-y-0 divide-y divide-slate-200 bg-white">

            {/* Bulk payroll banner */}
            <div className="bg-blue-50 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className={sectionTitleCls}>Bulk Payroll</p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold">{activeEmployees.length}</span> employees ready for processing
                  </p>
                </div>
                <Link
                  href="/add-payroll"
                  className="inline-flex h-9 items-center gap-1.5 rounded px-4 text-sm font-semibold transition hover:opacity-90"
                  style={{
                    background: "var(--axis-blue)",
                    color: activeTheme.bannerButtonTextColor,
                  }}
                >
                  <WalletCards className="h-4 w-4" />
                  Process now
                </Link>
              </div>
            </div>

            {/* Recent payroll list */}
            <div className="px-5 py-4">
              <p className={sectionTitleCls}>Recent Payroll</p>
              {recentPayroll.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No payroll records yet.</p>
              ) : (
                <div className="mt-3 space-y-1">
                  {recentPayroll.map((rec, i) => {
                    const name = rec.employeeName || rec.employeeNo || `Record ${i + 1}`;
                    const role = rec.jobTitle || rec.department || "—";
                    const lbl = paidLabelStyle(rec.status);
                    return (
                      <div key={rec.id || i} className="flex items-center gap-3 rounded px-2 py-2.5 transition hover:bg-slate-100">
                        <span
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background: "var(--axis-blue)",
                            color: activeTheme.bannerButtonTextColor,
                          }}
                        >
                          {initials(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                          <p className="truncate text-xs text-slate-500">{role}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-slate-700">{peso(money(rec.netPay))}</p>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{ background: lbl.bg, color: lbl.color }}
                        >
                          {lbl.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="px-5 py-4">
              <p className={sectionTitleCls}>Quick Actions</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { label: "Generate Payslips", icon: FileText, href: "/reports/payslips" },
                  { label: "Import / Add Employees", icon: UserPlus, href: "/add-employee" },
                  { label: "BIR Reports", icon: ClipboardCheck, href: "/reports/1601-c" },
                  { label: "Year-End Tax Annualization", icon: BarChart3, href: "/year-end-tax-annualization" },
                ].map(({ label, icon: Icon, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex flex-col items-center gap-2 rounded border border-slate-200 bg-white px-2 py-3.5 text-center text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Icon className="h-5 w-5 text-[var(--axis-blue)]" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-0 divide-y divide-slate-200 bg-white">

            {/* Statutory Contribution Rate Reference */}
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={sectionTitleCls}>Statutory Contribution Rates</p>
                  <p className="mt-0.5 text-xs text-slate-500">Official PH government reference · RA 11199, RA 11223, RA 9679, RA 10963</p>
                </div>
                <span className="inline-flex shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0a4f8f]">
                  Payroll reference
                </span>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {([
                  { name: "SSS", value: "15%", helper: "2026 table", barCls: "bg-[var(--axis-blue)]" },
                  { name: "PhilHealth", value: "5%", helper: "Split 50/50", barCls: "bg-cyan-400" },
                  { name: "Pag-IBIG", value: "2%", helper: "Monthly cap", barCls: "bg-[#28b8d8]" },
                  { name: "BIR", value: "2023+", helper: "Current table", barCls: "bg-[#0b2742]" },
                ] as { name: string; value: string; helper: string; barCls: string }[]).map(({ name, value, helper, barCls }) => (
                  <div key={name} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-3 pb-3 pt-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_8px_20px_-8px_rgba(8,47,73,0.15)]">
                    <span className={`absolute inset-x-0 top-0 h-1 ${barCls}`} />
                    <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{name}</p>
                    <p className="mt-1 text-sm font-bold text-[#0b2742]">{value}</p>
                    <p className="truncate text-[10px] font-medium text-slate-400">{helper}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2.5">

                {/* ── SSS ── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_-4px_rgba(8,47,73,0.1)] transition hover:border-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleStatutoryRate("sss")}
                    aria-expanded={!!expandedStatutoryRates.sss}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-[#f4f8fc]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-[var(--axis-blue)]" />
                      <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0b2742]">SSS — 2026 Employee and Employer Table</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">15% total · Employee 5% · Employer 10% + EC</p>
                      {expandedStatutoryRates.sss && (
                        <>
                          <p className="mt-1 font-mono text-[10px] text-[#1a3f6f]">SS = MSC × 15% &nbsp;·&nbsp; MSC range ₱5,000 to ₱35,000</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">MPF applies above ₱20,000 MSC · EC is employer-only</p>
                        </>
                      )}
                      </div>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--axis-blue)] shadow-sm">
                      {expandedStatutoryRates.sss ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {expandedStatutoryRates.sss && (
                  <>
                  <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full border-t border-slate-200 text-[9px]">
                      <thead>
                        <tr className="bg-[#f4f8fc] text-[9px] font-semibold uppercase tracking-wide text-[#1a3f6f]">
                          <th rowSpan={2} className="px-2 py-1.5 text-left align-bottom">Range of Compensation</th>
                          <th colSpan={3} className="border-l border-slate-200 px-2 py-1.5 text-center">Monthly Salary Credit</th>
                          <th colSpan={4} className="border-l border-slate-200 px-2 py-1.5 text-center">Employer Contribution</th>
                          <th colSpan={3} className="border-l border-slate-200 px-2 py-1.5 text-center">Employee Contribution</th>
                        </tr>
                        <tr className="bg-[#eef4fb] text-[9px] font-semibold uppercase tracking-wide text-[#1a3f6f]">
                          <th className="border-l border-slate-200 px-2 py-1.5 text-right">Regular SS/EC</th>
                          <th className="px-2 py-1.5 text-right">MPF</th>
                          <th className="px-2 py-1.5 text-right">Total</th>
                          <th className="border-l border-slate-200 px-2 py-1.5 text-right">Regular SS</th>
                          <th className="px-2 py-1.5 text-right">MPF</th>
                          <th className="px-2 py-1.5 text-right">EC</th>
                          <th className="px-2 py-1.5 text-right">Total</th>
                          <th className="border-l border-slate-200 px-2 py-1.5 text-right">Regular SS</th>
                          <th className="px-2 py-1.5 text-right">MPF</th>
                          <th className="px-2 py-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {SSS_2026_CONTRIBUTION_ROWS.map((row, i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                            <td className="px-2 py-1.5 text-slate-600">{row.range}</td>
                            <td className="border-l border-slate-100 px-2 py-1.5 text-right font-medium">{sssMoney(row.regularMsc)}</td>
                            <td className="px-2 py-1.5 text-right">{row.mpfMsc ? sssMoney(row.mpfMsc) : "–"}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{sssMoney(row.totalMsc)}</td>
                            <td className="border-l border-slate-100 px-2 py-1.5 text-right">{sssMoney(row.employerRegular)}</td>
                            <td className="px-2 py-1.5 text-right">{row.employerMpf ? sssMoney(row.employerMpf) : "–"}</td>
                            <td className="px-2 py-1.5 text-right">{sssMoney(row.ec)}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">{sssMoney(row.employerTotal)}</td>
                            <td className="border-l border-slate-100 px-2 py-1.5 text-right">{sssMoney(row.employeeRegular)}</td>
                            <td className="px-2 py-1.5 text-right">{row.employeeMpf ? sssMoney(row.employeeMpf) : "–"}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">{sssMoney(row.employeeTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] italic text-slate-500">
                    2026 employee and employer schedule. MPF applies to MSC above ₱20,000; EC is ₱10 up to ₱14,500 MSC and ₱30 from ₱15,000 MSC.
                  </p>
                  </>
                  )}
                </div>

                {/* ── PhilHealth ── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_-4px_rgba(8,47,73,0.1)] transition hover:border-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleStatutoryRate("philhealth")}
                    aria-expanded={!!expandedStatutoryRates.philhealth}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-[#f4f8fc]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                      <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0b2742]">PhilHealth — Philippine Health Insurance</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Premium 5% · Equal share</p>
                      {expandedStatutoryRates.philhealth && (
                        <>
                          <p className="mt-1 font-mono text-[10px] text-[#1a3f6f]">Premium = Monthly Basic Salary × 5% &nbsp;·&nbsp; EE 2.5% / ER 2.5%</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">Salary base: min ₱10,000 · max ₱100,000 (premium capped at ₱5,000 total)</p>
                        </>
                      )}
                      </div>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--axis-blue)] shadow-sm">
                      {expandedStatutoryRates.philhealth ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {expandedStatutoryRates.philhealth && (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-t border-slate-200 text-[10px]">
                      <thead>
                        <tr className="bg-[#f4f8fc] text-[9px] font-semibold uppercase tracking-wide text-[#1a3f6f]">
                          <th className="px-2 py-1.5 text-left">Monthly Basic Salary</th>
                          <th className="px-2 py-1.5 text-right">EE Share</th>
                          <th className="px-2 py-1.5 text-right">ER Share</th>
                          <th className="px-2 py-1.5 text-right">Total Premium</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr className="bg-white">
                          <td className="px-2 py-1.5 text-slate-600">₱10,000 and below</td>
                          <td className="px-2 py-1.5 text-right">₱250.00</td>
                          <td className="px-2 py-1.5 text-right">₱250.00</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">₱500.00</td>
                        </tr>
                        <tr className="bg-slate-50/70">
                          <td className="px-2 py-1.5 text-slate-600">₱10,000.01 – ₱99,999.99</td>
                          <td className="px-2 py-1.5 text-right">Salary × 2.5%</td>
                          <td className="px-2 py-1.5 text-right">Salary × 2.5%</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">Salary × 5%</td>
                        </tr>
                        <tr className="bg-white">
                          <td className="px-2 py-1.5 text-slate-600">₱100,000 and above</td>
                          <td className="px-2 py-1.5 text-right">₱2,500.00</td>
                          <td className="px-2 py-1.5 text-right">₱2,500.00</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">₱5,000.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] italic text-slate-500">
                    Monthly contribution — deduct once per month (1st or 2nd cutoff only). Rate is 5% effective Jan 2023.
                  </p>
                  </>
                  )}
                </div>

                {/* ── Pag-IBIG ── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_-4px_rgba(8,47,73,0.1)] transition hover:border-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleStatutoryRate("pagibig")}
                    aria-expanded={!!expandedStatutoryRates.pagibig}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-[#f4f8fc]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-[#28b8d8]" />
                      <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0b2742]">Pag-IBIG — HDMF</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">2% common rate · ₱100 cap</p>
                      {expandedStatutoryRates.pagibig && (
                        <>
                          <p className="mt-1 font-mono text-[10px] text-[#1a3f6f]">EE: salary × rate (max ₱100) &nbsp;·&nbsp; ER: always 2% (max ₱100)</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">Salary base capped at ₱5,000 · ≤₱1,500 → EE 1%; above → EE 2%</p>
                        </>
                      )}
                      </div>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--axis-blue)] shadow-sm">
                      {expandedStatutoryRates.pagibig ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {expandedStatutoryRates.pagibig && (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-t border-slate-200 text-[10px]">
                      <thead>
                        <tr className="bg-[#f4f8fc] text-[9px] font-semibold uppercase tracking-wide text-[#1a3f6f]">
                          <th className="px-2 py-1.5 text-left">Monthly Salary</th>
                          <th className="px-2 py-1.5 text-right">EE Rate</th>
                          <th className="px-2 py-1.5 text-right">EE Max</th>
                          <th className="px-2 py-1.5 text-right">ER Rate</th>
                          <th className="px-2 py-1.5 text-right">ER Max</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr className="bg-white">
                          <td className="px-2 py-1.5 text-slate-600">₱1,500 and below</td>
                          <td className="px-2 py-1.5 text-right">1%</td>
                          <td className="px-2 py-1.5 text-right">₱15.00</td>
                          <td className="px-2 py-1.5 text-right">2%</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">₱100.00</td>
                        </tr>
                        <tr className="bg-slate-50/70">
                          <td className="px-2 py-1.5 text-slate-600">Above ₱1,500</td>
                          <td className="px-2 py-1.5 text-right">2%</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">₱100.00</td>
                          <td className="px-2 py-1.5 text-right">2%</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">₱100.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] italic text-slate-500">
                    Monthly contribution — deduct once per month (1st or 2nd cutoff only).
                  </p>
                  </>
                  )}
                </div>

                {/* ── BIR Withholding Tax ── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_14px_-4px_rgba(8,47,73,0.1)] transition hover:border-slate-300">
                  <button
                    type="button"
                    onClick={() => toggleStatutoryRate("bir")}
                    aria-expanded={!!expandedStatutoryRates.bir}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-[#f4f8fc]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 h-8 w-1.5 shrink-0 rounded-full bg-[#0b2742]" />
                      <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0b2742]">BIR Withholding Tax — Current</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Semi-monthly · Effective Jan 1, 2023 onwards</p>
                      {expandedStatutoryRates.bir && (
                        <>
                          <p className="mt-1 font-mono text-[10px] text-[#1a3f6f]">Tax = Base Tax + ((Taxable Income − Excess Over) × Rate)</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">Taxable income = semi-monthly gross pay − mandatory deductions (if deducted this cutoff)</p>
                        </>
                      )}
                      </div>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[var(--axis-blue)] shadow-sm">
                      {expandedStatutoryRates.bir ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                  </button>
                  {expandedStatutoryRates.bir && (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-t border-slate-200 text-[10px]">
                      <thead>
                        <tr className="bg-[#f4f8fc] text-[9px] font-semibold uppercase tracking-wide text-[#1a3f6f]">
                          <th className="px-2 py-1.5 text-left">Semi-Monthly Taxable Income</th>
                          <th className="px-2 py-1.5 text-right">Rate</th>
                          <th className="px-2 py-1.5 text-right">Base Tax</th>
                          <th className="px-2 py-1.5 text-right">On Excess Over</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {([
                          ["₱10,417 and below",      "0%",  "₱0.00",        "—"],
                          ["₱10,417 – ₱16,666",      "15%", "₱0.00",        "₱10,417"],
                          ["₱16,667 – ₱33,332",      "20%", "₱937.50",      "₱16,667"],
                          ["₱33,333 – ₱83,332",      "25%", "₱4,270.70",    "₱33,333"],
                          ["₱83,333 – ₱333,332",     "30%", "₱16,770.70",   "₱83,333"],
                          ["₱333,333 and above",     "35%", "₱91,770.70",   "₱333,333"],
                        ] as const).map(([range, rate, base, excess], i) => (
                          <tr key={i} className={i % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                            <td className="px-2 py-1.5 text-slate-600">{range}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-[#0a4f8f]">{rate}</td>
                            <td className="px-2 py-1.5 text-right">{base}</td>
                            <td className="px-2 py-1.5 text-right">{excess}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] italic text-slate-500">
                    Current semi-monthly withholding tax table under BIR RR 11-2018 Annex E, effective January 1, 2023 and onwards.
                  </p>
                  </>
                  )}
                </div>

              </div>
            </div>

            {/* Payroll run status — 3-step flow */}
            <div className="px-5 py-4">
              <p className={sectionTitleCls}>Payroll Run Status</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {latestPayrollRun ? `Latest: ${getPayrollRunDisplayPeriod(latestPayrollRun)}` : "Current payroll cycle"}
              </p>
              <div className="mt-4 flex items-start gap-0">
                {PAYROLL_STATUS_STEPS.map((step, i) => {
                  const count = payrollStatusCounts[step.key as keyof typeof payrollStatusCounts];
                  const hasRecords = count > 0;
                  const dotBg = step.key === "approved"
                    ? (hasRecords ? "#166534" : "#e2e8f0")
                    : step.key === "checking"
                    ? (hasRecords ? "var(--axis-vivid)" : "#e2e8f0")
                    : (hasRecords ? "var(--axis-blue)" : "#e2e8f0");
                  const dotColor = hasRecords ? "white" : "#94a3b8";
                  const labelColor = hasRecords ? "#0b2742" : "#94a3b8";
                  return (
                    <div key={step.key} className="flex flex-1 flex-col items-center">
                      <div className="flex w-full items-center">
                        {i > 0 && (
                          <div className="h-px flex-1" style={{ background: "#e2e8f0" }} />
                        )}
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ background: dotBg, color: dotColor }}
                        >
                          {step.key === "approved" && hasRecords ? "✓" : i + 1}
                        </div>
                        {i < PAYROLL_STATUS_STEPS.length - 1 && (
                          <div className="h-px flex-1" style={{ background: "#e2e8f0" }} />
                        )}
                      </div>
                      <p className="mt-2 text-center text-xs font-semibold" style={{ color: labelColor }}>
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-sm font-bold" style={{ color: hasRecords ? dotBg : "#cbd5e1" }}>
                        {count}
                      </p>
                      <p className="text-[10px] text-slate-400">record{count !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ANNOUNCEMENTS FEED */}
        <section className="border-t border-slate-200 bg-white px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <p className={sectionTitleCls}>Announcements</p>
            <button
              type="button"
              onClick={() => setShowAnnouncementForm((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded px-3.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: showAnnouncementForm ? "#64748b" : "var(--axis-blue)" }}
            >
              {showAnnouncementForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAnnouncementForm ? "Cancel" : "+ Post new"}
            </button>
          </div>

          {showAnnouncementForm && (
            <div className={`mb-4 rounded p-4 ${thinBorder} bg-slate-50`}>
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-600">Title *</label>
                  <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} className={`mt-1 ${inputCls}`} placeholder="Announcement title" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600">Message *</label>
                  <textarea value={annMessage} onChange={(e) => setAnnMessage(e.target.value)} rows={3} className={`mt-1 ${inputCls}`} placeholder="Write the announcement..." />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600">Category</label>
                    <select value={annCategory} onChange={(e) => setAnnCategory(e.target.value as Announcement["category"])} className={`mt-1 ${inputCls}`}>
                      <option>General</option>
                      <option>Payroll</option>
                      <option>HR Memo</option>
                      <option>Holiday</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-600">Priority</label>
                    <select value={annPriority} onChange={(e) => setAnnPriority(e.target.value as Announcement["priority"])} className={`mt-1 ${inputCls}`}>
                      <option>Normal</option>
                      <option>Important</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={postAnnouncement}
                      className="h-9 rounded px-4 text-sm font-semibold text-white"
                      style={{ background: "var(--axis-blue)" }}
                    >
                      {editingAnnId ? "Save changes" : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sortedAnnouncements.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedAnnouncements.map((ann) => {
                const tag = annTag(ann);
                return (
                  <div key={ann.id} className={`rounded px-4 py-3.5 ${thinBorder} bg-white transition hover:bg-slate-50`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: tag.bg, color: tag.color }}>
                            {tag.label}
                          </span>
                          <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                            {ann.category}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{ann.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{ann.message}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <p className="text-xs text-slate-400">
                            {ann.postedBy || "HR Admin"} · {new Date(ann.createdAt).toLocaleDateString("en-PH")}
                          </p>
                          {ann.attachmentName && (
                            <button type="button" className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--axis-blue)" }}>
                              <Paperclip className="h-3 w-3" />
                              {ann.attachmentName}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditAnn(ann)}
                          className="text-xs font-medium underline"
                          style={{ color: "var(--axis-blue)" }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteAnnouncement(ann.id)} className="text-xs font-medium text-rose-600 underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        onClick={() => setShowCalendar((open) => !open)}
        aria-label={showCalendar ? "Hide calendar" : "Show calendar"}
        aria-expanded={showCalendar}
        className="fixed z-50 flex h-14 w-8 items-center justify-center rounded-l-xl border border-r-0 border-sky-200 bg-white text-[#0a4f8f] shadow-[0_18px_38px_-24px_rgba(8,47,73,0.8)] transition-all duration-300 hover:bg-sky-50"
        style={{ right: showCalendar ? 288 : 0, top: "50%", transform: "translateY(-50%)" }}
      >
        {showCalendar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      {/* ── RIGHT SIDEBAR ─────────────────────────────────────── */}
      <aside
        className="fixed right-0 z-40 w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white shadow-[0_24px_70px_-36px_rgba(8,47,73,0.65)] transition-transform duration-300"
        style={{
          top: 72,
          height: "calc(100vh - 72px)",
          transform: showCalendar ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Mini calendar */}
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className={sectionTitleCls}>{getMonthLabel(calMonth)}</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => changeCalendarMonth(-1)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => changeCalendarMonth(1)} className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold uppercase text-slate-400">{d}</div>
            ))}
            {calDays.map((day) => {
              const key = getLocalDateKey(day);
              const isCurrentMonth = getYearMonthKey(day) === getYearMonthKey(calMonth);
              const isToday = key === getTodayKey();
              const events = calEventMap.get(key) || [];
              const hasPayroll = events.some((e) => e.type === "Payroll");
              const hasClickableInfo = events.length > 0;
              const isSelected = selectedCalendarDate === key;
              const eventDots = Array.from(new Set(events.map((event) => event.type))).slice(0, 4);

              return (
                <div key={key} className="relative flex flex-col items-center py-0.5">
                  <button
                    type="button"
                    onClick={() => toggleCalendarDate(key, events)}
                    disabled={!hasClickableInfo}
                    aria-label={hasClickableInfo ? `Show events for ${key}` : undefined}
                    aria-pressed={hasClickableInfo ? isSelected : undefined}
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
                      <span key={type} className="h-1 w-1 rounded-full" style={{ background: eventDotColor[type] || "#e2e8f0" }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedCalendarDetails ? (
            <div className="mt-4 rounded border border-sky-100 bg-sky-50 px-3 py-3 shadow-[0_12px_28px_-24px_rgba(8,47,73,0.8)]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0a4f8f]">Selected date</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{selectedCalendarDetails.dateLabel}</p>
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
                        {event.description ? (
                          <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Legend */}
        <div className="border-b border-slate-200 px-4 py-3">
          <p className={sectionTitleCls}>Legend</p>
          <div className="mt-2 space-y-2">
            {[
              { dot: "var(--axis-navy)", label: "Today", fill: true },
              { dot: "#dbeafe", label: "Payroll date", fill: true },
              { dot: "#f9a8d4", label: "Birthday" },
              { dot: "#fca5a5", label: "Holiday" },
              { dot: "#99f6e4", label: "Company event" },
            ].map(({ dot, label, fill }) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ background: dot, border: fill ? "none" : "1px solid #e2e8f0" }}
                />
                <span className="text-xs text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={sectionTitleCls}>Upcoming Events This Month</p>
              <p className="mt-0.5 text-xs text-slate-400">{getMonthLabel(calMonth)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEventDate(selectedCalendarDate || getLocalDateKey(calMonth));
                setShowEventForm((open) => !open);
              }}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-sky-100 bg-sky-50 px-2.5 text-xs font-semibold text-[#0a4f8f] transition hover:bg-sky-100"
            >
              {showEventForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {showEventForm ? "Close" : "Add"}
            </button>
          </div>

          {showEventForm ? (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Event title</span>
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className={inputCls}
                    placeholder="Event title"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</span>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className={inputCls}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as CalendarEvent["type"])}
                      className={inputCls}
                    >
                      {CALENDAR_EVENT_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Info</span>
                  <textarea
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    rows={3}
                    className={inputCls}
                    placeholder="Details to show in the calendar and announcement"
                  />
                </label>
                <button
                  type="button"
                  onClick={addCalendarEvent}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded bg-[var(--axis-blue)] px-3 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save and announce
                </button>
              </div>
            </div>
          ) : null}

          {upcomingEvents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No upcoming events this month.</p>
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
                      <p className="text-[10px] uppercase text-slate-400">{d.toLocaleDateString("en-PH", { month: "short" })}</p>
                    </div>
                    <div className="flex min-w-0 flex-1 items-start gap-1.5 pt-0.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{ev.label}</p>
                        <p className="text-xs text-slate-400">{typeLabel}</p>
                        {ev.description ? <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400">{ev.description}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {showThemePanel ? (
        <div
          className="fixed bottom-20 z-50 w-[min(340px,calc(100vw-48px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          style={{ right: showCalendar ? 320 : 24 }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-800">Theme</p>
              <p className="text-[11px] text-slate-500">Navigation, banner, and accents.</p>
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
                    className={`h-8 w-full rounded-md border bg-white px-2 font-mono text-xs uppercase text-slate-800 outline-none focus:border-[var(--axis-blue)] focus:ring-1 focus:ring-[var(--axis-blue)] ${valid ? "border-slate-300" : "border-rose-300 focus:border-rose-500 focus:ring-rose-100"}`}
                    placeholder="#323423"
                  />
                  {!valid ? <span className="col-span-3 text-[11px] text-rose-600">Use a 6-digit hex code.</span> : null}
                </label>
              );
            })}

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
                          value.toLowerCase() === color.toLowerCase() ? "border-slate-900 ring-2 ring-slate-300" : "border-slate-200"
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
                      className={`h-8 rounded-md border bg-white px-2 font-mono text-xs uppercase text-slate-800 outline-none focus:border-[var(--axis-blue)] focus:ring-1 focus:ring-[var(--axis-blue)] ${valid ? "border-slate-300" : "border-rose-300 focus:border-rose-500 focus:ring-rose-100"}`}
                      placeholder="#ffffff"
                    />
                  </div>
                  {!valid ? <span className="text-[11px] text-rose-600">Use a 6-digit hex code.</span> : null}
                </div>
              );
            })}

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Background photo</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Applied as full-page background and banner. Best fit: {BANNER_IMAGE_RECOMMENDED_SIZE}.
              </p>
              {theme.bannerImageDataUrl ? (
                <div className="mt-2 h-14 overflow-hidden rounded-md border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={theme.bannerImageDataUrl} alt="Background photo preview" className="h-full w-full object-cover" />
                </div>
              ) : null}
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{theme.bannerImageDataUrl ? "Replace photo" : "Upload background photo"}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={handleBannerImageUpload} />
              </label>
              {themeImageError ? <p className="mt-1.5 text-[11px] text-rose-600">{themeImageError}</p> : null}
              {theme.bannerImageDataUrl ? (
                <>
                  <label className="mt-3 grid gap-1.5">
                    <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Banner Overlay Opacity
                      <span className="font-mono text-slate-600">{activeTheme.bannerOverlayOpacity}%</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
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
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={activeTheme.pageOverlayOpacity}
                      onChange={(e) => updatePageOverlayOpacity(Number(e.target.value))}
                      className="w-full accent-[var(--theme-accent)]"
                    />
                    <span className="text-[10px] leading-4 text-slate-400">
                      Higher = more color, less photo visible
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => saveTheme({ ...theme, bannerImageDataUrl: "" })}
                    className="mt-2 text-[11px] font-semibold text-slate-500 underline hover:text-slate-800"
                  >
                    Remove photo
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.topNavColor }} />
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.bannerColor }} />
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.accentColor }} />
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.topNavTextColor }} />
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.bannerTextColor }} />
                <span className="h-4 w-4 rounded-full border border-slate-200" style={{ background: activeTheme.bannerButtonTextColor }} />
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
      ) : null}

      <button
        type="button"
        onClick={() => setShowThemePanel((open) => !open)}
        title="Customize colors and banner"
        aria-expanded={showThemePanel}
        className="fixed bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        style={{
          right: showCalendar ? 320 : 24,
          background: showThemePanel ? activeTheme.accentColor : activeTheme.topNavColor,
        }}
      >
        <Palette className="h-5 w-5" />
      </button>

    </div>
  );
}
