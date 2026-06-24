"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Gift,
  Layers3,
  Plus,
  ReceiptText,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UsersRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, setConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import {
  downloadPayrollComputationTemplate,
  downloadSpecialItemsTemplate,
  parsePayrollComputationWorkbook,
  parseSpecialItemsWorkbook,
  type PayrollAllowanceLoanItem,
  type PayrollAttendanceRow,
  type PayrollComputationImport,
  type PayrollCutoffIdentity,
  type SpecialItem,
  type ValidationError,
} from "@/lib/payrollRunImports";
import { runPayrollPipeline, type PayrollPipelineResult } from "@/lib/payrollRunEngine";
import type { DeMinimisBenefit, DeMinimisLine } from "@/lib/deMinimis";
import type { StandingAllowance, StandingAllowanceLine } from "@/lib/standingAllowances";
import { applyLoanDeductionsToBalances, stripUndefinedAndEmptyStrings, type LoanDeductionLine, type PayrollLoanRecord } from "@/lib/loans";
import { type DetailedRecord } from "@/lib/payrollExcel";
import DetailedPayrollRegister from "@/app/components/DetailedPayrollRegister";
import { SEED_CUTOFF_DEFINITIONS, type CutoffDefinition } from "@/lib/payrollSettingsTypes";
import { normalizeSalaryHistory, type SalaryHistoryEntry } from "@/lib/salaryHistory";

import {
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type EmployeeCustomPayrollItem = {
  id?: string;
  name: string;
  amount: number | string;
  frequency?: string;
};

type SavedEmployeeRecord = {
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  designation: string;
  employmentStatus: string;
  employmentClassification?: string;
  employeeType?: string;
  payrollRunType?: "A" | "B" | string;
  department: string;
  hourlyRate: number;
  basicPay: number;
  salaryHistory?: SalaryHistoryEntry[];
  basicPayFrequency?: string;
  standardHoursPerDay?: number | string;
  workingDaysPerMonth?: number | string;
  riceSubsidy?: number | string;
  uniformClothingAllowance?: number | string;
  laundryAllowance?: number | string;
  actualMedicalAssistance?: number | string;
  medicalCashAllowanceToDependents?: number | string;
  mealAllowance?: number | string;
  christmasAnniversaryGifts?: number | string;
  achievementAwards?: number | string;
  thirteenthMonthPay?: number | string;
  christmasBonus?: number | string;
  otherAllowanceAmount?: number | string;
  allowanceFrequencies?: Record<string, string>;
  customPremiums?: EmployeeCustomPayrollItem[];
  customAllowances?: EmployeeCustomPayrollItem[];
  customDeductions?: EmployeeCustomPayrollItem[];
  sss?: string;
  philhealth?: string;
  pagibig?: string;
  tin?: string;
  archived?: boolean;
  isMinimumWageEarner?: string | boolean;
  deductAllowanceOnAbsence?: boolean;
  loans?: Array<{
    id: string;
    loanName: string;
    dateStarted: string;
    originalAmount: number;
    outstandingBalance: number;
    monthlyDeduction: number;
  }>;
};

type EmployeeRecord = {
  employeeNo: string;
  name: string;
  designation: string;
  department: string;
  employmentStatus: string;
  employmentClassification: string;
  employeeType: string;
  payrollRunType: "A" | "B";
  isMinimumWageEarner: string;
  hourlyRate: number;
  basicPay: number;
  salaryHistory?: SalaryHistoryEntry[];
  basicPayFrequency: string;
  standardHoursPerDay: number;
  workingDaysPerMonth: number;
  riceSubsidy: number;
  uniformClothingAllowance: number;
  laundryAllowance: number;
  actualMedicalAssistance: number;
  medicalCashAllowanceToDependents: number;
  mealAllowance: number;
  christmasAnniversaryGifts: number;
  achievementAwards: number;
  thirteenthMonthPay: number;
  christmasBonus: number;
  otherAllowanceAmount: number;
  allowanceFrequencies: Record<string, string>;
  deductAllowanceOnAbsence: boolean;
  customPremiums: EmployeeCustomPayrollItem[];
  customAllowances: EmployeeCustomPayrollItem[];
  customDeductions: EmployeeCustomPayrollItem[];
  loans?: SavedEmployeeRecord["loans"];
};

type SavedPayrollRecord = {
  id: string;
  month: string;
  year: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  employmentStatus: string;
  employmentClassification?: string;
  employeeType?: string;
  payrollRunType?: "A" | "B";
  grossPay: number;
  adjustedGrossCompensation?: number;
  totalDeductions: number;
  withholdingTax: number;
  employerContributions: number;
  netPay: number;
  basicPay: number;
  totalPayrollPremium: number;
  totalAllowances: number;
  totalAbsences: number;
  allowanceProrationDeduction?: number;
  taxableIncome: number;
  monthYear?: string;
  payrollFrequency?: string;
  payrollPeriod?: string;
  payrollDate?: string;
  bulkRunId?: string;
  cutoffIdentity?: PayrollCutoffIdentity;
  runCutoff?: PayrollCutoffIdentity;
  workPeriodCutoff?: PayrollCutoffIdentity;
  lateEndorsed?: boolean;
  lateEndorsementReason?: string;
  baseSalarySource?: "salaryHistory";
  salaryHistoryEffectiveDate?: string;
  oneTimeCredits?: PayrollPipelineResult["oneTimeCreditLines"];
  oneTimeDeductions?: PayrollPipelineResult["oneTimeDeductionLines"];
  loanDeductions?: LoanDeductionLine[];
  standingAllowanceLines?: StandingAllowanceLine[];
  deMinimisLines?: DeMinimisLine[];
  importedAttendance?: PayrollAttendanceRow;
  importedAllowancesLoans?: PayrollAllowanceLoanItem[];
  specialItems?: SpecialItem[];
  globalRuleNotes?: SpecialItem[];
  computationPending?: boolean;
  computationColumns?: Record<string, number | string | boolean>;
  nightDiffHours?: number;
  overtimeHours?: number;
  restDayHours?: number;
  specialHolidayHours?: number;
  absencesHours?: number;
  riceSubsidy?: number;
  uniformClothing?: number;
  laundryAllowance?: number;
  medicalCashDependents?: number;
  actualMedicalAssistance?: number;
  achievementAwards?: number;
  christmasAnniversaryGifts?: number;
  mealAllowanceOTNight?: number;
  monetizedLeavePrivate?: number;
  cbaProductivityIncentives?: number;
  thirteenthMonthPay?: number;
  christmasBonus?: number;
  otherTaxableAllowances?: number;
  customPremiums?: { id: string; name: string; amount: number }[];
  customAllowances?: { id: string; name: string; amount: number }[];
  customDeductions?: { id: string; name: string; amount: number }[];
  customDeductionsTotal?: number;
  nightDifferentialAmount?: number;
  overtimeAmount?: number;
  restDayAmount?: number;
  specialHolidayAmount?: number;
  nonTaxableDMB?: number;
  excessDMBTo90k?: number;
  taxableDMBAfter90k?: number;
  sssMonthlySalaryCredit?: number;
  sssRegularEe?: number;
  sssRegularEr?: number;
  sssWispEe?: number;
  sssWispEr?: number;
  sssEc?: number;
  sssEe?: number;
  sssEr?: number;
  philhealthEe?: number;
  philhealthEr?: number;
  pagibigEe?: number;
  pagibigEr?: number;
  totalGovtEmployeeContrib?: number;
  totalGovtEmployerContrib?: number;
  totalGovtContrib?: number;
  employeeAdvances?: number;
  cashAdvances?: number;
  sssLoanRepayment?: number;
  hdmfLoanRepayment?: number;
  taxAnnualizationAdjustment?: number;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment";
  taxAnnualizationYear?: string;
  taxAnnualizationSource?: string;
  remarks?: string;
  createdAt?: string;
  archiveStatus?: "Active" | "Archived";
};

type ReadonlyPayrollRunView = {
  id: string;
  title: string;
  payrollDate?: string;
  createdAt?: string;
  records: SavedPayrollRecord[];
};

type PayrollAdjustmentRecord = {
  id?: string | number;
  sourceId?: string | number;
  payrollReference?: string;
  adjustmentCategory?: string;
  source?: string;
  amount?: string | number;
  employeeId?: string | number;
  employeeNo?: string | number;
};


type BulkCustomColumnCategory = "premium" | "allowance" | "deduction";

type BulkCustomColumn = {
  id: string;
  name: string;
  category: BulkCustomColumnCategory;
};

type StandardAllowanceField =
  | "riceSubsidy"
  | "uniformClothing"
  | "laundryAllowance"
  | "medicalCashDependents"
  | "actualMedicalAssistance"
  | "achievementAwards"
  | "christmasAnniversaryGifts"
  | "mealAllowanceOTNight"
  | "monetizedLeavePrivate"
  | "cbaProductivityIncentives"
  | "thirteenthMonthPay"
  | "christmasBonus"
  | "otherTaxableAllowances";

type BulkPayrollRow = {
  id: string;
  employeeNo: string;
  monthYear: string;
  payrollDate: string;
  payrollPeriod: string;
  nightDiffHours: string;
  overtimeHours: string;
  restDayHours: string;
  specialHolidayHours: string;
  absencesHours: string;
  riceSubsidy: string;
  uniformClothing: string;
  laundryAllowance: string;
  medicalCashDependents: string;
  actualMedicalAssistance: string;
  achievementAwards: string;
  christmasAnniversaryGifts: string;
  mealAllowanceOTNight: string;
  monetizedLeavePrivate: string;
  cbaProductivityIncentives: string;
  thirteenthMonthPay: string;
  christmasBonus: string;
  otherTaxableAllowances: string;
  sssMonthlySalaryCredit: string;
  sssRegularEe: string;
  sssRegularEr: string;
  sssWispEe: string;
  sssWispEr: string;
  sssEc: string;
  sssEe: string;
  sssEr: string;
  philhealthEe: string;
  philhealthEr: string;
  pagibigEe: string;
  pagibigEr: string;
  employeeAdvances: string;
  cashAdvances: string;
  sssLoanRepayment: string;
  hdmfLoanRepayment: string;
  taxAnnualizationAdjustment: string;
  taxAnnualizationType: "Refund" | "Additional Deduction" | "No Adjustment";
  taxAnnualizationYear: string;
  taxAnnualizationSource: string;
  remarks: string;
  customPremiumValues: Record<string, string>;
  customAllowanceValues: Record<string, string>;
  customDeductionValues: Record<string, string>;
};

type Scope = "single" | "all" | "department" | "classification" | "employeeType" | "mwe";
type PayrollDrawerCategory = "premium" | "allowance" | "govt" | "other";
type ImportProgressKind = "special-items" | "payroll-computation" | "csv" | "load-employees";
type ImportProgress = { kind: ImportProgressKind; label: string } | null;

type Calculation = {
  basicPay: number;
  nightDifferentialAmount: number;
  overtimeAmount: number;
  restDayAmount: number;
  specialHolidayAmount: number;
  totalPayrollPremium: number;
  totalAllowances: number;
  totalAbsences: number;
  allowanceProrationDeduction: number;
  grossPay: number;
  nonTaxableDMB: number;
  excessDMBTo90k: number;
  taxableDMBAfter90k: number;
  taxableIncome: number;
  withholdingTax: number;
  totalGovtEmployeeContrib: number;
  totalGovtEmployerContrib: number;
  totalDeductions: number;
  netPay: number;
  customDeductionsTotal: number;
};

type PayrollCalculationInputs = {
  standingAllowanceLines?: StandingAllowanceLine[];
  deMinimisLines?: DeMinimisLine[];
  loanDeductions?: LoanDeductionLine[];
  oneTimeCredits?: PayrollPipelineResult["oneTimeCreditLines"];
  oneTimeDeductions?: PayrollPipelineResult["oneTimeDeductionLines"];
  importedAttendance?: PayrollAttendanceRow;
};

// Pipeline outputs and totals reconstructed from a saved payroll record so the read-only view can
// display the loans, standing allowances, special items and imported attendance that were applied
// when the run was saved (the live pipeline inputs are not loaded in view mode).
type ReadonlySavedRow = {
  calculation: Calculation;
  standingAllowanceLines: StandingAllowanceLine[];
  loanDeductions: LoanDeductionLine[];
  oneTimeCredits: PayrollPipelineResult["oneTimeCreditLines"];
  oneTimeDeductions: PayrollPipelineResult["oneTimeDeductionLines"];
  importedAttendance?: PayrollAttendanceRow;
  specialItems: SpecialItem[];
  adjustedBase: number;
  employerContributions: number;
};

type ProrationInfo = {
  isActive: boolean;
  hoursAbsent: number;
  totalMonthlyHours: number;
  rate: number;
};

const ROWS_PER_PAGE = 50; // Always render only 50 payroll rows per page for large companies.
const APPLIED_MONETIZED_LEAVE_ADJUSTMENTS_KEY = "appliedMonetizedLeaveAdjustmentIds";
const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0a4f8f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] transition hover:-translate-y-0.5 hover:bg-[#073c6d] focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:shadow-none";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-[0_14px_28px_-24px_rgba(190,18,60,0.7)] transition hover:-translate-y-0.5 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-100 disabled:cursor-not-allowed disabled:opacity-50";
const subtlePanelClassName =
  "relative overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)] ring-1 ring-slate-900/[0.04] backdrop-blur";
const fieldGroupClassName = "grid gap-2";
const cyanPrimaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50";

const STANDARD_ALLOWANCE_FIELDS: { field: StandardAllowanceField; label: string }[] = [
  { field: "riceSubsidy", label: "Rice Subsidy" },
  { field: "uniformClothing", label: "Uniform / Clothing" },
  { field: "laundryAllowance", label: "Laundry" },
  { field: "medicalCashDependents", label: "Medical Dependents" },
  { field: "actualMedicalAssistance", label: "Actual Medical" },
  { field: "achievementAwards", label: "Awards" },
  { field: "christmasAnniversaryGifts", label: "Christmas / Anniversary Gifts" },
  { field: "mealAllowanceOTNight", label: "Meal OT/Night" },
  { field: "monetizedLeavePrivate", label: "Monetized Leave" },
  { field: "cbaProductivityIncentives", label: "CBA / Productivity" },
  { field: "thirteenthMonthPay", label: "13th Month Pay" },
  { field: "christmasBonus", label: "Christmas Bonus" },
  { field: "otherTaxableAllowances", label: "Other Taxable" },
];

function normalizeEmployeeCustomPayrollItems(items: unknown): EmployeeCustomPayrollItem[] {
  if (!Array.isArray(items)) return [];

  const normalizedItems: EmployeeCustomPayrollItem[] = [];

  items.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const source = item as {
      id?: unknown;
      name?: unknown;
      label?: unknown;
      amount?: unknown;
      frequency?: unknown;
    };

    const name = String(source.name || source.label || "").trim();
    if (!name) return;

    const parsedAmount = Number(String(source.amount ?? "0").replace(/,/g, ""));

    normalizedItems.push({
      id: typeof source.id === "string" ? source.id : undefined,
      name,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      frequency: normalizeAllowanceFrequency(source.frequency),
    });
  });

  return normalizedItems;
}

function readNumber(value: string | number | undefined | null) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumberInput(value: string) {
  return readNumber(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function computeSssContributionFromMonthlyPay(monthlyPay: number) {
  const compensation = Math.max(Number(monthlyPay) || 0, 0);
  let monthlySalaryCredit = 5000;

  if (compensation >= 34750) {
    monthlySalaryCredit = 35000;
  } else if (compensation >= 5250) {
    monthlySalaryCredit = Math.round(compensation / 500) * 500;
  }

  const regularMsc = Math.min(monthlySalaryCredit, 20000);
  const wispMsc = Math.max(monthlySalaryCredit - 20000, 0);
  const sssRegularEe = regularMsc * 0.05;
  const sssRegularEr = regularMsc * 0.1;
  const sssWispEe = wispMsc * 0.05;
  const sssWispEr = wispMsc * 0.1;
  const sssEc = monthlySalaryCredit >= 15000 ? 30 : 10;

  return {
    monthlySalaryCredit,
    sssRegularEe,
    sssRegularEr,
    sssWispEe,
    sssWispEr,
    sssEc,
    sssEe: sssRegularEe + sssWispEe,
    sssEr: sssRegularEr + sssWispEr + sssEc,
  };
}

function computePagibigContributionFromMonthlyPay() {
  return {
    pagibigEe: 200,
    pagibigEr: 200,
  };
}

function computeWithholdingTaxByFrequency(taxableIncome: number, payrollFrequency: string) {
  const taxablePay = Math.max(Number(taxableIncome) || 0, 0);
  const normalizedFrequency = payrollFrequency.toLowerCase();

  if (normalizedFrequency.includes("weekly")) {
    if (taxablePay <= 4808) return 0;
    if (taxablePay <= 7691) return (taxablePay - 4808) * 0.15;
    if (taxablePay <= 15384) return 432.6 + (taxablePay - 7692) * 0.2;
    if (taxablePay <= 38461) return 1971.2 + (taxablePay - 15385) * 0.25;
    if (taxablePay <= 153845) return 7740.45 + (taxablePay - 38462) * 0.3;
    return 42355.65 + (taxablePay - 153846) * 0.35;
  }

  if (normalizedFrequency.includes("semi")) {
    if (taxablePay <= 10417) return 0;
    if (taxablePay <= 16666) return (taxablePay - 10417) * 0.15;
    if (taxablePay <= 33332) return 937.5 + (taxablePay - 16667) * 0.2;
    if (taxablePay <= 83332) return 4270.7 + (taxablePay - 33333) * 0.25;
    if (taxablePay <= 333332) return 16770.7 + (taxablePay - 83333) * 0.3;
    return 91770.7 + (taxablePay - 333333) * 0.35;
  }

  if (taxablePay <= 20833) return 0;
  if (taxablePay <= 33332) return (taxablePay - 20833) * 0.15;
  if (taxablePay <= 66666) return 1875 + (taxablePay - 33333) * 0.2;
  if (taxablePay <= 166666) return 8541.8 + (taxablePay - 66667) * 0.25;
  if (taxablePay <= 666666) return 33541.8 + (taxablePay - 166667) * 0.3;
  return 183541.8 + (taxablePay - 666667) * 0.35;
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  result.push(current);
  return result;
}

function normalizeHeader(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function customColumnId(category: BulkCustomColumnCategory, name: string) {
  return `custom-${category}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

type AllowanceFrequency = "Monthly" | "Annual" | "Hourly";

function normalizeAllowanceFrequency(value: unknown): AllowanceFrequency {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "annual" || normalized === "yearly") return "Annual";
  if (normalized === "hourly" || normalized === "perhour" || normalized === "perhr" || normalized === "hour") return "Hourly";
  return "Monthly";
}

function getPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMonthlyWorkingHours(employee: EmployeeRecord) {
  const savedHours = getPositiveNumber(employee.standardHoursPerDay, 0);
  const savedDays = getPositiveNumber(employee.workingDaysPerMonth, 0);
  if (savedHours > 0 && savedDays > 0) return savedHours * savedDays;

  const monthlyBasicPay = Number(employee.basicPay) || 0;
  const hourlyRate = Number(employee.hourlyRate) || 0;
  if (monthlyBasicPay > 0 && hourlyRate > 0) return monthlyBasicPay / hourlyRate;
  return 8 * 26;
}

function getEmployeeHourlyRate(employee: EmployeeRecord) {
  const monthlyWorkingHours = getMonthlyWorkingHours(employee);
  const monthlyBasicPay = Number(employee.basicPay) || 0;
  if (monthlyWorkingHours <= 0) return Number(employee.hourlyRate) || 0;
  return monthlyBasicPay / monthlyWorkingHours;
}

// Lost hours used for proration = absence hours (manual entry, or derived from imported days absent)
// plus imported late and undertime minutes. Imported attendance is the source of truth when present.
function getAbsenceHours(employee: EmployeeRecord | null, row: BulkPayrollRow, importedAttendance?: PayrollAttendanceRow): number {
  const standardHoursPerDay = getPositiveNumber(employee?.standardHoursPerDay, 8);
  const manualAbsenceHours = Math.max(0, readNumber(row.absencesHours));
  const importedAbsenceHours = (Number(importedAttendance?.daysAbsent) || 0) * standardHoursPerDay;
  // Prefer the manually-entered value when present; otherwise fall back to the imported days absent.
  const absenceHours = manualAbsenceHours > 0 ? manualAbsenceHours : importedAbsenceHours;
  const lateUndertimeHours = ((Number(importedAttendance?.lateMins) || 0) + (Number(importedAttendance?.undertimeMins) || 0)) / 60;
  return Math.max(0, absenceHours + lateUndertimeHours);
}

function getProrationInfo(employee: EmployeeRecord | null, row: BulkPayrollRow, importedAttendance?: PayrollAttendanceRow): ProrationInfo {
  if (!employee) {
    return { isActive: false, hoursAbsent: 0, totalMonthlyHours: 0, rate: 1 };
  }

  const totalMonthlyHours = getMonthlyWorkingHours(employee);
  const hoursAbsent = getAbsenceHours(employee, row, importedAttendance);
  if (totalMonthlyHours <= 0 || hoursAbsent <= 0) {
    return { isActive: false, hoursAbsent, totalMonthlyHours, rate: 1 };
  }

  const cappedAbsentHours = Math.min(hoursAbsent, totalMonthlyHours);
  const rate = Math.max(0, (totalMonthlyHours - cappedAbsentHours) / totalMonthlyHours);
  return { isActive: true, hoursAbsent: cappedAbsentHours, totalMonthlyHours, rate };
}

function proratePayrollPeriodAmount(amount: number, proration: ProrationInfo) {
  return proration.isActive ? amount * proration.rate : amount;
}

function getBasicPayPerPayrollPeriod(employee: EmployeeRecord, factor: number) {
  return (Number(employee.basicPay) || 0) / factor;
}

function getCustomAllowancePerPayrollPeriod(item: EmployeeCustomPayrollItem, employee: EmployeeRecord, factor: number) {
  const amount = readNumber(item.amount);
  const frequency = normalizeAllowanceFrequency(item.frequency);

  return getAllowancePerPayrollPeriod(amount, frequency, employee, factor);
}

function getAllowancePerPayrollPeriod(amount: number, frequency: AllowanceFrequency, employee: EmployeeRecord, factor: number) {
  if (frequency === "Annual") {
    return amount / 12 / factor;
  }

  if (frequency === "Hourly") {
    return (amount * getMonthlyWorkingHours(employee)) / factor;
  }

  return amount / factor;
}

function mergeCustomColumns(currentColumns: BulkCustomColumn[], employeesToLoad: EmployeeRecord[]) {
  const columnMap = new Map(currentColumns.map((column) => [column.id, column]));

  employeesToLoad.forEach((employee) => {
    [
      { category: "premium" as const, items: employee.customPremiums || [] },
      { category: "allowance" as const, items: employee.customAllowances || [] },
      { category: "deduction" as const, items: employee.customDeductions || [] },
    ].forEach(({ category, items }) => {
      items.forEach((item) => {
        const id = customColumnId(category, item.name);
        if (!columnMap.has(id)) {
          columnMap.set(id, {
            id,
            name: item.name,
            category,
          });
        }
      });
    });
  });

  return Array.from(columnMap.values());
}

function parseCustomCsvHeader(header: string, index: number) {
  const raw = String(header || "").trim();
  const upper = raw.toUpperCase();
  const prefixes: Record<BulkCustomColumnCategory, string> = {
    premium: "PREMIUM:",
    allowance: "ALLOWANCE:",
    deduction: "DEDUCTION:",
  };

  let category = (Object.keys(prefixes) as BulkCustomColumnCategory[]).find((key) => upper.startsWith(prefixes[key])) || null;
  let name = category ? raw.slice(prefixes[category].length).trim().replace(/\s+/g, " ") : "";

  if (!category) {
    const modernHeader = raw.match(/^(earning|allowance|deduction)_(.+)$/i);
    if (modernHeader) {
      category = modernHeader[1].toLowerCase() === "earning" ? "premium" : modernHeader[1].toLowerCase() as BulkCustomColumnCategory;
      name = modernHeader[2].replace(/_override$/i, "").trim().replace(/\s+/g, " ");
    }
  }

  if (!category) {
    const loanDeductionHeader = raw.match(/^loan_(.+)_deduction$/i);
    if (loanDeductionHeader) {
      category = "deduction";
      name = loanDeductionHeader[1].trim().replace(/\s+/g, " ");
    }
  }

  if (!category) return null;
  if (!name) return null;

  return {
    index,
    id: customColumnId(category, name),
    name,
    category,
  };
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function resolveCoverageRule(rule: string, monthYear: string): string {
  const [yearText, monthText] = monthYear.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const normalized = String(rule || "").trim().toLowerCase();
  const dayMatch = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?/);

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !dayMatch) return "";

  let targetYear = year;
  let targetMonthIndex = monthIndex;
  if (normalized.includes("prior month") || normalized.includes("previous month")) {
    targetMonthIndex -= 1;
    if (targetMonthIndex < 0) {
      targetMonthIndex = 11;
      targetYear -= 1;
    }
  } else if (normalized.includes("next month")) {
    targetMonthIndex += 1;
    if (targetMonthIndex > 11) {
      targetMonthIndex = 0;
      targetYear += 1;
    }
  }

  const day = Math.min(Number(dayMatch[1]), lastDayOfMonth(targetYear, targetMonthIndex));
  return toLocalIsoDate(new Date(targetYear, targetMonthIndex, day));
}

function resolveCutoffIdentity(
  definition: CutoffDefinition | undefined,
  monthYear: string,
  payrollDate: string
): PayrollCutoffIdentity {
  const fallback = definition || SEED_CUTOFF_DEFINITIONS[0];
  const coverageStartDate = monthYear ? resolveCoverageRule(fallback.coverageStartRule, monthYear) : "";
  const coverageEndDate = monthYear ? resolveCoverageRule(fallback.coverageEndRule, monthYear) : "";

  return {
    monthYear,
    cutoff: fallback.id,
    cutoffId: fallback.id,
    cutoffLabel: fallback.label,
    coverageStartDate,
    coverageEndDate,
    payDate: payrollDate || coverageEndDate,
    payrollDate: payrollDate || coverageEndDate,
  };
}

function getSalaryHistoryEffectiveDate(employee: EmployeeRecord, cutoff: PayrollCutoffIdentity) {
  const payDate = cutoff.payDate || cutoff.payrollDate || cutoff.coverageEndDate || "";
  return normalizeSalaryHistory(employee)
    .filter((entry) => entry.effectiveDate <= payDate)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]?.effectiveDate;
}

function buildBlankRow(overrides: Partial<BulkPayrollRow> = {}): BulkPayrollRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    employeeNo: "",
    monthYear: "",
    payrollDate: "",
    payrollPeriod: "",
    nightDiffHours: "0",
    overtimeHours: "0",
    restDayHours: "0",
    specialHolidayHours: "0",
    absencesHours: "0",
    riceSubsidy: "0",
    uniformClothing: "0",
    laundryAllowance: "0",
    medicalCashDependents: "0",
    actualMedicalAssistance: "0",
    achievementAwards: "0",
    christmasAnniversaryGifts: "0",
    mealAllowanceOTNight: "0",
    monetizedLeavePrivate: "0",
    cbaProductivityIncentives: "0",
    thirteenthMonthPay: "0",
    christmasBonus: "0",
    otherTaxableAllowances: "0",
    sssMonthlySalaryCredit: "0",
    sssRegularEe: "0",
    sssRegularEr: "0",
    sssWispEe: "0",
    sssWispEr: "0",
    sssEc: "0",
    sssEe: "0",
    sssEr: "0",
    philhealthEe: "0",
    philhealthEr: "0",
    pagibigEe: "0",
    pagibigEr: "0",
    employeeAdvances: "0",
    cashAdvances: "0",
    sssLoanRepayment: "0",
    hdmfLoanRepayment: "0",
    taxAnnualizationAdjustment: "0",
    taxAnnualizationType: "No Adjustment",
    taxAnnualizationYear: "",
    taxAnnualizationSource: "",
    remarks: "",
    customPremiumValues: {},
    customAllowanceValues: {},
    customDeductionValues: {},
    ...overrides,
  };
}

function compactHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function countActiveValues(values: Array<string | number | undefined | null>) {
  return values.filter((value) => readNumber(value) !== 0).length;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{children}</span>;
}

function RequiredAsterisk() {
  return <span className="ml-1 text-rose-500">*</span>;
}

function InputField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[inputClassName, className].filter(Boolean).join(" ")} />;
}

function SelectField({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[selectClassName, className].filter(Boolean).join(" ")} />;
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <InputField
      type="text"
      inputMode="decimal"
      value={isFocused ? value || "" : formatNumberInput(value || "0")}
      onFocus={(event) => {
        setIsFocused(true);
        event.currentTarget.select();
      }}
      onBlur={() => setIsFocused(false)}
      onChange={(event) => onChange(event.target.value.replace(/,/g, ""))}
      className="text-right tabular-nums"
    />
  );
}

function Section({ title, children, icon, iconClassName }: { title: string; children: ReactNode; icon?: ReactNode; iconClassName?: string }) {
  return (
    <section className={`${subtlePanelClassName} p-5 sm:p-6`} style={{ borderLeft: "3px solid #22D3EE" }}>
      <div className="mb-5 flex items-center gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${iconClassName ?? "border border-sky-100 bg-sky-50 text-[#0a4f8f]"}`}>
          {icon || <ClipboardList className="h-4 w-4" aria-hidden="true" />}
        </span>
        <h2 className="m-0 text-lg font-bold text-slate-950 sm:text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}


function buildEmployeeDisplayLabel(employee: EmployeeRecord) {
  return [
    employee.name,
    employee.employeeNo,
    employee.department,
    employee.employmentClassification,
    employee.employeeType,
    `MWE: ${employee.isMinimumWageEarner}`,
  ]
    .filter(Boolean)
    .join(" • ");
}

function ScopeBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-[#0a4f8f]">
      Scope prompt on edit
    </span>
  );
}

function StatusBadge({ tone = "slate", children }: { tone?: "slate" | "emerald" | "amber" | "sky" | "rose"; children: ReactNode }) {
  const toneClassName = {
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-[#0a4f8f]",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClassName}`}>{children}</span>
  );
}

function ValidationErrorList({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-rose-700">{errors.length} validation error{errors.length !== 1 ? "s" : ""}</div>
      <div className="mt-2 max-h-40 overflow-auto">
        {errors.map((error, index) => (
          <div key={`${error.sheet}-${error.row}-${error.field}-${index}`} className="text-xs font-semibold leading-5 text-rose-900">
            {error.sheet} row {error.row}, {error.field}: {error.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function PayrollSummaryCell({
  title,
  amount,
  icon,
  activeCount,
  importedLines = [],
  customCount = 0,
  review = false,
  onClick,
}: {
  title: string;
  amount: number;
  icon: ReactNode;
  activeCount: number;
  importedLines?: string[];
  customCount?: number;
  review?: boolean;
  onClick: () => void;
}) {
  const isEmpty = amount === 0 && activeCount === 0 && !review;
  const metaParts: string[] = [];
  if (review) metaParts.push("Review");
  else if (activeCount > 0) metaParts.push(`${activeCount} active`);
  if (customCount > 0) metaParts.push(`${customCount} custom`);

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-sky-100"
    >
      <span className="inline-flex shrink-0 items-center justify-center text-slate-400 transition group-hover:text-blue-500 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-semibold tabular-nums ${isEmpty ? "text-gray-400" : "text-gray-900"}`}>
          {formatCurrency(amount)}
        </span>
        {importedLines.length > 0 ? (
          <span className="mt-1 grid max-h-28 gap-0.5 overflow-y-auto pr-1">
            {importedLines.map((line, index) => (
              <span key={`${line}-${index}`} className="block whitespace-normal break-words text-xs font-semibold text-slate-500">{line}</span>
            ))}
          </span>
        ) : metaParts.length > 0 ? (
          <span className="block truncate text-xs text-gray-400">{metaParts.join(" · ")}</span>
        ) : isEmpty ? (
          <span className="block text-xs text-gray-300">—</span>
        ) : null}
      </span>
      <ChevronRight className="h-3 w-3 shrink-0 text-gray-300 transition group-hover:text-blue-400" aria-hidden="true" />
    </button>
  );
}

function ImportedMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-xs font-bold text-slate-700">{value}</div>
    </div>
  );
}

function normalizeEmployeeId(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function AmountInputRow({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-700">{label}</span>
        {children ? <span className="mt-1 flex flex-wrap gap-1.5">{children}</span> : null}
      </span>
      <MoneyInput value={value} onChange={onChange} />
    </label>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function EmptySourceRow({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-400">
      {label}
    </div>
  );
}

function ReadOnlyValueRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-700">{label}</span>
        {children ? <span className="mt-1 flex flex-wrap gap-1.5">{children}</span> : null}
      </span>
      <span className="text-sm font-black tabular-nums text-slate-950">{value}</span>
    </div>
  );
}

function ReadOnlyMoneyRow({
  label,
  amount,
  children,
}: {
  label: string;
  amount: number;
  children?: ReactNode;
}) {
  return <ReadOnlyValueRow label={label} value={formatCurrency(amount)}>{children}</ReadOnlyValueRow>;
}

function AllowanceProrationMeta({
  originalAmount,
  proratedAmount,
  proration,
}: {
  originalAmount: number;
  proratedAmount: number;
  proration: ProrationInfo;
}) {
  if (!proration.isActive) return null;
  const deduction = originalAmount - proratedAmount;
  return (
    <div className="mt-1 flex flex-wrap justify-end gap-x-3 gap-y-1 px-3 text-[11px] font-bold tabular-nums">
      <span className="text-slate-400">Full {formatCurrency(originalAmount)}</span>
      <span className="text-amber-700">Prorated {formatCurrency(proratedAmount)}</span>
      {deduction > 0.001 ? <span className="text-rose-500">-{formatCurrency(deduction)}</span> : null}
    </div>
  );
}

function AllowanceInputRow({
  label,
  value,
  proration,
  onChange,
  children,
}: {
  label: string;
  value: string;
  proration: ProrationInfo;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  const originalAmount = readNumber(value);
  const proratedAmount = proratePayrollPeriodAmount(originalAmount, proration);

  return (
    <div>
      <AmountInputRow label={label} value={value} onChange={onChange}>{children}</AmountInputRow>
      <AllowanceProrationMeta originalAmount={originalAmount} proratedAmount={proratedAmount} proration={proration} />
    </div>
  );
}

function PayrollDetailDrawer({
  category,
  row,
  employee,
  calculated,
  premiumColumns,
  allowanceColumns,
  deductionColumns,
  importedAttendance,
  standingAllowanceLines,
  loanDeductions,
  oneTimeCredits,
  oneTimeDeductions,
  onClose,
  onChange,
  onCustomChange,
  onRemoveCustomColumn,
}: {
  category: PayrollDrawerCategory;
  row: BulkPayrollRow;
  employee: EmployeeRecord | null;
  calculated: Calculation;
  premiumColumns: BulkCustomColumn[];
  allowanceColumns: BulkCustomColumn[];
  deductionColumns: BulkCustomColumn[];
  importedAttendance?: PayrollAttendanceRow;
  standingAllowanceLines: StandingAllowanceLine[];
  loanDeductions: LoanDeductionLine[];
  oneTimeCredits: PayrollPipelineResult["oneTimeCreditLines"];
  oneTimeDeductions: PayrollPipelineResult["oneTimeDeductionLines"];
  onClose: () => void;
  onChange: (field: keyof BulkPayrollRow, value: string) => void;
  onCustomChange: (category: BulkCustomColumnCategory, columnId: string, value: string) => void;
  onRemoveCustomColumn: (category: BulkCustomColumnCategory, columnId: string) => void;
}) {
  const standardHoursPerDay = getPositiveNumber(employee?.standardHoursPerDay, 8);
  const importedAbsenceHours = (Number(importedAttendance?.daysAbsent) || 0) * standardHoursPerDay;
  const premiumHours = importedAttendance?.premiumHours || {};
  const sumPremiumBuckets = (predicate: (bucket: string) => boolean) =>
    Object.entries(premiumHours).reduce((sum, [bucket, hours]) => sum + (predicate(bucket) ? Number(hours) || 0 : 0), 0);
  const nightDiffHours = sumPremiumBuckets((bucket) => bucket.includes("-ND") || bucket === "Ord-ND");
  const overtimeHours = sumPremiumBuckets((bucket) => bucket.includes("-OT") || bucket.endsWith("OT"));
  const restDayHours = sumPremiumBuckets((bucket) => bucket.includes("RD"));
  const specialHolidayHours = sumPremiumBuckets((bucket) => bucket.startsWith("SH"));
  const importedPremiumLines = Object.entries(premiumHours).filter(([, hours]) => Number(hours) > 0);
  const standingAllowanceTotal = standingAllowanceLines.reduce((sum, line) => sum + line.amount, 0);
  const loanDeductionTotal = loanDeductions.reduce((sum, line) => sum + line.amount, 0);
  const oneTimeCreditTotal = oneTimeCredits.reduce((sum, item) => sum + item.amount, 0);
  const oneTimeDeductionTotal = oneTimeDeductions.reduce((sum, item) => sum + item.amount, 0);
  const taxAnnualizationAmount = readNumber(row.taxAnnualizationAdjustment);
  const taxAdjustmentSigned = row.taxAnnualizationType === "Refund" ? -taxAnnualizationAmount : row.taxAnnualizationType === "Additional Deduction" ? taxAnnualizationAmount : 0;
  const otherTaxTotal =
    readNumber(row.employeeAdvances) +
    readNumber(row.cashAdvances) +
    readNumber(row.sssLoanRepayment) +
    readNumber(row.hdmfLoanRepayment) +
    loanDeductionTotal +
    oneTimeDeductionTotal -
    oneTimeCreditTotal +
    calculated.customDeductionsTotal +
    calculated.withholdingTax +
    taxAdjustmentSigned;
  const meta = {
    premium: { title: "Premiums", icon: <Clock className="h-4 w-4" aria-hidden="true" />, total: calculated.totalPayrollPremium },
    allowance: { title: "Allowances", icon: <Gift className="h-4 w-4" aria-hidden="true" />, total: standingAllowanceTotal },
    govt: { title: "Gov't", icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />, total: calculated.totalGovtEmployeeContrib + calculated.totalGovtEmployerContrib },
    other: { title: "Other / Tax", icon: <ReceiptText className="h-4 w-4" aria-hidden="true" />, total: otherTaxTotal },
  }[category];
  const employeeLabel = employee ? `${employee.employeeNo} · ${employee.name}` : "No employee selected";
  const rawProration = getProrationInfo(employee, row, importedAttendance);
  const proration = (employee?.payrollRunType === "B" || employee?.deductAllowanceOnAbsence) ? rawProration : { isActive: false, hoursAbsent: 0, totalMonthlyHours: 0, rate: 1 };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close drawer" onClick={onClose} className="absolute inset-0 cursor-default" />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-[#0a4f8f]">{meta.icon}</span>
              <h3 className="text-lg font-bold text-slate-950">{meta.title}</h3>
            </div>
            <p className="mt-1 truncate text-sm font-medium text-slate-500">{employeeLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#0a4f8f]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid flex-1 content-start gap-5 overflow-y-auto bg-slate-50/70 px-5 py-5">
          {category === "premium" ? (
            <>
              <DetailSection title="Premiums">
                <ReadOnlyValueRow label="Night diff hrs" value={`${compactHours(nightDiffHours)} hrs`} />
                <ReadOnlyValueRow label="OT hrs" value={`${compactHours(overtimeHours)} hrs`} />
                <ReadOnlyValueRow label="Rest day hrs" value={`${compactHours(restDayHours)} hrs`} />
                <ReadOnlyValueRow label="Special holiday hrs" value={`${compactHours(specialHolidayHours)} hrs`} />
              </DetailSection>
              <DetailSection title="Imported Premium Buckets">
                {importedPremiumLines.length === 0 ? (
                  <EmptySourceRow label="No premium-hour buckets imported for this employee" />
                ) : (
                  importedPremiumLines.map(([bucket, hours]) => (
                    <ReadOnlyValueRow key={bucket} label={bucket} value={`${compactHours(Number(hours) || 0)} hrs`} />
                  ))
                )}
              </DetailSection>
              <DetailSection title="Absences">
                <ReadOnlyValueRow label="Absences hrs" value={`${compactHours(importedAbsenceHours)} hrs`}>
                  <StatusBadge tone={importedAbsenceHours > 0 ? "amber" : "emerald"}>
                    {importedAttendance ? `${Number(importedAttendance.daysAbsent) || 0} day${Number(importedAttendance.daysAbsent) === 1 ? "" : "s"} x ${standardHoursPerDay} hrs` : "No attendance import"}
                  </StatusBadge>
                </ReadOnlyValueRow>
              </DetailSection>
            </>
          ) : null}

          {category === "allowance" ? (
            <>
              {proration.isActive ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                  ⚠ Prorated: {compactHours(proration.hoursAbsent)} hrs absent out of {compactHours(proration.totalMonthlyHours)} hrs ({(proration.rate * 100).toFixed(1)}%)
                </div>
              ) : null}
              <DetailSection title="Standing Allowances">
                {standingAllowanceLines.length === 0 ? (
                  <EmptySourceRow label="No standing allowances for this cutoff" />
                ) : (
                  standingAllowanceLines.map((line) => (
                    <ReadOnlyMoneyRow key={line.allowanceId} label={line.name} amount={line.amount}>
                      <StatusBadge tone={line.taxable ? "rose" : "emerald"}>{line.taxable ? "Taxable" : "Non-taxable"}</StatusBadge>
                      <StatusBadge tone={line.applyBeforeTax ? "amber" : "sky"}>{line.applyBeforeTax ? "Before tax" : "After tax"}</StatusBadge>
                      <StatusBadge>{line.frequency}</StatusBadge>
                    </ReadOnlyMoneyRow>
                  ))
                )}
              </DetailSection>
            </>
          ) : null}

          {category === "govt" ? (
            <DetailSection title="Contributions">
              <AmountInputRow label="SSS EE" value={row.sssEe} onChange={(value) => onChange("sssEe", value)} />
              <AmountInputRow label="SSS ER" value={row.sssEr} onChange={(value) => onChange("sssEr", value)} />
              <AmountInputRow label="PhilHealth EE" value={row.philhealthEe} onChange={(value) => onChange("philhealthEe", value)} />
              <AmountInputRow label="PhilHealth ER" value={row.philhealthEr} onChange={(value) => onChange("philhealthEr", value)} />
              <AmountInputRow label="Pag-IBIG EE" value={row.pagibigEe} onChange={(value) => onChange("pagibigEe", value)} />
              <AmountInputRow label="Pag-IBIG ER" value={row.pagibigEr} onChange={(value) => onChange("pagibigEr", value)} />
            </DetailSection>
          ) : null}

          {category === "other" ? (
            <>
              <DetailSection title="Loan Monitoring Deductions">
                {loanDeductions.length === 0 ? (
                  <EmptySourceRow label="No active loans for this cutoff" />
                ) : (
                  loanDeductions.map((line) => (
                    <ReadOnlyMoneyRow key={line.loanId} label={line.loanName} amount={line.amount}>
                      <StatusBadge tone="amber">Remaining after: {formatCurrency(line.remainingBalanceAfterDeduction)}</StatusBadge>
                      <StatusBadge>{line.loanType}</StatusBadge>
                    </ReadOnlyMoneyRow>
                  ))
                )}
              </DetailSection>
              <DetailSection title="Special Items">
                {oneTimeCredits.length === 0 && oneTimeDeductions.length === 0 ? (
                  <EmptySourceRow label="No one-time items for this employee" />
                ) : (
                  <>
                    {oneTimeCredits.map((item, index) => (
                      <ReadOnlyMoneyRow key={`credit-${item.instructionType}-${index}`} label={item.instructionType} amount={item.amount}>
                        <StatusBadge tone="emerald">Credit</StatusBadge>
                        {item.remarks ? <StatusBadge>{item.remarks}</StatusBadge> : null}
                      </ReadOnlyMoneyRow>
                    ))}
                    {oneTimeDeductions.map((item, index) => (
                      <ReadOnlyMoneyRow key={`deduction-${item.instructionType}-${index}`} label={item.instructionType} amount={item.amount}>
                        <StatusBadge tone="rose">Deduction</StatusBadge>
                        {item.remarks ? <StatusBadge>{item.remarks}</StatusBadge> : null}
                      </ReadOnlyMoneyRow>
                    ))}
                  </>
                )}
              </DetailSection>
              <DetailSection title="Tax">
                <label className="grid gap-1.5 rounded-xl border border-slate-100 bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">Adjustment type</span>
                  <SelectField value={row.taxAnnualizationType} onChange={(event) => onChange("taxAnnualizationType", event.target.value)}>
                    <option value="No Adjustment">No Adjustment</option>
                    <option value="Refund">Refund</option>
                    <option value="Additional Deduction">Additional Deduction</option>
                  </SelectField>
                </label>
                <AmountInputRow label="Tax adjustment" value={row.taxAnnualizationAdjustment} onChange={(value) => onChange("taxAnnualizationAdjustment", value)} />
                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                  <div className="text-sm font-semibold text-slate-700">Withholding tax</div>
                  <div className="mt-1 text-right text-sm font-bold tabular-nums text-slate-950">{formatCurrency(calculated.withholdingTax)}</div>
                </div>
              </DetailSection>
            </>
          ) : null}
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
            <span className="text-sm font-bold text-slate-600">Total</span>
            <span className="text-lg font-bold tabular-nums text-slate-950">{formatCurrency(meta.total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function PayrollSpreadsheetRow({
  row,
  rowNumber,
  employee,
  employees,
  runCutoff,
  calculated,
  premiumColumns,
  allowanceColumns,
  deductionColumns,
  importedAttendance,
  standingAllowanceLines = [],
  loanDeductions = [],
  oneTimeCredits = [],
  oneTimeDeductions = [],
  onChange,
  onRemoveRow,
  onOpenDrawer,
  readOnly = false,
}: {
  row: BulkPayrollRow;
  rowNumber: number;
  employee: EmployeeRecord | null;
  employees: EmployeeRecord[];
  runCutoff: PayrollCutoffIdentity;
  calculated: Calculation;
  premiumColumns: BulkCustomColumn[];
  allowanceColumns: BulkCustomColumn[];
  deductionColumns: BulkCustomColumn[];
  importedAttendance?: PayrollAttendanceRow;
  standingAllowanceLines?: StandingAllowanceLine[];
  loanDeductions?: LoanDeductionLine[];
  oneTimeCredits?: PayrollPipelineResult["oneTimeCreditLines"];
  oneTimeDeductions?: PayrollPipelineResult["oneTimeDeductionLines"];
  onChange: (field: keyof BulkPayrollRow, value: string) => void;
  onRemoveRow: () => void;
  onOpenDrawer: (category: PayrollDrawerCategory) => void;
  readOnly?: boolean;
}) {
  const premiumActiveCount = countActiveValues([
    row.nightDiffHours,
    row.overtimeHours,
    row.restDayHours,
    row.specialHolidayHours,
    row.absencesHours,
    ...premiumColumns.map((column) => row.customPremiumValues[column.id]),
  ]);
  const allowanceActiveCount = standingAllowanceLines.length;
  const standingAllowanceTotal = standingAllowanceLines.reduce((sum, line) => sum + line.amount, 0);
  const standingAllowanceSummaryLines = standingAllowanceLines.map((line) => `${line.name}: ${formatCurrency(line.amount)} · ${line.taxable ? "Taxable" : "Non-taxable"}`);
  const govtActiveCount = countActiveValues([row.sssEe, row.sssEr, row.philhealthEe, row.philhealthEr, row.pagibigEe, row.pagibigEr]);
  const otherActiveCount = countActiveValues([
    row.employeeAdvances,
    row.cashAdvances,
    row.sssLoanRepayment,
    row.hdmfLoanRepayment,
    row.taxAnnualizationAdjustment,
    calculated.withholdingTax,
    ...deductionColumns.map((column) => row.customDeductionValues[column.id]),
  ]) + loanDeductions.length + oneTimeCredits.length + oneTimeDeductions.length;
  const loanDeductionTotal = loanDeductions.reduce((sum, line) => sum + line.amount, 0);
  const oneTimeCreditTotal = oneTimeCredits.reduce((sum, item) => sum + item.amount, 0);
  const oneTimeDeductionTotal = oneTimeDeductions.reduce((sum, item) => sum + item.amount, 0);
  const taxAnnualizationAmount = readNumber(row.taxAnnualizationAdjustment);
  const taxAdjustmentSigned = row.taxAnnualizationType === "Refund" ? -taxAnnualizationAmount : row.taxAnnualizationType === "Additional Deduction" ? taxAnnualizationAmount : 0;
  const loanDeductionLines = loanDeductions.map((line) => `${line.loanName}: ${formatCurrency(line.amount)} (bal. ${formatCurrency(line.remainingBalanceAfterDeduction)})`);
  const specialItemLines = [
    ...oneTimeCredits.map((item) => `${item.instructionType}: +${formatCurrency(item.amount)}`),
    ...oneTimeDeductions.map((item) => `${item.instructionType}: -${formatCurrency(item.amount)}`),
  ];
  const otherTaxTotal =
    readNumber(row.employeeAdvances) +
    readNumber(row.cashAdvances) +
    readNumber(row.sssLoanRepayment) +
    readNumber(row.hdmfLoanRepayment) +
    calculated.customDeductionsTotal +
    loanDeductionTotal +
    oneTimeDeductionTotal -
    oneTimeCreditTotal +
    calculated.withholdingTax +
    taxAdjustmentSigned;
  const proration = getProrationInfo(employee, row, importedAttendance);
  const fullBasicPay = employee ? getBasicPayPerPayrollPeriod(employee, 2) : 0;
  const basicPayProrationDeduction = proration.isActive ? Math.max(fullBasicPay - calculated.basicPay, 0) : 0;
  const standardHoursPerDay = getPositiveNumber(employee?.standardHoursPerDay, 8);
  const importedDaysAbsent = Number(importedAttendance?.daysAbsent) || 0;
  const importedHrsAbsent = importedDaysAbsent * standardHoursPerDay;
  const importedTotalHours = importedAttendance
    ? Math.max(0, (Number(importedAttendance.daysPresent) || 0) * standardHoursPerDay)
    : 0;
  const importedPremiumLines = Object.entries(importedAttendance?.premiumHours || {})
    .filter(([, hours]) => Number(hours) > 0)
    .map(([bucket, hours]) => `${bucket}: ${compactHours(Number(hours))} hrs`);

  return (
    <tr data-readonly={readOnly ? "true" : undefined} className="transition hover:bg-sky-50/40">
      <td style={spreadsheetCellStyle}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">Row {rowNumber}</span>
          {employee ? <StatusBadge tone="sky">{employee.employeeNo}</StatusBadge> : null}
        </div>
        <SelectField value={row.employeeNo} onChange={(event) => onChange("employeeNo", event.target.value)}>
          <option value="">Select employee</option>
          {employees.map((option) => (
            <option key={option.employeeNo} value={option.employeeNo}>
              {buildEmployeeDisplayLabel(option)}
            </option>
          ))}
        </SelectField>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusBadge>{employee?.department || "No dept"}</StatusBadge>
          <StatusBadge>{employee?.employeeType || "No type"}</StatusBadge>
        </div>
      </td>

      <td style={{ ...spreadsheetCellStyle, minWidth: 300 }}>
        <div className="grid gap-2">
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
            <div className="text-xs font-black text-slate-950">
              {runCutoff.cutoffLabel || runCutoff.cutoff || row.payrollPeriod || "Cutoff"}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {runCutoff.monthYear || row.monthYear || "—"}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              {runCutoff.coverageStartDate || "—"} to {runCutoff.coverageEndDate || "—"}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-500">
              Payroll date: {row.payrollDate || runCutoff.payrollDate || runCutoff.payDate || "—"}
            </div>
          </div>
        </div>
      </td>
      <td style={{ ...spreadsheetCellStyle, minWidth: 260 }}>
        {importedAttendance ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-2">
              <ImportedMetric label="Days Present" value={importedAttendance.daysPresent} />
              <ImportedMetric label="Days Absent" value={importedAttendance.daysAbsent} />
              <ImportedMetric label="Hrs Absent" value={compactHours(importedHrsAbsent)} />
              <ImportedMetric label="Total Hrs" value={compactHours(importedTotalHours)} />
              <ImportedMetric label="Undertime" value={`${importedAttendance.undertimeMins || 0} mins`} />
              <ImportedMetric label="Late" value={`${importedAttendance.lateMins || 0} mins`} />
              <ImportedMetric label="Paid Leave" value={importedAttendance.paidLeaveDays} />
              <ImportedMetric label="Unpaid Leave" value={importedAttendance.unpaidLeaveDays} />
            </div>
            {importedAttendance.statusType !== "none" || importedAttendance.statusDays > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                {importedAttendance.statusType} · {importedAttendance.statusDays} day{importedAttendance.statusDays === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        ) : employee ? (() => {
          const wdpm = getPositiveNumber(employee.workingDaysPerMonth, 26);
          const hpd = getPositiveNumber(employee.standardHoursPerDay, 8);
          const totalHrs = wdpm * hpd;
          return (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Days/Month</div>
                <div className="mt-0.5 text-xs font-bold text-slate-700">{wdpm}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hrs/Day</div>
                <div className="mt-0.5 text-xs font-bold text-slate-700">{hpd}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total Hrs</div>
                <div className="mt-0.5 text-xs font-bold text-slate-700">{totalHrs}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Hrs Absent</div>
                <input
                  type="number"
                  min={0}
                  max={totalHrs}
                  step={0.5}
                  value={row.absencesHours}
                  disabled={readOnly}
                  onChange={(e) => onChange("absencesHours", e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-xs font-bold text-slate-900 focus:border-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>
          );
        })() : <span className="text-xs text-slate-400">—</span>}
      </td>

      <td style={spreadsheetCellStyle}>
        <div className="text-sm font-bold tabular-nums text-slate-950">{formatCurrency(calculated.basicPay)}</div>
        {proration.isActive && basicPayProrationDeduction > 0 ? (
          <div className="mt-1 text-xs font-bold tabular-nums text-rose-600">
            -{formatCurrency(basicPayProrationDeduction)} ({compactHours(proration.hoursAbsent)} hrs absent)
          </div>
        ) : null}
      </td>

      <td style={spreadsheetCellStyle}>
        <PayrollSummaryCell title="Premiums" amount={calculated.totalPayrollPremium} activeCount={premiumActiveCount} importedLines={importedPremiumLines} customCount={premiumColumns.length} icon={<Clock className="h-4 w-4" aria-hidden="true" />} review={readNumber(row.absencesHours) > 0} onClick={() => onOpenDrawer("premium")} />
      </td>

      <td style={spreadsheetCellStyle}>
        <PayrollSummaryCell title="Allowances" amount={standingAllowanceTotal} activeCount={allowanceActiveCount} importedLines={standingAllowanceSummaryLines} icon={<Gift className="h-4 w-4" aria-hidden="true" />} onClick={() => onOpenDrawer("allowance")} />
      </td>

      <td style={spreadsheetCellStyle}>
        <PayrollSummaryCell title="Gov't" amount={calculated.totalGovtEmployeeContrib + calculated.totalGovtEmployerContrib} activeCount={govtActiveCount} icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} onClick={() => onOpenDrawer("govt")} />
      </td>

      <td style={spreadsheetCellStyle}>
        <PayrollSummaryCell title="Other / Tax" amount={otherTaxTotal} activeCount={otherActiveCount} customCount={deductionColumns.length} importedLines={[...loanDeductionLines, ...specialItemLines]} icon={<ReceiptText className="h-4 w-4" aria-hidden="true" />} review={row.taxAnnualizationType !== "No Adjustment"} onClick={() => onOpenDrawer("other")} />
      </td>

      <td style={spreadsheetCellStyle}>
        <div className="text-sm font-bold tabular-nums text-slate-950">{formatCurrency(calculated.grossPay)}</div>
      </td>

      <td style={spreadsheetCellStyle}>
        <div className="text-sm font-bold tabular-nums text-slate-950">{formatCurrency(calculated.netPay)}</div>
      </td>

      <td style={spreadsheetCellStyle}>
        <button type="button" onClick={onRemoveRow} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100" aria-label="Remove row">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

function AddPayrollPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReadonlyPayrollRunView = searchParams.get("mode") === "view-payroll-run";
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [savedPayrollRecords, setSavedPayrollRecords] = useState<SavedPayrollRecord[]>([]);
  const payrollFrequency = "semi-monthly";
  const [monthYear, setMonthYear] = useState("");
  const [payrollDate, setPayrollDate] = useState("");
  const [payrollPeriod, setPayrollPeriod] = useState("");
  const [cutoffDefinitions, setCutoffDefinitions] = useState<CutoffDefinition[]>(SEED_CUTOFF_DEFINITIONS);
  const [bulkRows, setBulkRows] = useState<BulkPayrollRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailDrawer, setDetailDrawer] = useState<{ rowId: string; category: PayrollDrawerCategory } | null>(null);
  const [loadFilterType, setLoadFilterType] = useState<"all" | "department" | "classification" | "employeeType" | "mwe">("all");
  const [loadFilterValue, setLoadFilterValue] = useState("");
  const [customColumns, setCustomColumns] = useState<BulkCustomColumn[]>([]);
  const [newColumnCategory, setNewColumnCategory] = useState<BulkCustomColumnCategory>("allowance");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnAmount, setNewColumnAmount] = useState("0");
  const [newColumnScope, setNewColumnScope] = useState<Scope>("all");
  const [newColumnScopeValue, setNewColumnScopeValue] = useState("");
  const [allowanceToRemove, setAllowanceToRemove] = useState<StandardAllowanceField>("christmasBonus");
  const [removeAllowanceScope, setRemoveAllowanceScope] = useState<Exclude<Scope, "single">>("all");
  const [removeAllowanceScopeValue, setRemoveAllowanceScopeValue] = useState("");
  const [showCsvGuide, setShowCsvGuide] = useState(false);
  const [showEditColumns, setShowEditColumns] = useState(false);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [payrollSaveConfirm, setPayrollSaveConfirm] = useState<{
    validRows: BulkPayrollRow[];
    totalBasicPay: number;
    periodLabel: string;
  } | null>(null);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [payrollToast, setPayrollToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const payrollToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [readonlyPayrollRunTitle, setReadonlyPayrollRunTitle] = useState("");
  // In view mode the live pipeline inputs (standing allowances, loans, special items, imported
  // attendance) are not loaded, so totals must come from the values saved with the run instead of
  // being recomputed. Keyed by row id.
  const [readonlySavedById, setReadonlySavedById] = useState<Record<string, ReadonlySavedRow>>({});
  // Raw saved records + run meta for the on-screen detailed register (mirrors the Excel export).
  const [readonlyRunRecords, setReadonlyRunRecords] = useState<SavedPayrollRecord[]>([]);
  const [readonlyRunMeta, setReadonlyRunMeta] = useState<{ period: string; payDate: string }>({ period: "", payDate: "" });
  const [payrollAdjustments, setPayrollAdjustments] = useState<PayrollAdjustmentRecord[]>([]);
  const [appliedMonetizedLeaveAdjustmentIds, setAppliedMonetizedLeaveAdjustmentIds] = useState<string[]>([]);
  const [deMinimisBenefits, setDeMinimisBenefits] = useState<DeMinimisBenefit[]>([]);
  const [standingAllowances, setStandingAllowances] = useState<StandingAllowance[]>([]);
  const [payrollLoans, setPayrollLoans] = useState<PayrollLoanRecord[]>([]);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);
  const [hasSpecialItemsThisCutoff, setHasSpecialItemsThisCutoff] = useState(false);
  const [specialItemsDecisionMade, setSpecialItemsDecisionMade] = useState(false);
  const [specialItems, setSpecialItems] = useState<SpecialItem[]>([]);
  const [specialItemsErrors, setSpecialItemsErrors] = useState<ValidationError[]>([]);
  const [isImportingSpecialItems, setIsImportingSpecialItems] = useState(false);
  const [payrollComputationImport, setPayrollComputationImport] = useState<PayrollComputationImport | null>(null);
  const [payrollComputationErrors, setPayrollComputationErrors] = useState<ValidationError[]>([]);
  const [isImportingPayrollComputation, setIsImportingPayrollComputation] = useState(false);
  const [csvImportErrors, setCsvImportErrors] = useState<ValidationError[]>([]);
  const [importProgress, setImportProgress] = useState<ImportProgress>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState("");
  const importSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpecialItemsWorkbookRef = useRef<File | null>(null);
  const pendingPayrollWorkbookRef = useRef<File | null>(null);
  const autoLoadAttemptedRef = useRef(false);
  const isImportBusy = Boolean(importProgress);
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

  useEffect(() => {
    async function loadCutoffDefinitions() {
      const saved = await getConfigItem<{ items: CutoffDefinition[] }>(storageKeys.cutoffDefinitions, { items: SEED_CUTOFF_DEFINITIONS });
      setCutoffDefinitions(saved.items?.length ? saved.items : SEED_CUTOFF_DEFINITIONS);
    }

    loadCutoffDefinitions();
    window.addEventListener(`${storageKeys.cutoffDefinitions}-updated`, loadCutoffDefinitions as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.cutoffDefinitions}-updated`, loadCutoffDefinitions as EventListener);
    };
  }, []);

  const isSemiMonthlyPayroll = payrollFrequency.toLowerCase().includes("semi");
  const isWeeklyPayroll = payrollFrequency.toLowerCase().includes("weekly");
  const contributionFactor = isSemiMonthlyPayroll ? 2 : isWeeklyPayroll ? 4 : 1;

  const payrollPeriodOptions = cutoffDefinitions.map((cutoff) => ({
    value: cutoff.id,
    label: cutoff.label,
  }));

  const SESSION_DRAFT_KEY = "axis_add_payroll_draft";
  const SESSION_DRAFT_DISCARDED_KEY = "draft_discarded_add_payroll";
  const SESSION_DRAFT_PROMPT_SHOWN_KEY = "draft_prompt_shown_add_payroll";

  function hasMeaningfulPayrollDraft(draft: Record<string, unknown>) {
    if (String(draft.monthYear || "").trim()) return true;
    if (String(draft.payrollDate || "").trim()) return true;
    if (String(draft.payrollPeriod || "").trim()) return true;
    if (String(draft.loadFilterValue || "").trim()) return true;
    if (String(draft.newColumnName || "").trim()) return true;
    if (String(draft.newColumnAmount || "0") !== "0") return true;
    if (String(draft.newColumnScopeValue || "").trim()) return true;
    if (String(draft.removeAllowanceScopeValue || "").trim()) return true;
    if (Array.isArray(draft.bulkRows) && draft.bulkRows.length > 0) return true;
    if (Array.isArray(draft.customColumns) && draft.customColumns.length > 0) return true;
    if (Array.isArray(draft.specialItems) && draft.specialItems.length > 0) return true;
    if (draft.payrollComputationImport) return true;
    return false;
  }

  useEffect(() => {
    if (isReadonlyPayrollRunView) return;
    try {
      sessionStorage.removeItem(SESSION_DRAFT_PROMPT_SHOWN_KEY);
      if (sessionStorage.getItem(SESSION_DRAFT_DISCARDED_KEY) === "true") return;
      const saved = sessionStorage.getItem(SESSION_DRAFT_KEY);
      if (saved && sessionStorage.getItem(SESSION_DRAFT_PROMPT_SHOWN_KEY) !== "true") {
        window.setTimeout(() => setShowRestoreBanner(true), 0);
        sessionStorage.setItem(SESSION_DRAFT_PROMPT_SHOWN_KEY, "true");
      }
    } catch {
      // ignore draft prompt failures
    }
  }, [isReadonlyPayrollRunView]);

  function handleRestoreSession() {
    try {
      const saved = sessionStorage.getItem(SESSION_DRAFT_KEY);
      console.log("Add Payroll draft contents:", saved);
      if (!saved) throw new Error("Missing draft");
      const draft = JSON.parse(saved);
      if (!draft || typeof draft !== "object") throw new Error("Invalid draft");

      setMonthYear(draft.monthYear || "");
      setPayrollDate(draft.payrollDate || "");
      setPayrollPeriod(draft.payrollPeriod || "");
      setBulkRows(Array.isArray(draft.bulkRows) ? draft.bulkRows : []);
      setCurrentPage(Number(draft.currentPage) || 1);
      setLoadFilterType(draft.loadFilterType || "all");
      setLoadFilterValue(draft.loadFilterValue || "");
      setCustomColumns(Array.isArray(draft.customColumns) ? draft.customColumns : []);
      setNewColumnCategory(draft.newColumnCategory || "allowance");
      setNewColumnName(draft.newColumnName || "");
      setNewColumnAmount(draft.newColumnAmount || "0");
      setNewColumnScope(draft.newColumnScope || "all");
      setNewColumnScopeValue(draft.newColumnScopeValue || "");
      setAllowanceToRemove(draft.allowanceToRemove || "christmasBonus");
      setRemoveAllowanceScope(draft.removeAllowanceScope || "all");
      setRemoveAllowanceScopeValue(draft.removeAllowanceScopeValue || "");
      setShowCsvGuide(Boolean(draft.showCsvGuide));
      setShowEditColumns(Boolean(draft.showEditColumns));
      setShowLoadPanel(Boolean(draft.showLoadPanel));
      setAppliedMonetizedLeaveAdjustmentIds(Array.isArray(draft.appliedMonetizedLeaveAdjustmentIds) ? draft.appliedMonetizedLeaveAdjustmentIds : []);
      setHasSpecialItemsThisCutoff(Boolean(draft.hasSpecialItemsThisCutoff));
      setSpecialItemsDecisionMade(Boolean(draft.specialItemsDecisionMade));
      setSpecialItems(Array.isArray(draft.specialItems) ? draft.specialItems : []);
      setSpecialItemsErrors(Array.isArray(draft.specialItemsErrors) ? draft.specialItemsErrors : []);
      setPayrollComputationImport(draft.payrollComputationImport || null);
      setPayrollComputationErrors(Array.isArray(draft.payrollComputationErrors) ? draft.payrollComputationErrors : []);
      try { sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY); } catch {}
    } catch {
      window.alert("Draft could not be restored.");
      try {
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY);
      } catch {}
    } finally {
      setShowRestoreBanner(false);
    }
  }

  function handleDiscardSession() {
    try {
      sessionStorage.removeItem(SESSION_DRAFT_KEY);
      sessionStorage.setItem(SESSION_DRAFT_DISCARDED_KEY, "true");
    } catch {
      // ignore draft persistence failures
    }
    setShowRestoreBanner(false);
  }

  useEffect(() => {
    if (isReadonlyPayrollRunView || showRestoreBanner) return;
    const draft = {
      monthYear,
      payrollDate,
      payrollPeriod,
      bulkRows,
      currentPage,
      loadFilterType,
      loadFilterValue,
      customColumns,
      newColumnCategory,
      newColumnName,
      newColumnAmount,
      newColumnScope,
      newColumnScopeValue,
      allowanceToRemove,
      removeAllowanceScope,
      removeAllowanceScopeValue,
      showCsvGuide,
      showEditColumns,
      showLoadPanel,
      appliedMonetizedLeaveAdjustmentIds,
      hasSpecialItemsThisCutoff,
      specialItemsDecisionMade,
      specialItems,
      specialItemsErrors,
      payrollComputationImport,
      payrollComputationErrors,
    };
    const saveTimeout = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(SESSION_DRAFT_DISCARDED_KEY) === "true") return;
        if (!hasMeaningfulPayrollDraft(draft)) {
          sessionStorage.removeItem(SESSION_DRAFT_KEY);
          return;
        }
        sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore draft persistence failures
      }
    }, 500);
    return () => window.clearTimeout(saveTimeout);
  }, [
    isReadonlyPayrollRunView, showRestoreBanner, monthYear, payrollDate, payrollPeriod,
    bulkRows, currentPage, loadFilterType, loadFilterValue, customColumns,
    newColumnCategory, newColumnName, newColumnAmount, newColumnScope,
    newColumnScopeValue, allowanceToRemove, removeAllowanceScope,
    removeAllowanceScopeValue, showCsvGuide, showEditColumns, showLoadPanel,
    appliedMonetizedLeaveAdjustmentIds, hasSpecialItemsThisCutoff,
    specialItemsDecisionMade, specialItems, specialItemsErrors,
    payrollComputationImport, payrollComputationErrors,
  ]);

  const premiumColumns = customColumns.filter((column) => column.category === "premium");
  const allowanceColumns = customColumns.filter((column) => column.category === "allowance");
  const deductionColumns = customColumns.filter((column) => column.category === "deduction");

  const departmentOptions = Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))).sort();
  const classificationOptions = Array.from(new Set(employees.map((employee) => employee.employmentClassification || employee.employmentStatus).filter(Boolean))).sort();
  const employeeTypeOptions = Array.from(new Set(employees.map((employee) => employee.employeeType).filter(Boolean))).sort();
  const mweOptions = Array.from(new Set(employees.map((employee) => employee.isMinimumWageEarner).filter(Boolean))).sort();

  const totalPages = Math.max(1, Math.ceil(bulkRows.length / ROWS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const firstIndex = (safeCurrentPage - 1) * ROWS_PER_PAGE;
  const lastIndex = Math.min(firstIndex + ROWS_PER_PAGE, bulkRows.length);
  const paginatedRows = useMemo(() => bulkRows.slice(firstIndex, lastIndex), [bulkRows, firstIndex, lastIndex]);

  const selectedPayrollMonthName = useMemo(() => {
    if (!monthYear) return "";
    const [yearText, monthText] = monthYear.split("-");
    const date = new Date(Number(yearText), Number(monthText) - 1, 1);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-PH", { month: "long" });
  }, [monthYear]);

  const selectedPayrollYearText = useMemo(() => {
    if (!monthYear) return "";
    return monthYear.split("-")[0] || "";
  }, [monthYear]);

  const selectedPayrollReferenceForMonetization = useMemo(() => {
    if (!selectedPayrollMonthName || !selectedPayrollYearText || !payrollPeriod) return "";
    return `${payrollPeriod} • ${selectedPayrollMonthName} ${selectedPayrollYearText}`;
  }, [payrollPeriod, selectedPayrollMonthName, selectedPayrollYearText]);

  const pendingMonetizedLeaveAdjustments = useMemo(() => {
    if (!selectedPayrollReferenceForMonetization) return [];

    return payrollAdjustments.filter((adjustment) => {
      const reference = String(adjustment.payrollReference || "").trim();
      const category = String(adjustment.adjustmentCategory || "").toLowerCase();
      const source = String(adjustment.source || "").toLowerCase();

      return (
        reference === selectedPayrollReferenceForMonetization &&
        (category.includes("monetized leave") || source.includes("monetization"))
      );
    });
  }, [payrollAdjustments, selectedPayrollReferenceForMonetization]);

  const pendingMonetizedLeaveTotal = pendingMonetizedLeaveAdjustments.reduce(
    (sum, adjustment) => sum + readNumber(adjustment.amount),
    0
  );

  const appliedMonetizedLeaveAdjustmentIdSet = new Set(appliedMonetizedLeaveAdjustmentIds);

  const unappliedMonetizedLeaveAdjustments = pendingMonetizedLeaveAdjustments.filter(
    (adjustment) => !appliedMonetizedLeaveAdjustmentIdSet.has(String(adjustment.id || adjustment.sourceId || ""))
  );

  const isSelectedMonetizedLeaveApplied =
    pendingMonetizedLeaveAdjustments.length > 0 && unappliedMonetizedLeaveAdjustments.length === 0;

  function applyPendingMonetizedLeaveAdjustments() {
    if (pendingMonetizedLeaveAdjustments.length === 0 || isSelectedMonetizedLeaveApplied) return;

    if (bulkRows.length === 0) {
      window.alert("Please load employees first before applying monetized leave to this payroll run.");
      return;
    }

    const confirmed = window.confirm(
      `Apply ${formatCurrency(pendingMonetizedLeaveTotal)} monetized leave to the Monetized Leave allowance column for ${selectedPayrollReferenceForMonetization}?`
    );

    if (!confirmed) return;

    setBulkRows((currentRows) =>
      currentRows.map((row) => {
        const matchedAdjustments = unappliedMonetizedLeaveAdjustments.filter(
          (adjustment) => String(adjustment.employeeId || adjustment.employeeNo || "") === row.employeeNo
        );

        if (matchedAdjustments.length === 0) return row;

        const amountToApply = matchedAdjustments.reduce(
          (sum, adjustment) => sum + readNumber(adjustment.amount),
          0
        );

        return {
          ...row,
          monetizedLeavePrivate: String(readNumber(row.monetizedLeavePrivate) + amountToApply),
        };
      })
    );

    const nextAppliedIds = Array.from(
      new Set([
        ...appliedMonetizedLeaveAdjustmentIds,
        ...unappliedMonetizedLeaveAdjustments.map((adjustment) => String(adjustment.id || adjustment.sourceId || "")),
      ].filter(Boolean))
    );

    setAppliedMonetizedLeaveAdjustmentIds(nextAppliedIds);
    setDataArray(APPLIED_MONETIZED_LEAVE_ADJUSTMENTS_KEY, nextAppliedIds);
  }

  function cancelAppliedMonetizedLeaveAdjustments() {
    if (!isSelectedMonetizedLeaveApplied || pendingMonetizedLeaveAdjustments.length === 0) return;

    const confirmed = window.confirm(
      `Cancel the applied monetized leave for ${selectedPayrollReferenceForMonetization}? This will remove the applied amount from the Monetized Leave allowance column.`
    );
    if (!confirmed) return;

    setBulkRows((currentRows) =>
      currentRows.map((row) => {
        const matchedAdjustments = pendingMonetizedLeaveAdjustments.filter(
          (adjustment) => String(adjustment.employeeId || adjustment.employeeNo || "") === row.employeeNo
        );

        if (matchedAdjustments.length === 0) return row;

        const amountToRemove = matchedAdjustments.reduce(
          (sum, adjustment) => sum + readNumber(adjustment.amount),
          0
        );

        return {
          ...row,
          monetizedLeavePrivate: String(Math.max(0, readNumber(row.monetizedLeavePrivate) - amountToRemove)),
        };
      })
    );

    const cancellingIds = new Set(
      pendingMonetizedLeaveAdjustments.map((adjustment) => String(adjustment.id || adjustment.sourceId || ""))
    );
    const nextAppliedIds = appliedMonetizedLeaveAdjustmentIds.filter((id) => !cancellingIds.has(id));
    setAppliedMonetizedLeaveAdjustmentIds(nextAppliedIds);
    setDataArray(APPLIED_MONETIZED_LEAVE_ADJUSTMENTS_KEY, nextAppliedIds);
  }

  useEffect(() => {
    async function loadInitialData() {
      const [rawEmployees, records, adjustments, appliedAdjustmentIds, savedDeMinimisBenefits, savedStandingAllowances, savedPayrollLoans] = await Promise.all([
        getCollectionItems<SavedEmployeeRecord>(storageKeys.employees),
        getCollectionItems<SavedPayrollRecord>(storageKeys.payrollRecords),
        getDataArray<PayrollAdjustmentRecord>(storageKeys.payrollAdjustments, []),
        getDataArray<string>(APPLIED_MONETIZED_LEAVE_ADJUSTMENTS_KEY, []),
        getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits),
        getCollectionItems<StandingAllowance>(storageKeys.standingAllowances),
        getCollectionItems<PayrollLoanRecord>(storageKeys.payrollLoans),
      ]);
      const mappedEmployees = rawEmployees
        .filter((employee) => !employee.archived)
        .map((employee) => ({
          employeeNo: employee.employeeNo,
          name: [employee.lastName, [employee.firstName, employee.middleName].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          designation: employee.designation || "—",
          department: employee.department || "Unassigned",
          employmentStatus: employee.employmentStatus || "Active",
          employmentClassification: employee.employmentClassification || employee.employmentStatus || "Rank-and-file",
          employeeType: employee.employeeType || "Full-time",
          payrollRunType: (employee.payrollRunType === "B" ? "B" : "A") as "A" | "B",
          isMinimumWageEarner: String(employee.isMinimumWageEarner || "No"),
          deductAllowanceOnAbsence: Boolean(employee.deductAllowanceOnAbsence),
          hourlyRate: Number(employee.hourlyRate || 0),
          basicPay: Number(employee.basicPay || 0),
          salaryHistory: employee.salaryHistory,
          basicPayFrequency: String(employee.basicPayFrequency || "Monthly"),
          standardHoursPerDay: getPositiveNumber(employee.standardHoursPerDay, 8),
          workingDaysPerMonth: getPositiveNumber(employee.workingDaysPerMonth, 26),
          riceSubsidy: readNumber(employee.riceSubsidy),
          uniformClothingAllowance: readNumber(employee.uniformClothingAllowance),
          laundryAllowance: readNumber(employee.laundryAllowance),
          actualMedicalAssistance: readNumber(employee.actualMedicalAssistance),
          medicalCashAllowanceToDependents: readNumber(employee.medicalCashAllowanceToDependents),
          mealAllowance: readNumber(employee.mealAllowance),
          christmasAnniversaryGifts: readNumber(employee.christmasAnniversaryGifts),
          achievementAwards: readNumber(employee.achievementAwards),
          thirteenthMonthPay: readNumber(employee.thirteenthMonthPay),
          christmasBonus: readNumber(employee.christmasBonus),
          otherAllowanceAmount: readNumber(employee.otherAllowanceAmount),
          allowanceFrequencies: employee.allowanceFrequencies || {},
          customPremiums: normalizeEmployeeCustomPayrollItems(employee.customPremiums),
          customAllowances: normalizeEmployeeCustomPayrollItems(employee.customAllowances),
          customDeductions: normalizeEmployeeCustomPayrollItems(employee.customDeductions),
        }));
      setEmployees(mappedEmployees);
      setSavedPayrollRecords(records);
      setPayrollAdjustments(adjustments);
      setAppliedMonetizedLeaveAdjustmentIds(appliedAdjustmentIds);
      setDeMinimisBenefits(savedDeMinimisBenefits.filter((benefit) => !benefit.archived));
      setStandingAllowances(savedStandingAllowances.filter((allowance) => !allowance.archived));
      setPayrollLoans(savedPayrollLoans);
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function refreshPayrollAdjustments() {
      const adjustments = await getDataArray<PayrollAdjustmentRecord>(storageKeys.payrollAdjustments, []);
      setPayrollAdjustments(adjustments);
    }
    window.addEventListener(`${storageKeys.payrollAdjustments}-updated`, refreshPayrollAdjustments as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.payrollAdjustments}-updated`, refreshPayrollAdjustments as EventListener);
    };
  }, []);

  useEffect(() => {
    if (currentPage <= totalPages) return;

    const timeoutId = window.setTimeout(() => setCurrentPage(totalPages), 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isReadonlyPayrollRunView) return;

    async function loadReadonlyRun() {
      const readonlyRun = await getConfigItem<ReadonlyPayrollRunView | null>("readonlyPayrollRunView", null);
      if (!readonlyRun || !Array.isArray(readonlyRun.records)) return;

      const readonlyRows = readonlyRun.records.map((record, index) => {
        const rawRecord = record;
        const customPremiumValues = Object.fromEntries(
          (rawRecord.customPremiums || []).map((item: { id: string; name: string; amount: number }) => [item.id || customColumnId("premium", item.name), String(Number(item.amount) || 0)])
        );
        const customAllowanceValues = Object.fromEntries(
          (rawRecord.customAllowances || []).map((item: { id: string; name: string; amount: number }) => [item.id || customColumnId("allowance", item.name), String(Number(item.amount) || 0)])
        );
        const customDeductionValues = Object.fromEntries(
          (rawRecord.customDeductions || []).map((item: { id: string; name: string; amount: number }) => [item.id || customColumnId("deduction", item.name), String(Number(item.amount) || 0)])
        );

        return buildBlankRow({
          id: rawRecord.id || `readonly-${index}`,
          employeeNo: rawRecord.employeeNo || "",
          monthYear: rawRecord.monthYear || "",
          payrollDate: rawRecord.payrollDate || readonlyRun.payrollDate || "",
          payrollPeriod: rawRecord.payrollPeriod || "",
          nightDiffHours: String(rawRecord.nightDiffHours || "0"),
          overtimeHours: String(rawRecord.overtimeHours || "0"),
          restDayHours: String(rawRecord.restDayHours || "0"),
          specialHolidayHours: String(rawRecord.specialHolidayHours || "0"),
          absencesHours: String(rawRecord.absencesHours || "0"),
          riceSubsidy: String(rawRecord.riceSubsidy || "0"),
          uniformClothing: String(rawRecord.uniformClothing || "0"),
          laundryAllowance: String(rawRecord.laundryAllowance || "0"),
          medicalCashDependents: String(rawRecord.medicalCashDependents || "0"),
          actualMedicalAssistance: String(rawRecord.actualMedicalAssistance || "0"),
          achievementAwards: String(rawRecord.achievementAwards || "0"),
          christmasAnniversaryGifts: String(rawRecord.christmasAnniversaryGifts || "0"),
          mealAllowanceOTNight: String(rawRecord.mealAllowanceOTNight || "0"),
          monetizedLeavePrivate: String(rawRecord.monetizedLeavePrivate || "0"),
          cbaProductivityIncentives: String(rawRecord.cbaProductivityIncentives || "0"),
          thirteenthMonthPay: String(rawRecord.thirteenthMonthPay || "0"),
          christmasBonus: String(rawRecord.christmasBonus || "0"),
          otherTaxableAllowances: String(rawRecord.otherTaxableAllowances || "0"),
          sssMonthlySalaryCredit: String(rawRecord.sssMonthlySalaryCredit || "0"),
          sssRegularEe: String(rawRecord.sssRegularEe || "0"),
          sssRegularEr: String(rawRecord.sssRegularEr || "0"),
          sssWispEe: String(rawRecord.sssWispEe || "0"),
          sssWispEr: String(rawRecord.sssWispEr || "0"),
          sssEc: String(rawRecord.sssEc || "0"),
          sssEe: String(rawRecord.sssEe || "0"),
          sssEr: String(rawRecord.sssEr || "0"),
          philhealthEe: String(rawRecord.philhealthEe || "0"),
          philhealthEr: String(rawRecord.philhealthEr || "0"),
          pagibigEe: String(rawRecord.pagibigEe || "0"),
          pagibigEr: String(rawRecord.pagibigEr || "0"),
          employeeAdvances: String(rawRecord.employeeAdvances || "0"),
          cashAdvances: String(rawRecord.cashAdvances || "0"),
          sssLoanRepayment: String(rawRecord.sssLoanRepayment || "0"),
          hdmfLoanRepayment: String(rawRecord.hdmfLoanRepayment || "0"),
          taxAnnualizationAdjustment: String(rawRecord.taxAnnualizationAdjustment || "0"),
          taxAnnualizationType: rawRecord.taxAnnualizationType || "No Adjustment",
          taxAnnualizationYear: rawRecord.taxAnnualizationYear || "",
          taxAnnualizationSource: rawRecord.taxAnnualizationSource || "",
          remarks: rawRecord.remarks || "Read-only payroll record view",
          customPremiumValues,
          customAllowanceValues,
          customDeductionValues,
        });
      });

      const readonlyColumns = readonlyRun.records.flatMap((record) => {
        const rawRecord = record;
        return [
          ...(rawRecord.customPremiums || []).map((item: { id: string; name: string }) => ({ id: item.id || customColumnId("premium", item.name), name: item.name, category: "premium" as const })),
          ...(rawRecord.customAllowances || []).map((item: { id: string; name: string }) => ({ id: item.id || customColumnId("allowance", item.name), name: item.name, category: "allowance" as const })),
          ...(rawRecord.customDeductions || []).map((item: { id: string; name: string }) => ({ id: item.id || customColumnId("deduction", item.name), name: item.name, category: "deduction" as const })),
        ];
      });

      const uniqueColumns = Array.from(new Map(readonlyColumns.map((column) => [column.id, column])).values());

      const savedById: Record<string, ReadonlySavedRow> = {};
      readonlyRun.records.forEach((record, index) => {
        const rowId = record.id || `readonly-${index}`;
        const num = (value: number | undefined) => Number(value) || 0;
        const employeeContrib = record.totalGovtEmployeeContrib ?? (num(record.sssEe) + num(record.philhealthEe) + num(record.pagibigEe));
        const employerContrib = record.totalGovtEmployerContrib ?? record.employerContributions ?? (num(record.sssEr) + num(record.philhealthEr) + num(record.pagibigEr));
        savedById[rowId] = {
          calculation: {
            basicPay: num(record.basicPay),
            nightDifferentialAmount: num(record.nightDifferentialAmount),
            overtimeAmount: num(record.overtimeAmount),
            restDayAmount: num(record.restDayAmount),
            specialHolidayAmount: num(record.specialHolidayAmount),
            totalPayrollPremium: num(record.totalPayrollPremium),
            totalAllowances: num(record.totalAllowances),
            allowanceProrationDeduction: num(record.allowanceProrationDeduction),
            totalAbsences: num(record.totalAbsences),
            grossPay: num(record.grossPay),
            nonTaxableDMB: num(record.nonTaxableDMB),
            excessDMBTo90k: num(record.excessDMBTo90k),
            taxableDMBAfter90k: num(record.taxableDMBAfter90k),
            taxableIncome: num(record.taxableIncome),
            withholdingTax: num(record.withholdingTax),
            totalGovtEmployeeContrib: employeeContrib,
            totalGovtEmployerContrib: employerContrib,
            totalDeductions: num(record.totalDeductions),
            netPay: num(record.netPay),
            customDeductionsTotal: num(record.customDeductionsTotal),
          },
          standingAllowanceLines: record.standingAllowanceLines || [],
          loanDeductions: record.loanDeductions || [],
          oneTimeCredits: record.oneTimeCredits || [],
          oneTimeDeductions: record.oneTimeDeductions || [],
          importedAttendance: record.importedAttendance,
          specialItems: record.specialItems || [],
          adjustedBase: num(record.basicPay),
          employerContributions: employerContrib,
        };
      });

      setReadonlyRunRecords(readonlyRun.records);
      setReadonlyRunMeta({
        period: readonlyRun.records[0]?.payrollPeriod || "",
        payDate: readonlyRun.records[0]?.payrollDate || readonlyRun.payrollDate || "",
      });
      setReadonlyPayrollRunTitle(readonlyRun.title || "Detailed Payroll Run");
      setCustomColumns(uniqueColumns);
      setReadonlySavedById(savedById);
      setBulkRows(readonlyRows);
      setCurrentPage(1);
    }

    loadReadonlyRun();
  }, [isReadonlyPayrollRunView]);

  const getEmployeeByNo = (employeeNo: string) => employees.find((employee) => employee.employeeNo === employeeNo) || null;
  const selectedCutoffDefinition = useMemo(
    () => cutoffDefinitions.find((cutoff) => cutoff.id === payrollPeriod) || cutoffDefinitions[0],
    [cutoffDefinitions, payrollPeriod]
  );

  const availableCutoffIdentities = useMemo(
    () => cutoffDefinitions.map((definition) => resolveCutoffIdentity(definition, monthYear, payrollDate)),
    [cutoffDefinitions, monthYear, payrollDate]
  );

  const cutoffIdentity = useMemo<PayrollCutoffIdentity>(
    () => resolveCutoffIdentity(selectedCutoffDefinition, monthYear, payrollDate),
    [monthYear, payrollDate, selectedCutoffDefinition]
  );

  const loadedEmployeeIds = useMemo(() => new Set(bulkRows.map((row) => row.employeeNo).filter(Boolean)), [bulkRows]);
  const hasLoadedEmployees = loadedEmployeeIds.size > 0;
  const globalRuleNotes = useMemo(
    () => specialItems.filter((item) => item.category === "GLOBAL_RULE"),
    [specialItems]
  );

  const attendanceByEmployeeId = useMemo(() => {
    const map = new Map<string, PayrollAttendanceRow>();
    (payrollComputationImport?.attendanceRows || []).forEach((row) => map.set(normalizeEmployeeId(row.employeeId), row));
    return map;
  }, [payrollComputationImport]);

  const buildPipelineForRow = (row: BulkPayrollRow) => {
    const employee = getEmployeeByNo(row.employeeNo);
    if (!employee) return null;

    return runPayrollPipeline({
      employee,
      specialItems,
      attendanceRow: attendanceByEmployeeId.get(normalizeEmployeeId(employee.employeeNo)),
      standingAllowances,
      payrollLoans,
      deMinimisBenefits,
      cutoffIdentity: {
        ...cutoffIdentity,
        monthYear: row.monthYear || monthYear,
        cutoff: row.payrollPeriod || cutoffIdentity.cutoff,
        payDate: row.payrollDate || payrollDate,
        payrollDate: row.payrollDate || payrollDate,
      },
    });
  };

  // Resolve the row's calculation. In view mode, prefer the totals saved with the run; only fall
  // back to recomputing when a saved snapshot is missing (e.g. legacy records).
  const resolveRowCalculation = (
    row: BulkPayrollRow,
    employee: EmployeeRecord | null,
    pipeline: PayrollPipelineResult | null
  ): Calculation => {
    if (isReadonlyPayrollRunView) {
      const saved = readonlySavedById[row.id];
      if (saved) return saved.calculation;
    }
    const importedAttendance = employee ? attendanceByEmployeeId.get(normalizeEmployeeId(employee.employeeNo)) : undefined;
    return calculateRow(
      employee && pipeline ? { ...employee, basicPay: pipeline.adjustedBase } : employee,
      row,
      pipeline ? {
        standingAllowanceLines: pipeline.standingAllowanceLines,
        deMinimisLines: pipeline.deMinimisLines,
        loanDeductions: pipeline.loanDeductionLines,
        oneTimeCredits: pipeline.oneTimeCreditLines,
        oneTimeDeductions: pipeline.oneTimeDeductionLines,
        importedAttendance,
      } : { importedAttendance }
    );
  };

  const formatValidationErrors = (errors: ValidationError[]) =>
    errors.map((error) => `${error.sheet} row ${error.row}, ${error.field}: ${error.message}`).join("\n");

  const startImportProgress = (kind: ImportProgressKind, label: string) => {
    if (importSuccessTimerRef.current) clearTimeout(importSuccessTimerRef.current);
    setImportSuccessMessage("");
    setImportProgress({ kind, label });
  };

  const updateImportProgress = (label: string) => {
    setImportProgress((current) => current ? { ...current, label } : current);
  };

  const finishImportProgress = (message = "") => {
    setImportProgress(null);
    if (!message) return;

    setImportSuccessMessage(message);
    importSuccessTimerRef.current = setTimeout(() => setImportSuccessMessage(""), 3500);
  };

  const importError = (sheet: string, field: string, message: string): ValidationError => ({
    sheet,
    row: 1,
    field,
    message,
  });

  const handleSpecialItemsToggle = (enabled: boolean) => {
    setHasSpecialItemsThisCutoff(enabled);
    setSpecialItemsDecisionMade(true);
    setSpecialItemsErrors([]);
    if (!enabled) {
      setSpecialItems([]);
    }
  };

  const importSpecialItemsWorkbook = async (file: File | null) => {
    if (!file) return;
    if (!hasLoadedEmployees) {
      pendingSpecialItemsWorkbookRef.current = file;
      if (importProgress?.kind === "load-employees") {
        updateImportProgress("Loading employees first…");
      } else if (employees.length > 0) {
        loadEmployees();
      } else {
        startImportProgress("load-employees", "Loading employees first…");
      }
      return;
    }
    if (isImportBusy) {
      pendingSpecialItemsWorkbookRef.current = file;
      return;
    }
    if (!cutoffIdentity.cutoff) {
      setSpecialItemsErrors([importError("SpecialItems", "runCutoff", "Please select the run cutoff before importing special items.")]);
      return;
    }
    startImportProgress("special-items", "Reading workbook…");
    setIsImportingSpecialItems(true);
    setSpecialItemsErrors([]);
    try {
      updateImportProgress("Validating…");
      const result = await parseSpecialItemsWorkbook(file, loadedEmployeeIds, cutoffIdentity);
      updateImportProgress("Matching rows to employees…");
      setSpecialItemsErrors(result.errors);
      if (result.errors.length > 0) {
        setSpecialItems([]);
        finishImportProgress();
      } else {
        updateImportProgress("Binding imported values to run…");
        setSpecialItems(result.items);
        setSpecialItemsDecisionMade(true);
        setHasSpecialItemsThisCutoff(true);
        finishImportProgress(`Imported ${result.items.length} special item row${result.items.length === 1 ? "" : "s"}`);
      }
    } catch {
      setSpecialItems([]);
      setSpecialItemsErrors([importError("SpecialItems", "file", "Unable to read the Special Items workbook. Please upload a valid .xlsx file.")]);
      finishImportProgress();
    } finally {
      setIsImportingSpecialItems(false);
    }
  };

  const importPayrollComputationWorkbook = async (file: File | null) => {
    if (!file) return;
    if (!hasLoadedEmployees) {
      pendingPayrollWorkbookRef.current = file;
      if (importProgress?.kind === "load-employees") {
        updateImportProgress("Loading employees first…");
      } else if (employees.length > 0) {
        loadEmployees();
      } else {
        startImportProgress("load-employees", "Loading employees first…");
      }
      return;
    }
    if (isImportBusy) {
      pendingPayrollWorkbookRef.current = file;
      return;
    }
    startImportProgress("payroll-computation", "Reading workbook…");
    setIsImportingPayrollComputation(true);
    setPayrollComputationErrors([]);
    try {
      updateImportProgress("Validating…");
      const result = await parsePayrollComputationWorkbook(file, loadedEmployeeIds, cutoffIdentity, availableCutoffIdentities);
      updateImportProgress("Matching rows to employees…");
      setPayrollComputationErrors(result.errors);
      if (result.errors.length > 0) {
        setPayrollComputationImport(null);
        finishImportProgress();
      } else {
        updateImportProgress("Binding imported values to table…");
        setPayrollComputationImport({
          attendanceRows: result.attendanceRows,
        });
        finishImportProgress(`Imported ${result.attendanceRows.length} attendance row${result.attendanceRows.length === 1 ? "" : "s"}`);
      }
    } catch {
      setPayrollComputationImport(null);
      setPayrollComputationErrors([importError("PayrollComputation", "file", "Unable to read the Payroll Computation workbook. Please upload a valid .xlsx file.")]);
      finishImportProgress();
    } finally {
      setIsImportingPayrollComputation(false);
    }
  };

  useEffect(() => {
    if (importProgress || !hasLoadedEmployees) return;

    const queuedSpecialItemsWorkbook = pendingSpecialItemsWorkbookRef.current;
    if (queuedSpecialItemsWorkbook) {
      pendingSpecialItemsWorkbookRef.current = null;
      window.setTimeout(() => importSpecialItemsWorkbook(queuedSpecialItemsWorkbook), 0);
      return;
    }

    const queuedPayrollWorkbook = pendingPayrollWorkbookRef.current;
    if (queuedPayrollWorkbook) {
      pendingPayrollWorkbookRef.current = null;
      window.setTimeout(() => importPayrollComputationWorkbook(queuedPayrollWorkbook), 0);
    }
  }, [hasLoadedEmployees, importProgress, importPayrollComputationWorkbook, importSpecialItemsWorkbook]);

  const getDefaultGovt = (employee: EmployeeRecord) => {
    const monthlyPay = employee.basicPay;
    const sss = computeSssContributionFromMonthlyPay(monthlyPay);
    const philhealthMonthly = Math.min(Math.max(monthlyPay, 10000), 100000) * 0.05;
    const pagibig = computePagibigContributionFromMonthlyPay();
    const factor = contributionFactor;

    return {
      sssMonthlySalaryCredit: String(sss.monthlySalaryCredit),
      sssRegularEe: String(sss.sssRegularEe / factor),
      sssRegularEr: String(sss.sssRegularEr / factor),
      sssWispEe: String(sss.sssWispEe / factor),
      sssWispEr: String(sss.sssWispEr / factor),
      sssEc: String(sss.sssEc / factor),
      sssEe: String(sss.sssEe / factor),
      sssEr: String(sss.sssEr / factor),
      philhealthEe: String(philhealthMonthly / 2 / factor),
      philhealthEr: String(philhealthMonthly / 2 / factor),
      pagibigEe: String(pagibig.pagibigEe),
      pagibigEr: String(pagibig.pagibigEr),
    };
  };

  const getDefaultAllowances = (employee: EmployeeRecord) => {
    const factor = contributionFactor;
    const allowanceFrequency = (field: string) => normalizeAllowanceFrequency(employee.allowanceFrequencies?.[field]);
    const allowanceAmount = (amount: number, field: string) => String(getAllowancePerPayrollPeriod(amount, allowanceFrequency(field), employee, factor));

    return {
      riceSubsidy: allowanceAmount(Number(employee.riceSubsidy) || 0, "riceSubsidy"),
      uniformClothing: allowanceAmount(Number(employee.uniformClothingAllowance) || 0, "uniformClothingAllowance"),
      laundryAllowance: allowanceAmount(Number(employee.laundryAllowance) || 0, "laundryAllowance"),
      medicalCashDependents: allowanceAmount(Number(employee.medicalCashAllowanceToDependents) || 0, "medicalCashAllowanceToDependents"),
      actualMedicalAssistance: allowanceAmount(Number(employee.actualMedicalAssistance) || 0, "actualMedicalAssistance"),
      achievementAwards: allowanceAmount(Number(employee.achievementAwards) || 0, "achievementAwards"),
      christmasAnniversaryGifts: allowanceAmount(Number(employee.christmasAnniversaryGifts) || 0, "christmasAnniversaryGifts"),
      mealAllowanceOTNight: allowanceAmount(Number(employee.mealAllowance) || 0, "mealAllowance"),
      thirteenthMonthPay: allowanceAmount(Number(employee.thirteenthMonthPay) || 0, "thirteenthMonthPay"),
      christmasBonus: allowanceAmount(Number(employee.christmasBonus) || 0, "christmasBonus"),
      otherTaxableAllowances: String((Number(employee.otherAllowanceAmount) || 0) / factor),
    };
  };

  const getDefaultCustomPayrollValues = (employee: EmployeeRecord) => {
    const factor = contributionFactor;

    const customPremiumValues = Object.fromEntries(
      (employee.customPremiums || []).map((item) => [customColumnId("premium", item.name), String((Number(item.amount) || 0) / factor)])
    );

    const customAllowanceValues = Object.fromEntries(
      (employee.customAllowances || []).map((item) => [customColumnId("allowance", item.name), String(getCustomAllowancePerPayrollPeriod(item, employee, factor))])
    );

    const customDeductionValues = Object.fromEntries(
      (employee.customDeductions || []).map((item) => [customColumnId("deduction", item.name), String((Number(item.amount) || 0) / factor)])
    );

    return {
      customPremiumValues,
      customAllowanceValues,
      customDeductionValues,
    };
  };

  const buildRowForEmployee = (employee: EmployeeRecord, index: number) => {
    const govt = getDefaultGovt(employee);
    const defaultAllowances = getDefaultAllowances(employee);
    const defaultCustomPayrollValues = getDefaultCustomPayrollValues(employee);
    return buildBlankRow({
      id: `${employee.employeeNo}-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
      employeeNo: employee.employeeNo,
      monthYear,
      payrollDate,
      payrollPeriod: payrollPeriod || payrollPeriodOptions[0]?.value || "",
      ...defaultAllowances,
      ...defaultCustomPayrollValues,
      ...govt,
    });
  };

  const calculateRow = (
    employee: EmployeeRecord | null,
    row: BulkPayrollRow,
    inputs: PayrollCalculationInputs = {}
  ): Calculation => {
    if (!employee) {
      return {
        basicPay: 0,
        nightDifferentialAmount: 0,
        overtimeAmount: 0,
        restDayAmount: 0,
        specialHolidayAmount: 0,
        totalPayrollPremium: 0,
        totalAllowances: 0,
        totalAbsences: 0,
        allowanceProrationDeduction: 0,
        grossPay: 0,
        nonTaxableDMB: 0,
        excessDMBTo90k: 0,
        taxableDMBAfter90k: 0,
        taxableIncome: 0,
        withholdingTax: 0,
        totalGovtEmployeeContrib: 0,
        totalGovtEmployerContrib: 0,
        totalDeductions: 0,
        netPay: 0,
        customDeductionsTotal: 0,
      };
    }

    const proration = getProrationInfo(employee, row, inputs.importedAttendance);
    // Payroll Type B prorates monthly-recurring allowances and de-minimis benefits on absences too;
    // Type A prorates basic pay only. The legacy deductAllowanceOnAbsence flag still forces proration.
    const prorateAllowances = employee.payrollRunType === "B" || employee.deductAllowanceOnAbsence;
    const allowanceProration = prorateAllowances ? proration : { isActive: false, hoursAbsent: 0, totalMonthlyHours: 0, rate: 1 };
    const fullBasicPay = getBasicPayPerPayrollPeriod(employee, contributionFactor);
    const basicPay = proratePayrollPeriodAmount(fullBasicPay, proration);
    const hourlyRate = getEmployeeHourlyRate(employee);
    const nightDifferentialAmount = readNumber(row.nightDiffHours) * hourlyRate * 0.1;
    const overtimeAmount = readNumber(row.overtimeHours) * hourlyRate * 1.25;
    const restDayAmount = readNumber(row.restDayHours) * hourlyRate * 1.3;
    const specialHolidayAmount = readNumber(row.specialHolidayHours) * hourlyRate * 1.3;
    const customPremiumsTotal = Object.values(row.customPremiumValues || {}).reduce((sum, value) => sum + readNumber(value), 0);
    const totalPayrollPremium = nightDifferentialAmount + overtimeAmount + restDayAmount + specialHolidayAmount + customPremiumsTotal;
    const totalAbsences = fullBasicPay - basicPay;

    // Allowances are stored at their FULL (unadjusted) value; for Payroll Type B the whole allowance
    // pool is prorated once via allowanceProrationDeduction below, so gross/taxable use the adjusted total.
    const rice = readNumber(row.riceSubsidy);
    const uniform = readNumber(row.uniformClothing);
    const laundry = readNumber(row.laundryAllowance);
    const medDependents = readNumber(row.medicalCashDependents);
    const actualMedical = readNumber(row.actualMedicalAssistance);
    const awards = readNumber(row.achievementAwards);
    const gifts = readNumber(row.christmasAnniversaryGifts);
    const meal = readNumber(row.mealAllowanceOTNight);
    const leave = readNumber(row.monetizedLeavePrivate);
    const cba = readNumber(row.cbaProductivityIncentives);
    const thirteenth = readNumber(row.thirteenthMonthPay);
    const christmasBonus = readNumber(row.christmasBonus);
    const otherTaxable = readNumber(row.otherTaxableAllowances);
    const customAllowancesTotal = Object.values(row.customAllowanceValues || {}).reduce((sum, value) => sum + readNumber(value), 0);

    const totalDeMinimisEntered = rice + uniform + laundry + medDependents + actualMedical + awards + gifts + cba;
    const nonTaxableDMB = Math.min(rice, 1000) + Math.min(uniform, 3500) + Math.min(laundry, 150) + Math.min(medDependents, 125) + Math.min(actualMedical, 5000) + Math.min(awards, 5000) + Math.min(gifts, 2500) + Math.min(cba, 5000);
    const amountSubjectTo90k = Math.max(totalDeMinimisEntered - nonTaxableDMB, 0) + meal + leave + thirteenth + christmasBonus + otherTaxable + customAllowancesTotal;
    const excessDMBTo90k = Math.min(amountSubjectTo90k, 90000);
    const taxableDMBAfter90k = Math.max(amountSubjectTo90k - 90000, 0);
    const standingAllowancesTotal = (inputs.standingAllowanceLines || []).reduce((sum, line) => sum + line.amount, 0);
    const deMinimisLinesTotal = (inputs.deMinimisLines || []).reduce((sum, line) => sum + line.amount, 0);
    // Unadjusted (full) allowance pool — every allowance, before any Payroll Type B proration.
    const totalAllowances = totalDeMinimisEntered + meal + leave + thirteenth + christmasBonus + otherTaxable + customAllowancesTotal + standingAllowancesTotal + deMinimisLinesTotal;

    // Payroll Type B prorates the ENTIRE allowance pool on absences/late/undertime. One deduction is
    // applied to the unadjusted total; the adjusted total is what actually feeds gross and taxable income.
    const allowanceProrationDeduction = allowanceProration.isActive
      ? Math.max(0, (1 - allowanceProration.rate) * totalAllowances)
      : 0;
    const totalAllowancesAdjusted = Math.max(0, totalAllowances - allowanceProrationDeduction);

    const totalGovtEmployeeContrib = readNumber(row.sssEe) + readNumber(row.philhealthEe) + readNumber(row.pagibigEe);
    const totalGovtEmployerContrib = readNumber(row.sssEr) + readNumber(row.philhealthEr) + readNumber(row.pagibigEr);
    const grossPay = basicPay + totalPayrollPremium + totalAllowancesAdjusted;
    const taxableIncome = Math.max(grossPay - nonTaxableDMB - excessDMBTo90k - totalGovtEmployeeContrib, 0);
    const withholdingTax = computeWithholdingTaxByFrequency(taxableIncome, payrollFrequency);
    const customDeductionsTotal = Object.values(row.customDeductionValues || {}).reduce((sum, value) => sum + readNumber(value), 0);
    const loanDeductionTotal = (inputs.loanDeductions || []).reduce((sum, line) => sum + line.amount, 0);
    const oneTimeCreditTotal = (inputs.oneTimeCredits || []).reduce((sum, item) => sum + item.amount, 0);
    const oneTimeDeductionTotal = (inputs.oneTimeDeductions || []).reduce((sum, item) => sum + item.amount, 0);
    const otherDeductions = readNumber(row.employeeAdvances) + readNumber(row.cashAdvances) + readNumber(row.sssLoanRepayment) + readNumber(row.hdmfLoanRepayment) + customDeductionsTotal + loanDeductionTotal + oneTimeDeductionTotal;
    const totalDeductions = totalGovtEmployeeContrib + withholdingTax + otherDeductions;
    const taxAnnualizationAmount = readNumber(row.taxAnnualizationAdjustment);
    const taxAdjustmentSigned = row.taxAnnualizationType === "Refund" ? taxAnnualizationAmount : row.taxAnnualizationType === "Additional Deduction" ? -taxAnnualizationAmount : 0;
    const netPay = Math.max(0, grossPay - totalDeductions + taxAdjustmentSigned + oneTimeCreditTotal);

    return {
      basicPay,
      nightDifferentialAmount,
      overtimeAmount,
      restDayAmount,
      specialHolidayAmount,
      totalPayrollPremium,
      totalAllowances,
      totalAbsences,
      allowanceProrationDeduction,
      grossPay,
      nonTaxableDMB,
      excessDMBTo90k,
      taxableDMBAfter90k,
      taxableIncome,
      withholdingTax,
      totalGovtEmployeeContrib,
      totalGovtEmployerContrib,
      totalDeductions,
      netPay,
      customDeductionsTotal,
    };
  };

  const askAmountAndScope = (fieldLabel: string, currentValue: string): { amount: string; scope: Scope } | null => {
    const amountAnswer = window.prompt(
      `${fieldLabel}\n\nEnter the amount to apply.`,
      currentValue || "0"
    );

    if (amountAnswer === null) return null;

    const normalizedAmount = String(readNumber(amountAnswer));

    const scopeAnswer = window.prompt(
      `${fieldLabel}\nAmount to apply: ${formatCurrency(readNumber(normalizedAmount))}\n\nApply this change to:\n1 - This employee only\n2 - All loaded employees\n3 - Same department\n4 - Same employee group/classification\n5 - Same employee type\n6 - Same MWE status\n\nType 1, 2, 3, 4, 5, or 6.`,
      "1"
    );

    if (scopeAnswer === null) return null;

    if (scopeAnswer === "2") return { amount: normalizedAmount, scope: "all" };
    if (scopeAnswer === "3") return { amount: normalizedAmount, scope: "department" };
    if (scopeAnswer === "4") return { amount: normalizedAmount, scope: "classification" };
    if (scopeAnswer === "5") return { amount: normalizedAmount, scope: "employeeType" };
    if (scopeAnswer === "6") return { amount: normalizedAmount, scope: "mwe" };
    return { amount: normalizedAmount, scope: "single" };
  };

  const getTargetRowIds = (sourceRow: BulkPayrollRow, scope: Scope) => {
    const sourceEmployee = getEmployeeByNo(sourceRow.employeeNo);
    if (scope === "single" || !sourceEmployee) return [sourceRow.id];
    if (scope === "all") return bulkRows.map((row) => row.id);

    return bulkRows
      .filter((row) => {
        const employee = getEmployeeByNo(row.employeeNo);
        if (!employee) return false;
        if (scope === "department") return employee.department === sourceEmployee.department;
        if (scope === "classification") return employee.employmentClassification === sourceEmployee.employmentClassification;
        if (scope === "employeeType") return employee.employeeType === sourceEmployee.employeeType;
        if (scope === "mwe") return employee.isMinimumWageEarner === sourceEmployee.isMinimumWageEarner;
        return row.id === sourceRow.id;
      })
      .map((row) => row.id);
  };

  const updateRowDirect = (rowId: string, field: keyof BulkPayrollRow, value: string) => {
    setBulkRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [field]: value };

        if (field === "employeeNo") {
          const employee = getEmployeeByNo(value);
          if (!employee) return buildBlankRow({ ...nextRow, employeeNo: value });
          return {
            ...nextRow,
            employeeNo: employee.employeeNo,
            ...getDefaultAllowances(employee),
            ...getDefaultCustomPayrollValues(employee),
            ...getDefaultGovt(employee),
          };
        }

        const fieldsAffectingGovt: (keyof BulkPayrollRow)[] = ["nightDiffHours", "overtimeHours", "restDayHours", "specialHolidayHours", "riceSubsidy", "uniformClothing", "laundryAllowance", "medicalCashDependents", "actualMedicalAssistance", "achievementAwards", "christmasAnniversaryGifts", "mealAllowanceOTNight", "monetizedLeavePrivate", "cbaProductivityIncentives", "thirteenthMonthPay", "christmasBonus", "otherTaxableAllowances"];
        if (fieldsAffectingGovt.includes(field)) {
          const employee = getEmployeeByNo(nextRow.employeeNo);
          return employee ? { ...nextRow, ...getDefaultGovt(employee) } : nextRow;
        }

        return nextRow;
      })
    );
  };

  const updateEmployeeCustomColumns = (employeeNo: string) => {
    const employee = getEmployeeByNo(employeeNo);
    if (!employee) return;
    setCustomColumns((currentColumns) => mergeCustomColumns(currentColumns, [employee]));
  };

  const updateRowWithScope = (rowId: string, field: keyof BulkPayrollRow, value: string) => {
    const sourceRow = bulkRows.find((row) => row.id === rowId);
    if (!sourceRow) return;

    const alwaysSingleFields: (keyof BulkPayrollRow)[] = ["employeeNo", "remarks", "monthYear", "payrollDate", "payrollPeriod", "taxAnnualizationType", "taxAnnualizationYear", "taxAnnualizationSource", "absencesHours"];

    if (alwaysSingleFields.includes(field)) {
      updateRowDirect(rowId, field, value);
      return;
    }

    const amountAndScope = askAmountAndScope(String(field), value);
    if (!amountAndScope) return;

    const targetIds = getTargetRowIds(sourceRow, amountAndScope.scope);
    targetIds.forEach((targetId) => updateRowDirect(targetId, field, amountAndScope.amount));
  };

  const updateCustomDirect = (rowId: string, category: BulkCustomColumnCategory, columnId: string, value: string) => {
    const valueKey = category === "premium" ? "customPremiumValues" : category === "allowance" ? "customAllowanceValues" : "customDeductionValues";

    setBulkRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [valueKey]: {
                ...row[valueKey],
                [columnId]: value,
              },
            }
          : row
      )
    );
  };

  const updateCustomWithScope = (rowId: string, category: BulkCustomColumnCategory, columnId: string, value: string) => {
    const sourceRow = bulkRows.find((row) => row.id === rowId);
    if (!sourceRow) return;

    const columnName = customColumns.find((column) => column.id === columnId)?.name || columnId;
    const amountAndScope = askAmountAndScope(columnName, value);
    if (!amountAndScope) return;

    const targetIds = getTargetRowIds(sourceRow, amountAndScope.scope);
    targetIds.forEach((targetId) => updateCustomDirect(targetId, category, columnId, amountAndScope.amount));
  };

  const getEmployeesToLoad = () => {
    return employees.filter((employee) => {
      if (loadFilterType === "all") return true;
      if (!loadFilterValue) return true;
      if (loadFilterType === "department") return employee.department === loadFilterValue;
      if (loadFilterType === "classification") return employee.employmentClassification === loadFilterValue;
      if (loadFilterType === "employeeType") return employee.employeeType === loadFilterValue;
      if (loadFilterType === "mwe") return employee.isMinimumWageEarner === loadFilterValue;
      return true;
    });
  };

  const loadEmployeesIntoRows = (sourceEmployees: EmployeeRecord[], options: { resetImports?: boolean } = {}) => {
    const employeesToLoad = sourceEmployees.filter((employee) => {
      if (loadFilterType === "all") return true;
      if (!loadFilterValue) return true;
      if (loadFilterType === "department") return employee.department === loadFilterValue;
      if (loadFilterType === "classification") return employee.employmentClassification === loadFilterValue;
      if (loadFilterType === "employeeType") return employee.employeeType === loadFilterValue;
      if (loadFilterType === "mwe") return employee.isMinimumWageEarner === loadFilterValue;
      return true;
    });

    setCustomColumns((currentColumns) => mergeCustomColumns(currentColumns, employeesToLoad));
    setBulkRows(employeesToLoad.map((employee, index) => buildRowForEmployee(employee, index)));

    if (options.resetImports !== false) {
      setSpecialItems([]);
      setSpecialItemsErrors([]);
      setSpecialItemsDecisionMade(false);
      setHasSpecialItemsThisCutoff(false);
      setPayrollComputationImport(null);
      setPayrollComputationErrors([]);
    }

    setCurrentPage(1);
    return employeesToLoad.length;
  };

  const loadEmployees = () => {
    if (isImportBusy) return;

    startImportProgress("load-employees", "Loading employees…");
    setCsvImportErrors([]);

    window.setTimeout(() => {
      try {
        updateImportProgress("Binding employees to table…");
        const loadedCount = loadEmployeesIntoRows(employees);
        finishImportProgress(`Loaded ${loadedCount} employee row${loadedCount === 1 ? "" : "s"}`);
      } catch {
        setCsvImportErrors([importError("LoadEmployees", "employees", "Unable to load employees for the selected filter.")]);
        finishImportProgress();
      }
    }, 0);
  };

  useEffect(() => {
    if (isReadonlyPayrollRunView) return;
    if (autoLoadAttemptedRef.current) return;
    if (bulkRows.length > 0) return;
    if (employees.length === 0) return;

    autoLoadAttemptedRef.current = true;
    startImportProgress("load-employees", "Loading employees…");
    setCsvImportErrors([]);

    window.setTimeout(() => {
      try {
        updateImportProgress("Binding employees to table…");
        const loadedCount = loadEmployeesIntoRows(employees);
        finishImportProgress(`Loaded ${loadedCount} employee row${loadedCount === 1 ? "" : "s"}`);
      } catch {
        setCsvImportErrors([importError("LoadEmployees", "employees", "Unable to auto-load employees.")]);
        finishImportProgress();
      }
    }, 0);
  }, [bulkRows.length, employees, isReadonlyPayrollRunView]);

  const addRow = () => {
    const defaultEmployee = employees[0];
    if (defaultEmployee) {
      setCustomColumns((currentColumns) => mergeCustomColumns(currentColumns, [defaultEmployee]));
    }
    setBulkRows((current) => [...current, defaultEmployee ? buildRowForEmployee(defaultEmployee, current.length) : buildBlankRow({ monthYear, payrollDate, payrollPeriod })]);
  };

  const addCustomColumn = () => {
    const name = newColumnName.trim();
    if (!name) {
      window.alert("Please enter a custom column name.");
      return;
    }

    if (newColumnScope !== "all" && !newColumnScopeValue) {
      window.alert("Please select where this custom column amount should be added.");
      return;
    }

    const column: BulkCustomColumn = {
      id: `bulk-${newColumnCategory}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      category: newColumnCategory,
    };

    const valueKey = newColumnCategory === "premium" ? "customPremiumValues" : newColumnCategory === "allowance" ? "customAllowanceValues" : "customDeductionValues";
    const amountToApply = String(readNumber(newColumnAmount));

    setCustomColumns((current) => [...current, column]);
    setBulkRows((current) =>
      current.map((row) => {
        const employee = getEmployeeByNo(row.employeeNo);
        const shouldApply = (() => {
          if (newColumnScope === "all") return true;
          // if (newColumnScope === "single") return false;
          if (!employee) return false;
          if (newColumnScope === "department") return employee.department === newColumnScopeValue;
          if (newColumnScope === "classification") return employee.employmentClassification === newColumnScopeValue;
          if (newColumnScope === "employeeType") return employee.employeeType === newColumnScopeValue;
          if (newColumnScope === "mwe") return employee.isMinimumWageEarner === newColumnScopeValue;
          return false;
        })();

        return {
          ...row,
          [valueKey]: {
            ...row[valueKey],
            [column.id]: shouldApply ? amountToApply : "0",
          },
        };
      })
    );
    setNewColumnName("");
    setNewColumnAmount("0");
    setNewColumnScope("all");
    setNewColumnScopeValue("");
  };

  const removeCustomColumn = (category: BulkCustomColumnCategory, columnId: string) => {
    const confirmed = window.confirm("Remove this custom column from all rows?");
    if (!confirmed) return;

    const valueKey = category === "premium" ? "customPremiumValues" : category === "allowance" ? "customAllowanceValues" : "customDeductionValues";
    setCustomColumns((current) => current.filter((column) => column.id !== columnId));
    setBulkRows((current) =>
      current.map((row) => {
        const nextValues = { ...row[valueKey] };
        delete nextValues[columnId];
        return { ...row, [valueKey]: nextValues };
      })
    );
  };

  const removeStandardAllowanceForRun = () => {
    if (bulkRows.length === 0) {
      window.alert("Please load employees first before removing an allowance from this payroll run.");
      return;
    }

    if (removeAllowanceScope !== "all" && !removeAllowanceScopeValue) {
      window.alert("Please select where this allowance should be removed.");
      return;
    }

    const allowanceLabel = STANDARD_ALLOWANCE_FIELDS.find((item) => item.field === allowanceToRemove)?.label || "Allowance";
    const confirmed = window.confirm(
      `Remove ${allowanceLabel} from the selected rows for this payroll run? This will set the selected allowance to zero only in the current payroll table.`
    );

    if (!confirmed) return;

    setBulkRows((current) =>
      current.map((row) => {
        const employee = getEmployeeByNo(row.employeeNo);
        const shouldRemove = (() => {
          if (removeAllowanceScope === "all") return true;
          if (!employee) return false;
          if (removeAllowanceScope === "department") return employee.department === removeAllowanceScopeValue;
          if (removeAllowanceScope === "classification") return employee.employmentClassification === removeAllowanceScopeValue;
          if (removeAllowanceScope === "employeeType") return employee.employeeType === removeAllowanceScopeValue;
          if (removeAllowanceScope === "mwe") return employee.isMinimumWageEarner === removeAllowanceScopeValue;
          return false;
        })();

        return shouldRemove ? { ...row, [allowanceToRemove]: "0" } : row;
      })
    );
  };

  const downloadCsvTemplate = () => {
    const headers = [
      "Employee No",
      "Employee Name",
      "Month Year",
      "Payroll Date",
      "Payroll Period",
      "Monthly Basic Pay",
      "Suggested Basic Pay for Cutoff",
      "Night Diff Hours",
      "Overtime Hours",
      "Rest Day Hours",
      "Special Holiday Hours",
      "Absences Hours",
      "Rice Subsidy",
      "Uniform Clothing",
      "Laundry Allowance",
      "Medical Cash Dependents",
      "Actual Medical Assistance",
      "Achievement Awards",
      "Christmas Anniversary Gifts",
      "Meal Allowance OT Night",
      "Monetized Leave Private",
      "CBA Productivity Incentives",
      "13th Month Pay",
      "Christmas Bonus",
      "Other Taxable Allowances",
      "Payroll Advances",
      "Cash Advances",
      "SSS Loan Repayment",
      "HDMF Loan Repayment",
      ...premiumColumns.map((column) => `PREMIUM: ${column.name}`),
      ...allowanceColumns.map((column) => `ALLOWANCE: ${column.name}`),
      ...deductionColumns.map((column) => `DEDUCTION: ${column.name}`),
    ];

    const rows = getEmployeesToLoad().map((employee) => {
      const suggestedBasic = employee.basicPay / contributionFactor;
      return [
        employee.employeeNo,
        employee.name,
        monthYear,
        payrollDate,
        payrollPeriod || payrollPeriodOptions[0]?.value || "",
        employee.basicPay.toFixed(2),
        suggestedBasic.toFixed(2),
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        "0.00",
        ...customColumns.map(() => "0.00"),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bulk-payroll-template-${monthYear || "month-year"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importCsvTemplate = (file: File | null) => {
    if (!file || isImportBusy) return;

    startImportProgress("csv", "Reading CSV…");
    setCsvImportErrors([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        updateImportProgress("Validating…");
        const content = String(reader.result || "");
        const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

        if (lines.length <= 1) {
          setCsvImportErrors([importError("CSV", "file", "The uploaded CSV has no payroll rows.")]);
          finishImportProgress();
          return;
        }

        const headers = parseCsvLine(lines[0]);
        const getCell = (cells: string[], ...names: string[]) => {
          const normalizedNames = names.map(normalizeHeader);
          const index = headers.findIndex((header) => normalizedNames.includes(normalizeHeader(header)));
          return index >= 0 ? String(cells[index] || "").trim() : "";
        };

        const csvCustomColumns = headers.map((header, index) => parseCustomCsvHeader(header, index)).filter(Boolean) as {
          index: number;
          id: string;
          name: string;
          category: BulkCustomColumnCategory;
        }[];

        const nextColumns: BulkCustomColumn[] = csvCustomColumns.map((column) => ({
          id: column.id,
          name: column.name,
          category: column.category,
        }));

        const importedRows = lines.slice(1).map((line) => {
          const cells = parseCsvLine(line);
          const employeeNoFromFile = getCell(cells, "Employee No") || cells[0] || "";
          const employeeNameFromFile = getCell(cells, "Employee Name") || cells[1] || "";
          const employee =
            employees.find((item) => item.employeeNo === employeeNoFromFile) ||
            employees.find((item) => item.name.toLowerCase() === employeeNameFromFile.toLowerCase());

          const row = buildBlankRow({
            employeeNo: employee?.employeeNo || "",
            monthYear: getCell(cells, "Month Year", "Month") || monthYear,
            payrollDate: getCell(cells, "Payroll Date") || payrollDate,
            payrollPeriod: getCell(cells, "Payroll Period", "Cutoff") || payrollPeriod || payrollPeriodOptions[0]?.value || "",
            nightDiffHours: String(readNumber(getCell(cells, "Night Diff Hours") || cells[7] || "0")),
            overtimeHours: String(readNumber(getCell(cells, "Overtime Hours") || cells[8] || "0")),
            restDayHours: String(readNumber(getCell(cells, "Rest Day Hours") || cells[9] || "0")),
            specialHolidayHours: String(readNumber(getCell(cells, "Special Holiday Hours") || cells[10] || "0")),
            absencesHours: String(readNumber(getCell(cells, "Absences Hours") || cells[11] || "0")),
            riceSubsidy: String(readNumber(getCell(cells, "Rice Subsidy") || cells[12] || "0")),
            uniformClothing: String(readNumber(getCell(cells, "Uniform Clothing") || cells[13] || "0")),
            laundryAllowance: String(readNumber(getCell(cells, "Laundry Allowance") || cells[14] || "0")),
            medicalCashDependents: String(readNumber(getCell(cells, "Medical Cash Dependents") || cells[15] || "0")),
            actualMedicalAssistance: String(readNumber(getCell(cells, "Actual Medical Assistance") || cells[16] || "0")),
            achievementAwards: String(readNumber(getCell(cells, "Achievement Awards") || cells[17] || "0")),
            christmasAnniversaryGifts: String(readNumber(getCell(cells, "Christmas Anniversary Gifts", "Christmas / Anniversary Gifts", "Gifts") || cells[18] || "0")),
            mealAllowanceOTNight: String(readNumber(getCell(cells, "Meal Allowance OT Night") || cells[19] || "0")),
            monetizedLeavePrivate: String(readNumber(getCell(cells, "Monetized Leave Private") || cells[20] || "0")),
            cbaProductivityIncentives: String(readNumber(getCell(cells, "CBA Productivity Incentives") || cells[21] || "0")),
            thirteenthMonthPay: String(readNumber(getCell(cells, "13th Month Pay") || cells[22] || "0")),
            christmasBonus: String(readNumber(getCell(cells, "Christmas Bonus") || cells[23] || "0")),
            otherTaxableAllowances: String(readNumber(getCell(cells, "Other Taxable Allowances") || cells[24] || "0")),
            employeeAdvances: String(readNumber(getCell(cells, "Payroll Advances") || cells[25] || "0")),
            cashAdvances: String(readNumber(getCell(cells, "Cash Advances") || cells[26] || "0")),
            sssLoanRepayment: String(readNumber(getCell(cells, "SSS Loan Repayment") || cells[27] || "0")),
            hdmfLoanRepayment: String(readNumber(getCell(cells, "HDMF Loan Repayment") || cells[28] || "0")),
            remarks: employee ? "" : "Employee not matched. Select employee manually.",
          });

          if (employee) {
            Object.assign(row, getDefaultAllowances(employee), getDefaultCustomPayrollValues(employee), getDefaultGovt(employee));
          }

          csvCustomColumns.forEach((column) => {
            const value = String(readNumber(cells[column.index] || "0"));
            if (column.category === "premium") row.customPremiumValues[column.id] = value;
            if (column.category === "allowance") row.customAllowanceValues[column.id] = value;
            if (column.category === "deduction") row.customDeductionValues[column.id] = value;
          });

          return row;
        });

        updateImportProgress("Binding CSV rows to table…");
        const matchedEmployees = importedRows
          .map((row) => getEmployeeByNo(row.employeeNo))
          .filter((employee): employee is EmployeeRecord => Boolean(employee));
        setCustomColumns(mergeCustomColumns(nextColumns, matchedEmployees));
        setBulkRows(importedRows);
        setCurrentPage(1);
        finishImportProgress(`Imported ${importedRows.length} payroll row${importedRows.length === 1 ? "" : "s"}`);
      } catch {
        setCsvImportErrors([importError("CSV", "file", "Unable to read the CSV file. Please upload a valid CSV template.")]);
        finishImportProgress();
      }
    };

    reader.onerror = () => {
      setCsvImportErrors([importError("CSV", "file", "Unable to read the CSV file. Please upload a valid CSV template.")]);
      finishImportProgress();
    };

    reader.readAsText(file);
  };

  const savePayrollRun = async () => {
    if (!monthYear && bulkRows.some((row) => !row.monthYear)) {
      window.alert("Please select the month and year first.");
      return;
    }

    const validRows = bulkRows.filter((row) => row.employeeNo && row.payrollPeriod && (row.monthYear || monthYear));
    if (validRows.length === 0) {
      window.alert("No valid payroll rows to save.");
      return;
    }

    if (!specialItemsDecisionMade) {
      window.alert("Please choose whether this cutoff has special items before saving.");
      return;
    }

    if (specialItemsErrors.length > 0) {
      window.alert("Please fix the Special Items import errors before saving.");
      return;
    }

    if (payrollComputationErrors.length > 0) {
      window.alert("Please fix the Payroll Computation import errors before saving.");
      return;
    }

    const duplicateRows = validRows.filter((row) =>
      savedPayrollRecords.some((record) =>
        record.archiveStatus !== "Archived" &&
        record.employeeNo === row.employeeNo &&
        record.monthYear === (row.monthYear || monthYear) &&
        record.payrollPeriod === row.payrollPeriod
      )
    );

    if (duplicateRows.length > 0) {
      window.alert(`${duplicateRows.length} row(s) already have payroll records for the same month and cutoff.`);
      return;
    }

    const totalBasicPay = validRows.reduce((sum, row) => {
      const pipeline = buildPipelineForRow(row);
      return sum + (pipeline ? pipeline.adjustedBase : 0);
    }, 0);

    const periodLabel = cutoffIdentity.cutoffLabel || validRows[0]?.payrollPeriod || monthYear || "";

    setPayrollSaveConfirm({ validRows, totalBasicPay, periodLabel });
  };

  const showPayrollToast = (type: "success" | "error", message: string) => {
    if (payrollToastTimerRef.current) clearTimeout(payrollToastTimerRef.current);
    setPayrollToast({ type, message });
    payrollToastTimerRef.current = setTimeout(() => setPayrollToast(null), 5000);
  };

  const confirmSavePayrollRun = async () => {
    if (!payrollSaveConfirm) return;
    const { validRows } = payrollSaveConfirm;
    setPayrollSaveConfirm(null);
    setIsSavingPayroll(true);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const bulkRunId = `BULK-${Date.now()}`;
    const savedAt = new Date().toISOString();

    const newRecords: SavedPayrollRecord[] = validRows.flatMap((row) => {
      const employee = getEmployeeByNo(row.employeeNo);
      if (!employee) return [];

      const rowMonthYear = row.monthYear || monthYear;
      const [year, monthNumber] = rowMonthYear.split("-");
      const pipeline = buildPipelineForRow(row);
      if (!pipeline) return [];
      const employeeImportKey = normalizeEmployeeId(employee.employeeNo);
      const importedAttendance = attendanceByEmployeeId.get(employeeImportKey);
      const calculated = calculateRow(
        { ...employee, basicPay: pipeline.adjustedBase },
        row,
        {
          standingAllowanceLines: pipeline.standingAllowanceLines,
          deMinimisLines: pipeline.deMinimisLines,
          loanDeductions: pipeline.loanDeductionLines,
          oneTimeCredits: pipeline.oneTimeCreditLines,
          oneTimeDeductions: pipeline.oneTimeDeductionLines,
          importedAttendance,
        }
      );
      const runCutoff: PayrollCutoffIdentity = {
        ...cutoffIdentity,
        monthYear: rowMonthYear,
        cutoff: row.payrollPeriod || cutoffIdentity.cutoff,
        payDate: row.payrollDate || payrollDate,
        payrollDate: row.payrollDate || payrollDate,
      };
      const workPeriodCutoff = importedAttendance?.workPeriodCutoff || runCutoff;
      const employeeSpecialItems = specialItems.filter((item) => item.employeeId === employee.employeeNo);
      const salaryHistoryEffectiveDate = getSalaryHistoryEffectiveDate(employee, workPeriodCutoff);
      // Computation math is intentionally stubbed. Persist only pipeline outputs and safe placeholders
      // until computeStandardPayroll implements premiums, statutory contributions, and withholding tax.

      return [
        {
          id: `${bulkRunId}-${employee.employeeNo}`,
          month: monthNames[Math.max(Number(monthNumber) - 1, 0)] || rowMonthYear,
          year,
          employeeNo: employee.employeeNo,
          employeeName: employee.name,
          department: employee.department,
          employmentStatus: employee.employmentStatus,
          employmentClassification: employee.employmentClassification,
          employeeType: employee.employeeType,
          grossPay: calculated.grossPay,
          adjustedGrossCompensation: calculated.grossPay,
          totalDeductions: calculated.totalDeductions,
          withholdingTax: calculated.withholdingTax,
          employerContributions: calculated.totalGovtEmployerContrib,
          netPay: calculated.netPay,
          basicPay: calculated.basicPay,
          totalPayrollPremium: calculated.totalPayrollPremium,
          totalAllowances: calculated.totalAllowances,
          totalAbsences: calculated.totalAbsences,
          allowanceProrationDeduction: calculated.allowanceProrationDeduction,
          taxableIncome: calculated.taxableIncome,
          monthYear: rowMonthYear,
          payrollFrequency,
          payrollPeriod: row.payrollPeriod,
          payrollDate: row.payrollDate,
          bulkRunId,
          cutoffIdentity: runCutoff,
          runCutoff,
          workPeriodCutoff,
          lateEndorsed: Boolean(importedAttendance?.lateEndorsed),
          lateEndorsementReason: importedAttendance?.lateEndorsementReason,
          baseSalarySource: "salaryHistory",
          salaryHistoryEffectiveDate,
          oneTimeCredits: pipeline.oneTimeCreditLines,
          oneTimeDeductions: pipeline.oneTimeDeductionLines,
          loanDeductions: pipeline.loanDeductionLines,
          standingAllowanceLines: pipeline.standingAllowanceLines,
          deMinimisLines: pipeline.deMinimisLines,
          importedAttendance,
          specialItems: employeeSpecialItems,
          globalRuleNotes,
          computationPending: pipeline.computed.computationPending,
          computationColumns: pipeline.columns,
          createdAt: savedAt,
          nightDiffHours: readNumber(row.nightDiffHours),
          overtimeHours: readNumber(row.overtimeHours),
          restDayHours: readNumber(row.restDayHours),
          specialHolidayHours: readNumber(row.specialHolidayHours),
          absencesHours: getAbsenceHours(employee, row, importedAttendance),
          payrollRunType: employee.payrollRunType === "B" ? "B" : "A",
          // Allowances are stored at FULL value; Payroll Type B proration is captured once in
          // allowanceProrationDeduction / totalAllowancesAdjusted, not baked into each line.
          riceSubsidy: readNumber(row.riceSubsidy),
          uniformClothing: readNumber(row.uniformClothing),
          laundryAllowance: readNumber(row.laundryAllowance),
          medicalCashDependents: readNumber(row.medicalCashDependents),
          actualMedicalAssistance: readNumber(row.actualMedicalAssistance),
          achievementAwards: readNumber(row.achievementAwards),
          christmasAnniversaryGifts: readNumber(row.christmasAnniversaryGifts),
          mealAllowanceOTNight: readNumber(row.mealAllowanceOTNight),
          monetizedLeavePrivate: readNumber(row.monetizedLeavePrivate),
          cbaProductivityIncentives: readNumber(row.cbaProductivityIncentives),
          thirteenthMonthPay: readNumber(row.thirteenthMonthPay),
          christmasBonus: readNumber(row.christmasBonus),
          otherTaxableAllowances: readNumber(row.otherTaxableAllowances),
          customPremiums: premiumColumns.map((column) => ({ id: column.id, name: column.name, amount: readNumber(row.customPremiumValues[column.id] || "0") })),
          customAllowances: allowanceColumns.map((column) => ({ id: column.id, name: column.name, amount: readNumber(row.customAllowanceValues[column.id] || "0") })),
          customDeductions: deductionColumns.map((column) => ({ id: column.id, name: column.name, amount: readNumber(row.customDeductionValues[column.id] || "0") })),
          customDeductionsTotal: calculated.customDeductionsTotal,
          nightDifferentialAmount: calculated.nightDifferentialAmount,
          overtimeAmount: calculated.overtimeAmount,
          restDayAmount: calculated.restDayAmount,
          specialHolidayAmount: calculated.specialHolidayAmount,
          nonTaxableDMB: calculated.nonTaxableDMB,
          excessDMBTo90k: calculated.excessDMBTo90k,
          taxableDMBAfter90k: calculated.taxableDMBAfter90k,
          sssMonthlySalaryCredit: readNumber(row.sssMonthlySalaryCredit),
          sssRegularEe: readNumber(row.sssRegularEe),
          sssRegularEr: readNumber(row.sssRegularEr),
          sssWispEe: readNumber(row.sssWispEe),
          sssWispEr: readNumber(row.sssWispEr),
          sssEc: readNumber(row.sssEc),
          sssEe: readNumber(row.sssEe),
          sssEr: readNumber(row.sssEr),
          philhealthEe: readNumber(row.philhealthEe),
          philhealthEr: readNumber(row.philhealthEr),
          pagibigEe: readNumber(row.pagibigEe),
          pagibigEr: readNumber(row.pagibigEr),
          totalGovtEmployeeContrib: calculated.totalGovtEmployeeContrib,
          totalGovtEmployerContrib: calculated.totalGovtEmployerContrib,
          totalGovtContrib: calculated.totalGovtEmployeeContrib + calculated.totalGovtEmployerContrib,
          employeeAdvances: readNumber(row.employeeAdvances),
          cashAdvances: readNumber(row.cashAdvances),
          sssLoanRepayment: readNumber(row.sssLoanRepayment),
          hdmfLoanRepayment: readNumber(row.hdmfLoanRepayment),
          taxAnnualizationAdjustment: readNumber(row.taxAnnualizationAdjustment),
          taxAnnualizationType: row.taxAnnualizationType,
          taxAnnualizationYear: row.taxAnnualizationYear,
          taxAnnualizationSource: row.taxAnnualizationSource,
          remarks: row.remarks,
        },
      ];
    });

    try {
      const nextRecords = [...savedPayrollRecords, ...newRecords];
      await setCollectionItems(storageKeys.payrollRecords, nextRecords.map((record) => stripUndefinedAndEmptyStrings({ ...record, id: record.id })));
      setSavedPayrollRecords(nextRecords);
      try {
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_PROMPT_SHOWN_KEY);
      } catch {
        // ignore draft cleanup failures
      }
      window.dispatchEvent(new Event("payroll-records-updated"));

      try {
        const appliedLoanLines = newRecords.flatMap((record) => record.loanDeductions || []);
        if (appliedLoanLines.length > 0) {
          const updatedLoans = applyLoanDeductionsToBalances(payrollLoans, appliedLoanLines, "Payroll Run Save", savedAt);
          await setCollectionItems(storageKeys.payrollLoans, updatedLoans.map((loan) => stripUndefinedAndEmptyStrings(loan)));
          setPayrollLoans(updatedLoans);
          await logAudit({
            action: "EDITED",
            entityType: "PayrollLoan",
            entityId: bulkRunId,
            entityName: "Loan balances",
            details: JSON.stringify({
              event: "PAYROLL_RUN_LOAN_BALANCES_DECREMENTED",
              payrollRunId: bulkRunId,
              appliedLoanLines,
              changedAt: savedAt,
            }),
          });
        }
      } catch {
        // Non-blocking: loan balance update failure should not prevent payroll save.
      }

      logAudit({
        action: "CREATED",
        entityType: "PayrollRun",
        entityId: bulkRunId,
        entityName: `Payroll Run – ${monthYear} (${newRecords.length} employee${newRecords.length !== 1 ? "s" : ""})`,
        details: `Period: ${payrollPeriod}; ${newRecords.length} record(s) created`,
      });

      setIsSavingPayroll(false);
      showPayrollToast("success", `Payroll run saved successfully. ${newRecords.length} record${newRecords.length !== 1 ? "s" : ""} created.`);
      setTimeout(() => router.push("/payroll-records"), 1800);
    } catch (error) {
      console.error("Failed to save payroll run", error);
      setIsSavingPayroll(false);
      showPayrollToast("error", "Failed to save payroll run. Please try again.");
    }
  };

  const currentFilterOptions =
    loadFilterType === "department"
      ? departmentOptions
      : loadFilterType === "classification"
        ? classificationOptions
        : loadFilterType === "employeeType"
          ? employeeTypeOptions
          : loadFilterType === "mwe"
            ? ["Yes", "No", "true", "false"]
            : [];

  const customColumnScopeOptions =
    newColumnScope === "department"
      ? departmentOptions
      : newColumnScope === "classification"
        ? classificationOptions
        : newColumnScope === "employeeType"
          ? employeeTypeOptions
          : newColumnScope === "mwe"
            ? mweOptions.length > 0
              ? mweOptions
              : ["Yes", "No", "true", "false"]
            : [];

  const removeAllowanceScopeOptions =
    removeAllowanceScope === "department"
      ? departmentOptions
      : removeAllowanceScope === "classification"
        ? classificationOptions
        : removeAllowanceScope === "employeeType"
          ? employeeTypeOptions
          : removeAllowanceScope === "mwe"
            ? mweOptions.length > 0
              ? mweOptions
              : ["Yes", "No", "true", "false"]
            : [];
  const payrollRunSummary = bulkRows.reduce(
    (summary, row) => {
      const pipeline = buildPipelineForRow(row);
      const employee = getEmployeeByNo(row.employeeNo);
      const calculation = calculateRow(
        employee && pipeline ? { ...employee, basicPay: pipeline.adjustedBase } : employee,
        row,
        pipeline ? {
          standingAllowanceLines: pipeline.standingAllowanceLines,
          loanDeductions: pipeline.loanDeductionLines,
          oneTimeCredits: pipeline.oneTimeCreditLines,
          oneTimeDeductions: pipeline.oneTimeDeductionLines,
        } : {}
      );

      return {
        grossPay: summary.grossPay + calculation.grossPay,
        netPay: summary.netPay + calculation.netPay,
        deductions: summary.deductions + calculation.totalDeductions,
      };
    },
    { grossPay: 0, netPay: 0, deductions: 0 }
  );
  const validPayrollRowCount = bulkRows.filter((row) => row.employeeNo && (row.monthYear || monthYear)).length;
  const importedPremiumColumnCount = payrollComputationImport
    ? new Set(payrollComputationImport.attendanceRows.flatMap((row) => Object.keys(row.premiumHours))).size
    : 0;
  const specialItemColumnCount = new Set(
    specialItems
      .filter((item) => item.category !== "GLOBAL_RULE")
      .map((item) => `${item.category}:${item.instructionType}`)
  ).size;
  const customColumnCount = premiumColumns.length + allowanceColumns.length + deductionColumns.length + importedPremiumColumnCount + specialItemColumnCount;
  const activeTheme = normalizeTheme(theme);
  const drawerRow = detailDrawer ? bulkRows.find((row) => row.id === detailDrawer.rowId) || null : null;
  const drawerEmployee = drawerRow ? getEmployeeByNo(drawerRow.employeeNo) : null;
  const drawerPipeline = drawerRow ? buildPipelineForRow(drawerRow) : null;
  const drawerSavedRow = drawerRow && isReadonlyPayrollRunView ? readonlySavedById[drawerRow.id] : undefined;
  const drawerCalculation = drawerRow ? resolveRowCalculation(drawerRow, drawerEmployee, drawerPipeline) : null;
  const drawerImportedAttendance = drawerSavedRow
    ? drawerSavedRow.importedAttendance
    : drawerEmployee ? attendanceByEmployeeId.get(normalizeEmployeeId(drawerEmployee.employeeNo)) : undefined;

  return (
    <div className="flex min-h-screen flex-col pg-bg text-[#0b2742]">
      {detailDrawer && drawerRow && drawerCalculation ? (
        <PayrollDetailDrawer
          category={detailDrawer.category}
          row={drawerRow}
          employee={drawerEmployee}
          calculated={drawerCalculation}
          premiumColumns={premiumColumns}
          allowanceColumns={allowanceColumns}
          deductionColumns={deductionColumns}
          importedAttendance={drawerImportedAttendance}
          standingAllowanceLines={drawerSavedRow?.standingAllowanceLines || drawerPipeline?.standingAllowanceLines || []}
          loanDeductions={drawerSavedRow?.loanDeductions || drawerPipeline?.loanDeductionLines || []}
          oneTimeCredits={drawerSavedRow?.oneTimeCredits || drawerPipeline?.oneTimeCreditLines || []}
          oneTimeDeductions={drawerSavedRow?.oneTimeDeductions || drawerPipeline?.oneTimeDeductionLines || []}
          onClose={() => setDetailDrawer(null)}
          onChange={(field, value) => updateRowWithScope(drawerRow.id, field, value)}
          onCustomChange={(category, columnId, value) => updateCustomWithScope(drawerRow.id, category, columnId, value)}
          onRemoveCustomColumn={removeCustomColumn}
        />
      ) : null}
      {showRestoreBanner ? (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0f172a",
          color: "#f1f5f9",
          borderRadius: 18,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          zIndex: 100,
          maxWidth: 500,
          width: "calc(100% - 32px)",
        }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
            You have an unsaved draft. Restore it?
          </div>
          <button
            type="button"
            onClick={handleRestoreSession}
            style={{ padding: "8px 14px", borderRadius: 12, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >
            Restore
          </button>
          <button
            type="button"
            onClick={handleDiscardSession}
            style={{ padding: "8px 14px", borderRadius: 12, background: "#334155", color: "#cbd5e1", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Discard
          </button>
        </div>
      ) : null}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${activeTheme.bannerColor} 0%, #0F2A4A 100%)`, color: activeTheme.bannerTextColor }}
      >
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full opacity-20" style={{ background: `radial-gradient(circle, ${activeTheme.accentColor} 0%, transparent 70%)` }} />
        <div className="relative mx-auto max-w-[1320px] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: activeTheme.accentColor }}>Payroll Processing</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {isReadonlyPayrollRunView ? "View Payroll Run" : "Add Payroll Run"}
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 opacity-85">
                {isReadonlyPayrollRunView
                  ? `${readonlyPayrollRunTitle || "Selected payroll run"} is shown in review mode.`
                  : "Load employees, prepare cutoffs, manage run columns, and save validated records."}
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${activeTheme.accentColor}33`, color: activeTheme.accentColor }}>
                <UsersRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Loaded Rows</div>
                <div className="text-base font-bold tabular-nums">{bulkRows.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${activeTheme.accentColor}33`, color: activeTheme.accentColor }}>
                <WalletCards className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Gross Pay</div>
                <div className="truncate text-sm font-bold tabular-nums">{formatCurrency(payrollRunSummary.grossPay)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${activeTheme.accentColor}33`, color: activeTheme.accentColor }}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Net Pay</div>
                <div className="truncate text-sm font-bold tabular-nums">{formatCurrency(payrollRunSummary.netPay)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-4 py-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${activeTheme.accentColor}33`, color: activeTheme.accentColor }}>
                <Layers3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">Run Columns</div>
                <div className="text-base font-bold tabular-nums">{customColumnCount}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-[#E2E8F0] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
        <div className="mx-auto max-w-[1320px] px-6 py-4 sm:px-8">
          <div className="flex items-center gap-1 overflow-x-auto">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: activeTheme.accentColor }}>1</span>
              <span className="text-sm font-bold text-[#0b2742]">Setup Run</span>
            </div>
            <div className="mx-4 h-px flex-1 bg-[#E2E8F0]" />
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: activeTheme.accentColor }}>2</span>
              <span className="text-sm font-bold text-[#0b2742]">Load Employees</span>
            </div>
            <div className="mx-4 h-px flex-1 bg-[#E2E8F0]" />
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: activeTheme.accentColor }}>3</span>
              <span className="text-sm font-bold text-[#0b2742]">Review &amp; Save</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1320px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8" style={{ paddingBottom: 96 }}>

        {/* Readonly banner — shown above the table in review mode */}
        {isReadonlyPayrollRunView ? (
          <Section title="Read-Only Payroll Run" icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-950">{readonlyPayrollRunTitle || "Detailed Payroll Run"}</div>
                <div className="mt-1 text-sm font-medium text-slate-500">Locked for review. Use adjustments or revision workflow for changes.</div>
              </div>
              <button type="button" onClick={() => router.push("/payroll-records")} className={secondaryButtonClassName}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Records
              </button>
            </div>
          </Section>
        ) : null}

        {/* Payroll Run Setup */}
        {!isReadonlyPayrollRunView ? (
          <Section title="Payroll Run Setup" icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} iconClassName="border border-indigo-100 bg-indigo-50 text-indigo-500">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className={fieldGroupClassName}>
                <FieldLabel>Bulk Month and Year <RequiredAsterisk /></FieldLabel>
                <InputField
                  type="month"
                  value={monthYear}
                  onChange={(event) => {
                    setMonthYear(event.target.value);
                    setBulkRows((current) => current.map((row) => ({ ...row, monthYear: event.target.value })));
                  }}
                />
              </label>

              <label className={fieldGroupClassName}>
                <FieldLabel>Payroll Date <RequiredAsterisk /></FieldLabel>
                <InputField
                  type="date"
                  value={payrollDate}
                  onChange={(event) => {
                    setPayrollDate(event.target.value);
                    setBulkRows((current) => current.map((row) => ({ ...row, payrollDate: event.target.value })));
                  }}
                />
              </label>

              <label className={fieldGroupClassName}>
                <FieldLabel>Default Cutoff <RequiredAsterisk /></FieldLabel>
                <SelectField
                  value={payrollPeriod}
                  onChange={(event) => {
                    setPayrollPeriod(event.target.value);
                    setBulkRows((current) => current.map((row) => ({ ...row, payrollPeriod: event.target.value })));
                  }}
                >
                  <option value="">Select cutoff</option>
                  {payrollPeriodOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </label>

              <div className="grid gap-2 self-end rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[#0a4f8f] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Frequency</span>
                <span className="text-sm font-bold">Semi-monthly fixed</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Coverage inherited from Settings:{" "}
              <span className="font-bold text-slate-900">
                {cutoffIdentity.coverageStartDate || "—"} to {cutoffIdentity.coverageEndDate || "—"}
              </span>
              {cutoffIdentity.cutoffLabel ? (
                <span className="ml-2 text-[#0a4f8f]">({cutoffIdentity.cutoffLabel})</span>
              ) : null}
            </div>

            {pendingMonetizedLeaveAdjustments.length > 0 ? (
              <div
                className={`mt-5 rounded-2xl border p-4 shadow-[0_14px_34px_-28px_rgba(8,47,73,0.72)] ${
                  isSelectedMonetizedLeaveApplied ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className={`text-sm font-bold ${isSelectedMonetizedLeaveApplied ? "text-emerald-700" : "text-amber-800"}`}>
                      {isSelectedMonetizedLeaveApplied ? "Monetized Leave Applied" : "Monetized Leave Pending"}
                    </div>
                    <div className="mt-1 text-sm font-medium leading-6 text-slate-600">
                      {pendingMonetizedLeaveAdjustments.length} adjustment(s) for {selectedPayrollReferenceForMonetization}. Total: {formatCurrency(pendingMonetizedLeaveTotal)}.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSelectedMonetizedLeaveApplied}
                      onClick={applyPendingMonetizedLeaveAdjustments}
                      className={primaryButtonClassName}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {isSelectedMonetizedLeaveApplied ? "Applied" : "Apply Leave"}
                    </button>

                    {isSelectedMonetizedLeaveApplied ? (
                      <button type="button" onClick={cancelAppliedMonetizedLeaveAdjustments} className={dangerButtonClassName}>
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Cancel Leave
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* Edit Payroll Columns — collapsible accordion, collapsed by default */}
        {!isReadonlyPayrollRunView ? (
          <div className={`${subtlePanelClassName}`} style={{ borderLeft: "3px solid #22D3EE" }}>
            <button
              type="button"
              onClick={() => setShowEditColumns((v) => !v)}
              className="flex w-full items-center justify-between gap-3 p-5 sm:p-6 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <Layers3 className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-lg font-bold text-slate-950 sm:text-xl">Edit Payroll Columns</span>
                {customColumns.length > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    {customColumns.length} active
                  </span>
                ) : null}
              </span>
              <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${showEditColumns ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {showEditColumns ? (
              <div className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-6">
                <p className="mb-5 mt-0 text-sm font-medium leading-6 text-slate-500">
                  Add run-only payroll columns or zero out selected standard allowances.
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_minmax(260px,1fr)_180px_220px_220px]">
                  <label className={fieldGroupClassName}>
                    <FieldLabel>Category <RequiredAsterisk /></FieldLabel>
                    <SelectField value={newColumnCategory} onChange={(event) => setNewColumnCategory(event.target.value as BulkCustomColumnCategory)}>
                      <option value="premium">Premium</option>
                      <option value="allowance">Allowance</option>
                      <option value="deduction">Deduction</option>
                    </SelectField>
                  </label>
                  <label className={fieldGroupClassName}>
                    <FieldLabel>Column Name <RequiredAsterisk /></FieldLabel>
                    <InputField value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Example: Internet Allowance" />
                  </label>
                  <label className={fieldGroupClassName}>
                    <FieldLabel>Amount <RequiredAsterisk /></FieldLabel>
                    <MoneyInput value={newColumnAmount} onChange={setNewColumnAmount} />
                  </label>
                  <label className={fieldGroupClassName}>
                    <FieldLabel>Apply To <RequiredAsterisk /></FieldLabel>
                    <SelectField
                      value={newColumnScope}
                      onChange={(event) => {
                        setNewColumnScope(event.target.value as Scope);
                        setNewColumnScopeValue("");
                      }}
                    >
                      <option value="all">All loaded employees</option>
                      <option value="department">Specific department</option>
                      <option value="classification">Specific employee group/classification</option>
                      <option value="employeeType">Specific employee type</option>
                      <option value="mwe">Specific MWE status</option>
                    </SelectField>
                  </label>
                  {newColumnScope !== "all" ? (
                    <label className={fieldGroupClassName}>
                      <FieldLabel>Target <RequiredAsterisk /></FieldLabel>
                      <SelectField value={newColumnScopeValue} onChange={(event) => setNewColumnScopeValue(event.target.value)}>
                        <option value="">Select value</option>
                        {customColumnScopeOptions.map((option) => (
                          <option key={option} value={option}>
                            {newColumnScope === "classification" ? `Group/Classification: ${option}` : option}
                          </option>
                        ))}
                      </SelectField>
                    </label>
                  ) : null}
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={addCustomColumn} className={primaryButtonClassName}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Apply
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className={fieldGroupClassName}>
                      <FieldLabel>Allowance</FieldLabel>
                      <SelectField value={allowanceToRemove} onChange={(event) => setAllowanceToRemove(event.target.value as StandardAllowanceField)}>
                        {STANDARD_ALLOWANCE_FIELDS.map((item) => (
                          <option key={item.field} value={item.field}>{item.label}</option>
                        ))}
                      </SelectField>
                    </label>

                    <label className={fieldGroupClassName}>
                      <FieldLabel>Remove From</FieldLabel>
                      <SelectField
                        value={removeAllowanceScope}
                        onChange={(event) => {
                          setRemoveAllowanceScope(event.target.value as Exclude<Scope, "single">);
                          setRemoveAllowanceScopeValue("");
                        }}
                      >
                        <option value="all">All loaded employees</option>
                        <option value="department">Specific department</option>
                        <option value="classification">Specific employee group/classification</option>
                        <option value="employeeType">Specific employee type</option>
                        <option value="mwe">Specific MWE status</option>
                      </SelectField>
                    </label>

                    {removeAllowanceScope !== "all" ? (
                      <label className={fieldGroupClassName}>
                        <FieldLabel>Target</FieldLabel>
                        <SelectField value={removeAllowanceScopeValue} onChange={(event) => setRemoveAllowanceScopeValue(event.target.value)}>
                          <option value="">Select value</option>
                          {removeAllowanceScopeOptions.map((option) => (
                            <option key={option} value={option}>
                              {removeAllowanceScope === "classification" ? `Group/Classification: ${option}` : option}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                    ) : null}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={removeStandardAllowanceForRun} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-400 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Set to Zero
                    </button>
                  </div>
                </div>
                {customColumns.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {customColumns.map((column) => (
                      <span key={column.id} className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-[#0a4f8f]">
                        {column.category.toUpperCase()}: {column.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── View mode: detailed register mirroring the exported Excel ── */}
        {isReadonlyPayrollRunView ? (
          <Section title="Payroll Register — Detailed" icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}>
            <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm font-medium text-slate-600">
              Read-only detailed payroll register. This matches the exported Excel column-for-column. Scroll horizontally to see all sections.
            </div>
            {readonlyRunRecords.length > 0 ? (
              <DetailedPayrollRegister
                records={readonlyRunRecords as unknown as DetailedRecord[]}
                period={readonlyRunMeta.period}
                payDate={readonlyRunMeta.payDate}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm font-medium text-slate-500">
                No records in this payroll run.
              </div>
            )}
          </Section>
        ) : null}

        {/* ── Payroll Spreadsheet Entry — primary work area (entry mode only) ── */}
        {!isReadonlyPayrollRunView ? (
        <Section title="Payroll Spreadsheet Entry" icon={<FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}>
          {/* Load Employees — full panel when empty, compact reload when rows exist */}
          {!isReadonlyPayrollRunView ? (
            bulkRows.length === 0 || showLoadPanel ? (
              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-500">
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-slate-700">Load Employees</span>
                  </div>
                  {bulkRows.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowLoadPanel(false)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 transition"
                    >
                      Collapse ↑
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className={`${fieldGroupClassName} min-w-[200px] flex-1`}>
                      <FieldLabel>Load Employees By</FieldLabel>
                      <SelectField
                        value={loadFilterType}
                        onChange={(event) => {
                          setLoadFilterType(event.target.value as typeof loadFilterType);
                          setLoadFilterValue("");
                        }}
                      >
                        <option value="all">All employees</option>
                        <option value="department">Department</option>
                        <option value="classification">Employee group/classification</option>
                        <option value="employeeType">Employee type</option>
                        <option value="mwe">Minimum wage earner status</option>
                      </SelectField>
                    </label>

                    {loadFilterType !== "all" ? (
                      <label className={`${fieldGroupClassName} min-w-[180px] flex-1`}>
                        <FieldLabel>Filter Value</FieldLabel>
                        <SelectField value={loadFilterValue} onChange={(event) => setLoadFilterValue(event.target.value)}>
                          <option value="">All within selected category</option>
                          {currentFilterOptions.map((option) => (
                            <option key={option} value={option}>
                              {loadFilterType === "classification" ? `Group/Classification: ${option}` : option}
                            </option>
                          ))}
                        </SelectField>
                      </label>
                    ) : null}

                    <button type="button" onClick={loadEmployees} disabled={isImportBusy} className={primaryButtonClassName}>
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      {importProgress?.kind === "load-employees" ? importProgress.label : "Load"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={addRow} className={secondaryButtonClassName}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add Row
                    </button>
                    <label className={`${secondaryButtonClassName} ${isImportBusy ? "pointer-events-none opacity-60" : ""}`} aria-disabled={isImportBusy}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {importProgress?.kind === "csv" ? importProgress.label : "Upload CSV"}
                      <input type="file" accept=".csv" disabled={isImportBusy} onChange={(event) => importCsvTemplate(event.target.files?.[0] || null)} className="hidden" />
                    </label>
                    <button type="button" onClick={downloadCsvTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      CSV Template
                    </button>
                  </div>
                  <ValidationErrorList errors={csvImportErrors} />
                </div>

                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <button
                    type="button"
                    onClick={() => setShowCsvGuide((current) => !current)}
                    className="flex w-full items-center justify-between gap-4 text-left text-sm font-bold text-[#0a4f8f]"
                  >
                    <span>
                      Import Instructions
                      <span className="mt-1 block text-xs font-medium text-slate-500">Use exact headers and numeric peso amounts for imported payroll run columns.</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 transition ${showCsvGuide ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {showCsvGuide ? (
                    <div className="mt-4 flex flex-col gap-4">
                      <div className="grid gap-3">
                        <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a4f8f]">Employee Info</p>
                          <div className="grid gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                            <p><strong className="text-slate-950">Employee Identifier:</strong> use <code className="rounded bg-slate-100 px-1">Employee No</code> from the template. The importer matches this to the saved employee record. Example: <code className="rounded bg-slate-100 px-1">EMP-0001</code>.</p>
                            <p><strong className="text-slate-950">Employee Email:</strong> if your file uses email as the working reference, keep the employee email in the saved employee profile and verify the matching employee number before saving. Example: <code className="rounded bg-slate-100 px-1">juan.delacruz@example.com</code>.</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a4f8f]">Pay</p>
                          <div className="grid gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                            <p><strong className="text-slate-950">Basic Pay:</strong> numeric only. Use <code className="rounded bg-slate-100 px-1">Suggested Basic Pay for Cutoff</code> or update the row after import. Example: <code className="rounded bg-slate-100 px-1">₱25,000.00</code> should be entered as <code className="rounded bg-slate-100 px-1">25000</code>.</p>
                            <p><strong className="text-slate-950">Overtime Pay:</strong> numeric hours in <code className="rounded bg-slate-100 px-1">Overtime Hours</code>; the app computes the peso amount. Example: <code className="rounded bg-slate-100 px-1">4</code> hours.</p>
                            <p><strong className="text-slate-950">Extra Earnings:</strong> add columns using <code className="rounded bg-slate-100 px-1">earning_&lt;Earning Name&gt;</code>. Example: <code className="rounded bg-slate-100 px-1">earning_Hazard Pay</code> = <code className="rounded bg-slate-100 px-1">₱1,500.00</code> shown as CSV value <code className="rounded bg-slate-100 px-1">1500</code>. Legacy headers like <code className="rounded bg-slate-100 px-1">PREMIUM: Hazard Pay</code> are also accepted.</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a4f8f]">Allowances</p>
                          <div className="grid gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                            <p><strong className="text-slate-950">Fixed Allowances:</strong> numeric only in the standard allowance columns. Example: <code className="rounded bg-slate-100 px-1">Rice Subsidy</code> = <code className="rounded bg-slate-100 px-1">₱2,000.00</code> shown as CSV value <code className="rounded bg-slate-100 px-1">2000</code>.</p>
                            <p><strong className="text-slate-950">Allowance Overrides:</strong> add columns using <code className="rounded bg-slate-100 px-1">allowance_&lt;Name&gt;_override</code>. Example: <code className="rounded bg-slate-100 px-1">allowance_Transportation Allowance_override</code> = <code className="rounded bg-slate-100 px-1">₱2,500.00</code> shown as CSV value <code className="rounded bg-slate-100 px-1">2500</code>. Legacy headers like <code className="rounded bg-slate-100 px-1">ALLOWANCE: Transportation Allowance</code> are also accepted.</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0a4f8f]">Deductions</p>
                          <div className="grid gap-2 text-xs font-semibold leading-relaxed text-slate-700">
                            <p><strong className="text-slate-950">Standard Deductions:</strong> SSS, PhilHealth, and Pag-IBIG are auto-computed by default. Use the generated contribution values unless you manually review and adjust after import. Numeric overrides should use plain numbers. Example: <code className="rounded bg-slate-100 px-1">₱1,200.00</code> should be entered as <code className="rounded bg-slate-100 px-1">1200</code>.</p>
                            <p><strong className="text-slate-950">Extra Deductions:</strong> add columns using <code className="rounded bg-slate-100 px-1">deduction_&lt;Deduction Name&gt;</code>. Example: <code className="rounded bg-slate-100 px-1">deduction_Uniform Deduction</code> = <code className="rounded bg-slate-100 px-1">₱500.00</code> shown as CSV value <code className="rounded bg-slate-100 px-1">500</code>. Legacy headers like <code className="rounded bg-slate-100 px-1">DEDUCTION: Uniform Deduction</code> are also accepted.</p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <CodeTip label="Extra Earnings" code="earning_Hazard Pay" />
                          <CodeTip label="Allowance Override" code="allowance_Internet Allowance_override" />
                          <CodeTip label="Extra Deduction" code="deduction_Uniform Deduction" />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {bulkRows.length > 0 ? <div className="mt-5 border-t border-slate-100" /> : null}
              </div>
            ) : (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-medium text-slate-500">
                  <span className="font-semibold text-slate-700">{bulkRows.length}</span> employee row{bulkRows.length !== 1 ? "s" : ""} loaded
                </span>
                <button
                  type="button"
                  onClick={() => setShowLoadPanel(true)}
                  disabled={isImportBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0a4f8f] transition hover:text-[#073c6d]"
                >
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {importProgress?.kind === "load-employees" ? importProgress.label : "Reload / change employees"}
                </button>
              </div>
            )
          ) : null}

          {!isReadonlyPayrollRunView ? (
            <div className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_-38px_rgba(8,47,73,0.65)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-950">Per-cutoff Imports</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">Optionally import special items and a payroll computation workbook, or save using the loaded employees.</div>
                </div>
                <StatusBadge tone={payrollComputationImport ? "emerald" : "slate"}>
                  {payrollComputationImport ? "Ready for review" : "Computation workbook optional"}
                </StatusBadge>
              </div>
              {!hasLoadedEmployees ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  Load employees first so rows can be matched.
                </div>
              ) : null}
              {importProgress ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-[#0a4f8f]" role="status" aria-live="polite">
                  {importProgress.label}
                </div>
              ) : importSuccessMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700" role="status" aria-live="polite">
                  {importSuccessMessage}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3 text-sm font-bold text-slate-800">
                      <input
                        type="checkbox"
                        checked={hasSpecialItemsThisCutoff}
                        onChange={(event) => handleSpecialItemsToggle(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0a4f8f] focus:ring-sky-100"
                      />
                      Special items this cutoff?
                    </label>
                    <button type="button" onClick={() => downloadSpecialItemsTemplate(cutoffIdentity)} className={secondaryButtonClassName}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Template
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleSpecialItemsToggle(false)} disabled={isImportBusy} className={hasSpecialItemsThisCutoff ? secondaryButtonClassName : primaryButtonClassName}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      No special items
                    </button>
                    <label className={`${secondaryButtonClassName} ${isImportBusy ? "pointer-events-none opacity-60" : ""}`} aria-disabled={isImportBusy}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {importProgress?.kind === "special-items" ? importProgress.label : isImportingSpecialItems ? "Importing..." : "Upload Special Items"}
                      <input type="file" accept=".xlsx" disabled={isImportBusy} onChange={(event) => importSpecialItemsWorkbook(event.target.files?.[0] || null)} className="hidden" />
                    </label>
                  </div>
                  <div className="mt-3 text-xs font-semibold text-slate-500">
                    {specialItemsDecisionMade
                      ? hasSpecialItemsThisCutoff
                        ? `${specialItems.length} special item row${specialItems.length !== 1 ? "s" : ""} validated.`
                        : "Special items skipped for this cutoff."
                      : "Choose whether this cutoff has special items."}
                  </div>
                  <ValidationErrorList errors={specialItemsErrors} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Payroll Computation</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">Workbook must include the Attendance sheet only.</div>
                    </div>
                    <button type="button" onClick={() => downloadPayrollComputationTemplate(cutoffIdentity)} className={secondaryButtonClassName}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Template
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className={`${primaryButtonClassName} ${isImportBusy ? "pointer-events-none opacity-60" : ""}`} aria-disabled={isImportBusy}>
                      <Upload className="h-4 w-4" aria-hidden="true" />
                      {importProgress?.kind === "payroll-computation" ? importProgress.label : isImportingPayrollComputation ? "Importing..." : "Upload Workbook"}
                      <input type="file" accept=".xlsx" disabled={isImportBusy} onChange={(event) => importPayrollComputationWorkbook(event.target.files?.[0] || null)} className="hidden" />
                    </label>
                    {payrollComputationImport ? (
                      <StatusBadge tone="emerald">
                        {payrollComputationImport.attendanceRows.length} attendance
                      </StatusBadge>
                    ) : null}
                  </div>
                  <ValidationErrorList errors={payrollComputationErrors} />
                </div>
              </div>

              {globalRuleNotes.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Run-level notes</div>
                  <div className="mt-2 grid gap-1">
                    {globalRuleNotes.map((item) => (
                      <div key={item.id} className="text-xs font-semibold text-amber-950">
                        {item.instructionType}: {item.remarks || "Global rule noted; handled in Settings."}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-600">
              Showing {bulkRows.length === 0 ? 0 : firstIndex + 1}-{lastIndex} of {bulkRows.length} row(s). <ScopeBadge />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1} className={secondaryButtonClassName}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Page {safeCurrentPage} of {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages} className={secondaryButtonClassName}>
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {bulkRows.length > 0 ? (
            <>
              <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm font-medium text-slate-600">
                Click a category card to edit details. Amount edits still prompt for employee, department, classification, type, or MWE scope.
              </div>
              <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-34px_rgba(8,47,73,0.75)]">
                <table className="w-full min-w-[1740px] table-fixed border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th style={spreadsheetHeaderStyle}>Employee</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 300 }}>Period</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 260 }}>Attendance</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 140 }}>Basic Pay</th>
                      <th style={spreadsheetHeaderStyle}>Premiums</th>
                      <th style={spreadsheetHeaderStyle}>Allowances</th>
                      <th style={spreadsheetHeaderStyle}>Gov&apos;t</th>
                      <th style={spreadsheetHeaderStyle}>Other / Tax</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 140 }}>Gross</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 140 }}>Net</th>
                      <th style={{ ...spreadsheetHeaderStyle, width: 96 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.slice(0, ROWS_PER_PAGE).map((row, rowIndex) => {
                      const employee = getEmployeeByNo(row.employeeNo);
                      const pipeline = buildPipelineForRow(row);
                      const calculation = resolveRowCalculation(row, employee, pipeline);
                      const savedRow = isReadonlyPayrollRunView ? readonlySavedById[row.id] : undefined;
                      const employeeImportKey = normalizeEmployeeId(employee?.employeeNo);
                      const importedAttendance = savedRow
                        ? savedRow.importedAttendance
                        : employee ? attendanceByEmployeeId.get(employeeImportKey) : undefined;
                      return (
                        <PayrollSpreadsheetRow
                          key={row.id}
                          row={row}
                          rowNumber={firstIndex + rowIndex + 1}
                          employee={employee}
                          employees={employees}
                          runCutoff={cutoffIdentity}
                          calculated={calculation}
                          premiumColumns={premiumColumns}
                          allowanceColumns={allowanceColumns}
                          deductionColumns={deductionColumns}
                          importedAttendance={importedAttendance}
                          standingAllowanceLines={savedRow?.standingAllowanceLines || pipeline?.standingAllowanceLines || []}
                          loanDeductions={savedRow?.loanDeductions || pipeline?.loanDeductionLines || []}
                          oneTimeCredits={savedRow?.oneTimeCredits || pipeline?.oneTimeCreditLines || []}
                          oneTimeDeductions={savedRow?.oneTimeDeductions || pipeline?.oneTimeDeductionLines || []}
                          onChange={(field, value) => {
                            if (field === "employeeNo") updateEmployeeCustomColumns(value);
                            updateRowWithScope(row.id, field, value);
                          }}
                          onRemoveRow={() => setBulkRows((current) => current.filter((item) => item.id !== row.id))}
                          onOpenDrawer={(category) => setDetailDrawer({ rowId: row.id, category })}
                          readOnly={isReadonlyPayrollRunView}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1} className={secondaryButtonClassName}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </button>
                  <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">Page {safeCurrentPage} of {totalPages}</span>
                  <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages} className={secondaryButtonClassName}>
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-10 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E0F2FE] text-[#0369A1]">
                <FileSpreadsheet className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#0b2742]">No payroll rows yet</p>
                <p className="mt-1 text-xs text-[#64748B]">Load employees or upload a CSV to get started.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={loadEmployees} className={primaryButtonClassName}>
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Load Employees
                </button>
                <button type="button" onClick={addRow} className={secondaryButtonClassName}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add Row Manually
                </button>
              </div>
            </div>
          )}
        </Section>
        ) : null}

        {bulkRows.length > 0 && !isReadonlyPayrollRunView ? (
          <Section title="Review & Save" icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} iconClassName="border border-emerald-100 bg-emerald-50 text-emerald-600">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-600">
                Review recomputes in engine order: employee salary history, standard payroll stub, then one-time credits and deductions.
              </div>
              <StatusBadge tone="amber">Computation pending stub</StatusBadge>
            </div>

            {globalRuleNotes.length > 0 ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700">Global rules noted for this run</div>
                <div className="mt-2 grid gap-1">
                  {globalRuleNotes.map((item) => (
                    <div key={item.id} className="text-xs font-semibold text-amber-950">
                      {item.instructionType}: {item.remarks || "Handled in Settings; not applied as per-employee adjustment."}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th style={spreadsheetHeaderStyle}>Employee</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 220 }}>Base</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 160 }}>Gross</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 160 }}>Deductions</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 220 }}>One-time Items</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 160 }}>Final Net</th>
                    <th style={{ ...spreadsheetHeaderStyle, width: 180 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row) => {
                    const employee = getEmployeeByNo(row.employeeNo);
                    const pipeline = buildPipelineForRow(row);
                    const reviewSavedRow = isReadonlyPayrollRunView ? readonlySavedById[row.id] : undefined;
                    const attendance = reviewSavedRow
                      ? reviewSavedRow.importedAttendance
                      : employee ? attendanceByEmployeeId.get(normalizeEmployeeId(employee.employeeNo)) : undefined;
                    const workPeriodCutoff = attendance?.workPeriodCutoff || cutoffIdentity;
                    const salaryHistoryEffectiveDate = employee ? getSalaryHistoryEffectiveDate(employee, workPeriodCutoff) : undefined;
                    const credits = (reviewSavedRow?.oneTimeCredits || pipeline?.oneTimeCreditLines || []).reduce((sum, item) => sum + item.amount, 0);
                    const deductions = (reviewSavedRow?.oneTimeDeductions || pipeline?.oneTimeDeductionLines || []).reduce((sum, item) => sum + item.amount, 0);
                    const calculation = resolveRowCalculation(row, employee, pipeline);

                    return (
                      <tr key={`review-${row.id}`}>
                        <td style={spreadsheetCellStyle}>
                          <div className="font-bold text-slate-900">{employee?.name || row.employeeNo || "Unmatched employee"}</div>
                          <div className="text-xs font-semibold text-slate-500">{row.employeeNo}</div>
                          {attendance?.lateEndorsed ? (
                            <div className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              Late endorsed
                            </div>
                          ) : null}
                        </td>
                        <td style={spreadsheetCellStyle}>
                          {pipeline || reviewSavedRow ? (
                            <div className="grid gap-1 text-xs font-semibold">
                              <span className="text-slate-900">{formatCurrency(reviewSavedRow?.adjustedBase ?? pipeline?.adjustedBase ?? 0)}</span>
                              <span className="text-slate-500">
                                Salary history{salaryHistoryEffectiveDate ? ` effective ${salaryHistoryEffectiveDate}` : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">Missing employee</span>
                          )}
                        </td>
                        <td style={spreadsheetCellStyle}>{formatCurrency(calculation.grossPay)}</td>
                        <td style={spreadsheetCellStyle}>{formatCurrency(calculation.totalDeductions)}</td>
                        <td style={spreadsheetCellStyle}>
                          <div className="grid gap-1 text-xs font-semibold">
                            <span className={credits > 0 ? "text-emerald-700" : "text-slate-400"}>Credits {formatCurrency(credits)}</span>
                            <span className={deductions > 0 ? "text-rose-700" : "text-slate-400"}>Deductions {formatCurrency(deductions)}</span>
                          </div>
                        </td>
                        <td style={{ ...spreadsheetCellStyle, fontWeight: 800, color: "#0f172a" }}>{formatCurrency(calculation.netPay)}</td>
                        <td style={spreadsheetCellStyle}>
                          <div className="flex flex-wrap gap-1.5">
                            <StatusBadge tone={pipeline ? "amber" : "rose"}>{pipeline ? "Math stub" : "Blocked"}</StatusBadge>
                            {attendanceByEmployeeId.has(normalizeEmployeeId(row.employeeNo)) ? <StatusBadge tone="emerald">Attendance</StatusBadge> : <StatusBadge tone="rose">No attendance</StatusBadge>}
                            {attendance?.lateEndorsed ? <StatusBadge tone="amber">Late</StatusBadge> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

      </div>

      <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-white/95 px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4">
          <button type="button" onClick={() => router.push("/payroll-records")} className={secondaryButtonClassName}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to Payroll Runs
          </button>
          {!isReadonlyPayrollRunView ? (
            <button
              type="button"
              onClick={savePayrollRun}
              disabled={validPayrollRowCount === 0 || isSavingPayroll || !specialItemsDecisionMade}
              className={cyanPrimaryButtonClassName}
              style={{ background: validPayrollRowCount > 0 && !isSavingPayroll && specialItemsDecisionMade ? "linear-gradient(135deg, #22D3EE, #06B6D4)" : "#CBD5E1" }}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSavingPayroll ? "Saving…" : "Save Payroll Run"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Save Payroll Run confirmation modal */}
      {payrollSaveConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "36px 40px", maxWidth: 460, width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a4f8f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Save Payroll Run</div>
            </div>

            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, marginBottom: 20 }}>
              You are about to save <strong>{payrollSaveConfirm.validRows.length} payroll record{payrollSaveConfirm.validRows.length !== 1 ? "s" : ""}</strong>. This will create payroll records and affect payslips and reports. <strong>This action cannot be undone.</strong>
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                <span style={{ fontWeight: 600 }}>Employees</span>
                <span style={{ fontWeight: 800 }}>{payrollSaveConfirm.validRows.length}</span>
              </div>
              {payrollSaveConfirm.periodLabel && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                  <span style={{ fontWeight: 600 }}>Payroll Period</span>
                  <span style={{ fontWeight: 800 }}>{payrollSaveConfirm.periodLabel}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", borderTop: "1px solid #e2e8f0", paddingTop: 8, marginTop: 2 }}>
                <span style={{ fontWeight: 600 }}>Total Basic Pay</span>
                <span style={{ fontWeight: 800, color: "#0a4f8f" }}>
                  ₱{payrollSaveConfirm.totalBasicPay.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPayrollSaveConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSavePayrollRun}
                disabled={isSavingPayroll}
                style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#0a4f8f", color: "#fff", fontWeight: 800, cursor: isSavingPayroll ? "not-allowed" : "pointer", fontSize: 14, opacity: isSavingPayroll ? 0.7 : 1 }}
              >
                {isSavingPayroll ? "Saving…" : "Save Payroll Run"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import progress bar */}
      {importProgress && (
        <div
          role="status"
          aria-live="polite"
          title={importProgress.label}
          style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000, height: 4, background: "#e2e8f0", overflow: "hidden" }}
        >
          <div style={{ height: "100%", background: "linear-gradient(90deg, #0a4f8f, #3b82f6, #0a4f8f)", backgroundSize: "200% 100%", animation: "payroll-save-bar 1.2s linear infinite" }} />
          <span className="sr-only">{importProgress.label}</span>
        </div>
      )}

      {/* Saving progress bar */}
      {isSavingPayroll && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10000, height: 4, background: "#e2e8f0", overflow: "hidden" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg, #0a4f8f, #3b82f6, #0a4f8f)", backgroundSize: "200% 100%", animation: "payroll-save-bar 1.2s linear infinite" }} />
          <style>{`@keyframes payroll-save-bar { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        </div>
      )}

      {/* Toast notification */}
      {payrollToast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 10001,
          display: "flex", alignItems: "flex-start", gap: 12,
          background: payrollToast.type === "success" ? "#052e16" : "#450a0a",
          color: "#fff", borderRadius: 14, padding: "14px 18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)", maxWidth: 360, minWidth: 260,
          animation: "payroll-toast-in 0.22s ease",
        }}>
          <style>{`@keyframes payroll-toast-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          <span style={{ fontSize: 18, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>
            {payrollToast.type === "success" ? "✓" : "✕"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, flex: 1 }}>{payrollToast.message}</span>
          <button
            type="button"
            onClick={() => setPayrollToast(null)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0, marginTop: 1 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}

export default function AddPayrollPage() {
  return (
    <Suspense>
      <AddPayrollPageInner />
    </Suspense>
  );
}

function CodeTip({ label, code }: { label: string; code: string }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-white/90 p-3 shadow-[0_12px_26px_-24px_rgba(8,47,73,0.7)]">
      <div className="mb-1.5 text-xs font-bold text-[#0a4f8f]">{label}</div>
      <code className="text-xs font-bold text-slate-950">{code}</code>
    </div>
  );
}

function PayrollMetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[112px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white bg-white/95 p-4 shadow-[0_22px_48px_-34px_rgba(8,47,73,0.78)] ring-1 ring-slate-900/[0.04] transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-500 to-[#0a4f8f]" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-[#0a4f8f]">
          {icon}
        </span>
      </div>
      <div>
        <div className="break-words text-xl font-bold tabular-nums text-slate-950 sm:text-2xl">{value}</div>
        <div className="mt-1 text-xs font-medium text-slate-500">{helper}</div>
      </div>
    </div>
  );
}

const spreadsheetHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  padding: "14px 12px",
  borderBottom: "1px solid #dbeafe",
  borderRight: "1px solid #e2e8f0",
  background: "#f8fbff",
  color: "#0b2742",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "left",
  verticalAlign: "top",
};

const spreadsheetCellStyle: CSSProperties = {
  padding: 8,
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.92)",
  verticalAlign: "top",
};
