
"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems } from "@/lib/firestore";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit, getAuditsByEntity, formatAuditTimestamp, auditActionLabel, type AuditEntry } from "@/lib/auditTrail";

type Employee = {
  employeeNo: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  nationalityOrResident?: string;
  citizenship?: string;
  nationality?: string;
  expectedRegularizationDate?: string;
  regularizationDate?: string;
  employmentClassification?: string;
  isMinimumWageEarner?: string;
  regionAssigned?: string;
  department?: string;
  employmentStatus?: string;
  hireDate?: string;
  separationDate?: string;
  reasonForLeaving?: string;
  tin?: string;
  basicPay?: number;
  hourlyRate?: number;
  archived?: boolean;
  expectedSeparationDate?: string;
  archivedAt?: string;
  archiveReason?: string;
  archiveStatus?: string;
};

type PayrollRecord = {
  id?: string;
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  month?: string;
  year?: string | number;
  monthYear?: string;
  payrollDate?: string;
  actualPayrollDate?: string;
  payrollPeriod?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  createdAt?: string;
  basicPay?: number;
  grossPay?: number;
  totalPayrollPremium?: number;
  totalAllowances?: number;
  taxableIncome?: number;
  taxableCompensation?: number;
  totalDeductions?: number;
  withholdingTax?: number;
  taxWithheld?: number;
  compensationTaxWithheld?: number;
  sssEe?: number;
  philhealthEe?: number;
  pagibigEe?: number;
  sssRegularEe?: number;
  sssWispEe?: number;
  thirteenthMonthPay?: number;
  christmasBonus?: number;
  riceSubsidy?: number;
  uniformClothing?: number;
  laundryAllowance?: number;
  medicalCashDependents?: number;
  actualMedicalAssistance?: number;
  achievementAwards?: number;
  christmasAnniversaryGifts?: number;
  monetizedLeavePrivate?: number;
  cbaProductivityIncentives?: number;
  mealAllowanceOTNight?: number;
  otherTaxableAllowances?: number;
  overtimeAmount?: number;
  nightDifferentialAmount?: number;
  holidayPayAmount?: number;
  specialHolidayAmount?: number;
  hazardPayAmount?: number;
  taxAnnualizationAdjustment?: number;
  yearEndTaxAdjustment?: number;
  annualizationTaxAdjustment?: number;
  annualizedTaxAdjustment?: number;
  finalTaxAdjustment?: number;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment" | string;
  status?: string;
  approvalStatus?: string;
  payrollStatus?: string;
  reviewStatus?: string;
  runStatus?: string;
  workflowStatus?: string;
  approvalState?: string;
  archived?: boolean;
  deleted?: boolean;
  archiveStatus?: "Active" | "Archived";
};

type AlphalistSummary = {
  totalEmployees: number;
  schedule1Employees: number;
  schedule2Mwes: number;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  taxWithheld: number;
  overwithheldRefunded: number;
  finalTaxWithheld: number;
};

type Schedule1Row = {
  sequenceNo: number;
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  nationalityOrResident: string;
  employmentStatus: string;
  fromDate: string;
  toDate: string;
  reasonOfSeparation: string;

  presentGrossCompensation: number;
  presentNonTaxable13thMonth: number;
  presentDeMinimis: number;
  presentEmployeeContributions: number;
  presentSalariesBelow250kAndOtherComp: number;
  presentTotalNonTaxable: number;
  presentTaxableBasicSalary: number;
  presentTaxable13thMonthExcess: number;
  presentTaxableOtherCompensation: number;
  presentTotalTaxable: number;

  previousEmployerTin: string;
  previousEmploymentStatus: string;
  previousFromDate: string;
  previousToDate: string;
  previousReasonOfSeparation: string;
  previousGrossCompensation: number;
  previousNonTaxable13thMonth: number;
  previousDeMinimis: number;
  previousEmployeeContributions: number;
  previousSalariesBelow250kAndOtherComp: number;
  previousTotalNonTaxable: number;
  previousTaxableBasicSalary: number;
  previousTaxable13thMonth: number;
  previousTaxableOtherCompensation: number;
  previousTotalTaxable: number;

  totalTaxableCompensation: number;
  taxDue: number;
  taxWithheldPreviousEmployer: number;
  taxWithheldPresentEmployerJanToNov: number;
  peraTaxCredit: number;
  amountWithheldPaidDecemberOrLastSalary: number;
  overwithheldTaxRefunded: number;
  amountOfTaxWithheldAsAdjusted: number;
  substitutedFiling: string;
  sourceRecords?: PayrollRecord[];
};

type Schedule2Row = {
  sequenceNo: number;
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  employmentStatus: string;
  regionAssigned: string;
  fromDate: string;
  toDate: string;
  reasonOfSeparation: string;

  presentGrossCompensation: number;
  basicSmwPerDay: number;
  basicSmwPerMonth: number;
  basicSmwPerYear: number;
  factorUsed: number;
  presentBasicSmwActual: number;
  presentHolidayPay: number;
  presentOvertimePay: number;
  presentNightShiftDifferential: number;
  presentHazardPay: number;
  present13thMonthAndOtherBenefits: number;
  presentDeMinimis: number;
  presentEmployeeContributions: number;
  presentSalariesAndOtherForms: number;
  presentTotalNonTaxable: number;
  presentTaxable13thMonthExcess: number;
  presentTaxableSalariesAndOtherForms: number;
  presentTotalTaxable: number;

  previousEmployerTin: string;
  previousEmploymentStatus: string;
  previousFromDate: string;
  previousToDate: string;
  previousReasonOfSeparation: string;
  previousGrossCompensation: number;
  previousBasicSmwActual: number;
  previousHolidayPay: number;
  previousOvertimePay: number;
  previousNightShiftDifferential: number;
  previousHazardPay: number;
  previous13thMonthAndOtherBenefits: number;
  previousDeMinimis: number;
  previousEmployeeContributions: number;
  previousSalariesAndOtherForms: number;
  previousTotalNonTaxable: number;
  previousTaxable13thMonth: number;
  previousTaxableSalariesAndOtherForms: number;
  previousTotalTaxable: number;

  totalTaxableCompensation: number;
  taxDue: number;
  taxWithheldPreviousEmployer: number;
  taxWithheldPresentEmployerJanToNov: number;
  peraTaxCredit: number;
  amountWithheldPaidDecemberOrLastSalary: number;
  overwithheldTaxRefunded: number;
  amountOfTaxWithheldAsAdjusted: number;
  substitutedFiling: string;
  sourceRecords?: PayrollRecord[];
};

type ValidationIssue = {
  severity: "Error" | "Warning";
  schedule: "Schedule 1" | "Schedule 2";
  employeeNo: string;
  employeeName: string;
  issue: string;
};

type SavedAlphalistReport = {
  id: string;
  year: string;
  fileName: string;
  revisionNumber: string;
  summary: AlphalistSummary;
  schedule1Rows: Schedule1Row[];
  schedule2Rows: Schedule2Row[];
  validationIssues: ValidationIssue[];
  savedAt: string;
};

type DrilldownAmount = {
  label: string;
  amount: number;
};

type DrilldownRecord = {
  id: string;
  label: string;
  employeeName: string;
  payrollDate: string;
  amounts: DrilldownAmount[];
  total: number;
};

type ActiveDrilldown = {
  title: string;
  fieldName: string;
  records: DrilldownRecord[];
  total: number;
};


const MONTH_ORDER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DEFAULT_MWE_REGION_ASSIGNED = "Region VIII";

function getReadableAccentTextColor(accentColor: string, preferredTextColor: string) {
  const hex = accentColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return preferredTextColor || "#0f172a";
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.58 ? "#0f172a" : preferredTextColor || "#ffffff";
}

function money(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseInputMoney(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAmountInputValue(value: string | number, type: "text" | "number"): string {
  if (type !== "number") return String(value ?? "");
  const numericValue = money(value);
  return numericValue.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeText(value: unknown): string {
  return String(value || "").toLowerCase().trim();
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

function isApprovedPayrollRecord(record: PayrollRecord): boolean {
  const statuses = [
    record.status,
    record.approvalStatus,
    record.payrollStatus,
    record.reviewStatus,
    record.runStatus,
    record.workflowStatus,
    record.approvalState,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return statuses.some((status) => status === "approved");
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
  const payrollPeriod = String(record.payrollPeriod || "Monthly Payroll").trim();
  const year = String(record.year || getRecordYear(record) || "").trim();
  const month = String(record.month || "").trim();

  return `${year}-${month}-${payrollPeriod}`;
}

function getApprovedPayrollRunRecordIds(records: PayrollRecord[], payrollRunApprovals: Record<string, { status?: string }> = {}) {

  const groupedRecords = new Map<string, PayrollRecord[]>();

  records.forEach((record) => {
    const groupKey = getPayrollRunGroupKey(record);
    const currentGroup = groupedRecords.get(groupKey) || [];
    currentGroup.push(record);
    groupedRecords.set(groupKey, currentGroup);
  });

  const approvedRecordIds = new Set<string>();

  groupedRecords.forEach((groupRecords, groupKey) => {
    const runId = buildPayrollRunIdentity(groupKey, groupRecords);
    const approvalStatus = normalizeText(payrollRunApprovals?.[runId]?.status);
    const hasRecordLevelApproval = groupRecords.some((record) => isApprovedPayrollRecord(record));

    if (approvalStatus === "approved" || hasRecordLevelApproval) {
      groupRecords.forEach((record) => {
        if (record.id) approvedRecordIds.add(record.id);
      });
    }
  });

  return approvedRecordIds;
}

function getEmployeeName(row: { lastName: string; firstName: string; middleName: string }): string {
  return [row.lastName, row.firstName, row.middleName].filter(Boolean).join(", ") || "Unnamed employee";
}

function formatDateMmDd(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function getAlphalistFromDate(employee: Employee, taxYear: string): string {
  const year = Number(taxYear);
  const yearStart = new Date(year, 0, 1);
  const hireDate = employee.hireDate ? new Date(employee.hireDate) : null;

  if (!hireDate || Number.isNaN(hireDate.getTime())) return "01/01";
  if (hireDate < yearStart) return "01/01";
  return formatDateMmDd(employee.hireDate);
}

function getAlphalistToDate(employee: Employee, taxYear: string): string {
  const year = Number(taxYear);
  const yearEnd = new Date(year, 11, 31);
  const separationValue = employee.separationDate || employee.expectedSeparationDate || "";
  const separationDate = separationValue ? new Date(separationValue) : null;

  if (separationDate && !Number.isNaN(separationDate.getTime()) && separationDate <= yearEnd) {
    return formatDateMmDd(separationValue);
  }

  return "12/31";
}

function getAlphalistReasonOfSeparation(employee: Employee): string {
  const separationValue = employee.separationDate || employee.expectedSeparationDate || "";
  if (!separationValue && employee.archived !== true) return "";

  const archiveStatus = normalizeText(employee.archiveStatus);
  const archiveReason = normalizeText(employee.archiveReason);
  const reasonForLeaving = normalizeText(employee.reasonForLeaving);
  const combinedReason = [archiveStatus, archiveReason, reasonForLeaving].join(" ");

  if (combinedReason.includes("transfer")) return "TR";
  if (combinedReason.includes("retire")) return "R";
  if (combinedReason.includes("death") || combinedReason.includes("deceased")) return "D";
  if (
    combinedReason.includes("terminated") ||
    combinedReason.includes("resigned") ||
    combinedReason.includes("resign") ||
    employee.archived === true
  ) {
    return "T";
  }

  return getReasonCode(employee.reasonForLeaving);
}

function getEmployeeKey(employee: Employee): string {
  return normalizeText(employee.employeeNo);
}

function getEmployeeKeyFromRecord(record: PayrollRecord): string {
  return normalizeText(record.employeeNo || record.employeeId || record.employeeName);
}

function isMweEmployee(employee: Employee): boolean {
  const value = normalizeText(employee.isMinimumWageEarner || employee.employmentClassification);
  return value === "yes" || value.includes("minimum wage") || value === "mwe";
}

function getStatusCodeFromText(value?: string): string {
  const rawStatus = String(value || "").trim();
  const upperStatus = rawStatus.toUpperCase();

  if (["R", "C", "CP", "S", "P", "AL"].includes(upperStatus)) {
    return upperStatus;
  }

  const status = normalizeText(value);
  if (status.includes("regular")) return "R";
  if (status.includes("casual")) return "C";
  if (status.includes("contract") || status.includes("project")) return "CP";
  if (status.includes("season")) return "S";
  if (status.includes("probation")) return "P";
  if (status.includes("apprentice") || status.includes("learner")) return "AL";
  return "";
}

function getBIREmploymentStatus(employee: Employee): string {
  const explicitStatus = getStatusCodeFromText(employee.employmentStatus);

  if (explicitStatus) {
    return explicitStatus;
  }

  const hasRegularizationDate = Boolean(employee.regularizationDate && employee.regularizationDate.trim());

  if (!hasRegularizationDate) {
    return "P";
  }

  const today = new Date();
  const regularizationDate = new Date(employee.regularizationDate || "");

  if (!Number.isNaN(regularizationDate.getTime()) && regularizationDate > today) {
    return "P";
  }

  return "R";
}

function getNationalityOrResident(employee: Employee): string {
  const explicitValue = employee.nationalityOrResident || employee.nationality || employee.citizenship || "";
  if (explicitValue) return explicitValue;
  return "Resident";
}

function getReasonCode(value?: string): string {
  const reason = normalizeText(value);
  if (!reason) return "";
  if (reason.includes("transfer")) return "TR";
  if (reason.includes("retire")) return "R";
  if (reason.includes("death")) return "D";
  if (reason.includes("terminated") || reason.includes("resigned") || reason.includes("resign")) return "T";
  return value || "";
}

// Helper: isJanuaryFirstStart (for .fromDate fields)
function isJanuaryFirstStart(value?: string): boolean {
  return String(value || "").trim() === "01/01";
}

// Helper: isPreviousEmployerField (for Schedule 1 and 2)
function isPreviousEmployerField(field: string): boolean {
  return field.startsWith("previous") || field === "taxWithheldPreviousEmployer";
}

function getRecordYear(record: PayrollRecord): string {
  const explicitPayrollYear = String(record.year || "").trim();
  if (/^20\d{2}$/.test(explicitPayrollYear)) return explicitPayrollYear;

  const monthYearText = String(record.monthYear || "").trim();
  const monthYearMatch = monthYearText.match(/20\d{2}/);
  if (monthYearMatch) return monthYearMatch[0];

  const periodText = String(
    record.payrollPeriod ||
      record.payrollReference ||
      record.payrollRun ||
      record.payrollRunId ||
      ""
  ).trim();
  const periodYearMatch = periodText.match(/20\d{2}/);
  if (periodYearMatch) return periodYearMatch[0];

  const actualPayrollDate = String(record.actualPayrollDate || record.payrollDate || "").trim();
  const dateMatch = actualPayrollDate.match(/20\d{2}/);
  if (dateMatch) return dateMatch[0];

  return "";
}

function getRecordMonthNumber(record: PayrollRecord): number {
  const monthText = normalizeText(record.month);
  if (MONTH_ORDER[monthText]) return MONTH_ORDER[monthText];

  const monthYearText = String(record.monthYear || "").trim();
  const monthNameFromMonthYear = normalizeText(monthYearText.replace(/20\d{2}/g, "").trim());
  if (MONTH_ORDER[monthNameFromMonthYear]) return MONTH_ORDER[monthNameFromMonthYear];

  const periodText = normalizeText(
    String(record.payrollPeriod || record.payrollReference || record.payrollRun || record.payrollRunId || "")
  );
  const monthFromPeriod = Object.entries(MONTH_ORDER).find(([monthName]) => periodText.includes(monthName));
  if (monthFromPeriod) return monthFromPeriod[1];

  const dateValue = record.actualPayrollDate || record.payrollDate || "";
  const parsed = new Date(dateValue);
  if (!Number.isNaN(parsed.getTime())) return parsed.getMonth() + 1;

  const match = String(dateValue).match(/-(\d{2})-/) || String(dateValue).match(/-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

function isPayrollRecordInTaxYear(record: PayrollRecord, taxYear: string): boolean {
  if (!taxYear) return false;

  const recordYear = getRecordYear(record);
  if (recordYear !== taxYear) return false;

  const monthNumber = getRecordMonthNumber(record);
  return monthNumber >= 1 && monthNumber <= 12;
}

function getTaxWithheld(record: PayrollRecord): number {
  return money(record.withholdingTax) || money(record.taxWithheld) || money(record.compensationTaxWithheld);
}

function getEmployeeContributions(record: PayrollRecord): number {
  const explicit =
    money(record.sssEe) +
    money(record.sssRegularEe) +
    money(record.sssWispEe) +
    money(record.philhealthEe) +
    money(record.pagibigEe);

  if (explicit > 0) return explicit;
  return Math.max(0, money(record.totalDeductions) - getTaxWithheld(record));
}

function getBonusBenefits(record: PayrollRecord): number {
  return money(record.thirteenthMonthPay) + money(record.christmasBonus);
}

type DeMinimisBreakdown = {
  exempt: number;
  excess: number;
};

function splitByLimit(amount: number, annualLimit: number): DeMinimisBreakdown {
  const safeAmount = Math.max(0, money(amount));
  const safeLimit = Math.max(0, money(annualLimit));

  return {
    exempt: Math.min(safeAmount, safeLimit),
    excess: Math.max(0, safeAmount - safeLimit),
  };
}

function addBreakdown(current: DeMinimisBreakdown, next: DeMinimisBreakdown): DeMinimisBreakdown {
  return {
    exempt: current.exempt + next.exempt,
    excess: current.excess + next.excess,
  };
}

function getDeMinimisBreakdown(records: PayrollRecord[]): DeMinimisBreakdown {
  let breakdown: DeMinimisBreakdown = { exempt: 0, excess: 0 };

  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "riceSubsidy"), 24000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "uniformClothing"), 6000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "laundryAllowance"), 3600));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "medicalCashDependents"), 3000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "actualMedicalAssistance"), 10000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "achievementAwards"), 10000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "christmasAnniversaryGifts"), 5000));
  breakdown = addBreakdown(breakdown, splitByLimit(recordTotal(records, "cbaProductivityIncentives"), 10000));

  breakdown.exempt += recordTotal(records, "monetizedLeavePrivate");
  breakdown.exempt += recordTotal(records, "mealAllowanceOTNight");

  return breakdown;
}

function getDeMinimisBenefits(record: PayrollRecord): number {
  return getDeMinimisBreakdown([record]).exempt;
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

function getTaxableCompensation(record: PayrollRecord): number {
  return money(record.taxableIncome) || money(record.taxableCompensation);
}

function getTaxYearOptions(records: PayrollRecord[]): string[] {
  const years = new Set<string>();
  records.forEach((record) => {
    const year = getRecordYear(record);
    const monthNumber = getRecordMonthNumber(record);
    if (year && monthNumber >= 1 && monthNumber <= 12) years.add(year);
  });
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function getDefaultFileName(year: string, revisionNumber?: string): string {
  if (!year) return "Alphalist of Employees";
  return `Alphalist Tax Year ${year}${revisionNumber ? ` - ${revisionNumber}` : " - Original"}`;
}

function safeFileName(value: string): string {
  return value.replace(/[^a-z0-9-_ ]/gi, "_").trim() || "Alphalist";
}

function createEmptySummary(): AlphalistSummary {
  return {
    totalEmployees: 0,
    schedule1Employees: 0,
    schedule2Mwes: 0,
    grossCompensation: 0,
    nonTaxableCompensation: 0,
    taxableCompensation: 0,
    taxWithheld: 0,
    overwithheldRefunded: 0,
    finalTaxWithheld: 0,
  };
}

function computeAnnualTaxDue(totalTaxableCompensation: number): number {
  const taxableIncome = Math.max(0, money(totalTaxableCompensation));

  if (taxableIncome <= 250000) return 0;
  if (taxableIncome <= 400000) return (taxableIncome - 250000) * 0.15;
  if (taxableIncome <= 800000) return 22500 + (taxableIncome - 400000) * 0.2;
  if (taxableIncome <= 2000000) return 102500 + (taxableIncome - 800000) * 0.25;
  if (taxableIncome <= 8000000) return 402500 + (taxableIncome - 2000000) * 0.3;
  return 2202500 + (taxableIncome - 8000000) * 0.35;
}

function recordTotal(records: PayrollRecord[], key: keyof PayrollRecord): number {
  return records.reduce((sum, record) => sum + money(record[key]), 0);
}

// Drilldown helper functions (Edit 1 of 2)
function getPayrollCutoffLabel(record: PayrollRecord): string {
  const year = getRecordYear(record);
  const month = String(record.month || "").trim();
  const period = String(record.payrollPeriod || record.payrollReference || record.payrollRun || "").trim();

  return [month, year, period].filter(Boolean).join(" • ") || record.payrollReference || record.id || "Payroll cutoff";
}

function getPayrollCutoffDate(record: PayrollRecord): string {
  return String(record.actualPayrollDate || record.payrollDate || record.createdAt || "").trim() || "Not set";
}

function makeDrilldownRecord(record: PayrollRecord, amounts: DrilldownAmount[]): DrilldownRecord {
  return {
    id: String(record.id || `${getPayrollCutoffLabel(record)}-${getPayrollCutoffDate(record)}`),
    label: getPayrollCutoffLabel(record),
    employeeName: String(record.employeeName || record.employeeNo || record.employeeId || "Employee"),
    payrollDate: getPayrollCutoffDate(record),
    amounts,
    total: amounts.reduce((sum, item) => sum + money(item.amount), 0),
  };
}

function getRecordDeMinimisAmount(record: PayrollRecord): number {
  return getDeMinimisBreakdown([record]).exempt;
}

function getRecordDeMinimisExcess(record: PayrollRecord): number {
  return getDeMinimisBreakdown([record]).excess;
}

function getRecordPremiumAmount(record: PayrollRecord): number {
  const detailedPremiums =
    money(record.overtimeAmount) +
    money(record.nightDifferentialAmount) +
    money(record.holidayPayAmount) +
    money(record.specialHolidayAmount) +
    money(record.hazardPayAmount);

  return detailedPremiums > 0 ? detailedPremiums : money(record.totalPayrollPremium);
}

function getRecordDetailedAllowanceAmount(record: PayrollRecord): number {
  return (
    money(record.riceSubsidy) +
    money(record.uniformClothing) +
    money(record.laundryAllowance) +
    money(record.medicalCashDependents) +
    money(record.actualMedicalAssistance) +
    money(record.achievementAwards) +
    money(record.christmasAnniversaryGifts) +
    money(record.monetizedLeavePrivate) +
    money(record.cbaProductivityIncentives) +
    money(record.mealAllowanceOTNight) +
    money(record.thirteenthMonthPay) +
    money(record.christmasBonus) +
    money(record.otherTaxableAllowances)
  );
}

function getRecordUnclassifiedAllowanceRemainder(record: PayrollRecord): number {
  return Math.max(0, money(record.totalAllowances) - getRecordDetailedAllowanceAmount(record));
}

function getSchedule1DrilldownAmounts(record: PayrollRecord, fieldName: string): DrilldownAmount[] {
  const employeeContributions = getEmployeeContributions(record);
  const basicPay = money(record.basicPay);
  const bonusBenefits = getBonusBenefits(record);
  const deMinimisExempt = getRecordDeMinimisAmount(record);
  const deMinimisExcess = getRecordDeMinimisExcess(record);
  const premiumAmount = getRecordPremiumAmount(record);
  const unclassifiedAllowances = getRecordUnclassifiedAllowanceRemainder(record);
  const taxableOther = money(record.otherTaxableAllowances) + unclassifiedAllowances + premiumAmount;
  const taxableBasic = Math.max(0, basicPay - employeeContributions);

  switch (fieldName) {
    case "presentGrossCompensation":
      return [
        { label: "Basic pay", amount: basicPay },
        { label: "Premiums", amount: premiumAmount },
        { label: "Total allowances", amount: money(record.totalAllowances) },
      ];
    case "presentNonTaxable13thMonth":
      return [{ label: "13th month / bonus benefits", amount: bonusBenefits }];
    case "presentDeMinimis":
      return [{ label: "De minimis benefits", amount: deMinimisExempt }];
    case "presentEmployeeContributions":
      return [{ label: "Employee contributions", amount: employeeContributions }];
    case "presentSalariesBelow250kAndOtherComp":
      return [{ label: "Salaries P250,000 and below / other compensation", amount: 0 }];
    case "presentTotalNonTaxable":
      return [
        { label: "13th month / benefits within threshold", amount: bonusBenefits + deMinimisExcess },
        { label: "De minimis exempt", amount: deMinimisExempt },
        { label: "Employee contributions", amount: employeeContributions },
      ];
    case "presentTaxableBasicSalary":
      return [{ label: "Basic salary net of employee contributions", amount: taxableBasic }];
    case "presentTaxable13thMonthExcess":
      return [{ label: "13th month / benefits excess", amount: Math.max(0, bonusBenefits + deMinimisExcess - 90000) }];
    case "presentTaxableOtherCompensation":
      return [{ label: "Taxable allowances and premiums", amount: taxableOther }];
    case "presentTotalTaxable":
      return [
        { label: "Taxable basic salary", amount: taxableBasic },
        { label: "Taxable allowances and premiums", amount: taxableOther },
      ];
    case "taxWithheldPresentEmployerJanToNov":
    case "amountOfTaxWithheldAsAdjusted":
      return [{ label: "Tax withheld", amount: getTaxWithheld(record) }];
    default:
      return [{ label: fieldName, amount: 0 }];
  }
}

function getSchedule2DrilldownAmounts(record: PayrollRecord, fieldName: string): DrilldownAmount[] {
  switch (fieldName) {
    case "presentBasicSmwActual":
      return [{ label: "Basic/SMW actual net of contributions", amount: Math.max(0, money(record.basicPay) - getEmployeeContributions(record)) }];
    case "presentHolidayPay":
      return [{ label: "Holiday pay", amount: money(record.holidayPayAmount) + money(record.specialHolidayAmount) }];
    case "presentOvertimePay":
      return [{ label: "Overtime pay", amount: money(record.overtimeAmount) }];
    case "presentNightShiftDifferential":
      return [{ label: "Night shift differential", amount: money(record.nightDifferentialAmount) }];
    case "presentHazardPay":
      return [{ label: "Hazard pay", amount: money(record.hazardPayAmount) }];
    case "present13thMonthAndOtherBenefits":
      return [{ label: "13th month / benefits", amount: getBonusBenefits(record) }];
    case "presentDeMinimis":
      return [{ label: "De minimis benefits", amount: getRecordDeMinimisAmount(record) }];
    case "presentEmployeeContributions":
      return [{ label: "Employee contributions", amount: getEmployeeContributions(record) }];
    case "presentSalariesAndOtherForms":
      return [{ label: "Salaries and other forms", amount: money(record.otherTaxableAllowances) + getRecordUnclassifiedAllowanceRemainder(record) }];
    default:
      return getSchedule1DrilldownAmounts(record, fieldName);
  }
}


function canDrilldownField(fieldName: string, type: "text" | "number"): boolean {
  if (type !== "number") return false;
  if (fieldName.startsWith("previous")) return false;
  if (["sequenceNo", "basicSmwPerDay", "basicSmwPerMonth", "basicSmwPerYear", "factorUsed"].includes(fieldName)) return false;
  return true;
}

// Drilldown helpers: getRowAmountValue and scaling
function getRowAmountValue(row: Schedule1Row | Schedule2Row, fieldName: string): number {
  return money(row[fieldName as keyof typeof row]);
}

function scaleDrilldownRecordsToTarget(records: DrilldownRecord[], targetTotal: number): DrilldownRecord[] {
  const safeTarget = money(targetTotal);
  const currentTotal = records.reduce((sum, record) => sum + money(record.total), 0);

  if (Math.abs(safeTarget) < 0.01 || Math.abs(currentTotal) < 0.01) {
    return records.map((record) => ({
      ...record,
      amounts: record.amounts.map((amount) => ({ ...amount, amount: 0 })),
      total: 0,
    }));
  }

  const factor = safeTarget / currentTotal;
  let runningTotal = 0;

  return records.map((record, index) => {
    const isLast = index === records.length - 1;
    const scaledAmounts = record.amounts.map((amount) => ({
      ...amount,
      amount: money(amount.amount) * factor,
    }));
    const scaledTotal = isLast
      ? safeTarget - runningTotal
      : scaledAmounts.reduce((sum, amount) => sum + money(amount.amount), 0);

    runningTotal += scaledTotal;

    return {
      ...record,
      amounts: scaledAmounts,
      total: scaledTotal,
    };
  });
}

function getDetailedPremiums(records: PayrollRecord[]): number {
  return (
    recordTotal(records, "overtimeAmount") +
    recordTotal(records, "nightDifferentialAmount") +
    recordTotal(records, "holidayPayAmount") +
    recordTotal(records, "specialHolidayAmount") +
    recordTotal(records, "hazardPayAmount")
  );
}

function getPremiumsForAlphalist(records: PayrollRecord[]): number {
  const detailedPremiums = getDetailedPremiums(records);
  const payrollPremiums = recordTotal(records, "totalPayrollPremium");

  return detailedPremiums > 0 ? detailedPremiums : payrollPremiums;
}

function getRawAllowanceTotal(records: PayrollRecord[]): number {
  return recordTotal(records, "totalAllowances");
}

function getDetailedAllowanceTotal(records: PayrollRecord[]): number {
  return (
    recordTotal(records, "riceSubsidy") +
    recordTotal(records, "uniformClothing") +
    recordTotal(records, "laundryAllowance") +
    recordTotal(records, "medicalCashDependents") +
    recordTotal(records, "actualMedicalAssistance") +
    recordTotal(records, "achievementAwards") +
    recordTotal(records, "christmasAnniversaryGifts") +
    recordTotal(records, "monetizedLeavePrivate") +
    recordTotal(records, "cbaProductivityIncentives") +
    recordTotal(records, "mealAllowanceOTNight") +
    recordTotal(records, "thirteenthMonthPay") +
    recordTotal(records, "christmasBonus") +
    recordTotal(records, "otherTaxableAllowances")
  );
}

function getUnclassifiedAllowanceRemainder(records: PayrollRecord[]): number {
  const rawAllowances = getRawAllowanceTotal(records);
  const detailedAllowances = getDetailedAllowanceTotal(records);

  return Math.max(0, rawAllowances - detailedAllowances);
}

function getPresentTaxableOtherCompensation(records: PayrollRecord[]): number {
  const premiumAmount = getPremiumsForAlphalist(records);
  const explicitlyTaxableAllowances = recordTotal(records, "otherTaxableAllowances");
  const unclassifiedAllowanceRemainder = getUnclassifiedAllowanceRemainder(records);

  return Math.max(0, explicitlyTaxableAllowances + unclassifiedAllowanceRemainder + premiumAmount);
}

function makeSchedule1Row(employee: Employee, employeeRecords: PayrollRecord[], sequenceNo: number, taxYear: string): Schedule1Row {
  const totalRawAllowances = getRawAllowanceTotal(employeeRecords);
  const totalBasicPay = employeeRecords.reduce((sum, record) => sum + money(record.basicPay), 0);
  const bonusBenefits = employeeRecords.reduce((sum, record) => sum + getBonusBenefits(record), 0);
  const deMinimisBreakdown = getDeMinimisBreakdown(employeeRecords);
  const otherBenefitsSubjectTo90000 = bonusBenefits + deMinimisBreakdown.excess;
  const presentNonTaxable13thMonth = Math.min(otherBenefitsSubjectTo90000, 90000);
  const presentTaxable13thMonthExcess = Math.max(0, otherBenefitsSubjectTo90000 - 90000);
  const presentDeMinimis = deMinimisBreakdown.exempt;
  const presentEmployeeContributions = employeeRecords.reduce((sum, record) => sum + getEmployeeContributions(record), 0);
  const totalTaxWithheld = employeeRecords.reduce((sum, record) => sum + getTaxWithheld(record), 0);
  const taxWithheldPresentEmployerJanToNov = employeeRecords
    .filter((record) => getRecordMonthNumber(record) >= 1 && getRecordMonthNumber(record) <= 11)
    .reduce((sum, record) => sum + getTaxWithheld(record), 0);
  const decemberTaxWithheld = employeeRecords
    .filter((record) => getRecordMonthNumber(record) === 12)
    .reduce((sum, record) => sum + getTaxWithheld(record), 0);

  // annualizationAdjustment and related logic removed, replaced below

  const presentSalariesBelow250kAndOtherComp = 0;
  const presentTotalNonTaxable =
    presentNonTaxable13thMonth +
    presentDeMinimis +
    presentEmployeeContributions +
    presentSalariesBelow250kAndOtherComp;
  const presentTaxableBasicSalary = Math.max(0, totalBasicPay - presentEmployeeContributions);
  const presentTaxableOtherCompensation = getPresentTaxableOtherCompensation(employeeRecords);
  const presentTotalTaxable =
    presentTaxableBasicSalary + presentTaxable13thMonthExcess + presentTaxableOtherCompensation;
  // BIR Schedule 1 formula: 7A = 7F + 7J.
  // Do not use created/encoded gross pay as an override because it may include records outside the proper BIR classification.
  const presentGrossCompensation = presentTotalNonTaxable + presentTotalTaxable;

  const totalTaxableCompensation = presentTotalTaxable;
  const taxDue = computeAnnualTaxDue(totalTaxableCompensation);
  const totalTaxWithheldBeforeYearEnd = taxWithheldPresentEmployerJanToNov;
  const amountWithheldPaidDecemberOrLastSalary = Math.max(0, taxDue - totalTaxWithheldBeforeYearEnd);
  const overwithheldTaxRefunded = Math.max(0, totalTaxWithheldBeforeYearEnd + decemberTaxWithheld - taxDue);
  const amountOfTaxWithheldAsAdjusted =
    totalTaxWithheldBeforeYearEnd + amountWithheldPaidDecemberOrLastSalary - overwithheldTaxRefunded;

  return {
    sequenceNo,
    employeeNo: employee.employeeNo,
    lastName: employee.lastName || "",
    firstName: employee.firstName || "",
    middleName: employee.middleName || "",
    nationalityOrResident: getNationalityOrResident(employee),
    employmentStatus: getBIREmploymentStatus(employee),
    fromDate: getAlphalistFromDate(employee, taxYear),
    toDate: getAlphalistToDate(employee, taxYear),
    reasonOfSeparation: getAlphalistReasonOfSeparation(employee),
    presentGrossCompensation,
    presentNonTaxable13thMonth,
    presentDeMinimis,
    presentEmployeeContributions,
    presentSalariesBelow250kAndOtherComp,
    presentTotalNonTaxable,
    presentTaxableBasicSalary,
    presentTaxable13thMonthExcess,
    presentTaxableOtherCompensation,
    presentTotalTaxable,
    previousEmployerTin: "",
    previousEmploymentStatus: "",
    previousFromDate: "",
    previousToDate: "",
    previousReasonOfSeparation: "",
    previousGrossCompensation: 0,
    previousNonTaxable13thMonth: 0,
    previousDeMinimis: 0,
    previousEmployeeContributions: 0,
    previousSalariesBelow250kAndOtherComp: 0,
    previousTotalNonTaxable: 0,
    previousTaxableBasicSalary: 0,
    previousTaxable13thMonth: 0,
    previousTaxableOtherCompensation: 0,
    previousTotalTaxable: 0,
    totalTaxableCompensation,
    taxDue,
    taxWithheldPreviousEmployer: 0,
    taxWithheldPresentEmployerJanToNov,
    peraTaxCredit: 0,
    amountWithheldPaidDecemberOrLastSalary,
    overwithheldTaxRefunded,
    amountOfTaxWithheldAsAdjusted,
    substitutedFiling: employee.separationDate ? "No" : "Yes",
    sourceRecords: employeeRecords,
  };
}

function makeSchedule2Row(employee: Employee, employeeRecords: PayrollRecord[], sequenceNo: number, taxYear: string): Schedule2Row {
  const base = makeSchedule1Row(employee, employeeRecords, sequenceNo, taxYear);
  const statutoryMinimumWagePerMonth = money(employee.basicPay);
  const presentHolidayPay = employeeRecords.reduce(
    (sum, record) => sum + money(record.holidayPayAmount) + money(record.specialHolidayAmount),
    0
  );
  const presentOvertimePay = employeeRecords.reduce((sum, record) => sum + money(record.overtimeAmount), 0);
  const presentNightShiftDifferential = employeeRecords.reduce(
    (sum, record) => sum + money(record.nightDifferentialAmount),
    0
  );
  const presentHazardPay = employeeRecords.reduce((sum, record) => sum + money(record.hazardPayAmount), 0);
  const presentBasicSmwActual = Math.max(0, employeeRecords.reduce((sum, record) => sum + money(record.basicPay), 0) - base.presentEmployeeContributions);
  const presentTotalNonTaxable =
    presentBasicSmwActual +
    presentHolidayPay +
    presentOvertimePay +
    presentNightShiftDifferential +
    presentHazardPay +
    base.presentNonTaxable13thMonth +
    base.presentDeMinimis +
    base.presentEmployeeContributions;

  return {
    sequenceNo,
    employeeNo: base.employeeNo,
    lastName: base.lastName,
    firstName: base.firstName,
    middleName: base.middleName,
    employmentStatus: base.employmentStatus,
    regionAssigned: employee.regionAssigned || DEFAULT_MWE_REGION_ASSIGNED,
    fromDate: base.fromDate,
    toDate: base.toDate,
    reasonOfSeparation: base.reasonOfSeparation,
    presentGrossCompensation: base.presentGrossCompensation,
    basicSmwPerDay: statutoryMinimumWagePerMonth ? statutoryMinimumWagePerMonth / 26 : 0,
    basicSmwPerMonth: statutoryMinimumWagePerMonth,
    basicSmwPerYear: statutoryMinimumWagePerMonth * 12,
    factorUsed: 313,
    presentBasicSmwActual,
    presentHolidayPay,
    presentOvertimePay,
    presentNightShiftDifferential,
    presentHazardPay,
    present13thMonthAndOtherBenefits: base.presentNonTaxable13thMonth,
    presentDeMinimis: base.presentDeMinimis,
    presentEmployeeContributions: base.presentEmployeeContributions,
    presentSalariesAndOtherForms: 0,
    presentTotalNonTaxable,
    presentTaxable13thMonthExcess: base.presentTaxable13thMonthExcess,
    presentTaxableSalariesAndOtherForms: base.presentTaxableOtherCompensation,
    presentTotalTaxable: base.presentTaxable13thMonthExcess + base.presentTaxableOtherCompensation,
    previousEmployerTin: "",
    previousEmploymentStatus: "",
    previousFromDate: "",
    previousToDate: "",
    previousReasonOfSeparation: "",
    previousGrossCompensation: 0,
    previousBasicSmwActual: 0,
    previousHolidayPay: 0,
    previousOvertimePay: 0,
    previousNightShiftDifferential: 0,
    previousHazardPay: 0,
    previous13thMonthAndOtherBenefits: 0,
    previousDeMinimis: 0,
    previousEmployeeContributions: 0,
    previousSalariesAndOtherForms: 0,
    previousTotalNonTaxable: 0,
    previousTaxable13thMonth: 0,
    previousTaxableSalariesAndOtherForms: 0,
    previousTotalTaxable: 0,
    totalTaxableCompensation: base.presentTaxable13thMonthExcess + base.presentTaxableOtherCompensation,
    taxDue: base.taxDue,
    taxWithheldPreviousEmployer: 0,
    taxWithheldPresentEmployerJanToNov: base.taxWithheldPresentEmployerJanToNov,
    peraTaxCredit: 0,
    amountWithheldPaidDecemberOrLastSalary: base.amountWithheldPaidDecemberOrLastSalary,
    overwithheldTaxRefunded: base.overwithheldTaxRefunded,
    amountOfTaxWithheldAsAdjusted: base.amountOfTaxWithheldAsAdjusted,
    substitutedFiling: base.substitutedFiling,
    sourceRecords: employeeRecords,
  };
}

function recalculateSchedule1Row(row: Schedule1Row): Schedule1Row {
  const presentTotalNonTaxable =
    money(row.presentNonTaxable13thMonth) +
    money(row.presentDeMinimis) +
    money(row.presentEmployeeContributions) +
    money(row.presentSalariesBelow250kAndOtherComp);
  const presentTaxableBasicSalary = Math.max(0, money(row.presentTaxableBasicSalary));
  const presentTotalTaxable =
    presentTaxableBasicSalary +
    money(row.presentTaxable13thMonthExcess) +
    money(row.presentTaxableOtherCompensation);
  const presentGrossCompensation = presentTotalNonTaxable + presentTotalTaxable;
  const previousTotalNonTaxable =
    money(row.previousNonTaxable13thMonth) +
    money(row.previousDeMinimis) +
    money(row.previousEmployeeContributions) +
    money(row.previousSalariesBelow250kAndOtherComp);
  const previousTotalTaxable =
    money(row.previousTaxableBasicSalary) +
    money(row.previousTaxable13thMonth) +
    money(row.previousTaxableOtherCompensation);
  const totalTaxableCompensation = presentTotalTaxable + previousTotalTaxable;
  const taxDue = computeAnnualTaxDue(totalTaxableCompensation);
  const amountWithheldPaidDecemberOrLastSalary = Math.max(
    0,
    taxDue - money(row.taxWithheldPreviousEmployer) - money(row.taxWithheldPresentEmployerJanToNov) - money(row.peraTaxCredit)
  );
  const overwithheldTaxRefunded = Math.max(
    0,
    money(row.taxWithheldPreviousEmployer) + money(row.taxWithheldPresentEmployerJanToNov) + money(row.peraTaxCredit) - taxDue
  );
  const amountOfTaxWithheldAsAdjusted =
    money(row.taxWithheldPreviousEmployer) +
    money(row.taxWithheldPresentEmployerJanToNov) +
    money(row.peraTaxCredit) +
    amountWithheldPaidDecemberOrLastSalary -
    overwithheldTaxRefunded;

  return {
    ...row,
    presentGrossCompensation,
    presentTaxableBasicSalary,
    presentTotalNonTaxable,
    presentTotalTaxable,
    previousTotalNonTaxable,
    previousTotalTaxable,
    totalTaxableCompensation,
    taxDue,
    amountWithheldPaidDecemberOrLastSalary,
    overwithheldTaxRefunded,
    amountOfTaxWithheldAsAdjusted,
  };
}

function recalculateSchedule2Row(row: Schedule2Row): Schedule2Row {
  const presentTotalNonTaxable =
    money(row.presentBasicSmwActual) +
    money(row.presentHolidayPay) +
    money(row.presentOvertimePay) +
    money(row.presentNightShiftDifferential) +
    money(row.presentHazardPay) +
    money(row.present13thMonthAndOtherBenefits) +
    money(row.presentDeMinimis) +
    money(row.presentEmployeeContributions) +
    money(row.presentSalariesAndOtherForms);
  const presentTotalTaxable = money(row.presentTaxable13thMonthExcess) + money(row.presentTaxableSalariesAndOtherForms);
  const presentGrossCompensation = presentTotalNonTaxable + presentTotalTaxable;
  const previousTotalNonTaxable =
    money(row.previousBasicSmwActual) +
    money(row.previousHolidayPay) +
    money(row.previousOvertimePay) +
    money(row.previousNightShiftDifferential) +
    money(row.previousHazardPay) +
    money(row.previous13thMonthAndOtherBenefits) +
    money(row.previousDeMinimis) +
    money(row.previousEmployeeContributions) +
    money(row.previousSalariesAndOtherForms);
  const previousTotalTaxable = money(row.previousTaxable13thMonth) + money(row.previousTaxableSalariesAndOtherForms);
  const totalTaxableCompensation = presentTotalTaxable + previousTotalTaxable;
  const taxDue = computeAnnualTaxDue(totalTaxableCompensation);
  const amountWithheldPaidDecemberOrLastSalary = Math.max(
    0,
    taxDue - money(row.taxWithheldPreviousEmployer) - money(row.taxWithheldPresentEmployerJanToNov) - money(row.peraTaxCredit)
  );
  const overwithheldTaxRefunded = Math.max(
    0,
    money(row.taxWithheldPreviousEmployer) + money(row.taxWithheldPresentEmployerJanToNov) + money(row.peraTaxCredit) - taxDue
  );
  const amountOfTaxWithheldAsAdjusted =
    money(row.taxWithheldPreviousEmployer) +
    money(row.taxWithheldPresentEmployerJanToNov) +
    money(row.peraTaxCredit) +
    amountWithheldPaidDecemberOrLastSalary -
    overwithheldTaxRefunded;

  return {
    ...row,
    presentGrossCompensation,
    presentTotalNonTaxable,
    presentTotalTaxable,
    previousTotalNonTaxable,
    previousTotalTaxable,
    totalTaxableCompensation,
    taxDue,
    amountWithheldPaidDecemberOrLastSalary,
    overwithheldTaxRefunded,
    amountOfTaxWithheldAsAdjusted,
  };
}

function summarize(schedule1Rows: Schedule1Row[], schedule2Rows: Schedule2Row[]): AlphalistSummary {
  const grossCompensation =
    schedule1Rows.reduce((sum, row) => sum + row.presentGrossCompensation + row.previousGrossCompensation, 0) +
    schedule2Rows.reduce((sum, row) => sum + row.presentGrossCompensation + row.previousGrossCompensation, 0);
  const nonTaxableCompensation =
    schedule1Rows.reduce((sum, row) => sum + row.presentTotalNonTaxable + row.previousTotalNonTaxable, 0) +
    schedule2Rows.reduce((sum, row) => sum + row.presentTotalNonTaxable + row.previousTotalNonTaxable, 0);
  const taxableCompensation =
    schedule1Rows.reduce((sum, row) => sum + row.totalTaxableCompensation, 0) +
    schedule2Rows.reduce((sum, row) => sum + row.totalTaxableCompensation, 0);
  const taxWithheld =
    schedule1Rows.reduce(
      (sum, row) => sum + row.taxWithheldPreviousEmployer + row.taxWithheldPresentEmployerJanToNov + row.amountWithheldPaidDecemberOrLastSalary,
      0
    ) +
    schedule2Rows.reduce(
      (sum, row) => sum + row.taxWithheldPreviousEmployer + row.taxWithheldPresentEmployerJanToNov + row.amountWithheldPaidDecemberOrLastSalary,
      0
    );
  const overwithheldRefunded =
    schedule1Rows.reduce((sum, row) => sum + row.overwithheldTaxRefunded, 0) +
    schedule2Rows.reduce((sum, row) => sum + row.overwithheldTaxRefunded, 0);
  const finalTaxWithheld =
    schedule1Rows.reduce((sum, row) => sum + row.amountOfTaxWithheldAsAdjusted, 0) +
    schedule2Rows.reduce((sum, row) => sum + row.amountOfTaxWithheldAsAdjusted, 0);

  return {
    totalEmployees: schedule1Rows.length + schedule2Rows.length,
    schedule1Employees: schedule1Rows.length,
    schedule2Mwes: schedule2Rows.length,
    grossCompensation,
    nonTaxableCompensation,
    taxableCompensation,
    taxWithheld,
    overwithheldRefunded,
    finalTaxWithheld,
  };
}

function validateRows(schedule1Rows: Schedule1Row[], schedule2Rows: Schedule2Row[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  schedule1Rows.forEach((row) => {
    if (!row.lastName || !row.firstName) {
      issues.push({ severity: "Error", schedule: "Schedule 1", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Missing employee name." });
    }
    if (!row.employmentStatus) {
      issues.push({ severity: "Warning", schedule: "Schedule 1", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Missing current employment status code." });
    }
    if (!row.fromDate) {
      issues.push({ severity: "Warning", schedule: "Schedule 1", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Missing employment period from date." });
    }
    if (row.amountOfTaxWithheldAsAdjusted !== row.taxDue) {
      issues.push({ severity: "Warning", schedule: "Schedule 1", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Adjusted tax withheld does not equal tax due. Check year-end adjustment/substituted filing." });
    }
    const expectedGrossCompensation = money(row.presentTotalNonTaxable) + money(row.presentTotalTaxable);
    if (Math.abs(money(row.presentGrossCompensation) - expectedGrossCompensation) >= 0.01) {
      issues.push({
        severity: "Warning",
        schedule: "Schedule 1",
        employeeNo: row.employeeNo,
        employeeName: getEmployeeName(row),
        issue: "7A Gross Compensation must equal 7F Total Non-Taxable/Exempt Compensation plus 7J Total Taxable Compensation.",
      });
    }
  });

  schedule2Rows.forEach((row) => {
    if (!row.lastName || !row.firstName) {
      issues.push({ severity: "Error", schedule: "Schedule 2", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Missing employee name." });
    }
    if (!row.basicSmwPerDay || !row.basicSmwPerMonth || !row.basicSmwPerYear) {
      issues.push({ severity: "Warning", schedule: "Schedule 2", employeeNo: row.employeeNo, employeeName: getEmployeeName(row), issue: "Missing statutory minimum wage details." });
    }
    const expectedGrossCompensation = money(row.presentTotalNonTaxable) + money(row.presentTotalTaxable);
    if (Math.abs(money(row.presentGrossCompensation) - expectedGrossCompensation) >= 0.01) {
      issues.push({
        severity: "Warning",
        schedule: "Schedule 2",
        employeeNo: row.employeeNo,
        employeeName: getEmployeeName(row),
        issue: "7A Gross Compensation must equal 7O Total Non-Taxable/Exempt Compensation plus 7R Total Taxable Compensation.",
      });
    }
  });

  return issues;
}

function schedule1ForExcel(row: Schedule1Row) {
  return {
    "1 Seq No.": row.sequenceNo,
    "2a Last Name": row.lastName,
    "2b First Name": row.firstName,
    "2c Middle Name": row.middleName,
    "3 Nationality/Resident": row.nationalityOrResident,
    "4 Current Employment Status": row.employmentStatus,
    "5a From (MM/DD)": row.fromDate,
    "5b To (MM/DD)": row.toDate,
    "6 Reason of Separation": row.reasonOfSeparation,
    "7a Gross Compensation Income - Present": row.presentGrossCompensation,
    "7b 13th Month Pay & Other Benefits - Non-taxable": row.presentNonTaxable13thMonth,
    "7c De Minimis Benefits": row.presentDeMinimis,
    "7d SSS/GSIS/PHIC/HDMF/Union Dues": row.presentEmployeeContributions,
    "7e Salaries P250,000 & Below and Other Compensation": row.presentSalariesBelow250kAndOtherComp,
    "7f Total Non-taxable/Exempt Compensation - Present": row.presentTotalNonTaxable,
    "7g Basic Salary - Taxable": row.presentTaxableBasicSalary,
    "7h 13th Month Excess - Taxable": row.presentTaxable13thMonthExcess,
    "7i Salaries and Other Forms - Taxable": row.presentTaxableOtherCompensation,
    "7j Total Taxable Compensation - Present": row.presentTotalTaxable,
    "8 TIN Previous Employer": row.previousEmployerTin,
    "9 Previous Employment Status": row.previousEmploymentStatus,
    "10a Previous From": row.previousFromDate,
    "10b Previous To": row.previousToDate,
    "11 Previous Reason of Separation": row.previousReasonOfSeparation,
    "12a Gross Compensation Income - Previous": row.previousGrossCompensation,
    "12b Previous 13th Month Non-taxable": row.previousNonTaxable13thMonth,
    "12c Previous De Minimis": row.previousDeMinimis,
    "12d Previous Contributions": row.previousEmployeeContributions,
    "12e Previous Salaries P250,000 & Below": row.previousSalariesBelow250kAndOtherComp,
    "12f Previous Total Non-taxable": row.previousTotalNonTaxable,
    "12g Previous Basic Salary Taxable": row.previousTaxableBasicSalary,
    "12h Previous 13th Month Taxable": row.previousTaxable13thMonth,
    "12i Previous Salaries and Other Taxable": row.previousTaxableOtherCompensation,
    "12j Previous Total Taxable": row.previousTotalTaxable,
    "13 Total Taxable Compensation": row.totalTaxableCompensation,
    "14 Tax Due": row.taxDue,
    "15a Tax Withheld Previous Employer": row.taxWithheldPreviousEmployer,
    "15b Tax Withheld Present Employer Jan-Nov": row.taxWithheldPresentEmployerJanToNov,
    "16 5% PERA Tax Credit": row.peraTaxCredit,
    "17a Amount Withheld and Paid in December/Last Salary": row.amountWithheldPaidDecemberOrLastSalary,
    "17b Over Withheld Tax Refunded to Employee": row.overwithheldTaxRefunded,
    "18 Amount of Tax Withheld as Adjusted": row.amountOfTaxWithheldAsAdjusted,
    "19 Substituted Filing Yes/No": row.substitutedFiling,
  };
}

function schedule2ForExcel(row: Schedule2Row) {
  return {
    "1 Seq No.": row.sequenceNo,
    "2a Last Name": row.lastName,
    "2b First Name": row.firstName,
    "2c Middle Name": row.middleName,
    "3 Current Employment Status": row.employmentStatus,
    "4 Region No. Where Assigned": row.regionAssigned,
    "5a From (MM/DD)": row.fromDate,
    "5b To (MM/DD)": row.toDate,
    "6 Reason of Separation": row.reasonOfSeparation,
    "7a Gross Compensation Income - Present": row.presentGrossCompensation,
    "7b Basic/SMW per Day": row.basicSmwPerDay,
    "7c Basic/SMW per Month": row.basicSmwPerMonth,
    "7d Basic/SMW per Year": row.basicSmwPerYear,
    "7e Factor Used": row.factorUsed,
    "7f Basic/SMW Actual": row.presentBasicSmwActual,
    "7g Holiday Pay": row.presentHolidayPay,
    "7h Overtime Pay": row.presentOvertimePay,
    "7i Night Shift Differential": row.presentNightShiftDifferential,
    "7j Hazard Pay": row.presentHazardPay,
    "7k 13th Month Pay & Other Benefits": row.present13thMonthAndOtherBenefits,
    "7l De Minimis Benefits": row.presentDeMinimis,
    "7m SSS/GSIS/PHIC/HDMF/Union Dues": row.presentEmployeeContributions,
    "7n Salaries and Other Forms of Compensation": row.presentSalariesAndOtherForms,
    "7o Total Non-taxable/Exempt Compensation - Present": row.presentTotalNonTaxable,
    "7p 13th Month Excess - Taxable": row.presentTaxable13thMonthExcess,
    "7q Salaries and Other Forms - Taxable": row.presentTaxableSalariesAndOtherForms,
    "7r Total Taxable Compensation - Present": row.presentTotalTaxable,
    "8 TIN Previous Employer": row.previousEmployerTin,
    "9 Previous Employment Status": row.previousEmploymentStatus,
    "10a Previous From": row.previousFromDate,
    "10b Previous To": row.previousToDate,
    "11 Previous Reason of Separation": row.previousReasonOfSeparation,
    "12a Gross Compensation Income - Previous": row.previousGrossCompensation,
    "12b Previous Basic/SMW Actual": row.previousBasicSmwActual,
    "12c Previous Holiday Pay": row.previousHolidayPay,
    "12d Previous Overtime Pay": row.previousOvertimePay,
    "12e Previous Night Shift Differential": row.previousNightShiftDifferential,
    "12f Previous Hazard Pay": row.previousHazardPay,
    "12g Previous 13th Month Benefits": row.previous13thMonthAndOtherBenefits,
    "12h Previous De Minimis": row.previousDeMinimis,
    "12i Previous Contributions": row.previousEmployeeContributions,
    "12j Previous Salaries and Other Compensation": row.previousSalariesAndOtherForms,
    "12k Previous Total Non-taxable": row.previousTotalNonTaxable,
    "12l Previous 13th Month Taxable": row.previousTaxable13thMonth,
    "12m Previous Salaries and Other Taxable": row.previousTaxableSalariesAndOtherForms,
    "12n Previous Total Taxable": row.previousTotalTaxable,
    "13 Total Taxable Compensation": row.totalTaxableCompensation,
    "14 Tax Due": row.taxDue,
    "15a Tax Withheld Previous Employer": row.taxWithheldPreviousEmployer,
    "15b Tax Withheld Present Employer Jan-Nov": row.taxWithheldPresentEmployerJanToNov,
    "16 5% PERA Tax Credit": row.peraTaxCredit,
    "17a Amount Withheld and Paid in December/Last Salary": row.amountWithheldPaidDecemberOrLastSalary,
    "17b Over Withheld Tax Refunded to Employee": row.overwithheldTaxRefunded,
    "18 Amount of Tax Withheld as Adjusted": row.amountOfTaxWithheldAsAdjusted,
    "19 Substituted Filing Yes/No": row.substitutedFiling,
  };
}

export default function AlphalistPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const [revisionNumber, setRevisionNumber] = useState("");
  const [activeTab, setActiveTab] = useState<"schedule1" | "schedule2" | "validation" | "saved">("schedule1");
  const [showReportActions, setShowReportActions] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedAlphalistReport[]>([]);
  const [viewedReport, setViewedReport] = useState<SavedAlphalistReport | null>(null);
  const [schedule1Rows, setSchedule1Rows] = useState<Schedule1Row[]>([]);
  const [schedule2Rows, setSchedule2Rows] = useState<Schedule2Row[]>([]);
  const [activeDrilldown, setActiveDrilldown] = useState<ActiveDrilldown | null>(null);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    async function loadAlphalistData() {
      const [employees, allPayrollRecords, approvals, savedReports] = await Promise.all([
        getCollectionItems<Employee>(storageKeys.employees),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getConfigItem<Record<string, { status?: string }>>(storageKeys.payrollRunApprovals, {}),
        getDataArray<SavedAlphalistReport>(storageKeys.savedAlphalistReports, []),
      ]);
      setEmployees(employees);
      const activePayrollRecords = allPayrollRecords.filter(
        (record) => !isArchivedOrDeletedPayrollRecord(record)
      );
      const approvedRecordIds = getApprovedPayrollRunRecordIds(activePayrollRecords, approvals);
      setPayrollRecords(
        activePayrollRecords.filter(
          (record) => isApprovedPayrollRecord(record) || Boolean(record.id && approvedRecordIds.has(record.id))
        )
      );
      setSavedReports(savedReports);
    }

    loadAlphalistData();
    window.addEventListener(`${storageKeys.employees}-updated`, loadAlphalistData as EventListener);
    window.addEventListener(`${storageKeys.payrollRecords}-updated`, loadAlphalistData as EventListener);
    window.addEventListener(`${storageKeys.savedAlphalistReports}-updated`, loadAlphalistData as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.employees}-updated`, loadAlphalistData as EventListener);
      window.removeEventListener(`${storageKeys.payrollRecords}-updated`, loadAlphalistData as EventListener);
      window.removeEventListener(`${storageKeys.savedAlphalistReports}-updated`, loadAlphalistData as EventListener);
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

  const availableYears = useMemo(() => getTaxYearOptions(payrollRecords), [payrollRecords]);
  const summary = useMemo(() => summarize(schedule1Rows, schedule2Rows), [schedule1Rows, schedule2Rows]);
  const validationIssues = useMemo(() => validateRows(schedule1Rows, schedule2Rows), [schedule1Rows, schedule2Rows]);

  function generateRows(year: string) {
    if (!year) {
      setSchedule1Rows([]);
      setSchedule2Rows([]);
      return;
    }

    const approvedRecordIds = getApprovedPayrollRunRecordIds(payrollRecords);
    const recordsForYear = payrollRecords.filter(
      (record) =>
        !isArchivedOrDeletedPayrollRecord(record) &&
        (isApprovedPayrollRecord(record) || Boolean(record.id && approvedRecordIds.has(record.id))) &&
        isPayrollRecordInTaxYear(record, year)
    );
    const recordsByEmployee = new Map<string, PayrollRecord[]>();

    recordsForYear.forEach((record) => {
      const key = getEmployeeKeyFromRecord(record);
      if (!key) return;
      const current = recordsByEmployee.get(key) || [];
      current.push(record);
      recordsByEmployee.set(key, current);
    });

    const activeEmployees = employees;
    const employeesForYear = activeEmployees.filter((employee) => {
      const employeeRecords = recordsByEmployee.get(getEmployeeKey(employee)) || [];
      return employeeRecords.length > 0;
    });

    const nextSchedule1Rows: Schedule1Row[] = [];
    const nextSchedule2Rows: Schedule2Row[] = [];

    employeesForYear.forEach((employee) => {
      const employeeRecords = recordsByEmployee.get(getEmployeeKey(employee)) || [];
      if (isMweEmployee(employee)) {
        nextSchedule2Rows.push(makeSchedule2Row(employee, employeeRecords, nextSchedule2Rows.length + 1, year));
      } else {
        nextSchedule1Rows.push(makeSchedule1Row(employee, employeeRecords, nextSchedule1Rows.length + 1, year));
      }
    });

    setSchedule1Rows(nextSchedule1Rows.map(recalculateSchedule1Row));
    setSchedule2Rows(nextSchedule2Rows.map(recalculateSchedule2Row));
  }

  function handleYearChange(year: string) {
    setSelectedYear(year);
    setViewedReport(null);
    generateRows(year);
  }

  function updateSchedule1Row(index: number, field: keyof Schedule1Row, value: string) {
    setSchedule1Rows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const currentValue = row[field];
        const nextRow = {
          ...row,
          [field]: typeof currentValue === "number" ? parseInputMoney(value) : value,
        } as Schedule1Row;
        return recalculateSchedule1Row(nextRow);
      })
    );
  }

  function updateSchedule2Row(index: number, field: keyof Schedule2Row, value: string) {
    setSchedule2Rows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const currentValue = row[field];
        const nextRow = {
          ...row,
          [field]: typeof currentValue === "number" ? parseInputMoney(value) : value,
        } as Schedule2Row;
        return recalculateSchedule2Row(nextRow);
      })
    );
  }

  function openAmountDrilldown(
    row: Schedule1Row | Schedule2Row,
    fieldName: string,
    label: string,
    schedule: "schedule1" | "schedule2"
  ) {
    const sourceRecords = row.sourceRecords || [];
    const rawRecords = sourceRecords
      .map((record) =>
        makeDrilldownRecord(
          record,
          schedule === "schedule1"
            ? getSchedule1DrilldownAmounts(record, fieldName)
            : getSchedule2DrilldownAmounts(record, fieldName)
        )
      )
      .filter((record) => Math.abs(record.total) >= 0.01);

    const targetTotal = getRowAmountValue(row, fieldName);
    const records = scaleDrilldownRecordsToTarget(rawRecords, targetTotal);

    setActiveDrilldown({
      title: `${label} • ${getEmployeeName(row)}`,
      fieldName,
      records,
      total: targetTotal,
    });
  }

  function buildReport(): SavedAlphalistReport | null {
    if (!selectedYear) {
      window.alert("Please select a tax year first.");
      return null;
    }

    const fileName = reportFileName.trim();
    const revision = revisionNumber.trim();

    if (!fileName) {
      window.alert("Saved File Name is required.");
      return null;
    }

    if (!revision) {
      window.alert("Revision / Version is required.");
      return null;
    }

    return {
      id: `${selectedYear}-${Date.now()}`,
      year: selectedYear,
      fileName,
      revisionNumber: revision,
      summary,
      schedule1Rows,
      schedule2Rows,
      validationIssues,
      savedAt: new Date().toISOString(),
    };
  }

  function saveReport() {
    const report = buildReport();
    if (!report) return;

    const nextReports = [report, ...savedReports].sort((a, b) => {
      const yearDifference = Number(b.year) - Number(a.year);
      if (yearDifference !== 0) return yearDifference;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    setDataArray(storageKeys.savedAlphalistReports, nextReports);
    setSavedReports(nextReports);
    setViewedReport(report);
    setActiveTab("saved");
    logAudit({ action: "SAVED", entityType: "Report_Alphalist", entityId: report.id, entityName: `Alphalist ${report.year}` });
    window.alert("Alphalist file saved. It is ready for viewing and CSV download.");
  }

  function csvEscape(value: unknown): string {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function rowsToCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    return [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
    ].join("\n");
  }

  function excelEscape(value: unknown): string {
    const text = String(value ?? "");
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowsToSpreadsheetWorksheetXml(rows: Record<string, unknown>[], sheetTitle: string): string {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : ["No Data"];
    const rowCount = Math.max(rows.length + 2, 2);
    const columnCount = headers.length;

    return `
      <Worksheet ss:Name="${excelEscape(sheetTitle)}">
        <Table ss:ExpandedColumnCount="${columnCount}" ss:ExpandedRowCount="${rowCount}" x:FullColumns="1" x:FullRows="1">
          ${headers.map(() => `<Column ss:AutoFitWidth="1" ss:Width="120"/>`).join("")}
          <Row>
            <Cell ss:MergeAcross="${Math.max(columnCount - 1, 0)}" ss:StyleID="SheetTitle">
              <Data ss:Type="String">${excelEscape(sheetTitle)}</Data>
            </Cell>
          </Row>
          <Row>
            ${headers
              .map(
                (header) =>
                  `<Cell ss:StyleID="Header"><Data ss:Type="String">${excelEscape(header)}</Data></Cell>`
              )
              .join("")}
          </Row>
          ${
            rows.length > 0
              ? rows
                  .map(
                    (row) =>
                      `<Row>${headers
                        .map((header) => {
                          const value = row[header];
                          const numericValue = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
                          const isNumeric = value !== "" && value !== null && value !== undefined && Number.isFinite(numericValue) && String(value).trim() !== "";

                          return isNumeric
                            ? `<Cell ss:StyleID="Cell"><Data ss:Type="Number">${numericValue}</Data></Cell>`
                            : `<Cell ss:StyleID="Cell"><Data ss:Type="String">${excelEscape(value)}</Data></Cell>`;
                        })
                        .join("")}</Row>`
                  )
                  .join("")
              : `<Row><Cell ss:StyleID="Cell"><Data ss:Type="String">No records</Data></Cell></Row>`
          }
        </Table>
        <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
          <Selected/>
          <ProtectObjects>False</ProtectObjects>
          <ProtectScenarios>False</ProtectScenarios>
        </WorksheetOptions>
      </Worksheet>`;
  }

  function downloadExcelWorkbook(
    fileName: string,
    sheets: { name: string; rows: Record<string, unknown>[] }[]
  ) {
    const workbookXml = `<?xml version="1.0"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook
        xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:html="http://www.w3.org/TR/REC-html40">
        <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
          <Author>Axis Payroll System</Author>
          <LastAuthor>Axis Payroll System</LastAuthor>
          <Created>${new Date().toISOString()}</Created>
          <Company>Axis Payroll System</Company>
        </DocumentProperties>
        <Styles>
          <Style ss:ID="Default" ss:Name="Normal">
            <Alignment ss:Vertical="Bottom"/>
            <Borders/>
            <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
            <Interior/>
            <NumberFormat/>
            <Protection/>
          </Style>
          <Style ss:ID="SheetTitle">
            <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/>
            <Interior ss:Color="#1D4ED8" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
          </Style>
          <Style ss:ID="Header">
            <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
            <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
            <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
              <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
              <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
              <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
            </Borders>
          </Style>
          <Style ss:ID="Cell">
            <Borders>
              <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
              <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
              <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
              <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
            </Borders>
          </Style>
        </Styles>
        ${sheets.map((sheet) => rowsToSpreadsheetWorksheetXml(sheet.rows, sheet.name)).join("")}
      </Workbook>`;

    downloadTextFile(
      `${safeFileName(fileName)}.xls`,
      workbookXml,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }

  function downloadTextFile(fileName: string, content: string, mimeType = "text/csv;charset=utf-8;") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadCsv(report: SavedAlphalistReport) {
    const baseName = safeFileName(report.fileName);
    logAudit({ action: "DOWNLOADED", entityType: "Report_Alphalist", entityId: report.id, entityName: `Alphalist ${report.year}`, details: "Excel/CSV download" });
    downloadExcelWorkbook(baseName, [
      {
        name: "Schedule 1",
        rows: report.schedule1Rows.map(schedule1ForExcel),
      },
      {
        name: "Schedule 2",
        rows: report.schedule2Rows.map(schedule2ForExcel),
      },
    ]);
  }

  function downloadCurrentCsv() {
    const report = buildReport();
    if (!report) return;
    downloadCsv(report);
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
      className="axis-alphalist-page min-h-screen overflow-x-hidden px-4 py-5 text-slate-950 sm:px-6 lg:px-8"
      style={{
        "--report-banner": activeTheme.bannerColor,
        "--report-accent": activeTheme.accentColor,
        "--report-button-text": accentButtonTextColor,
      } as CSSProperties}
    >
      <style>{`
        .axis-alphalist-page {
          background: linear-gradient(180deg, var(--report-banner) 0%, var(--report-banner) 290px, #f4f8fc 290px, #f4f8fc 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .axis-alphalist-page > div > section:not(.axis-alphalist-hero) {
          border: 1px solid rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.96) !important;
          border-radius: 16px !important;
          box-shadow: 0 14px 38px -32px rgba(8,47,73,0.78) !important;
        }

        .axis-alphalist-page input,
        .axis-alphalist-page select,
        .axis-alphalist-page textarea {
          border-color: #dbe4ef !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .axis-alphalist-page button {
          border-radius: 10px !important;
          box-shadow: 0 10px 24px -22px rgba(8,47,73,0.75);
        }

        .axis-alphalist-page table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: #ffffff;
        }

        .axis-alphalist-page thead,
        .axis-alphalist-page thead tr {
          background: #f8fafc !important;
        }

        .axis-alphalist-page th {
          border-color: #dbe4ef !important;
          color: #475569 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          letter-spacing: 0.02em !important;
        }

        .axis-alphalist-page td {
          border-color: #e6edf5 !important;
          font-size: 12px !important;
        }

        .axis-alphalist-page tbody tr:hover {
          background: #f0f9ff !important;
        }

        .axis-alphalist-page .bg-blue-700,
        .axis-alphalist-page .hover\\:bg-blue-800:hover {
          background-color: var(--report-accent) !important;
          color: var(--report-button-text) !important;
        }

        .axis-alphalist-page .text-blue-700,
        .axis-alphalist-page .text-blue-800,
        .axis-alphalist-page .text-blue-900,
        .axis-alphalist-page .text-blue-950 {
          color: var(--report-accent) !important;
        }

        .axis-alphalist-page .border-blue-100,
        .axis-alphalist-page .border-blue-200,
        .axis-alphalist-page .border-blue-700 {
          border-color: color-mix(in srgb, var(--report-accent) 28%, #dbe4ef) !important;
        }

        .axis-alphalist-page .bg-blue-50 {
          background-color: color-mix(in srgb, var(--report-accent) 9%, #ffffff) !important;
        }

        @media print {
          body * { visibility: hidden; }
          .axis-alphalist-printable,
          .axis-alphalist-printable * { visibility: visible; overflow: visible !important; }
          .axis-alphalist-printable {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 10mm;
            background: white;
            overflow: visible !important;
            max-height: none !important;
          }
        }
      `}</style>
      <div className="mx-auto grid w-full max-w-7xl gap-6 overflow-hidden">
        <section
          className="axis-alphalist-hero axis-alphalist-no-print relative overflow-hidden rounded-2xl border px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
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
                  Alphalist
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Alphalist of Employees</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
                Generate annual alphalist schedules from approved payroll records and save filing-ready exports.
              </p>
            </div>

            <div className="grid w-full gap-2 text-sm sm:grid-cols-3 xl:w-[440px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Tax Year</p>
                <p className="mt-1 font-semibold">{selectedYear || "Select"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Schedule 1</p>
                <p className="mt-1 font-semibold">{schedule1Rows.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Schedule 2</p>
                <p className="mt-1 font-semibold">{schedule2Rows.length}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportActions((current) => !current)}
                className="rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-sky-50 sm:col-span-3"
                style={{ color: activeTheme.accentColor }}
              >
                {showReportActions ? "Hide actions" : "Show actions"}
              </button>

              {showReportActions ? (
                <div className="grid gap-2 sm:col-span-3">
                  <button onClick={() => generateRows(selectedYear)} className="rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold shadow-sm transition hover:bg-white/15" style={{ color: activeTheme.bannerTextColor }}>
                    Regenerate from Payroll
                  </button>
                  <button onClick={saveReport} className="rounded-xl border px-5 py-3 text-sm font-semibold shadow-sm transition" style={{ background: activeTheme.accentColor, borderColor: activeTheme.accentColor, color: accentButtonTextColor }}>
                    Save Alphalist File
                  </button>
                  <button onClick={downloadCurrentCsv} className="rounded-xl border border-white/20 bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:bg-sky-50" style={{ color: activeTheme.accentColor }}>
                    Download Excel Workbook
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="axis-alphalist-no-print rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Tax Year</span>
              <select value={selectedYear} onChange={(event) => handleYearChange(event.target.value)} className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                <option value="">Select year</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Saved File Name <span className="text-red-600">*</span></span>
              <input value={reportFileName} onChange={(event) => setReportFileName(event.target.value)} className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder={getDefaultFileName(selectedYear, revisionNumber)} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Revision / Version <span className="text-red-600">*</span></span>
              <input value={revisionNumber} onChange={(event) => setRevisionNumber(event.target.value)} className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" placeholder="Original, Revision 1, Final" />
            </label>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-6">
          <SummaryCard label="Total Employees" value={String(summary.totalEmployees)} />
          <SummaryCard label="Schedule 1" value={String(summary.schedule1Employees)} />
          <SummaryCard label="Schedule 2 MWEs" value={String(summary.schedule2Mwes)} />
          <SummaryCard label="Gross Compensation" value={`₱${formatMoney(summary.grossCompensation)}`} />
          <SummaryCard label="Taxable Compensation" value={`₱${formatMoney(summary.taxableCompensation)}`} />
          <SummaryCard label="Final Tax Withheld" value={`₱${formatMoney(summary.finalTaxWithheld)}`} />
        </section>

        <section className="axis-alphalist-printable min-w-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
            {[
              ["schedule1", "Schedule 1 - Employees"],
              ["schedule2", "Schedule 2 - MWEs"],
              ["validation", `Validation Issues (${validationIssues.length})`],
              ["saved", `Saved Files (${savedReports.length})`],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key as typeof activeTab)} className={`rounded-[14px] px-4 py-2 text-sm font-black shadow-sm transition ${activeTab === key ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>

          {!selectedYear ? (
            <div className="mt-5 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">Select a tax year first to generate the alphalist.</div>
          ) : null}

          {selectedYear && activeTab === "schedule1" ? (
            <Schedule1EditableTable
              rows={schedule1Rows}
              onChange={updateSchedule1Row}
              onAmountClick={(row, fieldName, label) => openAmountDrilldown(row, fieldName, label, "schedule1")}
            />
          ) : null}
          {selectedYear && activeTab === "schedule2" ? (
            <Schedule2EditableTable
              rows={schedule2Rows}
              onChange={updateSchedule2Row}
              onAmountClick={(row, fieldName, label) => openAmountDrilldown(row, fieldName, label, "schedule2")}
            />
          ) : null}
          {selectedYear && activeTab === "validation" ? <ValidationTable rows={validationIssues} /> : null}
          {activeTab === "saved" ? <SavedFiles reports={savedReports} viewedReport={viewedReport} onView={setViewedReport} onDownload={downloadCsv} /> : null}
        </section>
        {activeDrilldown ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-blue-50 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Amount Drilldown</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">{activeDrilldown.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Showing the payroll cutoffs included in this generated amount. Amounts are reconciled to the clicked Alphalist cell.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrilldown(null)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[68vh] overflow-auto p-5">
                {activeDrilldown.records.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                    No source cutoff amount was found for this field. This may be a formula-only field or a manually entered previous-employer field.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                      <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="border border-slate-200 px-4 py-3">Cutoff</th>
                          <th className="border border-slate-200 px-4 py-3">Payroll Date</th>
                          <th className="border border-slate-200 px-4 py-3">Breakdown</th>
                          <th className="border border-slate-200 px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDrilldown.records.map((record) => (
                          <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                            <td className="border border-slate-200 px-4 py-3 font-black text-slate-950">{record.label}</td>
                            <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-700">{record.payrollDate}</td>
                            <td className="border border-slate-200 px-4 py-3 text-slate-700">
                              <div className="grid gap-1">
                                {record.amounts.map((amount) => (
                                  <div key={`${record.id}-${amount.label}`} className="flex justify-between gap-4 text-xs font-bold">
                                    <span>{amount.label}</span>
                                    <span>{formatMoney(amount.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="border border-slate-200 px-4 py-3 text-right font-black text-slate-950">{formatMoney(record.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-blue-50 font-black text-blue-950">
                        <tr>
                          <td className="border border-blue-100 px-4 py-3" colSpan={3}>TOTAL</td>
                          <td className="border border-blue-100 px-4 py-3 text-right">{formatMoney(activeDrilldown.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-[22px] font-black leading-tight text-slate-950">{value}</p>
    </div>
  );
}

function EditableCell({ value, onChange, type = "text", readOnly = false }: { value: string | number; onChange: (value: string) => void; type?: "text" | "number"; readOnly?: boolean }) {
  const [draftValue, setDraftValue] = useState(formatAmountInputValue(value, type));

  useEffect(() => {
    setDraftValue(formatAmountInputValue(value, type));
  }, [value, type]);

  return (
    <input
      value={draftValue}
      onChange={(event) => {
        setDraftValue(event.target.value);
        onChange(event.target.value);
      }}
      onBlur={() => setDraftValue(formatAmountInputValue(value, type))}
      readOnly={readOnly}
      className={`w-[130px] rounded-[12px] border px-3 py-2 text-sm font-bold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 ${readOnly ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-300 bg-white text-slate-900"}`}
      inputMode={type === "number" ? "decimal" : undefined}
    />
  );
}

function Schedule1EditableTable({
  rows,
  onChange,
  onAmountClick,
}: {
  rows: Schedule1Row[];
  onChange: (index: number, field: keyof Schedule1Row, value: string) => void;
  onAmountClick: (row: Schedule1Row, fieldName: string, label: string) => void;
}) {
  if (rows.length === 0) return <EmptyTableMessage message="No Schedule 1 employees found for this year." />;

  const fields: Array<[keyof Schedule1Row, string, "text" | "number", boolean?]> = [
    ["sequenceNo", "1 Seq. No.", "number", true],
    ["lastName", "2a Last Name", "text"],
    ["firstName", "2b First Name", "text"],
    ["middleName", "2c Middle Name", "text"],
    ["nationalityOrResident", "3 Nationality/Resident (for foreigners only)", "text"],
    ["employmentStatus", "4 Current Employment Status*", "text"],
    ["fromDate", "5a Period of Employment - From (MM/DD)", "text"],
    ["toDate", "5b Period of Employment - To (MM/DD)", "text"],
    ["reasonOfSeparation", "6 Reason of Separation,** if applicable", "text"],
    ["presentGrossCompensation", "7a Gross Compensation Income (present employer)", "number"],
    ["presentNonTaxable13thMonth", "7b 13th Month Pay & Other Benefits", "number"],
    ["presentDeMinimis", "7c De Minimis Benefits", "number"],
    ["presentEmployeeContributions", "7d SSS, GSIS, PHIC, HDMF Contributions and Union Dues (employee share only)", "number"],
    ["presentSalariesBelow250kAndOtherComp", "7e Salaries (P250,000 & below) & Other Forms of Compensation", "number"],
    ["presentTotalNonTaxable", "7f Total Non-Taxable/Exempt Compensation Income (present employer)", "number", true],
    ["presentTaxableBasicSalary", "7g Basic Salary (net of SSS, GSIS, PHIC, HDMF Contributions & Union Dues)", "number"],
    ["presentTaxable13thMonthExcess", "7h 13th Month Pay & Other Benefits (In Excess of Threshold)", "number"],
    ["presentTaxableOtherCompensation", "7i Salaries and Other Forms of Compensation", "number"],
    ["presentTotalTaxable", "7j Total Taxable Compensation Income (present employer)", "number", true],
    ["previousEmployerTin", "8 TIN (Previous Employer)", "text"],
    ["previousEmploymentStatus", "9 Employment Status*", "text"],
    ["previousFromDate", "10a Period of Employment - From (MM/DD)", "text"],
    ["previousToDate", "10b Period of Employment - To (MM/DD)", "text"],
    ["previousReasonOfSeparation", "11 Reason of Separation,** if applicable", "text"],
    ["previousGrossCompensation", "12a Gross Compensation Income (previous employer)", "number"],
    ["previousNonTaxable13thMonth", "12b 13th Month Pay & Other Benefits", "number"],
    ["previousDeMinimis", "12c De Minimis Benefits", "number"],
    ["previousEmployeeContributions", "12d SSS, GSIS, PHIC, HDMF Contributions & Union Dues (employee share only)", "number"],
    ["previousSalariesBelow250kAndOtherComp", "12e Salaries (P250,000 and below) and Other Forms of Compensation", "number"],
    ["previousTotalNonTaxable", "12f Total Non-Taxable/Exempt Compensation Income (previous employer)", "number", true],
    ["previousTaxableBasicSalary", "12g Basic Salary (net of SSS, GSIS, PHIC, HDMF Contributions & Union Dues)", "number"],
    ["previousTaxable13thMonth", "12h 13th Month Pay & Other Benefits", "number"],
    ["previousTaxableOtherCompensation", "12i Salaries and Other Forms of Compensation", "number"],
    ["previousTotalTaxable", "12j Total Taxable Compensation Income (previous employer)", "number", true],
    ["totalTaxableCompensation", "13 Total Taxable Compensation Income (Present & Previous Employer)", "number", true],
    ["taxDue", "14 Tax Due (January to December)", "number"],
    ["taxWithheldPreviousEmployer", "15a Tax Withheld (January to November) - Previous Employer", "number"],
    ["taxWithheldPresentEmployerJanToNov", "15b Tax Withheld (January to November) - Present Employer", "number"],
    ["peraTaxCredit", "16 5% Tax Credit (PERA Act of 2008)", "number"],
    ["amountWithheldPaidDecemberOrLastSalary", "17a Amount Withheld and Paid for in December or Last Salary", "number", true],
    ["overwithheldTaxRefunded", "17b Over Withheld Tax Refunded to Employee", "number", true],
    ["amountOfTaxWithheldAsAdjusted", "18 Amount of Tax Withheld as Adjusted", "number", true],
    ["substitutedFiling", "19 Substituted Filing?*** Yes/No", "text"],
  ];

  return <OfficialEditableTable rows={rows} fields={fields} onChange={onChange} onAmountClick={onAmountClick} />;
}

function Schedule2EditableTable({
  rows,
  onChange,
  onAmountClick,
}: {
  rows: Schedule2Row[];
  onChange: (index: number, field: keyof Schedule2Row, value: string) => void;
  onAmountClick: (row: Schedule2Row, fieldName: string, label: string) => void;
}) {
  if (rows.length === 0) return <EmptyTableMessage message="No Schedule 2 MWE employees found for this year." />;

  const fields: Array<[keyof Schedule2Row, string, "text" | "number", boolean?]> = [
    ["sequenceNo", "1 Seq. No.", "number", true],
    ["lastName", "2a Last Name", "text"],
    ["firstName", "2b First Name", "text"],
    ["middleName", "2c Middle Name", "text"],
    ["employmentStatus", "3 Current Employment Status*", "text"],
    ["regionAssigned", "4 Region No. Where Assigned", "text"],
    ["fromDate", "5a Period of Employment - From (MM/DD)", "text"],
    ["toDate", "5b Period of Employment - To (MM/DD)", "text"],
    ["reasonOfSeparation", "6 Reason of Separation,** if applicable", "text"],
    ["presentGrossCompensation", "7a Gross Compensation Income (present employer)", "number"],
    ["basicSmwPerDay", "7b Basic/SMW per Day", "number"],
    ["basicSmwPerMonth", "7c Basic/SMW per Month", "number"],
    ["basicSmwPerYear", "7d Basic/SMW per Year", "number"],
    ["factorUsed", "7e Factor Used (No. of Days/Year)", "number"],
    ["presentBasicSmwActual", "7f Basic/SMW (actual) (net of SSS, GSIS, PHIC, HDMF Contributions & Union Dues)", "number"],
    ["presentHolidayPay", "7g Holiday Pay", "number"],
    ["presentOvertimePay", "7h Overtime Pay", "number"],
    ["presentNightShiftDifferential", "7i Night Shift Differential", "number"],
    ["presentHazardPay", "7j Hazard Pay", "number"],
    ["present13thMonthAndOtherBenefits", "7k 13th Month Pay & Other Benefits", "number"],
    ["presentDeMinimis", "7l De Minimis Benefits", "number"],
    ["presentEmployeeContributions", "7m SSS, GSIS, PHIC, HDMF Contributions and Union Dues (employee share only)", "number"],
    ["presentSalariesAndOtherForms", "7n Salaries and Other Forms of Compensation", "number"],
    ["presentTotalNonTaxable", "7o Total Non-Taxable/Exempt Compensation (present employer)", "number", true],
    ["presentTaxable13thMonthExcess", "7p 13th Month Pay & Other Benefits (In Excess of Threshold)", "number"],
    ["presentTaxableSalariesAndOtherForms", "7q Salaries and Other Forms of Compensation", "number"],
    ["presentTotalTaxable", "7r Total Taxable Compensation Income (present employer)", "number", true],
    ["previousEmployerTin", "8 TIN (previous employer)", "text"],
    ["previousEmploymentStatus", "9 Employment Status*", "text"],
    ["previousFromDate", "10a Period of Employment - From (MM/DD)", "text"],
    ["previousToDate", "10b Period of Employment - To (MM/DD)", "text"],
    ["previousReasonOfSeparation", "11 Reason of Separation,** if applicable", "text"],
    ["previousGrossCompensation", "12a Gross Compensation Income (previous employer)", "number"],
    ["previousBasicSmwActual", "12b Basic/SMW (actual) (net of SSS, GSIS, PHIC, HDMF Contributions & Union Dues)", "number"],
    ["previousHolidayPay", "12c Holiday Pay", "number"],
    ["previousOvertimePay", "12d Overtime Pay", "number"],
    ["previousNightShiftDifferential", "12e Night Shift Differential", "number"],
    ["previousHazardPay", "12f Hazard Pay", "number"],
    ["previous13thMonthAndOtherBenefits", "12g 13th Month Pay & Other Benefits", "number"],
    ["previousDeMinimis", "12h De Minimis Benefits", "number"],
    ["previousEmployeeContributions", "12i SSS, GSIS, PHIC, HDMF Contributions & Union Dues (employee share only)", "number"],
    ["previousSalariesAndOtherForms", "12j Salaries and Other Forms of Compensation", "number"],
    ["previousTotalNonTaxable", "12k Total Non-Taxable/Exempt Compensation (previous employer)", "number", true],
    ["previousTaxable13thMonth", "12l 13th Month Pay & Other Benefits", "number"],
    ["previousTaxableSalariesAndOtherForms", "12m Salaries and Other Forms of Compensation", "number"],
    ["previousTotalTaxable", "12n Total Taxable Compensation (previous employer)", "number", true],
    ["totalTaxableCompensation", "13 Total Taxable Compensation Income (Present & Previous Employer)", "number", true],
    ["taxDue", "14 Tax Due (January to December)", "number"],
    ["taxWithheldPreviousEmployer", "15a Tax Withheld (January to November) - Previous Employer", "number"],
    ["taxWithheldPresentEmployerJanToNov", "15b Tax Withheld (January to November) - Present Employer", "number"],
    ["peraTaxCredit", "16 5% Tax Credit (PERA Act of 2008)", "number"],
    ["amountWithheldPaidDecemberOrLastSalary", "17a Amount Withheld and Paid for in December or Last Salary", "number", true],
    ["overwithheldTaxRefunded", "17b Over Withheld Tax Refunded to Employee", "number", true],
    ["amountOfTaxWithheldAsAdjusted", "18 Amount of Tax Withheld as Adjusted", "number", true],
    ["substitutedFiling", "19 Substituted Filing?*** Yes/No", "text"],
  ];

  return <OfficialEditableTable rows={rows} fields={fields} onChange={onChange} onAmountClick={onAmountClick} />;
}

function OfficialEditableTable<T extends Record<string, string | number | PayrollRecord[] | undefined>>({
  rows,
  fields,
  onChange,
  onAmountClick,
}: {
  rows: T[];
  fields: Array<[keyof T, string, "text" | "number", boolean?]>;
  onChange: (index: number, field: keyof T, value: string) => void;
  onAmountClick: (row: T, fieldName: string, label: string) => void;
}) {
  return (
    <div className="mt-5 min-w-0 rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="max-w-full overflow-x-auto overflow-y-visible">
        <table className="w-max min-w-full border-collapse text-left text-xs">
          <thead className="font-black uppercase tracking-wide text-slate-600">
            <tr>
              {fields.map(([field, label]) => {
                const fieldName = String(field);
                return (
                  <th
                    key={fieldName}
                    className={`max-w-[240px] whitespace-normal border border-slate-200 px-3 py-3 align-bottom leading-5 ${getAlphalistHeaderClasses(fieldName)}`}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${String(row.employeeNo || "row")}`} className="odd:bg-white even:bg-slate-50">
                {fields.map(([field, label, type, readOnly]) => {
                  const fieldName = String(field);
                  const lockPreviousEmployerField =
                    isJanuaryFirstStart(String(row.fromDate || "")) && isPreviousEmployerField(fieldName);
                  const isPreviousField = isPreviousEmployerField(fieldName);
                  const isCellReadOnly = Boolean(readOnly) || !isPreviousField || lockPreviousEmployerField;
                  const canOpenDrilldown = canDrilldownField(fieldName, type);

                  return (
                    <td key={fieldName} className={`border border-slate-200 p-2 align-top ${getAlphalistDivisionClasses(fieldName, isCellReadOnly)}`}>
                      {canOpenDrilldown ? (
                        <button
                          type="button"
                          onClick={() => onAmountClick(row, fieldName, label)}
                          className="w-[130px] rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-2 text-right text-sm font-black text-blue-800 underline decoration-blue-300 underline-offset-4 transition hover:bg-blue-100"
                          title="Click to view payroll cutoffs included in this amount"
                        >
                          {formatAmountInputValue(row[field] as string | number, type)}
                        </button>
                      ) : (
                        <EditableCell
                          value={row[field] as string | number}
                          type={type}
                          readOnly={isCellReadOnly}
                          onChange={(value) => onChange(rowIndex, field, value)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 border-t border-slate-200 px-4 pb-4 pt-3 text-xs font-bold text-slate-500 lg:grid-cols-[1fr_auto] lg:items-center">
        <p>
          Generated/current-employer and year-end fields are read-only. Only previous-employer fields are editable, except when the employee starts on 01/01. Click any blue amount to view the payroll cutoffs included in the amount.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">Present Employer</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">Present Non-Taxable</span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-800">Present Taxable</span>
          <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-purple-800">Previous Employer</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">Year-End Adjustment</span>
        </div>
      </div>
    </div>
  );
}

function EmptyTableMessage({ message }: { message: string }) {
  return <div className="mt-5 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">{message}</div>;
}

function ValidationTable({ rows }: { rows: ValidationIssue[] }) {
  if (rows.length === 0) return <div className="mt-5 rounded-[20px] border border-emerald-200 bg-white p-5 text-sm font-bold text-emerald-700 shadow-sm">No validation issues detected for this alphalist.</div>;

  return (
    <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[900px] w-full border-collapse text-left text-sm">
        <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Employee No.</th>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Issue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, index) => (
            <tr key={`${row.employeeNo}-${index}`}>
              <td className="px-4 py-3 font-bold">{row.severity}</td>
              <td className="px-4 py-3">{row.schedule}</td>
              <td className="px-4 py-3">{row.employeeNo}</td>
              <td className="px-4 py-3">{row.employeeName}</td>
              <td className="px-4 py-3">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedFiles({ reports, viewedReport, onView, onDownload }: { reports: SavedAlphalistReport[]; viewedReport: SavedAlphalistReport | null; onView: (report: SavedAlphalistReport | null) => void; onDownload: (report: SavedAlphalistReport) => void }) {
  const [auditEntriesByReport, setAuditEntriesByReport] = useState<Record<string, AuditEntry[]>>({});

  useEffect(() => {
    async function loadAuditEntries() {
      const entries = await Promise.all(
        reports.map(async (report) => [report.id, await getAuditsByEntity("Report_Alphalist", report.id)] as const)
      );
      setAuditEntriesByReport(Object.fromEntries(entries));
    }

    loadAuditEntries();
  }, [reports]);

  if (reports.length === 0) return <div className="mt-5 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">No saved alphalist files yet.</div>;

  return (
    <div className="mt-5 space-y-3">
      {reports.map((report) => {
        const auditEntries = auditEntriesByReport[report.id] ?? [];
        return (
        <div key={report.id} className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-black text-slate-950">{report.fileName}</p>
              <p className="text-sm text-slate-600">Employees: {report.summary.totalEmployees} • Final tax withheld: ₱{formatMoney(report.summary.finalTaxWithheld)} • Saved {new Date(report.savedAt).toLocaleString("en-PH")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onView(report)} className="rounded-[14px] border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100">View</button>
              <button onClick={() => onDownload(report)} className="rounded-[14px] bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800">Download Excel</button>
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

      {viewedReport ? (
        <div className="rounded-[24px] border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-blue-950">Viewing {viewedReport.fileName}</h3>
              <p className="mt-1 text-sm text-blue-900">Tax Year {viewedReport.year} • {viewedReport.revisionNumber || "Original"}</p>
            </div>
            <button onClick={() => onView(null)} className="rounded-[14px] border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-900 shadow-sm transition hover:bg-blue-100">Close View</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total Employees" value={String(viewedReport.summary.totalEmployees)} />
            <SummaryCard label="Schedule 1" value={String(viewedReport.summary.schedule1Employees)} />
            <SummaryCard label="Schedule 2 MWEs" value={String(viewedReport.summary.schedule2Mwes)} />
            <SummaryCard label="Final Tax Withheld" value={`₱${formatMoney(viewedReport.summary.finalTaxWithheld)}`} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// === Helper functions for BIR-format alphalist table coloring and grouping ===
function getAlphalistFieldGroup(fieldName: string) {
  if (["sequenceNo", "lastName", "firstName", "middleName", "nationalityOrResident", "employmentStatus", "regionAssigned", "fromDate", "toDate", "reasonOfSeparation"].includes(fieldName)) {
    return "present-general";
  }

  if (["presentGrossCompensation"].includes(fieldName)) return "present-gross";

  if (
    [
      "presentNonTaxable13thMonth",
      "presentDeMinimis",
      "presentEmployeeContributions",
      "presentSalariesBelow250kAndOtherComp",
      "basicSmwPerDay",
      "basicSmwPerMonth",
      "basicSmwPerYear",
      "factorUsed",
      "presentBasicSmwActual",
      "presentHolidayPay",
      "presentOvertimePay",
      "presentNightShiftDifferential",
      "presentHazardPay",
      "present13thMonthAndOtherBenefits",
      "presentSalariesAndOtherForms",
      "presentTotalNonTaxable",
    ].includes(fieldName)
  ) {
    return "present-nontaxable";
  }

  if (
    [
      "presentTaxableBasicSalary",
      "presentTaxable13thMonthExcess",
      "presentTaxableOtherCompensation",
      "presentTaxableSalariesAndOtherForms",
      "presentTotalTaxable",
    ].includes(fieldName)
  ) {
    return "present-taxable";
  }

  if (["previousEmployerTin", "previousEmploymentStatus", "previousFromDate", "previousToDate", "previousReasonOfSeparation", "previousGrossCompensation"].includes(fieldName)) {
    return "previous-general";
  }

  if (
    [
      "previousNonTaxable13thMonth",
      "previousDeMinimis",
      "previousEmployeeContributions",
      "previousSalariesBelow250kAndOtherComp",
      "previousBasicSmwActual",
      "previousHolidayPay",
      "previousOvertimePay",
      "previousNightShiftDifferential",
      "previousHazardPay",
      "previous13thMonthAndOtherBenefits",
      "previousSalariesAndOtherForms",
      "previousTotalNonTaxable",
    ].includes(fieldName)
  ) {
    return "previous-nontaxable";
  }

  if (["previousTaxableBasicSalary", "previousTaxable13thMonth", "previousTaxableOtherCompensation", "previousTaxableSalariesAndOtherForms", "previousTotalTaxable"].includes(fieldName)) {
    return "previous-taxable";
  }

  return "year-end";
}

function getAlphalistDivisionClasses(fieldName: string, readOnly?: boolean) {
  const group = getAlphalistFieldGroup(fieldName);
  const base = readOnly ? "bg-slate-50" : "bg-white";

  switch (group) {
    case "present-general":
      return `${base} border-t-4 border-t-blue-500`;
    case "present-gross":
      return `${base} border-t-4 border-t-blue-600`;
    case "present-nontaxable":
      return `${base} border-t-4 border-t-emerald-500`;
    case "present-taxable":
      return `${base} border-t-4 border-t-rose-500`;
    case "previous-general":
      return `${base} border-t-4 border-t-purple-500`;
    case "previous-nontaxable":
      return `${base} border-t-4 border-t-teal-500`;
    case "previous-taxable":
      return `${base} border-t-4 border-t-orange-500`;
    default:
      return `${base} border-t-4 border-t-amber-500`;
  }
}

function getAlphalistHeaderClasses(fieldName: string) {
  const group = getAlphalistFieldGroup(fieldName);

  switch (group) {
    case "present-general":
    case "present-gross":
      return "bg-blue-50 text-blue-900 border-t-4 border-t-blue-500";
    case "present-nontaxable":
      return "bg-emerald-50 text-emerald-900 border-t-4 border-t-emerald-500";
    case "present-taxable":
      return "bg-rose-50 text-rose-900 border-t-4 border-t-rose-500";
    case "previous-general":
      return "bg-purple-50 text-purple-900 border-t-4 border-t-purple-500";
    case "previous-nontaxable":
      return "bg-teal-50 text-teal-900 border-t-4 border-t-teal-500";
    case "previous-taxable":
      return "bg-orange-50 text-orange-900 border-t-4 border-t-orange-500";
    default:
      return "bg-amber-50 text-amber-900 border-t-4 border-t-amber-500";
  }
}
