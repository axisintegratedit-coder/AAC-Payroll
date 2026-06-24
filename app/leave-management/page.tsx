"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/immutability */

import React, { useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, setConfigItem, getDataArray, setDataArray, getCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";

type Employee = {
  employeeNo: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  employeeName?: string;
  department?: string;
  gender?: string;
  employmentStatus?: string;
  employmentClassification?: string;
  employeeType?: string;
  jobTitle?: string;
  hireDate?: string;
  basicPay?: number | string;
  dailyRate?: number | string;
  hourlyRate?: number | string;
  archived?: boolean;
  separationDate?: string;
};

type PayrollRecord = {
  id?: string;
  payrollReference?: string;
  payrollRunId?: string;
  payrollRun?: string;
  payrollPeriod?: string;
  payrollDate?: string;
  month?: string;
  year?: string | number;
  monthYear?: string;
  cutoff?: string;
  cutoffType?: string;
  cutoffLabel?: string;
  cutoffName?: string;
  periodCovered?: string;
  dateFrom?: string;
  dateTo?: string;
};

type LeavePolicy = {
  id: string;
  leaveType: string;
  applicableTo: string;
  genderApplicability: string;
  employmentStatusApplicability: string;
  specificEmployeeNos?: string[];
  annualDays: number;
  eligibilityMonths: number;
  paid: boolean;
  convertible: boolean;
  carryOver: boolean;
  maxCarryOverDays: number;
  replenishesYearEnd: boolean;
  requiresApproval: boolean;
  approverLevel: string;
  requiresAttachment: boolean;
  noticePeriodDays: number;
  allowHalfDay: boolean;
  allowNegativeBalance: boolean;
  deductIfUnpaid: boolean;
  governmentMandated: boolean;
  active: boolean;
  policyStatus?: "Draft" | "Saved" | "Checked" | "Approved";
  preparedAt?: string;
  preparedBy?: string;
  checkedAt?: string;
  checkedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  archived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  saved?: boolean;
};
// Used for fallback if no user is recorded for audit trail fields
const FALLBACK_AUDIT_USER = "HR / Admin User";

function getAuditUserName() {
  const currentUser = getCurrentAdminUser();
  return currentUser?.name || currentUser?.email || FALLBACK_AUDIT_USER;
}

type LeaveRequestStatus =
  | "Pending Manager Approval"
  | "Pending HR Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled";

type LeaveRequest = {
  id: string;
  employeeNo: string;
  leaveType: string;
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  reason?: string;
  status: LeaveRequestStatus;
  managerApprovedAt?: string;
  hrApprovedAt?: string;
  createdAt: string;
};

type LeaveConversion = {
  id: string;
  employeeNo: string;
  employeeName: string;
  leaveType: string;
  year: string;
  convertibleDays: number;
  dailyRate: number;
  amount: number;
  payrollReference: string;
  status: "Draft" | "Posted";
  createdAt: string;
};

type LeaveMonetizationRequest = {
  id: string;
  employeeNo: string;
  employeeName: string;
  leaveType: string;
  requestedDays: number;
  reason?: string;
  dateFiled: string;
  managerApprovedAt?: string;
  hrApprovedAt?: string;
  payrollReference?: string;
  status: "Pending Manager Approval" | "Pending HR Approval" | "Approved" | "Assigned to Payroll" | "Posted" | "Rejected";
  createdAt: string;
};

type BalanceRow = {
  employeeNo: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  hireDate: string;
  leaveType: string;
  eligibilityDate: string;
  eligible: boolean;
  annualDays: number;
  earned: number;
  approvedUsed: number;
  pending: number;
  available: number;
  convertible: number;
  requestCount: number;
  dailyRate: number;
  policy: LeavePolicy;
};

const LEAVE_REQUESTS_STORAGE_KEY = "leaveRequests";

const LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY = "leaveMonetizationRequests";
const LEAVE_MONETIZATION_WINDOW_STORAGE_KEY = "leaveMonetizationWindow";

const LEAVE_WORKING_DAYS_STORAGE_KEY = "leaveWorkingDaysSettings";
const LEAVE_WORKING_DAYS_LOCKED_STORAGE_KEY = "leaveWorkingDaysSettingsLocked";

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
const WEEK_DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const DEFAULT_POLICIES: LeavePolicy[] = [
  {
    id: "SIL",
    leaveType: "Service Incentive Leave",
    applicableTo: "Covered employees",
    genderApplicability: "All",
    employmentStatusApplicability: "Eligible after 1 year",
    annualDays: 5,
    eligibilityMonths: 12,
    paid: true,
    convertible: true,
    carryOver: false,
    maxCarryOverDays: 0,
    replenishesYearEnd: true,
    requiresApproval: true,
    approverLevel: "Manager + HR",
    requiresAttachment: false,
    noticePeriodDays: 0,
    allowHalfDay: true,
    allowNegativeBalance: false,
    deductIfUnpaid: false,
    governmentMandated: true,
    active: true,
    policyStatus: "Approved",
    preparedAt: new Date().toISOString(),
    // Use fallback audit user for default, not "System"
    preparedBy: FALLBACK_AUDIT_USER,
    checkedAt: new Date().toISOString(),
    checkedBy: FALLBACK_AUDIT_USER,
    approvedAt: new Date().toISOString(),
    approvedBy: FALLBACK_AUDIT_USER,
    saved: true,
  },
];

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[₱,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}


function getEmployeeName(employee: Employee) {
  if (employee.employeeName) return employee.employeeName;
  return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(", ") || employee.employeeNo;
}

function addMonths(dateValue: string, months: number) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function isEligible(hireDate: string, eligibilityMonths: number) {
  if (!hireDate) return false;
  const eligibilityDate = addMonths(hireDate, eligibilityMonths);
  if (!eligibilityDate) return false;
  return new Date(eligibilityDate) <= new Date();
}

function getDailyRate(employee: Employee) {
  const dailyRate = money(employee.dailyRate);
  if (dailyRate > 0) return dailyRate;

  const basicPay = money(employee.basicPay);
  if (basicPay > 0) return basicPay / 26;

  const hourlyRate = money(employee.hourlyRate);
  if (hourlyRate > 0) return hourlyRate * 8;

  return 0;
}

function getEmployeeEmploymentStatus(employee: Employee) {
  return employee.employmentStatus || employee.employmentClassification || employee.employeeType || "";
}

function policyAppliesToEmployee(policy: LeavePolicy, employee: Employee) {
  const mode = policy.applicableTo || "All employees";
  const ruleValue = policy.employmentStatusApplicability || "";

  if (mode === "All employees") return true;

  if (mode === "By department") {
    return Boolean(ruleValue) && (employee.department || "") === ruleValue;
  }

  if (mode === "By gender") {
    return Boolean(ruleValue) && (employee.gender || "") === ruleValue;
  }

  if (mode === "By employment status") {
    return Boolean(ruleValue) && getEmployeeEmploymentStatus(employee) === ruleValue;
  }

  if (mode === "Specific employees") {
    return (policy.specificEmployeeNos || []).includes(employee.employeeNo);
  }

  return true;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function monthIndexFromName(value?: string | number) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return -1;

  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  return months.findIndex((month) => month === normalized || month.startsWith(normalized.slice(0, 3)));
}

function getPayrollCutoffText(record: PayrollRecord) {
  return (
    record.payrollPeriod ||
    record.cutoffType ||
    record.cutoff ||
    record.cutoffLabel ||
    record.cutoffName ||
    record.periodCovered ||
    record.payrollReference ||
    record.payrollRun ||
    record.id ||
    "Payroll Run"
  );
}

function getPayrollDateForLeaveMonetization(record: PayrollRecord) {
  if (record.payrollDate) {
    const payrollDate = new Date(record.payrollDate);
    if (!Number.isNaN(payrollDate.getTime())) return payrollDate;
  }

  const monthYear = String(record.monthYear || "").trim();
  if (/^\d{4}-\d{2}$/.test(monthYear)) {
    const [yearText, monthText] = monthYear.split("-");
    const parsedYear = Number(yearText);
    const parsedMonthIndex = Number(monthText) - 1;

    if (Number.isFinite(parsedYear) && parsedYear > 0 && parsedMonthIndex >= 0 && parsedMonthIndex <= 11) {
      const cutoffText = getPayrollCutoffText(record).toLowerCase();
      const cutoffDay = cutoffText.includes("second") || cutoffText.includes("2nd") ? 28 : 15;
      return new Date(parsedYear, parsedMonthIndex, cutoffDay);
    }
  }

  const parsedYear = Number(String(record.year || "").trim());
  const parsedMonthIndex = monthIndexFromName(record.month);

  if (Number.isFinite(parsedYear) && parsedYear > 0 && parsedMonthIndex >= 0) {
    const cutoffText = getPayrollCutoffText(record).toLowerCase();
    const cutoffDay = cutoffText.includes("second") || cutoffText.includes("2nd") ? 28 : 15;
    return new Date(parsedYear, parsedMonthIndex, cutoffDay);
  }

  const fallbackDateSource = record.dateTo || record.dateFrom || "";
  if (fallbackDateSource) {
    const fallbackDate = new Date(fallbackDateSource);
    if (!Number.isNaN(fallbackDate.getTime())) return fallbackDate;
  }

  return null;
}

function getRequestDateFrom(request: LeaveRequest) {
  return request.dateFrom || request.startDate || "";
}

function getRequestDateTo(request: LeaveRequest) {
  return request.dateTo || request.endDate || "";
}

function getRequestDays(request: LeaveRequest) {
  const explicitDays = money(request.days);
  if (explicitDays > 0) return explicitDays;

  const from = getRequestDateFrom(request);
  const to = getRequestDateTo(request);
  if (!from || !to) return 0;

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

function getRequestWorkingDays(request: LeaveRequest, workingDays: number[] = DEFAULT_WORKING_DAYS) {
  const from = getRequestDateFrom(request);
  const to = getRequestDateTo(request);
  if (!from || !to) return 0;

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const allowedDays = new Set(workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS);
  let countedDays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (allowedDays.has(cursor.getDay())) countedDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return countedDays;
}

function getStatusClass(status: LeaveRequestStatus | LeaveConversion["status"]) {
  if (status === "Approved" || status === "Posted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Rejected" || status === "Cancelled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "Pending HR Approval") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getReadableAccentTextColor(accentColor: string, preferredTextColor: string) {
  const hex = accentColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return preferredTextColor || "#0f172a";

  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.58 ? "#0f172a" : preferredTextColor || "#ffffff";
}

function EligibilityBadge({ eligible, eligibilityDate }: { eligible: boolean; eligibilityDate?: string }) {
  return (
    <span
      className={`inline-flex min-w-[92px] items-center justify-center rounded-full border px-3 py-1.5 text-xs font-black leading-none whitespace-nowrap ${
        eligible
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {eligible ? "Eligible" : eligibilityDate ? `Not yet • ${formatDate(eligibilityDate)}` : "Not yet"}
    </span>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div
      className="rounded-xl bg-white px-4 py-3 shadow-[0_10px_24px_-24px_rgba(8,47,73,0.72)]"
      style={{
        borderTop: "1px solid #e2e8f0",
        borderRight: "1px solid #e2e8f0",
        borderBottom: "1px solid #e2e8f0",
        borderLeft: "4px solid var(--leave-accent)",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
      {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
    </div>
  );
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-semibold text-slate-700">
      {children} {required ? <span className="text-red-600">*</span> : null}
    </span>
  );
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 ${props.className || "bg-white text-slate-900 min-w-0"}`}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 ${props.className || "bg-white text-slate-900 min-w-0"}`}
    />
  );
}

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState<"balances" | "requests" | "policies" | "archivedPolicies" | "conversion" | "posted">("balances");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>(DEFAULT_POLICIES);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [monetizationRequests, setMonetizationRequests] = useState<LeaveMonetizationRequest[]>([]);
  const [conversions, setConversions] = useState<LeaveConversion[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [conversionYear, setConversionYear] = useState("");
  const [conversionPayrollReference, setConversionPayrollReference] = useState("");
  const [showConversionDrafts, setShowConversionDrafts] = useState(false);
  const [expandedEmployeeNo, setExpandedEmployeeNo] = useState<string | null>(null);
  const [specificEmployeesPolicyId, setSpecificEmployeesPolicyId] = useState<string | null>(null);
  const [specificEmployeeSearch, setSpecificEmployeeSearch] = useState("");
  const [specificEmployeePage, setSpecificEmployeePage] = useState(1);
  const [showPolicyColumnGuide, setShowPolicyColumnGuide] = useState(false);
  const [workingDays, setWorkingDays] = useState<number[]>(DEFAULT_WORKING_DAYS);
  const [savedWorkingDays, setSavedWorkingDays] = useState<number[]>(DEFAULT_WORKING_DAYS);
  const [workingDaysLocked, setWorkingDaysLocked] = useState(true);
  const [monetizationWindowFrom, setMonetizationWindowFrom] = useState("");
  const [monetizationWindowTo, setMonetizationWindowTo] = useState("");
  const [monetizationWindowLocked, setMonetizationWindowLocked] = useState(true);
  const [selectedMonetizationRequestId, setSelectedMonetizationRequestId] = useState("");
  const [selectedMonetizationPayrollMonth, setSelectedMonetizationPayrollMonth] = useState("");
  const [selectedMonetizationPayrollYear, setSelectedMonetizationPayrollYear] = useState(String(new Date().getFullYear()));
  const [selectedMonetizationPayrollCutoff, setSelectedMonetizationPayrollCutoff] = useState("");
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    loadData();
    function refresh() {
      loadData();
    }
    window.addEventListener("employees-updated", refresh);
    window.addEventListener("leave-requests-updated", refresh);
    window.addEventListener("leave-monetization-requests-updated", refresh);
    window.addEventListener("leave-monetization-window-updated", refresh);
    window.addEventListener("payroll-records-updated", refresh);
    window.addEventListener(`${storageKeys.employees}-updated`, refresh as EventListener);
    window.addEventListener(`${storageKeys.leavePolicies}-updated`, refresh as EventListener);
    window.addEventListener(`${LEAVE_REQUESTS_STORAGE_KEY}-updated`, refresh as EventListener);
    window.addEventListener(`${LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY}-updated`, refresh as EventListener);
    window.addEventListener(`${LEAVE_MONETIZATION_WINDOW_STORAGE_KEY}-updated`, refresh as EventListener);
    window.addEventListener(`${storageKeys.leaveConversions}-updated`, refresh as EventListener);
    window.addEventListener(`${storageKeys.payrollRecords}-updated`, refresh as EventListener);
    return () => {
      window.removeEventListener("employees-updated", refresh);
      window.removeEventListener("leave-requests-updated", refresh);
      window.removeEventListener("leave-monetization-requests-updated", refresh);
      window.removeEventListener("leave-monetization-window-updated", refresh);
      window.removeEventListener("payroll-records-updated", refresh);
      window.removeEventListener(`${storageKeys.employees}-updated`, refresh as EventListener);
      window.removeEventListener(`${storageKeys.leavePolicies}-updated`, refresh as EventListener);
      window.removeEventListener(`${LEAVE_REQUESTS_STORAGE_KEY}-updated`, refresh as EventListener);
      window.removeEventListener(`${LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY}-updated`, refresh as EventListener);
      window.removeEventListener(`${LEAVE_MONETIZATION_WINDOW_STORAGE_KEY}-updated`, refresh as EventListener);
      window.removeEventListener(`${storageKeys.leaveConversions}-updated`, refresh as EventListener);
      window.removeEventListener(`${storageKeys.payrollRecords}-updated`, refresh as EventListener);
    };
  }, []);

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

  async function loadData() {
    const [employees, policies, requests, monetizationRequests, monetizationWindow, conversions, payrollRecords, workingDays, workingDaysLocked] = await Promise.all([
      getCollectionItems<Employee>(storageKeys.employees),
      getDataArray<LeavePolicy>(storageKeys.leavePolicies, DEFAULT_POLICIES),
      getDataArray<LeaveRequest>(LEAVE_REQUESTS_STORAGE_KEY, []),
      getDataArray<LeaveMonetizationRequest>(LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY, []),
      getConfigItem<{ dateFrom?: string; dateTo?: string; locked?: boolean }>(LEAVE_MONETIZATION_WINDOW_STORAGE_KEY, { dateFrom: "", dateTo: "", locked: true }),
      getDataArray<LeaveConversion>(storageKeys.leaveConversions, []),
      getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
      getDataArray<number>(LEAVE_WORKING_DAYS_STORAGE_KEY, DEFAULT_WORKING_DAYS),
      getConfigItem<{ value: boolean }>(LEAVE_WORKING_DAYS_LOCKED_STORAGE_KEY, { value: true }),
    ]);
    setEmployees(employees);
    setPolicies(policies);
    setRequests(requests);
    setMonetizationRequests(monetizationRequests);
    setMonetizationWindowFrom(monetizationWindow.dateFrom || "");
    setMonetizationWindowTo(monetizationWindow.dateTo || "");
    setMonetizationWindowLocked(monetizationWindow.locked !== false);
    setConversions(conversions);
    setPayrollRecords(payrollRecords);
    setWorkingDays(workingDays);
    setSavedWorkingDays(workingDays);
    setWorkingDaysLocked(workingDaysLocked.value !== false);
  }

  function buildSelectedMonetizationPayrollReference() {
    const monthText = selectedMonetizationPayrollMonth.trim();
    const yearText = selectedMonetizationPayrollYear.trim();
    const cutoffText = selectedMonetizationPayrollCutoff.trim();
    if (!monthText || !yearText || !cutoffText) return "";
    return `${cutoffText} • ${monthText} ${yearText}`;
  }

  function updatePolicies(next: LeavePolicy[]) {
    setPolicies(next);
    setDataArray(storageKeys.leavePolicies, next);
  }

  function updateRequests(next: LeaveRequest[]) {
    setRequests(next);
    setDataArray(LEAVE_REQUESTS_STORAGE_KEY, next);
    window.dispatchEvent(new Event("leave-requests-updated"));
  }

  function updateMonetizationRequests(next: LeaveMonetizationRequest[]) {
    setMonetizationRequests(next);
    setDataArray(LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY, next);
    window.dispatchEvent(new Event("leave-monetization-requests-updated"));
  }

  function saveMonetizationWindow() {
    if (!monetizationWindowFrom || !monetizationWindowTo) {
      window.alert("Please select the filing start and end dates for leave monetization.");
      return;
    }

    if (new Date(monetizationWindowTo) < new Date(monetizationWindowFrom)) {
      window.alert("The filing end date cannot be earlier than the filing start date.");
      return;
    }

    setMonetizationWindowLocked(true);
    setConfigItem(LEAVE_MONETIZATION_WINDOW_STORAGE_KEY, {
      dateFrom: monetizationWindowFrom,
      dateTo: monetizationWindowTo,
      locked: true,
    });
    window.dispatchEvent(new Event("leave-monetization-window-updated"));
    logAudit({ action: "SAVED", entityType: "Settings", entityId: "leave-monetization-window", entityName: "Leave Monetization Window", details: `Filing period: ${monetizationWindowFrom} to ${monetizationWindowTo}` });
  }

  function unlockMonetizationWindow() {
    const confirmed = window.confirm("Edit the leave monetization filing window? Employees will follow this filing range in the portal.");
    if (!confirmed) return;
    setMonetizationWindowLocked(false);
    setConfigItem(LEAVE_MONETIZATION_WINDOW_STORAGE_KEY, {
      dateFrom: monetizationWindowFrom,
      dateTo: monetizationWindowTo,
      locked: false,
    });
  }

  function moveMonetizationStatus(id: string, nextStatus: LeaveMonetizationRequest["status"]) {
    updateMonetizationRequests(
      monetizationRequests.map((request) => {
        if (request.id !== id) return request;
        return {
          ...request,
          status: nextStatus,
          managerApprovedAt: nextStatus === "Pending HR Approval" ? new Date().toISOString() : request.managerApprovedAt,
          hrApprovedAt: nextStatus === "Approved" ? new Date().toISOString() : request.hrApprovedAt,
        };
      })
    );
  }

function assignMonetizationToPayroll() {
    if (!selectedMonetizationRequestId) {
      window.alert("Please select an approved monetization request.");
      return;
    }

    const payrollReference = buildSelectedMonetizationPayrollReference();
    if (!payrollReference) {
      window.alert("Please select the payroll month, year, and cutoff where the monetized leave will be applied.");
      return;
    }

    updateMonetizationRequests(
      monetizationRequests.map((request) =>
        request.id === selectedMonetizationRequestId
          ? { ...request, payrollReference, status: "Assigned to Payroll" }
          : request
      )
    );
    setSelectedMonetizationRequestId("");
    setSelectedMonetizationPayrollMonth("");
    setSelectedMonetizationPayrollCutoff("");
  }

  async function postMonetizationToPayroll(requestId: string) {
    const request = monetizationRequests.find((item) => item.id === requestId);
    if (!request) return;
    if (!request.payrollReference) {
      window.alert("Please assign this approved monetization request to a payroll run first.");
      return;
    }

    const employee = employees.find((item) => item.employeeNo === request.employeeNo);
    const dailyRate = employee ? getDailyRate(employee) : 0;
    if (dailyRate <= 0) {
      window.alert("Daily rate is missing. Please update the employee rate before posting monetized leave to payroll.");
      return;
    }

    const amount = request.requestedDays * dailyRate;
    const confirmed = window.confirm(`Post ${peso.format(amount)} monetized leave for ${request.employeeName} to payroll ${request.payrollReference}?`);
    if (!confirmed) return;

    const existingAdjustments = await getDataArray<any>(storageKeys.payrollAdjustments, []);
    const adjustment = {
      id: `ML-${Date.now()}`,
      adjustmentBatchId: `MONETIZED-LEAVE-${request.payrollReference}`,
      payrollReference: request.payrollReference,
      employeeId: request.employeeNo,
      employeeName: request.employeeName,
      adjustmentCategory: "Monetized Leave",
      adjustmentLabel: `${request.leaveType} Monetization`,
      adjustmentType: "Addition",
      hours: 0,
      originalHours: 0,
      rate: dailyRate,
      amount,
      taxTreatment: "Taxable",
      source: "Leave Management - Monetization",
      sourceId: request.id,
      createdAt: new Date().toISOString(),
    };

    await setDataArray(storageKeys.payrollAdjustments, [adjustment, ...existingAdjustments]);
    updateMonetizationRequests(monetizationRequests.map((item) => (item.id === requestId ? { ...item, status: "Posted" } : item)));
    window.dispatchEvent(new Event("payroll-adjustments-updated"));
    window.dispatchEvent(new Event("leave-monetization-requests-updated"));
  }

  function toggleWorkingDay(dayValue: number) {
    if (workingDaysLocked) return;

    const nextWorkingDays = workingDays.includes(dayValue)
      ? workingDays.filter((day) => day !== dayValue)
      : [...workingDays, dayValue].sort((a, b) => a - b);

    setWorkingDays(nextWorkingDays.length > 0 ? nextWorkingDays : DEFAULT_WORKING_DAYS);
  }

  function saveWorkingDaysSettings() {
    const safeWorkingDays = workingDays.length > 0 ? workingDays : DEFAULT_WORKING_DAYS;
    setWorkingDays(safeWorkingDays);
    setSavedWorkingDays(safeWorkingDays);
    setDataArray(LEAVE_WORKING_DAYS_STORAGE_KEY, safeWorkingDays);
    setWorkingDaysLocked(true);
    setConfigItem(LEAVE_WORKING_DAYS_LOCKED_STORAGE_KEY, { value: true });
  }

  function unlockWorkingDaysSettings() {
    const confirmed = window.confirm("Edit working days settings? This changes the Working Days calculation for leave monitoring.");
    if (!confirmed) return;
    setWorkingDaysLocked(false);
    setConfigItem(LEAVE_WORKING_DAYS_LOCKED_STORAGE_KEY, { value: false });
  }

  function cancelWorkingDaysSettingsEdit() {
    setWorkingDays(savedWorkingDays);
    setWorkingDaysLocked(true);
    setConfigItem(LEAVE_WORKING_DAYS_LOCKED_STORAGE_KEY, { value: true });
  }

  function updateConversions(next: LeaveConversion[]) {
    setConversions(next);
    setDataArray(storageKeys.leaveConversions, next);
  }

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.archived !== true), [employees]);

  const balanceRows = useMemo<BalanceRow[]>(() => {
    return activeEmployees.flatMap((employee) =>
      policies
        .filter(
          (policy) =>
            policy.saved === true &&
            policy.policyStatus === "Approved" &&
            policy.active !== false &&
            policy.archived !== true &&
            policyAppliesToEmployee(policy, employee)
        )
        .map((policy) => {
          const employeeRequests = requests.filter(
            (request) => request.employeeNo === employee.employeeNo && request.leaveType === policy.leaveType
          );
          const approvedUsed = employeeRequests
            .filter((request) => request.status === "Approved")
            .reduce((sum, request) => sum + getRequestDays(request), 0);
          const pending = employeeRequests
            .filter(
              (request) =>
                request.status === "Pending Manager Approval" ||
                request.status === "Pending HR Approval"
            )
            .reduce((sum, request) => sum + getRequestDays(request), 0);
          const eligible = isEligible(employee.hireDate || "", policy.eligibilityMonths);
          const earned = eligible ? policy.annualDays : 0;
          const available = Math.max(0, earned - approvedUsed - pending);
          const convertible = policy.convertible ? Math.max(0, earned - approvedUsed) : 0;

          return {
            employeeNo: employee.employeeNo,
            employeeName: getEmployeeName(employee),
            department: employee.department || "—",
            jobTitle: employee.jobTitle || "—",
            hireDate: employee.hireDate || "",
            leaveType: policy.leaveType,
            eligibilityDate: addMonths(employee.hireDate || "", policy.eligibilityMonths),
            eligible,
            annualDays: policy.annualDays,
            earned,
            approvedUsed,
            pending,
            available,
            convertible,
            requestCount: employeeRequests.length,
            dailyRate: getDailyRate(employee),
            policy,
          };
        })
    );
  }, [activeEmployees, policies, requests]);

  const employeeLeaveGroups = useMemo(() => {
    return activeEmployees.map((employee) => {
      const rows = balanceRows.filter((row) => row.employeeNo === employee.employeeNo);
      const totalAvailable = rows.reduce((sum, row) => sum + row.available, 0);
      const totalConvertible = rows.reduce((sum, row) => sum + row.convertible, 0);
      const totalPending = rows.reduce((sum, row) => sum + row.pending, 0);
      const totalApprovedUsed = rows.reduce((sum, row) => sum + row.approvedUsed, 0);
      const totalRequests = rows.reduce((sum, row) => sum + row.requestCount, 0);
      const estimatedConversionAmount = rows.reduce((sum, row) => sum + row.convertible * row.dailyRate, 0);

      return {
        employee,
        employeeNo: employee.employeeNo,
        employeeName: getEmployeeName(employee),
        department: employee.department || "—",
        jobTitle: employee.jobTitle || "—",
        hireDate: employee.hireDate || "",
        rows,
        totalAvailable,
        totalConvertible,
        totalPending,
        totalApprovedUsed,
        totalRequests,
        estimatedConversionAmount,
      };
    });
  }, [activeEmployees, balanceRows]);

  const summary = useMemo(() => {
    const pendingManager = requests.filter((request) => request.status === "Pending Manager Approval").length;
    const pendingHr = requests.filter((request) => request.status === "Pending HR Approval").length;
    const approved = requests.filter((request) => request.status === "Approved").length;
    const convertibleEmployees = employeeLeaveGroups.filter((group) => group.totalConvertible > 0).length;
    const estimatedConversion = employeeLeaveGroups.reduce((sum, group) => sum + group.estimatedConversionAmount, 0);
    return { pendingManager, pendingHr, approved, convertibleEmployees, estimatedConversion };
  }, [requests, employeeLeaveGroups]);

const payrollRunOptions = useMemo(() => {
  const optionMap = new Map<string, string>();
  const filingWindowEnd = monetizationWindowTo ? new Date(monetizationWindowTo) : null;

  if (filingWindowEnd && !Number.isNaN(filingWindowEnd.getTime())) {
    filingWindowEnd.setHours(23, 59, 59, 999);
  }

  payrollRecords.forEach((record) => {
    const reference =
      record.payrollReference ||
      record.payrollRun ||
      record.payrollRunId ||
      record.id ||
      `${record.payrollPeriod || "Payroll Run"}-${record.monthYear || `${record.month || ""}-${record.year || ""}`}`;

    if (!reference) return;

    const payrollDate = getPayrollDateForLeaveMonetization(record);

    if (filingWindowEnd && !Number.isNaN(filingWindowEnd.getTime())) {
      if (!payrollDate || Number.isNaN(payrollDate.getTime()) || payrollDate <= filingWindowEnd) return;
    }

    const cutoffText = getPayrollCutoffText(record);
    const monthYear = payrollDate && !Number.isNaN(payrollDate.getTime())
      ? payrollDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" })
      : "No payroll date";

    optionMap.set(reference, `${cutoffText} • ${monthYear}`);
  });

  return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
}, [payrollRecords, monetizationWindowTo]);

function getPayrollDisplayForReference(reference?: string) {
  const payrollReference = String(reference || "").trim();
  if (!payrollReference) return "—";

  const matchedPayroll = payrollRecords.find((record) => {
    const candidates = [
      record.payrollReference,
      record.payrollRun,
      record.payrollRunId,
      record.id,
      `${record.payrollPeriod || "Payroll Run"}-${record.monthYear || `${record.month || ""}-${record.year || ""}`}`,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return candidates.includes(payrollReference);
  });

  if (!matchedPayroll) return payrollReference;

  const cutoffText = getPayrollCutoffText(matchedPayroll);
  const date = getPayrollDateForLeaveMonetization(matchedPayroll);
  const monthYear = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-PH", { month: "long", year: "numeric" })
    : "No payroll date";

  return `${cutoffText} • ${monthYear}`;
}

  const departmentOptions = useMemo(() => {
    return Array.from(new Set(activeEmployees.map((employee) => employee.department || "").filter(Boolean))).sort();
  }, [activeEmployees]);

  const employmentStatusOptions = useMemo(() => {
    return Array.from(new Set(activeEmployees.map((employee) => getEmployeeEmploymentStatus(employee)).filter(Boolean))).sort();
  }, [activeEmployees]);

  const genderOptions = useMemo(() => {
    return Array.from(new Set(activeEmployees.map((employee) => employee.gender || "").filter(Boolean))).sort();
  }, [activeEmployees]);

  const selectedSpecificPolicy = useMemo(() => {
    return policies.find((policy) => policy.id === specificEmployeesPolicyId) || null;
  }, [policies, specificEmployeesPolicyId]);

  const filteredSpecificEmployees = useMemo(() => {
    const search = specificEmployeeSearch.trim().toLowerCase();
    if (!search) return activeEmployees;

    return activeEmployees.filter((employee) => {
      const name = getEmployeeName(employee).toLowerCase();
      const employeeNo = employee.employeeNo.toLowerCase();
      const department = (employee.department || "").toLowerCase();
      const status = getEmployeeEmploymentStatus(employee).toLowerCase();
      return name.includes(search) || employeeNo.includes(search) || department.includes(search) || status.includes(search);
    });
  }, [activeEmployees, specificEmployeeSearch]);

  const specificEmployeesPerPage = 50;
  const specificEmployeeTotalPages = Math.max(1, Math.ceil(filteredSpecificEmployees.length / specificEmployeesPerPage));
  const pagedSpecificEmployees = filteredSpecificEmployees.slice(
    (specificEmployeePage - 1) * specificEmployeesPerPage,
    specificEmployeePage * specificEmployeesPerPage
  );

  function updatePolicy(policyId: string, field: keyof LeavePolicy, value: string | number | boolean) {
    updatePolicies(policies.map((policy) => (policy.id === policyId ? { ...policy, [field]: value } : policy)));
  }

  function changePolicyApplicability(policyId: string, nextMode: string) {
    updatePolicies(
      policies.map((policy) =>
        policy.id === policyId
          ? {
              ...policy,
              applicableTo: nextMode,
              employmentStatusApplicability: nextMode === "All employees" ? "All active employees" : "",
              specificEmployeeNos: nextMode === "Specific employees"
                ? activeEmployees.map((employee) => employee.employeeNo)
                : [],
            }
          : policy
      )
    );
  }

  function toggleSpecificEmployee(policyId: string, employeeNo: string) {
    updatePolicies(
      policies.map((policy) => {
        if (policy.id !== policyId) return policy;
        const current = policy.specificEmployeeNos || [];
        const next = current.includes(employeeNo)
          ? current.filter((item) => item !== employeeNo)
          : [...current, employeeNo];
        return { ...policy, specificEmployeeNos: next };
      })
    );
  }

  function openSpecificEmployeeSelector(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);

    if (policy?.applicableTo === "Specific employees" && (policy.specificEmployeeNos || []).length === 0) {
      updatePolicies(
        policies.map((item) =>
          item.id === policyId
            ? { ...item, specificEmployeeNos: activeEmployees.map((employee) => employee.employeeNo) }
            : item
        )
      );
    }

    setSpecificEmployeesPolicyId(policyId);
    setSpecificEmployeeSearch("");
    setSpecificEmployeePage(1);
  }

  function closeSpecificEmployeeSelector() {
    setSpecificEmployeesPolicyId(null);
    setSpecificEmployeeSearch("");
    setSpecificEmployeePage(1);
  }

  function addPolicy() {
    updatePolicies([
      ...policies,
      {
        id: `POL-${Date.now()}`,
        leaveType: "New Leave Type",
        applicableTo: "All employees",
        genderApplicability: "All",
        employmentStatusApplicability: "All active employees",
        annualDays: 0,
        eligibilityMonths: 0,
        paid: true,
        convertible: false,
        carryOver: false,
        maxCarryOverDays: 0,
        replenishesYearEnd: true,
        requiresApproval: true,
        approverLevel: "Manager + HR",
        requiresAttachment: false,
        noticePeriodDays: 0,
        allowHalfDay: true,
        allowNegativeBalance: false,
        deductIfUnpaid: false,
        governmentMandated: false,
        active: true,
        policyStatus: "Draft",
        saved: false,
      },
    ]);
  }

  function savePolicy(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;

    if (!policy.leaveType.trim()) {
      window.alert("Leave Type is required before saving.");
      return;
    }

    const confirmed = window.confirm(
      "Save this leave policy? Once saved, the fields will become locked to protect the leave setup."
    );
    if (!confirmed) return;

    const savingPolicy = policies.find((item) => item.id === policyId);
    updatePolicies(
      policies.map((item) =>
        item.id === policyId
          ? {
              ...item,
              leaveType: item.leaveType.trim(),
              saved: true,
              policyStatus: "Saved",
              preparedAt: new Date().toISOString(),
              preparedBy: getAuditUserName(),
            }
          : item
      )
    );
    logAudit({ action: "SAVED", entityType: "Settings", entityId: policyId, entityName: `Leave Policy – ${savingPolicy?.leaveType || policyId}`, details: "Leave policy saved and locked" });
  }

  function checkPolicy(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;

    if (policy.saved !== true) {
      window.alert("Please save and lock the leave policy before marking it as checked.");
      return;
    }

    const confirmed = window.confirm(`Mark ${policy.leaveType} as checked?`);
    if (!confirmed) return;

    updatePolicies(
      policies.map((item) =>
        item.id === policyId
          ? {
              ...item,
              policyStatus: "Checked",
              checkedAt: new Date().toISOString(),
              checkedBy: getAuditUserName(),
            }
          : item
      )
    );
    logAudit({ action: "CHECKED", entityType: "Settings", entityId: policyId, entityName: `Leave Policy – ${policy.leaveType}`, details: "Leave policy marked as checked" });
  }

  function approvePolicy(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;

    if (policy.policyStatus !== "Checked") {
      window.alert("Please mark this leave policy as checked before approving it.");
      return;
    }

    const confirmed = window.confirm(
      `Approve ${policy.leaveType}? Approved policies become the official leave setup for balances and requests.`
    );
    if (!confirmed) return;

    updatePolicies(
      policies.map((item) =>
        item.id === policyId
          ? {
              ...item,
              policyStatus: "Approved",
              approvedAt: new Date().toISOString(),
              approvedBy: getAuditUserName(),
            }
          : item
      )
    );
    logAudit({ action: "APPROVED", entityType: "Settings", entityId: policyId, entityName: `Leave Policy – ${policy.leaveType}`, details: "Leave policy approved" });
  }

  function archivePolicy(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;

    if (policy.archived === true) {
      window.alert("This leave policy is already archived.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${policy.leaveType}? This will keep the policy in records but hide it from active leave balances and future use.`
    );
    if (!confirmed) return;

    updatePolicies(
      policies.map((item) =>
        item.id === policyId
          ? {
              ...item,
              active: false,
              policyStatus: item.policyStatus || "Saved",
              archived: true,
              archivedAt: new Date().toISOString(),
              archivedBy: getAuditUserName(),
            }
          : item
      )
    );
  }

  function restorePolicy(policyId: string) {
    const policy = policies.find((item) => item.id === policyId);
    if (!policy) return;

    if (policy.archived !== true) {
      window.alert("This leave policy is already available.");
      return;
    }

    const confirmed = window.confirm(
      `Restore ${policy.leaveType}? This will make the policy available again and allow it to appear in active leave balances once active.`
    );
    if (!confirmed) return;

    updatePolicies(
      policies.map((item) =>
        item.id === policyId
          ? { ...item, active: true, archived: false, archivedAt: undefined }
          : item
      )
    );
  }

  function moveRequestStatus(id: string, nextStatus: LeaveRequestStatus) {
    updateRequests(
      requests.map((request) => {
        if (request.id !== id) return request;
        return {
          ...request,
          status: nextStatus,
          managerApprovedAt: nextStatus === "Pending HR Approval" ? new Date().toISOString() : request.managerApprovedAt,
          hrApprovedAt: nextStatus === "Approved" ? new Date().toISOString() : request.hrApprovedAt,
        };
      })
    );
  }

  function generateConversionRows() {
    if (!conversionYear.trim()) {
      window.alert("Please enter the conversion year.");
      return;
    }
    if (!conversionPayrollReference.trim()) {
      window.alert("Please select the target payroll run/reference from Payroll Records.");
      return;
    }

    const existingKeys = new Set(conversions.map((item) => `${item.year}-${item.employeeNo}-${item.leaveType}`));
    const nextRows = balanceRows
      .filter((row) => row.policy.convertible && row.convertible > 0 && row.dailyRate > 0)
      .filter((row) => !existingKeys.has(`${conversionYear}-${row.employeeNo}-${row.leaveType}`))
      .map<LeaveConversion>((row) => ({
        id: `LC-${Date.now()}-${row.employeeNo}-${row.leaveType}`,
        employeeNo: row.employeeNo,
        employeeName: row.employeeName,
        leaveType: row.leaveType,
        year: conversionYear.trim(),
        convertibleDays: row.convertible,
        dailyRate: row.dailyRate,
        amount: row.convertible * row.dailyRate,
        payrollReference: conversionPayrollReference.trim(),
        status: "Draft",
        createdAt: new Date().toISOString(),
      }));

    if (nextRows.length === 0) {
      window.alert("No new convertible leave balances found for this year.");
      return;
    }

    updateConversions([...nextRows, ...conversions]);
    setShowConversionDrafts(true);
    window.alert("Leave conversion rows generated.");
  }

  async function postConversion(conversionId: string) {
    const conversion = conversions.find((item) => item.id === conversionId);
    if (!conversion) return;

    const confirmed = window.confirm(`Post ${peso.format(conversion.amount)} leave conversion for ${conversion.employeeName}?`);
    if (!confirmed) return;

    const existingAdjustments = await getDataArray<any>(storageKeys.payrollAdjustments, []);
    const adjustment = {
      id: `LCA-${Date.now()}`,
      adjustmentBatchId: `LEAVE-CONVERSION-${conversion.year}`,
      payrollReference: conversion.payrollReference,
      employeeId: conversion.employeeNo,
      employeeName: conversion.employeeName,
      adjustmentCategory: "Leave Conversion Pay",
      adjustmentLabel: `${conversion.leaveType} Conversion ${conversion.year}`,
      adjustmentType: "Addition",
      hours: 0,
      originalHours: 0,
      rate: conversion.dailyRate,
      amount: conversion.amount,
      taxTreatment: "Taxable",
      source: "Leave Management",
      sourceId: conversion.id,
      createdAt: new Date().toISOString(),
    };

    await setDataArray(storageKeys.payrollAdjustments, [adjustment, ...existingAdjustments]);
    updateConversions(conversions.map((item) => (item.id === conversionId ? { ...item, status: "Posted" } : item)));
    window.dispatchEvent(new Event("payroll-adjustments-updated"));
    window.alert("Leave conversion posted to payroll adjustments.");
  }

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle: React.CSSProperties = {
    backgroundColor: activeTheme.bannerColor,
    backgroundImage: activeTheme.bannerImageDataUrl
      ? `linear-gradient(${activeTheme.bannerColor}${bannerOverlayAlpha}, ${activeTheme.bannerColor}${bannerOverlayAlpha}), url(${activeTheme.bannerImageDataUrl})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
  const accentButtonTextColor = getReadableAccentTextColor(activeTheme.accentColor, activeTheme.bannerButtonTextColor);

  return (
    <main
      className="leave-axis-page min-h-screen px-4 py-5 text-slate-950 sm:px-6 lg:px-8"
      style={{
        "--leave-banner": activeTheme.bannerColor,
        "--leave-accent": activeTheme.accentColor,
        "--leave-banner-text": activeTheme.bannerTextColor,
        "--leave-button-text": accentButtonTextColor,
      } as React.CSSProperties}
    >
      <style>{`
        .leave-axis-page {
          background: linear-gradient(180deg, var(--leave-banner) 0%, var(--leave-banner) 290px, #f4f8fc 290px, #f4f8fc 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .leave-axis-page > section:not(.leave-axis-hero) {
          border: 1px solid rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.96) !important;
          border-radius: 16px !important;
          box-shadow: 0 14px 38px -32px rgba(8,47,73,0.78) !important;
        }

        .leave-axis-page table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: #ffffff;
        }

        .leave-axis-page thead tr {
          background: #f8fafc !important;
          color: #475569 !important;
        }

        .leave-axis-page th {
          border-color: #dbe4ef !important;
          border-left-width: 0 !important;
          border-right-width: 0 !important;
          border-top-width: 0 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          letter-spacing: 0.02em !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        .leave-axis-page td {
          border-color: #e6edf5 !important;
          border-left-width: 0 !important;
          border-right-width: 0 !important;
          border-top-width: 0 !important;
          color: #334155;
          font-size: 12px;
          line-height: 1.4;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        .leave-axis-page tbody tr:nth-child(even) {
          background: #f8fafc !important;
        }

        .leave-axis-page tbody tr:hover {
          background: #f0f9ff !important;
        }

        .leave-axis-page input,
        .leave-axis-page select,
        .leave-axis-page textarea {
          border-color: #dbe4ef !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .leave-axis-page button {
          border-radius: 10px !important;
          box-shadow: 0 10px 24px -22px rgba(8,47,73,0.75);
        }

        .leave-axis-page input:focus,
        .leave-axis-page select:focus,
        .leave-axis-page textarea:focus {
          border-color: var(--leave-accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--leave-accent) 18%, transparent), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .leave-axis-page .font-black {
          font-weight: 750 !important;
        }

        .leave-axis-page .bg-blue-700,
        .leave-axis-page .hover\\:bg-blue-800:hover {
          background-color: var(--leave-accent) !important;
          color: var(--leave-button-text) !important;
        }

        .leave-axis-page .text-blue-700 {
          color: var(--leave-accent) !important;
        }

        .leave-axis-page .border-blue-100,
        .leave-axis-page .border-blue-200 {
          border-color: color-mix(in srgb, var(--leave-accent) 28%, #dbe4ef) !important;
        }

        .leave-axis-page .bg-blue-50 {
          background-color: color-mix(in srgb, var(--leave-accent) 9%, #ffffff) !important;
        }

        .leave-axis-page .text-blue-900,
        .leave-axis-page .text-blue-950,
        .leave-axis-page .text-blue-800 {
          color: #075985 !important;
        }

        .leave-axis-page .rounded-3xl {
          border-radius: 16px !important;
        }

        .leave-axis-page .rounded-2xl {
          border-radius: 12px !important;
        }
      `}</style>

      <section
        className="leave-axis-hero relative overflow-hidden rounded-2xl border px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{
          ...bannerStyle,
          borderColor: `${activeTheme.accentColor}33`,
          color: activeTheme.bannerTextColor,
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: `${activeTheme.accentColor}24`, border: `0.5px solid ${activeTheme.accentColor}66`, color: activeTheme.bannerTextColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeTheme.accentColor }} />
                HR Operations
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                Leave Center
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Leave Management
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
              Monitor balances, approvals, policy setup, and leave monetization in one clean workspace.
            </p>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Employees</p>
              <p className="mt-1 font-semibold">{activeEmployees.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Pending HR</p>
              <p className="mt-1 font-semibold">{summary.pendingHr}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Convertible</p>
              <p className="mt-1 font-semibold">{summary.convertibleEmployees}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active Employees" value={activeEmployees.length} />
        <StatCard label="Pending Manager" value={summary.pendingManager} />
        <StatCard label="Pending HR" value={summary.pendingHr} />
        <StatCard label="Convertible Rows" value={summary.convertibleEmployees} />
        <StatCard label="Est. Conversion" value={peso.format(summary.estimatedConversion)} />
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ["balances", "Leave Balances"],
            ["requests", "Leave Requests"],
            ["policies", "Leave Policies"],
            ["archivedPolicies", "Archived Policies"],
            ["conversion", `Leave Conversion${monetizationRequests.length ? ` (${monetizationRequests.length})` : ""}`],
            ["posted", "Posted Conversions"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value as typeof activeTab)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                activeTab === value ? "bg-blue-700 text-white shadow-sm" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "balances" ? (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
              Every active employee from the Employees tab appears here once. Open an employee to view approved leave policies only. Draft, saved, checked, archived, and unapproved policies stay hidden from Leave Balances.
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <th className="border border-slate-200 px-4 py-3">Employee</th>
                    <th className="border border-slate-200 px-4 py-3">Department</th>
                    <th className="border border-slate-200 px-4 py-3">Job Title</th>
                    <th className="border border-slate-200 px-4 py-3 text-right">Open Requests</th>
                    <th className="border border-slate-200 px-4 py-3 text-right">Convertible Days</th>
                    <th className="border border-slate-200 px-4 py-3 text-right">Est. Conversion</th>
                    <th className="border border-slate-200 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeLeaveGroups.length === 0 ? (
                    <tr><td colSpan={7} className="border border-slate-200 px-4 py-8 text-center text-slate-500">No employees found yet.</td></tr>
                  ) : employeeLeaveGroups.map((group) => {
                    const isOpen = expandedEmployeeNo === group.employeeNo;
                    return (
                      <React.Fragment key={group.employeeNo}>
                        <tr key={group.employeeNo} className="odd:bg-white even:bg-slate-50">
                          <td className="border border-slate-200 px-4 py-3 font-black">
                            <div>{group.employeeName}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">Hired: {formatDate(group.hireDate)}</div>
                          </td>
                          <td className="border border-slate-200 px-4 py-3">{group.department}</td>
                          <td className="border border-slate-200 px-4 py-3">{group.jobTitle}</td>
                          <td className="border border-slate-200 px-4 py-3 text-right font-bold">{group.totalPending.toFixed(2)}</td>
                          <td className="border border-slate-200 px-4 py-3 text-right font-black text-emerald-700">{group.totalConvertible.toFixed(2)}</td>
                          <td className="border border-slate-200 px-4 py-3 text-right font-black">{peso.format(group.estimatedConversionAmount)}</td>
                          <td className="border border-slate-200 px-4 py-3">
                            <button
                              onClick={() => setExpandedEmployeeNo(isOpen ? null : group.employeeNo)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                            >
                              {isOpen ? "Hide Details" : "View Leaves"}
                            </button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr key={`${group.employeeNo}-details`}>
                            <td colSpan={7} className="border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 flex flex-col gap-1">
                                <h3 className="text-base font-black text-slate-950">Leave details for {group.employeeName}</h3>
                                <p className="text-sm text-slate-600">Balances are based on leave policies, approved requests, and pending requests. Convertible days are suggested for year-end leave conversion.</p>
                              </div>
                              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
                                  <thead>
                                    <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                                      <th className="border border-slate-200 px-4 py-3">Leave Type</th>
                                      <th className="border border-slate-200 px-4 py-3">Eligibility Date</th>
                                      <th className="border border-slate-200 px-4 py-3 min-w-[120px]">Eligible</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Annual</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Approved Used</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Pending</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Available</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Convertible</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Requests</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Daily Rate</th>
                                      <th className="border border-slate-200 px-4 py-3 text-right">Est. Conversion</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.rows.map((row) => (
                                      <tr key={`${row.employeeNo}-${row.leaveType}-detail`} className="odd:bg-white even:bg-slate-50">
                                        <td className="border border-slate-200 px-4 py-3 font-bold">{row.leaveType}</td>
                                        <td className="border border-slate-200 px-4 py-3">{formatDate(row.eligibilityDate)}</td>
                                        <td className="border border-slate-200 px-4 py-3"><EligibilityBadge eligible={row.eligible} /></td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-bold">{row.annualDays.toFixed(2)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-bold">{row.approvedUsed.toFixed(2)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-bold">{row.pending.toFixed(2)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-black text-blue-700">{row.available.toFixed(2)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-black text-emerald-700">{row.convertible.toFixed(2)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-bold">{row.requestCount}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-bold">{peso.format(row.dailyRate)}</td>
                                        <td className="border border-slate-200 px-4 py-3 text-right font-black">{peso.format(row.convertible * row.dailyRate)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "requests" ? (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
              HR monitors requests here. Calendar Days include all dates in the range. Working Days follow the settings below, so Saturday or Sunday may be counted when the company treats them as workdays. Approval flow: Manager approval → HR final approval → Approved.
            </div>
            <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-black text-blue-950">Working Days Settings</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-blue-800">
                    Choose which days count as working days for leave monitoring. Click Edit Settings first, then Save Settings to lock your changes.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      disabled={workingDaysLocked}
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                        workingDays.includes(day.value)
                          ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                          : "border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
                      } ${workingDaysLocked ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      {day.label}
                    </button>
                  ))}

                  {workingDaysLocked ? (
                    <button
                      type="button"
                      onClick={unlockWorkingDaysSettings}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Edit Settings
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={saveWorkingDaysSettings}
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800"
                      >
                        Save Settings
                      </button>
                      <button
                        type="button"
                        onClick={cancelWorkingDaysSettingsEdit}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1370px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <th className="w-[180px] border border-slate-200 px-4 py-3">Request ID</th>
                    <th className="w-[230px] border border-slate-200 px-4 py-3">Employee</th>
                    <th className="w-[160px] border border-slate-200 px-4 py-3">Leave Type</th>
                    <th className="w-[230px] border border-slate-200 px-4 py-3">Dates</th>
                    <th className="w-[95px] border border-slate-200 px-4 py-3 text-right">Calendar Days</th>
                    <th className="w-[105px] border border-slate-200 px-4 py-3 text-right">Working Days</th>
                    <th className="w-[190px] border border-slate-200 px-4 py-3">Status</th>
                    <th className="w-[220px] border border-slate-200 px-4 py-3">Reason</th>
                    <th className="w-[250px] border border-slate-200 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr><td colSpan={9} className="border border-slate-200 px-4 py-8 text-center text-slate-500">No leave requests yet.</td></tr>
                  ) : requests.map((request) => {
                    const employee = employees.find((item) => item.employeeNo === request.employeeNo);
                    return (
                      <tr key={request.id} className="odd:bg-white even:bg-slate-50 align-top">
                        <td className="break-words border border-slate-200 px-4 py-4 font-bold leading-6 text-slate-900">{request.id}</td>
                        <td className="border border-slate-200 px-4 py-4 font-black leading-6 text-slate-950">{employee ? getEmployeeName(employee) : request.employeeNo}</td>
                        <td className="border border-slate-200 px-4 py-4 font-semibold leading-6 text-slate-800">{request.leaveType}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-4 py-4 leading-6 text-slate-700">{formatDate(getRequestDateFrom(request))} - {formatDate(getRequestDateTo(request))}</td>
                        <td className="border border-slate-200 px-4 py-4 text-right font-black text-slate-950">{getRequestDays(request).toFixed(2)}</td>
                        <td className="border border-slate-200 px-4 py-4 text-right font-black text-blue-700">{getRequestWorkingDays(request, workingDays).toFixed(2)}</td>
                        <td className="border border-slate-200 px-4 py-4">
                          <span className={`inline-flex max-w-full rounded-full border px-3 py-1.5 text-xs font-black leading-5 ${getStatusClass(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="break-words border border-slate-200 px-4 py-4 leading-6 text-slate-700">{request.reason || "—"}</td>
                        <td className="border border-slate-200 px-4 py-4">
                          <div className="grid min-w-[220px] grid-cols-1 gap-2 xl:grid-cols-2">
                            <button
                              disabled={request.status !== "Pending Manager Approval"}
                              onClick={() => moveRequestStatus(request.id, "Pending HR Approval")}
                              className="rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300"
                            >
                              Manager Approve
                            </button>
                            <button
                              disabled={request.status !== "Pending HR Approval"}
                              onClick={() => moveRequestStatus(request.id, "Approved")}
                              className="rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300"
                            >
                              HR Approve
                            </button>
                            <button
                              disabled={request.status === "Rejected" || request.status === "Approved"}
                              onClick={() => moveRequestStatus(request.id, "Rejected")}
                              className="rounded-xl bg-rose-700 px-3 py-2.5 text-xs font-black text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:hover:bg-slate-300 xl:col-span-2"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {activeTab === "policies" ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900 lg:flex-row lg:items-center lg:justify-between">
              <span>Set the leave types allowed by the company. New leave types will not appear in Leave Balances until saved and locked.</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyColumnGuide((value) => !value)}
                  className="rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  {showPolicyColumnGuide ? "Hide Column Guide" : "Show Column Guide"}
                </button>
                <button onClick={addPolicy} className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800">+ Add Leave Type</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[2830px] w-full table-fixed border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <th className="w-[190px] border border-slate-200 px-4 py-3">Leave Type</th>
                    <th className="w-[220px] border border-slate-200 px-4 py-3">Applicable Basis</th>
                    <th className="w-[150px] border border-slate-200 px-4 py-3">Gender Rule</th>
                    <th className="w-[330px] border border-slate-200 px-4 py-3">Rule Value / Specific Employees</th>
                    <th className="w-[140px] border border-slate-200 px-4 py-3">Annual Days</th>
                    <th className="w-[170px] border border-slate-200 px-4 py-3">Eligibility Months</th>
                    <th className="w-[120px] border border-slate-200 px-4 py-3">Paid</th>
                    <th className="w-[160px] border border-slate-200 px-4 py-3">Convertible</th>
                    <th className="w-[140px] border border-slate-200 px-4 py-3">Carry Over</th>
                    <th className="w-[160px] border border-slate-200 px-4 py-3">Max Carry Over</th>
                    <th className="w-[180px] border border-slate-200 px-4 py-3">Replenish Year-End</th>
                    <th className="w-[140px] border border-slate-200 px-4 py-3">Notice Days</th>
                    <th className="w-[150px] border border-slate-200 px-4 py-3">Allow Half Day</th>
                    <th className="w-[170px] border border-slate-200 px-4 py-3">Negative Balance</th>
                    <th className="w-[170px] border border-slate-200 px-4 py-3">Deduct If Unpaid</th>
                    <th className="w-[190px] border border-slate-200 px-4 py-3">Government-Mandated</th>
                    <th className="w-[120px] border border-slate-200 px-4 py-3">Active</th>
                    <th className="w-[150px] border border-slate-200 px-4 py-3">Policy Status</th>
                    <th className="w-[300px] border border-slate-200 px-4 py-3">Audit Trail</th>
                    <th className="w-[170px] border border-slate-200 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.filter((policy) => policy.archived !== true).map((policy) => {
                    const isSaved = policy.saved === true;
                    return (
                      <tr key={policy.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <InputField disabled={isSaved} value={policy.leaveType} onChange={(e) => updatePolicy(policy.id, "leaveType", e.target.value)} />
                          {isSaved ? <div className="mt-2 text-xs font-bold text-slate-500">Saved and locked</div> : null}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <SelectField disabled={isSaved} value={policy.applicableTo || "All employees"} onChange={(e) => changePolicyApplicability(policy.id, e.target.value)}>
                            <option>All employees</option>
                            <option>By department</option>
                            <option>By gender</option>
                            <option>By employment status</option>
                            <option>Specific employees</option>
                          </SelectField>
                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <SelectField disabled={isSaved || policy.applicableTo === "By gender"} value={policy.genderApplicability || "All"} onChange={(e) => updatePolicy(policy.id, "genderApplicability", e.target.value)}>
                            <option>All</option>
                            <option>Female</option>
                            <option>Male</option>
                            <option>Not applicable</option>
                          </SelectField>
                          {policy.applicableTo === "By gender" ? <div className="mt-2 text-xs font-semibold text-slate-500">Controlled by rule value.</div> : null}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          {policy.applicableTo === "All employees" ? (
                            <InputField disabled value="All active employees" />
                          ) : policy.applicableTo === "By department" ? (
                            <SelectField disabled={isSaved} value={policy.employmentStatusApplicability || ""} onChange={(e) => updatePolicy(policy.id, "employmentStatusApplicability", e.target.value)}>
                              <option value="">Select department</option>
                              {departmentOptions.map((department) => <option key={department}>{department}</option>)}
                            </SelectField>
                          ) : policy.applicableTo === "By gender" ? (
                            <SelectField disabled={isSaved} value={policy.employmentStatusApplicability || ""} onChange={(e) => updatePolicy(policy.id, "employmentStatusApplicability", e.target.value)}>
                              <option value="">Select gender</option>
                              {genderOptions.length === 0 ? <option>Female</option> : null}
                              {genderOptions.length === 0 ? <option>Male</option> : null}
                              {genderOptions.map((gender) => <option key={gender}>{gender}</option>)}
                            </SelectField>
                          ) : policy.applicableTo === "By employment status" ? (
                            <SelectField disabled={isSaved} value={policy.employmentStatusApplicability || ""} onChange={(e) => updatePolicy(policy.id, "employmentStatusApplicability", e.target.value)}>
                              <option value="">Select employment status</option>
                              {employmentStatusOptions.map((status) => <option key={status}>{status}</option>)}
                            </SelectField>
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <button
                                type="button"
                                disabled={isSaved}
                                onClick={() => openSpecificEmployeeSelector(policy.id)}
                                className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                Manage Employees
                              </button>
                            </div>
                          )}

                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top"><InputField disabled={isSaved} type="number" value={policy.annualDays} onChange={(e) => updatePolicy(policy.id, "annualDays", money(e.target.value))} /></td>
                        <td className="border border-slate-200 px-3 py-3 align-top"><InputField disabled={isSaved} type="number" value={policy.eligibilityMonths} onChange={(e) => updatePolicy(policy.id, "eligibilityMonths", money(e.target.value))} /></td>
                        {(["paid", "convertible", "carryOver"] as Array<keyof LeavePolicy>).map((field) => (
                          <td key={field} className="border border-slate-200 px-3 py-3 align-top"><SelectField disabled={isSaved} value={policy[field] ? "Yes" : "No"} onChange={(e) => updatePolicy(policy.id, field, e.target.value === "Yes")}><option>Yes</option><option>No</option></SelectField></td>
                        ))}
                        <td className="border border-slate-200 px-3 py-3 align-top"><InputField disabled={isSaved} type="number" value={policy.maxCarryOverDays} onChange={(e) => updatePolicy(policy.id, "maxCarryOverDays", money(e.target.value))} /></td>
                        {(["replenishesYearEnd"] as Array<keyof LeavePolicy>).map((field) => (
                          <td key={field} className="border border-slate-200 px-3 py-3 align-top"><SelectField disabled={isSaved} value={policy[field] ? "Yes" : "No"} onChange={(e) => updatePolicy(policy.id, field, e.target.value === "Yes")}><option>Yes</option><option>No</option></SelectField></td>
                        ))}
                        <td className="border border-slate-200 px-3 py-3 align-top"><InputField disabled={isSaved} type="number" value={policy.noticePeriodDays || 0} onChange={(e) => updatePolicy(policy.id, "noticePeriodDays", money(e.target.value))} /></td>
                        {(["allowHalfDay", "allowNegativeBalance", "deductIfUnpaid", "governmentMandated", "active"] as Array<keyof LeavePolicy>).map((field) => (
                          <td key={field} className="border border-slate-200 px-3 py-3 align-top"><SelectField disabled={isSaved || policy.archived === true} value={policy[field] ? "Yes" : "No"} onChange={(e) => updatePolicy(policy.id, field, e.target.value === "Yes")}><option>Yes</option><option>No</option></SelectField></td>
                        ))}
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                            (policy.policyStatus || (isSaved ? "Saved" : "Draft")) === "Approved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : (policy.policyStatus || (isSaved ? "Saved" : "Draft")) === "Checked"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : (policy.policyStatus || (isSaved ? "Saved" : "Draft")) === "Saved"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-slate-300 bg-slate-100 text-slate-600"
                          }`}>
                            {policy.policyStatus || (isSaved ? "Saved" : "Draft")}
                          </span>
                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top text-xs leading-5 text-slate-600">
                          <div><span className="font-black text-slate-800">Prepared:</span> {policy.preparedAt ? `${formatDate(policy.preparedAt)} by ${policy.preparedBy || getAuditUserName()}` : "—"}</div>
                          <div><span className="font-black text-slate-800">Checked:</span> {policy.checkedAt ? `${formatDate(policy.checkedAt)} by ${policy.checkedBy || getAuditUserName()}` : "—"}</div>
                          <div><span className="font-black text-slate-800">Approved:</span> {policy.approvedAt ? `${formatDate(policy.approvedAt)} by ${policy.approvedBy || getAuditUserName()}` : "—"}</div>
                          <div><span className="font-black text-slate-800">Archived:</span> {policy.archivedAt ? `${formatDate(policy.archivedAt)} by ${policy.archivedBy || getAuditUserName()}` : "—"}</div>
                        </td>
                        <td className="border border-slate-200 px-3 py-3 align-top">
                          <div className="flex flex-col gap-2">
                            {!isSaved ? (
                              <button onClick={() => savePolicy(policy.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800">Save</button>
                            ) : null}
                            {isSaved && (policy.policyStatus || "Saved") === "Saved" ? (
                              <button onClick={() => checkPolicy(policy.id)} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-800">Mark Checked</button>
                            ) : null}
                            {isSaved && policy.policyStatus === "Checked" ? (
                              <button onClick={() => approvePolicy(policy.id)} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800">Approve</button>
                            ) : null}
                            <button disabled={policy.archived === true} onClick={() => archivePolicy(policy.id)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">Archive</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showPolicyColumnGuide ? (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">Column Guide</div>
                  <button
                    type="button"
                    onClick={() => setShowPolicyColumnGuide(false)}
                    className="self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-100 sm:self-auto"
                  >
                    Hide
                  </button>
                </div>
                <div className="text-xs italic leading-6 text-slate-600">
                  <span className="font-bold text-slate-800">Leave Type</span> — name of the leave benefit. •{" "}
                  <span className="font-bold text-slate-800">Applicable Basis</span> — who receives the leave. •{" "}
                  <span className="font-bold text-slate-800">Rule Value</span> — selected department, gender, status, or employee list. •{" "}
                  <span className="font-bold text-slate-800">Annual Days</span> — yearly leave credits. •{" "}
                  <span className="font-bold text-slate-800">Eligibility Months</span> — months required before use. •{" "}
                  <span className="font-bold text-slate-800">Paid</span> — employee remains paid while on leave. •{" "}
                  <span className="font-bold text-slate-800">Convertible</span> — unused leave may be converted to cash. •{" "}
                  <span className="font-bold text-slate-800">Carry Over</span> — unused leave may move to next year. •{" "}
                  <span className="font-bold text-slate-800">Max Carry Over</span> — maximum days carried forward. •{" "}
                  <span className="font-bold text-slate-800">Replenish Year-End</span> — yearly credits refresh/add again. •{" "}
                  <span className="font-bold text-slate-800">Allow Half Day</span> — allows 0.5 day filing. •{" "}
                  <span className="font-bold text-slate-800">Negative Balance</span> — allows advance leave beyond credits. •{" "}
                  <span className="font-bold text-slate-800">Deduct If Unpaid</span> — unpaid approved absence reduces paid days/pay. •{" "}
                  <span className="font-bold text-slate-800">Active</span> — usable in balances. •{" "}
                  <span className="font-bold text-slate-800">Policy Status</span> — Draft, Saved, Checked, or Approved. •{" "}
                  <span className="font-bold text-slate-800">Audit Trail</span> — who and when prepared, checked, approved, and archived. •{" "}
                  <span className="font-bold text-slate-800">Actions</span> — save, check, approve, or archive.
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "archivedPolicies" ? (
          <div className="mt-6">
            <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              Archived leave policies are kept for audit trail and historical reference. Restore a policy only if the company will use it again.
            </div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-[1400px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <th className="border border-slate-200 px-4 py-3">Leave Type</th>
                    <th className="border border-slate-200 px-4 py-3">Applicable Basis</th>
                    <th className="border border-slate-200 px-4 py-3">Gender Rule</th>
                    <th className="border border-slate-200 px-4 py-3">Rule Value / Specific Employees</th>
                    <th className="border border-slate-200 px-4 py-3 text-right">Annual Days</th>
                    <th className="border border-slate-200 px-4 py-3">Policy Status</th>
                    <th className="border border-slate-200 px-4 py-3">Audit Trail</th>
                    <th className="border border-slate-200 px-4 py-3">Archive Status</th>
                    <th className="border border-slate-200 px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.filter((policy) => policy.archived === true).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-200 px-4 py-8 text-center text-slate-500">
                        No archived leave policies yet.
                      </td>
                    </tr>
                  ) : policies.filter((policy) => policy.archived === true).map((policy) => (
                    <tr key={`${policy.id}-archive`} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 font-black">{policy.leaveType}</td>
                      <td className="border border-slate-200 px-4 py-3">{policy.applicableTo || "All employees"}</td>
                      <td className="border border-slate-200 px-4 py-3">{policy.genderApplicability || "All"}</td>
                      <td className="border border-slate-200 px-4 py-3">
                        {policy.applicableTo === "Specific employees"
                          ? `${policy.specificEmployeeNos?.length || 0} selected employee(s)`
                          : policy.employmentStatusApplicability || "All active employees"}
                      </td>
                      <td className="border border-slate-200 px-4 py-3 text-right font-bold">{money(policy.annualDays).toFixed(2)}</td>
                      <td className="border border-slate-200 px-4 py-3">
                        <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                          {policy.policyStatus || "Saved"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">
                        <div><span className="font-black text-slate-800">Prepared:</span> {policy.preparedAt ? `${formatDate(policy.preparedAt)} by ${policy.preparedBy || getAuditUserName()}` : "—"}</div>
                        <div><span className="font-black text-slate-800">Checked:</span> {policy.checkedAt ? `${formatDate(policy.checkedAt)} by ${policy.checkedBy || getAuditUserName()}` : "—"}</div>
                        <div><span className="font-black text-slate-800">Approved:</span> {policy.approvedAt ? `${formatDate(policy.approvedAt)} by ${policy.approvedBy || getAuditUserName()}` : "—"}</div>
                        <div><span className="font-black text-slate-800">Archived:</span> {policy.archivedAt ? `${formatDate(policy.archivedAt)} by ${policy.archivedBy || getAuditUserName()}` : "—"}</div>
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
  <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
    Archived
  </span>
</td>
<td className="border border-slate-200 px-4 py-3">
  <button
    onClick={() => restorePolicy(policy.id)}
    className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800"
  >
    Restore
  </button>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
) : null}
        {activeTab === "conversion" ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
              HR opens a filing window for leave monetization. Employees file monetization requests from the employee portal, then the request follows Manager approval → HR final approval → Payroll assignment → Payroll adjustment posting.
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Monetization Filing Window</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Set the period when employees are allowed to file leave monetization.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[180px_180px_auto]">
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">Start Date</span>
                    <InputField disabled={monetizationWindowLocked} type="date" value={monetizationWindowFrom} onChange={(event) => setMonetizationWindowFrom(event.target.value)} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">End Date</span>
                    <InputField disabled={monetizationWindowLocked} type="date" value={monetizationWindowTo} onChange={(event) => setMonetizationWindowTo(event.target.value)} />
                  </label>
                  <div className="flex items-end gap-2">
                    {monetizationWindowLocked ? (
                      <button type="button" onClick={unlockMonetizationWindow} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">Edit</button>
                    ) : (
                      <button type="button" onClick={saveMonetizationWindow} className="rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white shadow-sm hover:bg-emerald-800">Save</button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
                Current filing window: {formatDate(monetizationWindowFrom)} - {formatDate(monetizationWindowTo)} • Status: {monetizationWindowLocked ? "Locked" : "Editing"}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Assign Approved Monetization to Payroll</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Only HR-approved monetization requests can be assigned to payroll.</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-[280px_180px_130px_180px_auto]">
                  <SelectField value={selectedMonetizationRequestId} onChange={(event) => setSelectedMonetizationRequestId(event.target.value)}>
                    <option value="">Select approved request</option>
                    {monetizationRequests.filter((request) => request.status === "Approved").map((request) => (
                      <option key={request.id} value={request.id}>{request.employeeName} • {request.leaveType} • {request.requestedDays.toFixed(2)} day(s)</option>
                    ))}
                  </SelectField>

                  <SelectField value={selectedMonetizationPayrollMonth} onChange={(event) => setSelectedMonetizationPayrollMonth(event.target.value)}>
                    <option value="">Select month</option>
                    {[
                      "January",
                      "February",
                      "March",
                      "April",
                      "May",
                      "June",
                      "July",
                      "August",
                      "September",
                      "October",
                      "November",
                      "December",
                    ].map((month) => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </SelectField>

                  <InputField
                    type="number"
                    min="2000"
                    max="2100"
                    value={selectedMonetizationPayrollYear}
                    onChange={(event) => setSelectedMonetizationPayrollYear(event.target.value)}
                    placeholder="Year"
                  />

                  <SelectField value={selectedMonetizationPayrollCutoff} onChange={(event) => setSelectedMonetizationPayrollCutoff(event.target.value)}>
                    <option value="">Select cutoff</option>
                    <option value="First Cutoff">First Cutoff</option>
                    <option value="Second Cutoff">Second Cutoff</option>
                    <option value="Monthly Payroll">Monthly Payroll</option>
                    <option value="Week 1">Week 1</option>
                    <option value="Week 2">Week 2</option>
                    <option value="Week 3">Week 3</option>
                    <option value="Week 4">Week 4</option>
                  </SelectField>

                  <button type="button" onClick={assignMonetizationToPayroll} className="rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white shadow-sm hover:bg-blue-800">Assign</button>

                  <div className="text-xs font-semibold leading-5 text-slate-500 lg:col-span-5">
                    Select the month, year, and cutoff where the monetized leave will be applied. This will be forwarded to payroll adjustments as Monetized Leave.
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-950">Monetization Requests</h3>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[1250px] w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <th className="border border-slate-200 px-4 py-3">Request ID</th>
                      <th className="border border-slate-200 px-4 py-3">Employee</th>
                      <th className="border border-slate-200 px-4 py-3">Leave Type</th>
                      <th className="border border-slate-200 px-4 py-3 text-right">Requested Days</th>
                      <th className="border border-slate-200 px-4 py-3">Applied Payroll</th>
                      <th className="border border-slate-200 px-4 py-3">Status</th>
                      <th className="border border-slate-200 px-4 py-3">Reason</th>
                      <th className="border border-slate-200 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monetizationRequests.length === 0 ? (
                      <tr><td colSpan={8} className="border border-slate-200 px-4 py-8 text-center text-slate-500">No monetization requests yet.</td></tr>
                    ) : monetizationRequests.map((request) => (
                      <tr key={request.id} className="odd:bg-white even:bg-slate-50 align-top">
                        <td className="break-words border border-slate-200 px-4 py-4 font-bold text-slate-900">{request.id}</td>
                        <td className="border border-slate-200 px-4 py-4 font-black text-slate-950">{request.employeeName}</td>
                        <td className="border border-slate-200 px-4 py-4 font-semibold text-slate-800">{request.leaveType}</td>
                        <td className="border border-slate-200 px-4 py-4 text-right font-black text-slate-950">{request.requestedDays.toFixed(2)}</td>
                        <td className="border border-slate-200 px-4 py-4 font-semibold text-slate-700">
                          {request.payrollReference ? (
                            <div>
                              <div className="font-black text-slate-950">{getPayrollDisplayForReference(request.payrollReference)}</div>
                              <div className="mt-1 text-xs font-semibold text-slate-500">Reference: {request.payrollReference}</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="border border-slate-200 px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${getStatusClass(request.status === "Assigned to Payroll" ? "Pending HR Approval" : request.status === "Posted" ? "Posted" : request.status)}`}>{request.status}</span></td>
                        <td className="break-words border border-slate-200 px-4 py-4 text-slate-700">{request.reason || "—"}</td>
                        <td className="border border-slate-200 px-4 py-4">
                          <div className="grid min-w-[230px] gap-2 xl:grid-cols-2">
                            <button disabled={request.status !== "Pending Manager Approval"} onClick={() => moveMonetizationStatus(request.id, "Pending HR Approval")} className="rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">Manager Approve</button>
                            <button disabled={request.status !== "Pending HR Approval"} onClick={() => moveMonetizationStatus(request.id, "Approved")} className="rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">HR Approve</button>
                            <button disabled={request.status === "Rejected" || request.status === "Posted"} onClick={() => moveMonetizationStatus(request.id, "Rejected")} className="rounded-xl bg-rose-700 px-3 py-2.5 text-xs font-black text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300">Reject</button>
                            <button disabled={request.status !== "Assigned to Payroll"} onClick={() => postMonetizationToPayroll(request.id)} className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Post Payroll</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "posted" ? (
          <div className="mt-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-600">
              No posted leave conversions yet.
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
