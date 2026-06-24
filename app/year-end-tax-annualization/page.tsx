"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";

type PayrollRecord = {
  id: string;
  month?: string;
  year?: string | number;
  monthYear?: string;
  payrollPeriod?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  employeeNo: string;
  employeeName: string;
  department?: string;
  employmentStatus?: string;
  basicPay?: number;
  cutoffBasicPay?: number;
  grossPay?: number;
  adjustedGrossCompensation?: number;
  totalAbsences?: number;
  totalPayrollPremiumBase?: number;
  customPremiumsTotal?: number;
  customPremiums?: { id?: string; name?: string; amount?: number }[];
  customAllowancesTotal?: number;
  customAllowances?: { id?: string; name?: string; amount?: number }[];
  employeeAdvances?: number;
  cashAdvances?: number;
  sssLoanRepayment?: number;
  hdmfLoanRepayment?: number;
  customDeductionsTotal?: number;
  customDeductions?: { id?: string; name?: string; amount?: number }[];
  taxableIncome?: number;
  nonTaxableDMB?: number;
  payrollAdjustmentAmount?: number;
  payrollAdjustmentTaxableCompensation?: number;
  taxableCompensationAdjustment?: number;
  taxableIncomeAdjustment?: number;
  adjustmentTaxableIncome?: number;
  payrollAdjustments?: Array<{
    amount?: number;
    taxableAmount?: number;
    taxableIncome?: number;
    taxableCompensation?: number;
    adjustmentAmount?: number;
    adjustmentType?: string;
    type?: string;
    category?: string;
  }>;
  totalDeductions?: number;
  withholdingTax?: number;
  netPay?: number;
  adjustedNetPay?: number;

  status?: string;
  approvalStatus?: string;
  payrollStatus?: string;
  reviewStatus?: string;
  runStatus?: string;
  workflowStatus?: string;
  approvalState?: string;
  archiveStatus?: "Active" | "Archived";
  deletedAt?: string;
  isDeleted?: boolean;
  createdAt?: string;

  sssEe?: number;
  philhealthEe?: number;
  pagibigEe?: number;

  totalAllowances?: number;
  totalPayrollPremium?: number;
  thirteenthMonthPay?: number;
  christmasBonus?: number;
  otherTaxableAllowances?: number;
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
};

type EmployeeRecord = {
  employeeNo: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  department?: string;
  employmentStatus?: string;
  tin?: string;
  archived?: boolean;
  archiveStatus?: string;
};

type AnnualizationRow = {
  employeeNo: string;
  employeeName: string;
  department: string;
  employmentStatus: string;
  tin: string;
  year: string;

  payrollRecordsCount: number;
  ytdBasicPay: number;
  ytdBasicPayBreakdown: string[];
  ytdPremiumsBreakdown: string[];
  ytdAllowancesBreakdown: string[];
  ytdGrossPayBreakdown: string[];
  ytdNonTaxableCompensationBreakdown: string[];
  ytdBenefitsAppliedTo90kCapBreakdown: string[];
  taxableBenefitsExcessBreakdown: string[];
  ytdMandatoryContributionsBreakdown: string[];
  ytdTaxableCompensationBreakdown: string[];
  ytdOtherDeductionsBreakdown: string[];
  annualTaxableIncomeBreakdown: string[];
  annualTaxDueBreakdown: string[];
  ytdTaxWithheldBreakdown: string[];
  taxAdjustmentBreakdown: string[];
  ytdGrossPay: number;
  ytdPremiums: number;
  ytdAllowances: number;
  ytdAbsences: number;
  ytdOtherDeductions: number;
  ytdTaxableCompensation: number;
  ytdNonTaxableCompensation: number;
  ytdMandatoryContributions: number;
  ytdThirteenthAndOtherBenefits: number;
  ytdBenefitsAppliedTo90kCap: number;
  taxableBenefitsExcess: number;
  annualTaxableIncome: number;
  annualTaxDue: number;
  ytdTaxWithheld: number;
  taxAdjustment: number;
  ytdNetPay: number;

  adjustmentType: "Refund" | "Additional Deduction" | "No Adjustment";
  reviewStatus: "Ready" | "Needs Review";
  reviewNotes: string[];
  confirmed: boolean;
};

type SavedAnnualizationFile = {
  id: string;
  year: string;
  savedAt: string;
  rows: AnnualizationRow[];
  archived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  adjustments?: AnnualizationRow[];
};

type PayrollCutoffOption = {
  key: string;
  label: string;
  monthYear: string;
  payrollPeriod: string;
  recordCount: number;
};


const BENEFITS_EXEMPTION_CAP = 90000;
const DEFAULT_LARGE_TAX_ADJUSTMENT_THRESHOLD = 10000;
const YEAR_END_ANNUALIZATION_FILES_KEY = "yearEndTaxAnnualizationFiles";


const panelStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.88)",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 14px 34px -30px rgba(8, 47, 73, 0.55)",
};

const compactPanelStyle: CSSProperties = {
  border: "1px solid #dbe4ef",
  background: "#ffffff",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 10px 24px -24px rgba(8,47,73,0.62)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 38,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid #dbe4ef",
  fontSize: 13,
  fontWeight: 650,
  background: "#ffffff",
  color: "#0f172a",
  boxSizing: "border-box",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 24px -22px rgba(8,47,73,0.65)",
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid #0a4f8f",
  background: "#0a4f8f",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 28px -22px rgba(14,116,144,0.8)",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 38,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid #dbe4ef",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 10px 24px -22px rgba(8,47,73,0.75)",
};

const tableHeaderCellStyle: CSSProperties = {
  background: "#f8fafc",
  borderBottom: "1px solid #dbe4ef",
  color: "#475569",
  fontSize: 10,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

const tableCellStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e6edf5",
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.4,
};

type PayrollRunApproval = {
  status?: string;
};

function money(value: unknown) {
  return Number(value) || 0;
}

function sumMoneyItems(items?: { amount?: number }[]) {
  return Array.isArray(items)
    ? items.reduce((sum, item) => sum + money(item.amount), 0)
    : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getFullName(employee: EmployeeRecord) {
  const surname = employee.lastName || "";
  const given = [employee.firstName, employee.middleName].filter(Boolean).join(" ");
  return [surname, given].filter(Boolean).join(", ") || employee.employeeNo;
}

function getRecordYear(record: PayrollRecord) {
  const raw = record.year || record.monthYear || "";
  const match = String(raw).match(/20\d{2}/);
  return match ? match[0] : "";
}

function formatMonthYearLabel(record: PayrollRecord) {
  const rawMonthYear = String(record.monthYear || "").trim();
  const monthYearMatch = rawMonthYear.match(/^(20\d{2})-(\d{2})$/);

  if (monthYearMatch) {
    const date = new Date(Number(monthYearMatch[1]), Number(monthYearMatch[2]) - 1, 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  const month = String(record.month || "").trim();
  const year = String(record.year || "").trim();

  if (month && year) return `${month} ${year}`;
  if (rawMonthYear) return rawMonthYear;
  return "No month";
}

function formatPayrollBreakdownLine(record: PayrollRecord, label: string, amount: number) {
  return `${formatMonthYearLabel(record)} • ${record.payrollPeriod || "No period"} • ${label}: ${formatCurrency(amount)}`;
}

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().trim();
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

function getPayrollRunGroupKey(record: PayrollRecord) {
  const payrollPeriod = String(record.payrollPeriod || "Monthly Payroll").trim();
  const monthYear = String(record.monthYear || "").trim();
  const [monthYearYear, monthYearMonth] = monthYear.split("-");
  const monthFromMonthYear = monthYearMonth
    ? new Date(Number(monthYearYear), Number(monthYearMonth) - 1, 1).toLocaleDateString("en-PH", { month: "long" })
    : "";
  const month = String(record.month || monthFromMonthYear || "").trim();
  const year = String(record.year || monthYearYear || getRecordYear(record) || "").trim();

  return `${year}-${month}-${payrollPeriod}`;
}

function getApprovedPayrollRunRecordIds(records: PayrollRecord[], approvals: Record<string, PayrollRunApproval> = {}) {

  const groupedRecords = new Map<string, PayrollRecord[]>();

  records.forEach((record) => {
    const groupKey = getPayrollRunGroupKey(record);
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
      groupRecords.forEach((record) => approvedRecordIds.add(record.id));
    }
  });

  return approvedRecordIds;
}

function isArchivedOrDeletedPayrollRecord(record: PayrollRecord) {
  const statuses = [
    record.status,
    record.approvalStatus,
    record.payrollStatus,
    record.reviewStatus,
    record.runStatus,
    record.workflowStatus,
    record.approvalState,
    record.archiveStatus,
  ].map(normalizeText);

  return (
    record.archiveStatus === "Archived" ||
    record.isDeleted === true ||
    Boolean(record.deletedAt) ||
    statuses.some((status) => status === "deleted" || status === "archived")
  );
}

function isApprovedPayrollRecord(record: PayrollRecord) {
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

function getPayrollRecordDedupKey(record: PayrollRecord) {
  return [
    record.employeeNo,
    record.monthYear || `${record.month || ""}-${record.year || ""}`,
    record.payrollPeriod || "Monthly Payroll",
    record.createdAt || record.id,
  ]
    .map((value) => String(value || "").trim())
    .join("|");
}

function dedupePayrollRecords(records: PayrollRecord[]) {
  const uniqueRecords = new Map<string, PayrollRecord>();

  records.forEach((record) => {
    const key = getPayrollRecordDedupKey(record);
    const existingRecord = uniqueRecords.get(key);

    if (!existingRecord) {
      uniqueRecords.set(key, record);
      return;
    }

    const existingTime = new Date(existingRecord.createdAt || "").getTime() || 0;
    const currentTime = new Date(record.createdAt || "").getTime() || 0;

    if (currentTime >= existingTime) {
      uniqueRecords.set(key, record);
    }
  });

  return Array.from(uniqueRecords.values());
}

function isSemiMonthlyRecord(record: PayrollRecord) {
  const period = normalizeText(record.payrollPeriod);
  return period.includes("first") || period.includes("second") || period.includes("cutoff");
}

function getEarnedBasicPay(record: PayrollRecord) {
  const cutoffBasicPay = money(record.cutoffBasicPay);

  if (cutoffBasicPay > 0) return cutoffBasicPay;

  return money(record.basicPay);
}

function computeAnnualTaxDue(annualTaxableIncome: number) {
  const taxable = Math.max(0, Number(annualTaxableIncome) || 0);

  if (taxable <= 250000) return 0;
  if (taxable <= 400000) return (taxable - 250000) * 0.15;
  if (taxable <= 800000) return 22500 + (taxable - 400000) * 0.2;
  if (taxable <= 2000000) return 102500 + (taxable - 800000) * 0.25;
  if (taxable <= 8000000) return 402500 + (taxable - 2000000) * 0.3;

  return 2202500 + (taxable - 8000000) * 0.35;
}

function getAnnualTaxDueBreakdownLines(annualTaxableIncome: number) {
  const taxable = Math.max(0, Number(annualTaxableIncome) || 0);

  if (taxable <= 250000) {
    return [
      "Tax table bracket: ₱250,000 and below",
      `Annual taxable compensation: ${formatCurrency(taxable)}`,
      "Formula: No income tax due",
      "Annual tax due: ₱0.00",
    ];
  }

  if (taxable <= 400000) {
    const excess = taxable - 250000;
    const taxDue = excess * 0.15;
    return [
      "Tax table bracket: Over ₱250,000 but not over ₱400,000",
      `Annual taxable compensation: ${formatCurrency(taxable)}`,
      `Formula: 15% of excess over ₱250,000`,
      `Excess: ${formatCurrency(taxable)} - ₱250,000.00 = ${formatCurrency(excess)}`,
      `Annual tax due: ${formatCurrency(excess)} × 15% = ${formatCurrency(taxDue)}`,
    ];
  }

  if (taxable <= 800000) {
    const excess = taxable - 400000;
    const taxDue = 22500 + excess * 0.2;
    return [
      "Tax table bracket: Over ₱400,000 but not over ₱800,000",
      `Annual taxable compensation: ${formatCurrency(taxable)}`,
      `Formula: ₱22,500 + 20% of excess over ₱400,000`,
      `Excess: ${formatCurrency(taxable)} - ₱400,000.00 = ${formatCurrency(excess)}`,
      `Variable tax: ${formatCurrency(excess)} × 20% = ${formatCurrency(excess * 0.2)}`,
      `Annual tax due: ₱22,500.00 + ${formatCurrency(excess * 0.2)} = ${formatCurrency(taxDue)}`,
    ];
  }

  if (taxable <= 2000000) {
    const excess = taxable - 800000;
    const taxDue = 102500 + excess * 0.25;
    return [
      "Tax table bracket: Over ₱800,000 but not over ₱2,000,000",
      `Annual taxable compensation: ${formatCurrency(taxable)}`,
      `Formula: ₱102,500 + 25% of excess over ₱800,000`,
      `Excess: ${formatCurrency(taxable)} - ₱800,000.00 = ${formatCurrency(excess)}`,
      `Variable tax: ${formatCurrency(excess)} × 25% = ${formatCurrency(excess * 0.25)}`,
      `Annual tax due: ₱102,500.00 + ${formatCurrency(excess * 0.25)} = ${formatCurrency(taxDue)}`,
    ];
  }

  if (taxable <= 8000000) {
    const excess = taxable - 2000000;
    const taxDue = 402500 + excess * 0.3;
    return [
      "Tax table bracket: Over ₱2,000,000 but not over ₱8,000,000",
      `Annual taxable compensation: ${formatCurrency(taxable)}`,
      `Formula: ₱402,500 + 30% of excess over ₱2,000,000`,
      `Excess: ${formatCurrency(taxable)} - ₱2,000,000.00 = ${formatCurrency(excess)}`,
      `Variable tax: ${formatCurrency(excess)} × 30% = ${formatCurrency(excess * 0.3)}`,
      `Annual tax due: ₱402,500.00 + ${formatCurrency(excess * 0.3)} = ${formatCurrency(taxDue)}`,
    ];
  }

  const excess = taxable - 8000000;
  const taxDue = 2202500 + excess * 0.35;
  return [
    "Tax table bracket: Over ₱8,000,000",
    `Annual taxable compensation: ${formatCurrency(taxable)}`,
    `Formula: ₱2,202,500 + 35% of excess over ₱8,000,000`,
    `Excess: ${formatCurrency(taxable)} - ₱8,000,000.00 = ${formatCurrency(excess)}`,
    `Variable tax: ${formatCurrency(excess)} × 35% = ${formatCurrency(excess * 0.35)}`,
    `Annual tax due: ₱2,202,500.00 + ${formatCurrency(excess * 0.35)} = ${formatCurrency(taxDue)}`,
  ];
}

function getPayrollPeriodSortValue(payrollPeriod: string) {
  const normalizedPeriod = normalizeText(payrollPeriod);

  if (normalizedPeriod.includes("first")) return 1;
  if (normalizedPeriod.includes("second")) return 2;
  if (normalizedPeriod.includes("third")) return 3;
  if (normalizedPeriod.includes("fourth")) return 4;
  if (normalizedPeriod.includes("monthly")) return 5;

  return 99;
}

function getPayrollCutoffSortValue(option: PayrollCutoffOption) {
  const monthSort = Number(String(option.monthYear || "").replace(/[^0-9]/g, "")) || 0;
  return monthSort * 100 + getPayrollPeriodSortValue(option.payrollPeriod);
}

function getPayrollCutoffOptions(allPayrollRecords: PayrollRecord[] = [], approvals: Record<string, PayrollRunApproval> = {}) {
  const activeRecords = dedupePayrollRecords(
    allPayrollRecords.filter((record) => !isArchivedOrDeletedPayrollRecord(record))
  );
  const approvedRecordIds = getApprovedPayrollRunRecordIds(activeRecords, approvals);
  const activeApprovedRecords = activeRecords.filter(
    (record) => isApprovedPayrollRecord(record) || approvedRecordIds.has(record.id)
  );

  const optionMap = new Map<string, PayrollCutoffOption>();

  activeApprovedRecords.forEach((record) => {
    const monthYear = String(record.monthYear || "").trim();
    const payrollPeriod = String(record.payrollPeriod || "Monthly Payroll").trim();
    if (!monthYear) return;

    const key = `${monthYear}|${payrollPeriod}`;
    const existingOption = optionMap.get(key);
    const labelRecord = { monthYear, month: record.month, year: record.year } as PayrollRecord;

    optionMap.set(key, {
      key,
      label: `${formatMonthYearLabel(labelRecord)} • ${payrollPeriod}`,
      monthYear,
      payrollPeriod,
      recordCount: (existingOption?.recordCount || 0) + 1,
    });
  });

  return Array.from(optionMap.values()).sort(
    (a, b) => getPayrollCutoffSortValue(a) - getPayrollCutoffSortValue(b)
  );
}

function getDefaultCutoffKeyForYear(year: string, payrollCutoffOptions: PayrollCutoffOption[]) {
  const decemberSecondCutoff = payrollCutoffOptions.find(
    (option) => option.monthYear === `${year}-12` && normalizeText(option.payrollPeriod).includes("second")
  );

  if (decemberSecondCutoff) return decemberSecondCutoff.key;

  const decemberAnyCutoff = payrollCutoffOptions.find((option) => option.monthYear === `${year}-12`);
  if (decemberAnyCutoff) return decemberAnyCutoff.key;

  return payrollCutoffOptions[payrollCutoffOptions.length - 1]?.key || "";
}

function getNonTaxableCompensation(record: PayrollRecord) {
  const savedNonTaxableDMB = money(record.nonTaxableDMB);

  if (savedNonTaxableDMB > 0) {
    return savedNonTaxableDMB;
  }

  return (
    Math.min(money(record.riceSubsidy), 1000) +
    Math.min(money(record.uniformClothing), 3500) +
    Math.min(money(record.laundryAllowance), 150) +
    Math.min(money(record.medicalCashDependents), 125) +
    Math.min(money(record.actualMedicalAssistance), 5000) +
    Math.min(money(record.achievementAwards), 5000) +
    Math.min(money(record.christmasAnniversaryGifts), 2500) +
    Math.min(money(record.cbaProductivityIncentives), 5000)
  );
}

// Helper to provide detailed breakdown for Non-taxable De Minimis Benefits
function getNonTaxableDeMinimisBreakdownLines(record: PayrollRecord) {
  const savedNonTaxableDMB = money(record.nonTaxableDMB);
  const header = `${formatMonthYearLabel(record)} • ${record.payrollPeriod || "No period"}`;

  if (savedNonTaxableDMB > 0) {
    return [
      `${header} • Saved non-taxable de minimis used directly: ${formatCurrency(savedNonTaxableDMB)}`,
    ];
  }

  const items = [
    { label: "Rice Subsidy", actual: money(record.riceSubsidy), limit: 1000 },
    { label: "Uniform / Clothing", actual: money(record.uniformClothing), limit: 3500 },
    { label: "Laundry Allowance", actual: money(record.laundryAllowance), limit: 150 },
    { label: "Medical Cash Allowance to Dependents", actual: money(record.medicalCashDependents), limit: 125 },
    { label: "Actual Medical Assistance", actual: money(record.actualMedicalAssistance), limit: 5000 },
    { label: "Achievement Awards", actual: money(record.achievementAwards), limit: 5000 },
    { label: "Christmas / Anniversary Gifts", actual: money(record.christmasAnniversaryGifts), limit: 2500 },
    { label: "CBA / Productivity Incentives", actual: money(record.cbaProductivityIncentives), limit: 5000 },
  ];

  const lines = items
    .filter((item) => item.actual > 0)
    .map((item) => {
      const nonTaxablePortion = Math.min(item.actual, item.limit);
      const excess = Math.max(0, item.actual - item.limit);

      return `${header} • ${item.label}: lower of actual ${formatCurrency(item.actual)} and limit ${formatCurrency(item.limit)} = ${formatCurrency(nonTaxablePortion)}${excess > 0 ? `; excess ${formatCurrency(excess)} is not included as non-taxable de minimis` : ""}`;
    });

  if (lines.length === 0) {
    return [`${header} • No de minimis items recorded.`];
  }

  lines.push(`${header} • Total non-taxable de minimis: ${formatCurrency(getNonTaxableCompensation(record))}`);

  return lines;
}

function getPayrollPremiums(record: PayrollRecord) {
  const savedTotalPremium = money(record.totalPayrollPremium);
  if (savedTotalPremium > 0) return savedTotalPremium;

  return money(record.totalPayrollPremiumBase) + money(record.customPremiumsTotal) + sumMoneyItems(record.customPremiums);
}

function getCustomAllowancesTotal(record: PayrollRecord) {
  return money(record.customAllowancesTotal) || sumMoneyItems(record.customAllowances);
}

function getPayrollAllowances(record: PayrollRecord) {
  const savedTotalAllowances = money(record.totalAllowances);
  if (savedTotalAllowances > 0) return savedTotalAllowances;

  return (
    money(record.riceSubsidy) +
    money(record.uniformClothing) +
    money(record.laundryAllowance) +
    money(record.medicalCashDependents) +
    money(record.actualMedicalAssistance) +
    money(record.achievementAwards) +
    money(record.christmasAnniversaryGifts) +
    money(record.mealAllowanceOTNight) +
    money(record.monetizedLeavePrivate) +
    money(record.cbaProductivityIncentives) +
    money(record.thirteenthMonthPay) +
    money(record.christmasBonus) +
    money(record.otherTaxableAllowances) +
    getCustomAllowancesTotal(record)
  );
}

function getThirteenthAndOtherBenefits(record: PayrollRecord) {
  const excessDeMinimis =
    Math.max(money(record.riceSubsidy) - 1000, 0) +
    Math.max(money(record.uniformClothing) - 3500, 0) +
    Math.max(money(record.laundryAllowance) - 150, 0) +
    Math.max(money(record.medicalCashDependents) - 125, 0) +
    Math.max(money(record.actualMedicalAssistance) - 5000, 0) +
    Math.max(money(record.achievementAwards) - 5000, 0) +
    Math.max(money(record.christmasAnniversaryGifts) - 2500, 0) +
    Math.max(money(record.cbaProductivityIncentives) - 5000, 0);

  return (
    excessDeMinimis +
    money(record.mealAllowanceOTNight) +
    money(record.monetizedLeavePrivate) +
    money(record.thirteenthMonthPay) +
    money(record.christmasBonus) +
    money(record.otherTaxableAllowances) +
    getCustomAllowancesTotal(record)
  );
}

function getMandatoryContributions(record: PayrollRecord) {
  return money(record.sssEe) + money(record.philhealthEe) + money(record.pagibigEe);
}

function getOtherDeductions(record: PayrollRecord) {
  const knownOtherDeductions =
    money(record.employeeAdvances) +
    money(record.cashAdvances) +
    money(record.sssLoanRepayment) +
    money(record.hdmfLoanRepayment) +
    (money(record.customDeductionsTotal) || sumMoneyItems(record.customDeductions));

  if (knownOtherDeductions > 0) {
    return knownOtherDeductions;
  }

  const totalDeductions = money(record.totalDeductions);
  const mandatoryContributions = getMandatoryContributions(record);
  const taxWithheld = money(record.withholdingTax);

  return Math.max(0, totalDeductions - mandatoryContributions - taxWithheld);
}

function getTaxablePayrollAdjustments(record: PayrollRecord) {
  const directAdjustmentAmount =
    money(record.payrollAdjustmentTaxableCompensation) +
    money(record.taxableCompensationAdjustment) +
    money(record.taxableIncomeAdjustment) +
    money(record.adjustmentTaxableIncome) +
    money(record.payrollAdjustmentAmount);

  const adjustmentRowsAmount = Array.isArray(record.payrollAdjustments)
    ? record.payrollAdjustments.reduce((sum, adjustment) => {
        const rawType = String(
          adjustment.adjustmentType || adjustment.type || adjustment.category || ""
        ).toLowerCase();
        const sign = rawType.includes("deduction") ? -1 : 1;
        const taxableAmount =
          money(adjustment.taxableAmount) ||
          money(adjustment.taxableIncome) ||
          money(adjustment.taxableCompensation) ||
          money(adjustment.adjustmentAmount) ||
          money(adjustment.amount);

        return sum + sign * taxableAmount;
      }, 0)
    : 0;

  return directAdjustmentAmount + adjustmentRowsAmount;
}

function buildAnnualizationRows(
  year: string,
  largeTaxAdjustmentThreshold: number,
  allEmployees: EmployeeRecord[] = [],
  allPayrollRecords: PayrollRecord[] = [],
  approvals: Record<string, PayrollRunApproval> = {}
): AnnualizationRow[] {
  const employees = allEmployees;
  const activePayrollRecords = dedupePayrollRecords(
    allPayrollRecords.filter((record) => !isArchivedOrDeletedPayrollRecord(record))
  );
  const approvedRecordIds = getApprovedPayrollRunRecordIds(activePayrollRecords, approvals);
  const payrollRecords = activePayrollRecords.filter(
    (record) => isApprovedPayrollRecord(record) || approvedRecordIds.has(record.id)
  );

  const activeOrRelevantEmployees = employees.filter(
    (employee) => !employee.archived || ["Resigned", "Terminated", "End of Contract", "Retired", "Inactive"].includes(employee.archiveStatus || "")
  );

  const rows = activeOrRelevantEmployees.map((employee) => {
    const employeePayrollRecords = payrollRecords.filter(
      (record) =>
        String(record.employeeNo || "") === String(employee.employeeNo || "") &&
        getRecordYear(record) === year
    );

    const totals = employeePayrollRecords.reduce(
      (acc, record) => {
        const premiums = getPayrollPremiums(record);
        const allowances = getPayrollAllowances(record);
        const earnedBasicPay = getEarnedBasicPay(record);
        const grossPay = Math.max(0, earnedBasicPay + premiums + allowances);
        const absences = money(record.totalAbsences);
        const otherDeductions = getOtherDeductions(record);
        const payrollAdjustmentTaxableCompensation = getTaxablePayrollAdjustments(record);
        const mandatoryContributions = getMandatoryContributions(record);
        const nonTaxableCompensation = getNonTaxableCompensation(record);
        const thirteenthAndOtherBenefits = getThirteenthAndOtherBenefits(record);

        acc.ytdBasicPay += earnedBasicPay;
        acc.ytdBasicPayBreakdown.push(formatPayrollBreakdownLine(record, "Basic pay", earnedBasicPay));
        acc.ytdGrossPay += grossPay;
        acc.ytdGrossPayBreakdown.push(
          `${formatMonthYearLabel(record)} • ${record.payrollPeriod || "No period"} • Adjusted gross compensation: ${formatCurrency(earnedBasicPay)} + ${formatCurrency(premiums)} + ${formatCurrency(allowances)} = ${formatCurrency(grossPay)}`
        );
        acc.ytdPremiums += premiums;
        acc.ytdPremiumsBreakdown.push(formatPayrollBreakdownLine(record, "Premiums", premiums));
        acc.ytdAllowances += allowances;
        acc.ytdAllowancesBreakdown.push(formatPayrollBreakdownLine(record, "Allowances", allowances));
        acc.ytdAbsences += absences;
        acc.ytdOtherDeductions += otherDeductions;
        acc.ytdOtherDeductionsBreakdown.push(formatPayrollBreakdownLine(record, "Other deductions", otherDeductions));
        acc.ytdNonTaxableCompensation += nonTaxableCompensation;
        acc.ytdNonTaxableCompensationBreakdown.push(...getNonTaxableDeMinimisBreakdownLines(record));
        acc.ytdMandatoryContributions += mandatoryContributions;
        acc.ytdMandatoryContributionsBreakdown.push(formatPayrollBreakdownLine(record, "Gov't contributions (EE only)", mandatoryContributions));
        acc.ytdThirteenthAndOtherBenefits += thirteenthAndOtherBenefits;
        acc.ytdBenefitsAppliedTo90kCapBreakdown.push(formatPayrollBreakdownLine(record, "Benefits subject to ₱90,000 cap before annual limit", thirteenthAndOtherBenefits));
        acc.ytdTaxWithheld += money(record.withholdingTax);
        acc.ytdTaxWithheldBreakdown.push(formatPayrollBreakdownLine(record, "Tax withheld", money(record.withholdingTax)));
        acc.ytdNetPay += money(record.adjustedNetPay ?? record.netPay);

        return acc;
      },
      {
        ytdBasicPay: 0,
        ytdBasicPayBreakdown: [] as string[],
        ytdPremiumsBreakdown: [] as string[],
        ytdAllowancesBreakdown: [] as string[],
        ytdGrossPayBreakdown: [] as string[],
        ytdNonTaxableCompensationBreakdown: [] as string[],
        ytdBenefitsAppliedTo90kCapBreakdown: [] as string[],
        ytdMandatoryContributionsBreakdown: [] as string[],
        ytdTaxableCompensationBreakdown: [] as string[],
        ytdOtherDeductionsBreakdown: [] as string[],
        ytdTaxWithheldBreakdown: [] as string[],
        ytdGrossPay: 0,
        ytdPremiums: 0,
        ytdAllowances: 0,
        ytdAbsences: 0,
        ytdOtherDeductions: 0,
        ytdTaxableCompensation: 0,
        ytdNonTaxableCompensation: 0,
        ytdMandatoryContributions: 0,
        ytdThirteenthAndOtherBenefits: 0,
        ytdTaxWithheld: 0,
        ytdNetPay: 0,
      }
    );

    const taxableBenefitsExcess = Math.max(
      0,
      totals.ytdThirteenthAndOtherBenefits - BENEFITS_EXEMPTION_CAP
    );
    const ytdBenefitsAppliedTo90kCap = Math.min(
      totals.ytdThirteenthAndOtherBenefits,
      BENEFITS_EXEMPTION_CAP
    );

    const ytdTaxableCompensation = Math.max(
      0,
      totals.ytdGrossPay -
        totals.ytdNonTaxableCompensation -
        ytdBenefitsAppliedTo90kCap -
        totals.ytdMandatoryContributions
    );

    const annualTaxableIncome = ytdTaxableCompensation;

    const annualTaxDue = computeAnnualTaxDue(annualTaxableIncome);
    const taxAdjustment = annualTaxDue - totals.ytdTaxWithheld;

    const reviewNotes: string[] = [];

    if (!employee.tin) reviewNotes.push("Missing TIN");
    if (employeePayrollRecords.length === 0) reviewNotes.push("No payroll records found for selected year");
    if (employeePayrollRecords.length > 24) {
      reviewNotes.push(`Payroll record count exceeds 24 semi-monthly records: ${employeePayrollRecords.length} records found`);
    }
    if (annualTaxableIncome > 250000 && totals.ytdTaxWithheld === 0) {
      reviewNotes.push("Taxable income exists but no tax was withheld");
    }
    if (
      largeTaxAdjustmentThreshold > 0 &&
      Math.abs(taxAdjustment) >= largeTaxAdjustmentThreshold
    ) {
      reviewNotes.push(
        `Large tax adjustment: ${formatCurrency(Math.abs(taxAdjustment))} is at least ${formatCurrency(largeTaxAdjustmentThreshold)}`
      );
    }
    if (totals.ytdThirteenthAndOtherBenefits > BENEFITS_EXEMPTION_CAP) {
      reviewNotes.push("13th month / benefits exceeded ₱90,000 cap");
    }
    if (employee.archived) {
      reviewNotes.push(`Archived employee: ${employee.archiveStatus || "Inactive"}`);
    }

    const adjustmentType =
      Math.abs(taxAdjustment) < 0.01
        ? "No Adjustment"
        : taxAdjustment > 0
          ? "Additional Deduction"
          : "Refund";

    return {
      employeeNo: employee.employeeNo,
      employeeName: getFullName(employee),
      department: employee.department || "—",
      employmentStatus: employee.archiveStatus || employee.employmentStatus || "—",
      tin: employee.tin || "",
      year,

      payrollRecordsCount: employeePayrollRecords.length,
      ytdBasicPay: totals.ytdBasicPay,
      ytdBasicPayBreakdown: totals.ytdBasicPayBreakdown,
      ytdPremiumsBreakdown: totals.ytdPremiumsBreakdown,
      ytdAllowancesBreakdown: totals.ytdAllowancesBreakdown,
      ytdGrossPayBreakdown: totals.ytdGrossPayBreakdown,
      ytdNonTaxableCompensationBreakdown: totals.ytdNonTaxableCompensationBreakdown,
      ytdBenefitsAppliedTo90kCapBreakdown: [
        ...totals.ytdBenefitsAppliedTo90kCapBreakdown,
        `Annual applied amount: lower of ${formatCurrency(totals.ytdThirteenthAndOtherBenefits)} and ₱90,000.00 = ${formatCurrency(ytdBenefitsAppliedTo90kCap)}`,
      ],
      taxableBenefitsExcessBreakdown: [
        `Excess over ₱90,000 cap: ${formatCurrency(totals.ytdThirteenthAndOtherBenefits)} - ₱90,000.00 = ${formatCurrency(taxableBenefitsExcess)}`,
        "This column is for monitoring only and is not deducted in the annualization computation.",
      ],
      ytdMandatoryContributionsBreakdown: totals.ytdMandatoryContributionsBreakdown,
      ytdTaxableCompensationBreakdown: [
        `Taxable compensation: ${formatCurrency(totals.ytdGrossPay)} adjusted gross compensation - ${formatCurrency(totals.ytdNonTaxableCompensation)} non-taxable de minimis - ${formatCurrency(ytdBenefitsAppliedTo90kCap)} benefits applied to ₱90,000 cap - ${formatCurrency(totals.ytdMandatoryContributions)} employee gov't contributions = ${formatCurrency(ytdTaxableCompensation)}`,
      ],
      ytdOtherDeductionsBreakdown: totals.ytdOtherDeductionsBreakdown,
      annualTaxableIncomeBreakdown: [
        `Annual taxable income follows taxable compensation: ${formatCurrency(ytdTaxableCompensation)}`,
      ],
      annualTaxDueBreakdown: getAnnualTaxDueBreakdownLines(annualTaxableIncome),
      ytdTaxWithheldBreakdown: totals.ytdTaxWithheldBreakdown,
      taxAdjustmentBreakdown: [
        `Tax adjustment: ${formatCurrency(annualTaxDue)} annual tax due - ${formatCurrency(totals.ytdTaxWithheld)} tax withheld = ${formatCurrency(taxAdjustment)}`,
      ],
      ytdGrossPay: totals.ytdGrossPay,
      ytdPremiums: totals.ytdPremiums,
      ytdAllowances: totals.ytdAllowances,
      ytdAbsences: totals.ytdAbsences,
      ytdOtherDeductions: totals.ytdOtherDeductions,
      ytdTaxableCompensation,
      ytdNonTaxableCompensation: totals.ytdNonTaxableCompensation,
      ytdMandatoryContributions: totals.ytdMandatoryContributions,
      ytdThirteenthAndOtherBenefits: totals.ytdThirteenthAndOtherBenefits,
      ytdBenefitsAppliedTo90kCap,
      taxableBenefitsExcess,
      annualTaxableIncome,
      annualTaxDue,
      ytdTaxWithheld: totals.ytdTaxWithheld,
      taxAdjustment,
      ytdNetPay: totals.ytdNetPay,

      adjustmentType,
      reviewStatus: reviewNotes.length > 0 ? "Needs Review" : "Ready",
      reviewNotes,
      confirmed: false,
    } satisfies AnnualizationRow;
  });

  return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export default function YearEndTaxAnnualizationPage() {
  const [savedAnnualizationFiles, setSavedAnnualizationFiles] = useState<SavedAnnualizationFile[]>([]);
  const [selectedAnnualizationFileId, setSelectedAnnualizationFileId] = useState("");
  const [selectedPayrollCutoffKey, setSelectedPayrollCutoffKey] = useState("");
  const [savedFileView, setSavedFileView] = useState<"active" | "archived">("active");
  const [viewingSavedFileId, setViewingSavedFileId] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

  function renderBreakdownAmount(
    value: number,
    title: string,
    lines: string[]
  ) {
    return (
      <button
        type="button"
        onClick={() =>
          setSelectedBreakdown({
            title,
            total: value,
            lines,
          })
        }
        title="Click to view computation breakdown"
        style={{
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 999,
          color: "#075985",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 800,
          padding: "5px 8px",
          textAlign: "left",
          whiteSpace: "nowrap",
          boxShadow: "0 8px 18px -18px rgba(8,47,73,0.65)",
        }}
      >
        {formatCurrency(value)}
      </button>
    );
  }

  const [selectedYear, setSelectedYear] = useState("2026");
  const [largeTaxAdjustmentThreshold, setLargeTaxAdjustmentThreshold] = useState(
    DEFAULT_LARGE_TAX_ADJUSTMENT_THRESHOLD
  );
  const [rows, setRows] = useState<AnnualizationRow[]>([]);
  const [selectedEmployeeNos, setSelectedEmployeeNos] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [searchText, setSearchText] = useState("");
  const [selectedBreakdown, setSelectedBreakdown] = useState<{
    title: string;
    total: number;
    lines: string[];
  } | null>(null);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);
  const [showSavedFiles, setShowSavedFiles] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [showComputationGuide, setShowComputationGuide] = useState(false);
  const [storedPayrollRecords, setStoredPayrollRecords] = useState<PayrollRecord[]>([]);
  const [storedEmployees, setStoredEmployees] = useState<EmployeeRecord[]>([]);
  const [storedApprovals, setStoredApprovals] = useState<Record<string, PayrollRunApproval>>({});

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    async function loadData() {
      const [payrollRecords, employees, annualizationFiles, approvals] = await Promise.all([
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getCollectionItems<EmployeeRecord>(storageKeys.employees),
        getDataArray<SavedAnnualizationFile>(YEAR_END_ANNUALIZATION_FILES_KEY, []),
        getConfigItem<Record<string, PayrollRunApproval>>(storageKeys.payrollRunApprovals, {}),
      ]);
      setStoredPayrollRecords(payrollRecords);
      setStoredEmployees(employees);
      setSavedAnnualizationFiles(annualizationFiles);
      setSelectedAnnualizationFileId((current) => current || annualizationFiles[0]?.id || "");
      setStoredApprovals(approvals);
    }
    loadData();
  }, []);

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
  const activeAnnualizationFiles = savedAnnualizationFiles.filter((file) => !file.archived);
  const archivedAnnualizationFiles = savedAnnualizationFiles.filter((file) => file.archived);
  const visibleAnnualizationFiles = savedFileView === "archived" ? archivedAnnualizationFiles : activeAnnualizationFiles;

  const activeSavedAnnualizationForSelectedYear = savedAnnualizationFiles.find(
    (file) => String(file.year) === String(selectedYear) && !file.archived
  );

  const isSelectedYearLockedBySavedFile = Boolean(activeSavedAnnualizationForSelectedYear);
  const isViewingSavedAnnualizationFile = viewingSavedFileId.trim().length > 0;
  const isAnnualizationReadOnly = isSelectedYearLockedBySavedFile || isViewingSavedAnnualizationFile;

  function openSavedAnnualizationFileForView(fileId: string) {
    const savedFile = savedAnnualizationFiles.find((file) => file.id === fileId);
    if (!savedFile) return;

    setViewingSavedFileId(savedFile.id);
    setSelectedYear(String(savedFile.year));
    setRows(savedFile.rows || savedFile.adjustments || []);
    setSelectedEmployeeNos([]);
  }

  function exitSavedAnnualizationFileView() {
    setViewingSavedFileId("");
    setRows([]);
    setSelectedEmployeeNos([]);
  }

async function updateSavedAnnualizationFiles(nextFiles: SavedAnnualizationFile[]) {
  setSavedAnnualizationFiles(nextFiles);
  await setDataArray(YEAR_END_ANNUALIZATION_FILES_KEY, nextFiles);
}

function handleArchiveAnnualizationFile(fileId: string) {
  const targetFile = savedAnnualizationFiles.find((file) => file.id === fileId);
  if (!targetFile) return;

  const confirmed = window.confirm(
    `Archive the ${targetFile.year} annualization file saved on ${new Date(targetFile.savedAt).toLocaleString()}?`
  );
  if (!confirmed) return;

  const nextFiles = savedAnnualizationFiles.map((file) =>
    file.id === fileId ? { ...file, archived: true, archivedAt: new Date().toISOString() } : file
  );

  updateSavedAnnualizationFiles(nextFiles);

  if (selectedAnnualizationFileId === fileId) {
    const nextActiveFile = nextFiles.find((file) => !file.archived);
    setSelectedAnnualizationFileId(nextActiveFile?.id || "");
    setSelectedPayrollCutoffKey("");
  }
}

function handleRestoreAnnualizationFile(fileId: string) {
  const targetFile = savedAnnualizationFiles.find((file) => file.id === fileId);
  if (!targetFile) return;

  const confirmed = window.confirm(
    `Restore the ${targetFile.year} annualization file saved on ${new Date(targetFile.savedAt).toLocaleString()}?`
  );
  if (!confirmed) return;

  const nextFiles = savedAnnualizationFiles.map((file) =>
    file.id === fileId ? { ...file, archived: false, archivedAt: undefined } : file
  );

  updateSavedAnnualizationFiles(nextFiles);
  setSavedFileView("active");
  setSelectedAnnualizationFileId(fileId);
}

  const payrollCutoffOptions = useMemo(() => getPayrollCutoffOptions(storedPayrollRecords, storedApprovals), [storedPayrollRecords, storedApprovals, rows, savedAnnualizationFiles]);

  const availableYearOptions = useMemo(() => {
    if (!hasMounted) return [selectedYear];
    const activeRecords = dedupePayrollRecords(
      storedPayrollRecords.filter((record) => !isArchivedOrDeletedPayrollRecord(record))
    );
    const approvedRecordIds = getApprovedPayrollRunRecordIds(activeRecords, storedApprovals);
    const activeApprovedRecords = activeRecords.filter(
      (record) => isApprovedPayrollRecord(record) || approvedRecordIds.has(record.id)
    );

    const years = new Set<string>();

    activeApprovedRecords.forEach((record) => {
      const recordYear = getRecordYear(record);
      if (recordYear) years.add(recordYear);
    });

    savedAnnualizationFiles.forEach((file) => {
      if (file.year) years.add(String(file.year));
    });

    if (selectedYear) years.add(String(selectedYear));

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [hasMounted, storedPayrollRecords, storedApprovals, savedAnnualizationFiles, selectedYear]);

const selectedYearPayrollReadiness = useMemo(() => {
  if (!hasMounted) {
    return {
      payrollRecordsCount: 0,
      semiMonthlyRecordsCount: 0,
      hasDecemberSecondCutoff: false,
      isLikelyComplete: false,
    };
  }
  const activeRecords = dedupePayrollRecords(
    storedPayrollRecords.filter((record) => !isArchivedOrDeletedPayrollRecord(record))
  );

  const approvedRecordIds = getApprovedPayrollRunRecordIds(activeRecords, storedApprovals);
  const activeApprovedRecords = activeRecords.filter(
    (record) => isApprovedPayrollRecord(record) || approvedRecordIds.has(record.id)
  );

  const selectedYearRecords = activeApprovedRecords.filter(
    (record) => getRecordYear(record) === String(selectedYear)
  );

  const semiMonthlyRecords = selectedYearRecords.filter((record) => isSemiMonthlyRecord(record));

  const hasDecemberSecondCutoff = selectedYearRecords.some(
    (record) =>
      normalizeText(record.month).includes("december") &&
      normalizeText(record.payrollPeriod).includes("second")
  );

  return {
    payrollRecordsCount: selectedYearRecords.length,
    semiMonthlyRecordsCount: semiMonthlyRecords.length,
    hasDecemberSecondCutoff,
    isLikelyComplete: semiMonthlyRecords.length >= 24 && hasDecemberSecondCutoff,
  };
}, [hasMounted, storedPayrollRecords, storedApprovals, selectedYear, savedAnnualizationFiles]);

const shouldWarnSelectedYearIsEarly =
  selectedYearPayrollReadiness.payrollRecordsCount > 0 &&
  !selectedYearPayrollReadiness.isLikelyComplete &&
  !isSelectedYearLockedBySavedFile;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "All" ||
        row.reviewStatus === statusFilter ||
        (statusFilter === "Confirmed" && row.confirmed);

      const matchesResult =
        resultFilter === "All" || row.adjustmentType === resultFilter;

      const matchesSearch =
        searchText.trim() === "" ||
        row.employeeNo.toLowerCase().includes(searchText.toLowerCase()) ||
        row.employeeName.toLowerCase().includes(searchText.toLowerCase()) ||
        row.department.toLowerCase().includes(searchText.toLowerCase());

      return matchesStatus && matchesResult && matchesSearch;
    });
  }, [resultFilter, rows, searchText, statusFilter]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.employees += 1;
        acc.ready += row.reviewStatus === "Ready" ? 1 : 0;
        acc.needsReview += row.reviewStatus === "Needs Review" ? 1 : 0;
        acc.confirmed += row.confirmed ? 1 : 0;
        acc.refunds += row.taxAdjustment < 0 ? Math.abs(row.taxAdjustment) : 0;
        acc.additionalDeductions += row.taxAdjustment > 0 ? row.taxAdjustment : 0;
        acc.annualTaxDue += row.annualTaxDue;
        acc.taxWithheld += row.ytdTaxWithheld;
        acc.netTaxDifference += row.taxAdjustment;
        return acc;
      },
      {
        employees: 0,
        ready: 0,
        needsReview: 0,
        confirmed: 0,
        refunds: 0,
        additionalDeductions: 0,
        annualTaxDue: 0,
        taxWithheld: 0,
        netTaxDifference: 0,
      }
    );
  }, [filteredRows]);

  function handleGenerate() {
    if (isAnnualizationReadOnly) {
      window.alert("This tax year is locked because it already has an active saved annualization file. Archive the saved file first if you need to recompute.");
      return;
    }
    const confirmed = window.confirm(
      `Generate year-end tax annualization for ${selectedYear}? This will recompute all employees using saved payroll records.`
    );

    if (!confirmed) return;

    const generatedRows = buildAnnualizationRows(
      selectedYear,
      largeTaxAdjustmentThreshold,
      storedEmployees,
      storedPayrollRecords,
      storedApprovals
    );
    setRows(generatedRows);
    setSelectedEmployeeNos([]);
  }

  function handleToggleRowSelection(employeeNo: string) {
    if (isAnnualizationReadOnly) return;
    setSelectedEmployeeNos((currentSelected) =>
      currentSelected.includes(employeeNo)
        ? currentSelected.filter((currentEmployeeNo) => currentEmployeeNo !== employeeNo)
        : [...currentSelected, employeeNo]
    );
  }

  function handleToggleAllVisibleSelections() {
    if (isAnnualizationReadOnly) return;
    const eligibleVisibleRows = filteredRows.filter(
      (row) => row.adjustmentType !== "No Adjustment" && !row.confirmed
    );

    if (eligibleVisibleRows.length === 0) {
      window.alert("No visible unconfirmed rows with tax adjustments to select.");
      return;
    }

    const eligibleEmployeeNos = eligibleVisibleRows.map((row) => row.employeeNo);
    const allEligibleVisibleRowsSelected = eligibleEmployeeNos.every((employeeNo) =>
      selectedEmployeeNos.includes(employeeNo)
    );

    setSelectedEmployeeNos((currentSelected) => {
      if (allEligibleVisibleRowsSelected) {
        return currentSelected.filter(
          (employeeNo) => !eligibleEmployeeNos.includes(employeeNo)
        );
      }

      return Array.from(new Set([...currentSelected, ...eligibleEmployeeNos]));
    });
  }

  function handleConfirmSelectedRows() {
    if (isAnnualizationReadOnly) {
      window.alert("This annualization file is locked in view mode. Archive the active saved file first if you need to make changes.");
      return;
    }
    const selectedRowsWithAdjustment = rows.filter(
      (row) =>
        selectedEmployeeNos.includes(row.employeeNo) &&
        row.adjustmentType !== "No Adjustment" &&
        !row.confirmed
    );

    if (selectedRowsWithAdjustment.length === 0) {
      window.alert("No selected unconfirmed rows with tax adjustments to confirm.");
      return;
    }

    const confirmed = window.confirm(
      `Confirm ${selectedRowsWithAdjustment.length} selected row(s) with tax adjustments? Confirmed rows will be included when you apply the annualization to payroll.`
    );

    if (!confirmed) return;

    const selectedEmployeeNoSet = new Set(
      selectedRowsWithAdjustment.map((row) => row.employeeNo)
    );

    setRows((currentRows) =>
      currentRows.map((row) =>
        selectedEmployeeNoSet.has(row.employeeNo)
          ? { ...row, confirmed: true }
          : row
      )
    );

    setSelectedEmployeeNos((currentSelected) =>
      currentSelected.filter((employeeNo) => !selectedEmployeeNoSet.has(employeeNo))
    );
  }



  function handleSaveConfirmedAnnualizationFile() {
    if (isAnnualizationReadOnly) {
      window.alert("This tax year is locked. Archive the active saved annualization file first if you need to create a new saved file.");
      return;
    }
    const confirmedRows = rows.filter((row) => row.confirmed && row.adjustmentType !== "No Adjustment");

    if (confirmedRows.length === 0) {
      window.alert("No confirmed tax adjustments to save.");
      return;
    }

    const confirmed = window.confirm(
      `Save ${confirmedRows.length} confirmed year-end tax adjustment(s) as an annualization file? You can apply this later once the target payroll cutoff is ready.`
    );

    if (!confirmed) return;

    const newFile: SavedAnnualizationFile = {
      id: `YEA-FILE-${selectedYear}-${Date.now()}`,
      year: selectedYear,
      savedAt: new Date().toISOString(),
      rows: confirmedRows,
    };

    const nextFiles = [newFile, ...savedAnnualizationFiles];
    updateSavedAnnualizationFiles(nextFiles);
    setSavedFileView("active");
    setSelectedAnnualizationFileId(newFile.id);
    logAudit({ action: "SAVED", entityType: "Settings", entityId: newFile.id, entityName: `Year-End Tax Annualization ${selectedYear}`, details: `${confirmedRows.length} tax adjustment(s) saved` });
    window.alert("Year-end tax annualization file saved. You may apply it to a payroll cutoff later.");
  }

  async function handleApplySavedAnnualizationToPayroll() {
    if (isViewingSavedAnnualizationFile) {
      window.alert("You are viewing a saved annualization file. Exit view mode before applying any saved file to payroll.");
      return;
    }
    const selectedFile = savedAnnualizationFiles.find((file) => file.id === selectedAnnualizationFileId && !file.archived);
    const selectedCutoff = payrollCutoffOptions.find((option) => option.key === selectedPayrollCutoffKey);

    if (!selectedFile) {
      window.alert("Select a saved annualization file first.");
      return;
    }

    if (!selectedCutoff) {
      window.alert("Select the payroll cutoff that will receive the year-end tax adjustment.");
      return;
    }

    const confirmed = window.confirm(
      `Apply ${selectedFile.rows.length} saved year-end tax adjustment(s) to ${selectedCutoff.label}? This will add the year-end tax adjustment to matching payroll records.`
    );

    if (!confirmed) return;

    const latestPayrollRecords = await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords);
    const targetRowsByEmployeeNo = new Map(
      selectedFile.rows.map((row) => [String(row.employeeNo), row])
    );

    let appliedCount = 0;
    const nextPayrollRecords = latestPayrollRecords.map((record) => {
      const isTargetCutoff =
        String(record.monthYear || "") === selectedCutoff.monthYear &&
        String(record.payrollPeriod || "Monthly Payroll") === selectedCutoff.payrollPeriod;
      const annualizationRow = targetRowsByEmployeeNo.get(String(record.employeeNo || ""));

      if (!isTargetCutoff || !annualizationRow) return record;

      const isAdditionalDeduction = annualizationRow.taxAdjustment > 0;
      const amount = Math.abs(annualizationRow.taxAdjustment);
      const previousYearEndTaxAdjustment = money((record as any).yearEndTaxAdjustment);
      const signedAdjustment = isAdditionalDeduction ? -amount : amount;
      const existingPayrollAdjustments = Array.isArray(record.payrollAdjustments)
        ? record.payrollAdjustments.filter(
            (adjustment) => adjustment.category !== "yearEndTaxAnnualization"
          )
        : [];

      appliedCount += 1;

      return {
        ...record,
        yearEndTaxAdjustment: signedAdjustment,
        yearEndTaxAdjustmentAmount: amount,
        yearEndTaxAdjustmentType: annualizationRow.adjustmentType,
        yearEndTaxAnnualizationFileId: selectedFile.id,
        yearEndTaxAnnualizationAppliedAt: new Date().toISOString(),
        payrollAdjustments: [
          ...existingPayrollAdjustments,
          {
            amount: signedAdjustment,
            adjustmentAmount: signedAdjustment,
            taxableAmount: 0,
            taxableIncome: 0,
            taxableCompensation: 0,
            adjustmentType: isAdditionalDeduction ? "Deduction" : "Addition",
            type: isAdditionalDeduction ? "Deduction" : "Addition",
            category: "yearEndTaxAnnualization",
          },
        ],
        adjustedNetPay: money(record.adjustedNetPay ?? record.netPay) - previousYearEndTaxAdjustment + signedAdjustment,
      };
    });

    if (appliedCount === 0) {
      window.alert("No matching employees were found in the selected payroll cutoff.");
      return;
    }

    await setCollectionItems(storageKeys.payrollRecords, nextPayrollRecords.map((r: PayrollRecord) => ({ ...r, id: r.id })));
    setStoredPayrollRecords(nextPayrollRecords);
    window.dispatchEvent(new Event("payroll-records-updated"));
    logAudit({ action: "SAVED", entityType: "PayrollRun", entityId: selectedAnnualizationFileId || "yea", entityName: `Year-End Tax Applied – ${selectedYear}`, details: `Applied to ${appliedCount} payroll record(s) in cutoff: ${selectedCutoff?.label || selectedPayrollCutoffKey}` });
    window.alert(`Year-end tax adjustment applied to ${appliedCount} payroll record(s).`);
  }

  function handleExportCsv() {
    if (rows.length === 0) {
      window.alert("Generate annualization first before exporting.");
      return;
    }

    const headers = [
      "Employee",
      "Status",
      "Payroll Count",
      "Basic Pay",
      "Premiums",
      "Allowances",
      "Adjusted Gross Compensation",
      "Non-taxable De Minimis Benefits",
      "Benefits Applied to 90k Cap",
      "Excess Over 90k Cap",
      "Gov't Contributions (EE Only)",
      "Taxable Compensation",
      "Annual Tax Due",
      "Tax Withheld",
      "Tax Adjustment",
      "Result",
      "Review",
      "Notes",
    ];

    const csvRows = rows.map((row) =>
      [
        `${row.employeeName} (${row.employeeNo})${row.tin ? ` - TIN: ${row.tin}` : ""}`,
        row.employmentStatus,
        row.payrollRecordsCount,
        row.ytdBasicPay,
        row.ytdPremiums,
        row.ytdAllowances,
        row.ytdGrossPay,
        row.ytdNonTaxableCompensation,
        row.ytdBenefitsAppliedTo90kCap,
        row.taxableBenefitsExcess,
        row.ytdMandatoryContributions,
        row.ytdTaxableCompensation,
        row.annualTaxDue,
        row.ytdTaxWithheld,
        Math.abs(row.taxAdjustment),
        row.adjustmentType,
        row.confirmed ? "Confirmed" : row.reviewStatus,
        row.reviewNotes.length > 0 ? row.reviewNotes.join(" | ") : "—",
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `year-end-tax-annualization-${selectedYear}.csv`;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  const eligibleVisibleRows = filteredRows.filter(
    (row) => row.adjustmentType !== "No Adjustment" && !row.confirmed
  );
  const allEligibleVisibleRowsSelected =
    eligibleVisibleRows.length > 0 &&
    eligibleVisibleRows.every((row) => selectedEmployeeNos.includes(row.employeeNo));

  const frozenColumnStyle = {
    position: "sticky" as const,
    background: "#ffffff",
    zIndex: 6,
    boxShadow: "1px 0 0 #e6edf5",
  };

  const frozenHeaderStyle = {
    position: "sticky" as const,
    top: 0,
    background: "#f8fafc",
    zIndex: 7,
  };

  const frozenHeaderColumnStyle = {
    ...frozenHeaderStyle,
    boxShadow: "1px 0 0 #e6edf5, 0 1px 0 #dbe4ef",
    zIndex: 9,
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
        background: "#f4f8fc",
        color: "#0f172a",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
        <section
          className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderBottom: `1px solid ${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 82% 20%, ${activeTheme.accentColor}33, transparent 30%), linear-gradient(135deg, ${activeTheme.accentColor}22, transparent 45%)`,
            }}
          />
          <div className="relative mx-auto flex max-w-[1500px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${activeTheme.accentColor}24`, color: activeTheme.bannerTextColor, border: `0.5px solid ${activeTheme.accentColor}66` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                  {isViewingSavedAnnualizationFile ? "Saved file view" : `Tax year ${selectedYear}`}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Year-end compliance
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">Year-End Tax Annualization</h1>
              <p className="mt-1 max-w-3xl text-sm opacity-85">
                Recompute annual tax, identify refunds or additional deductions, confirm employee adjustments, then apply the saved file to the final payroll cutoff.
              </p>
            </div>

            <div className="rounded border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
              <div className="grid gap-2 text-sm font-semibold sm:grid-cols-4">
                {["Generate", "Review", "Save", "Apply"].map((step, index) => (
                  <div key={step} className="flex items-center gap-2 whitespace-nowrap">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xs">
                      {index + 1}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      <div style={{ maxWidth: 1500, margin: "0 auto", display: "grid", gap: 18, padding: "22px 20px 40px" }}>
        <section
          style={{
            ...panelStyle,
            padding: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            alignItems: "center",
          }}
        >
          {[
            { label: "Generated", value: String(totals.employees), helper: "employee rows" },
            { label: "Needs Review", value: String(totals.needsReview), helper: "large or flagged adjustments" },
            { label: "Confirmed", value: String(totals.confirmed), helper: "ready to save" },
            {
              label: totals.netTaxDifference < 0 ? "Net Refund" : totals.netTaxDifference > 0 ? "Additional Tax" : "Net Difference",
              value: formatCurrency(Math.abs(totals.netTaxDifference)),
              helper: totals.netTaxDifference < 0 ? "to return to employees" : totals.netTaxDifference > 0 ? "to deduct from payroll" : "no adjustment",
            },
          ].map((item) => (
            <div key={item.label} style={{ borderLeft: "4px solid #0a4f8f", padding: "6px 0 6px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{item.label}</div>
              <div style={{ marginTop: 2, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
              <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "#64748b" }}>{item.helper}</div>
            </div>
          ))}
        </section>

        <section
          style={panelStyle}
        >
          <div style={{ pointerEvents: "none", position: "absolute", inset: "0 24px auto", height: 1, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.65), transparent)" }} />
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 800, color: "#0f172a" }}>Start Here: Generate the Annualization</div>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              Choose the tax year, set the review threshold, then generate results. After review, confirm rows and save an annualization file for payroll application.
            </div>
          </div>

          {isSelectedYearLockedBySavedFile ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e40af",
                fontWeight: 800,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              {selectedYear} already has an active saved year-end tax annualization file. This year is locked for editing. Archive the saved file first if you need to recompute or create a new adjustment file.
            </div>
          ) : null}
          {shouldWarnSelectedYearIsEarly ? (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: 18,
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
      fontWeight: 800,
      lineHeight: 1.5,
      marginBottom: 16,
    }}
  >
    {selectedYear} has approved payroll records, but it does not appear complete yet. Year-end tax annualization is normally prepared after the December second cutoff is created. For semi-monthly payroll, expect around 24 approved payroll records for January to December. Current approved semi-monthly records found: {selectedYearPayrollReadiness.semiMonthlyRecordsCount}. December second cutoff found: {selectedYearPayrollReadiness.hasDecemberSecondCutoff ? "Yes" : "No"}.
  </div>
) : null}

          {isViewingSavedAnnualizationFile ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                color: "#166534",
                fontWeight: 800,
                lineHeight: 1.5,
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>You are viewing a saved annualization file. Fields are locked in view mode.</span>
              <button
                type="button"
                onClick={exitSavedAnnualizationFileView}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Exit View Mode
              </button>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            <div
              style={compactPanelStyle}
            >
              <label>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Tax Year</div>
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  style={{
                    ...inputStyle,
                  }}
                >
                  {availableYearOptions.length > 0 ? (
  availableYearOptions.map((year) => (
    <option key={year} value={year}>
      {year}
    </option>
  ))
) : (
  <option value={selectedYear}>{selectedYear}</option>
)}
                </select>
              </label>
            </div>

            <div
              style={compactPanelStyle}
            >
              <label>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>
                  Large Adjustment Threshold
                </div>
                <input
                  type="number"
                  min="0"
                  value={largeTaxAdjustmentThreshold}
                  onChange={(event) =>
                    setLargeTaxAdjustmentThreshold(Math.max(0, Number(event.target.value) || 0))
                  }
                  style={{
                    ...inputStyle,
                  }}
                />
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                  Employees with tax adjustment at least this amount are marked Needs Review.
                </div>
              </label>
            </div>

            <div
              style={compactPanelStyle}
            >
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Actions</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  1. Generate and Review
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isAnnualizationReadOnly}
                  style={{
                    ...primaryButtonStyle,
                    background: isAnnualizationReadOnly ? "#bfdbfe" : "#0a4f8f",
                    border: `1px solid ${isAnnualizationReadOnly ? "#bfdbfe" : "#0a4f8f"}`,
                    cursor: isAnnualizationReadOnly ? "not-allowed" : "pointer",
                    opacity: isAnnualizationReadOnly ? 0.65 : 1,
                  }}
                >
                  Generate / Recompute
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSelectedRows}
                  disabled={isAnnualizationReadOnly}
                  style={{
                    ...secondaryButtonStyle,
                    color: isAnnualizationReadOnly ? "#94a3b8" : "#334155",
                    cursor: isAnnualizationReadOnly ? "not-allowed" : "pointer",
                    opacity: isAnnualizationReadOnly ? 0.65 : 1,
                  }}
                >
                  Confirm Selected
                </button>

                </div>

                <div style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
                  2. Finalize Confirmed Adjustments
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleSaveConfirmedAnnualizationFile}
                    disabled={isAnnualizationReadOnly}
                    style={{
                      ...primaryButtonStyle,
                      border: "1px solid #166534",
                      background: isAnnualizationReadOnly ? "#bbf7d0" : "#166534",
                      cursor: isAnnualizationReadOnly ? "not-allowed" : "pointer",
                      opacity: isAnnualizationReadOnly ? 0.65 : 1,
                    }}
                  >
                    Save Annualization File
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsv}
                    style={{
                      ...secondaryButtonStyle,
                    }}
                  >
                    Export CSV
                  </button>
                </div>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
                Recommended flow: Generate / Recompute → review amount pills → select employees → Confirm Selected → Save Annualization File. Apply the saved file to a payroll cutoff only when that cutoff is ready.
              </div>
            </div>
          </div>
        </section>

        <section
          style={panelStyle}
        >
          <div style={{ pointerEvents: "none", position: "absolute", inset: "0 24px auto", height: 1, background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.65), transparent)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#0a4f8f", fontSize: 15, fontWeight: 900 }}>Saved Files</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>
                  {activeAnnualizationFiles.length} active
                </span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>
                  {archivedAnnualizationFiles.length} archived
                </span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>
                  {payrollCutoffOptions.length} payroll cutoffs
                </span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                Apply a confirmed annualization file only when the target cutoff is ready.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSavedFiles((current) => !current)}
              style={{
                ...secondaryButtonStyle,
                minHeight: 34,
                padding: "7px 11px",
                borderRadius: 999,
                background: showSavedFiles ? "#eff6ff" : "#ffffff",
                border: showSavedFiles ? "1px solid #bfdbfe" : "1px solid #dbe4ef",
                color: "#0a4f8f",
                fontSize: 12,
              }}
            >
              {showSavedFiles ? "Hide" : "Show"} files
            </button>
          </div>

          {!showSavedFiles ? null : activeAnnualizationFiles.length === 0 && archivedAnnualizationFiles.length === 0 ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                color: "#64748b",
                lineHeight: 1.45,
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              No saved annualization file yet. Generate the annualization, select employees, click Confirm Selected, then click Save Annualization File.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setSavedFileView("active")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: savedFileView === "active" ? "1px solid #0ea5e9" : "1px solid #dbe4ef",
                    background: savedFileView === "active" ? "#f0f9ff" : "#ffffff",
                    color: savedFileView === "active" ? "#0a4f8f" : "#334155",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 14px 28px -22px rgba(8,47,73,0.75)",
                  }}
                >
                  Active Files ({activeAnnualizationFiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSavedFileView("archived")}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: savedFileView === "archived" ? "1px solid #94a3b8" : "1px solid #dbe4ef",
                    background: savedFileView === "archived" ? "#f8fafc" : "#ffffff",
                    color: savedFileView === "archived" ? "#334155" : "#334155",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 14px 28px -22px rgba(8,47,73,0.75)",
                  }}
                >
                  Archived Files ({archivedAnnualizationFiles.length})
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 16,
                  alignItems: "end",
                }}
              >
                <label>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Annualization File</div>
                  <select
                    value={selectedAnnualizationFileId}
                    onChange={(event) => {
                      const nextFileId = event.target.value;
                      const nextFile = savedAnnualizationFiles.find((file) => file.id === nextFileId);
                      setSelectedAnnualizationFileId(nextFileId);
                      setSelectedPayrollCutoffKey(getDefaultCutoffKeyForYear(nextFile?.year || selectedYear, payrollCutoffOptions));
                    }}
                    style={inputStyle}
                  >
                    <option value="">Select saved file</option>
                    {activeAnnualizationFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.year} • {file.rows.length} adjustment(s) • {new Date(file.savedAt).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <div style={{ fontWeight: 800, marginBottom: 8, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Payroll Cutoff to Apply</div>
                  <select
                    value={selectedPayrollCutoffKey}
                    onChange={(event) => setSelectedPayrollCutoffKey(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select payroll cutoff</option>
                    {payrollCutoffOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label} • {option.recordCount} record(s)
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleApplySavedAnnualizationToPayroll}
                  disabled={isViewingSavedAnnualizationFile}
                  style={{
                    ...primaryButtonStyle,
                    border: "1px solid #166534",
                    background: isViewingSavedAnnualizationFile ? "#bbf7d0" : "#166534",
                    cursor: isViewingSavedAnnualizationFile ? "not-allowed" : "pointer",
                    opacity: isViewingSavedAnnualizationFile ? 0.65 : 1,
                  }}
                >
                  Apply Saved File to Payroll
                </button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {visibleAnnualizationFiles.map((file) => {
                  const selected = selectedAnnualizationFileId === file.id;
                  const totalRefunds = file.rows.reduce((sum, row) => sum + (row.taxAdjustment < 0 ? Math.abs(row.taxAdjustment) : 0), 0);
                  const totalAdditionalTax = file.rows.reduce((sum, row) => sum + (row.taxAdjustment > 0 ? row.taxAdjustment : 0), 0);

                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        if (file.archived) return;
                        setSelectedAnnualizationFileId(file.id);
                        setSelectedPayrollCutoffKey(getDefaultCutoffKeyForYear(file.year, payrollCutoffOptions));
                      }}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        border: selected ? "1px solid #0ea5e9" : "1px solid #e6edf5",
                        background: selected ? "#f0f9ff" : "#ffffff",
                        color: "#0f172a",
                        textAlign: "left",
                        cursor: file.archived ? "default" : "pointer",
                        display: "grid",
                        gap: 8,
                        boxShadow: "0 10px 24px -24px rgba(8,47,73,0.72)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 850, fontSize: 13 }}>
                          {file.year} Year-End Tax Annualization
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                          Saved {new Date(file.savedAt).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "#334155", fontSize: 12, fontWeight: 700 }}>
                          <span>{file.rows.length} adjustment(s)</span>
                          <span>Refunds: {formatCurrency(totalRefunds)}</span>
                          <span>Additional Tax: {formatCurrency(totalAdditionalTax)}</span>
                          {file.archived ? <span>Archived {file.archivedAt ? new Date(file.archivedAt).toLocaleString() : ""}</span> : null}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            onClick={(event) => {
                              event.stopPropagation();
                              openSavedAnnualizationFileForView(file.id);
                            }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 999,
                              border: "1px solid #bfdbfe",
                              background: "#f0f9ff",
                              color: "#0a4f8f",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            View
                          </span>
                          {file.archived ? (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRestoreAnnualizationFile(file.id);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 999,
                                border: "1px solid #bbf7d0",
                                background: "#f0fdf4",
                                color: "#166534",
                                fontSize: 12,
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                            >
                              Restore
                            </span>
                          ) : (
                            <span
                              onClick={(event) => {
                                event.stopPropagation();
                                handleArchiveAnnualizationFile(file.id);
                              }}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 999,
                                border: "1px solid #fecaca",
                                background: "#fff1f2",
                                color: "#be123c",
                                fontSize: 12,
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                            >
                              Archive
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {visibleAnnualizationFiles.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px dashed #cbd5e1",
                      background: "#f8fafc",
                      color: "#64748b",
                      lineHeight: 1.45,
                      fontSize: 12,
                      fontWeight: 650,
                    }}
                  >
                    {savedFileView === "archived" ? "No archived annualization files yet." : "No active annualization files. Check the archived files tab if you archived older files."}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {showSavedFiles ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#92400e",
              fontSize: 12,
              lineHeight: 1.45,
              fontWeight: 650,
            }}
          >
            This does not use Payroll Run Adjustments. It applies the saved year-end tax result directly to the chosen payroll cutoff as a year-end tax adjustment field.
          </div>
          ) : null}
        </section>

        <section
          style={panelStyle}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#0a4f8f", fontSize: 15, fontWeight: 900 }}>Review</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>Generated {totals.employees}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#166534", fontSize: 12, fontWeight: 800 }}>Ready {totals.ready}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: totals.needsReview > 0 ? "#be123c" : "#64748b", fontSize: 12, fontWeight: 800 }}>Review {totals.needsReview}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#075985", fontSize: 12, fontWeight: 800 }}>Confirmed {totals.confirmed}</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                A quick status check before applying the year-end result.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReviewDetails((current) => !current)}
              style={{
                ...secondaryButtonStyle,
                minHeight: 34,
                padding: "7px 11px",
                borderRadius: 999,
                color: "#0a4f8f",
                fontSize: 12,
              }}
            >
              {showReviewDetails ? "Hide" : "Show"} details
            </button>
          </div>

          {showReviewDetails ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            <SummaryBox label="Employees Generated" value={String(totals.employees)} helper="Total rows generated" />
            <SummaryBox label="Ready" value={String(totals.ready)} helper="No detected issue" tone="green" />
            <SummaryBox label="Needs Review" value={String(totals.needsReview)} helper="Requires HR checking" tone="red" />
            <SummaryBox label="Confirmed" value={String(totals.confirmed)} helper="Will be applied to payroll" tone="blue" />
          </div>
          ) : null}
        </section>

        <section
          style={panelStyle}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#0a4f8f", fontSize: 15, fontWeight: 900 }}>Tax Amounts</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>Due {formatCurrency(totals.annualTaxDue)}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>Withheld {formatCurrency(totals.taxWithheld)}</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: totals.netTaxDifference < 0 ? "#166534" : totals.netTaxDifference > 0 ? "#92400e" : "#64748b", fontSize: 12, fontWeight: 850 }}>
                  {totals.netTaxDifference < 0
                    ? `Refund ${formatCurrency(Math.abs(totals.netTaxDifference))}`
                    : totals.netTaxDifference > 0
                      ? `Add'l Tax ${formatCurrency(totals.netTaxDifference)}`
                      : "No net difference"}
                </span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                Recomputed annual tax compared with year-to-date withholding.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTaxDetails((current) => !current)}
              style={{
                ...secondaryButtonStyle,
                minHeight: 34,
                padding: "7px 11px",
                borderRadius: 999,
                background: totals.netTaxDifference < 0 ? "#dcfce7" : totals.netTaxDifference > 0 ? "#fef3c7" : "#f1f5f9",
                color: totals.netTaxDifference < 0 ? "#166534" : totals.netTaxDifference > 0 ? "#92400e" : "#475569",
                border: totals.netTaxDifference < 0 ? "1px solid #bbf7d0" : totals.netTaxDifference > 0 ? "1px solid #fde68a" : "1px solid #dbe4ef",
                fontSize: 12,
              }}
            >
              {showTaxDetails ? "Hide" : "Show"} details
            </button>
          </div>

          {showTaxDetails ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            <SummaryBox label="A. Annual Tax Due" value={formatCurrency(totals.annualTaxDue)} helper="Recomputed tax payable" tone="blue" />
            <SummaryBox label="B. Tax Already Withheld YTD" value={formatCurrency(totals.taxWithheld)} helper="Total withholding tax deducted" />
            <SummaryBox
              label="C. Net Difference (A - B)"
              value={formatCurrency(Math.abs(totals.netTaxDifference))}
              helper={
                totals.netTaxDifference < 0
                  ? "Refund to employees"
                  : totals.netTaxDifference > 0
                    ? "Additional tax to deduct"
                    : "No adjustment"
              }
              tone={totals.netTaxDifference < 0 ? "green" : totals.netTaxDifference > 0 ? "yellow" : "gray"}
            />
            <SummaryBox label="Refunds to Employees" value={formatCurrency(totals.refunds)} helper="Increases net pay" tone="green" />
            <SummaryBox label="Additional Tax to Deduct" value={formatCurrency(totals.additionalDeductions)} helper="Decreases net pay" tone="yellow" />
          </div>
          ) : null}
        </section>

        <section
          style={panelStyle}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <div style={{ fontWeight: 800, marginBottom: 8, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Search</div>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Employee no., name, or department"
                style={inputStyle}
              />
            </label>

            <label>
              <div style={{ fontWeight: 800, marginBottom: 8, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Review Status</div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="All">All</option>
                <option value="Ready">Ready</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Confirmed">Confirmed</option>
              </select>
            </label>

            <label>
              <div style={{ fontWeight: 800, marginBottom: 8, color: "#334155", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Adjustment Result</div>
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
                style={inputStyle}
              >
                <option value="All">All</option>
                <option value="Refund">Refund</option>
                <option value="Additional Deduction">Additional Deduction</option>
                <option value="No Adjustment">No Adjustment</option>
              </select>
            </label>
          </div>
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e6edf5",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#0f172a" }}>Review guide:</strong> Ready means no detected issue. Needs Review is triggered by missing TIN,
            missing payroll records, separated/archived status, taxable income without
            withholding tax, benefits above ₱90,000, or tax adjustment reaching the
            selected large-adjustment threshold.
          </div>
        </section>

        
        <section
          style={panelStyle}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "#0a4f8f", fontSize: 15, fontWeight: 900 }}>Computation Guide</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>|</span>
                <span style={{ color: "#475569", fontSize: 12, fontWeight: 750 }}>Clickable amount pills</span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>|</span>
                <span style={{ color: "#92400e", fontSize: 12, fontWeight: 750 }}>Excess column is monitoring only</span>
              </div>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                Open this only when you need a reminder of what each amount represents.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowComputationGuide((current) => !current)}
              style={{
                ...secondaryButtonStyle,
                minHeight: 34,
                padding: "7px 11px",
                borderRadius: 999,
                color: "#0a4f8f",
                fontSize: 12,
              }}
            >
              {showComputationGuide ? "Hide" : "Show"} guide
            </button>
          </div>

          {showComputationGuide ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            <div style={{ borderTop: "1px solid #bae6fd", borderRight: "1px solid #bae6fd", borderBottom: "1px solid #bae6fd", borderLeft: "4px solid #0ea5e9", background: "#f8fbff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 850, color: "#0a4f8f", marginBottom: 5, fontSize: 13 }}>Compensation</div>
              <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.45 }}>
                Basic Pay, Premiums, Allowances, and Adjusted Gross Compensation are clickable for payroll-record breakdowns.
              </div>
            </div>
            <div style={{ borderTop: "1px solid #bbf7d0", borderRight: "1px solid #bbf7d0", borderBottom: "1px solid #bbf7d0", borderLeft: "4px solid #22c55e", background: "#ffffff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 850, color: "#166534", marginBottom: 5, fontSize: 13 }}>Exclusions</div>
              <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.45 }}>
                De minimis benefits, ₱90,000 cap applied, and employee government contributions are clickable.
              </div>
            </div>
            <div style={{ borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #f59e0b", background: "#ffffff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 850, color: "#92400e", marginBottom: 5, fontSize: 13 }}>Monitoring Only</div>
              <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.45 }}>
                Excess Over 90k Cap is highlighted separately so it is visible but not deducted again in taxable compensation.
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e6edf5", borderRight: "1px solid #e6edf5", borderBottom: "1px solid #e6edf5", borderLeft: "4px solid #64748b", background: "#ffffff", borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 850, color: "#0f172a", marginBottom: 5, fontSize: 13 }}>Tax Result</div>
              <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.45 }}>
                Taxable Compensation, Annual Tax Due, Tax Withheld, and Tax Adjustment are clickable for final review.
              </div>
            </div>
          </div>
          ) : null}
        </section>

        <section
          style={{
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid rgba(255, 255, 255, 0.88)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 14px 38px -32px rgba(8, 47, 73, 0.78)",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #e6edf5" }}>
            <div style={{ fontSize: 16, fontWeight: 850 }}>
              Annualization Employee Details
            </div>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 600, marginTop: 3 }}>
              Review each employee computation using the clickable amount pills before confirming tax adjustments.
            </div>
          </div>

          <div style={{ overflow: "auto", maxHeight: "72vh", position: "relative" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 2500 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th
                    style={{
                      ...frozenHeaderColumnStyle,
                      left: 0,
                      minWidth: 110,
                      width: 110,
                      textAlign: "left",
                      padding: "10px 12px",
                      ...tableHeaderCellStyle,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: eligibleVisibleRows.length > 0 ? "pointer" : "not-allowed",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={allEligibleVisibleRowsSelected}
                        disabled={isAnnualizationReadOnly || eligibleVisibleRows.length === 0}
                        onChange={handleToggleAllVisibleSelections}
                      />
                      Select
                    </label>
                  </th>
                  {[
                  { label: "Employee", left: 110, minWidth: 280, frozen: true },
                  { label: "Status", left: 390, minWidth: 110, frozen: true },
                  { label: "Payroll Count", left: 500, minWidth: 150, frozen: true },
                  { label: "Basic Pay", minWidth: 170 },
                  { label: "Premiums", minWidth: 170 },
                  { label: "Allowances", minWidth: 170 },
                  { label: "Adjusted Gross Compensation", minWidth: 260 },
                  { label: "Non-taxable De Minimis Benefits", minWidth: 280 },
                  { label: "Benefits Applied to 90k Cap", minWidth: 280 },
                  { label: "Excess Over 90k Cap", minWidth: 220 },
                  { label: "Gov't Contributions (EE Only)", minWidth: 260 },
                  { label: "Taxable Compensation", minWidth: 220 },
                  { label: "Annual Tax Due", minWidth: 190 },
                  { label: "Tax Withheld", minWidth: 180 },
                  { label: "Tax Adjustment", minWidth: 180 },
                  { label: "Result", minWidth: 190 },
                  { label: "Review", minWidth: 170 },
                  { label: "Notes", minWidth: 260 },
                  ].map((header) => (
                    <th
                      key={header.label}
                      style={{
                        ...(header.frozen ? frozenHeaderColumnStyle : frozenHeaderStyle),
                        left: header.frozen ? header.left : undefined,
                        minWidth: header.minWidth,
                        width: header.minWidth,
                        textAlign: "left",
                        padding: "10px 12px",
                        ...tableHeaderCellStyle,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={`${row.employeeNo}-${row.year}`} style={{ background: row.confirmed ? "#f0f9ff" : "#ffffff" }}>
                      <td
                        style={{
                          ...frozenColumnStyle,
                          left: 0,
                          minWidth: 110,
                          width: 110,
                          ...tableCellStyle,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployeeNos.includes(row.employeeNo)}
                          disabled={isAnnualizationReadOnly || row.adjustmentType === "No Adjustment" || row.confirmed}
                          onChange={() => handleToggleRowSelection(row.employeeNo)}
                        />
                      </td>

                      <td
                        style={{
                          ...frozenColumnStyle,
                          left: 110,
                          minWidth: 280,
                          width: 280,
                          ...tableCellStyle,
                        }}
                      >
                        <div style={{ color: "#0f172a", fontWeight: 800, fontSize: 13 }}>{row.employeeName}</div>
                        <div style={{ color: "#64748b", fontSize: 11 }}>
                          {row.employeeNo} • {row.department}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 11 }}>
                          TIN: {row.tin || "Missing"}
                        </div>
                      </td>

                      <td
                        style={{
                          ...frozenColumnStyle,
                          left: 390,
                          minWidth: 110,
                          width: 110,
                          ...tableCellStyle,
                        }}
                      >
                        {row.employmentStatus}
                      </td>

                      <td
                        style={{
                          ...frozenColumnStyle,
                          left: 500,
                          minWidth: 150,
                          width: 150,
                          ...tableCellStyle,
                        }}
                      >
                        {row.payrollRecordsCount}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdBasicPay, `${row.employeeName} - Basic Pay Computation`, row.ytdBasicPayBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdPremiums, `${row.employeeName} - Premiums Computation`, row.ytdPremiumsBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdAllowances, `${row.employeeName} - Allowances Computation`, row.ytdAllowancesBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdGrossPay, `${row.employeeName} - Adjusted Gross Compensation Computation`, row.ytdGrossPayBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdNonTaxableCompensation, `${row.employeeName} - Non-taxable De Minimis Benefits Computation`, row.ytdNonTaxableCompensationBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdBenefitsAppliedTo90kCap, `${row.employeeName} - Benefits Applied to ₱90,000 Cap Computation`, row.ytdBenefitsAppliedTo90kCapBreakdown)}
                      </td>
                      <td
                        style={{
                          ...tableCellStyle,
                          borderBottom: "1px solid #e6edf5",
                          background: "#fff7ed",
                          color: "#9a3412",
                          fontWeight: 800,
                        }}
                      >
                        {formatCurrency(row.taxableBenefitsExcess)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdMandatoryContributions, `${row.employeeName} - Gov't Contributions Computation`, row.ytdMandatoryContributionsBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdTaxableCompensation, `${row.employeeName} - Taxable Compensation Computation`, row.ytdTaxableCompensationBreakdown)}
                      </td>


                      <td style={{ ...tableCellStyle, fontWeight: 800 }}>
                        {renderBreakdownAmount(row.annualTaxDue, `${row.employeeName} - Annual Tax Due Computation`, row.annualTaxDueBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        {renderBreakdownAmount(row.ytdTaxWithheld, `${row.employeeName} - Tax Withheld Computation`, row.ytdTaxWithheldBreakdown)}
                      </td>

                      <td
                        style={{
                          ...tableCellStyle,
                          fontWeight: 800,
                          color:
                            row.taxAdjustment > 0
                              ? "#b45309"
                              : row.taxAdjustment < 0
                                ? "#166534"
                                : "#475569",
                        }}
                      >
                        {renderBreakdownAmount(Math.abs(row.taxAdjustment), `${row.employeeName} - Tax Adjustment Computation`, row.taxAdjustmentBreakdown)}
                      </td>

                      <td style={tableCellStyle}>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background:
                              row.adjustmentType === "Refund"
                                ? "#dcfce7"
                                : row.adjustmentType === "Additional Deduction"
                                  ? "#fef3c7"
                                  : "#f1f5f9",
                            color:
                              row.adjustmentType === "Refund"
                                ? "#166534"
                                : row.adjustmentType === "Additional Deduction"
                                  ? "#92400e"
                                  : "#475569",
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.adjustmentType}
                        </span>
                      </td>

                      <td style={tableCellStyle}>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: row.reviewStatus === "Ready" ? "#dcfce7" : "#fee2e2",
                            color: row.reviewStatus === "Ready" ? "#166534" : "#991b1b",
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.confirmed
                            ? "Confirmed"
                            : selectedEmployeeNos.includes(row.employeeNo)
                              ? "Selected"
                              : row.reviewStatus}
                        </span>
                      </td>

                      <td
                        style={{
                          ...tableCellStyle,
                          maxWidth: 260,
                          color: "#64748b",
                        }}
                      >
                        {row.reviewNotes.length > 0 ? row.reviewNotes.join(" • ") : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={19} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                      No annualization rows yet. Click Generate / Recompute All.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedBreakdown ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setSelectedBreakdown(null)}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              background: "#ffffff",
              borderRadius: 28,
              border: "1px solid #e2e8f0",
              boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                padding: 24,
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                  {selectedBreakdown.title}
                </div>
                <div style={{ color: "#64748b", marginTop: 6, fontSize: 14 }}>
                  Review the source lines and formula used for this annualization amount.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBreakdown(null)}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: 24, display: "grid", gap: 14 }}>
              <div
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 18,
                  padding: 16,
                  fontWeight: 900,
                  fontSize: 20,
                }}
              >
                Total: {formatCurrency(selectedBreakdown.total)}
              </div>

              {selectedBreakdown.lines.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {selectedBreakdown.lines.map((line, index) => (
                    <div
                      key={`${line}-${index}`}
                      style={{
                        border: line.includes("Total") || line.includes("Annual tax due") ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                        borderRadius: 16,
                        padding: 14,
                        color: line.includes("Total") || line.includes("Annual tax due") ? "#1d4ed8" : "#334155",
                        fontWeight: line.includes("Total") || line.includes("Annual tax due") ? 900 : 700,
                        lineHeight: 1.5,
                        background: line.includes("Total") || line.includes("Annual tax due") ? "#eff6ff" : "#f8fafc",
                      }}
                    >
                      {index + 1}. {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b", fontWeight: 700 }}>
                  No payroll records were included for this computation.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SummaryBox({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "green" | "red" | "blue" | "yellow" | "gray";
}) {
  const toneStyles = {
    default: { background: "#ffffff", border: "#e2e8f0", text: "#0f172a", accent: "#38bdf8" },
    green: { background: "#ffffff", border: "#bbf7d0", text: "#166534", accent: "#22c55e" },
    red: { background: "#ffffff", border: "#fecaca", text: "#9f1239", accent: "#f43f5e" },
    blue: { background: "#ffffff", border: "#bae6fd", text: "#0a4f8f", accent: "#0ea5e9" },
    yellow: { background: "#ffffff", border: "#fde68a", text: "#92400e", accent: "#f59e0b" },
    gray: { background: "#ffffff", border: "#e2e8f0", text: "#475569", accent: "#94a3b8" },
  }[tone];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: toneStyles.background,
        borderTop: `1px solid ${toneStyles.border}`,
        borderRight: `1px solid ${toneStyles.border}`,
        borderBottom: `1px solid ${toneStyles.border}`,
        borderLeft: `4px solid ${toneStyles.accent}`,
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 10px 24px -24px rgba(8,47,73,0.72)",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 6, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</div>
      <div style={{ color: toneStyles.text, fontSize: 16, lineHeight: 1.2, fontWeight: 850 }}>{value}</div>
      {helper ? (
        <div style={{ color: "#64748b", fontSize: 11, marginTop: 5 }}>{helper}</div>
      ) : null}
    </div>
  );
}
