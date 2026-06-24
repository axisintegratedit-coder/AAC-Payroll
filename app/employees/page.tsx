"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingUp,
  UserRoundPlus,
  WalletCards,
  X,
} from "lucide-react";
import { getConfigItem, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit, getAuditsByEntity, formatAuditTimestamp, auditActionLabel, type AuditEntry } from "@/lib/auditTrail";
import { auth } from "@/lib/firebase";
import {
  appendSalaryHistoryEntry,
  getCurrentBaseSalary,
  normalizeSalaryHistory,
  todayIsoDate,
  type SalaryHistoryEntry,
} from "@/lib/salaryHistory";
import {
  deMinimisBenefitTargetsEmployee,
  type DeMinimisBenefit,
} from "@/lib/deMinimis";
import type { PayrollLoanRecord } from "@/lib/loans";
import type { PayrollAllowanceLoanItem, PayrollCutoffIdentity } from "@/lib/payrollRunImports";

type LoanEntry = {
  id: string;
  loanName: string;
  dateStarted?: string;
  startDate?: string;
  endDate?: string;
  originalAmount: number;
  outstandingBalance: number;
  monthlyDeduction: number;
  frequency?: string;
};

type EmployeeAllowanceLoanHistoryItem = PayrollAllowanceLoanItem & {
  recordId: string;
  runLabel: string;
  cutoffLabel: string;
  payrollDate?: string;
  createdAt?: string;
};

type Employee = {
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  company?: string;
  designation: string;
  jobTitle?: string;
  employmentClassification?: string;
  isMinimumWageEarner?: string;
  department: string;
  employeeType?: string;
  immediateSupervisor?: string;
  designatedWorkplace?: string;
  employmentStatus: string;
  userType?: string;
  jobCode?: string;
  jobGrade?: string;
  costName?: string;
  eligibility?: string;
  hireDate?: string;
  expectedRegularizationDate?: string;
  regularizationDate?: string;
  expectedSeparationDate?: string;
  separationDate?: string;
  reasonForLeaving?: string;
  employeeRemarks?: string;
  biometricId?: string;
  payrollRunType?: string;
  payrollExempt?: string;
  shiftType?: string;
  payslipId?: string;
  hourlyRate: number;
  basicPay: number;
  salaryHistory?: SalaryHistoryEntry[];
  riceSubsidy?: number;
  uniformClothingAllowance?: number;
  laundryAllowance?: number;
  actualMedicalAssistance?: number;
  medicalCashAllowanceToDependents?: number;
  mealAllowance?: number;
  christmasAnniversaryGifts?: number;
  achievementAwards?: number;
  thirteenthMonthPay?: number;
  christmasBonus?: number;
  otherAllowanceName?: string;
  otherAllowanceAmount?: number;
  sss: string;
  philhealth: string;
  pagibig: string;
  tin: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  birthdate: string;
  contactNumber: string;
  emailAddress: string;
  address: string;
  employeePhotoDataUrl?: string;
  createdAt?: string;
  dateAdded?: string;
  archived?: boolean;
  archivedAt?: string;
  archiveReason?: string;
  archiveStatus?: string;
  loans?: LoanEntry[];
};

type EditableEmployeeFields = {
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  company: string;
  designation: string;
  employmentClassification: string;
  isMinimumWageEarner: string;
  department: string;
  employeeType: string;
  immediateSupervisor: string;
  designatedWorkplace: string;
  employmentStatus: string;
  userType: string;
  jobCode: string;
  jobGrade: string;
  costName: string;
  eligibility: string;
  hireDate: string;
  expectedRegularizationDate: string;
  regularizationDate: string;
  expectedSeparationDate: string;
  separationDate: string;
  reasonForLeaving: string;
  employeeRemarks: string;
  biometricId: string;
  payrollRunType: string;
  shiftType: string;
  payslipId: string;
  hourlyRate: string;
  basicPay: string;
  riceSubsidy: string;
  uniformClothingAllowance: string;
  laundryAllowance: string;
  actualMedicalAssistance: string;
  medicalCashAllowanceToDependents: string;
  mealAllowance: string;
  christmasAnniversaryGifts: string;
  achievementAwards: string;
  thirteenthMonthPay: string;
  christmasBonus: string;
  otherAllowanceName: string;
  otherAllowanceAmount: string;
  sss: string;
  philhealth: string;
  pagibig: string;
  tin: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  birthdate: string;
  contactNumber: string;
  emailAddress: string;
  address: string;
  employeePhotoDataUrl: string;
};

type EmployeePayrollRecord = {
  id?: string;
  bulkRunId?: string;
  employeeNo?: string;
  employeeName?: string;
  monthYear?: string;
  month?: string;
  year?: string | number;
  payrollPeriod?: string;
  payrollDate?: string;
  actualPayrollDate?: string;
  createdAt?: string;
  cutoffIdentity?: PayrollCutoffIdentity;
  runCutoff?: PayrollCutoffIdentity;
  importedAllowancesLoans?: PayrollAllowanceLoanItem[];
  basicPay?: number;
  cutoffBasicPay?: number;
  grossPay?: number;
  totalDeductions?: number;
  deductions?: number;
  withholdingTax?: number;
  netPay?: number;
  adjustedNetPay?: number;
};

type SortColumn =
  | "employeeNo"
  | "employee"
  | "department"
  | "designation"
  | "payrollRunType"
  | "employmentStatus"
  | "basicPay";

type SortDirection = "asc" | "desc";

type FilterMenuColumn =
  | "employeeNo"
  | "employee"
  | "department"
  | "designation"
  | "payrollRunType"
  | "employmentStatus"
  | "basicPay"
  | null;

const BIR_EMPLOYMENT_STATUS_OPTIONS = [
  { value: "R", label: "R - Regular" },
  { value: "C", label: "C - Casual" },
  { value: "CP", label: "CP - Contractual/Project-Based" },
  { value: "S", label: "S - Seasonal" },
  { value: "P", label: "P - Probationary" },
  { value: "AL", label: "AL - Apprentices/Learners" },
];

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0a4f8f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] transition hover:-translate-y-0.5 hover:bg-[#073c6d] focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const warningButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 shadow-[0_14px_28px_-22px_rgba(146,64,14,0.65)] transition hover:-translate-y-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-100";
const subtlePanelClassName =
  "relative overflow-visible rounded-2xl border border-white bg-white/95 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)] ring-1 ring-slate-900/[0.04] backdrop-blur";
function getEmploymentStatusLabel(value?: string) {
  const status = String(value || "").trim();
  const matchedStatus = BIR_EMPLOYMENT_STATUS_OPTIONS.find(
    (option) => option.value.toLowerCase() === status.toLowerCase()
  );
  return matchedStatus ? matchedStatus.label : status || "—";
}


function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function toIsoDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return value;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCutoffLabel(cutoff?: PayrollCutoffIdentity) {
  if (!cutoff) return "—";
  const label = cutoff.cutoffLabel || cutoff.cutoff || cutoff.cutoffId || "Cutoff";
  const monthYear = cutoff.monthYear ? `${cutoff.monthYear} · ` : "";
  const coverage =
    cutoff.coverageStartDate && cutoff.coverageEndDate
      ? ` · ${cutoff.coverageStartDate} to ${cutoff.coverageEndDate}`
      : "";

  return `${monthYear}${label}${coverage}`;
}

function formatPayrollRunLabel(record: EmployeePayrollRecord) {
  const cutoff = record.runCutoff || record.cutoffIdentity;
  if (cutoff) return formatCutoffLabel(cutoff);

  const period = [record.month, record.year].filter(Boolean).join(" ");
  return [period || record.monthYear || "Payroll run", record.payrollPeriod].filter(Boolean).join(" · ");
}

function getAllowanceLoanRemainingBalance(item: PayrollAllowanceLoanItem) {
  const explicitBalance = Number(
    (item as PayrollAllowanceLoanItem & { remainingBalance?: number; outstandingBalance?: number }).remainingBalance ??
      (item as PayrollAllowanceLoanItem & { remainingBalance?: number; outstandingBalance?: number }).outstandingBalance
  );
  if (Number.isFinite(explicitBalance)) return Math.max(0, explicitBalance);

  const maximumAmount = Number(item.maximumAmount);
  if (!Number.isFinite(maximumAmount) || maximumAmount <= 0) return undefined;

  return Math.max(0, maximumAmount - Math.abs(Number(item.amount) || 0));
}

function getEmployeeDateAdded(employee: Employee) {
  return employee.createdAt || employee.dateAdded || "";
}

function diffEmployee(before: Employee, after: Employee): string {
  const FIELDS: Array<[string, keyof Employee]> = [
    ["Last Name", "lastName"],
    ["First Name", "firstName"],
    ["Middle Name", "middleName"],
    ["Designation", "designation"],
    ["Department", "department"],
    ["Employment Status", "employmentStatus"],
    ["Employment Classification", "employmentClassification"],
    ["Payroll Run Type", "payrollRunType"],
    ["Shift", "shiftType"],
    ["Basic Pay", "basicPay"],
    ["Hourly Rate", "hourlyRate"],
    ["Contact Number", "contactNumber"],
    ["Email", "emailAddress"],
    ["Address", "address"],
    ["SSS", "sss"],
    ["PhilHealth", "philhealth"],
    ["Pag-IBIG", "pagibig"],
    ["TIN", "tin"],
    ["Bank Name", "bankName"],
    ["Bank Account No.", "bankAccountNumber"],
    ["Bank Account Type", "bankAccountType"],
    ["Hire Date", "hireDate"],
    ["Regularization Date", "regularizationDate"],
    ["Separation Date", "separationDate"],
  ];
  const diffs = FIELDS
    .filter(([, key]) => String(before[key] ?? "") !== String(after[key] ?? ""))
    .map(([label, key]) => `${label}: ${String(before[key] ?? "(empty)")} → ${String(after[key] ?? "(empty)")}`);
  return diffs.length > 0 ? diffs.join("; ") : "No field changes detected";
}

function getSalaryChangedBy() {
  const user = auth.currentUser;
  return user?.displayName || user?.email || user?.uid || "unknown";
}

function normalizeEmployee(employee: Employee): Employee {
  const salaryHistory = normalizeSalaryHistory(employee);
  return {
    ...employee,
    designation: employee.designation || employee.jobTitle || "",
    archived: employee.archived === true,
    employmentClassification: employee.employmentClassification || "Rank-and-file",
    isMinimumWageEarner: employee.isMinimumWageEarner || "No",
    salaryHistory,
    basicPay: getCurrentBaseSalary({ ...employee, salaryHistory }),
  };
}

// Compress/resize employee photo before saving.
function resizeEmployeePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load the selected employee photo."));
    };

    image.onload = () => {
      try {
        const maxSize = 360;
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Unable to prepare the employee photo.");
        }

        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error instanceof Error ? error : new Error("Unable to process the selected employee photo."));
      }
    };

    image.src = objectUrl;
  });
}

function getRecordYear(record: EmployeePayrollRecord) {
  const yearValue = record.year || record.monthYear || record.payrollDate || record.actualPayrollDate || "";
  const match = String(yearValue).match(/20\d{2}/);
  return match ? match[0] : "";
}

function getRecordLabel(record: EmployeePayrollRecord) {
  const monthLabel = record.monthYear || [record.month, record.year].filter(Boolean).join(" ");
  return [monthLabel, record.payrollPeriod].filter(Boolean).join(" - ") || "Payroll Record";
}

function toMoney(value: unknown) {
  return Number(value) || 0;
}

function InputField(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    error?: boolean;
  }
) {
  const { error, className, ...rest } = props;

  return (
    <input
      {...rest}
      className={`${inputClassName} ${error ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100" : ""} ${className || ""}`}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${selectClassName} ${props.className || ""}`}
    />
  );
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="mb-2 text-sm font-semibold text-slate-700">
      {children} {required ? <span className="text-rose-600">*</span> : null}
    </div>
  );
}

const AVATAR_PALETTE = [
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#DCFCE7", text: "#15803D" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#FCE7F3", text: "#BE185D" },
  { bg: "#EDE9FE", text: "#6D28D9" },
  { bg: "#FFEDD5", text: "#C2410C" },
  { bg: "#CCFBF1", text: "#0F766E" },
  { bg: "#F0F9FF", text: "#0369A1" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function getInitials(employee: { firstName: string; lastName: string }) {
  const f = (employee.firstName || "").trim()[0] || "";
  const l = (employee.lastName || "").trim()[0] || "";
  return (f + l).toUpperCase() || "?";
}

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  // Canonical values (new schema)
  REGULAR:       { bg: "#DCFCE7", text: "#16A34A", label: "Regular" },
  PROBATIONARY:  { bg: "#FEF9C3", text: "#CA8A04", label: "Probationary" },
  TERMINATED:    { bg: "#FEE2E2", text: "#DC2626", label: "Terminated" },
  // Legacy BIR codes (backwards compat)
  R:   { bg: "#DCFCE7", text: "#16A34A", label: "Regular" },
  P:   { bg: "#FEF9C3", text: "#CA8A04", label: "Probationary" },
  S:   { bg: "#DBEAFE", text: "#2563EB", label: "Seasonal" },
  C:   { bg: "#FEE2E2", text: "#DC2626", label: "Casual" },
  CP:  { bg: "#FEE2E2", text: "#DC2626", label: "Contractual" },
  AL:  { bg: "#EDE9FE", text: "#7C3AED", label: "Apprentice" },
};

function StatusBadge({ value }: { value: string }) {
  const key = String(value || "").trim().toUpperCase();
  const style = STATUS_BADGE_STYLES[key];
  if (style) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: style.bg, color: style.text }}
      >
        {style.label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      {value || "—"}
    </span>
  );
}

function PayrollTypeBadge({ value }: { value?: string }) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "A" || v === "B") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold"
        style={{
          background: v === "A" ? "#DBEAFE" : "#EDE9FE",
          color: v === "A" ? "#1D4ED8" : "#6D28D9",
          minWidth: 24,
        }}
      >
        {v}
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

function ExemptBadge({ value }: { value?: string }) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "yes") {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ background: "#DCFCE7", color: "#16A34A" }}
      >
        Yes
      </span>
    );
  }
  if (v === "no") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
        No
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

function SortHeader({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  onToggleFilterMenu,
  isFilterMenuOpen,
  filterValue,
  children,
}: {
  label: string;
  column: Exclude<FilterMenuColumn, null>;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onToggleFilterMenu: (column: Exclude<FilterMenuColumn, null>) => void;
  isFilterMenuOpen: boolean;
  filterValue: string;
  children: React.ReactNode;
}) {
  const isActive = sortColumn === column;
  const arrow = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "↕";
  const hasFilter = filterValue.trim().length > 0;

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748B] transition hover:text-[#0a4f8f]"
      >
        <span>{label}</span>
        <span className={isActive ? "text-[#0a4f8f]" : "text-slate-400"}>{arrow}</span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFilterMenu(column)}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border p-0 transition ${
          hasFilter
            ? "border-sky-200 bg-sky-50 text-[#0a4f8f]"
            : "border-slate-200 bg-white text-slate-500 hover:border-sky-200 hover:text-[#0a4f8f]"
        }`}
        aria-label={`Open ${label} filter`}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isFilterMenuOpen ? (
        <div className="absolute right-0 top-9 z-30 w-[260px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_22px_54px_-28px_rgba(8,47,73,0.85)]">
          <div className="mb-3 text-sm font-semibold text-slate-950">
            Filter {label}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_44px_-34px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 border-b border-slate-200 py-2.5 sm:grid-cols-[210px_1fr]">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="break-words text-sm font-medium text-slate-950">{value || "—"}</div>
    </div>
  );
}

function DetailSection({
  title,
  tone = "slate",
  children,
}: {
  title: string;
  tone?: "slate" | "blue" | "green" | "amber";
  children: React.ReactNode;
}) {
  const toneStyles = {
    slate: "border-slate-200 bg-white text-slate-600",
    blue: "border-sky-100 bg-sky-50 text-[#0a4f8f]",
    green: "border-cyan-100 bg-cyan-50 text-cyan-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }[tone];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-34px_rgba(8,47,73,0.75)]">
      <div className="mb-3 flex items-center gap-3">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${toneStyles}`}>
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="text-lg font-semibold tracking-tight text-slate-950">{title}</div>
      </div>
      <div className="rounded-2xl bg-white px-3 py-1">
        {children}
      </div>
    </section>
  );
}

function getFullName(employee: Employee) {
  const givenNames = [employee.firstName, employee.middleName].filter(Boolean).join(" ");
  return employee.lastName && givenNames
    ? `${employee.lastName}, ${givenNames}`
    : [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(" ");
}

function EmployeeTableRow({
  employee,
  isSelected,
  actionMenuOpen,
  onToggleSelected,
  onToggleActionMenu,
  onViewDetails,
  onViewPayrollRecords,
  onEdit,
  onArchive,
  onUnarchive,
  onDeleteForever,
}: {
  employee: Employee;
  isSelected: boolean;
  actionMenuOpen: boolean;
  onToggleSelected: (employeeNo: string) => void;
  onToggleActionMenu: (employeeNo: string) => void;
  onViewDetails: (employee: Employee) => void;
  onViewPayrollRecords: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onArchive: (employee: Employee) => void;
  onUnarchive: (employee: Employee) => void;
  onDeleteForever: (employee: Employee) => void;
}) {
  const avatarColor = getAvatarColor(employee.firstName + employee.lastName);
  const initials = getInitials(employee);
  const statusKey = String(employee.employmentStatus || "").trim().toUpperCase();

  return (
    <tr
      style={{ borderBottom: "1px solid #E5E7EB", transition: "background 150ms" }}
      className="group bg-white hover:bg-[#F0F4FF]"
    >
      <td className="px-4 py-4" style={{ width: 44 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelected(employee.employeeNo)}
          className="h-4 w-4 accent-[#0a4f8f]"
        />
      </td>
      <td className="px-4 py-4">
        <span className="text-sm font-semibold text-[#111827]">{employee.employeeNo}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-4">
        <span className="text-[13px] text-[#6B7280]">{formatDateTime(getEmployeeDateAdded(employee))}</span>
      </td>
      {/* Avatar + name + email */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          {employee.employeePhotoDataUrl ? (
            <NextImage
              src={employee.employeePhotoDataUrl}
              alt={getFullName(employee)}
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: avatarColor.bg, color: avatarColor.text }}
            >
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#111827] leading-tight">{getFullName(employee)}</div>
            <div className="mt-0.5 text-[13px] text-[#6B7280] truncate">{employee.emailAddress || "—"}</div>
          </div>
        </div>
      </td>
      {/* Department pill */}
      <td className="px-4 py-4">
        {employee.department ? (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: "#F1F5F9", color: "#334155" }}
          >
            {employee.department}
          </span>
        ) : <span className="text-[13px] text-[#6B7280]">—</span>}
      </td>
      {/* Job title */}
      <td className="px-4 py-4">
        <span className="text-sm text-[#111827]">{employee.designation || "—"}</span>
      </td>
      {/* Payroll Type badge */}
      <td className="px-4 py-4">
        <PayrollTypeBadge value={employee.payrollRunType} />
      </td>
      {/* Exempt badge */}
      <td className="px-4 py-4">
        <ExemptBadge value={employee.payrollExempt} />
      </td>
      {/* Status badge */}
      <td className="px-4 py-4">
        <StatusBadge value={statusKey} />
      </td>
      {/* Archive reason (archived mode) */}
      {employee.archived ? (
        <td className="px-4 py-4">
          <span className="text-[13px] text-[#6B7280]">{employee.archiveReason || "—"}</span>
        </td>
      ) : null}
      {/* Basic pay (active mode) */}
      {!employee.archived ? (
        <td className="px-4 py-4 text-right">
          <div className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-teal-500 shrink-0" aria-hidden="true" />
            <span className="text-sm font-bold text-[#111827]">{formatCurrency(employee.basicPay)}</span>
          </div>
        </td>
      ) : null}
      {/* Icon action row */}
      <td className="px-4 py-4" style={{ width: 120, position: "relative", overflow: "visible" }}>
        <div className="flex items-center gap-1">
          {!employee.archived ? (
            <button
              type="button"
              title="Edit"
              onClick={() => onEdit(employee)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-sky-100 hover:text-[#0a4f8f]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            title="View details"
            onClick={() => onViewDetails(employee)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-sky-100 hover:text-[#0a4f8f]"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="More actions"
            onClick={() => onToggleActionMenu(employee.employeeNo)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-sky-100 hover:text-[#0a4f8f]"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {actionMenuOpen ? (
          <div className="absolute right-0 top-12 z-[200] w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_54px_-28px_rgba(8,47,73,0.85)]">
            <button
              type="button"
              onClick={() => onViewPayrollRecords(employee)}
              className={actionButtonClassName}
            >
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              Payroll records
            </button>
            {!employee.archived ? (
              <button
                type="button"
                onClick={() => onArchive(employee)}
                className={`${actionButtonClassName} text-amber-700 hover:bg-amber-50`}
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onUnarchive(employee)}
                  className={`${actionButtonClassName} text-[#0a4f8f] hover:bg-cyan-50`}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteForever(employee)}
                  className={`${actionButtonClassName} text-rose-700 hover:bg-rose-50`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete Forever
                </button>
              </>
            )}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

const actionButtonClassName =
  "flex w-full items-center gap-2 border-b border-slate-100 bg-white px-3.5 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-[#0a4f8f]";

function toEditableEmployee(employee: Employee): EditableEmployeeFields {
  return {
    employeeNo: employee.employeeNo || "",
    lastName: employee.lastName || "",
    firstName: employee.firstName || "",
    middleName: employee.middleName || "",
    company: employee.company || "",
    designation: employee.designation || "",
    employmentClassification: employee.employmentClassification || "Rank-and-file",
    isMinimumWageEarner: employee.isMinimumWageEarner || "No",
    department: employee.department || "",
    employeeType: employee.employeeType || "",
    immediateSupervisor: employee.immediateSupervisor || "",
    designatedWorkplace: employee.designatedWorkplace || "",
    employmentStatus: employee.employmentStatus || "P",
    userType: employee.userType || "",
    jobCode: employee.jobCode || "",
    jobGrade: employee.jobGrade || "",
    costName: employee.costName || "",
    eligibility: employee.eligibility || "",
    hireDate: employee.hireDate || "",
    expectedRegularizationDate: employee.expectedRegularizationDate || "",
    regularizationDate: employee.regularizationDate || "",
    expectedSeparationDate: employee.expectedSeparationDate || "",
    separationDate: employee.separationDate || "",
    reasonForLeaving: employee.reasonForLeaving || "",
    employeeRemarks: employee.employeeRemarks || "",
    biometricId: employee.biometricId || "",
    payrollRunType: employee.payrollRunType || "",
    shiftType: employee.shiftType || "Day Shift",
    payslipId: employee.payslipId || "",
    hourlyRate: String(employee.hourlyRate ?? ""),
    basicPay: String(employee.basicPay ?? ""),
    riceSubsidy: String(employee.riceSubsidy ?? ""),
    uniformClothingAllowance: String(employee.uniformClothingAllowance ?? ""),
    laundryAllowance: String(employee.laundryAllowance ?? ""),
    actualMedicalAssistance: String(employee.actualMedicalAssistance ?? ""),
    medicalCashAllowanceToDependents: String(employee.medicalCashAllowanceToDependents ?? ""),
    mealAllowance: String(employee.mealAllowance ?? ""),
    christmasAnniversaryGifts: String(employee.christmasAnniversaryGifts ?? ""),
    achievementAwards: String(employee.achievementAwards ?? ""),
    thirteenthMonthPay: String(employee.thirteenthMonthPay ?? ""),
    christmasBonus: String(employee.christmasBonus ?? ""),
    otherAllowanceName: employee.otherAllowanceName || "",
    otherAllowanceAmount: String(employee.otherAllowanceAmount ?? ""),
    sss: employee.sss || "",
    philhealth: employee.philhealth || "",
    pagibig: employee.pagibig || "",
    tin: employee.tin || "",
    bankName: employee.bankName || "",
    bankAccountNumber: employee.bankAccountNumber || "",
    bankAccountType: employee.bankAccountType || "Savings",
    birthdate: employee.birthdate || "",
    contactNumber: employee.contactNumber || "",
    emailAddress: employee.emailAddress || "",
    address: employee.address || "",
    employeePhotoDataUrl: employee.employeePhotoDataUrl || "",
  };
}

function compareEmployees(
  a: Employee,
  b: Employee,
  sortColumn: SortColumn,
  sortDirection: SortDirection
) {
  let left = "";
  let right = "";

  if (sortColumn === "employee") {
    left = (a.lastName || "").toLowerCase();
    right = (b.lastName || "").toLowerCase();
  } else if (sortColumn === "employeeNo") {
    left = (a.employeeNo || "").toLowerCase();
    right = (b.employeeNo || "").toLowerCase();
  } else if (sortColumn === "department") {
    left = (a.department || "").toLowerCase();
    right = (b.department || "").toLowerCase();
  } else if (sortColumn === "designation") {
    left = (a.designation || "").toLowerCase();
    right = (b.designation || "").toLowerCase();
  } else if (sortColumn === "payrollRunType") {
    left = (a.payrollRunType || "").toLowerCase();
    right = (b.payrollRunType || "").toLowerCase();
  } else if (sortColumn === "employmentStatus") {
    left = (a.employmentStatus || "").toLowerCase();
    right = (b.employmentStatus || "").toLowerCase();
  } else if (sortColumn === "basicPay") {
    const diff = (a.basicPay || 0) - (b.basicPay || 0);
    return sortDirection === "asc" ? diff : -diff;
  }

  if (left < right) return sortDirection === "asc" ? -1 : 1;
  if (left > right) return sortDirection === "asc" ? 1 : -1;
  return 0;
}

function EmployeeAuditTrail({ employeeNo }: { employeeNo: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    getAuditsByEntity("Employee", employeeNo).then(setEntries);
  }, [employeeNo]);

  return (
    <div style={{ marginTop: 24, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
        Audit Trail
      </div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "#94a3b8" }}>No activity recorded yet.</p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.map((e: AuditEntry) => (
            <li key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{auditActionLabel(e.action)}</span>
                {e.details && <span style={{ fontSize: 13, color: "#64748b" }}> · {e.details}</span>}
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                  {formatAuditTimestamp(e.timestamp)} · {e.performedBy}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeNos, setSelectedEmployeeNos] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("employee");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openActionMenuFor, setOpenActionMenuFor] = useState<string | null>(null);
  const [openFilterMenuFor, setOpenFilterMenuFor] = useState<FilterMenuColumn>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [viewProfileTab, setViewProfileTab] = useState<"details" | "loans">("details");
  const [deMinimisBenefits, setDeMinimisBenefits] = useState<DeMinimisBenefit[]>([]);
  const [payrollLoans, setPayrollLoans] = useState<PayrollLoanRecord[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<EmployeePayrollRecord[]>([]);
  const viewingEmployeeLoans = useMemo(() => {
    if (!viewingEmployee) return [];
    const employeeNo = viewingEmployee.employeeNo.trim().toLowerCase();
    return payrollLoans.filter((loan) => loan.employeeId.trim().toLowerCase() === employeeNo);
  }, [payrollLoans, viewingEmployee]);
  const viewingEmployeeDeMinimisBenefits = useMemo(() => {
    if (!viewingEmployee) return [];
    return deMinimisBenefits.filter((benefit) =>
      deMinimisBenefitTargetsEmployee(benefit, {
        employeeNo: viewingEmployee.employeeNo,
        employeeType: viewingEmployee.employeeType,
        employmentStatus: viewingEmployee.employmentStatus,
        archived: viewingEmployee.archived,
      })
    );
  }, [deMinimisBenefits, viewingEmployee]);
  const viewingEmployeeAllowanceLoanHistory = useMemo<EmployeeAllowanceLoanHistoryItem[]>(() => {
    if (!viewingEmployee) return [];

    return payrollRecords
      .filter((record) => record.employeeNo === viewingEmployee.employeeNo)
      .flatMap((record) =>
        (record.importedAllowancesLoans || []).map((item) => ({
          ...item,
          recordId: record.id || record.bulkRunId || `${record.employeeNo || "employee"}-${record.payrollDate || record.createdAt || "payroll-run"}`,
          runLabel: formatPayrollRunLabel(record),
          cutoffLabel: formatCutoffLabel(record.runCutoff || record.cutoffIdentity),
          payrollDate: record.payrollDate,
          createdAt: record.createdAt,
        }))
      )
      .sort((a, b) =>
        String(b.payrollDate || b.createdAt || "").localeCompare(String(a.payrollDate || a.createdAt || ""))
      );
  }, [payrollRecords, viewingEmployee]);
  const [viewingPayrollRecordsFor, setViewingPayrollRecordsFor] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EditableEmployeeFields | null>(null);
  const [editPhotoInputKey, setEditPhotoInputKey] = useState(0);
  const [editPhotoFileName, setEditPhotoFileName] = useState("");
  const [employeeViewMode, setEmployeeViewMode] = useState<"active" | "archived">("active");
  const [archiveTargetEmployeeNos, setArchiveTargetEmployeeNos] = useState<string[]>([]);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveStatus, setArchiveStatus] = useState("Inactive");
  const [archiveEffectiveDate, setArchiveEffectiveDate] = useState("");
  const [employeeNoFilter, setEmployeeNoFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [payrollTypeFilter, setPayrollTypeFilter] = useState("");
  const [exemptFilter, setExemptFilter] = useState("");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [basicPayFilter, setBasicPayFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage, setEmployeesPerPage] = useState(25);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    async function loadTheme() {
      const savedTheme = await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME);
      const normalized = normalizeTheme(savedTheme);
      setTheme(normalized);
      applyAppTheme(normalized);
    }
    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    };
  }, []);

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = Math.round((activeTheme.bannerOverlayOpacity / 100) * 255).toString(16).padStart(2, "0");
  const bannerStyle = activeTheme.bannerImageDataUrl
    ? {
        backgroundColor: activeTheme.bannerColor,
        backgroundImage: `linear-gradient(90deg, ${activeTheme.bannerColor}${bannerOverlayAlpha} 0%, ${activeTheme.bannerColor}${bannerOverlayAlpha} 100%), url(${activeTheme.bannerImageDataUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : { backgroundColor: activeTheme.bannerColor };

  const loadEmployees = useCallback(async () => {
    const savedEmployees = await getCollectionItems<Employee>(storageKeys.employees);
    setEmployees(savedEmployees.map(normalizeEmployee));
  }, []);

  const loadDeMinimisBenefits = useCallback(async () => {
    const savedBenefits = await getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits);
    setDeMinimisBenefits(savedBenefits.filter((benefit) => !benefit.archived));
  }, []);

  const loadPayrollRecords = useCallback(async () => {
    const savedRecords = await getCollectionItems<EmployeePayrollRecord>(storageKeys.payrollRecords);
    setPayrollRecords(savedRecords);
  }, []);

  const loadPayrollLoans = useCallback(async () => {
    const savedLoans = await getCollectionItems<PayrollLoanRecord>(storageKeys.payrollLoans);
    setPayrollLoans(savedLoans);
  }, []);

  useEffect(() => {
    loadEmployees();
    loadDeMinimisBenefits();
    loadPayrollRecords();
    loadPayrollLoans();
    window.addEventListener("employees-updated", loadEmployees as EventListener);
    window.addEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);
    window.addEventListener(`${storageKeys.payrollRecords}-updated`, loadPayrollRecords as EventListener);
    window.addEventListener(`${storageKeys.payrollLoans}-updated`, loadPayrollLoans as EventListener);
    return () => {
      window.removeEventListener("employees-updated", loadEmployees as EventListener);
      window.removeEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);
      window.removeEventListener(`${storageKeys.payrollRecords}-updated`, loadPayrollRecords as EventListener);
      window.removeEventListener(`${storageKeys.payrollLoans}-updated`, loadPayrollLoans as EventListener);
    };
  }, [loadDeMinimisBenefits, loadEmployees, loadPayrollLoans, loadPayrollRecords]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const isArchived = employee.archived === true;
      const archiveModeMatches = employeeViewMode === "archived" ? isArchived : !isArchived;
      if (!archiveModeMatches) return false;
      const employeeNoMatches = employee.employeeNo
        .toLowerCase()
        .includes(employeeNoFilter.trim().toLowerCase());

      const employeeMatches = getFullName(employee)
        .toLowerCase()
        .includes(employeeFilter.trim().toLowerCase());

      const departmentMatches = (employee.department || "")
        .toLowerCase()
        .includes(departmentFilter.trim().toLowerCase());

      const designationMatches = (employee.designation || "")
        .toLowerCase()
        .includes(designationFilter.trim().toLowerCase());

      const payrollTypeMatches = payrollTypeFilter
        ? (employee.payrollRunType || "").toUpperCase() === payrollTypeFilter.toUpperCase()
        : true;

      const exemptMatches = exemptFilter
        ? (employee.payrollExempt || "").toLowerCase() === exemptFilter.toLowerCase()
        : true;

      const employeeTypeMatches = employeeTypeFilter
        ? (employee.employeeType || "").toLowerCase() === employeeTypeFilter.toLowerCase()
        : true;

      const statusMatches = statusFilter
        ? (employee.employmentStatus || "").toLowerCase() === statusFilter.toLowerCase()
        : true;

      const basicPayMatches = basicPayFilter
        ? String(employee.basicPay ?? "")
            .toLowerCase()
            .includes(basicPayFilter.trim().toLowerCase())
        : true;

      return (
        employeeNoMatches &&
        employeeMatches &&
        departmentMatches &&
        designationMatches &&
        payrollTypeMatches &&
        exemptMatches &&
        employeeTypeMatches &&
        statusMatches &&
        basicPayMatches
      );
    });
  }, [
    employees,
    employeeViewMode,
    employeeNoFilter,
    employeeFilter,
    departmentFilter,
    designationFilter,
    payrollTypeFilter,
    exemptFilter,
    employeeTypeFilter,
    statusFilter,
    basicPayFilter,
  ]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => compareEmployees(a, b, sortColumn, sortDirection));
  }, [filteredEmployees, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / employeesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstEmployeeIndex = (safeCurrentPage - 1) * employeesPerPage;
  const lastEmployeeIndex = Math.min(firstEmployeeIndex + employeesPerPage, sortedEmployees.length);

  const paginatedEmployees = useMemo(() => {
    return sortedEmployees.slice(firstEmployeeIndex, lastEmployeeIndex);
  }, [sortedEmployees, firstEmployeeIndex, lastEmployeeIndex]);

  useEffect(() => {
    const resetPageId = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(resetPageId);
  }, [
    employeeViewMode,
    employeeNoFilter,
    employeeFilter,
    departmentFilter,
    designationFilter,
    payrollTypeFilter,
    exemptFilter,
    employeeTypeFilter,
    statusFilter,
    basicPayFilter,
    sortColumn,
    sortDirection,
  ]);

  useEffect(() => {
    if (currentPage <= totalPages) return;

    const clampPageId = window.setTimeout(() => setCurrentPage(totalPages), 0);
    return () => window.clearTimeout(clampPageId);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!selectAllRef.current) return;

    const pageEmployeeNos = paginatedEmployees.map((employee) => employee.employeeNo);
    const selectedOnPageCount = pageEmployeeNos.filter((employeeNo) => selectedEmployeeNos.includes(employeeNo)).length;

    selectAllRef.current.indeterminate =
      pageEmployeeNos.length > 0 && selectedOnPageCount > 0 && selectedOnPageCount < pageEmployeeNos.length;
  }, [paginatedEmployees, selectedEmployeeNos]);

  const activeCount = useMemo(
    () => employees.filter((employee) => employee.archived !== true).length,
    [employees]
  );

  const totalMonthlyBasicPay = useMemo(
    () => filteredEmployees
      .filter((e) => !e.archived)
      .reduce((sum, e) => sum + (e.basicPay || 0), 0),
    [filteredEmployees]
  );

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  function handleToggleFilterMenu(column: Exclude<FilterMenuColumn, null>) {
    setOpenActionMenuFor(null);
    setOpenFilterMenuFor((current) => (current === column ? null : column));
  }

  function clearAllFilters() {
    setEmployeeNoFilter("");
    setEmployeeFilter("");
    setDepartmentFilter("");
    setDesignationFilter("");
    setPayrollTypeFilter("");
    setExemptFilter("");
    setEmployeeTypeFilter("");
    setStatusFilter("");
    setBasicPayFilter("");
    setOpenFilterMenuFor(null);
  }

  function handleToggleSelected(employeeNo: string) {
    setSelectedEmployeeNos((current) =>
      current.includes(employeeNo)
        ? current.filter((item) => item !== employeeNo)
        : [...current, employeeNo]
    );
  }

  function handleToggleSelectAll() {
    setOpenFilterMenuFor(null);

    const pageEmployeeNos = paginatedEmployees.map((employee) => employee.employeeNo);
    const allPageEmployeesSelected =
      pageEmployeeNos.length > 0 && pageEmployeeNos.every((employeeNo) => selectedEmployeeNos.includes(employeeNo));

    if (allPageEmployeesSelected) {
      setSelectedEmployeeNos((current) => current.filter((employeeNo) => !pageEmployeeNos.includes(employeeNo)));
      return;
    }

    setSelectedEmployeeNos((current) => Array.from(new Set([...current, ...pageEmployeeNos])));
  }

  function handleOpenViewDetails(employee: Employee) {
    setOpenActionMenuFor(null);
    setOpenFilterMenuFor(null);
    setViewingEmployee(null);
    window.location.href = `/add-employee?viewEmployeeNo=${encodeURIComponent(employee.employeeNo)}`;
  }

  function handleOpenPayrollRecords(employee: Employee) {
    setOpenActionMenuFor(null);
    setOpenFilterMenuFor(null);
    setViewingPayrollRecordsFor(employee);
  }

  function handleOpenEdit(employee: Employee) {
    const confirmed = window.confirm(
      `Are you sure you want to edit ${getFullName(employee)}? You will be redirected to the Add Employee page where the employee record can be updated.`
    );

    if (!confirmed) return;

    setOpenActionMenuFor(null);
    setOpenFilterMenuFor(null);
    setViewingEmployee(null);
    setEditingEmployee(toEditableEmployee(employee));
    window.location.href = `/add-employee?editEmployeeNo=${encodeURIComponent(employee.employeeNo)}`;
  }


  async function handleEditEmployeePhotoUpload(file: File | null) {
    if (!file || !editingEmployee) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please upload an image file for the employee photo.");
      return;
    }

    try {
      const selectedFileName = file.name;
      const photoDataUrl = await resizeEmployeePhoto(file);

      setEditingEmployee((current) =>
        current ? { ...current, employeePhotoDataUrl: photoDataUrl } : current
      );
      setEditPhotoFileName(selectedFileName);
    } catch (error) {
      console.error("Failed to process employee photo", error);
      window.alert("The employee photo could not be processed. Please try a different JPG or PNG image.");
      setEditPhotoInputKey((current) => current + 1);
    }
  }
  function requestArchive(employeeNos: string[]) {
    if (employeeNos.length === 0) {
      window.alert("Select at least one employee first.");
      return;
    }

    setArchiveTargetEmployeeNos(employeeNos);
    setArchiveReason("");
    setArchiveStatus("Inactive");
    setArchiveEffectiveDate("");
    setOpenActionMenuFor(null);
    setOpenFilterMenuFor(null);
  }

  function handleConfirmArchive() {
    if (archiveTargetEmployeeNos.length === 0) return;

    if (!archiveReason.trim()) {
      window.alert("Archive reason is required.");
      return;
    }

    if (!archiveEffectiveDate.trim()) {
      window.alert("Effective date is required.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to archive ${archiveTargetEmployeeNos.length} employee record(s)? Archived employees will move to the Archives tab but remain available for reference.`
    );

    if (!confirmed) return;

    const archivedAt = new Date().toISOString();
    const nextEmployees = employees.map((employee) =>
      archiveTargetEmployeeNos.includes(employee.employeeNo)
        ? {
            ...employee,
            archived: true,
            archivedAt,
            archiveReason: archiveReason.trim(),
            archiveStatus,
            separationDate: archiveEffectiveDate,
            expectedSeparationDate: archiveEffectiveDate,
            reasonForLeaving: archiveReason.trim(),
            employmentStatus: archiveStatus,
          }
        : employee
    );

    setCollectionItems(storageKeys.employees, nextEmployees.map((e) => ({ ...e, id: e.employeeNo })));
    window.dispatchEvent(new Event("employees-updated"));
    nextEmployees
      .filter((e) => archiveTargetEmployeeNos.includes(e.employeeNo) && e.archived)
      .forEach((e) => {
        const position = e.designation || e.jobTitle || "";
        logAudit({
          action: "ARCHIVED",
          entityType: "Employee",
          entityId: e.employeeNo,
          entityName: `${e.lastName}, ${e.firstName}`,
          details: `Employee archived. Department: ${e.department || "—"}; Position: ${position || "—"}${archiveReason.trim() ? "; Reason: " + archiveReason.trim() : ""}`,
        });
      });
    setSelectedEmployeeNos([]);
    setArchiveTargetEmployeeNos([]);
    setArchiveReason("");
    setArchiveStatus("Inactive");
    setArchiveEffectiveDate("");
    setEmployeeViewMode("archived");
    setViewingEmployee(null);
    loadEmployees();
    window.alert("Employee record(s) archived successfully.");
  }

  function handleArchiveEmployee(employee: Employee) {
    requestArchive([employee.employeeNo]);
  }

  function handleBulkArchive() {
    requestArchive(selectedEmployeeNos);
  }

  function restoreEmployees(employeeNos: string[]) {
    const targetNos = Array.from(new Set(employeeNos)).filter(Boolean);
    if (targetNos.length === 0) return;

    const confirmed = window.confirm(
      targetNos.length === 1
        ? "Are you sure you want to restore this employee? This will return the employee to the Active Employees tab."
        : `Are you sure you want to restore ${targetNos.length} employee record(s)? This will return them to the Active Employees tab.`
    );

    if (!confirmed) return;

    const restoredEmployees = employees.filter((employee) => targetNos.includes(employee.employeeNo));
    const nextEmployees = employees.map((currentEmployee) =>
      targetNos.includes(currentEmployee.employeeNo)
        ? {
            ...currentEmployee,
            archived: false,
            archivedAt: "",
            archiveReason: "",
            archiveStatus: "",
            employmentStatus: currentEmployee.employmentStatus === "Resigned" || currentEmployee.employmentStatus === "Terminated" || currentEmployee.employmentStatus === "End of Contract" || currentEmployee.employmentStatus === "Retired" || currentEmployee.employmentStatus === "Inactive"
              ? "R"
              : currentEmployee.employmentStatus,
          }
        : currentEmployee
    );

    setCollectionItems(storageKeys.employees, nextEmployees.map((e) => ({ ...e, id: e.employeeNo })));
    window.dispatchEvent(new Event("employees-updated"));
    restoredEmployees.forEach((employee) => {
      const restoredPosition = employee.designation || employee.jobTitle || "";
      logAudit({
        action: "RESTORED",
        entityType: "Employee",
        entityId: employee.employeeNo,
        entityName: `${employee.lastName}, ${employee.firstName}`,
        details: `Employee restored. Department: ${employee.department || "—"}; Position: ${restoredPosition || "—"}`,
      });
    });
    setOpenActionMenuFor(null);
    setSelectedEmployeeNos([]);
    setEmployeeViewMode("active");
    loadEmployees();
    window.alert(targetNos.length === 1 ? "Employee record restored successfully." : "Employee records restored successfully.");
  }

  function handleUnarchiveEmployee(employee: Employee) {
    restoreEmployees([employee.employeeNo]);
  }

  function handleBulkRestore() {
    restoreEmployees(selectedEmployeeNos);
  }

  function deleteArchivedEmployeesForever(employeeNos: string[]) {
    const targetNos = Array.from(new Set(employeeNos)).filter(Boolean);
    if (targetNos.length === 0) return;

    const targetEmployees = employees.filter(
      (employee) => targetNos.includes(employee.employeeNo) && employee.archived
    );

    if (targetEmployees.length === 0) {
      window.alert("Select archived employee records to delete.");
      return;
    }

    const confirmed = window.confirm(
      targetEmployees.length === 1
        ? `Delete ${getFullName(targetEmployees[0])} forever? This permanently deletes the archived employee record and cannot be undone.`
        : `Delete ${targetEmployees.length} archived employee records forever? This permanently deletes the selected records and cannot be undone.`
    );

    if (!confirmed) return;

    const targetSet = new Set(targetEmployees.map((employee) => employee.employeeNo));
    const nextEmployees = employees.filter((employee) => !targetSet.has(employee.employeeNo));

    setCollectionItems(storageKeys.employees, nextEmployees.map((e) => ({ ...e, id: e.employeeNo })));
    window.dispatchEvent(new Event("employees-updated"));
    targetEmployees.forEach((employee) => {
      const position = employee.designation || employee.jobTitle || "";
      logAudit({
        action: "DELETED",
        entityType: "Employee",
        entityId: employee.employeeNo,
        entityName: `${employee.lastName}, ${employee.firstName}`,
        details: `Archived employee permanently deleted. Department: ${employee.department || "—"}; Position: ${position || "—"}`,
      });
    });
    setOpenActionMenuFor(null);
    setSelectedEmployeeNos([]);
    setViewingEmployee(null);
    loadEmployees();
    window.alert(targetEmployees.length === 1 ? "Archived employee deleted forever." : "Archived employees deleted forever.");
  }

  function handleDeleteEmployeeForever(employee: Employee) {
    deleteArchivedEmployeesForever([employee.employeeNo]);
  }

  function handleBulkDeleteForever() {
    deleteArchivedEmployeesForever(selectedEmployeeNos);
  }


  async function handleSaveEdit() {
    if (!editingEmployee) return;

    const savedEmployees = await getCollectionItems<Employee>(storageKeys.employees);

    const baseEmployee = employees.find(
      (employee) => employee.employeeNo === editingEmployee.employeeNo
    );

    if (!baseEmployee) {
      window.alert("Employee record not found.");
      return;
    }

    const requiredFields: Array<[string, string]> = [
      ["Employee No.", editingEmployee.employeeNo],
      ["Company", editingEmployee.company],
      ["Last Name", editingEmployee.lastName],
      ["First Name", editingEmployee.firstName],
      ["Birthdate", editingEmployee.birthdate],
      ["Contact Number", editingEmployee.contactNumber],
      ["Email Address", editingEmployee.emailAddress],
      ["Address", editingEmployee.address],
      ["Employment Status", editingEmployee.employmentStatus],
      ["Department", editingEmployee.department],
      ["Designation", editingEmployee.designation],
      ["Employment Classification", editingEmployee.employmentClassification],
      ["Minimum Wage Earner", editingEmployee.isMinimumWageEarner],
      ["Payroll Run Type", editingEmployee.payrollRunType],
      ["Shift", editingEmployee.shiftType],
      ["Hourly Rate", editingEmployee.hourlyRate],
      ["Basic Pay", editingEmployee.basicPay],
      ["SSS Number", editingEmployee.sss],
      ["PhilHealth Number", editingEmployee.philhealth],
      ["Pag-IBIG Number", editingEmployee.pagibig],
      ["TIN", editingEmployee.tin],
      ["Bank Name", editingEmployee.bankName],
      ["Bank Account Number", editingEmployee.bankAccountNumber],
      ["Bank Account Type", editingEmployee.bankAccountType],
    ];

    const missingField = requiredFields.find(([, value]) => !String(value || "").trim());
    if (missingField) {
      window.alert(`${missingField[0]} is required.`);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to save these employee changes? This may affect payroll records, payslips, reports, and employee information shown across the system."
    );

    if (!confirmed) return;

    let mergedEmployee: Employee = {
      ...baseEmployee,
      employeeNo: editingEmployee.employeeNo.trim(),
      lastName: editingEmployee.lastName.trim(),
      firstName: editingEmployee.firstName.trim(),
      middleName: editingEmployee.middleName.trim(),
      company: editingEmployee.company.trim(),
      designation: editingEmployee.designation.trim(),
      employmentClassification: editingEmployee.employmentClassification.trim(),
      isMinimumWageEarner: editingEmployee.isMinimumWageEarner.trim(),
      department: editingEmployee.department.trim(),
      employeeType: editingEmployee.employeeType.trim(),
      immediateSupervisor: editingEmployee.immediateSupervisor.trim(),
      designatedWorkplace: editingEmployee.designatedWorkplace.trim(),
      employmentStatus: editingEmployee.employmentStatus.trim(),
      userType: editingEmployee.userType.trim(),
      jobCode: editingEmployee.jobCode.trim(),
      jobGrade: editingEmployee.jobGrade.trim(),
      costName: editingEmployee.costName.trim(),
      eligibility: editingEmployee.eligibility.trim(),
      hireDate: editingEmployee.hireDate.trim(),
      expectedRegularizationDate: editingEmployee.expectedRegularizationDate.trim(),
      regularizationDate: editingEmployee.regularizationDate.trim(),
      expectedSeparationDate: editingEmployee.expectedSeparationDate.trim(),
      separationDate: editingEmployee.separationDate.trim(),
      reasonForLeaving: editingEmployee.reasonForLeaving.trim(),
      employeeRemarks: editingEmployee.employeeRemarks.trim(),
      biometricId: editingEmployee.biometricId.trim(),
      payrollRunType: editingEmployee.payrollRunType.trim(),
      shiftType: editingEmployee.shiftType.trim() || "Day Shift",
      payslipId: editingEmployee.payslipId.trim(),
      hourlyRate: Number(editingEmployee.hourlyRate) || 0,
      basicPay: Number(editingEmployee.basicPay) || 0,
      riceSubsidy: Number(editingEmployee.riceSubsidy) || 0,
      uniformClothingAllowance: Number(editingEmployee.uniformClothingAllowance) || 0,
      laundryAllowance: Number(editingEmployee.laundryAllowance) || 0,
      actualMedicalAssistance: Number(editingEmployee.actualMedicalAssistance) || 0,
      medicalCashAllowanceToDependents: Number(editingEmployee.medicalCashAllowanceToDependents) || 0,
      mealAllowance: Number(editingEmployee.mealAllowance) || 0,
      christmasAnniversaryGifts: Number(editingEmployee.christmasAnniversaryGifts) || 0,
      achievementAwards: Number(editingEmployee.achievementAwards) || 0,
      thirteenthMonthPay: Number(editingEmployee.thirteenthMonthPay) || 0,
      christmasBonus: Number(editingEmployee.christmasBonus) || 0,
      otherAllowanceName: editingEmployee.otherAllowanceName.trim(),
      otherAllowanceAmount: Number(editingEmployee.otherAllowanceAmount) || 0,
      contactNumber: editingEmployee.contactNumber.trim(),
      emailAddress: editingEmployee.emailAddress.trim(),
      sss: editingEmployee.sss.trim(),
      philhealth: editingEmployee.philhealth.trim(),
      pagibig: editingEmployee.pagibig.trim(),
      tin: editingEmployee.tin.trim(),
      bankName: editingEmployee.bankName.trim(),
      bankAccountNumber: editingEmployee.bankAccountNumber.trim(),
      bankAccountType: editingEmployee.bankAccountType.trim() || "Savings",
      birthdate: editingEmployee.birthdate.trim(),
      address: editingEmployee.address.trim(),
      employeePhotoDataUrl: editingEmployee.employeePhotoDataUrl.trim(),
    };

    const beforeBaseSalary = getCurrentBaseSalary(baseEmployee);
    const enteredBaseSalary = Number(editingEmployee.basicPay) || 0;
    const salaryChanged = beforeBaseSalary !== enteredBaseSalary;
    const salaryEffectiveDate = todayIsoDate();
    const salaryChangeReason = "Employee profile salary update";
    const salaryHistory = salaryChanged
      ? appendSalaryHistoryEntry(baseEmployee, {
          effectiveDate: salaryEffectiveDate,
          baseSalary: enteredBaseSalary,
          reason: salaryChangeReason,
          changedBy: getSalaryChangedBy(),
          changedAt: new Date().toISOString(),
        })
      : normalizeSalaryHistory(baseEmployee);

    mergedEmployee = {
      ...mergedEmployee,
      salaryHistory,
      basicPay: getCurrentBaseSalary({ ...mergedEmployee, salaryHistory }),
    };
    const auditDetails = `${diffEmployee(baseEmployee, mergedEmployee)}${
      salaryChanged
        ? `; Salary History: ${formatCurrency(beforeBaseSalary)} → ${formatCurrency(enteredBaseSalary)} effective ${salaryEffectiveDate}; Reason: ${salaryChangeReason}`
        : ""
    }`;

    const existingIndex = savedEmployees.findIndex(
      (employee) => employee.employeeNo === mergedEmployee.employeeNo
    );

    if (existingIndex >= 0) {
      savedEmployees[existingIndex] = mergedEmployee;
    } else {
      const baseIndex = employees.findIndex(
        (employee) => employee.employeeNo === mergedEmployee.employeeNo
      );

      if (baseIndex >= 0) {
        const nextEmployees = [...employees];
        nextEmployees[baseIndex] = mergedEmployee;
        try {
          await setCollectionItems(storageKeys.employees, nextEmployees.map((e) => ({ ...e, id: e.employeeNo })));
        } catch (error) {
          console.error("Failed to save employees to Firestore", error);
          window.alert("The employee record could not be saved. Please try again.");
          return;
        }

        window.dispatchEvent(new Event("employees-updated"));
        logAudit({
          action: "EDITED",
          entityType: "Employee",
          entityId: mergedEmployee.employeeNo,
          entityName: `${mergedEmployee.lastName}, ${mergedEmployee.firstName}`,
          details: auditDetails,
        });
        setEditingEmployee(null);
        loadEmployees();
        window.alert("Employee details updated successfully.");
        return;
      }

      savedEmployees.push(mergedEmployee);
    }

    try {
      await setCollectionItems(storageKeys.employees, savedEmployees.map((e) => ({ ...e, id: e.employeeNo })));
    } catch (error) {
      console.error("Failed to save employees to Firestore", error);
      window.alert("The employee record could not be saved. Please try again.");
      return;
    }

    window.dispatchEvent(new Event("employees-updated"));
    logAudit({
      action: "EDITED",
      entityType: "Employee",
      entityId: mergedEmployee.employeeNo,
      entityName: `${mergedEmployee.lastName}, ${mergedEmployee.firstName}`,
      details: auditDetails,
    });
    setEditingEmployee(null);
    loadEmployees();
    window.alert("Employee details updated successfully.");
  }

  const [employeePayrollRecords, setEmployeePayrollRecords] = useState<EmployeePayrollRecord[]>([]);

  useEffect(() => {
    if (!viewingPayrollRecordsFor) { setEmployeePayrollRecords([]); return; }
    getCollectionItems<EmployeePayrollRecord>(storageKeys.payrollRecords).then((all) => {
      setEmployeePayrollRecords(
        all.filter((r) => String(r.employeeNo || "") === viewingPayrollRecordsFor.employeeNo)
      );
    }).catch(() => setEmployeePayrollRecords([]));
  }, [viewingPayrollRecordsFor]);

  const employeePayrollCurrentYear = String(new Date().getFullYear());
  const employeeYtdPayrollRecords = employeePayrollRecords.filter(
    (record) => getRecordYear(record) === employeePayrollCurrentYear
  );

  const employeeYtdTotals = employeeYtdPayrollRecords.reduce<{
    basicPay: number;
    grossPay: number;
    deductions: number;
    withholdingTax: number;
    netPay: number;
  }>(
    (totals, record) => {
      const basicPay = toMoney(record.cutoffBasicPay ?? record.basicPay);
      const grossPay = toMoney(record.grossPay);
      const deductions = toMoney(record.totalDeductions ?? record.deductions);
      const withholdingTax = toMoney(record.withholdingTax);
      const netPay = toMoney(record.adjustedNetPay ?? record.netPay);

      return {
        basicPay: totals.basicPay + basicPay,
        grossPay: totals.grossPay + grossPay,
        deductions: totals.deductions + deductions,
        withholdingTax: totals.withholdingTax + withholdingTax,
        netPay: totals.netPay + netPay,
      };
    },
    { basicPay: 0, grossPay: 0, deductions: 0, withholdingTax: 0, netPay: 0 }
  );

  return (
    <div className="flex min-h-screen pg-bg text-[#0b2742]">
      <div className="min-w-0 flex-1">
        {/* BANNER */}
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
                  {employeeViewMode === "archived" ? "Archive View" : "Active Directory"}
                </span>
                <span
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold"
                  style={{ color: activeTheme.bannerTextColor }}
                >
                  Employee Management
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">View Employees</h1>
              <p className="mt-1 text-sm opacity-85">Browse, search, and manage the employee directory.</p>
            </div>
            <div className="shrink-0">
              <Link
                href="/add-employee"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.10] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.18]"
                style={{ color: activeTheme.bannerTextColor }}
              >
                <UserRoundPlus className="h-4 w-4" />
                Add Employee
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Total Employees" value={String(employees.length)} />
          <SummaryCard label="Active Employees" value={String(activeCount)} />
          <SummaryCard label="Total Monthly Basic Pay" value={formatCurrency(totalMonthlyBasicPay)} />
        </section>

        {selectedEmployeeNos.length > 0 ? (
          <section className={`${subtlePanelClassName} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="text-sm font-semibold text-slate-950">
              {selectedEmployeeNos.length} employee(s) selected
            </div>
            {employeeViewMode === "archived" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleBulkRestore}
                  className={primaryButtonClassName}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restore Selected
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteForever}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-[0_14px_28px_-22px_rgba(190,18,60,0.65)] transition hover:-translate-y-0.5 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete Forever
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleBulkArchive}
                className={warningButtonClassName}
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive Selected
              </button>
            )}
          </section>
        ) : null}

        <section className={`${subtlePanelClassName} p-5`}>
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">Directory View</h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Active and archived employee records</p>
            </div>
            <div className="inline-flex w-full gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setEmployeeViewMode("active");
              setSelectedEmployeeNos([]);
              setOpenActionMenuFor(null);
              setOpenFilterMenuFor(null);
              setCurrentPage(1);
            }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              employeeViewMode === "active"
                ? "bg-[#0a4f8f] text-white shadow-[0_14px_28px_-20px_rgba(14,116,144,0.85)]"
                : "text-slate-600 hover:bg-white hover:text-[#0a4f8f]"
            }`}
          >
            Active Employees
          </button>
          <button
            type="button"
            onClick={() => {
              setEmployeeViewMode("archived");
              setSelectedEmployeeNos([]);
              setOpenActionMenuFor(null);
              setOpenFilterMenuFor(null);
              setCurrentPage(1);
            }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              employeeViewMode === "archived"
                ? "bg-[#0a4f8f] text-white shadow-[0_14px_28px_-20px_rgba(14,116,144,0.85)]"
                : "text-slate-600 hover:bg-white hover:text-[#0a4f8f]"
            }`}
          >
            Archives
          </button>
            </div>
          </div>
        </section>

        <section
          className="z-[1] overflow-visible rounded-xl bg-white"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 24 }}
        >
          {/* Card header: title + search bar + clear filters */}
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#111827]">Employee Directory</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">Click column headers to sort. Use the filter icon beside each header to narrow results.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                    <svg className="h-4 w-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={employeeFilter}
                    onChange={(e) => { setEmployeeFilter(e.target.value); setCurrentPage(1); }}
                    placeholder="Search by name..."
                    className="h-9 rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#0a4f8f] focus:ring-2 focus:ring-blue-100"
                    style={{ width: 220 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#374151] transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              </div>
            </div>
            {/* Toolbar quick-filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter:</span>
              <select
                value={employeeTypeFilter}
                onChange={(e) => { setEmployeeTypeFilter(e.target.value); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold text-[#374151] outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Employee Types</option>
                <option value="Rank and File">Rank and File</option>
                <option value="Supervisory">Supervisory</option>
              </select>
              <select
                value={payrollTypeFilter}
                onChange={(e) => { setPayrollTypeFilter(e.target.value); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold text-[#374151] outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Payroll Types</option>
                <option value="A">Payroll Type A</option>
                <option value="B">Payroll Type B</option>
              </select>
              <select
                value={exemptFilter}
                onChange={(e) => { setExemptFilter(e.target.value); setCurrentPage(1); }}
                className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-xs font-semibold text-[#374151] outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All (Exempt status)</option>
                <option value="Yes">Exempt: Yes</option>
                <option value="No">Exempt: No</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: openFilterMenuFor || openActionMenuFor ? 220 : 0, marginLeft: -24, marginRight: -24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", position: "sticky", top: 0, zIndex: 10 }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1", width: 44 }}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={paginatedEmployees.length > 0 && paginatedEmployees.every((employee) => selectedEmployeeNos.includes(employee.employeeNo))}
                      onChange={handleToggleSelectAll}
                      className="h-4 w-4 accent-[#0a4f8f]"
                    />
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="EMP NO." column="employeeNo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "employeeNo"} filterValue={employeeNoFilter}>
                      <InputField value={employeeNoFilter} onChange={(e) => setEmployeeNoFilter(e.target.value)} placeholder="Filter employee no." />
                    </SortHeader>
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                    Date Added
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="Employee" column="employee" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "employee"} filterValue={employeeFilter}>
                      <InputField value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} placeholder="Filter employee" />
                    </SortHeader>
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="Department" column="department" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "department"} filterValue={departmentFilter}>
                      <InputField value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} placeholder="Filter department" />
                    </SortHeader>
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="Job Title" column="designation" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "designation"} filterValue={designationFilter}>
                      <InputField value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} placeholder="Filter job title" />
                    </SortHeader>
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="Payroll Type" column="payrollRunType" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "payrollRunType"} filterValue={payrollTypeFilter}>
                      <SelectField value={payrollTypeFilter} onChange={(e) => setPayrollTypeFilter(e.target.value)}>
                        <option value="">All types</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                      </SelectField>
                    </SortHeader>
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                    Exempt
                  </th>
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                    <SortHeader label="Status" column="employmentStatus" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "employmentStatus"} filterValue={statusFilter}>
                      <SelectField value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="Regular">Regular</option>
                        <option value="Probationary">Probationary</option>
                        <option value="Terminated">Terminated</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Resigned">Resigned</option>
                        <option value="End of Contract">End of Contract</option>
                        <option value="Retired">Retired</option>
                      </SelectField>
                    </SortHeader>
                  </th>
                  {employeeViewMode === "archived" ? (
                    <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                      Archive Reason
                    </th>
                  ) : null}
                  {employeeViewMode === "active" ? (
                    <th style={{ textAlign: "right", padding: "12px 16px", borderBottom: "2px solid #CBD5E1" }}>
                      <SortHeader label="Basic Pay" column="basicPay" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onToggleFilterMenu={handleToggleFilterMenu} isFilterMenuOpen={openFilterMenuFor === "basicPay"} filterValue={basicPayFilter}>
                        <InputField value={basicPayFilter} onChange={(e) => setBasicPayFilter(e.target.value)} placeholder="Filter basic pay" />
                      </SortHeader>
                    </th>
                  ) : null}
                  <th style={{ textAlign: "left", padding: "12px 16px", borderBottom: "2px solid #CBD5E1", fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody style={{ position: "relative", zIndex: 2 }}>
                {paginatedEmployees.map((employee) => (
                  <EmployeeTableRow
                    key={employee.employeeNo}
                    employee={employee}
                    isSelected={selectedEmployeeNos.includes(employee.employeeNo)}
                    actionMenuOpen={openActionMenuFor === employee.employeeNo}
                    onToggleSelected={handleToggleSelected}
                    onToggleActionMenu={(employeeNo) => {
                      setOpenFilterMenuFor(null);
                      setOpenActionMenuFor((current) =>
                        current === employeeNo ? null : employeeNo
                      );
                    }}
                    onViewDetails={handleOpenViewDetails}
                    onViewPayrollRecords={handleOpenPayrollRecords}
                    onEdit={handleOpenEdit}
                    onArchive={handleArchiveEmployee}
                    onUnarchive={handleUnarchiveEmployee}
                    onDeleteForever={handleDeleteEmployeeForever}
                  />
                ))}
              </tbody>
            </table>
            {paginatedEmployees.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm font-medium text-[#6B7280]">
                {employees.length === 0
                  ? "No employees found. Add your first employee."
                  : "No employees match the current filters."}
              </div>
            ) : null}
          </div>
        </section>

        {/* Pagination */}
        <div className="mt-1 flex flex-col items-center gap-3 rounded-xl bg-white px-4 py-3 sm:flex-row sm:justify-between" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {/* Left: count info */}
          <p className="text-xs text-[#6B7280]">
            {sortedEmployees.length === 0
              ? "No results"
              : <>Showing <span className="font-semibold text-[#111827]">{firstEmployeeIndex + 1}–{lastEmployeeIndex}</span> of <span className="font-semibold text-[#111827]">{sortedEmployees.length}</span> {employeeViewMode === "archived" ? "archived" : "active"} employee{sortedEmployees.length !== 1 ? "s" : ""}</>
            }
          </p>

          {/* Center: prev / page / next */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[100px] text-center text-sm font-semibold text-[#111827]">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#374151] transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Right: rows per page */}
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <span>Rows per page</span>
            <select
              value={employeesPerPage}
              onChange={(e) => { setEmployeesPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm font-medium text-[#111827] outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-blue-100"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {viewingPayrollRecordsFor ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 65,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 1200,
                background: "#ffffff",
                borderRadius: 32,
                border: "1px solid #e2e8f0",
                padding: 28,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "#0f172a" }}>
                    Payroll Records
                  </div>
                  <div style={{ color: "#64748b", marginTop: 8 }}>
                    {getFullName(viewingPayrollRecordsFor)} • {viewingPayrollRecordsFor.employeeNo}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPayrollRecordsFor(null)}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 16,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <SummaryCard label={`YTD Basic Pay (${employeePayrollCurrentYear})`} value={formatCurrency(employeeYtdTotals.basicPay)} />
                <SummaryCard label={`YTD Gross Pay (${employeePayrollCurrentYear})`} value={formatCurrency(employeeYtdTotals.grossPay)} />
                <SummaryCard label={`YTD Deductions (${employeePayrollCurrentYear})`} value={formatCurrency(employeeYtdTotals.deductions)} />
                <SummaryCard label={`YTD Withholding Tax (${employeePayrollCurrentYear})`} value={formatCurrency(employeeYtdTotals.withholdingTax)} />
                <SummaryCard label={`YTD Net Pay (${employeePayrollCurrentYear})`} value={formatCurrency(employeeYtdTotals.netPay)} />
              </div>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: 24, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Payroll Period</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Payroll Date</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Basic Pay</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Gross Pay</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Deductions</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Withholding Tax</th>
                      <th style={{ textAlign: "right", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Net Pay</th>
                      <th style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e2e8f0" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeePayrollRecords.length > 0 ? (
                      employeePayrollRecords.map((record, index) => (
                        <tr key={`${record.id || viewingPayrollRecordsFor.employeeNo}-${index}`}>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", color: "#0f172a", fontWeight: 700 }}>
                            {getRecordLabel(record)}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                            {record.actualPayrollDate || record.payrollDate || "—"}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                            {formatCurrency(toMoney(record.cutoffBasicPay ?? record.basicPay))}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                            {formatCurrency(toMoney(record.grossPay))}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                            {formatCurrency(toMoney(record.totalDeductions ?? record.deductions))}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                            {formatCurrency(toMoney(record.withholdingTax))}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 800 }}>
                            {formatCurrency(toMoney(record.adjustedNetPay ?? record.netPay))}
                          </td>
                          <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (record.id) {
                                  window.location.href = `/payroll-records?view=record&id=${encodeURIComponent(record.id)}`;
                                }
                              }}
                              disabled={!record.id}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 14,
                                border: record.id ? "1px solid #0a4f8f" : "1px solid #e2e8f0",
                                background: record.id ? "#0a4f8f" : "#e2e8f0",
                                color: record.id ? "#ffffff" : "#64748b",
                                fontWeight: 800,
                                cursor: record.id ? "pointer" : "not-allowed",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Open record
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                          No payroll records found for this employee yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {archiveTargetEmployeeNos.length > 0 ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 75,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 560,
                background: "#ffffff",
                borderRadius: 32,
                border: "1px solid #e2e8f0",
                padding: 28,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                Archive Employee Record
              </div>
              <div style={{ color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
                Select the archive status and enter the reason. The record will move to the Archives tab but will remain available for HR and payroll reference.
              </div>

              <div style={{ display: "grid", gap: 16, marginTop: 20 }}>
                <label>
                  <FieldLabel required>Status</FieldLabel>
                  <SelectField value={archiveStatus} onChange={(e) => setArchiveStatus(e.target.value)}>
                    <option value="Inactive">Inactive</option>
                    <option value="Resigned">Resigned</option>
                    <option value="Terminated">Terminated</option>
                    <option value="End of Contract">End of Contract</option>
                    <option value="Retired">Retired</option>
                  </SelectField>
                </label>
                <label>
                  <FieldLabel required>Effective Date</FieldLabel>
                  <InputField
                    type="date"
                    value={archiveEffectiveDate}
                    onChange={(e) => setArchiveEffectiveDate(e.target.value)}
                  />
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                    This becomes the separation/end date used by Alphalist column 5B To.
                  </div>
                </label>
                <label>
                  <FieldLabel required>Reason</FieldLabel>
                  <InputField
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    placeholder="Example: Resigned effective May 31, 2026"
                  />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveTargetEmployeeNos([]);
                    setArchiveReason("");
                    setArchiveStatus("Inactive");
                    setArchiveEffectiveDate("");
                  }}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 16,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmArchive}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 16,
                    border: "1px solid #b45309",
                    background: "#f59e0b",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Archive Record
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {viewingEmployee ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 60,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 1100,
                background: "#ffffff",
                borderRadius: 32,
                border: "1px solid #e2e8f0",
                padding: 28,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: 20,
                  borderRadius: 28,
                  background: "linear-gradient(135deg, #0a4f8f 0%, #073c6d 45%, #020617 100%)",
                  border: "1px solid #0a4f8f",
                  marginBottom: 22,
                }}
              >
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.24)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: 24,
                      fontWeight: 900,
                      overflow: "hidden",
                      position: "relative",
                      flexShrink: 0,
                    }}
                  >
                    {viewingEmployee.employeePhotoDataUrl ? (
                      <NextImage
                        src={viewingEmployee.employeePhotoDataUrl}
                        alt={`${getFullName(viewingEmployee)} photo`}
                        fill
                        sizes="72px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <>
                        {(viewingEmployee.firstName?.[0] || "E").toUpperCase()}
                        {(viewingEmployee.lastName?.[0] || "").toUpperCase()}
                      </>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: "#ffffff" }}>
                      {getFullName(viewingEmployee)}
                    </div>
                    <div style={{ color: "#dbeafe", marginTop: 8, fontSize: 16 }}>
                      {viewingEmployee.employeeNo} • {viewingEmployee.designation || "—"} • {viewingEmployee.department || "—"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <StatusBadge value={getEmploymentStatusLabel(viewingEmployee.employmentStatus)} />
                </div>
              </div>

              {/* Tab switcher */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["details", "loans"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setViewProfileTab(tab)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 12,
                      border: viewProfileTab === tab ? "1px solid #0a4f8f" : "1px solid #e2e8f0",
                      background: viewProfileTab === tab ? "#0a4f8f" : "#ffffff",
                      color: viewProfileTab === tab ? "#ffffff" : "#334155",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {tab === "details" ? "Details" : "Loans"}
                  </button>
                ))}
              </div>

              {viewProfileTab === "details" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                  gap: 18,
                }}
              >
                <DetailSection title="Basic Information" tone="blue">
                  <InfoRow label="Employee No." value={viewingEmployee.employeeNo} />
                  <InfoRow label="Date Added" value={formatDateTime(getEmployeeDateAdded(viewingEmployee))} />
                  <InfoRow label="Last Name" value={viewingEmployee.lastName} />
                  <InfoRow label="First Name" value={viewingEmployee.firstName} />
                  <InfoRow label="Middle Name" value={viewingEmployee.middleName} />
                  <InfoRow label="Birthdate" value={viewingEmployee.birthdate} />
                  <InfoRow label="Contact Number" value={viewingEmployee.contactNumber} />
                  <InfoRow label="Email Address" value={viewingEmployee.emailAddress} />
                  <InfoRow label="Address" value={viewingEmployee.address} />
                </DetailSection>

                <DetailSection title="Job Information" tone="slate">
                  <InfoRow label="Company" value={viewingEmployee.company || "—"} />
                  <InfoRow label="Department" value={viewingEmployee.department} />
                  <InfoRow label="Designation" value={viewingEmployee.designation} />
                  <InfoRow label="Employee Type" value={viewingEmployee.employeeType || "—"} />
                  <InfoRow label="Employment Classification" value={viewingEmployee.employmentClassification || "Rank-and-file"} />
                  <InfoRow label="Minimum Wage Earner" value={viewingEmployee.isMinimumWageEarner || "No"} />
                  <InfoRow label="Immediate Supervisor" value={viewingEmployee.immediateSupervisor || "—"} />
                  <InfoRow label="Designated Workplace" value={viewingEmployee.designatedWorkplace || "—"} />
                  <InfoRow label="Employment Status" value={getEmploymentStatusLabel(viewingEmployee.employmentStatus)} />
                  <InfoRow label="User Type" value={viewingEmployee.userType || "—"} />
                </DetailSection>

                <DetailSection title="Employment Dates" tone="amber">
                  <InfoRow label="Hire Date" value={viewingEmployee.hireDate || "—"} />
                  <InfoRow label="Expected Regularization" value={viewingEmployee.expectedRegularizationDate || "—"} />
                  <InfoRow label="Regularization Date" value={viewingEmployee.regularizationDate || "—"} />
                  <InfoRow label="Expected Separation" value={viewingEmployee.expectedSeparationDate || "—"} />
                  <InfoRow label="Separation Date" value={viewingEmployee.separationDate || "—"} />
                  <InfoRow label="Reason for Leaving" value={viewingEmployee.reasonForLeaving || "—"} />
                  <InfoRow label="Employee Remarks" value={viewingEmployee.employeeRemarks || "—"} />
                  {viewingEmployee.archived ? (
                    <>
                      <InfoRow label="Archive Status" value={viewingEmployee.archiveStatus || "—"} />
                      <InfoRow label="Archive Reason" value={viewingEmployee.archiveReason || "—"} />
                      <InfoRow
                        label="Archived At"
                        value={viewingEmployee.archivedAt ? new Date(viewingEmployee.archivedAt).toLocaleString() : "—"}
                      />
                    </>
                  ) : null}
                </DetailSection>

                <DetailSection title="Payroll and Government Details" tone="green">
                  <InfoRow label="Hourly Rate" value={formatCurrency(viewingEmployee.hourlyRate)} />
                  <InfoRow label="Basic Pay" value={formatCurrency(viewingEmployee.basicPay)} />
                  <div className="border-b border-slate-200 py-3">
                    <div className="mb-2 text-sm font-semibold text-slate-500">Salary History</div>
                    <div className="grid gap-2">
                      {normalizeSalaryHistory(viewingEmployee).slice().reverse().map((entry, index) => (
                        <div
                          key={`${entry.effectiveDate}-${entry.changedAt || index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-950">{formatCurrency(entry.baseSalary)}</span>
                            <span className="text-xs font-bold text-[#0a4f8f]">{entry.effectiveDate}</span>
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {entry.reason || "Salary history"} · {entry.changedBy || "unknown"}{entry.changedAt ? ` · ${formatDateTime(entry.changedAt)}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <InfoRow label="Payroll Run Type" value={viewingEmployee.payrollRunType || "—"} />
                  <InfoRow label="Shift" value={viewingEmployee.shiftType || "Day Shift"} />
                  <InfoRow label="Payslip ID" value={viewingEmployee.payslipId || "—"} />
                  <InfoRow label="Biometric ID" value={viewingEmployee.biometricId || "—"} />
                  <InfoRow label="Job Code" value={viewingEmployee.jobCode || "—"} />
                  <InfoRow label="Job Grade" value={viewingEmployee.jobGrade || "—"} />
                  <InfoRow label="Cost Name" value={viewingEmployee.costName || "—"} />
                  <InfoRow label="Eligibility" value={viewingEmployee.eligibility || "—"} />
                  <InfoRow label="SSS Number" value={viewingEmployee.sss} />
                  <InfoRow label="PhilHealth Number" value={viewingEmployee.philhealth} />
                  <InfoRow label="Pag-IBIG Number" value={viewingEmployee.pagibig} />
                  <InfoRow label="TIN" value={viewingEmployee.tin} />
                  <InfoRow label="Bank Name" value={viewingEmployee.bankName || "—"} />
                  <InfoRow label="Bank Account Number" value={viewingEmployee.bankAccountNumber || "—"} />
                  <InfoRow label="Bank Account Type" value={viewingEmployee.bankAccountType || "—"} />
                </DetailSection>

                <DetailSection title="Compensation & Deductions" tone="green">
                  <div className="grid gap-4">
                    <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase tracking-wide text-slate-950">De Minimis</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">Assigned, standing</div>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                          Catalog read-through
                        </span>
                      </div>

                      {viewingEmployeeDeMinimisBenefits.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-emerald-200 bg-white/80 p-3 text-sm font-semibold text-slate-500">
                          None
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {viewingEmployeeDeMinimisBenefits.map((benefit) => {
                            const amount = Number(benefit.amount) || 0;
                            const ceiling = Number(benefit.ceiling) || 0;
                            const sharedBucketAmount = benefit.hasOwnCeiling ? Math.max(0, amount - ceiling) : amount;

                            return (
                              <div key={benefit.id} className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-slate-950">{benefit.name}</span>
                                  <span className="text-sm font-black text-slate-950">{formatCurrency(amount)}</span>
                                </div>
                                <div className="mt-1 text-xs font-semibold text-slate-500">
                                  {benefit.frequency} ·{" "}
                                  {benefit.hasOwnCeiling
                                    ? `Own ceiling: ${formatCurrency(ceiling)}; excess to shared 90k bucket: ${formatCurrency(sharedBucketAmount)}`
                                    : "Goes to 90k bucket from first peso"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase tracking-wide text-slate-950">Loans</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">Standing deductions, canonical</div>
                        </div>
                        <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-black text-amber-800">
                          Loan Monitoring read-through
                        </span>
                      </div>

                      {viewingEmployeeLoans.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-amber-200 bg-white/80 p-3 text-sm font-semibold text-slate-500">
                          None
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {viewingEmployeeLoans.map((loan) => {
                            const paid = Math.max(0, (Number(loan.principalAmount) || 0) - (Number(loan.remainingBalance) || 0));
                            return (
                              <div key={loan.id} className="rounded-xl border border-amber-100 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-bold text-slate-950">{loan.loanName}</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-500">
                                      {loan.loanType} · {loan.status} · {loan.startDate || "No start date"}{loan.endDate ? ` to ${loan.endDate}` : ""}
                                    </div>
                                  </div>
                                  <span className="text-sm font-black text-rose-700">{formatCurrency(loan.amortizationPerCutoff)} / cutoff</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1">Principal: {formatCurrency(loan.principalAmount)}</span>
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">Paid: {formatCurrency(paid)}</span>
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Remaining: {formatCurrency(loan.remainingBalance)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black uppercase tracking-wide text-slate-950">Allowances & Loans</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">Per-cutoff, transactional history</div>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-black text-[#0a4f8f]">
                          Payroll run read-through
                        </span>
                      </div>

                      {viewingEmployeeAllowanceLoanHistory.length === 0 ? (
                        <div className="mt-3 rounded-xl border border-dashed border-sky-200 bg-white/80 p-3 text-sm font-semibold text-slate-500">
                          None
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {viewingEmployeeAllowanceLoanHistory.map((item, index) => {
                            const amount = Number(item.amount) || 0;
                            const remainingBalance = getAllowanceLoanRemainingBalance(item);

                            return (
                              <div key={`${item.recordId}-${item.id}-${index}`} className="rounded-xl border border-sky-100 bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-bold text-slate-950">{item.itemName || item.itemType}</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-500">
                                      {item.itemType} · {item.taxable ? "Taxable" : "Non-taxable"} · {item.runLabel}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-black ${amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                    {formatCurrency(amount)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1">Cutoff: {item.cutoffLabel}</span>
                                  {item.payrollDate ? (
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1">Payroll date: {item.payrollDate}</span>
                                  ) : null}
                                  {remainingBalance !== undefined ? (
                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                                      Remaining balance: {formatCurrency(remainingBalance)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                </DetailSection>
              </div>
              )}

              {viewProfileTab === "loans" && (
                <div style={{ borderLeft: "4px solid #d97706", background: "#fffbeb", borderRadius: 12, padding: "16px 20px" }}>
                  {viewingEmployeeLoans.length === 0 ? (
                    <p style={{ color: "#92400e", fontSize: 14, fontWeight: 600, margin: 0 }}>
                      No loans recorded for this employee.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {viewingEmployeeLoans.map((loan, idx) => {
                        const orig = Number(loan.principalAmount) || 0;
                        const outstanding = Number(loan.remainingBalance) || 0;
                        const paid = Math.max(0, orig - outstanding);
                        const status = loan.status || (outstanding <= 0 ? "Paid" : "Active");
                        return (
                          <div key={loan.id} style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>Loan #{idx + 1}{loan.loanName ? ` — ${loan.loanName}` : ""}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99, background: status === "Paid" ? "#d1fae5" : "#fef3c7", color: status === "Paid" ? "#065f46" : "#92400e" }}>{status}</span>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Loan Name</span>
                                <input type="text" value={loan.loanName} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Loan Type</span>
                                <input type="text" value={loan.loanType || "—"} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Start Date</span>
                                <input type="text" value={loan.startDate || "—"} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>End Date</span>
                                <input type="text" value={loan.endDate || "—"} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Original Amount</span>
                                <input type="number" min={0} value={loan.principalAmount} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Outstanding Balance</span>
                                <input type="number" min={0} value={loan.remainingBalance} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Amount Paid</span>
                                <input type="text" disabled readOnly value={paid.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#78350f" }}>Monthly Deduction</span>
                                <input type="number" min={0} value={loan.amortizationPerCutoff} disabled readOnly style={{ border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#6b7280", background: "#f9fafb", outline: "none" }} />
                                {Number(loan.amortizationPerCutoff) > 0 && (
                                  <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginTop: 2 }}>
                                    Per Cutoff Deduction: ₱{Number(loan.amortizationPerCutoff).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Audit Trail */}
              <EmployeeAuditTrail employeeNo={viewingEmployee.employeeNo} />

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, flexWrap: "wrap" }}>
                {!viewingEmployee.archived ? (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(viewingEmployee)}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 16,
                      border: "1px solid #0a4f8f",
                      background: "#0a4f8f",
                      color: "#ffffff",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    Edit Employee
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingEmployee(null);
                        handleUnarchiveEmployee(viewingEmployee);
                      }}
                      style={{
                        padding: "12px 18px",
                        borderRadius: 16,
                        border: "1px solid #0a4f8f",
                        background: "#ecfeff",
                        color: "#0a4f8f",
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      Restore Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const employeeToDelete = viewingEmployee;
                        setViewingEmployee(null);
                        handleDeleteEmployeeForever(employeeToDelete);
                      }}
                      style={{
                        padding: "12px 18px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fff1f2",
                        color: "#b91c1c",
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                      }}
                    >
                      Delete Forever
                    </button>
                  </>
                )}
                {!viewingEmployee.archived ? (
                  <button
                    type="button"
                    onClick={() => handleArchiveEmployee(viewingEmployee)}
                    style={{
                      padding: "12px 18px",
                      borderRadius: 16,
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                      color: "#92400e",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    Archive Employee
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setViewingEmployee(null)}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 16,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editingEmployee ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 70,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 1100,
                background: "#ffffff",
                borderRadius: 20,
                border: "1px solid #e2e8f0",
                padding: 28,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
              }}
            >
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: "#0f172a" }}>
                  Edit Employee
                </div>
                <div style={{ color: "#64748b", marginTop: 8, lineHeight: 1.6 }}>
                  You are editing this as the super user. Please review changes carefully because they may affect payroll records, payslips, reports, and employee information across the system.
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "1 / -1", fontSize: 22, fontWeight: 800 }}>Basic Information</div>

                <label>
                  <FieldLabel required>Employee No.</FieldLabel>
                  <InputField value={editingEmployee.employeeNo} readOnly />
                </label>
                <label>
                  <FieldLabel required>Company</FieldLabel>
                  <InputField
                    value={editingEmployee.company}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, company: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Last Name</FieldLabel>
                  <InputField
                    value={editingEmployee.lastName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, lastName: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>First Name</FieldLabel>
                  <InputField
                    value={editingEmployee.firstName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, firstName: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Middle Name</FieldLabel>
                  <InputField
                    value={editingEmployee.middleName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, middleName: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Birthdate</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.birthdate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, birthdate: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Contact Number</FieldLabel>
                  <InputField
                    value={editingEmployee.contactNumber}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, contactNumber: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Email Address</FieldLabel>
                  <InputField
                    value={editingEmployee.emailAddress}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, emailAddress: e.target.value })}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel required>Address</FieldLabel>
                  <InputField
                    value={editingEmployee.address}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })}
                  />
                </label>
                <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
  <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Employee Photo</div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "150px 1fr",
      gap: 16,
      alignItems: "center",
      padding: 16,
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      background: "#f8fafc",
    }}
  >
    <div
      style={{
        width: 130,
        height: 130,
        borderRadius: 18,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        fontWeight: 800,
        position: "relative",
      }}
    >
      {editingEmployee.employeePhotoDataUrl ? (
        <NextImage
          src={editingEmployee.employeePhotoDataUrl}
          alt="Employee photo preview"
          fill
          sizes="130px"
          unoptimized
          className="object-cover"
        />
      ) : (
        "No Photo"
      )}
    </div>

    <div>
      <FieldLabel>Upload Employee Photo</FieldLabel>
      <InputField
        key={editPhotoInputKey}
        type="file"
        accept="image/*"
        onChange={(event) => handleEditEmployeePhotoUpload(event.target.files?.[0] || null)}
      />
      <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
        Optional. To replace the current employee photo, click the upload button. Photos are not included in CSV imports.
      </div>
      {editPhotoFileName ? (
        <div className="mt-2 text-xs font-semibold text-[#0a4f8f]">
          Selected: {editPhotoFileName}
        </div>
      ) : null}
    </div>
  </div>
</div>

                <div style={{ gridColumn: "1 / -1", fontSize: 22, fontWeight: 800, marginTop: 8 }}>
                  Standard Editable Fields
                </div>

                <label>
                  <FieldLabel required>Employment Status</FieldLabel>
                  <SelectField
                    value={editingEmployee.employmentStatus}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employmentStatus: e.target.value })}
                  >
                    {BIR_EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                    This is the BIR Alphalist employment status used for 1604-C.
                  </div>
                </label>
                <label>
                  <FieldLabel required>Department</FieldLabel>
                  <InputField
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                  />
                </label>
                <label>
  <FieldLabel required>Designation</FieldLabel>
  <InputField
    value={editingEmployee.designation}
    onChange={(e) =>
      setEditingEmployee({ ...editingEmployee, designation: e.target.value })
    }
  />
</label>

<label>
  <FieldLabel required>Employment Classification</FieldLabel>
  <SelectField
    value={editingEmployee.employmentClassification}
    onChange={(e) =>
      setEditingEmployee({
        ...editingEmployee,
        employmentClassification: e.target.value,
      })
    }
  >
    <option value="Rank-and-file">Rank-and-file</option>
    <option value="Managerial/Supervisory">Managerial/Supervisory</option>
  </SelectField>
  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
    Use this for employee grouping and tax/reporting checks.
  </div>
</label>

<label>
  <FieldLabel required>Minimum Wage Earner?</FieldLabel>
  <SelectField
    value={editingEmployee.isMinimumWageEarner}
    onChange={(e) =>
      setEditingEmployee({
        ...editingEmployee,
        isMinimumWageEarner: e.target.value,
      })
    }
  >
    <option value="No">No</option>
    <option value="Yes">Yes</option>
  </SelectField>
  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
    Choose Yes only if the employee is paid the applicable statutory minimum wage for the region/category.
  </div>
</label>
                <label>
                  <FieldLabel>Employee Type</FieldLabel>
                  <InputField
                    value={editingEmployee.employeeType}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employeeType: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Immediate Supervisor</FieldLabel>
                  <InputField
                    value={editingEmployee.immediateSupervisor}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, immediateSupervisor: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Designated Workplace</FieldLabel>
                  <InputField
                    value={editingEmployee.designatedWorkplace}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, designatedWorkplace: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>User Type</FieldLabel>
                  <InputField
                    value={editingEmployee.userType}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, userType: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Job Code</FieldLabel>
                  <InputField
                    value={editingEmployee.jobCode}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, jobCode: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Job Grade</FieldLabel>
                  <InputField
                    value={editingEmployee.jobGrade}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, jobGrade: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Cost Name</FieldLabel>
                  <InputField
                    value={editingEmployee.costName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, costName: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Eligibility</FieldLabel>
                  <InputField
                    value={editingEmployee.eligibility}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, eligibility: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Hire Date</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.hireDate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, hireDate: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel>Expected Regularization Date</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.expectedRegularizationDate}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, expectedRegularizationDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Regularization Date</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.regularizationDate}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, regularizationDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Expected Separation Date</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.expectedSeparationDate}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, expectedSeparationDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Separation Date</FieldLabel>
                  <InputField
                    type="date"
                    value={editingEmployee.separationDate}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, separationDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Reason for Leaving</FieldLabel>
                  <InputField
                    value={editingEmployee.reasonForLeaving}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, reasonForLeaving: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Employee Remarks</FieldLabel>
                  <InputField
                    value={editingEmployee.employeeRemarks}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, employeeRemarks: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel>Biometric ID</FieldLabel>
                  <InputField
                    value={editingEmployee.biometricId}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, biometricId: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Payroll Run Type</FieldLabel>
                  <InputField
                    value={editingEmployee.payrollRunType}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, payrollRunType: e.target.value })
                    }
                  />
                </label>
                <label>
                  <FieldLabel required>Shift</FieldLabel>
                  <SelectField
                    value={editingEmployee.shiftType || "Day Shift"}
                    onChange={(e) =>
                      setEditingEmployee({ ...editingEmployee, shiftType: e.target.value })
                    }
                  >
                    <option value="Day Shift">Day Shift</option>
                    <option value="Mid Shift">Mid Shift</option>
                    <option value="Night Shift">Night Shift</option>
                  </SelectField>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                    For scheduling only. Hourly rate stays based on salary; night differential is computed from actual night hours worked.
                  </div>
                </label>
                <label>
                  <FieldLabel>Payslip ID</FieldLabel>
                  <InputField
                    value={editingEmployee.payslipId}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, payslipId: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Hourly Rate</FieldLabel>
                  <InputField
                    type="number"
                    value={editingEmployee.hourlyRate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, hourlyRate: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Basic Pay</FieldLabel>
                  <InputField
                    type="number"
                    value={editingEmployee.basicPay}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, basicPay: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>SSS Number</FieldLabel>
                  <InputField
                    value={editingEmployee.sss}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, sss: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>PhilHealth Number</FieldLabel>
                  <InputField
                    value={editingEmployee.philhealth}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, philhealth: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>Pag-IBIG Number</FieldLabel>
                  <InputField
                    value={editingEmployee.pagibig}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, pagibig: e.target.value })}
                  />
                </label>
                <label>
                  <FieldLabel required>TIN</FieldLabel>
                  <InputField
                    value={editingEmployee.tin}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, tin: e.target.value })}
                  />
                </label>
                <label>
  <FieldLabel required>Bank Name</FieldLabel>
  <InputField
    value={editingEmployee.bankName}
    onChange={(e) => setEditingEmployee({ ...editingEmployee, bankName: e.target.value })}
    placeholder="Enter bank name"
  />
</label>

<label>
  <FieldLabel required>Bank Account Number</FieldLabel>
  <InputField
    value={editingEmployee.bankAccountNumber}
    onChange={(e) => setEditingEmployee({ ...editingEmployee, bankAccountNumber: e.target.value })}
    placeholder="Enter bank account number"
  />
</label>

<label>
  <FieldLabel required>Bank Account Type</FieldLabel>
  <SelectField
    value={editingEmployee.bankAccountType}
    onChange={(e) => setEditingEmployee({ ...editingEmployee, bankAccountType: e.target.value })}
  >
    <option value="Savings">Savings</option>
    <option value="Checking">Checking</option>
    <option value="Payroll">Payroll</option>
    <option value="Other">Other</option>
  </SelectField>
</label>

              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmployee(null);
                  }}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 12,
                    border: "1px solid #0f172a",
                    background: "#0f172a",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
