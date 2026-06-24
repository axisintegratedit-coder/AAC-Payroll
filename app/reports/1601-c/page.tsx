"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems } from "@/lib/firestore";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit, getAuditsByEntity, formatAuditTimestamp, auditActionLabel, type AuditEntry } from "@/lib/auditTrail";

type SavedPayrollAdjustment = {
  id: string;
  adjustmentBatchId?: string;
  payrollReference?: string;
  employeeId?: string;
  employeeName?: string;
  adjustmentCategory?: string;
  adjustmentLabel?: string;
  adjustmentType?: "Addition" | "Deduction" | "Employer Contribution" | string;
  hours?: number;
  originalHours?: number;
  rate?: number;
  amount?: number;
  finalAmount?: number;
  netPayEffect?: number;
  reason?: string;
  taxTreatment?: string;
  source?: string;
  sourceId?: string;
  createdAt?: string;
};

type PayrollRecord = {
  id?: string;
  payrollReference?: string;
  payrollDate?: string;
  payDate?: string;
  payoutDate?: string;
  datePaid?: string;
  month?: string | number;
  year?: string | number;
  payrollMonth?: string | number;
  payrollYear?: string | number;
  monthYear?: string;
  cutoff?: string;
  cutoffType?: string;
  payrollPeriod?: string;
  payrollFrequency?: string;
  periodStart?: string;
  periodEnd?: string;
  employeeId?: string;
  employeeNo?: string;
  employeeName?: string;
  employeeType?: string;
  isMinimumWageEarner?: boolean | string;

  basicPay?: number | string;
  grossPay?: number | string;
  grossCompensation?: number | string;
  totalGrossPay?: number | string;

  holidayPay?: number | string;
  overtimePay?: number | string;
  nightDifferentialPay?: number | string;
  nightShiftDifferential?: number | string;
  hazardPay?: number | string;

  thirteenthMonthPay?: number | string;
  otherBenefits?: number | string;
  achievementAwards?: number | string;
  christmasAnniversaryGifts?: number | string;
  cbaProductivityIncentives?: number | string;
  christmasBonus?: number | string;
  riceSubsidy?: number | string;
  uniformClothing?: number | string;
  laundryAllowance?: number | string;
  medicalCashDependents?: number | string;
  actualMedicalAssistance?: number | string;
  mealAllowanceOTNight?: number | string;
  otNightMealDays?: number | string;
  regionalDailyMinimumWage?: number | string;
  monetizedLeavePrivate?: number | string;
  monetizedLeaveDays?: number | string;
  dailyRate?: number | string;
  deMinimisBenefits?: number | string;
  nonTaxableAllowance?: number | string;
  nonTaxableCompensation?: number | string;
  otherNonTaxableCompensation?: number | string;

  sssEe?: number | string;
  philhealthEe?: number | string;
  phicEe?: number | string;
  pagibigEe?: number | string;
  hdmfEe?: number | string;
  unionDues?: number | string;

  taxableCompensation?: number | string;
  annualTaxableCompensation?: number | string;
  annualizedTaxableCompensation?: number | string;
  ytdTaxableCompensation?: number | string;
  taxableIncome?: number | string;
  withholdingTax?: number | string;
  taxWithheld?: number | string;
  compensationTaxWithheld?: number | string;
  taxAnnualizationAdjustment?: number | string;
  yearEndTaxAdjustment?: number | string;
  annualizationTaxAdjustment?: number | string;
  annualizedTaxAdjustment?: number | string;
  finalTaxAdjustment?: number | string;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment" | string;
  taxAnnualizationYear?: string;
  taxAnnualizationSource?: string;
  payrollAdjustments?: SavedPayrollAdjustment[];

  status?: string;
  approvalStatus?: string;
  payrollStatus?: string;
  reviewStatus?: string;
  runStatus?: string;
  workflowStatus?: string;
  approvalState?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByUser?: string;
  approvedAt?: string;
  approvedDate?: string;
  approvedOn?: string;
  approvalDate?: string;
  createdAt?: string;
  payrollRunId?: string;
  payrollRun?: string;
  archived?: boolean;
  deleted?: boolean;
  archiveStatus?: "Active" | "Archived";
};

type CompanyInfo = {
  companyName?: string;
  tradeName?: string;
  address?: string;
  contactNumber?: string;
  emailAddress?: string;
  tin?: string;
  registeredName?: string;
  registeredAddress?: string;
  telephone?: string;
  email?: string;
};

type StatutoryInfo = {
  companyTin?: string;
  tin?: string;
  rdoCode?: string;
  birContactEmail?: string;
};

type EmployeeInfo = {
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  isMinimumWageEarner?: boolean | string;
};

type BirRow = {
  item: string;
  label: string;
  amount: number;
  formula?: string;
  editable?: boolean;
};

type Saved1601CReport = {
  id: string;
  month: string;
  monthLabel: string;
  coveragePeriod: string;
  companyName: string;
  tin: string;
  taxesWithheld: number;
  taxRequiredForRemittance: number;
  adjustment: number;
  manualAdjustment?: number;
  yearEndTaxAdjustment?: number;
  penalties: number;
  totalAmountRemitted: number;
  dateRemitted: string;
  draweeBank: string;
  referenceNumber: string;
  rows: BirRow[];
  savedAt: string;
  archiveStatus?: "Active" | "Archived";
  archivedAt?: string;
  archivedBy?: string;
};

type Form1604CSettings = {
  amendedReturn?: "Yes" | "No";
  sheetsAttached?: string;
  releasedRefunds?: "Yes" | "No" | "N/A";
  refundDate?: string;
  totalOverremittance?: string;
  firstCreditingMonth?: string;
};

// Year-End Tax Annualization file types, key, and helper functions
type AnnualizationRow = {
  employeeNo?: string;
  employeeName?: string;
  year?: string | number;
  taxAdjustment?: number | string;
  adjustmentType?: "Refund" | "Additional Deduction" | "No Adjustment" | string;
};

type SavedAnnualizationFile = {
  id: string;
  year: string | number;
  savedAt?: string;
  rows?: AnnualizationRow[];
  adjustments?: AnnualizationRow[];
  archived?: boolean;
};

const FORM_1604C_SETTINGS_KEY = "form1604CSettings";
const YEAR_END_ANNUALIZATION_FILES_KEY = "yearEndTaxAnnualizationFiles";

function getReadableAccentTextColor(accentColor: string, preferredTextColor: string) {
  const hex = accentColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return preferredTextColor || "#0f172a";
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.58 ? "#0f172a" : preferredTextColor || "#ffffff";
}

type DeMinimisLimitPeriod = "monthly" | "annual" | "uncapped";

type DeMinimisLimit = {
  key: keyof PayrollRecord;
  limit: number | null;
  period: DeMinimisLimitPeriod;
};

const DE_MINIMIS_LIMITS: DeMinimisLimit[] = [
  { key: "riceSubsidy", limit: 2500, period: "monthly" },
  { key: "uniformClothing", limit: 8000, period: "annual" },
  { key: "laundryAllowance", limit: 400, period: "monthly" },
  { key: "medicalCashDependents", limit: 333, period: "monthly" },
  { key: "actualMedicalAssistance", limit: 12000, period: "annual" },
  { key: "achievementAwards", limit: 12000, period: "annual" },
  { key: "christmasAnniversaryGifts", limit: 6000, period: "annual" },
  { key: "cbaProductivityIncentives", limit: 12000, period: "annual" },
  { key: "deMinimisBenefits", limit: null, period: "uncapped" },
];

const PAYROLL_STORAGE_KEYS = [
  "payrollRecords",
  "savedPayrollRecords",
  "payroll_runs",
  "payrollRuns",
];

const COMPANY_STORAGE_KEYS = [
  "companyInformation",
  "companyProfile",
  "companyInfo",
  "savedCompanyProfile",
];
function getCompanyValue(company: CompanyInfo, primary: keyof CompanyInfo, fallback?: keyof CompanyInfo): string {
  const primaryValue = company[primary];
  const fallbackValue = fallback ? company[fallback] : "";

  return String(primaryValue || fallbackValue || "");
}

function getCompanyTin(company: CompanyInfo, statutoryInfo: StatutoryInfo): string {
  return String(
    company.tin ||
      statutoryInfo.companyTin ||
      statutoryInfo.tin ||
      ""
  ).trim();
}

function money(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value).replace(/[₱,\s]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function peso(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function plainAmount(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getRecordDate(record: PayrollRecord): string {
  return (
    record.payDate ||
    record.payoutDate ||
    record.datePaid ||
    record.payrollDate ||
    ""
  );
}

function getMonthKey(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthIndex(monthKey: string): number {
  if (!monthKey) return 0;

  const [year, month] = monthKey.split("-");
  return Number(year) * 12 + Number(month);
}

function getMonthLabel(monthKey: string): string {
  if (!monthKey) return "No month selected";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function getCoveragePeriod(monthKey: string): string {
  if (!monthKey) return "No coverage selected";

  const [year, month] = monthKey.split("-");
  const start = new Date(Number(year), Number(month) - 1, 1);
  const end = new Date(Number(year), Number(month), 0);

  const startLabel = start.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const endLabel = end.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} to ${endLabel}`;
}

function getPayrollRecordMonthKey(record: PayrollRecord): string {
  const rawMonthYear = String(record.monthYear || "").trim();
  if (rawMonthYear) {
    const isoMatch = rawMonthYear.match(/^(20\d{2})-(\d{1,2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${String(Number(isoMatch[2])).padStart(2, "0")}`;
    }

    const parsedMonthYear = new Date(`${rawMonthYear} 1`);
    if (!Number.isNaN(parsedMonthYear.getTime())) {
      return `${parsedMonthYear.getFullYear()}-${String(parsedMonthYear.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  const rawMonth = String(record.month || record.payrollMonth || "").trim();
  const rawYear = String(record.year || record.payrollYear || "").trim();

  if (rawMonth && rawYear) {
    const numericMonth = Number(rawMonth);
    if (Number.isFinite(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
      return `${rawYear}-${String(numericMonth).padStart(2, "0")}`;
    }

    const parsedMonth = new Date(`${rawMonth} 1, ${rawYear}`);
    if (!Number.isNaN(parsedMonth.getTime())) {
      return `${parsedMonth.getFullYear()}-${String(parsedMonth.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  return getMonthKey(getRecordDate(record));
}

function getPayrollRunKey(record: PayrollRecord): string {
  const runLabel =
    record.payrollReference ||
    record.cutoff ||
    record.cutoffType ||
    record.payrollPeriod ||
    record.payrollFrequency ||
    "Payroll Run";

  const periodLabel = [record.periodStart, record.periodEnd].filter(Boolean).join(" to ");
  const dateLabel = periodLabel || getRecordDate(record);

  return [dateLabel, runLabel].filter(Boolean).join(" - ");
}

function normalizeText(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isArchivedOrDeletedPayrollRecord(record: PayrollRecord): boolean {
  return (
    record.archived === true ||
    record.deleted === true ||
    normalizeText(record.archiveStatus) === "archived" ||
    normalizeText(record.status) === "archived" ||
    normalizeText(record.status) === "deleted"
  );
}

function hashPayrollRunKey(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildPayrollRunIdentityFromRecords(groupKey: string, records: PayrollRecord[]) {
  const identitySource = records
    .map((record) => `${record.id || ""}:${record.createdAt || ""}`)
    .sort()
    .join("|");

  return `${groupKey}-${hashPayrollRunKey(identitySource || groupKey)}`;
}

function getPayrollRunApprovalGroupKey(record: PayrollRecord): string {
  const payrollPeriod = String(record.payrollPeriod || "Monthly Payroll").trim();
  const monthKey = getPayrollRecordMonthKey(record);
  const [monthKeyYear, monthKeyMonth] = monthKey.split("-");
  const monthNameFromKey = monthKeyMonth
    ? new Date(Number(monthKeyYear), Number(monthKeyMonth) - 1, 1).toLocaleDateString("en-PH", { month: "long" })
    : "";
  const year = String(record.year || record.payrollYear || monthKeyYear || "").trim();
  const month = String(record.month || record.payrollMonth || monthNameFromKey || "").trim();

  return `${year}-${month}-${payrollPeriod}`;
}

function getApprovedPayrollRunRecordIds(records: PayrollRecord[], approvals: Record<string, { status?: string }>) {
  const groupedRecords = new Map<string, PayrollRecord[]>();

  records.forEach((record) => {
    const groupKey = getPayrollRunApprovalGroupKey(record);
    const currentGroup = groupedRecords.get(groupKey) || [];
    currentGroup.push(record);
    groupedRecords.set(groupKey, currentGroup);
  });

  const approvedRecordIds = new Set<string>();

  groupedRecords.forEach((groupRecords, groupKey) => {
    const runId = buildPayrollRunIdentityFromRecords(groupKey, groupRecords);
    const approvalStatus = normalizeText(approvals?.[runId]?.status);
    const hasRecordLevelApproval = groupRecords.some((record) => isApprovedPayrollRecord(record));

    if (approvalStatus === "approved" || hasRecordLevelApproval) {
      groupRecords.forEach((record) => {
        if (record.id) approvedRecordIds.add(record.id);
      });
    }
  });

  return approvedRecordIds;
}

function getEmployeeFullName(employee: EmployeeInfo): string {
  const givenNames = [employee.firstName, employee.middleName].filter(Boolean).join(" ");

  if (employee.lastName && givenNames) {
    return `${employee.lastName}, ${givenNames}`;
  }

  return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(" ");
}

function getPayrollEmployeeKey(record: PayrollRecord): string {
  return normalizeText(record.employeeNo || record.employeeId || record.employeeName || record.id);
}

function getItem23EmployeeKey(record: PayrollRecord): string {
  return normalizeText(record.employeeNo || record.employeeId || record.employeeName);
}

function isTruthyYes(value: unknown): boolean {
  const normalized = normalizeText(value);
  return value === true || normalized === "yes" || normalized === "true" || normalized === "mwe";
}

function isMinimumWageRecord(record: PayrollRecord, employees: EmployeeInfo[]): boolean {
  if (isTruthyYes(record.isMinimumWageEarner)) return true;

  const recordEmployeeNo = normalizeText(record.employeeNo || record.employeeId);
  const recordName = normalizeText(record.employeeName);

  const matchedEmployee = employees.find((employee) => {
    const employeeNo = normalizeText(employee.employeeNo || employee.employeeId);
    const employeeName = normalizeText(employee.employeeName || getEmployeeFullName(employee));

    return (
      (recordEmployeeNo && employeeNo && recordEmployeeNo === employeeNo) ||
      (recordName && employeeName && recordName === employeeName)
    );
  });

  return isTruthyYes(matchedEmployee?.isMinimumWageEarner);
}

async function loadFromFirestore<T>(keys: string[], fallback: T): Promise<T> {
  for (const key of keys) {
    const parsed = Array.isArray(fallback)
      ? await getDataArray<unknown>(key, []) as T | null
      : await getConfigItem<T | null>(key, null);
    if (parsed !== null) return parsed as T;
  }

  return fallback;
}

function normalizePayrollAdjustment(adjustment: SavedPayrollAdjustment): SavedPayrollAdjustment {
  const amount = money(adjustment.amount);
  const finalAmount = money(adjustment.finalAmount || adjustment.amount);
  const adjustmentType = adjustment.adjustmentType || "Addition";
  const netPayEffect =
    adjustment.netPayEffect !== undefined
      ? money(adjustment.netPayEffect)
      : adjustmentType === "Deduction"
        ? -Math.abs(finalAmount || amount)
        : Math.abs(finalAmount || amount);

  return {
    ...adjustment,
    amount,
    finalAmount: finalAmount || amount,
    netPayEffect,
    reason: adjustment.reason || adjustment.source || "Posted payroll adjustment",
  };
}

async function readSavedPayrollAdjustments(): Promise<SavedPayrollAdjustment[]> {
  try {
    const parsed = await getDataArray<SavedPayrollAdjustment>(storageKeys.payrollAdjustments, []);
    return Array.isArray(parsed) ? parsed.map((adjustment) => normalizePayrollAdjustment(adjustment)) : [];
  } catch (error) {
    console.error("Failed to load posted payroll adjustments for 1601-C", error);
    return [];
  }
}

function getPayrollRecordReferences(record: PayrollRecord): string[] {
  const references = [
    record.id,
    record.payrollReference,
    record.cutoff,
    record.cutoffType,
    record.payrollPeriod,
    record.payrollFrequency,
    record.periodStart && record.periodEnd ? `${record.periodStart} to ${record.periodEnd}` : "",
    getPayrollRunKey(record),
    getRecordDate(record),
  ];

  return references.filter((reference): reference is string => typeof reference === "string" && reference.trim().length > 0);
}

function payrollAdjustmentMatchesRecord(adjustment: SavedPayrollAdjustment, record: PayrollRecord) {
  const employeeMatches =
    normalizeText(adjustment.employeeId) === normalizeText(record.employeeNo || record.employeeId) ||
    normalizeText(adjustment.employeeName) === normalizeText(record.employeeName);

  if (!employeeMatches) return false;

  const payrollReference = String(adjustment.payrollReference || "").trim();
  if (!payrollReference) return false;

  return getPayrollRecordReferences(record).some((reference) => reference === payrollReference);
}

function mergePostedPayrollAdjustments(records: PayrollRecord[], postedAdjustments: SavedPayrollAdjustment[]): PayrollRecord[] {
  return records.map((record) => {
    const existingAdjustments = (record.payrollAdjustments || []).map((adjustment) => normalizePayrollAdjustment(adjustment));
    const existingIds = new Set(existingAdjustments.map((adjustment) => adjustment.id));
    const existingSourceIds = new Set(existingAdjustments.map((adjustment) => adjustment.sourceId).filter(Boolean));

    const matchedAdjustments = postedAdjustments.filter((adjustment) => {
      if (!payrollAdjustmentMatchesRecord(adjustment, record)) return false;
      if (existingIds.has(adjustment.id)) return false;
      if (adjustment.sourceId && existingSourceIds.has(adjustment.sourceId)) return false;
      return true;
    });

    return {
      ...record,
      payrollAdjustments: [...existingAdjustments, ...matchedAdjustments],
    };
  });
}

function getPayrollAdjustmentAmount(adjustment: SavedPayrollAdjustment): number {
  return money(adjustment.finalAmount || adjustment.amount);
}

function isTaxablePayrollAdjustment(adjustment: SavedPayrollAdjustment): boolean {
  const taxTreatment = normalizeText(adjustment.taxTreatment);
  if (!taxTreatment) return adjustment.adjustmentType === "Addition";
  return taxTreatment.includes("taxable") && !taxTreatment.includes("non-taxable") && !taxTreatment.includes("nontaxable");
}

function getPayrollAdjustmentCompensationEffect(record: PayrollRecord): number {
  return (record.payrollAdjustments || []).reduce((sum, adjustment) => {
    const amount = getPayrollAdjustmentAmount(adjustment);
    if (!amount) return sum;
    if (adjustment.adjustmentType === "Addition") return sum + amount;

    const category = normalizeText(`${adjustment.adjustmentCategory || ""} ${adjustment.adjustmentLabel || ""}`);
    const isSalaryReducingDeduction = category.includes("absence") || category.includes("leave without pay") || category.includes("lwop") || category.includes("salary deduction");

    return isSalaryReducingDeduction ? sum - Math.abs(amount) : sum;
  }, 0);
}

function getPayrollAdjustmentTaxableEffect(record: PayrollRecord): number {
  return (record.payrollAdjustments || []).reduce((sum, adjustment) => {
    const amount = getPayrollAdjustmentAmount(adjustment);
    if (!amount) return sum;
    if (adjustment.adjustmentType === "Addition" && isTaxablePayrollAdjustment(adjustment)) return sum + amount;

    const category = normalizeText(`${adjustment.adjustmentCategory || ""} ${adjustment.adjustmentLabel || ""}`);
    const isSalaryReducingDeduction = category.includes("absence") || category.includes("leave without pay") || category.includes("lwop") || category.includes("salary deduction");

    return isSalaryReducingDeduction ? sum - Math.abs(amount) : sum;
  }, 0);
}

function getGrossCompensation(record: PayrollRecord): number {
  const baseGrossCompensation =
    money(record.grossCompensation) ||
    money(record.grossPay) ||
    money(record.totalGrossPay) ||
    money(record.basicPay);

  return Math.max(0, baseGrossCompensation + getPayrollAdjustmentCompensationEffect(record));
}

function getMweBasicPay(record: PayrollRecord, employees: EmployeeInfo[]): number {
  if (!isMinimumWageRecord(record, employees)) return 0;
  return money(record.basicPay);
}

function getMwePremiumPays(record: PayrollRecord, employees: EmployeeInfo[]): number {
  if (!isMinimumWageRecord(record, employees)) return 0;

  return (
    money(record.holidayPay) +
    money(record.overtimePay) +
    money(record.nightDifferentialPay) +
    money(record.nightShiftDifferential) +
    money(record.hazardPay)
  );
}

function getRawThirteenthMonthAndOtherBenefits(record: PayrollRecord): number {
  return (
    money(record.thirteenthMonthPay) +
    money(record.otherBenefits) +
    money(record.christmasBonus)
  );
}


function getNonTaxableThirteenthMonthAndOtherBenefits(
  currentMonthRecords: PayrollRecord[],
  allRecords: PayrollRecord[],
  selectedMonth: string
): number {
  if (!hasSelectedMonth(selectedMonth)) return 0;

  const selectedYear = selectedMonth.split("-")[0];
  const selectedMonthIndex = getMonthIndex(selectedMonth);
  const priorBenefitsByEmployee = new Map<string, number>();
  const currentBenefitsUsedByEmployee = new Map<string, number>();

  allRecords.forEach((record) => {
    const recordMonthKey = getPayrollRecordMonthKey(record);
    if (!recordMonthKey) return;
    if (!recordMonthKey.startsWith(`${selectedYear}-`)) return;
    if (getMonthIndex(recordMonthKey) >= selectedMonthIndex) return;

    const employeeKey = getPayrollEmployeeKey(record);
    if (!employeeKey) return;

    priorBenefitsByEmployee.set(
      employeeKey,
      (priorBenefitsByEmployee.get(employeeKey) || 0) + getRawThirteenthMonthAndOtherBenefits(record)
    );
  });

  return currentMonthRecords.reduce((sum, record) => {
    const employeeKey = getPayrollEmployeeKey(record);
    if (!employeeKey) return sum;

    const rawCurrentBenefit = getRawThirteenthMonthAndOtherBenefits(record);
    const priorBenefits = priorBenefitsByEmployee.get(employeeKey) || 0;
    const currentBenefitsAlreadyUsed = currentBenefitsUsedByEmployee.get(employeeKey) || 0;
    const remainingAnnualCap = Math.max(90000 - priorBenefits - currentBenefitsAlreadyUsed, 0);
    const nonTaxableCurrentBenefit = Math.min(rawCurrentBenefit, remainingAnnualCap);

    currentBenefitsUsedByEmployee.set(
      employeeKey,
      currentBenefitsAlreadyUsed + rawCurrentBenefit
    );

    return sum + nonTaxableCurrentBenefit;
  }, 0);
}

function getNonTaxableOtNightMealAllowance(record: PayrollRecord): number {
  const rawAmount = money(record.mealAllowanceOTNight);
  if (!rawAmount) return 0;

  const qualifyingDays = money(record.otNightMealDays);
  const regionalDailyMinimumWage = money(record.regionalDailyMinimumWage);

  if (!qualifyingDays || !regionalDailyMinimumWage) return 0;

  const ceiling = regionalDailyMinimumWage * 0.3 * qualifyingDays;
  return Math.min(rawAmount, ceiling);
}

function getNonTaxableMonetizedLeave(record: PayrollRecord): number {
  const rawAmount = money(record.monetizedLeavePrivate);
  if (!rawAmount) return 0;

  const monetizedLeaveDays = money(record.monetizedLeaveDays);
  const dailyRate = money(record.dailyRate);

  if (!monetizedLeaveDays || !dailyRate) return 0;

  const allowedDays = Math.min(monetizedLeaveDays, 12);
  const ceiling = allowedDays * dailyRate;
  return Math.min(rawAmount, ceiling);
}

function getNonTaxableDeMinimisBenefits(
  currentMonthRecords: PayrollRecord[],
  allRecords: PayrollRecord[],
  selectedMonth: string
): number {
  if (!hasSelectedMonth(selectedMonth)) return 0;

  const selectedYear = selectedMonth.split("-")[0];
  const selectedMonthIndex = getMonthIndex(selectedMonth);
  const priorAnnualUsage = new Map<string, number>();
  const currentUsage = new Map<string, number>();

  allRecords.forEach((record) => {
    const recordMonthKey = getPayrollRecordMonthKey(record);
    if (!recordMonthKey) return;
    if (!recordMonthKey.startsWith(`${selectedYear}-`)) return;
    if (getMonthIndex(recordMonthKey) >= selectedMonthIndex) return;

    const employeeKey = getPayrollEmployeeKey(record);
    if (!employeeKey) return;

    DE_MINIMIS_LIMITS.forEach((config) => {
      if (config.period !== "annual" || config.limit === null) return;

      const rawAmount = money(record[config.key]);
      if (!rawAmount) return;

      const usageKey = `${employeeKey}-${String(config.key)}`;
      priorAnnualUsage.set(usageKey, (priorAnnualUsage.get(usageKey) || 0) + rawAmount);
    });
  });

  return currentMonthRecords.reduce((total, record) => {
    const employeeKey = getPayrollEmployeeKey(record);
    if (!employeeKey) return total;

    const recordTotal = DE_MINIMIS_LIMITS.reduce((sum, config) => {
      const rawAmount = money(record[config.key]);
      if (!rawAmount) return sum;
      if (config.limit === null) return sum + rawAmount;

      const usageKey = `${employeeKey}-${String(config.key)}`;
      const priorUsage = config.period === "annual" ? priorAnnualUsage.get(usageKey) || 0 : 0;
      const currentUsageSoFar = currentUsage.get(usageKey) || 0;
      const remainingLimit = Math.max(config.limit - priorUsage - currentUsageSoFar, 0);
      const nonTaxableAmount = Math.min(rawAmount, remainingLimit);

      currentUsage.set(usageKey, currentUsageSoFar + rawAmount);

      return sum + nonTaxableAmount;
    }, 0);

    return (
      total +
      recordTotal +
      getNonTaxableOtNightMealAllowance(record) +
      getNonTaxableMonetizedLeave(record)
    );
  }, 0);
}

function getMandatoryEmployeeContributions(record: PayrollRecord): number {
  return (
    money(record.sssEe) +
    money(record.philhealthEe) +
    money(record.phicEe) +
    money(record.pagibigEe) +
    money(record.hdmfEe) +
    money(record.unionDues)
  );
}

function getOtherNonTaxable(record: PayrollRecord): number {
  return (
    money(record.nonTaxableAllowance) +
    money(record.nonTaxableCompensation) +
    money(record.otherNonTaxableCompensation)
  );
}

function getTaxWithheld(record: PayrollRecord): number {
  return (
    money(record.taxWithheld) ||
    money(record.withholdingTax) ||
    money(record.compensationTaxWithheld)
  );
}


function getTaxAnnualizationAdjustment(record: PayrollRecord): number {
  return (
    money(record.taxAnnualizationAdjustment) ||
    money(record.yearEndTaxAdjustment) ||
    money(record.annualizationTaxAdjustment) ||
    money(record.annualizedTaxAdjustment) ||
    money(record.finalTaxAdjustment)
  );
}

function getYearEndAnnualizationRows(file?: SavedAnnualizationFile | null): AnnualizationRow[] {
  if (!file) return [];
  if (Array.isArray(file.rows)) return file.rows;
  if (Array.isArray(file.adjustments)) return file.adjustments;
  return [];
}

function getYearEndAnnualizationAdjustmentTotal(file?: SavedAnnualizationFile | null): number {
  return getYearEndAnnualizationRows(file).reduce((sum, row) => sum + money(row.taxAdjustment), 0);
}

function getYearEndAnnualizationApplicationAmount(file?: SavedAnnualizationFile | null): number {
  const totalAdjustment = getYearEndAnnualizationAdjustmentTotal(file);

  // Positive = underpayment/additional tax due, increases 1601-C remittance.
  // Negative = overpayment/refund, reduces 1601-C remittance.
  return totalAdjustment;
}

function getSelectableAnnualizationFilesFor1601C(
  files: SavedAnnualizationFile[],
  selectedMonth: string
): SavedAnnualizationFile[] {
  if (!hasSelectedMonth(selectedMonth)) return [];

  const [selectedYear] = selectedMonth.split("-").map(Number);
  if (!selectedYear) return [];

  return files.filter((file) => {
    if (file.archived) return false;

    const fileYear = Number(file.year);
    if (!fileYear) return false;

    return selectedYear > fileYear;
  });
}

function getSuggestedAnnualizationFileFor1601C(
  files: SavedAnnualizationFile[],
  selectedMonth: string
): SavedAnnualizationFile | null {
  if (!hasSelectedMonth(selectedMonth)) return null;

  const selectedYear = Number(selectedMonth.split("-")[0]);
  const priorYear = selectedYear - 1;

  return (
    files.find((file) => !file.archived && Number(file.year) === priorYear) ||
    getSelectableAnnualizationFilesFor1601C(files, selectedMonth)[0] ||
    null
  );
}

function isDeletedRecord(record: PayrollRecord): boolean {
  return String(record.status || "").toLowerCase().trim() === "deleted";
}

function isApprovedPayrollRecord(record?: PayrollRecord | null): boolean {
  if (!record) return false;

  const statuses = [
    record.status,
    record.approvalStatus,
    record.payrollStatus,
    record.reviewStatus,
    record.runStatus,
    record.workflowStatus,
    record.approvalState,
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);

  return statuses.some((status) => status === "approved");
}

function getTaxableCompensationForItem23(record: PayrollRecord): number {
  const baseTaxableCompensation = money(record.taxableCompensation) || money(record.taxableIncome);
  return Math.max(0, baseTaxableCompensation + getPayrollAdjustmentTaxableEffect(record));
}


function getKnownAnnualTaxableCompensation(record: PayrollRecord): number {
  return (
    money(record.annualTaxableCompensation) ||
    money(record.annualizedTaxableCompensation) ||
    money(record.ytdTaxableCompensation)
  );
}

function getItem23TaxableCompensationNotSubjectToWithholding(
  currentMonthRecords: PayrollRecord[],
  allRecords: PayrollRecord[],
  employees: EmployeeInfo[],
  selectedMonth: string
): number {
  if (!hasSelectedMonth(selectedMonth)) return 0;

  const selectedYear = selectedMonth.split("-")[0];
  const currentTaxableByEmployee = new Map<string, number>();
  const yearTaxableByEmployee = new Map<string, number>();
  const knownAnnualTaxableByEmployee = new Map<string, number>();
  const monthsWithRecordsByEmployee = new Map<string, Set<string>>();
  const mweEmployeeKeys = new Set<string>();

  currentMonthRecords.forEach((record) => {
    const employeeKey = getItem23EmployeeKey(record);
    if (!employeeKey) return;

    if (isMinimumWageRecord(record, employees)) {
      mweEmployeeKeys.add(employeeKey);
      return;
    }

    const taxableAmount = getTaxableCompensationForItem23(record);
    currentTaxableByEmployee.set(
      employeeKey,
      (currentTaxableByEmployee.get(employeeKey) || 0) + taxableAmount
    );
  });

  allRecords.forEach((record) => {
    if (isDeletedRecord(record)) return;

    const employeeKey = getItem23EmployeeKey(record);
    if (!employeeKey) return;

    if (isMinimumWageRecord(record, employees)) {
      mweEmployeeKeys.add(employeeKey);
      return;
    }

    const recordMonthKey = getPayrollRecordMonthKey(record);
    if (!recordMonthKey || !recordMonthKey.startsWith(`${selectedYear}-`)) return;

    const taxableAmount = getTaxableCompensationForItem23(record);
    yearTaxableByEmployee.set(
      employeeKey,
      (yearTaxableByEmployee.get(employeeKey) || 0) + taxableAmount
    );

    const monthSet = monthsWithRecordsByEmployee.get(employeeKey) || new Set<string>();
    monthSet.add(recordMonthKey);
    monthsWithRecordsByEmployee.set(employeeKey, monthSet);

    const knownAnnualTaxable = getKnownAnnualTaxableCompensation(record);
    if (knownAnnualTaxable > 0) {
      knownAnnualTaxableByEmployee.set(employeeKey, knownAnnualTaxable);
    }
  });

  let item23Total = 0;

  currentTaxableByEmployee.forEach((currentMonthTaxable, employeeKey) => {
    if (mweEmployeeKeys.has(employeeKey)) return;
    if (currentMonthTaxable <= 0) return;

    const knownAnnualTaxable = knownAnnualTaxableByEmployee.get(employeeKey) || 0;
    const yearTaxable = yearTaxableByEmployee.get(employeeKey) || currentMonthTaxable;
    const monthsWithRecords = monthsWithRecordsByEmployee.get(employeeKey)?.size || 1;
    const annualizedTaxable = knownAnnualTaxable || Math.max(yearTaxable, (yearTaxable / monthsWithRecords) * 12);

    if (annualizedTaxable <= 250000) {
      item23Total += currentMonthTaxable;
    }
  });

  return item23Total;
}

function hasSelectedMonth(monthKey: string): boolean {
  return Boolean(monthKey && monthKey.trim());
}

export default function TaxInfo1601CPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({});
  const [statutoryInfo, setStatutoryInfo] = useState<StatutoryInfo>({});
  const [employees, setEmployees] = useState<EmployeeInfo[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [dateRemitted, setDateRemitted] = useState("");
  const [draweeBank, setDraweeBank] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [penaltiesAmount, setPenaltiesAmount] = useState("0");
  const [saved1601CReports, setSaved1601CReports] = useState<Saved1601CReport[]>([]);
  const [saved1601CAuditEntries, setSaved1601CAuditEntries] = useState<Record<string, AuditEntry[]>>({});
  const [saved1601CView, setSaved1601CView] = useState<"Active" | "Archived">("Active");
  const [viewedSavedReport, setViewedSavedReport] = useState<Saved1601CReport | null>(null);
  const [form1604CSettings, setForm1604CSettings] = useState<Form1604CSettings>({});
  const [savedAnnualizationFiles, setSavedAnnualizationFiles] = useState<SavedAnnualizationFile[]>([]);
  const [selectedAnnualizationFileId, setSelectedAnnualizationFileId] = useState("");
  const [applyAnnualizationAdjustment, setApplyAnnualizationAdjustment] = useState(false);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    async function loadAuditEntries() {
      const entries = await Promise.all(
        saved1601CReports.map(async (report) => {
          const auditId = report.id || report.month;
          return [auditId, await getAuditsByEntity("Report_1601C", auditId)] as const;
        })
      );
      setSaved1601CAuditEntries(Object.fromEntries(entries));
    }

    loadAuditEntries();
  }, [saved1601CReports]);

  useEffect(() => {
    async function load() {
    const payrollData = await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords);

    const companyData = await getConfigItem<CompanyInfo>(storageKeys.companyInformation, {});
    const statutoryData = await getConfigItem<StatutoryInfo>(storageKeys.statutoryInfo, {});

    const postedPayrollAdjustments = await readSavedPayrollAdjustments();
    const payrollRunApprovals = await getConfigItem<
      Record<
        string,
        {
          status?: string;
          preparedAt?: string;
          checkedAt?: string;
          approvedAt?: string;
          lockedAt?: string;
          returnedAt?: string;
        }
      >
    >(storageKeys.payrollRunApprovals, {});
    const activePayrollData = Array.isArray(payrollData)
      ? payrollData.filter((record) => !isArchivedOrDeletedPayrollRecord(record))
      : [];
    const approvedRecordIds = getApprovedPayrollRunRecordIds(activePayrollData, payrollRunApprovals);

    const payrollRecordsWithAdjustments = activePayrollData.length > 0
      ? mergePostedPayrollAdjustments(activePayrollData, postedPayrollAdjustments)
          .map((record) => {
            const payrollPeriod = (record.payrollPeriod || "Monthly Payroll").trim();
            const payrollRunId = String(record.payrollRunId || record.payrollRun || record.payrollReference || "").trim();
            const monthKey = getPayrollRecordMonthKey(record);
            const monthLabel = getMonthLabel(monthKey);
            const possibleApprovalKeys = [
              payrollRunId,
              record.id,
              `${record.year}-${record.month}-${payrollPeriod}`,
              `${record.payrollYear}-${record.payrollMonth}-${payrollPeriod}`,
              `${monthKey}-${payrollPeriod}`,
              `${monthLabel}-${payrollPeriod}-${record.year || record.payrollYear || ""}`,
              `${record.year || record.payrollYear || ""}-${monthLabel}-${payrollPeriod}`,
            ]
              .map((key) => String(key || "").trim())
              .filter((key) => key && !key.includes("undefined"));

            const approval = possibleApprovalKeys
              .map((key) => payrollRunApprovals[key])
              .find(Boolean);

            const recordCreatedAt = new Date(record.createdAt || "").getTime();
            const latestApprovalTime = approval
              ? Math.max(
                  new Date(approval.preparedAt || "").getTime() || 0,
                  new Date(approval.checkedAt || "").getTime() || 0,
                  new Date(approval.approvedAt || "").getTime() || 0,
                  new Date(approval.lockedAt || "").getTime() || 0,
                  new Date(approval.returnedAt || "").getTime() || 0
                )
              : 0;
            const isStaleApproval =
              Number.isFinite(recordCreatedAt) &&
              recordCreatedAt > 0 &&
              latestApprovalTime > 0 &&
              recordCreatedAt > latestApprovalTime;
            const approvalStatus = String(!isStaleApproval ? approval?.status || "" : "").trim();

            const runApprovedStatus = record.id && approvedRecordIds.has(record.id) ? "Approved" : "";
            const finalApprovalStatus = approvalStatus || runApprovedStatus || record.approvalStatus || record.status || "";

            return {
              ...record,
              status: finalApprovalStatus,
              approvalStatus: finalApprovalStatus,
            };
          })
          .filter(
            (record) =>
              !isArchivedOrDeletedPayrollRecord(record) &&
              (isApprovedPayrollRecord(record) || Boolean(record.id && approvedRecordIds.has(record.id)))
          )
      : [];

    setRecords(payrollRecordsWithAdjustments);
    setCompany(companyData || {});
    setStatutoryInfo(statutoryData || {});

    const savedEmployees = await getCollectionItems<EmployeeInfo>(storageKeys.employees);
    setEmployees(Array.isArray(savedEmployees) ? savedEmployees : []);

    try {
      const payrollMonthSet = new Set(
        payrollRecordsWithAdjustments
          .map((record) => getPayrollRecordMonthKey(record))
          .filter(Boolean)
      );
      const savedReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
      const validSavedReports = Array.isArray(savedReports)
        ? savedReports.filter((report) => payrollMonthSet.has(report.month) && report.archiveStatus !== "Archived")
        : [];
      setSaved1601CReports(validSavedReports);
    } catch (error) {
      console.error("Failed to load saved 1601-C reports", error);
      setSaved1601CReports([]);
    }

    try {
      const parsed1604CSettings = await getConfigItem<Form1604CSettings>(FORM_1604C_SETTINGS_KEY, {});
      setForm1604CSettings(
        parsed1604CSettings && typeof parsed1604CSettings === "object"
          ? parsed1604CSettings
          : {}
      );
    } catch (error) {
      console.error("Failed to load 1604-C settings for 1601-C crediting", error);
      setForm1604CSettings({});
    }

    try {
      const annualizationFiles = await getDataArray<SavedAnnualizationFile>(YEAR_END_ANNUALIZATION_FILES_KEY, []);
      setSavedAnnualizationFiles(Array.isArray(annualizationFiles) ? annualizationFiles : []);
    } catch (error) {
      console.error("Failed to load year-end annualization files for 1601-C", error);
      setSavedAnnualizationFiles([]);
    }
    }

    load();
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

  const availableMonths = useMemo(() => {
    const months = Array.from(
      new Set(
        records
          .map((record) => getPayrollRecordMonthKey(record))
          .filter(Boolean)
      )
    );

    return months.sort().reverse();
  }, [records]);


  const filteredRecords = useMemo(() => {
    if (!hasSelectedMonth(selectedMonth)) return [];

    return records.filter((record) => {
      const recordMonth = getPayrollRecordMonthKey(record);
      const matchesMonth = recordMonth === selectedMonth;

      const isActiveRecord = !isArchivedOrDeletedPayrollRecord(record);
      const isApproved = isApprovedPayrollRecord(record);

      return matchesMonth && isActiveRecord && isApproved;
    });
  }, [records, selectedMonth]);

  const priorYearOverremittanceCreditFrom1604C = useMemo(() => {
    if (!hasSelectedMonth(selectedMonth)) return 0;

    const [, selectedMonthNumber] = selectedMonth.split("-");
    const firstCreditingMonth = String(form1604CSettings.firstCreditingMonth || "").padStart(2, "0");
    const overremittance = money(form1604CSettings.totalOverremittance);

    if (!firstCreditingMonth || !overremittance) return 0;
    if (selectedMonthNumber !== firstCreditingMonth) return 0;

    return -Math.abs(overremittance);
  }, [selectedMonth, form1604CSettings]);

  const selectableAnnualizationFiles = useMemo(
    () => getSelectableAnnualizationFilesFor1601C(savedAnnualizationFiles, selectedMonth),
    [savedAnnualizationFiles, selectedMonth]
  );

  const suggestedAnnualizationFile = useMemo(
    () => getSuggestedAnnualizationFileFor1601C(savedAnnualizationFiles, selectedMonth),
    [savedAnnualizationFiles, selectedMonth]
  );

  useEffect(() => {
    if (!hasSelectedMonth(selectedMonth)) {
      setApplyAnnualizationAdjustment(false);
      setSelectedAnnualizationFileId("");
      return;
    }

    if (suggestedAnnualizationFile) {
      setSelectedAnnualizationFileId((current) => current || suggestedAnnualizationFile.id);
      setApplyAnnualizationAdjustment(true);
      return;
    }

    setApplyAnnualizationAdjustment(false);
    setSelectedAnnualizationFileId("");
  }, [selectedMonth, suggestedAnnualizationFile]);

  const selectedAnnualizationFile = useMemo(
    () => selectableAnnualizationFiles.find((file) => file.id === selectedAnnualizationFileId) || null,
    [selectableAnnualizationFiles, selectedAnnualizationFileId]
  );

  const yearEndAnnualizationAdjustmentFor1601C = useMemo(() => {
    if (!applyAnnualizationAdjustment) return 0;
    return getYearEndAnnualizationApplicationAmount(selectedAnnualizationFile);
  }, [applyAnnualizationAdjustment, selectedAnnualizationFile]);

  const computation = useMemo(() => {
    const item14 = filteredRecords.reduce(
      (sum, record) => sum + getGrossCompensation(record),
      0
    );

    const item15 = filteredRecords.reduce(
      (sum, record) => sum + getMweBasicPay(record, employees),
      0
    );

    const item16 = filteredRecords.reduce(
      (sum, record) => sum + getMwePremiumPays(record, employees),
      0
    );

    const item17 = getNonTaxableThirteenthMonthAndOtherBenefits(
      filteredRecords,
      records,
      selectedMonth
    );

    const item18 = getNonTaxableDeMinimisBenefits(
      filteredRecords,
      records,
      selectedMonth
    );

    const item19 = filteredRecords.reduce(
      (sum, record) => sum + getMandatoryEmployeeContributions(record),
      0
    );

    const item20 = filteredRecords.reduce(
      (sum, record) => sum + getOtherNonTaxable(record),
      0
    );

    const item21 = item15 + item16 + item17 + item18 + item19 + item20;
    const item22 = Math.max(item14 - item21, 0);

    const item23 = Math.min(
      getItem23TaxableCompensationNotSubjectToWithholding(
        filteredRecords,
        records,
        employees,
        selectedMonth
      ),
      item22
    );

    const item24 = Math.max(item22 - item23, 0);

    const item25 = filteredRecords.reduce(
      (sum, record) => sum + getTaxWithheld(record),
      0
    );

    const item26 =
      money(adjustmentAmount) +
      priorYearOverremittanceCreditFrom1604C +
      yearEndAnnualizationAdjustmentFor1601C;
    const item27 = item25 + item26;

    const rows: BirRow[] = [
      {
        item: "14",
        label: "Total Amount of Compensation",
        amount: item14,
        formula: "Total gross compensation paid for the selected month, including posted payroll run adjustments such as leave conversion pay",
      },
      {
        item: "15",
        label: "Statutory Minimum Wage (MWEs)",
        amount: item15,
        formula: "Basic pay of employees marked as Minimum Wage Earners",
      },
      {
        item: "16",
        label:
          "Holiday Pay, Overtime Pay, Night Shift Differential Pay, Hazard Pay (Minimum Wage Earner)",
        amount: item16,
        formula:
          "Holiday pay + overtime pay + night shift differential + hazard pay for MWEs only",
      },
      {
        item: "17",
        label: "13th Month Pay and Other Benefits",
        amount: item17,
        formula: "Non-taxable 13th month pay + Christmas bonus + other bonus-type benefits, capped at ₱90,000 per employee per year; excess remains taxable",
      },
      {
        item: "18",
        label: "De Minimis Benefits",
        amount: item18,
        formula: "De minimis benefits are capped per BIR limits; OT/night meal needs qualifying days and regional minimum wage; monetized leave is limited to 12 days per year",
      },
      {
        item: "19",
        label:
          "SSS, GSIS, PHIC, HDMF Mandatory Contributions and Union Dues (employee's share only)",
        amount: item19,
        formula:
          "Employee share only: SSS EE + PHIC EE + HDMF EE + union dues",
      },
      {
        item: "20",
        label: "Other Non-Taxable Compensation",
        amount: item20,
        formula:
          "Other exempt compensation not already included in Items 15 to 19",
      },
      {
        item: "21",
        label: "Total Non-Taxable Compensation",
        amount: item21,
        formula: "Items 15 + 16 + 17 + 18 + 19 + 20",
      },
      {
        item: "22",
        label: "Total Taxable Compensation",
        amount: item22,
        formula: "Item 14 less Item 21; taxable payroll adjustments are included when posted to the selected payroll run",
      },
      {
        item: "23",
        label:
          "Less: Taxable compensation not subject to withholding tax for employees receiving ₱250,000 and below for the year",
        amount: item23,
        formula:
          "Auto-computed from payroll records. Includes taxable compensation of non-MWE employees whose annualized taxable compensation is ₱250,000 or below.",
      },
      {
        item: "24",
        label: "Net Taxable Compensation",
        amount: item24,
        formula: "Item 22 less Item 23",
      },
      {
        item: "25",
        label: "Total Taxes Withheld",
        amount: item25,
        formula: "Total withholding tax deducted from payroll",
      },
      {
        item: "26",
        label: "Add/(Less): Adjustment of Taxes Withheld from Previous Month/s",
        amount: item26,
        formula: "Manual adjustment plus prior-year overremittance credit from 1604-C plus applied year-end tax annualization overpayment/refund or underpayment/additional tax",
      },
      {
        item: "27",
        label: "Tax Required to be Withheld for Remittance",
        amount: item27,
        formula: "Item 25 + Item 26",
      },
    ];

    return {
      rows,
      item14,
      item21,
      item22,
      item24,
      item25,
      item26,
      item27,
    };
  }, [filteredRecords, employees, records, selectedMonth, adjustmentAmount, priorYearOverremittanceCreditFrom1604C, yearEndAnnualizationAdjustmentFor1601C]);

  const uniqueEmployees = useMemo(() => {
    return new Set(
      filteredRecords
        .map((record) => record.employeeId || record.employeeName)
        .filter(Boolean)
    ).size;
  }, [filteredRecords]);


  const totalAmountRemitted = useMemo(() => {
    return computation.item27 + money(penaltiesAmount);
  }, [computation.item27, penaltiesAmount]);

  async function loadSaved1601CReports(view: "Active" | "Archived" = saved1601CView): Promise<Saved1601CReport[]> {
    try {
      const savedReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
      if (!Array.isArray(savedReports)) return [];

      const payrollMonthSet = new Set(
        records
          .filter((record) => !isArchivedOrDeletedPayrollRecord(record) && isApprovedPayrollRecord(record))
          .map((record) => getPayrollRecordMonthKey(record))
          .filter(Boolean)
      );

      return savedReports.filter((report) => {
        const matchesPayrollMonth = payrollMonthSet.has(report.month);
        const matchesArchiveView = view === "Archived" ? report.archiveStatus === "Archived" : report.archiveStatus !== "Archived";

        return matchesPayrollMonth && matchesArchiveView;
      });
    } catch (error) {
      console.error("Failed to load saved 1601-C reports", error);
      return [];
    }
  }

  async function switchSaved1601CView(nextView: "Active" | "Archived") {
    setSaved1601CView(nextView);
    setSaved1601CReports(await loadSaved1601CReports(nextView));
    setViewedSavedReport(null);
  }

  function buildSaved1601CReport(): Saved1601CReport | null {
    if (!selectedMonth) {
      window.alert("Please select a month before saving the 1601-C worksheet.");
      return null;
    }
    if (filteredRecords.length === 0) {
      window.alert("No payroll records found for the selected month. The 1601-C worksheet cannot be saved for a month without payroll records.");
      return null;
    }

    return {
      id: selectedMonth,
      month: selectedMonth,
      monthLabel: getMonthLabel(selectedMonth),
      coveragePeriod: getCoveragePeriod(selectedMonth),
      companyName: getCompanyValue(company, "companyName", "registeredName"),
      tin: getCompanyTin(company, statutoryInfo),
      taxesWithheld: computation.item25,
      taxRequiredForRemittance: computation.item27,
      adjustment: computation.item26,
      manualAdjustment: money(adjustmentAmount),
      yearEndTaxAdjustment: priorYearOverremittanceCreditFrom1604C + yearEndAnnualizationAdjustmentFor1601C,
      penalties: money(penaltiesAmount),
      totalAmountRemitted,
      dateRemitted,
      draweeBank,
      referenceNumber,
      rows: computation.rows,
      savedAt: new Date().toISOString(),
    };
  }

  function build1601CExcelContent(report: Saved1601CReport): string {
    const rowsHtml = report.rows
      .map(
        (row) => `
          <tr>
            <td>${row.item}</td>
            <td>${row.label}</td>
            <td>${row.formula || ""}</td>
            <td style="text-align:right;">${plainAmount(row.amount)}</td>
          </tr>`
      )
      .join("");

    return `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
            th, td { border: 1px solid #999; padding: 8px; vertical-align: top; }
            th { background: #e5e7eb; font-weight: bold; }
            .title { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="4" class="title">BIR Form 1601-C Worksheet</td></tr>
            <tr><td>Month</td><td colspan="3">${report.monthLabel}</td></tr>
            <tr><td>Coverage Period</td><td colspan="3">${report.coveragePeriod}</td></tr>
            <tr><td>Company Name</td><td colspan="3">${report.companyName}</td></tr>
            <tr><td>TIN</td><td colspan="3">${report.tin}</td></tr>
            <tr><td>Date Remitted</td><td colspan="3">${report.dateRemitted}</td></tr>
            <tr><td>Drawee Bank / Bank Code / Agency</td><td colspan="3">${report.draweeBank}</td></tr>
            <tr><td>TRA/eROR/eAR Number</td><td colspan="3">${report.referenceNumber}</td></tr>
            <tr><td>Manual Adjustment</td><td colspan="3">${plainAmount(report.manualAdjustment || 0)}</td></tr>
            <tr><td>Prior-Year Credit / Year-End Tax Annualization Adjustment</td><td colspan="3">${plainAmount(report.yearEndTaxAdjustment || 0)}</td></tr>
            <tr><td>Total Adjustment / Item 26</td><td colspan="3">${plainAmount(report.adjustment)}</td></tr>
            <tr><td>Tax Required for Remittance</td><td colspan="3">${plainAmount(report.taxRequiredForRemittance || report.taxesWithheld + report.adjustment)}</td></tr>
            <tr><td>Penalties</td><td colspan="3">${plainAmount(report.penalties)}</td></tr>
            <tr><td>Total Amount Remitted</td><td colspan="3">${plainAmount(report.totalAmountRemitted)}</td></tr>
            <tr><td colspan="4"></td></tr>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Basis / Note</th>
              <th>Amount</th>
            </tr>
            ${rowsHtml}
          </table>
        </body>
      </html>
    `;
  }

  function download1601CExcelReport(report: Saved1601CReport) {
    const excelContent = build1601CExcelContent(report);
    const blob = new Blob([excelContent], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `1601C-${report.month}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function save1601CReport() {
    const nextReport = buildSaved1601CReport();
    if (!nextReport) return;

    const savedReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
    const activeNextReport = {
      ...nextReport,
      archiveStatus: "Active" as const,
    };
    const nextReports = [
      ...(Array.isArray(savedReports) ? savedReports.filter((report) => report.month !== selectedMonth) : []),
      activeNextReport,
    ].sort((a, b) => a.month.localeCompare(b.month));

    await setDataArray(storageKeys.saved1601CReports, nextReports);
    setSaved1601CView("Active");
    setSaved1601CReports(nextReports.filter((report) => report.archiveStatus !== "Archived"));
    setViewedSavedReport(activeNextReport);
    logAudit({ action: "SAVED", entityType: "Report_1601C", entityId: activeNextReport.id || activeNextReport.month, entityName: `1601-C ${activeNextReport.monthLabel}` });
    window.dispatchEvent(new Event("saved-1601c-reports-updated"));
    window.alert("1601-C worksheet saved. It is ready for viewing, Excel download, and 1604-C summary.");
  }

  async function archiveSaved1601CReport(report: Saved1601CReport) {
    const confirmed = window.confirm(
      `Archive the saved 1601-C worksheet for ${report.monthLabel}? It will be hidden from the active Saved 1601-C Files list but kept in storage for audit trail.`
    );

    if (!confirmed) return;

    const currentReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
    const now = new Date().toISOString();
    const nextReports = Array.isArray(currentReports)
      ? currentReports.map((savedReport) => {
          if (savedReport.id !== report.id && savedReport.month !== report.month) return savedReport;

          return {
            ...savedReport,
            archiveStatus: "Archived" as const,
            archivedAt: now,
            archivedBy: "Current User",
          };
        })
      : [];

    await setDataArray(storageKeys.saved1601CReports, nextReports);
    setSaved1601CReports(nextReports.filter((savedReport) => savedReport.archiveStatus !== "Archived"));

    if (viewedSavedReport?.id === report.id || viewedSavedReport?.month === report.month) {
      setViewedSavedReport(null);
    }

    logAudit({ action: "ARCHIVED", entityType: "Report_1601C", entityId: report.id || report.month, entityName: `1601-C ${report.monthLabel}` });
    window.dispatchEvent(new Event("saved-1601c-reports-updated"));
    window.alert("Saved 1601-C worksheet archived.");
  }

  async function restoreSaved1601CReport(report: Saved1601CReport) {
    const confirmed = window.confirm(
      `Restore the saved 1601-C worksheet for ${report.monthLabel}? It will appear again in the active Saved 1601-C Files list.`
    );

    if (!confirmed) return;

    const currentReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
    const nextReports = Array.isArray(currentReports)
      ? currentReports.map((savedReport) => {
          if (savedReport.id !== report.id && savedReport.month !== report.month) return savedReport;

          return {
            ...savedReport,
            archiveStatus: "Active" as const,
            archivedAt: undefined,
            archivedBy: undefined,
          };
        })
      : [];

    await setDataArray(storageKeys.saved1601CReports, nextReports);
    setSaved1601CReports(nextReports.filter((savedReport) => savedReport.archiveStatus === "Archived"));

    if (viewedSavedReport?.id === report.id || viewedSavedReport?.month === report.month) {
      setViewedSavedReport(null);
    }

    logAudit({ action: "RESTORED", entityType: "Report_1601C", entityId: report.id || report.month, entityName: `1601-C ${report.monthLabel}` });
    window.dispatchEvent(new Event("saved-1601c-reports-updated"));
    window.alert("Saved 1601-C worksheet restored.");
  }

  function export1601CExcelReport() {
    const report = buildSaved1601CReport();
    if (!report) return;
    logAudit({ action: "EXPORTED", entityType: "Report_1601C", entityId: report.id || report.month, entityName: `1601-C ${report.monthLabel}`, details: "Excel export" });
    download1601CExcelReport(report);
  }



  const activeTheme = normalizeTheme(theme);
  const accentButtonTextColor = getReadableAccentTextColor(activeTheme.accentColor, activeTheme.bannerButtonTextColor);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle = {
    backgroundColor: activeTheme.bannerColor,
    backgroundImage: activeTheme.bannerImageDataUrl
      ? `linear-gradient(${activeTheme.bannerColor}${bannerOverlayAlpha}, ${activeTheme.bannerColor}${bannerOverlayAlpha}), url(${activeTheme.bannerImageDataUrl})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <main
      className="axis-1601c-page min-h-screen px-4 py-5 text-slate-900 sm:px-6 lg:px-8"
      style={{
        "--report-banner": activeTheme.bannerColor,
        "--report-accent": activeTheme.accentColor,
        "--report-button-text": accentButtonTextColor,
      } as CSSProperties}
    >
      <style>{`
        .axis-1601c-page {
          background: linear-gradient(180deg, var(--report-banner) 0%, var(--report-banner) 290px, #f4f8fc 290px, #f4f8fc 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .axis-1601c-page > div > section:not(.axis-1601c-hero) {
          border: 1px solid rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.96) !important;
          border-radius: 16px !important;
          box-shadow: 0 14px 38px -32px rgba(8,47,73,0.78) !important;
        }

        .axis-1601c-page input,
        .axis-1601c-page select,
        .axis-1601c-page textarea {
          border-color: #dbe4ef !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .axis-1601c-page button {
          border-radius: 10px !important;
          box-shadow: 0 10px 24px -22px rgba(8,47,73,0.75);
        }

        .axis-1601c-page table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: #ffffff;
        }

        .axis-1601c-page thead,
        .axis-1601c-page thead tr {
          background: #f8fafc !important;
        }

        .axis-1601c-page th {
          border-bottom: 1px solid #dbe4ef !important;
          color: #475569 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          letter-spacing: 0.02em !important;
        }

        .axis-1601c-page td {
          border-color: #e6edf5 !important;
          font-size: 12px !important;
        }

        .axis-1601c-page tbody tr:hover {
          background: #f0f9ff !important;
        }

        .axis-1601c-page .bg-blue-700,
        .axis-1601c-page .hover\\:bg-blue-800:hover {
          background-color: var(--report-accent) !important;
          color: var(--report-button-text) !important;
        }

        .axis-1601c-page .text-blue-700,
        .axis-1601c-page .text-blue-800,
        .axis-1601c-page .text-blue-900 {
          color: var(--report-accent) !important;
        }

        .axis-1601c-page .border-blue-100,
        .axis-1601c-page .border-blue-200,
        .axis-1601c-page .border-blue-700 {
          border-color: color-mix(in srgb, var(--report-accent) 28%, #dbe4ef) !important;
        }

        .axis-1601c-page .bg-blue-50 {
          background-color: color-mix(in srgb, var(--report-accent) 9%, #ffffff) !important;
        }

        @media print {
          * { overflow: visible !important; max-height: none !important; height: auto !important; }
          header { display: none !important; }
          .axis-1601c-page {
            background: white !important;
            padding: 8px !important;
            min-height: 0 !important;
          }
          .axis-1601c-page > div { gap: 16px !important; }
          .axis-1601c-page button { display: none !important; }
          .axis-1601c-page .axis-1601c-hero {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="mx-auto grid max-w-7xl gap-6">
        <section
          className="axis-1601c-hero relative overflow-hidden rounded-2xl border px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderColor: `${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
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
                  Tax Reports
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Monthly Withholding
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Tax Info on 1601-C</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
                Choose a filing month, review computed tax, and save the worksheet for 1604-C reporting.
              </p>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Month</p>
                <p className="mt-1 font-semibold">{selectedMonth ? getMonthLabel(selectedMonth) : "Select"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Records</p>
                <p className="mt-1 font-semibold">{filteredRecords.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Tax Due</p>
                <p className="mt-1 font-semibold">{peso(totalAmountRemitted)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">1601-C Workflow</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Complete this page in four quick stages</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                The page is arranged from top to bottom, so you can finish one stage before moving to the next.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              Current stage: {selectedMonth ? "Review and finalize" : "Select filing month"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                step: "01",
                title: "Choose month",
                desc: "Pick the payroll month to generate the 1601-C worksheet.",
                active: !selectedMonth,
              },
              {
                step: "02",
                title: "Review summary",
                desc: "Check coverage, employees included, and total taxes withheld.",
                active: Boolean(selectedMonth) && filteredRecords.length > 0,
              },
              {
                step: "03",
                title: "Enter remittance",
                desc: "Input payment details, penalties, and optional adjustments.",
                active: Boolean(selectedMonth) && filteredRecords.length > 0,
              },
              {
                step: "04",
                title: "Save or export",
                desc: "Save for 1604-C or export the worksheet as Excel.",
                active: Boolean(selectedMonth) && filteredRecords.length > 0,
              },
            ].map((stage) => (
              <div
                key={stage.step}
                className={`rounded-[22px] border p-4 transition ${stage.active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-black ${stage.active ? "bg-blue-700 text-white" : "bg-white text-slate-500"}`}>
                    {stage.step}
                  </span>
                  <p className="font-black text-slate-950">{stage.title}</p>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{stage.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-blue-200 border-l-8 border-l-blue-700 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Worksheet Actions</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Save or export after reviewing the worksheet</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Use these after selecting a month and reviewing the computation below.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={save1601CReport}
                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
              >
                Save Worksheet
              </button>
              <button
                onClick={export1601CExcelReport}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Export Excel
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-l-8 border-l-blue-700 pl-4 lg:grid-cols-4" aria-label="Step 1 filing month and summary">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Step 1 • Filing Month
            </label>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">
                {availableMonths.length === 0 ? "No payroll records" : "Select month"}
              </option>

              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Coverage Period
            </p>
            <p className="mt-4 text-lg font-bold text-slate-950">
              {getCoveragePeriod(selectedMonth)}
            </p>
          </div>


          <div className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Employees Included
            </p>
            <p className="mt-2 text-[22px] font-black leading-tight text-blue-700">
              {uniqueEmployees}
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Total Taxes Withheld
            </p>
            <p className="mt-2 text-[22px] font-black leading-tight text-emerald-700">
              {peso(computation.item25)}
            </p>
          </div>
        </section>

        <section className="rounded-[32px] border border-amber-200 border-l-8 border-l-amber-500 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-amber-100 bg-amber-50/40 -m-6 mb-0 rounded-t-[32px] p-6 pb-5">
            <div className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700 shadow-sm">
              Editable Remittance Details
            </div>
            <h2 className="text-xl font-bold text-slate-950">
              Step 3 • Remittance Details for 1604-C
            </h2>
            <p className="text-sm text-slate-600">
              Add payment details and adjustments here. These values flow into the saved 1601-C worksheet and 1604-C summary.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Date Remitted</span>
              <input
                type="date"
                value={dateRemitted}
                onChange={(event) => setDateRemitted(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Drawee Bank / Bank Code / Agency</span>
              <input
                value={draweeBank}
                onChange={(event) => setDraweeBank(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder="Bank / agency"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">TRA/eROR/eAR Number</span>
              <input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder="Reference number"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Manual Adjustment</span>
              <input
                value={adjustmentAmount}
                onChange={(event) => setAdjustmentAmount(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder="0.00"
              />
            </label>

            <div className="rounded-[20px] border border-indigo-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Prior-Year Overremittance Credit from 1604-C</p>
              <p className="mt-2 text-[22px] font-black leading-tight text-indigo-700">{peso(priorYearOverremittanceCreditFrom1604C)}</p>
              <p className="mt-1 text-xs font-semibold text-indigo-800">Applied only when the selected month matches the 1604-C month of first crediting</p>
            </div>

            {selectableAnnualizationFiles.length > 0 ? (
              <div className="rounded-[20px] border border-blue-200 bg-blue-50 p-4 shadow-sm lg:col-span-2">
                <label className="flex items-start gap-3 text-sm font-black text-blue-950">
                  <input
                    type="checkbox"
                    checked={applyAnnualizationAdjustment}
                    onChange={(event) => setApplyAnnualizationAdjustment(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Apply Year-End Tax Annualization to this 1601-C
                    <span className="mt-1 block text-xs font-semibold leading-5 text-blue-800">
                      Overpayment/refund reduces remittance. Underpayment/additional tax increases remittance. Available after the annualization year, normally January of the following year.
                    </span>
                  </span>
                </label>

                <label className="mt-3 grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-blue-700">Annualization File</span>
                  <select
                    value={selectedAnnualizationFileId}
                    onChange={(event) => setSelectedAnnualizationFileId(event.target.value)}
                    disabled={!applyAnnualizationAdjustment}
                    className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  >
                    {selectableAnnualizationFiles.map((file) => {
                      const amount = getYearEndAnnualizationApplicationAmount(file);
                      const label = amount < 0 ? "Overpayment / Refund" : amount > 0 ? "Underpayment / Additional Tax" : "No Adjustment";

                      return (
                        <option key={file.id} value={file.id}>
                          {file.year} Year-End Annualization • {label} • {plainAmount(Math.abs(amount))}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div className={`mt-3 rounded-2xl border bg-white p-3 text-sm font-black ${yearEndAnnualizationAdjustmentFor1601C < 0 ? "border-emerald-200 text-emerald-700" : yearEndAnnualizationAdjustmentFor1601C > 0 ? "border-red-200 text-red-700" : "border-slate-200 text-slate-600"}`}>
                  Applied to Item 26: {peso(yearEndAnnualizationAdjustmentFor1601C)}
                </div>
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Penalties</span>
              <input
                value={penaltiesAmount}
                onChange={(event) => setPenaltiesAmount(event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder="0.00"
              />
            </label>

            <div className="rounded-[20px] border border-blue-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Total Amount Remitted</p>
              <p className="mt-2 text-[22px] font-black leading-tight text-blue-700">{peso(totalAmountRemitted)}</p>
              <p className="mt-1 text-xs font-semibold text-blue-800">Item 27 + penalties</p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-purple-200 border-l-8 border-l-purple-600 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-purple-100 bg-purple-50/40 -m-6 mb-0 rounded-t-[32px] p-6 pb-5">
            <div className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700 shadow-sm">
              Saved / View-Only Files
            </div>
            <h2 className="text-xl font-bold text-slate-950">
              Step 4 • Saved 1601-C Files
            </h2>
            <p className="text-sm text-slate-600">
              Saved monthly worksheets are ready for viewing, Excel download, and automatic 1604-C reporting.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSaved1601CView("Active")}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${saved1601CView === "Active" ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Active Files
            </button>
            <button
              type="button"
              onClick={() => switchSaved1601CView("Archived")}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${saved1601CView === "Archived" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Archive Tab
            </button>
          </div>
          {saved1601CReports.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              {saved1601CView === "Archived"
                ? "No archived 1601-C files yet. Archived worksheets will appear here for audit trail."
                : "No saved 1601-C files yet. Select a month, complete the remittance details, then click Save for 1604-C."}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {saved1601CReports.map((report) => {
                const reportAuditId = report.id || report.month;
                const auditEntries = saved1601CAuditEntries[reportAuditId] ?? [];
                return (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-slate-950">{report.monthLabel}</p>
                      <p className="text-sm text-slate-600">
                        Taxes withheld: {peso(report.taxesWithheld)} • Total remitted: {peso(report.totalAmountRemitted)} • Saved {new Date(report.savedAt).toLocaleString("en-PH")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setViewedSavedReport(report);
                          setTimeout(() => {
                            document.getElementById("saved-1601c-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 50);
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          logAudit({ action: "EXPORTED", entityType: "Report_1601C", entityId: reportAuditId, entityName: `1601-C ${report.monthLabel}`, details: "Excel export (saved file)" });
                          download1601CExcelReport(report);
                        }}
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                      >
                        Download Excel
                      </button>
                      {saved1601CView === "Active" ? (
                        <button
                          onClick={() => archiveSaved1601CReport(report)}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => restoreSaved1601CReport(report)}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                  {auditEntries.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audit Trail</p>
                      <ol className="flex flex-col gap-1.5">
                        {auditEntries.map((e: AuditEntry) => (
                          <li key={e.id} className="flex items-start gap-2 text-xs">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                            <span className="font-semibold text-slate-700">{auditActionLabel(e.action)}</span>
                            {e.details && <span className="text-slate-500">· {e.details}</span>}
                            <span className="text-slate-400">{formatAuditTimestamp(e.timestamp)} · {e.performedBy}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {viewedSavedReport && (
            <div id="saved-1601c-view" className="mt-5 rounded-[24px] border border-purple-300 border-l-8 border-l-purple-700 bg-white p-5 shadow-sm ring-4 ring-purple-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
                    View Mode Only
                  </div>
                  <h3 className="text-lg font-black text-purple-950">
                    Viewing {viewedSavedReport.monthLabel}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-purple-800">
                    Coverage: {viewedSavedReport.coveragePeriod} • This section is read-only and does not edit the generated worksheet above.
                  </p>
                </div>
                <button
                  onClick={() => setViewedSavedReport(null)}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                >
                  Close View
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Date Remitted", value: viewedSavedReport.dateRemitted || "Not set" },
                  { label: "Bank / Agency", value: viewedSavedReport.draweeBank || "Not set" },
                  { label: "Reference Number", value: viewedSavedReport.referenceNumber || "Not set" },
                  { label: "Manual Adjustment", value: peso(viewedSavedReport.manualAdjustment || 0) },
                  { label: "Prior-Year Credit / YTA Adjustment", value: peso(viewedSavedReport.yearEndTaxAdjustment || 0) },
                  { label: "Total Amount Remitted", value: peso(viewedSavedReport.totalAmountRemitted) },
                ].map((card) => (
                  <div key={card.label} className="rounded-[18px] border border-purple-100 bg-purple-50/40 p-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                      {card.label}
                    </p>
                    <p className="mt-2 text-sm font-black text-slate-950">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Saved Computation Table */}
              <div className="mt-5 overflow-hidden rounded-[24px] border border-purple-200 bg-white shadow-sm">
                <div className="border-b border-purple-100 bg-purple-50/60 px-5 py-4">
                  <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700 shadow-sm">
                    Saved Snapshot
                  </div>
                  <h4 className="text-base font-black text-slate-950">Saved Computation of Tax</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    View-only snapshot based on the values saved for this 1601-C worksheet.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="w-24 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-600">Item</th>
                        <th className="px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-600">Description</th>
                        <th className="w-52 px-5 py-3 text-right text-xs font-black uppercase tracking-wide text-slate-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewedSavedReport.rows.map((row) => (
                        <tr key={`${viewedSavedReport.id}-${row.item}`} className="border-t border-slate-200">
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-700 text-xs font-black text-white">
                              {row.item}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <p className="font-bold text-slate-900">{row.label}</p>
                            {row.formula ? (
                              <p className="mt-1 text-sm leading-6 text-slate-500">{row.formula}</p>
                            ) : null}
                          </td>
                          <td className="px-5 py-4 text-right align-top">
                            <p className="text-base font-black text-slate-950">{plainAmount(row.amount)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
