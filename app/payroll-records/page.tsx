"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import type { CSSProperties } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  MoreHorizontal,
  Search,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, setConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit, getAuditsByEntity, formatAuditTimestamp, auditActionLabel, type AuditEntry } from "@/lib/auditTrail";
import { getAuthorizedUserProfile, type AuthorizedUserProfile } from "@/lib/authRoles";
import type { PayrollCutoffIdentity } from "@/lib/payrollRunImports";
import type { LoanDeductionLine } from "@/lib/loans";
import { getDeMinimisForCutoff, type DeMinimisBenefit } from "@/lib/deMinimis";
import { exportPayrollRunsToExcel, type ExportablePayrollRun } from "@/lib/payrollExcel";


type SavedPayrollAdjustment = {
  id: string;
  adjustmentBatchId: string;
  payrollReference: string;
  employeeId: string;
  employeeName: string;
  adjustmentCategory: string;
  adjustmentLabel: string;
  adjustmentType: "Addition" | "Deduction" | "Employer Contribution";
  hours: number;
  originalHours: number;
  rate: number;
  amount: number;
  finalAmount?: number;
  netPayEffect?: number;
  reason?: string;
  taxTreatment?: string;
  source?: string;
  sourceId?: string;
  createdAt: string;
};

type PayrollChangeHistory = {
  id: string;
  action: string;
  editedBy?: string;
  changedAt: string;
  reason?: string;
  details?: string;
  oldValue?: string | number;
  newValue?: string | number;
};

type PayrollRecord = {
  id: string;
  month: string;
  year: string;
  employeeNo: string;
  employeeName: string;
  department: string;
  employeeType?: string;
  employmentStatus: string;
  grossPay: number;
  totalDeductions: number;
  withholdingTax: number;
  employerContributions: number;
  netPay: number;
  basicPay: number;
  totalPayrollPremium: number;
  totalPayrollPremiumBase?: number;
  customPremiums?: { id: string; name: string; amount: number }[];
  customPremiumsTotal?: number;
  totalAllowances: number;
  customAllowances?: { id: string; name: string; amount: number }[];
  customAllowancesTotal?: number;
  customDeductions?: { id: string; name: string; amount: number }[];
  loanDeductions?: LoanDeductionLine[];
  customDeductionsTotal?: number;
  totalAbsences: number;
  taxableIncome: number;
  monthYear?: string;
  payrollFrequency?: string;
  payrollPeriod?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  bulkRunId?: string;
  cutoffIdentity?: PayrollCutoffIdentity;
  runCutoff?: PayrollCutoffIdentity;
  workPeriodCutoff?: PayrollCutoffIdentity;
  lateEndorsed?: boolean;
  lateEndorsementReason?: string;
  periodCovered?: string;
  dateFrom?: string;
  dateTo?: string;
  payrollDate?: string;
  createdAt?: string;
  payrollAdjustments?: SavedPayrollAdjustment[];
  adjustedNetPay?: number;
  taxAnnualizationAdjustment?: number;
  yearEndTaxAdjustment?: number;
  annualizationTaxAdjustment?: number;
  annualizedTaxAdjustment?: number;
  finalTaxAdjustment?: number;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment";
  taxAnnualizationYear?: string;
  taxAnnualizationSource?: string;
  sssMonthlySalaryCredit?: number;
  sssRegularMonthlySalaryCredit?: number;
  sssWispMonthlySalaryCredit?: number;
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
  payrollChangeHistory?: PayrollChangeHistory[];
  archiveStatus?: "Active" | "Archived";
  archivedAt?: string;
  archivedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
};

type PayrollRunGroup = {
  id: string;
  title: string;
  month: string;
  year: string;
  payrollPeriod: string;
  payrollDate: string;
  createdAt: string;
  records: PayrollRecord[];
  employeesCount: number;
  basicPay: number;
  payrollPremium: number;
  allowances: number;
  grossPay: number;
  deductions: number;
  withholdingTax: number;
  netPay: number;
  regularNetPay: number;
  taxAnnualizationAdjustment: number;
  hasTaxAnnualization: boolean;
  adjustedNetPay: number;
  adjustmentsCount: number;
  employerContributions: number;
};

type PayrollRunStatus = "Draft" | "Submitted" | "Checked" | "Approved" | "Adjusted" | "Archived";

type LegacyPayrollRunStatus = "Returned for Revision" | "For Review" | "Locked";

type StoredPayrollRunStatus = PayrollRunStatus | LegacyPayrollRunStatus;

type PayrollRunApproval = {
  status: PayrollRunStatus;
  preparedByName?: string;
  preparedByPosition?: string;
  preparedAt?: string;
  preparedByUid?: string;
  checkedByName?: string;
  checkedByPosition?: string;
  checkedAt?: string;
  checkedByUid?: string;
  approvedByName?: string;
  approvedByPosition?: string;
  approvedAt?: string;
  approvedByUid?: string;
  lockedAt?: string;
  returnedAt?: string;
  returnReason?: string;
  adjustedAt?: string;
  adjustedByName?: string;
  adjustedByUid?: string;
  adjustReason?: string;
  preAdjustSnapshot?: Omit<PayrollRunApproval, "preAdjustSnapshot">;
};

type StoredPayrollRunApproval = Omit<PayrollRunApproval, "status" | "preAdjustSnapshot"> & {
  status?: StoredPayrollRunStatus;
  preAdjustSnapshot?: Partial<StoredPayrollRunApproval>;
};

type ConfirmModalState = {
  title: string;
  message: string;
  actionLabel: string;
  tone?: "default" | "green" | "amber" | "red";
  onConfirm: () => Promise<void> | void;
};

type AdjustmentEditRow = {
  recordId: string;
  employeeNo: string;
  employeeName: string;
  grossPay: number;
  totalDeductions: number;
  withholdingTax: number;
  sssEe: number;
  philhealthEe: number;
  pagibigEe: number;
  netPay: number;
};

type AdjustmentModalState = {
  payrollRun: PayrollRunGroup;
  previousApproval: PayrollRunApproval;
  originalRunSnapshot: PayrollRecord[];
  rows: AdjustmentEditRow[];
  reason: string;
};

type PayrollSignatorySettings = {
  preparedByName: string;
  preparedByPosition: string;
  checkedByName: string;
  checkedByPosition: string;
  approvedByName: string;
  approvedByPosition: string;
};

const MONTHS = [
  "All Months",
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
];


const PAYROLL_RUN_APPROVALS_KEY = "payrollRunApprovals";
const enforceSeparationOfDuties = true;
const YEAR_END_ANNUALIZATION_FILES_KEY = "yearEndTaxAnnualizationFiles";
const DEFAULT_PAYROLL_SIGNATORIES: PayrollSignatorySettings = {
  preparedByName: "Super User",
  preparedByPosition: "System Administrator",
  checkedByName: "Super User",
  checkedByPosition: "System Administrator",
  approvedByName: "Super User",
  approvedByPosition: "System Administrator",
};

const COMPANY_NAME = "COMPANY NAME";
const COMPANY_ADDRESS = "COMPANY ADDRESS";
const COMPANY_LOGO_URL = "";

const pageBackground = {
  backgroundColor: "#061a33",
  backgroundImage:
    "radial-gradient(circle at 18% 10%, rgba(14, 165, 233, 0.22), transparent 28%), linear-gradient(rgba(56, 189, 248, 0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.11) 1px, transparent 1px)",
  backgroundSize: "auto, 30px 30px, 30px 30px",
};

const panelStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.88)",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 4px 24px -8px rgba(8, 47, 73, 0.12)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 40,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #dbe4ef",
  fontSize: 14,
  fontWeight: 500,
  background: "#ffffff",
  color: "#0f172a",
  boxSizing: "border-box",
  outline: "none",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 7,
  border: "1px solid #dbe4ef",
  background: "rgba(255, 255, 255, 0.96)",
  color: "#334155",
  fontSize: 13,
  fontWeight: 500,
  padding: "7px 14px",
  cursor: "pointer",
};

const disabledButtonStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f1f5f9",
  color: "#94a3b8",
  cursor: "not-allowed",
};

const tableHeaderStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #dbe4ef",
  color: "#475569",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  background: "#f8fafc",
  lineHeight: 1.35,
};

const tableCellStyle: CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid #e6edf5",
  color: "#334155",
  verticalAlign: "middle",
  fontSize: 13,
  lineHeight: 1.45,
};

function mergeStyles(...styles: Array<CSSProperties | false | undefined>) {
  return Object.assign({}, ...styles.filter(Boolean));
}

function getPayrollRecordYear(record: PayrollRecord) {
  const explicitYear = String(record.year || "").trim();
  if (/^\d{4}$/.test(explicitYear)) return explicitYear;

  const monthYearMatch = String(record.monthYear || "").match(/^(\d{4})-/);
  if (monthYearMatch?.[1]) return monthYearMatch[1];

  const payrollDateYear = new Date(record.payrollDate || "").getFullYear();
  if (Number.isFinite(payrollDateYear)) return String(payrollDateYear);

  const createdAtYear = new Date(record.createdAt || "").getFullYear();
  return Number.isFinite(createdAtYear) ? String(createdAtYear) : "";
}


function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getAdjustedNetPay(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  const adjustedNetPay = Number(record.adjustedNetPay ?? record.netPay) || 0;
  const rawTaxAnnualizationAdjustment = getRawTaxAnnualizationAdjustment(record);

  if (Math.abs(rawTaxAnnualizationAdjustment) >= 0.01 && !shouldShowTaxAnnualization(record, files)) {
    return adjustedNetPay - rawTaxAnnualizationAdjustment;
  }

  return adjustedNetPay;
}

function getRawTaxAnnualizationAdjustment(record: PayrollRecord) {
  return (
    Number(record.taxAnnualizationAdjustment) ||
    Number(record.yearEndTaxAdjustment) ||
    Number(record.annualizationTaxAdjustment) ||
    Number(record.annualizedTaxAdjustment) ||
    Number(record.finalTaxAdjustment) ||
    0
  );
}

type SavedYearEndAnnualizationFileStatus = {
  year?: string;
  archived?: boolean;
};

function hasActiveYearEndAnnualizationFile(files: SavedYearEndAnnualizationFileStatus[], year?: string | number) {
  const targetYear = String(year || "").trim();
  if (!targetYear) return true;
  return files.some((file) => String(file.year || "").trim() === targetYear && !file.archived);
}

function shouldShowTaxAnnualization(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  return Math.abs(getRawTaxAnnualizationAdjustment(record)) >= 0.01 && hasActiveYearEndAnnualizationFile(files, record.taxAnnualizationYear || record.year);
}

function getTaxAnnualizationAdjustment(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  if (!shouldShowTaxAnnualization(record, files)) return 0;
  return getRawTaxAnnualizationAdjustment(record);
}

function getTaxAnnualizationTypeFromAmount(amount: number): "Refund" | "Additional Deduction" | "No Adjustment" {
  if (amount > 0) return "Refund";
  if (amount < 0) return "Additional Deduction";
  return "No Adjustment";
}

function normalizePayrollRecordForReports(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []): PayrollRecord {
  const taxAnnualizationAdjustment = getTaxAnnualizationAdjustment(record, files);
  const hasAnnualizationAdjustment = Math.abs(taxAnnualizationAdjustment) >= 0.01;
  const shouldShowAnnualization = shouldShowTaxAnnualization(record, files);

  return {
    ...record,
    taxAnnualizationAdjustment,
    taxAnnualizationType:
      shouldShowAnnualization
        ? record.taxAnnualizationType || getTaxAnnualizationTypeFromAmount(taxAnnualizationAdjustment)
        : "No Adjustment",
    taxAnnualizationYear: record.taxAnnualizationYear || record.year,
    taxAnnualizationSource:
      shouldShowAnnualization
        ? record.taxAnnualizationSource ||
          (hasAnnualizationAdjustment ? "Payroll Records / Year-End Tax Annualization" : "")
        : "",
    adjustedNetPay: getAdjustedNetPay(record, files),
  };
}

function normalizePayrollAdjustment(adjustment: SavedPayrollAdjustment): SavedPayrollAdjustment {
  const amount = Number(adjustment.amount) || 0;
  const adjustmentType = adjustment.adjustmentType || "Addition";
  const finalAmount = Number(adjustment.finalAmount ?? adjustment.amount) || 0;
  const computedNetPayEffect =
    adjustment.netPayEffect !== undefined
      ? Number(adjustment.netPayEffect) || 0
      : adjustmentType === "Deduction"
        ? -Math.abs(finalAmount || amount)
        : Math.abs(finalAmount || amount);

  return {
    ...adjustment,
    finalAmount: finalAmount || amount,
    netPayEffect: computedNetPayEffect,
    reason: adjustment.reason || adjustment.source || "Posted payroll adjustment",
  };
}

async function readSavedPayrollAdjustments(): Promise<SavedPayrollAdjustment[]> {
  try {
    const parsed = await getDataArray<SavedPayrollAdjustment>(storageKeys.payrollAdjustments, []);
    return parsed.map((adjustment) => normalizePayrollAdjustment(adjustment));
  } catch (error) {
    console.error("Failed to load posted payroll adjustments:", error);
    return [];
  }
}

function getPayrollRecordReferences(record: PayrollRecord): string[] {
  const references = [
    record.id,
    record.payrollReference,
    record.payrollRun,
    record.payrollRunId,
    record.payrollPeriod,
    record.periodCovered,
    record.monthYear,
    record.dateFrom && record.dateTo ? `${record.dateFrom} - ${record.dateTo}` : "",
    record.year && record.month && record.payrollPeriod ? `${record.year}-${record.month}-${record.payrollPeriod}` : "",
    record.month && record.payrollPeriod && record.year ? `${record.month} ${record.payrollPeriod} ${record.year}` : "",
  ];

  return references.filter((reference): reference is string => typeof reference === "string" && reference.trim().length > 0);
}

function payrollAdjustmentMatchesRecord(adjustment: SavedPayrollAdjustment, record: PayrollRecord) {
  const employeeMatches =
    adjustment.employeeId === record.employeeNo ||
    adjustment.employeeName === record.employeeName;

  if (!employeeMatches) return false;

  const payrollReference = (adjustment.payrollReference || "").trim();
  if (!payrollReference) return false;

  const recordReferences = getPayrollRecordReferences(record);
  const referenceMatches = recordReferences.includes(payrollReference);
  if (!referenceMatches) return false;

  const yearFromBatch = adjustment.adjustmentBatchId?.match(/(20\d{2})/)?.[1];
  if (yearFromBatch && record.year && yearFromBatch !== record.year) return false;

  return true;
}

function mergePostedAdjustmentsIntoRecord(record: PayrollRecord, postedAdjustments: SavedPayrollAdjustment[]): PayrollRecord {
  const existingAdjustments = (record.payrollAdjustments || []).map((adjustment) => normalizePayrollAdjustment(adjustment));
  const existingIds = new Set(existingAdjustments.map((adjustment) => adjustment.id));
  const existingSourceIds = new Set(existingAdjustments.map((adjustment) => adjustment.sourceId).filter(Boolean));

  const matchedAdjustments = postedAdjustments.filter((adjustment) => {
    if (!payrollAdjustmentMatchesRecord(adjustment, record)) return false;
    if (existingIds.has(adjustment.id)) return false;
    if (adjustment.sourceId && existingSourceIds.has(adjustment.sourceId)) return false;
    return true;
  });

  const payrollAdjustments = [...existingAdjustments, ...matchedAdjustments];
  const totalNetPayEffect = payrollAdjustments.reduce((sum, adjustment) => sum + (Number(adjustment.netPayEffect) || 0), 0);
  const baseNetPay = getFinalNetPay(record);

  return {
    ...record,
    payrollAdjustments,
    adjustedNetPay: baseNetPay + totalNetPayEffect,
  };
}

function hasTaxAnnualization(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  return Math.abs(getTaxAnnualizationAdjustment(record, files)) >= 0.01;
}

function getRegularNetPay(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  return (Number(record.netPay) || 0) - getTaxAnnualizationAdjustment(record, files);
}

function getFinalNetPay(record: PayrollRecord, files: SavedYearEndAnnualizationFileStatus[] = []) {
  const netPay = Number(record.netPay) || 0;
  const rawTaxAnnualizationAdjustment = getRawTaxAnnualizationAdjustment(record);

  if (Math.abs(rawTaxAnnualizationAdjustment) >= 0.01 && !shouldShowTaxAnnualization(record, files)) {
    return netPay - rawTaxAnnualizationAdjustment;
  }

  return netPay;
}

function formatNetPayEffect(value: number) {
  if (value === 0) return "No net pay effect";
  return `${value < 0 ? "-" : "+"}${formatCurrency(Math.abs(value))}`;
}

function formatDateOnly(value?: string) {
  if (!value) return "—";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

const PAYROLL_RUN_TRANSITIONS: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  Draft: ["Submitted", "Archived"],
  Submitted: ["Checked", "Archived"],
  Checked: ["Approved", "Adjusted", "Archived"],
  Approved: ["Adjusted", "Archived"],
  Adjusted: ["Submitted", "Archived"],
  Archived: [],
};

function normalizeRunStatus(status?: StoredPayrollRunStatus | string): PayrollRunStatus {
  if (status === "For Review") return "Submitted";
  if (status === "Locked") return "Approved";
  if (status === "Returned for Revision") return "Draft";
  if (status === "Submitted" || status === "Checked" || status === "Approved" || status === "Adjusted" || status === "Archived") {
    return status;
  }
  return "Draft";
}

function canTransitionPayrollRun(from: PayrollRunStatus, to: PayrollRunStatus) {
  return PAYROLL_RUN_TRANSITIONS[from].includes(to);
}

function getGovernmentDeductions(record: PayrollRecord) {
  return (Number(record.sssEe) || 0) + (Number(record.philhealthEe) || 0) + (Number(record.pagibigEe) || 0);
}

function getCutoffLabel(cutoff?: PayrollCutoffIdentity) {
  if (!cutoff) return "";
  return pickFirstString(
    cutoff.cutoffLabel,
    cutoff.cutoff,
    cutoff.cutoffId,
    [cutoff.monthYear, cutoff.cutoff].filter(Boolean).join(" ")
  );
}

function getRunCutoff(record?: PayrollRecord) {
  return record?.runCutoff || record?.cutoffIdentity;
}

function formatCutoffIdentity(cutoff?: PayrollCutoffIdentity) {
  if (!cutoff) return "—";
  const label = getCutoffLabel(cutoff) || "Cutoff";
  const monthYear = cutoff.monthYear ? `${cutoff.monthYear} ` : "";
  const range =
    cutoff.coverageStartDate || cutoff.coverageEndDate
      ? ` (${cutoff.coverageStartDate || "—"} to ${cutoff.coverageEndDate || "—"})`
      : "";
  return `${monthYear}${label}${range}`.trim();
}

function getPayrollRunCoverage(records: PayrollRecord[]) {
  const first = records[0];
  const runCutoff = getRunCutoff(first);
  const from = runCutoff?.coverageStartDate || first?.dateFrom || "";
  const to = runCutoff?.coverageEndDate || records[records.length - 1]?.dateTo || first?.dateTo || "";
  return { from, to };
}

function getPayrollRunTitle(records: PayrollRecord[]) {
  const first = records[0];
  const runCutoff = getRunCutoff(first);
  const cutoffLabel = getCutoffLabel(runCutoff) || first?.payrollPeriod || "Payroll";
  const monthYear = runCutoff?.monthYear || [first?.month, first?.year].filter(Boolean).join(" ");
  const { from, to } = getPayrollRunCoverage(records);
  const range = from || to ? ` (${from || "—"} to ${to || "—"})` : "";
  return `${monthYear || "Payroll"} ${cutoffLabel}${range}`.trim();
}

function isLateEndorsedRecord(record: PayrollRecord) {
  if (record.lateEndorsed) return true;
  const runCutoff = getRunCutoff(record);
  const workPeriodCutoff = record.workPeriodCutoff;
  if (!runCutoff || !workPeriodCutoff) return false;
  const runKey = runCutoff.cutoffId || `${runCutoff.monthYear}-${runCutoff.cutoff}`;
  const workKey = workPeriodCutoff.cutoffId || `${workPeriodCutoff.monthYear}-${workPeriodCutoff.cutoff}`;
  return runKey !== workKey;
}

function getAdjustmentNetPay(row: Omit<AdjustmentEditRow, "netPay">) {
  return Math.max(
    0,
    (Number(row.grossPay) || 0) -
      (Number(row.totalDeductions) || 0) -
      (Number(row.withholdingTax) || 0) -
      (Number(row.sssEe) || 0) -
      (Number(row.philhealthEe) || 0) -
      (Number(row.pagibigEe) || 0)
  );
}

function getChangedMoneyFields(before: PayrollRecord, after: PayrollRecord) {
  const fields: Array<keyof Pick<PayrollRecord, "grossPay" | "totalDeductions" | "withholdingTax" | "sssEe" | "philhealthEe" | "pagibigEe" | "netPay">> = [
    "grossPay",
    "totalDeductions",
    "withholdingTax",
    "sssEe",
    "philhealthEe",
    "pagibigEe",
    "netPay",
  ];
  return Object.fromEntries(
    fields
      .filter((field) => Math.abs((Number(before[field]) || 0) - (Number(after[field]) || 0)) >= 0.01)
      .map((field) => [field, { from: Number(before[field]) || 0, to: Number(after[field]) || 0 }])
  );
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

function pickFirstString(...values: unknown[]) {
  return values.map(normalizeString).find(Boolean) || "";
}

function readCurrentUserName() {
  try {
    const adminUser = getCurrentAdminUser();
    const adminName = pickFirstString(adminUser?.name, adminUser?.email);
    if (adminName) return adminName;
  } catch (error) {
    console.error("Failed to read current admin user:", error);
  }

  return "Super User";
}

async function readPayrollSignatories(): Promise<PayrollSignatorySettings> {
  try {
    const saved = await getConfigItem<Partial<PayrollSignatorySettings>>(storageKeys.signatories, {});
    if (saved.preparedByName || saved.checkedByName || saved.approvedByName) {
      return {
        preparedByName: saved.preparedByName || DEFAULT_PAYROLL_SIGNATORIES.preparedByName,
        preparedByPosition: saved.preparedByPosition || DEFAULT_PAYROLL_SIGNATORIES.preparedByPosition,
        checkedByName: saved.checkedByName || DEFAULT_PAYROLL_SIGNATORIES.checkedByName,
        checkedByPosition: saved.checkedByPosition || DEFAULT_PAYROLL_SIGNATORIES.checkedByPosition,
        approvedByName: saved.approvedByName || DEFAULT_PAYROLL_SIGNATORIES.approvedByName,
        approvedByPosition: saved.approvedByPosition || DEFAULT_PAYROLL_SIGNATORIES.approvedByPosition,
      };
    }
  } catch (error) {
    console.error("Failed to load signatories:", error);
  }
  return DEFAULT_PAYROLL_SIGNATORIES;
}

function getApprovalTone(status: PayrollRunStatus) {
  if (status === "Approved") return { background: "#dcfce7", border: "#bbf7d0", color: "#166534" };
  if (status === "Archived") return { background: "#f1f5f9", border: "#cbd5e1", color: "#475569" };
  if (status === "Adjusted") return { background: "#fff7ed", border: "#fed7aa", color: "#9a3412" };
  if (status === "Checked") return { background: "#e0f2fe", border: "#bae6fd", color: "#075985" };
  if (status === "Submitted") return { background: "#fef3c7", border: "#fde68a", color: "#92400e" };
  return { background: "#f8fafc", border: "#e2e8f0", color: "#475569" };
}

function getApprovalDisplayLabel(status: PayrollRunStatus): string {
  return status;
}

function ApprovalBadge({ status }: { status: PayrollRunStatus }) {
  const tone = getApprovalTone(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 5,
        background: tone.background,
        border: `1px solid ${tone.border}`,
        color: tone.color,
        fontWeight: 600,
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      {getApprovalDisplayLabel(status)}
    </span>
  );
}


function SummaryCard({
  label,
  value,
  tone = "default",
  helper,
}: {
  label: string;
  value: string;
  tone?: "default" | "blue" | "green" | "yellow" | "red" | "gray";
  helper?: string;
}) {
  const toneStyles = {
    default: { background: "#ffffff", border: "#e2e8f0", text: "#0f172a", accent: "#38bdf8" },
    blue: { background: "#ffffff", border: "#bae6fd", text: "#0a4f8f", accent: "#0ea5e9" },
    green: { background: "#ffffff", border: "#bbf7d0", text: "#166534", accent: "#22c55e" },
    yellow: { background: "#ffffff", border: "#fde68a", text: "#92400e", accent: "#f59e0b" },
    red: { background: "#ffffff", border: "#fecaca", text: "#9f1239", accent: "#f43f5e" },
    gray: { background: "#ffffff", border: "#e2e8f0", text: "#475569", accent: "#94a3b8" },
  }[tone];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: toneStyles.background,
        border: `1px solid ${toneStyles.border}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 12px -4px rgba(8,47,73,0.08)",
      }}
    >
      <div style={{ position: "absolute", inset: "0 18px auto", height: 1, background: `linear-gradient(90deg, transparent, ${toneStyles.accent}, transparent)`, opacity: 0.45 }} />
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 20, lineHeight: 1.2, fontWeight: 700, color: toneStyles.text }}>{value}</div>
      {helper ? (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.45 }}>{helper}</div>
      ) : null}
    </div>
  );
}

function InlineBreakdownAmount({
  value,
  onClick,
}: {
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to view breakdown"
      style={{
        border: "none",
        background: "transparent",
        color: "#0f172a",
        cursor: "pointer",
        fontWeight: 600,
        padding: 0,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        whiteSpace: "nowrap",
      }}
    >
      {formatCurrency(value)}
    </button>
  );
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 600, marginBottom: 7, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>{children}</div>;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...props.style }}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{ ...inputStyle, ...props.style }}
    />
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 190px) 1fr",
        gap: 12,
        padding: "11px 0",
        borderBottom: "1px solid #e6edf5",
      }}
    >
      <div style={{ color: "#64748b", fontWeight: 500, fontSize: 13 }}>{label}</div>
      <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>{value}</div>
    </div>
  );
}

// Reusable helper component for displaying custom premiums, allowances, and deductions
function CustomComponentList({
  title,
  items,
  tone = "blue",
}: {
  title: string;
  items?: { id?: string; name: string; amount: number }[];
  tone?: "blue" | "green" | "red";
}) {
  const filteredItems = (items || []).filter((item) => Number(item.amount) !== 0);
  if (filteredItems.length === 0) return null;

  const toneStyles = {
    blue: { background: "#eff6ff", border: "#bfdbfe", title: "#1d4ed8" },
    green: { background: "#ecfdf5", border: "#bbf7d0", title: "#047857" },
    red: { background: "#fff1f2", border: "#fecaca", title: "#be123c" },
  }[tone];

  return (
    <div
      style={{
        border: `1px solid ${toneStyles.border}`,
        background: toneStyles.background,
        borderRadius: 12,
        padding: 16,
        marginTop: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: toneStyles.title, marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {filteredItems.map((item, index) => (
          <div
            key={item.id || `${item.name}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              borderBottom: index === filteredItems.length - 1 ? "none" : "1px solid rgba(148, 163, 184, 0.35)",
              paddingBottom: index === filteredItems.length - 1 ? 0 : 8,
            }}
          >
            <span style={{ color: "#334155", fontWeight: 500 }}>{item.name}</span>
            <span style={{ color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap" }}>
              {formatCurrency(Number(item.amount) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PayrollRecordsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [deMinimisBenefits, setDeMinimisBenefits] = useState<DeMinimisBenefit[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("All Months");
  const [selectedYear, setSelectedYear] = useState("All Years");
  const [searchEmployee, setSearchEmployee] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [selectedPayrollRun, setSelectedPayrollRun] = useState<PayrollRunGroup | null>(null);
  const [selectedAdjustmentsRun, setSelectedAdjustmentsRun] = useState<PayrollRunGroup | null>(null);
  const [selectedAuditRun, setSelectedAuditRun] = useState<PayrollRunGroup | null>(null);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [breakdownTitle, setBreakdownTitle] = useState("");
  const [breakdownRows, setBreakdownRows] = useState<
    { recordId: string; label: string; amount: number }[]
  >([]);
  const [payrollRunApprovals, setPayrollRunApprovals] = useState<Record<string, StoredPayrollRunApproval>>({});
  const [payrollSignatories, setPayrollSignatories] = useState<PayrollSignatorySettings>(
    DEFAULT_PAYROLL_SIGNATORIES
  );
  const [currentUserName, setCurrentUserName] = useState("Super User");
  const [currentUserProfile, setCurrentUserProfile] = useState<AuthorizedUserProfile | null>(null);
  const [showDetailedSummary, setShowDetailedSummary] = useState(false);
  const [selectedPayrollRunIds, setSelectedPayrollRunIds] = useState<string[]>([]);
  const [recordsView, setRecordsView] = useState<"Active" | "Archived">("Active");
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);
  const [companyName, setCompanyName] = useState("");
  const [yearEndAnnualizationFiles, setYearEndAnnualizationFiles] = useState<SavedYearEndAnnualizationFileStatus[]>([]);
  const [selectedPayrollRunAuditEntries, setSelectedPayrollRunAuditEntries] = useState<AuditEntry[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [actionLoading, setActionLoading] = useState("");
  const [adjustmentModal, setAdjustmentModal] = useState<AdjustmentModalState | null>(null);
  useEffect(() => {
    if (!selectedPayrollRun) { setSelectedPayrollRunAuditEntries([]); return; }
    getAuditsByEntity("PayrollRun", selectedPayrollRun.id).then(setSelectedPayrollRunAuditEntries);
  }, [selectedPayrollRun]);


    useEffect(() => {
      async function loadRecords() {
        try {
          const [stored, postedAdjustments, yearEndFiles] = await Promise.all([
            getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
            readSavedPayrollAdjustments(),
            getDataArray<SavedYearEndAnnualizationFileStatus>(YEAR_END_ANNUALIZATION_FILES_KEY, []),
          ]);
          setYearEndAnnualizationFiles(yearEndFiles);
          const normalizedRecords = stored
            .map((record) => normalizePayrollRecordForReports(record, yearEndFiles))
            .map((record) => mergePostedAdjustmentsIntoRecord(record, postedAdjustments));
          setRecords(normalizedRecords);
        } catch (error) {
          console.error("Failed to load payroll records:", error);
          setRecords([]);
        }
      }

      loadRecords();
      window.addEventListener("payroll-records-updated", loadRecords as EventListener);
      window.addEventListener("payroll-adjustments-updated", loadRecords as EventListener);

      return () => {
        window.removeEventListener("payroll-records-updated", loadRecords as EventListener);
        window.removeEventListener("payroll-adjustments-updated", loadRecords as EventListener);
      };
    }, []);

  useEffect(() => {
    async function loadDeMinimisBenefits() {
      const savedBenefits = await getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits);
      setDeMinimisBenefits(savedBenefits.filter((benefit) => !benefit.archived));
    }

    loadDeMinimisBenefits();
    window.addEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);
    return () => {
      window.removeEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);
    };
  }, []);

  useEffect(() => {
    async function loadTheme() {
      const savedTheme = await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME);
      const normalized = normalizeTheme(savedTheme);
      setTheme(normalized);
      applyAppTheme(normalized);
      const companyInfo = await getConfigItem<{ companyName?: string }>(storageKeys.companyInformation, {});
      setCompanyName(companyInfo.companyName ?? "");
    }

    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    };
  }, []);

  useEffect(() => {
    async function loadApprovalData() {
      try {
        const [signatories, approvals, userProfile] = await Promise.all([
          readPayrollSignatories(),
          getConfigItem<Record<string, StoredPayrollRunApproval>>(storageKeys.payrollRunApprovals, {}),
          getAuthorizedUserProfile(),
        ]);
        setPayrollSignatories(signatories);
        setCurrentUserName(readCurrentUserName());
        setCurrentUserProfile(userProfile);
        setPayrollRunApprovals(typeof approvals === "object" ? approvals : {});
      } catch (error) {
        console.error("Failed to load payroll approval data:", error);
        setPayrollRunApprovals({});
        setPayrollSignatories(DEFAULT_PAYROLL_SIGNATORIES);
      }
    }

    loadApprovalData();
  }, []);

  const departments = useMemo(() => {
    return [
      "All Departments",
      ...Array.from(new Set(records.map((record) => record.department).filter(Boolean))),
    ];
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesMonth = selectedMonth === "All Months" || record.month === selectedMonth;
      const matchesYear = selectedYear === "All Years" || getPayrollRecordYear(record) === selectedYear;
      const matchesDepartment =
        selectedDepartment === "All Departments" || record.department === selectedDepartment;
      const matchesEmployee =
        searchEmployee.trim() === "" ||
        record.employeeName.toLowerCase().includes(searchEmployee.toLowerCase()) ||
        record.employeeNo.toLowerCase().includes(searchEmployee.toLowerCase());
      const matchesArchiveView =
        recordsView === "Archived" ? record.archiveStatus === "Archived" : record.archiveStatus !== "Archived";

      return matchesMonth && matchesYear && matchesDepartment && matchesEmployee && matchesArchiveView;
    });
  }, [records, recordsView, searchEmployee, selectedDepartment, selectedMonth, selectedYear]);

  const selectedRecordDeMinimisLines = useMemo(() => {
    if (!selectedRecord) return [];
    const cutoff = selectedRecord.workPeriodCutoff ||
      getRunCutoff(selectedRecord) ||
      selectedRecord.cutoffIdentity || {
        monthYear: selectedRecord.monthYear || `${selectedRecord.year}-${selectedRecord.month}`,
        cutoff: selectedRecord.payrollPeriod || "",
        cutoffLabel: selectedRecord.payrollPeriod || "",
        payDate: selectedRecord.payrollDate || "",
        payrollDate: selectedRecord.payrollDate || "",
      };
    return getDeMinimisForCutoff(
      {
        employeeNo: selectedRecord.employeeNo,
        employeeType: selectedRecord.employeeType,
        employmentStatus: selectedRecord.employmentStatus,
      },
      cutoff,
      deMinimisBenefits
    );
  }, [deMinimisBenefits, selectedRecord]);

  const payrollRunGroups = useMemo<PayrollRunGroup[]>(() => {
    const grouped = new Map<string, PayrollRecord[]>();

    filteredRecords.forEach((record) => {
      const payrollPeriod = (record.payrollPeriod || "Monthly Payroll").trim();
      const runCutoff = getRunCutoff(record);
      const groupKey =
        record.payrollRunId ||
        record.bulkRunId ||
        [runCutoff?.monthYear || `${record.year}-${record.month}`, runCutoff?.cutoffId || runCutoff?.cutoff || payrollPeriod].join("-");
      const currentRecords = grouped.get(groupKey) || [];
      currentRecords.push(record);
      grouped.set(groupKey, currentRecords);
    });

    return Array.from(grouped.entries()).map(([groupKey, groupRecords]) => {
      const firstRecord = groupRecords[0];
      const payrollPeriod = firstRecord?.payrollPeriod || "Monthly Payroll";
      const title = getPayrollRunTitle(groupRecords);
      const payrollRunIdentity = buildPayrollRunIdentity(groupKey, groupRecords);

      return groupRecords.reduce<PayrollRunGroup>(
        (acc, record) => {
          acc.basicPay += Number(record.basicPay) || 0;
          acc.payrollPremium += Number(record.totalPayrollPremium) || 0;
          acc.allowances += Number(record.totalAllowances) || 0;
          acc.grossPay += Number(record.grossPay) || 0;
          acc.deductions += Number(record.totalDeductions) || 0;
          acc.withholdingTax += Number(record.withholdingTax) || 0;
          acc.regularNetPay += getRegularNetPay(record);
          acc.taxAnnualizationAdjustment += getTaxAnnualizationAdjustment(record);
          acc.hasTaxAnnualization = acc.hasTaxAnnualization || hasTaxAnnualization(record);
          acc.netPay += Number(record.netPay) || 0;
          acc.adjustedNetPay += getAdjustedNetPay(record);
          acc.adjustmentsCount += record.payrollAdjustments?.length || 0;
          acc.employerContributions += Number(record.employerContributions) || 0;
          return acc;
        },
        {
          id: payrollRunIdentity,
          title,
          month: firstRecord?.month || "",
          year: firstRecord?.year || "",
          payrollPeriod,
          payrollDate: firstRecord?.payrollDate || "",
          createdAt: firstRecord?.createdAt || "",
          records: groupRecords,
          employeesCount: groupRecords.length,
          basicPay: 0,
          payrollPremium: 0,
          allowances: 0,
          grossPay: 0,
          deductions: 0,
          withholdingTax: 0,
          netPay: 0,
          regularNetPay: 0,
          taxAnnualizationAdjustment: 0,
          hasTaxAnnualization: false,
          adjustedNetPay: 0,
          adjustmentsCount: 0,
          employerContributions: 0,
        }
      );
    });
  }, [filteredRecords]);

  useEffect(() => {
    const visibleRunIds = new Set(payrollRunGroups.map((group) => group.id));
    setSelectedPayrollRunIds((current) => current.filter((id) => visibleRunIds.has(id)));
  }, [payrollRunGroups]);

  const hasAnyYearEndTaxInFilteredRuns = payrollRunGroups.some(
    (group) => group.hasTaxAnnualization
  );
  const hasAnyPayrollAdjustmentInFilteredRuns = payrollRunGroups.some(
  (group) => Math.abs(Number(group.adjustedNetPay || 0) - Number(group.netPay || 0)) >= 0.01
);

  useEffect(() => {
    const view = searchParams.get("view");
    const recordId = searchParams.get("id");
    const runId = searchParams.get("runId");

    if (view === "record" && recordId && records.length > 0) {
      const matchedRecord = records.find((record) => record.id === recordId);

      if (matchedRecord) {
        setSelectedPayrollRun(null);
        setSelectedAdjustmentsRun(null);
        setBreakdownTitle("");
        setBreakdownRows([]);
        setSelectedRecord(matchedRecord);
      }

      return;
    }

    if (view === "bulk" && runId && payrollRunGroups.length > 0) {
      const matchedRun = payrollRunGroups.find((group) => group.id === runId);

      if (matchedRun) {
        setSelectedRecord(null);
        setSelectedAdjustmentsRun(null);
        setBreakdownTitle("");
        setBreakdownRows([]);
        setSelectedPayrollRun(matchedRun);
      }
    }
  }, [payrollRunGroups, records, searchParams]);

  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, record) => {
        acc.basicPay += Number(record.basicPay) || 0;
        acc.payrollPremium += Number(record.totalPayrollPremium) || 0;
        acc.allowances += Number(record.totalAllowances) || 0;
        acc.grossPay += Number(record.grossPay) || 0;
        acc.employeeContributions += getGovernmentDeductions(record);
        acc.sssEe += Number(record.sssEe) || 0;
        acc.philhealthEe += Number(record.philhealthEe) || 0;
        acc.pagibigEe += Number(record.pagibigEe) || 0;
        acc.withholdingTax += Number(record.withholdingTax) || 0;
        acc.regularNetPay += getRegularNetPay(record);
        acc.taxAnnualizationAdjustment += getTaxAnnualizationAdjustment(record);
        acc.netPay += Number(record.netPay) || 0;
        acc.adjustedNetPay += getAdjustedNetPay(record);
        acc.adjustmentsCount += record.payrollAdjustments?.length || 0;
        acc.employerContributions += Number(record.employerContributions) || 0;
        return acc;
      },
      {
        basicPay: 0,
        payrollPremium: 0,
        allowances: 0,
        grossPay: 0,
        employeeContributions: 0,
        sssEe: 0,
        philhealthEe: 0,
        pagibigEe: 0,
        withholdingTax: 0,
        regularNetPay: 0,
        taxAnnualizationAdjustment: 0,
        netPay: 0,
        adjustedNetPay: 0,
        adjustmentsCount: 0,
        employerContributions: 0,
      }
    );
  }, [filteredRecords]);

  const availableYears = useMemo(() => {
    const years = new Set(records.map((record) => getPayrollRecordYear(record)).filter(Boolean));
    return ["All Years", ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
  }, [records]);

  const selectedPeriodLabel = `${selectedMonth === "All Months" ? "All Months" : selectedMonth} ${
    selectedYear === "All Years" ? "" : selectedYear
  }`.trim();

  const getPayrollRunApproval = (payrollRun: PayrollRunGroup): PayrollRunApproval => {
    const storedApproval = payrollRunApprovals[payrollRun.id];
    const normalizedStatus = normalizeRunStatus(storedApproval?.status);

    if (storedApproval) {
      const payrollRunCreatedAt = new Date(payrollRun.createdAt || "").getTime();
      const latestApprovalTime = Math.max(
        new Date(storedApproval.preparedAt || "").getTime() || 0,
        new Date(storedApproval.checkedAt || "").getTime() || 0,
        new Date(storedApproval.approvedAt || "").getTime() || 0,
        new Date(storedApproval.lockedAt || "").getTime() || 0,
        new Date(storedApproval.returnedAt || "").getTime() || 0
      );

      if (
        Number.isFinite(payrollRunCreatedAt) &&
        payrollRunCreatedAt > 0 &&
        latestApprovalTime > 0 &&
        payrollRunCreatedAt > latestApprovalTime
      ) {
        return {
          status: "Draft",
          preparedByName: currentUserName || payrollSignatories.preparedByName,
          preparedByPosition: payrollSignatories.preparedByPosition,
          preparedAt: payrollRun.createdAt,
        };
      }

      return {
        ...storedApproval,
        status: normalizedStatus,
        preAdjustSnapshot: storedApproval.preAdjustSnapshot
          ? {
              ...storedApproval.preAdjustSnapshot,
              status: normalizeRunStatus(storedApproval.preAdjustSnapshot.status),
            }
          : undefined,
      } as PayrollRunApproval;
    }

    return {
      status: "Draft",
      preparedByName: currentUserName || payrollSignatories.preparedByName,
      preparedByPosition: payrollSignatories.preparedByPosition,
      preparedAt: payrollRun.createdAt,
    };
  };

  const savePayrollRunApproval = async (payrollRunId: string, nextApproval: PayrollRunApproval) => {
    const nextApprovals = {
      ...payrollRunApprovals,
      [payrollRunId]: nextApproval,
    };

    setPayrollRunApprovals(nextApprovals);
    await setConfigItem(storageKeys.payrollRunApprovals, nextApprovals);
  };

  const isAdmin = currentUserProfile?.role === "admin";

  const requestExportStub = async (payrollRuns: PayrollRunGroup[], label: string) => {
    if (payrollRuns.length === 0) {
      window.alert("Please select at least one payroll run first.");
      return;
    }
    try {
      const exportRuns: ExportablePayrollRun[] = payrollRuns.map((run) => ({
        id: run.id,
        title: run.title,
        period: run.payrollPeriod,
        payDate: run.payrollDate,
        approvalStatus: getPayrollRunApproval(run).status || "Draft",
        records: run.records as ExportablePayrollRun["records"],
      }));
      await exportPayrollRunsToExcel(exportRuns, {
        companyName,
        fileLabel: payrollRuns.length === 1 ? undefined : label.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_"),
      });
      payrollRuns.forEach((run) =>
        logAudit({
          action: "EXPORTED",
          entityType: "PayrollRun",
          entityId: run.id,
          entityName: run.title,
          details: `Exported detailed payroll register to Excel (${run.records.length} record${run.records.length !== 1 ? "s" : ""}).`,
        })
      );
    } catch (error) {
      console.error("Failed to export payroll runs", error);
      window.alert("Failed to export payroll records. Please try again.");
    }
  };

  const togglePayrollRunSelection = (payrollRunId: string) => {
    setSelectedPayrollRunIds((current) =>
      current.includes(payrollRunId)
        ? current.filter((id) => id !== payrollRunId)
        : [...current, payrollRunId]
    );
  };

  const toggleAllPayrollRuns = () => {
    const visibleRunIds = payrollRunGroups.map((group) => group.id);
    const allVisibleSelected = visibleRunIds.every((id) => selectedPayrollRunIds.includes(id));

    setSelectedPayrollRunIds(allVisibleSelected ? [] : visibleRunIds);
  };

  const buildNextApproval = (
    payrollRun: PayrollRunGroup,
    currentApproval: PayrollRunApproval,
    nextStatus: PayrollRunStatus,
    now: string
  ): PayrollRunApproval => {
    const actingUid = currentUserProfile?.uid;
    if (nextStatus === "Submitted") {
      return {
        ...currentApproval,
        status: "Submitted",
        preparedByName: currentUserName || payrollSignatories.preparedByName,
        preparedByPosition: payrollSignatories.preparedByPosition,
        preparedAt: now,
        preparedByUid: actingUid || currentApproval.preparedByUid,
      };
    }
    if (nextStatus === "Checked") {
      return {
        ...currentApproval,
        status: "Checked",
        checkedByName: currentUserName || payrollSignatories.checkedByName,
        checkedByPosition: payrollSignatories.checkedByPosition,
        checkedAt: now,
        checkedByUid: actingUid,
      };
    }
    if (nextStatus === "Approved") {
      return {
        ...currentApproval,
        status: "Approved",
        approvedByName: currentUserName || payrollSignatories.approvedByName,
        approvedByPosition: payrollSignatories.approvedByPosition,
        approvedAt: now,
        lockedAt: now,
        approvedByUid: actingUid,
      };
    }
    if (nextStatus === "Archived") {
      return {
        ...currentApproval,
        status: "Archived",
      };
    }
    return { ...currentApproval, status: nextStatus };
  };

  const getTransitionError = (payrollRun: PayrollRunGroup, nextStatus: PayrollRunStatus) => {
    const approval = getPayrollRunApproval(payrollRun);
    const currentStatus = approval.status;
    const actingUid = currentUserProfile?.uid;
    if (!canTransitionPayrollRun(currentStatus, nextStatus)) {
      return `Invalid transition: ${currentStatus} cannot move to ${nextStatus}.`;
    }
    if (nextStatus === "Checked" && enforceSeparationOfDuties && actingUid && approval.preparedByUid === actingUid) {
      return "Separation of duties: you cannot check a payroll run you prepared.";
    }
    if (
      nextStatus === "Approved" &&
      enforceSeparationOfDuties &&
      actingUid &&
      (approval.preparedByUid === actingUid || approval.checkedByUid === actingUid)
    ) {
      return "Separation of duties: you cannot approve a payroll run you prepared or checked.";
    }
    return "";
  };

  const applyPayrollRunStatus = async (payrollRuns: PayrollRunGroup[], nextStatus: PayrollRunStatus, detail = "") => {
    if (payrollRuns.length === 0) return;
    setActionLoading(`${nextStatus} payroll run${payrollRuns.length === 1 ? "" : "s"}...`);
    try {
      const now = new Date().toISOString();
      const nextApprovals: Record<string, StoredPayrollRunApproval> = { ...payrollRunApprovals };
      payrollRuns.forEach((payrollRun) => {
        nextApprovals[payrollRun.id] = buildNextApproval(payrollRun, getPayrollRunApproval(payrollRun), nextStatus, now);
      });
      setPayrollRunApprovals(nextApprovals);
      await setConfigItem(storageKeys.payrollRunApprovals, nextApprovals);

      if (nextStatus === "Archived") {
        const recordIds = new Set(payrollRuns.flatMap((payrollRun) => payrollRun.records.map((record) => record.id)));
        const latestPayrollRecords = await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords);
        const nextPayrollRecords = latestPayrollRecords.map((record) =>
          recordIds.has(record.id)
            ? {
                ...record,
                archiveStatus: "Archived" as const,
                archivedAt: now,
                archivedBy: currentUserName,
              }
            : record
        );
        await setCollectionItems(storageKeys.payrollRecords, nextPayrollRecords.map((record) => ({ ...record, id: record.id })));
        setRecords(nextPayrollRecords.map((record) => normalizePayrollRecordForReports(record, yearEndAnnualizationFiles)));
        window.dispatchEvent(new Event("payroll-records-updated"));
      }

      const auditAction = nextStatus === "Submitted" ? "SUBMITTED" : nextStatus === "Checked" ? "CHECKED" : nextStatus === "Approved" ? "APPROVED" : "ARCHIVED";
      payrollRuns.forEach((payrollRun) => {
        logAudit({
          action: auditAction,
          entityType: "PayrollRun",
          entityId: payrollRun.id,
          entityName: payrollRun.title,
          details: detail || `${payrollRun.title} moved to ${nextStatus}.`,
        });
      });
      setSelectedPayrollRunIds([]);
      setOpenActionsMenuId(null);
      if (nextStatus === "Archived") setSelectedPayrollRun(null);
    } finally {
      setActionLoading("");
    }
  };

  const requestPayrollRunStatus = (payrollRuns: PayrollRunGroup[], nextStatus: PayrollRunStatus, title: string, message: string) => {
    const eligibleRuns = payrollRuns.filter((payrollRun) => !getTransitionError(payrollRun, nextStatus));
    if (eligibleRuns.length === 0) {
      window.alert(payrollRuns[0] ? getTransitionError(payrollRuns[0], nextStatus) : "Please select at least one payroll run first.");
      return;
    }
    setConfirmModal({
      title,
      message: `${message}${eligibleRuns.length !== payrollRuns.length ? ` ${payrollRuns.length - eligibleRuns.length} selected run(s) are not eligible and will be skipped.` : ""}`,
      actionLabel: nextStatus,
      tone: nextStatus === "Archived" ? "amber" : nextStatus === "Approved" ? "green" : "default",
      onConfirm: () => applyPayrollRunStatus(eligibleRuns, nextStatus, `Status changed to ${nextStatus}.`),
    });
  };

  const handleBulkPayrollRunApprovalAction = (action: "submit" | "check" | "approve") => {
    const selectedRuns = payrollRunGroups.filter((group) => selectedPayrollRunIds.includes(group.id));
    if (selectedRuns.length === 0) {
      window.alert("Please select at least one payroll run first.");
      return;
    }
    const nextStatus = action === "submit" ? "Submitted" : action === "check" ? "Checked" : "Approved";
    requestPayrollRunStatus(
      selectedRuns,
      nextStatus,
      `${nextStatus} selected runs`,
      `This will move ${selectedRuns.length} selected payroll run(s) to ${nextStatus}.`
    );
  };

  const updatePayrollRunArchiveStatus = (payrollRun: PayrollRunGroup) => {
    requestPayrollRunStatus(
      [payrollRun],
      "Archived",
      "Archive payroll run",
      "This will archive the payroll run. Archived runs are immutable and remain visible only in the Archive tab."
    );
  };

  const handleBulkArchiveAction = () => {
    const selectedRuns = payrollRunGroups.filter((group) => selectedPayrollRunIds.includes(group.id));
    if (selectedRuns.length === 0) {
      window.alert("Please select at least one payroll run first.");
      return;
    }
    requestPayrollRunStatus(
      selectedRuns,
      "Archived",
      "Archive selected runs",
      `This will archive ${selectedRuns.length} selected payroll run(s). Archived runs are immutable.`
    );
  };

  const handlePayrollRunApprovalAction = (payrollRun: PayrollRunGroup, action: "submit" | "check" | "approve") => {
    setOpenActionsMenuId(null);
    const nextStatus = action === "submit" ? "Submitted" : action === "check" ? "Checked" : "Approved";
    requestPayrollRunStatus(
      [payrollRun],
      nextStatus,
      `${nextStatus} payroll run`,
      `This will move ${payrollRun.title} to ${nextStatus} and record the current user and timestamp.`
    );
  };

  const handleAdjustAction = (payrollRun: PayrollRunGroup) => {
    setOpenActionsMenuId(null);
    const currentApproval = getPayrollRunApproval(payrollRun);

    if (currentApproval.status !== "Approved" && currentApproval.status !== "Checked") {
      window.alert("Adjust is only available for Approved or Checked payroll runs.");
      return;
    }

    setAdjustmentModal({
      payrollRun,
      previousApproval: currentApproval,
      originalRunSnapshot: payrollRun.records.map((record) => ({ ...record })),
      reason: "",
      rows: payrollRun.records.map((record) => ({
        recordId: record.id,
        employeeNo: record.employeeNo,
        employeeName: record.employeeName,
        grossPay: Number(record.grossPay) || 0,
        totalDeductions: Number(record.totalDeductions) || 0,
        withholdingTax: Number(record.withholdingTax) || 0,
        sssEe: Number(record.sssEe) || 0,
        philhealthEe: Number(record.philhealthEe) || 0,
        pagibigEe: Number(record.pagibigEe) || 0,
        netPay: Number(record.netPay) || 0,
      })),
    });
  };

  const saveAdjustmentModal = async () => {
    if (!adjustmentModal) return;
    const reason = adjustmentModal.reason.trim();
    if (!reason) {
      window.alert("A reason is required before saving an adjustment.");
      return;
    }

    setConfirmModal({
      title: "Save adjustment",
      message: "This will update affected pay lines, floor net pay at zero, set the run to Adjusted, and require re-Check/re-Approve.",
      actionLabel: "Save Adjustment",
      tone: "amber",
      onConfirm: async () => {
        setActionLoading("Saving payroll adjustment...");
        try {
          const now = new Date().toISOString();
          const rowMap = new Map(adjustmentModal.rows.map((row) => [row.recordId, row]));
          const originalMap = new Map(adjustmentModal.originalRunSnapshot.map((record) => [record.id, record]));
          const runRecordIds = new Set(adjustmentModal.payrollRun.records.map((record) => record.id));
          const latestPayrollRecords = await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords);
          const changedLines: Array<{
            employeeNo: string;
            employeeName: string;
            before: Partial<PayrollRecord>;
            after: Partial<PayrollRecord>;
            diff: Record<string, { from: number; to: number }>;
          }> = [];

          const nextPayrollRecords = latestPayrollRecords.map((record) => {
            if (!runRecordIds.has(record.id)) return record;
            const editRow = rowMap.get(record.id);
            const originalRecord = originalMap.get(record.id) || record;
            if (!editRow) return record;
            const nextRecord: PayrollRecord = {
              ...record,
              grossPay: Number(editRow.grossPay) || 0,
              totalDeductions: Number(editRow.totalDeductions) || 0,
              withholdingTax: Number(editRow.withholdingTax) || 0,
              sssEe: Number(editRow.sssEe) || 0,
              philhealthEe: Number(editRow.philhealthEe) || 0,
              pagibigEe: Number(editRow.pagibigEe) || 0,
              netPay: getAdjustmentNetPay(editRow),
              payrollChangeHistory: [
                ...(record.payrollChangeHistory || []),
                {
                  id: `payroll-adjustment-${record.id}-${Date.now()}`,
                  action: "Payroll run adjusted",
                  editedBy: currentUserName,
                  changedAt: now,
                  reason,
                  details: "Per-employee payroll run adjustment.",
                },
              ],
            };
            const diff = getChangedMoneyFields(originalRecord, nextRecord) as Record<string, { from: number; to: number }>;
            if (Object.keys(diff).length > 0) {
              changedLines.push({
                employeeNo: record.employeeNo,
                employeeName: record.employeeName,
                before: {
                  grossPay: Number(originalRecord.grossPay) || 0,
                  totalDeductions: Number(originalRecord.totalDeductions) || 0,
                  withholdingTax: Number(originalRecord.withholdingTax) || 0,
                  sssEe: Number(originalRecord.sssEe) || 0,
                  philhealthEe: Number(originalRecord.philhealthEe) || 0,
                  pagibigEe: Number(originalRecord.pagibigEe) || 0,
                  netPay: Number(originalRecord.netPay) || 0,
                },
                after: {
                  grossPay: nextRecord.grossPay,
                  totalDeductions: nextRecord.totalDeductions,
                  withholdingTax: nextRecord.withholdingTax,
                  sssEe: nextRecord.sssEe,
                  philhealthEe: nextRecord.philhealthEe,
                  pagibigEe: nextRecord.pagibigEe,
                  netPay: nextRecord.netPay,
                },
                diff,
              });
            }
            return nextRecord;
          });

          await setCollectionItems(storageKeys.payrollRecords, nextPayrollRecords.map((record) => ({ ...record, id: record.id })));
          const { preAdjustSnapshot: _previousSnapshot, ...approvalSnapshot } = adjustmentModal.previousApproval;
          void _previousSnapshot;
          await savePayrollRunApproval(adjustmentModal.payrollRun.id, {
            ...adjustmentModal.previousApproval,
            status: "Adjusted",
            adjustedAt: now,
            adjustedByName: currentUserName,
            adjustedByUid: currentUserProfile?.uid,
            adjustReason: reason,
            checkedAt: undefined,
            checkedByName: undefined,
            checkedByPosition: undefined,
            checkedByUid: undefined,
            approvedAt: undefined,
            approvedByName: undefined,
            approvedByPosition: undefined,
            approvedByUid: undefined,
            lockedAt: undefined,
            preAdjustSnapshot: approvalSnapshot,
          });
          setRecords(nextPayrollRecords.map((record) => normalizePayrollRecordForReports(record, yearEndAnnualizationFiles)));
          logAudit({
            action: "EDITED",
            entityType: "PayrollRun",
            entityId: adjustmentModal.payrollRun.id,
            entityName: adjustmentModal.payrollRun.title,
            details: JSON.stringify({
              event: "PAYROLL_RUN_ADJUSTED",
              reason,
              adjustedBy: { uid: currentUserProfile?.uid, name: currentUserName },
              adjustedAt: now,
              previousStatus: adjustmentModal.previousApproval.status,
              nextStatus: "Adjusted",
              originalRunSnapshot: adjustmentModal.originalRunSnapshot,
              changedLines,
            }),
          });
          setAdjustmentModal(null);
          setSelectedPayrollRun(null);
          setSelectedPayrollRunIds([]);
          window.dispatchEvent(new Event("payroll-records-updated"));
        } finally {
          setActionLoading("");
        }
      },
    });
  };
  const openRecordById = (recordId: string) => {
    const matchedRecord = records.find((record) => record.id === recordId);
    if (!matchedRecord) return;
    setSelectedRecord(matchedRecord);
  };



  const openCrossRecordBreakdown = (
    title: string,
    amountGetter: (record: PayrollRecord) => number
  ) => {
    const rows = filteredRecords.map((record) => ({
      recordId: record.id,
      label: `${record.month} ${record.year}`,
      amount: amountGetter(record),
    }));

    setBreakdownTitle(title);
    setBreakdownRows(rows);
  };

  const openPayrollRunBreakdown = (
    payrollRun: PayrollRunGroup,
    title: string,
    amountGetter: (record: PayrollRecord) => number
  ) => {
    const rows = payrollRun.records.map((record) => ({
      recordId: record.id,
      label: `${record.employeeName} • ${record.employeeNo}`,
      amount: amountGetter(record),
    }));

    setSelectedRecord(null);
    setSelectedPayrollRun(null);
    setSelectedAdjustmentsRun(null);
    setBreakdownTitle(`${payrollRun.title} - ${title}`);
    setBreakdownRows(rows);
  };
  const getPayrollRunAdjustments = (payrollRun: PayrollRunGroup) => {
    return payrollRun.records.flatMap((record) =>
      (record.payrollAdjustments || []).map((adjustment) => ({
        ...adjustment,
        recordId: record.id,
        employeeNo: record.employeeNo,
      }))
    );
  };

  const getPayrollRunAuditRows = (payrollRun: PayrollRunGroup) => {
    const approval = getPayrollRunApproval(payrollRun);
    const rows = [
      {
        action: "Payroll run created / prepared",
        user: approval.preparedByName || payrollSignatories.preparedByName || "—",
        role: approval.preparedByPosition || payrollSignatories.preparedByPosition || "—",
        timestamp: approval.preparedAt || payrollRun.createdAt || "",
        details: `${payrollRun.title} with ${payrollRun.employeesCount} employee(s).`,
      },
      approval.checkedAt
        ? {
            action: "Payroll run checked",
            user: approval.checkedByName || "—",
            role: approval.checkedByPosition || "—",
            timestamp: approval.checkedAt,
            details: "Payroll run was marked as checked.",
          }
        : null,
      approval.approvedAt
        ? {
            action: "Payroll run approved",
            user: approval.approvedByName || "—",
            role: approval.approvedByPosition || "—",
            timestamp: approval.approvedAt,
            details: approval.lockedAt ? `Payroll run was approved and locked on ${formatDateTime(approval.lockedAt)}.` : "Payroll run was approved.",
          }
        : null,
      approval.returnedAt
        ? {
            action: "Returned for revision",
            user: approval.preparedByName || payrollSignatories.preparedByName || "—",
            role: approval.preparedByPosition || payrollSignatories.preparedByPosition || "—",
            timestamp: approval.returnedAt,
            details: approval.returnReason || "Returned for revision.",
          }
        : null,
      approval.adjustedAt
        ? {
            action: "Payroll run adjusted",
            user: approval.adjustedByName || "—",
            role: "—",
            timestamp: approval.adjustedAt,
            details: `Reason: ${approval.adjustReason || "No reason provided."} Previous status: ${approval.preAdjustSnapshot?.status || "Unknown"}.`,
          }
        : null,
      ...payrollRun.records.flatMap((record) =>
        (record.payrollChangeHistory || []).map((history) => ({
          action: history.action || "Payroll record updated",
          user: history.editedBy || "—",
          role: record.employeeNo,
          timestamp: history.changedAt,
          details: history.details || history.reason || `${record.employeeName} payroll record changed.`,
        }))
      ),
      ...getPayrollRunAdjustments(payrollRun).map((adjustment) => ({
        action: "Payroll adjustment posted",
        user: adjustment.source || "Payroll Adjustments",
        role: adjustment.employeeNo || adjustment.employeeId || "—",
        timestamp: adjustment.createdAt,
        details: `${adjustment.employeeName}: ${adjustment.adjustmentLabel || adjustment.adjustmentCategory} (${formatNetPayEffect(Number(adjustment.netPayEffect || 0))})`,
      })),
    ].filter(Boolean) as { action: string; user: string; role: string; timestamp: string; details: string }[];

    return rows.sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
  };

  const handleEditAdjustment = async (adjustment: SavedPayrollAdjustment) => {
    await setConfigItem(storageKeys.payrollAdjustmentEditDraft, adjustment);
    router.push("/payroll-adjustments?mode=edit");
  };


  const handleViewDetailedPayrollRun = async (payrollRun: PayrollRunGroup) => {
    await setConfigItem("readonlyPayrollRunView", {
      id: payrollRun.id,
      title: payrollRun.title,
      payrollDate: payrollRun.payrollDate,
      createdAt: payrollRun.createdAt,
      // Draft runs are recomputed live from current premium multipliers in the viewer; finalized
      // runs (Submitted/Approved/etc.) always show their saved snapshot.
      status: getPayrollRunApproval(payrollRun).status,
      records: payrollRun.records,
    });
    router.push("/add-payroll?mode=view-payroll-run");
  };

  const handleViewPayslip = () => {
    if (!selectedRecord) return;

    const payrollPeriod = `${selectedRecord.month} ${selectedRecord.year}`;
    const premiumBreakdown = [
      {
        label: "Night Differentials",
        amount: Number((selectedRecord as any).nightDifferentialAmount) || 0,
      },
      {
        label: "Overtime",
        amount: Number((selectedRecord as any).overtimeAmount) || 0,
      },
      {
        label: "Rest Day / Day Off Work",
        amount: Number((selectedRecord as any).restDayAmount) || 0,
      },
      {
        label: "Special Holiday Premium",
        amount: Number((selectedRecord as any).specialHolidayAmount) || 0,
      },
      ...(
        (((selectedRecord as any).customPremiums as { name: string; amount: number }[] | undefined) || [])
          .map((item) => ({
            label: item.name,
            amount: Number(item.amount) || 0,
          }))
      ),
    ].filter((item) => item.amount !== 0);

    const fallbackPremiumBreakdown =
      premiumBreakdown.length === 0 && Number(selectedRecord.totalPayrollPremium) !== 0
        ? [
            {
              label: "Payroll Premiums",
              amount: Number(selectedRecord.totalPayrollPremium) || 0,
            },
          ]
        : premiumBreakdown;

    const allowanceBreakdown = [
      { label: "Rice Subsidy", amount: Number((selectedRecord as any).riceSubsidy) || 0 },
      { label: "Uniform / Clothing", amount: Number((selectedRecord as any).uniformClothing) || 0 },
      { label: "Laundry Allowance", amount: Number((selectedRecord as any).laundryAllowance) || 0 },
      {
        label: "Medical Cash (dependents)",
        amount: Number((selectedRecord as any).medicalCashDependents) || 0,
      },
      {
        label: "Actual Medical Assistance",
        amount: Number((selectedRecord as any).actualMedicalAssistance) || 0,
      },
      { label: "Achievement Awards", amount: Number((selectedRecord as any).achievementAwards) || 0 },
      {
        label: "Christmas / Anniversary Gifts",
        amount: Number((selectedRecord as any).christmasAnniversaryGifts) || 0,
      },
      {
        label: "Meal Allowance (OT/night)",
        amount: Number((selectedRecord as any).mealAllowanceOTNight) || 0,
      },
      {
        label: "Monetized Leave (private)",
        amount: Number((selectedRecord as any).monetizedLeavePrivate) || 0,
      },
      {
        label: "CBA / Productivity Incentives",
        amount: Number((selectedRecord as any).cbaProductivityIncentives) || 0,
      },
      { label: "13th Month Pay", amount: Number((selectedRecord as any).thirteenthMonthPay) || 0 },
      { label: "Christmas Bonus", amount: Number((selectedRecord as any).christmasBonus) || 0 },
      {
        label: "Other Taxable Allowances",
        amount: Number((selectedRecord as any).otherTaxableAllowances) || 0,
      },
      ...(
        (((selectedRecord as any).customAllowances as { name: string; amount: number }[] | undefined) || [])
          .map((item) => ({
            label: item.name,
            amount: Number(item.amount) || 0,
          }))
      ),
    ].filter((item) => item.amount !== 0);

    const fallbackAllowanceBreakdown =
      allowanceBreakdown.length === 0 && Number(selectedRecord.totalAllowances) !== 0
        ? [
            {
              label: "Allowances",
              amount: Number(selectedRecord.totalAllowances) || 0,
            },
          ]
        : allowanceBreakdown;

    const estimatedSssContribution =
      Number((selectedRecord as any).sssEe) ||
      (Number(selectedRecord.basicPay) > 0 ? 825 : 0);
    const estimatedPhilhealthContribution =
      Number((selectedRecord as any).philhealthEe) ||
      (Number(selectedRecord.basicPay) > 0
        ? Math.min(Math.max(Number(selectedRecord.basicPay), 10000), 100000) * 0.025
        : 0);
    const estimatedPagibigContribution =
      Number((selectedRecord as any).pagibigEe) ||
      (Number(selectedRecord.basicPay) > 0
        ? Math.min(Number(selectedRecord.basicPay), 10000) * 0.02
        : 0);

    const employeeContributions =
      (Number(selectedRecord.totalDeductions) || 0) -
      (Number(selectedRecord.withholdingTax) || 0);

    const grossBreakdown = [
      { label: "Basic Pay", amount: Number(selectedRecord.basicPay) || 0 },
      ...fallbackPremiumBreakdown,
      ...fallbackAllowanceBreakdown,
      {
        label: "Tardiness & Absences",
        amount: -(Number(selectedRecord.totalAbsences) || 0),
      },
    ].filter((item) => item.amount !== 0);

    const sssInformationBreakdown = [
      {
        label: "SSS Monthly Salary Credit (MSC)",
        amount: Number(selectedRecord.sssMonthlySalaryCredit) || 0,
      },
      {
        label: "SSS Regular MSC",
        amount: Number(selectedRecord.sssRegularMonthlySalaryCredit) || 0,
      },
      {
        label: "WISP / MPF MSC",
        amount: Number(selectedRecord.sssWispMonthlySalaryCredit) || 0,
      },
      {
        label: "SSS EC - Employer Only",
        amount: Number(selectedRecord.sssEc) || 0,
      },
      {
        label: "Regular SSS - Employer",
        amount: Number(selectedRecord.sssRegularEr) || 0,
      },
      {
        label: "WISP / MPF - Employer",
        amount: Number(selectedRecord.sssWispEr) || 0,
      },
    ].filter((item) => item.amount !== 0);

    const deductionABreakdown = [
      {
        label: "Regular SSS - Employee",
        amount: Number(selectedRecord.sssRegularEe) || 0,
      },
      {
        label: "WISP / MPF - Employee",
        amount: Number(selectedRecord.sssWispEe) || 0,
      },
      {
        label: "SSS Contribution - Employee Total",
        amount: estimatedSssContribution,
      },
      {
        label: "PhilHealth Contribution",
        amount: estimatedPhilhealthContribution,
      },
      {
        label: "Pag-IBIG Contribution",
        amount: estimatedPagibigContribution,
      },
      {
        label: "Withholding Tax",
        amount: Number(selectedRecord.withholdingTax) || 0,
      },
    ].filter((item) => item.amount !== 0);

    const additionalDeductionRows = [
      {
        label: "Payroll Advances",
        amount: Number((selectedRecord as any).employeeAdvances) || 0,
      },
      {
        label: "Cash Advances",
        amount: Number((selectedRecord as any).cashAdvances) || 0,
      },
      {
        label: "SSS Loan Repayment",
        amount: Number((selectedRecord as any).sssLoanRepayment) || 0,
      },
      {
        label: "HDMF Loan Repayment",
        amount: Number((selectedRecord as any).hdmfLoanRepayment) || 0,
      },
      ...(
        (((selectedRecord as any).loanDeductions as LoanDeductionLine[] | undefined) || [])
          .map((item) => ({
            label: item.loanName,
            amount: Number(item.amount) || 0,
          }))
      ),
      ...(
        (((selectedRecord as any).customDeductions as { name: string; amount: number }[] | undefined) || [])
          .map((item) => ({
            label: item.name,
            amount: Number(item.amount) || 0,
          }))
      ),
    ].filter((item) => item.amount !== 0);

    const hasDeductionB = additionalDeductionRows.length > 0;
    const deductionBreakdown = hasDeductionB
      ? deductionABreakdown
      : [...deductionABreakdown, ...additionalDeductionRows];
    const totalDeductionA = deductionABreakdown.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductionB = additionalDeductionRows.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductionsForPayslip = [...deductionABreakdown, ...additionalDeductionRows].reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const safeTitle = `${selectedRecord.employeeNo}-${selectedRecord.month}-${selectedRecord.year}`;

    const payslipHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Payslip - ${safeTitle}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              background: #f1f5f9;
              color: #0f172a;
            }
            .toolbar {
              position: sticky;
              top: 0;
              z-index: 10;
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              padding: 16px 24px;
              background: #ffffff;
              border-bottom: 1px solid #e2e8f0;
            }
            .toolbar h1 {
              margin: 0;
              font-size: 18px;
            }
            .toolbar-buttons {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            .toolbar button {
              padding: 10px 16px;
              border-radius: 10px;
              border: 1px solid #cbd5e1;
              background: #ffffff;
              font-weight: 700;
              cursor: pointer;
            }
            .toolbar button.primary {
              background: #0f172a;
              color: #ffffff;
              border-color: #0f172a;
            }
            .page {
              max-width: 1120px;
              margin: 24px auto;
              background: #ffffff;
              padding: 42px 46px;
              box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 24px;
              margin-bottom: 28px;
            }
            .brand {
              display: flex;
              gap: 16px;
              align-items: flex-start;
            }
            .brand img {
              width: 72px;
              height: 72px;
              object-fit: contain;
            }
            .brand h2 {
              margin: 0;
              font-size: 20px;
              font-weight: 800;
              letter-spacing: 0.2px;
            }
            .brand p {
              margin: 6px 0 0;
              color: #334155;
              font-size: 13px;
            }
            .payslip-title {
              margin-top: 28px;
              margin-bottom: 20px;
              font-size: 22px;
              font-weight: 800;
              letter-spacing: 0.4px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 18px 28px;
              margin-bottom: 28px;
            }
            .meta-item {
              display: grid;
              grid-template-columns: 170px 1fr;
              gap: 12px;
              align-items: start;
            }
            .meta-label {
              font-weight: 800;
            }
            .tables {
              display: grid;
              grid-template-columns: ${'${hasDeductionB ? "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1.15fr) minmax(0, 1fr)"}'};
              gap: 18px;
              margin-top: 10px;
              align-items: start;
            }
            .table-block h3 {
              margin: 0 0 10px;
              font-size: 16px;
              font-weight: 800;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              padding: 6px 4px;
              border-bottom: 1px solid #cbd5e1;
              text-align: left;
              font-size: 13px;
              vertical-align: top;
            }
            th {
              font-size: 13px;
              color: #0f172a;
              font-weight: 800;
            }
            td.amount, th.amount {
              text-align: right;
              white-space: nowrap;
            }
            .three-col-summary {
              margin-top: 14px;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
            }
            .three-col-summary table {
              width: 100%;
              border-collapse: collapse;
            }
            .three-col-summary td {
              border-bottom: 1px solid #0f172a;
              padding: 6px 4px;
              font-size: 13px;
              width: 25%;
            }
            .three-col-summary tr:last-child td {
              border-bottom: none;
            }
            .summary-label {
              font-weight: 800;
            }
            .summary-value {
              text-align: right;
              font-weight: 800;
              white-space: nowrap;
            }
            .signature {
              margin-top: 70px;
              display: flex;
              justify-content: flex-end;
            }
            .signature-box {
              width: 320px;
              text-align: center;
            }
            .signature-line {
              border-top: 1px solid #0f172a;
              margin-bottom: 10px;
            }
            .signature-name {
              font-weight: 800;
            }
            .signature-role {
              margin-top: 8px;
            }
            @page {
              size: A4 landscape;
              margin: 12mm;
            }
            @media print {
              html, body {
                width: 297mm;
                height: 210mm;
                background: #ffffff;
              }
              body {
                margin: 0;
              }
              .toolbar {
                display: none;
              }
              .page {
                box-shadow: none;
                margin: 0;
                max-width: none;
                width: 100%;
                min-height: 100%;
                padding: 10mm 12mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <h1>Payslip Preview</h1>
            <div class="toolbar-buttons">
              <button onclick="window.print()" class="primary">Print / Download PDF</button>
              <button onclick="window.close()">Close</button>
            </div>
          </div>

          <div class="page">
            <div class="header">
              <div>
                <div class="brand">
                  ${COMPANY_LOGO_URL ? `<img src="${COMPANY_LOGO_URL}" alt="Company Logo" />` : ""}
                  <div>
                    <h2>${COMPANY_NAME}</h2>
                    <p>${COMPANY_ADDRESS}</p>
                  </div>
                </div>
                <div class="payslip-title">PAYSLIP</div>
              </div>
              <div style="font-size: 18px; font-weight: 800; margin-top: 10px;">DATE: ${payrollPeriod.toUpperCase()}</div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <div class="meta-label">NAME OF EMPLOYEE:</div>
                <div>${selectedRecord.employeeName}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">PAYROLL NO.:</div>
                <div>${selectedRecord.id}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">EMPLOYEE NO.:</div>
                <div>${selectedRecord.employeeNo}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">DEPARTMENT:</div>
                <div>${selectedRecord.department}</div>
              </div>
              <div class="meta-item">
                <div class="meta-label">EMPLOYMENT STATUS:</div>
                <div>${selectedRecord.employmentStatus}</div>
              </div>
            </div>

            ${sssInformationBreakdown.length > 0 ? `
              <div class="table-block" style="margin-bottom: 18px;">
                <table>
                  <thead>
                    <tr>
                      <th>SSS INFORMATION</th>
                      <th class="amount">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sssInformationBreakdown
                      .map(
                        (item) => `
                          <tr>
                            <td>${item.label}</td>
                            <td class="amount">${formatCurrency(item.amount)}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            ` : ""}

            <div class="tables">
              <div class="table-block">
                <table>
                  <thead>
                    <tr>
                      <th>GROSS PAY</th>
                      <th class="amount">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${grossBreakdown
                      .map(
                        (item) => `
                          <tr>
                            <td>${item.label}</td>
                            <td class="amount">${item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>

              <div class="table-block">
                <table>
                  <thead>
                    <tr>
                      <th>${hasDeductionB ? "DEDUCTION A" : "DEDUCTIONS"}</th>
                      <th class="amount">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${deductionBreakdown
                      .map(
                        (item) => `
                          <tr>
                            <td>${item.label}</td>
                            <td class="amount">${formatCurrency(item.amount)}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>

              ${hasDeductionB ? `
                <div class="table-block">
                  <table>
                    <thead>
                      <tr>
                        <th>DEDUCTION B</th>
                        <th class="amount">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${additionalDeductionRows
                        .map(
                          (item) => `
                            <tr>
                              <td>${item.label}</td>
                              <td class="amount">${formatCurrency(item.amount)}</td>
                            </tr>
                          `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              ` : ""}
            </div>

            <div class="three-col-summary">
              <table>
                <tbody>
                  ${hasDeductionB ? `
                    <tr>
                      <td class="summary-label">Gross Pay</td>
                      <td class="summary-value">${formatCurrency(Number(selectedRecord.grossPay) || 0)}</td>
                      <td class="summary-label">Total Deduction A</td>
                      <td class="summary-value">${formatCurrency(totalDeductionA)}</td>
                      <td class="summary-label">Total Deduction B</td>
                      <td class="summary-value">${formatCurrency(totalDeductionB)}</td>
                    </tr>
                    <tr>
                      <td class="summary-label">Net Pay</td>
                      <td class="summary-value">${formatCurrency(Number(selectedRecord.netPay) || 0)}</td>
                      <td class="summary-label">Employee Contributions</td>
                      <td class="summary-value">${formatCurrency(employeeContributions)}</td>
                      <td class="summary-label">Withholding Tax</td>
                      <td class="summary-value">${formatCurrency(Number(selectedRecord.withholdingTax) || 0)}</td>
                    </tr>
                  ` : `
                    <tr>
                      <td class="summary-label">Gross Pay</td>
                      <td class="summary-value">${formatCurrency(Number(selectedRecord.grossPay) || 0)}</td>
                      <td class="summary-label">Total Deductions</td>
                      <td class="summary-value">${formatCurrency(totalDeductionsForPayslip)}</td>
                    </tr>
                    <tr>
                      <td class="summary-label">Net Pay</td>
                      <td class="summary-value">${formatCurrency(Number(selectedRecord.netPay) || 0)}</td>
                      <td class="summary-label">Employee Contributions</td>
                      <td class="summary-value">${formatCurrency(employeeContributions)}</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>

            <div class="signature">
              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">AUTHORIZED SIGNATORY</div>
                <div class="signature-role">Finance / Payroll Office</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const payslipBlob = new Blob([payslipHtml], { type: "text/html" });
      const payslipUrl = URL.createObjectURL(payslipBlob);
      const payslipWindow = window.open(payslipUrl, "_blank");

      if (!payslipWindow) {
        window.alert("Unable to open the payslip preview. Please allow pop-ups for this site.");
        URL.revokeObjectURL(payslipUrl);
        return;
      }

      const cleanupUrl = () => {
        setTimeout(() => URL.revokeObjectURL(payslipUrl), 60000);
      };

      payslipWindow.addEventListener?.("load", cleanupUrl);
      cleanupUrl();
    } catch (error) {
      console.error("Failed to open payslip preview:", error);
      window.alert("Unable to generate the payslip preview right now.");
    }
  };

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle = activeTheme.bannerImageDataUrl
    ? {
        backgroundImage: `linear-gradient(90deg, ${activeTheme.bannerColor}${bannerOverlayAlpha} 0%, ${activeTheme.bannerColor}${bannerOverlayAlpha} 100%), url(${activeTheme.bannerImageDataUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : { backgroundColor: activeTheme.bannerColor };

  return (
    <main
      style={{
        minHeight: "100vh",
        ...pageBackground,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0f172a",
      }}
    >
        <section
          className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderBottom: `1px solid ${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
        >
          {/* radial + diagonal accent matching homepage banner */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 82% 20%, ${activeTheme.accentColor}33, transparent 30%), linear-gradient(135deg, ${activeTheme.accentColor}22, transparent 45%)`,
            }}
          />
          <div className="relative mx-auto flex max-w-[1400px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${activeTheme.accentColor}24`, color: activeTheme.bannerTextColor, border: `0.5px solid ${activeTheme.accentColor}66` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                  {recordsView === "Archived" ? "Archive tab" : `${payrollRunGroups.length} payroll run${payrollRunGroups.length === 1 ? "" : "s"}`}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Payroll Records
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Payroll Records</h1>
              <p className="mt-1 max-w-3xl text-sm opacity-85">
                Review payroll runs, approval status, adjustments, archive controls, and employee pay details from one compact workspace.
              </p>
            </div>

            <div className="rounded border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-white/[0.08]" style={{ color: activeTheme.bannerTextColor }}>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">Current View</p>
                  <p className="m-0 mt-0.5 text-sm font-semibold">
                    {selectedPeriodLabel || "All payroll periods"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

      <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24, padding: "28px 20px 40px" }}>

        <section
          style={panelStyle}
        >
          <div style={{ pointerEvents: "none", position: "absolute", inset: "0 24px auto", height: 1, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.6), transparent)" }} />
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
              <Filter style={{ width: 20, height: 20, color: "#0a4f8f" }} aria-hidden="true" />
              Filter Payroll Records
            </div>
            <div style={{ color: "#64748b", marginTop: 4, fontSize: 13, fontWeight: 600 }}>
              Narrow records by period, department, employee, or archive status.
            </div>
            </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setRecordsView("Active")}
              style={{
                ...secondaryButtonStyle,
                borderRadius: 8,
                border: recordsView === "Active" ? "1px solid #0ea5e9" : "1px solid #dbe4ef",
                background: recordsView === "Active" ? "#f0f9ff" : "rgba(255,255,255,0.96)",
                color: recordsView === "Active" ? "#0a4f8f" : "#475569",
              }}
            >
              <CheckCircle2 style={{ width: 16, height: 16 }} aria-hidden="true" />
              Active Payroll Runs
            </button>
            <button
              type="button"
              onClick={() => setRecordsView("Archived")}
              style={{
                ...secondaryButtonStyle,
                borderRadius: 8,
                border: recordsView === "Archived" ? "1px solid #fde68a" : "1px solid #dbe4ef",
                background: recordsView === "Archived" ? "#fffbeb" : "#ffffff",
                color: recordsView === "Archived" ? "#92400e" : "#475569",
              }}
            >
              <Archive style={{ width: 16, height: 16 }} aria-hidden="true" />
              Archive Tab
            </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <label>
              <FilterLabel>Month</FilterLabel>
              <SelectField value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </SelectField>
            </label>

            <label>
              <FilterLabel>Year</FilterLabel>
              <SelectField value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </SelectField>
            </label>

            <label>
              <FilterLabel>Department</FilterLabel>
              <SelectField
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </SelectField>
            </label>

            <label>
              <FilterLabel>Employee Search</FilterLabel>
              <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 13, top: "50%", width: 16, height: 16, transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} aria-hidden="true" />
              <InputField
                value={searchEmployee}
                onChange={(e) => setSearchEmployee(e.target.value)}
                placeholder="Search employee name or number"
                style={{ ...inputStyle, paddingLeft: 38 }}
              />
              </div>
            </label>
          </div>
        </section>

        {/* Compact Overview Strip */}
        <section style={mergeStyles(panelStyle, { padding: "14px 24px" })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <WalletCards style={{ width: 15, height: 15, color: "#0a4f8f" }} aria-hidden="true" />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overview</span>
                {selectedPeriodLabel ? (
                  <span style={{ padding: "2px 8px", borderRadius: 5, background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0a4f8f", fontSize: 11, fontWeight: 600 }}>
                    {selectedPeriodLabel}
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "baseline" }}>
                  <span style={{ color: "#64748b", fontWeight: 500 }}>Gross</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{formatCurrency(totals.grossPay)}</span>
                </span>
                <span style={{ color: "#e2e8f0" }}>|</span>
                <span style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "baseline" }}>
                  <span style={{ color: "#64748b", fontWeight: 500 }}>Net Pay</span>
                  <span style={{ fontWeight: 700, color: "#166534" }}>{formatCurrency(totals.netPay)}</span>
                </span>
                <span style={{ color: "#e2e8f0" }}>|</span>
                <span style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "baseline" }}>
                  <span style={{ color: "#64748b", fontWeight: 500 }}>W. Tax</span>
                  <span style={{ fontWeight: 700, color: "#9f1239" }}>{formatCurrency(totals.withholdingTax)}</span>
                </span>
                <span style={{ color: "#e2e8f0" }}>|</span>
                <span style={{ fontSize: 13, display: "flex", gap: 5, alignItems: "baseline" }}>
                  <span style={{ color: "#64748b", fontWeight: 500 }}>Govt Deductions</span>
                  <span style={{ fontWeight: 700, color: "#0a4f8f" }}>{formatCurrency(totals.employeeContributions)}</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowDetailedSummary((current) => !current)}
              style={mergeStyles(secondaryButtonStyle, { fontSize: 12, minHeight: 32, padding: "5px 12px" })}
            >
              <FileText style={{ width: 14, height: 14 }} aria-hidden="true" />
              {showDetailedSummary ? "Hide totals" : "Show detailed totals"}
              <ChevronDown style={{ width: 13, height: 13, transition: "transform 0.2s", transform: showDetailedSummary ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden="true" />
            </button>
          </div>

          {showDetailedSummary ? (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e6edf5", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px" }}>
              {[
                { label: "Gross", value: formatCurrency(totals.grossPay), color: "#0f172a", title: "Gross Pay Breakdown", getter: (record: PayrollRecord) => Number(record.grossPay) || 0 },
                { label: "Net Pay", value: formatCurrency(totals.netPay), color: "#166534", title: "Net Pay Breakdown", getter: (record: PayrollRecord) => Number(record.netPay) || 0 },
                { label: "W. Tax", value: formatCurrency(totals.withholdingTax), color: "#9f1239", title: "Withholding Tax Breakdown", getter: (record: PayrollRecord) => Number(record.withholdingTax) || 0 },
                { label: "Govt Deductions", value: formatCurrency(totals.employeeContributions), color: "#0a4f8f", title: "Govt Deductions Breakdown (sssEe + philhealthEe + pagibigEe)", getter: (record: PayrollRecord) => getGovernmentDeductions(record) },
                { label: "SSS EE", value: formatCurrency(totals.sssEe), color: "#475569", title: "SSS EE Breakdown", getter: (record: PayrollRecord) => Number(record.sssEe) || 0 },
                { label: "PhilHealth EE", value: formatCurrency(totals.philhealthEe), color: "#475569", title: "PhilHealth EE Breakdown", getter: (record: PayrollRecord) => Number(record.philhealthEe) || 0 },
                { label: "Pag-IBIG EE", value: formatCurrency(totals.pagibigEe), color: "#475569", title: "Pag-IBIG EE Breakdown", getter: (record: PayrollRecord) => Number(record.pagibigEe) || 0 },
              ].map((item, index, items) => (
                <span key={item.label} style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => openCrossRecordBreakdown(item.title, item.getter)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 5,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "#64748b", fontWeight: 500 }}>{item.label}</span>
                    <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span>
                  </button>
                  {index < items.length - 1 ? <span style={{ color: "#e2e8f0" }}>|</span> : null}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section
          style={mergeStyles(panelStyle, { overflow: "visible" })}
        >
          <div style={{ pointerEvents: "none", position: "absolute", inset: "0 24px auto", height: 1, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.6), transparent)" }} />
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 600, color: "#0f172a" }}>
                <FileText style={{ width: 21, height: 21, color: "#0a4f8f" }} aria-hidden="true" />
                Payroll Runs
              </div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                Grouped by cutoff with approval, archive, and adjustment actions.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  const selectedRuns = payrollRunGroups.filter((g) => selectedPayrollRunIds.includes(g.id));
                  requestExportStub(selectedRuns, "Selected payroll runs");
                }}
                disabled={selectedPayrollRunIds.length === 0}
                style={mergeStyles(secondaryButtonStyle, { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }, selectedPayrollRunIds.length === 0 && disabledButtonStyle)}
              >
                <FileText style={{ width: 15, height: 15 }} aria-hidden="true" />
                Export Selected ({selectedPayrollRunIds.length})
              </button>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleBulkPayrollRunApprovalAction("submit")}
                    disabled={selectedPayrollRunIds.length === 0}
                    style={mergeStyles(secondaryButtonStyle, { border: "1px solid #bae6fd", color: "#0a4f8f", background: "#f0f9ff" }, selectedPayrollRunIds.length === 0 && disabledButtonStyle)}
                  >
                    <Send style={{ width: 15, height: 15 }} aria-hidden="true" />
                    Submit Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPayrollRunApprovalAction("check")}
                    disabled={selectedPayrollRunIds.length === 0}
                    style={mergeStyles(secondaryButtonStyle, selectedPayrollRunIds.length === 0 && disabledButtonStyle)}
                  >
                    <CheckCheck style={{ width: 15, height: 15 }} aria-hidden="true" />
                    Check Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkPayrollRunApprovalAction("approve")}
                    disabled={selectedPayrollRunIds.length === 0}
                    style={mergeStyles(secondaryButtonStyle, { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" }, selectedPayrollRunIds.length === 0 && disabledButtonStyle)}
                  >
                    <ShieldCheck style={{ width: 15, height: 15 }} aria-hidden="true" />
                    Approve Selected
                  </button>
                  {recordsView === "Active" ? (
                    <button
                      type="button"
                      onClick={handleBulkArchiveAction}
                      disabled={selectedPayrollRunIds.length === 0}
                      style={mergeStyles(secondaryButtonStyle, { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" }, selectedPayrollRunIds.length === 0 && disabledButtonStyle)}
                    >
                      <Archive style={{ width: 15, height: 15 }} aria-hidden="true" />
                      Archive Selected
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e6edf5", borderRadius: 18, background: "#ffffff" }}>
	          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1000, fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "Select",
                  "Payroll Run",
                  "Actual Payroll Date",
                  "Created On",
                  "Employees",
                  "Net Pay",
                  ...(hasAnyPayrollAdjustmentInFilteredRuns ? ["Adjusted Net Pay"] : []),
                  "Status",
                  "Prepared By",
                  "Checked By",
                  "Approved By",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    style={mergeStyles(tableHeaderStyle, header === "Actions" && { textAlign: "right" })}
                  >
                    {header === "Select" ? (
                      <input
                        type="checkbox"
                        checked={payrollRunGroups.length > 0 && payrollRunGroups.every((group) => selectedPayrollRunIds.includes(group.id))}
                        onChange={toggleAllPayrollRuns}
                      />
                    ) : (
                      header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
	              {payrollRunGroups.map((group) => (
	                <tr key={group.id} style={{ background: selectedPayrollRunIds.includes(group.id) ? "#f8fcff" : "#ffffff" }}>
                  <td style={tableCellStyle}>
                    <input
                      type="checkbox"
                      checked={selectedPayrollRunIds.includes(group.id)}
                      onChange={() => togglePayrollRunSelection(group.id)}
                    />
                  </td>
                  <td
	                    style={mergeStyles(tableCellStyle, { fontWeight: 650, color: "#0f172a", fontSize: 14, lineHeight: 1.35 })}
                  >
                    {group.title}
                    {(() => {
                      const from = group.records[0]?.dateFrom;
                      const to = group.records[group.records.length - 1]?.dateTo || group.records[0]?.dateTo;
                      if (!from && !to) return null;
                      return (
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 2 }}>
                          {from ? formatDateOnly(from) : "—"} – {to ? formatDateOnly(to) : "—"}
                        </div>
                      );
                    })()}
                  </td>
	                  <td style={mergeStyles(tableCellStyle, { whiteSpace: "nowrap", color: "#334155", fontSize: 13 })}>
                    {formatDateOnly(group.payrollDate)}
                  </td>
	                  <td style={mergeStyles(tableCellStyle, { whiteSpace: "nowrap", color: "#64748b", fontSize: 12 })}>
                    {formatDateTime(group.createdAt)}
                  </td>
                  <td style={tableCellStyle}>
                    {group.employeesCount}
                  </td>
                  <td
	                    style={mergeStyles(tableCellStyle, { fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", fontSize: 13 })}
                  >
                    {formatCurrency(group.netPay)}
                    {group.hasTaxAnnualization ? (
	                      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        Includes year-end tax annualization
                      </div>
                    ) : null}
                  </td>
                  {hasAnyPayrollAdjustmentInFilteredRuns ? (
                    <td
	                      style={mergeStyles(tableCellStyle, { fontWeight: 700, color: group.adjustmentsCount > 0 ? "#166534" : "#64748b", whiteSpace: "nowrap", fontSize: 13 })}
                    >
                      {Math.abs(Number(group.adjustedNetPay || 0) - Number(group.netPay || 0)) >= 0.01
  ? formatCurrency(group.adjustedNetPay)
  : "—"}
                    </td>
                  ) : null}
                  <td style={tableCellStyle}>
                    <ApprovalBadge status={getPayrollRunApproval(group).status} />
                  </td>
	                  <td style={tableCellStyle}>
	                    <div style={{ fontWeight: 500, fontSize: 12, color: "#1e293b" }}>{getPayrollRunApproval(group).preparedByName || "—"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                      {getPayrollRunApproval(group).preparedAt ? formatDateTime(getPayrollRunApproval(group).preparedAt) : "Not prepared yet"}
                    </div>
                  </td>
	                  <td style={tableCellStyle}>
	                    <div style={{ fontWeight: 500, fontSize: 12, color: "#1e293b" }}>{getPayrollRunApproval(group).checkedByName || "—"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                      {getPayrollRunApproval(group).checkedAt ? formatDateTime(getPayrollRunApproval(group).checkedAt) : "Not checked yet"}
                    </div>
                  </td>
	                  <td style={tableCellStyle}>
	                    <div style={{ fontWeight: 500, fontSize: 12, color: "#1e293b" }}>{getPayrollRunApproval(group).approvedByName || "—"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                      {getPayrollRunApproval(group).approvedAt ? formatDateTime(getPayrollRunApproval(group).approvedAt) : "Not approved yet"}
                    </div>
                  </td>
                  <td style={mergeStyles(tableCellStyle, { textAlign: "right" })}>
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenActionsMenuId((current) => (current === group.id ? null : group.id))
                        }
	                        style={mergeStyles(secondaryButtonStyle, { borderRadius: 6, padding: "5px 10px", fontSize: 12, minHeight: 32 })}
                      >
                        <MoreHorizontal style={{ width: 15, height: 15 }} aria-hidden="true" />
                        Actions
                        <ChevronDown style={{ width: 13, height: 13 }} aria-hidden="true" />
                      </button>

                      {openActionsMenuId === group.id ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 6px)",
                            width: 200,
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 10,
                            boxShadow: "0 8px 24px -6px rgba(8,47,73,0.14)",
                            zIndex: 20,
                            overflow: "hidden",
                          }}
                        >
                          <a
                            href={`/payroll-records/${encodeURIComponent(group.id)}`}
                            onClick={() => setOpenActionsMenuId(null)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "12px 14px",
                              border: "none",
                              borderBottom: "1px solid #f1f5f9",
                              background: "#f8fafc",
                              color: "#0a4f8f",
                              fontWeight: 600,
                              textDecoration: "none",
                              cursor: "pointer",
                              fontSize: 13,
                            }}
                          >
                            View Payroll Summary
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionsMenuId(null);
                              handleViewDetailedPayrollRun(group);
                            }}
                            style={{
                              width: "100%",
                              padding: "12px 14px",
                              border: "none",
                              borderBottom: "1px solid #f1f5f9",
                              background: "#ffffff",
                              color: "#1d4ed8",
                              fontWeight: 500,
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            View Detailed Payroll
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionsMenuId(null);
                              requestExportStub([group], "Payroll run");
                            }}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "none",
                              borderTop: "1px solid #e2e8f0",
                              background: "#ffffff",
                              color: "#166534",
                              fontWeight: 500,
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            Export to Excel
                          </button>
                          {recordsView === "Active" ? (
                            <>
                              {isAdmin && (getPayrollRunApproval(group).status === "Draft" || getPayrollRunApproval(group).status === "Adjusted") ? (
                                <button
                                  type="button"
                                  onClick={() => handlePayrollRunApprovalAction(group, "submit")}
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    border: "none",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#ffffff",
                                    color: "#0f172a",
                                    fontWeight: 500,
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  Submit for Review
                                </button>
                              ) : null}
                              {isAdmin && getPayrollRunApproval(group).status === "Submitted" ? (
                                <button
                                  type="button"
                                  onClick={() => handlePayrollRunApprovalAction(group, "check")}
                                  style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    border: "none",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#ffffff",
                                    color: "#1d4ed8",
                                    fontWeight: 500,
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  Mark as Checked
                                </button>
                              ) : null}
                              {isAdmin && getPayrollRunApproval(group).status === "Checked" ? (
                                <button
                                  type="button"
                                  onClick={() => handlePayrollRunApprovalAction(group, "approve")}
                                  style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    border: "none",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#ffffff",
                                    color: "#166534",
                                    fontWeight: 500,
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  Approve Payroll
                                </button>
                              ) : null}
                              {isAdmin && (getPayrollRunApproval(group).status === "Approved" || getPayrollRunApproval(group).status === "Checked") ? (
                                <button
                                  type="button"
                                  onClick={() => handleAdjustAction(group)}
                                  style={{
                                    width: "100%",
                                    padding: "12px 14px",
                                    border: "none",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#ffffff",
                                    color: "#9a3412",
                                    fontWeight: 500,
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  Adjust Payroll Run
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionsMenuId(null);
                                  setSelectedAdjustmentsRun(group);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "12px 14px",
                                  border: "none",
                                  borderTop: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  color: Math.abs(Number(group.adjustedNetPay || 0) - Number(group.netPay || 0)) >= 0.01 ? "#166534" : "#64748b",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                View Adjustments ({group.adjustmentsCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePayrollRunArchiveStatus(group)}
                                style={{
                                  width: "100%",
                                  padding: "12px 14px",
                                  border: "none",
                                  borderTop: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  color: "#9a3412",
                                  fontWeight: 500,
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                Archive Payroll Run
                              </button>
                            </>
                          ) : null}
                          {recordsView === "Archived" ? (
                            <div style={{ padding: "12px 14px", borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, textAlign: "left" }}>
                              Archived runs are immutable.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payrollRunGroups.length === 0 ? (
            <div
              style={{
                padding: 22,
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No payroll records found for the selected filters.
            </div>
          ) : null}
          </div>
        </section>

        {actionLoading ? (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              top: 0,
              zIndex: 80,
              height: 4,
              background: "linear-gradient(90deg, #0ea5e9, #22c55e, #f59e0b)",
              boxShadow: "0 0 18px rgba(14, 165, 233, 0.5)",
            }}
            title={actionLoading}
          />
        ) : null}

        {confirmModal ? (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 85 }}>
            <div style={{ width: "100%", maxWidth: 520, background: "#ffffff", borderRadius: 18, border: "1px solid #e2e8f0", padding: 22, boxShadow: "0 20px 50px rgba(15,23,42,0.2)" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{confirmModal.title}</div>
              <div style={{ marginTop: 8, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>{confirmModal.message}</div>
              {actionLoading ? <div style={{ marginTop: 14, color: "#0a4f8f", fontSize: 13, fontWeight: 700 }}>{actionLoading}</div> : null}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  disabled={Boolean(actionLoading)}
                  onClick={() => setConfirmModal(null)}
                  style={mergeStyles(secondaryButtonStyle, Boolean(actionLoading) && disabledButtonStyle)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(actionLoading)}
                  onClick={async () => {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  style={mergeStyles(
                    secondaryButtonStyle,
                    {
                      border: confirmModal.tone === "red" ? "1px solid #fecaca" : confirmModal.tone === "amber" ? "1px solid #fed7aa" : "1px solid #bbf7d0",
                      background: confirmModal.tone === "red" ? "#fef2f2" : confirmModal.tone === "amber" ? "#fff7ed" : "#f0fdf4",
                      color: confirmModal.tone === "red" ? "#991b1b" : confirmModal.tone === "amber" ? "#9a3412" : "#166534",
                    },
                    Boolean(actionLoading) && disabledButtonStyle
                  )}
                >
                  {confirmModal.actionLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {adjustmentModal ? (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 75, overflowY: "auto" }}>
            <div style={{ width: "100%", maxWidth: 1200, background: "#ffffff", borderRadius: 24, border: "1px solid #e2e8f0", padding: 24, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", margin: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>Adjust Payroll Run</div>
                  <div style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>
                    {adjustmentModal.payrollRun.title} • Original run snapshot captured before saving.
                  </div>
                </div>
                <button type="button" onClick={() => setAdjustmentModal(null)} style={secondaryButtonStyle}>Close</button>
              </div>

              <label style={{ display: "block", marginBottom: 16 }}>
                <FilterLabel>Required Reason</FilterLabel>
                <InputField
                  value={adjustmentModal.reason}
                  onChange={(event) => setAdjustmentModal((current) => (current ? { ...current, reason: event.target.value } : current))}
                  placeholder="Reason for adjustment"
                />
              </label>

              <div style={{ overflowX: "auto", border: "1px solid #e6edf5", borderRadius: 14 }}>
                <table style={{ width: "100%", minWidth: 1120, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Employee", "Gross", "Deductions", "W. Tax", "SSS EE", "PhilHealth EE", "Pag-IBIG EE", "Net Pay"].map((header) => (
                        <th key={header} style={tableHeaderStyle}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentModal.rows.map((row) => (
                      <tr key={row.recordId}>
                        <td style={tableCellStyle}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.employeeName}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{row.employeeNo}</div>
                        </td>
                        {(["grossPay", "totalDeductions", "withholdingTax", "sssEe", "philhealthEe", "pagibigEe"] as const).map((field) => (
                          <td key={field} style={tableCellStyle}>
                            <InputField
                              type="number"
                              min={0}
                              step="0.01"
                              value={row[field]}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setAdjustmentModal((current) => {
                                  if (!current) return current;
                                  return {
                                    ...current,
                                    rows: current.rows.map((candidate) => {
                                      if (candidate.recordId !== row.recordId) return candidate;
                                      const nextRow = { ...candidate, [field]: Number.isFinite(value) ? value : 0 };
                                      return { ...nextRow, netPay: getAdjustmentNetPay(nextRow) };
                                    }),
                                  };
                                });
                              }}
                            />
                          </td>
                        ))}
                        <td style={mergeStyles(tableCellStyle, { fontWeight: 800, color: "#166534", whiteSpace: "nowrap" })}>
                          {formatCurrency(row.netPay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                <button type="button" onClick={() => setAdjustmentModal(null)} style={secondaryButtonStyle}>Cancel</button>
                <button
                  type="button"
                  onClick={saveAdjustmentModal}
                  style={mergeStyles(secondaryButtonStyle, { border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412" })}
                >
                  Save Adjustment
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedPayrollRun ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              zIndex: 50,
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
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
                margin: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 26, lineHeight: 1.15, fontWeight: 700, color: "#0f172a" }}>
                    {selectedPayrollRun.title}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>
                    {(() => {
                      const from = selectedPayrollRun.records[0]?.dateFrom;
                      const to = selectedPayrollRun.records[selectedPayrollRun.records.length - 1]?.dateTo || selectedPayrollRun.records[0]?.dateTo;
                      if (from || to) {
                        return <span style={{ marginRight: 10 }}>{from ? formatDateOnly(from) : "—"} – {to ? formatDateOnly(to) : "—"} • </span>;
                      }
                      return null;
                    })()}
                    {selectedPayrollRun.employeesCount} employee(s) included in this payroll run.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
  type="button"
  onClick={() => handleViewDetailedPayrollRun(selectedPayrollRun)}
  style={{
    padding: "9px 16px",
    borderRadius: 7,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  View Detailed Payroll
</button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayrollRun(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 7,
                      border: "1px solid #dbe4ef",
                      background: "#ffffff",
                      color: "#334155",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <section
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 24,
                  padding: 18,
                  marginBottom: 18,
                  background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <ApprovalBadge status={getPayrollRunApproval(selectedPayrollRun).status} />
                    <div>
                      <div style={{ color: "#0f172a", fontWeight: 600, fontSize: 15 }}>Approval Summary</div>
                      <div style={{ color: "#64748b", fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
                        Prepared by <strong>{getPayrollRunApproval(selectedPayrollRun).preparedByName || "—"}</strong>
                        {getPayrollRunApproval(selectedPayrollRun).checkedAt ? ` • Checked ${formatDateTime(getPayrollRunApproval(selectedPayrollRun).checkedAt)}` : " • Not checked yet"}
                        {getPayrollRunApproval(selectedPayrollRun).approvedAt ? ` • Approved ${formatDateTime(getPayrollRunApproval(selectedPayrollRun).approvedAt)}` : ""}
                      </div>
                    </div>
                  </div>

                  {recordsView === "Active" ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isAdmin && (getPayrollRunApproval(selectedPayrollRun).status === "Draft" || getPayrollRunApproval(selectedPayrollRun).status === "Adjusted") ? (
                        <button type="button" onClick={() => handlePayrollRunApprovalAction(selectedPayrollRun, "submit")} style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#ffffff", color: "#334155", fontWeight: 600, cursor: "pointer" }}>Submit</button>
                      ) : null}
                      {isAdmin && getPayrollRunApproval(selectedPayrollRun).status === "Submitted" ? (
                        <button type="button" onClick={() => handlePayrollRunApprovalAction(selectedPayrollRun, "check")} style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, cursor: "pointer" }}>Check</button>
                      ) : null}
                      {isAdmin && getPayrollRunApproval(selectedPayrollRun).status === "Checked" ? (
                        <button type="button" onClick={() => handlePayrollRunApprovalAction(selectedPayrollRun, "approve")} style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 600, cursor: "pointer" }}>Approve</button>
                      ) : null}
                      {isAdmin && (getPayrollRunApproval(selectedPayrollRun).status === "Approved" || getPayrollRunApproval(selectedPayrollRun).status === "Checked") ? (
                        <button type="button" onClick={() => handleAdjustAction(selectedPayrollRun)} style={{ padding: "9px 12px", borderRadius: 7, border: "1px solid #fed7aa", background: "#fff7ed", color: "#9a3412", fontWeight: 600, cursor: "pointer" }}>Adjust</button>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                      Archived run: read-only
                    </div>
                  )}
                </div>

                {getPayrollRunApproval(selectedPayrollRun).returnReason ? (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 7, background: "#fef2f2", color: "#991b1b", fontWeight: 500, fontSize: 13 }}>
                    Return reason: {getPayrollRunApproval(selectedPayrollRun).returnReason}
                  </div>
                ) : null}
                {getPayrollRunApproval(selectedPayrollRun).adjustReason ? (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 7, background: "#fff7ed", color: "#9a3412", fontWeight: 500, fontSize: 13 }}>
                    Adjustment reason: {getPayrollRunApproval(selectedPayrollRun).adjustReason}
                    {getPayrollRunApproval(selectedPayrollRun).adjustedByName ? ` — by ${getPayrollRunApproval(selectedPayrollRun).adjustedByName}` : ""}
                  </div>
                ) : null}
              </section>

              <section
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 24,
                  padding: 18,
                  marginBottom: 18,
                  background: "#ffffff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>Payroll Run Snapshot</div>
                    <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>
                      Compact view of dates, employees, and major totals.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ padding: "5px 10px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", fontWeight: 600, fontSize: 13 }}>
                      Paid {formatDateOnly(selectedPayrollRun.payrollDate)}
                    </span>
                    <span style={{ padding: "5px 10px", borderRadius: 6, background: "#f8fafc", color: "#475569", fontWeight: 500, fontSize: 13 }}>
                      Created {formatDateTime(selectedPayrollRun.createdAt)}
                    </span>
                    <span style={{ padding: "5px 10px", borderRadius: 6, background: "#f8fafc", color: "#475569", fontWeight: 500, fontSize: 13 }}>
                      {selectedPayrollRun.employeesCount} employees
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  <SummaryCard label="Basic Pay" value={formatCurrency(selectedPayrollRun.basicPay)} />
                  <SummaryCard label="Premiums" value={formatCurrency(selectedPayrollRun.payrollPremium)} />
                  <SummaryCard label="Allowances" value={formatCurrency(selectedPayrollRun.allowances)} />
                  <SummaryCard label="Gross Pay" value={formatCurrency(selectedPayrollRun.grossPay)} />
                  <SummaryCard label="Deductions" value={formatCurrency(selectedPayrollRun.deductions)} />
                  {selectedPayrollRun.hasTaxAnnualization ? (
                    <SummaryCard label="Regular Net Pay" value={formatCurrency(selectedPayrollRun.regularNetPay)} />
                  ) : null}
                  {selectedPayrollRun.hasTaxAnnualization ? (
                    <SummaryCard
                      label="Year-End Tax Adj."
                      value={formatCurrency(selectedPayrollRun.taxAnnualizationAdjustment)}
                      tone={selectedPayrollRun.taxAnnualizationAdjustment >= 0 ? "green" : "red"}
                    />
                  ) : null}
                  <SummaryCard
                    label={selectedPayrollRun.hasTaxAnnualization ? "Final Net Pay" : "Net Pay"}
                    value={formatCurrency(selectedPayrollRun.netPay)}
                    tone="green"
                  />
                  {selectedPayrollRun.adjustmentsCount > 0 ? (
                    <SummaryCard label="Adjusted Net Pay" value={formatCurrency(selectedPayrollRun.adjustedNetPay)} tone="yellow" />
                  ) : null}
                </div>
              </section>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {[
                        "Employee No.",
                        "Employee Name",
                        "Actual Payroll Date",
                        "Created On",
                        "Cutoff",
                        "Department",
                        "Basic Pay",
                        "Premiums",
                        "Allowances",
                        "Gross Pay",
                        "Deductions",
                        "Withholding Tax",
                        selectedPayrollRun.hasTaxAnnualization ? "Regular Net Pay" : "Net Pay",
                        ...(selectedPayrollRun.hasTaxAnnualization ? ["Year-End Tax Adj.", "Final Net Pay"] : []),
                        ...(selectedPayrollRun.adjustmentsCount > 0 ? ["Adjusted Net Pay"] : []),
                        "Actions",
                      ].map((header) => (
                        <th
                          key={header}
                          style={{
                            textAlign: "left",
                            padding: "14px 12px",
                            borderBottom: "1px solid #e2e8f0",
                            color: "#475569",
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPayrollRun.records.map((record, index) => (
                      <tr key={`${record.id}-${record.employeeNo}-${index}`}>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {record.employeeNo}
                        </td>
                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #e2e8f0",
                            fontWeight: 700,
                          }}
                        >
                          {record.employeeName}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                          {formatDateOnly(record.payrollDate)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap", color: "#64748b" }}>
                          {formatDateTime(record.createdAt)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", minWidth: 190 }}>
                          <div style={{ color: "#334155", fontWeight: 600, fontSize: 12 }}>
                            {formatCutoffIdentity(getRunCutoff(record))}
                          </div>
                          {isLateEndorsedRecord(record) ? (
                            <div style={{ display: "inline-flex", marginTop: 5, padding: "3px 7px", borderRadius: 5, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 11, fontWeight: 700 }}>
                              late endorsed -&gt; WP: {formatCutoffIdentity(record.workPeriodCutoff)}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {record.department}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.basicPay)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.totalPayrollPremium)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.totalAllowances)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.grossPay)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.totalDeductions)}
                        </td>
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          {formatCurrency(record.withholdingTax)}
                        </td>
                        <td
                          style={{
                            padding: "14px 12px",
                            borderBottom: "1px solid #e2e8f0",
                            fontWeight: 700,
                          }}
                        >
                          {formatCurrency(selectedPayrollRun.hasTaxAnnualization ? getRegularNetPay(record) : getFinalNetPay(record))}
                        </td>
                        {selectedPayrollRun.hasTaxAnnualization ? (
                          <td
                            style={{
                              padding: "14px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontWeight: 700,
                              color: getTaxAnnualizationAdjustment(record) >= 0 ? "#166534" : "#b91c1c",
                            }}
                          >
                            {hasTaxAnnualization(record) ? formatCurrency(getTaxAnnualizationAdjustment(record)) : "—"}
                          </td>
                        ) : null}
                        {selectedPayrollRun.hasTaxAnnualization ? (
                          <td
                            style={{
                              padding: "14px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(getFinalNetPay(record))}
                          </td>
                        ) : null}
                        {selectedPayrollRun.adjustmentsCount > 0 ? (
                          <td
                            style={{
                              padding: "14px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontWeight: 700,
                              color: (record.payrollAdjustments?.length || 0) > 0 ? "#166534" : "#64748b",
                            }}
                          >
                            {(record.payrollAdjustments?.length || 0) > 0
                              ? formatCurrency(getAdjustedNetPay(record))
                              : "—"}
                          </td>
                        ) : null}
                        <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayrollRun(null);
                              setSelectedRecord(record);
                            }}
                            style={{
                              padding: "7px 12px",
                              borderRadius: 7,
                              border: "1px solid #dbe4ef",
                              background: "#ffffff",
                              color: "#334155",
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            View Employee
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Audit Trail */}
              <section style={{ borderTop: "1px solid #e2e8f0", marginTop: 24, paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Audit Trail</div>
                {(() => {
                  const entries = selectedPayrollRunAuditEntries;
                  if (entries.length === 0) return <p style={{ fontSize: 13, color: "#94a3b8" }}>No activity recorded yet.</p>;
                  return (
                    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {entries.map((e: AuditEntry) => (
                        <li key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{auditActionLabel(e.action)}</span>
                            {e.details && <span style={{ fontSize: 13, color: "#64748b" }}> · {e.details}</span>}
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>{formatAuditTimestamp(e.timestamp)} · {e.performedBy}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  );
                })()}
              </section>

            </div>
          </div>
        ) : null}
        {/* Removed placeholder for payroll run modal */}

        {selectedAdjustmentsRun ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24, // Modern Blue Corporate modal polish
              zIndex: 55,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 1100,
                background: "#ffffff",
                borderRadius: 32, // Modern Blue Corporate modal polish
                border: "1px solid #e2e8f0",
                padding: 28, // Modern Blue Corporate modal polish
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)", // Modern Blue Corporate modal polish
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
                margin: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 700, color: "#0f172a" }}>
                    Payroll Adjustments
                  </div>
                  <div style={{ color: "#64748b", marginTop: 8 }}>
                    {selectedAdjustmentsRun.title} • {selectedAdjustmentsRun.adjustmentsCount} saved adjustment(s)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAdjustmentsRun(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 7,
                    border: "1px solid #dbe4ef",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              {getPayrollRunAdjustments(selectedAdjustmentsRun).length === 0 ? (
                <div
                  style={{
                    padding: 22,
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 20, // Modern Blue Corporate modal polish
                    color: "#64748b",
                  }}
                >
                  No payroll adjustments have been saved for this payroll run yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {[
                          "Date",
                          "Employee",
                          "Field",
                          "Type",
                          "Amount",
                          "Net Pay Effect",
                          "Reason",
                        ].map((header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: "left",
                              padding: "14px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              color: "#475569",
                              fontSize: 11,
                              fontWeight: 600,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getPayrollRunAdjustments(selectedAdjustmentsRun).map((adjustment, index) => (
                        <tr key={`${adjustment.id}-${adjustment.recordId || adjustment.employeeId || "record"}-${index}`}>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                            {formatDateTime(adjustment.createdAt)}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 700 }}>
                            {adjustment.employeeName}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                            {adjustment.adjustmentLabel}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                            {adjustment.adjustmentType}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 700 }}>
                            {formatCurrency(Number(adjustment.finalAmount ?? adjustment.amount ?? 0))}
                          </td>
                          <td
                            style={{
                              padding: "14px 12px",
                              borderBottom: "1px solid #e2e8f0",
                              fontWeight: 700,
                              color: Number(adjustment.netPayEffect ?? 0) > 0 ? "#166534" : Number(adjustment.netPayEffect ?? 0) < 0 ? "#b91c1c" : "#475569",
                            }}
                          >
                            {formatNetPayEffect(Number(adjustment.netPayEffect ?? 0))}
                          </td>
                          <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                            {adjustment.reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {breakdownRows.length > 0 ? (
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
                maxWidth: 860,
                background: "#ffffff",
                borderRadius: 20,
                border: "1px solid #e2e8f0",
                padding: 24,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
                margin: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
                    {breakdownTitle}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 8 }}>
                    Click a payroll record below to open the original payroll record.
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBreakdownTitle("");
                    setBreakdownRows([]);
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 7,
                    border: "1px solid #dbe4ef",
                    background: "#ffffff",
                    color: "#334155",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: 14,
                      }}
                    >
                      Month and Year
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: 14,
                      }}
                    >
                      Payroll Record No.
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: 14,
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row, index) => (
                    <tr key={`${row.recordId}-${row.label}-${index}`}>
                      <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        {row.label}
                      </td>
                      <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setBreakdownTitle("");
                            setBreakdownRows([]);
                            openRecordById(row.recordId);
                          }}
                          style={{
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            color: "#1d4ed8",
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          {row.recordId}
                        </button>
                      </td>
                      <td style={{ padding: "14px 12px", borderBottom: "1px solid #e2e8f0" }}>
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {selectedRecord ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              zIndex: 50,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 900,
                background: "#ffffff",
                borderRadius: 20,
                border: "1px solid #e2e8f0",
                padding: 24,
                boxShadow: "0 20px 50px rgba(15,23,42,0.18)",
                maxHeight: "calc(100vh - 40px)",
                overflowY: "auto",
                margin: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "start",
                  marginBottom: 18,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
                    {selectedRecord.employeeName}
                  </div>
                  <div style={{ color: "#64748b", marginTop: 8 }}>
                    {selectedRecord.employeeNo} • {selectedRecord.month} {selectedRecord.year}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                
                  <button
                    onClick={() => setSelectedRecord(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 7,
                      border: "1px solid #dbe4ef",
                      background: "#ffffff",
                      color: "#334155",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 24,
                }}
              >
                <div>
                  <DetailRow label="Department" value={selectedRecord.department} />
                  <DetailRow label="Employment Status" value={selectedRecord.employmentStatus} />
                  <DetailRow label="Run Cutoff" value={formatCutoffIdentity(getRunCutoff(selectedRecord))} />
                  <DetailRow
                    label="Work Period Cutoff"
                    value={
                      isLateEndorsedRecord(selectedRecord)
                        ? `late endorsed -> WP: ${formatCutoffIdentity(selectedRecord.workPeriodCutoff)}`
                        : formatCutoffIdentity(selectedRecord.workPeriodCutoff || getRunCutoff(selectedRecord))
                    }
                  />
                  <DetailRow label="Basic Pay" value={formatCurrency(selectedRecord.basicPay)} />
                  <DetailRow
                    label="Total Payroll Premium"
                    value={formatCurrency(selectedRecord.totalPayrollPremium)}
                  />
                  <CustomComponentList
                    title="Custom Premiums"
                    tone="blue"
                    items={selectedRecord.customPremiums}
                  />
                  <DetailRow
                    label="Total Allowances"
                    value={formatCurrency(selectedRecord.totalAllowances)}
                  />
                  <CustomComponentList
                    title="Custom Allowances"
                    tone="green"
                    items={selectedRecord.customAllowances}
                  />
                  <CustomComponentList
                    title="Assigned De Minimis"
                    tone="green"
                    items={selectedRecordDeMinimisLines.map((line) => ({
                      id: line.benefitId,
                      name: `${line.name} (${line.hasOwnCeiling ? `own ceiling ${formatCurrency(line.ceiling || 0)}` : "shared 90k bucket"})`,
                      amount: line.amount,
                    }))}
                  />
                  <DetailRow
                    label="Total Absences"
                    value={formatCurrency(selectedRecord.totalAbsences)}
                  />
                </div>

                <div>
                  <DetailRow label="Gross Pay" value={formatCurrency(selectedRecord.grossPay)} />
                  <DetailRow
                    label="Taxable Income"
                    value={formatCurrency(selectedRecord.taxableIncome)}
                  />
                  <DetailRow
                    label="Withholding Tax"
                    value={formatCurrency(selectedRecord.withholdingTax)}
                  />
                  <DetailRow
                    label="Total Deductions"
                    value={formatCurrency(selectedRecord.totalDeductions)}
                  />
                  <CustomComponentList
                    title="Loan Deductions"
                    tone="red"
                    items={(selectedRecord.loanDeductions || []).map((line) => ({
                      id: line.loanId,
                      name: `${line.loanName} (remaining ${formatCurrency(line.remainingBalanceAfterDeduction)})`,
                      amount: line.amount,
                    }))}
                  />
                  <CustomComponentList
                    title="Custom Deductions"
                    tone="red"
                    items={selectedRecord.customDeductions}
                  />
                  <DetailRow
                    label="Employer Contributions"
                    value={formatCurrency(selectedRecord.employerContributions)}
                  />
                  <DetailRow
                    label="SSS Monthly Salary Credit (MSC)"
                    value={formatCurrency(selectedRecord.sssMonthlySalaryCredit || 0)}
                  />
                  <DetailRow
                    label="SSS Regular MSC"
                    value={formatCurrency(selectedRecord.sssRegularMonthlySalaryCredit || 0)}
                  />
                  <DetailRow
                    label="WISP / MPF MSC"
                    value={formatCurrency(selectedRecord.sssWispMonthlySalaryCredit || 0)}
                  />
                  <DetailRow
                    label="SSS EC - Employer Only"
                    value={formatCurrency(selectedRecord.sssEc || 0)}
                  />
                  <DetailRow
                    label="Regular SSS EE / ER"
                    value={`${formatCurrency(selectedRecord.sssRegularEe || 0)} / ${formatCurrency(selectedRecord.sssRegularEr || 0)}`}
                  />
                  <DetailRow
                    label="WISP / MPF EE / ER"
                    value={`${formatCurrency(selectedRecord.sssWispEe || 0)} / ${formatCurrency(selectedRecord.sssWispEr || 0)}`}
                  />
                  <DetailRow label="Net Pay" value={formatCurrency(selectedRecord.netPay)} />
                  <DetailRow
                    label="Adjusted Net Pay"
                    value={
                      (selectedRecord.payrollAdjustments?.length || 0) > 0
                        ? formatCurrency(getAdjustedNetPay(selectedRecord))
                        : "No adjustment yet"
                    }
                  />
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function PayrollRecordsPage() {
  return (
    <Suspense>
      <PayrollRecordsPageInner />
    </Suspense>
  );
}
