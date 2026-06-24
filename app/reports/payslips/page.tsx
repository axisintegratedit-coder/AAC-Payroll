"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems } from "@/lib/firestore";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit } from "@/lib/auditTrail";

type PayrollAdjustment = {
  id?: string;
  adjustmentLabel?: string;
  adjustmentCategory?: string;
  adjustmentType?: "Addition" | "Deduction" | "Employer Contribution" | string;
  amount?: number | string;
  finalAmount?: number | string;
  netPayEffect?: number | string;
  reason?: string;
  source?: string;
  sourceId?: string;
  createdAt?: string;
  archiveStatus?: "Active" | "Archived";
  archived?: boolean;
};

type PayrollRecord = {
  id: string;
  month?: string;
  year?: string | number;
  employeeNo: string;
  employeeName: string;
  department?: string;
  employmentStatus?: string;

  grossPay?: number | string;
  totalDeductions?: number | string;
  withholdingTax?: number | string;
  employerContributions?: number | string;
  netPay?: number | string;
  adjustedNetPay?: number | string;

  basicPay?: number | string;
  regularPay?: number | string;
  totalPayrollPremium?: number | string;
  totalAllowances?: number | string;
  totalAbsences?: number | string;
  taxableIncome?: number | string;

  customPremiums?: { id?: string; name: string; amount: number | string }[];
  customAllowances?: { id?: string; name: string; amount: number | string }[];
  customDeductions?: { id?: string; name: string; amount: number | string }[];

  payrollFrequency?: string;
  payrollPeriod?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  bulkRunId?: string;
  periodCovered?: string;
  dateFrom?: string;
  dateTo?: string;
  payrollDate?: string;
  createdAt?: string;

  payrollAdjustments?: PayrollAdjustment[];

  taxAnnualizationAdjustment?: number | string;
  yearEndTaxAdjustment?: number | string;
  annualizationTaxAdjustment?: number | string;
  annualizedTaxAdjustment?: number | string;
  finalTaxAdjustment?: number | string;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment" | string;
  taxAnnualizationYear?: string | number;
  taxAnnualizationSource?: string;

  sssEe?: number | string;
  sssEr?: number | string;
  philhealthEe?: number | string;
  philhealthEr?: number | string;
  pagibigEe?: number | string;
  pagibigEr?: number | string;

  sssRegularEe?: number | string;
  sssWispEe?: number | string;
  sssEc?: number | string;

  archiveStatus?: "Active" | "Archived";
};

type Employee = {
  employeeNo: string;
  payslipId?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  employeeName?: string;
  department?: string;
  designation?: string;
  position?: string;
  jobTitle?: string;
  employmentStatus?: string;
  employeeType?: string;
  monthlyRate?: number | string;
  basicPay?: number | string;

  sss?: string;
  sssNumber?: string;
  sssNo?: string;
  tin?: string;
  tinNumber?: string;
  pagibig?: string;
  pagibigNumber?: string;
  pagIbigNumber?: string;
  pagibigNo?: string;
  pagIbigNo?: string;
  hdmfNumber?: string;
  hdmfNo?: string;
  philhealth?: string;
  philhealthNumber?: string;
  philHealthNumber?: string;
  philhealthNo?: string;
  philHealthNo?: string;
  phicNumber?: string;
  phicNo?: string;

  bankName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
};

type CompanyProfile = {
  companyName?: string;
  registeredName?: string;
  businessName?: string;
  tradeName?: string;
  employerName?: string;
  companyAddress?: string;
  registeredAddress?: string;
  businessAddress?: string;
  address?: string;
  logoDataUrl?: string;
  companyLogoDataUrl?: string;
  logo?: string;
};

type PayrollRunApproval = {
  status?: "Draft" | "For Review" | "Checked" | "Approved" | "Locked" | "Returned for Revision" | string;
  approvedAt?: string;
  lockedAt?: string;
};

type YearEndAnnualizationFile = {
  year?: string | number;
  archived?: boolean;
  archiveStatus?: "Active" | "Archived";
};

type PayslipDocument = {
  id: string;
  documentId: string;
  employeeNo: string;
  employeeId: string;
  employeeName: string;
  payrollRecordId: string;
  recordId: string;
  payrollReference: string;
  month: string;
  year: string;
  payrollPeriod: string;
  payPeriod: string;
  period: string;
  payrollDate: string;
  payDate: string;
  grossPay: number;
  totalDeductions: number;
  deductions: number;
  netPay: number;
  finalNetPay: number;
  title: string;
  fileName: string;
  printableHtml: string;
  html: string;
  approvedAt: string;
  status: "Approved";
  createdAt: string;
  generatedAt: string;
};

const PAYROLL_RUN_APPROVALS_KEY = "payrollRunApprovals";
const EMPLOYEE_PAYSLIP_DOCUMENTS_KEY = "employeePayslipDocuments";
const MONTH_ORDER = [
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

const MONTH_NUMBER_BY_NAME = MONTH_ORDER.reduce<Record<string, number>>((map, month, index) => {
  map[month.toLowerCase()] = index + 1;
  return map;
}, {});

function toNumber(value: number | string | undefined | null) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | undefined | null) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatLongDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function firstFilled(...values: Array<string | number | undefined | null>) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "—";
}

function normalizeText(value?: string | number) {
  return String(value ?? "").trim().toLowerCase();
}

function getEmployeeName(employee?: Employee, record?: PayrollRecord) {
  if (employee?.employeeName) return employee.employeeName.toUpperCase();

  const nameFromParts = [employee?.lastName, employee?.firstName, employee?.middleName]
    .filter(Boolean)
    .join(", ")
    .trim();

  return (nameFromParts || record?.employeeName || "—").toUpperCase();
}

function getPosition(employee?: Employee) {
  return firstFilled(employee?.designation, employee?.position, employee?.jobTitle);
}

function getEmployeeRate(employee?: Employee, record?: PayrollRecord) {
  return toNumber(employee?.monthlyRate || employee?.basicPay || record?.basicPay);
}


function getPayrollGroupKey(record: PayrollRecord) {
  const period = String(record.payrollPeriod || "Monthly Payroll").trim();
  return `${record.year || ""}-${record.month || ""}-${period}`;
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

function getPayrollRunIdentityForRecord(record: PayrollRecord, allRecords: PayrollRecord[]) {
  const groupKey = getPayrollGroupKey(record);
  const groupRecords = allRecords.filter((item) => getPayrollGroupKey(item) === groupKey);
  return buildPayrollRunIdentity(groupKey, groupRecords.length > 0 ? groupRecords : [record]);
}

function getApprovalStatusText(approval?: PayrollRunApproval) {
  return normalizeText(approval?.status || "");
}

function isApprovedOrLockedStatus(status: string) {
  return status === "approved" || status === "locked";
}

function getApprovalStatusFromPossibleKeys(
  record: PayrollRecord,
  approvals: Record<string, PayrollRunApproval>,
  allRecords: PayrollRecord[] = []
) {
  const groupKey = getPayrollGroupKey(record);
  const generatedRunIdentity = getPayrollRunIdentityForRecord(record, allRecords.length > 0 ? allRecords : [record]);
  const possibleKeys = [
    generatedRunIdentity,
    record.payrollRunId,
    record.payrollRun,
    record.payrollReference,
    record.bulkRunId,
    record.id,
    groupKey,
  ]
    .filter(Boolean)
    .map(String);

  const directApproval = possibleKeys.map((key) => approvals[key]).find(Boolean);
  if (directApproval) return directApproval;

  const groupApprovalEntry = Object.entries(approvals).find(([key]) =>
    key === groupKey || key.startsWith(`${groupKey}-`)
  );

  return groupApprovalEntry?.[1];
}

function isApprovedRecord(
  record: PayrollRecord,
  approvals: Record<string, PayrollRunApproval>,
  allRecords: PayrollRecord[] = []
) {
  if (record.archiveStatus === "Archived") return false;

  const approval = getApprovalStatusFromPossibleKeys(record, approvals, allRecords);
  const status = getApprovalStatusText(approval);
  if (isApprovedOrLockedStatus(status)) return true;

  const recordStatus = normalizeText((record as PayrollRecord & Record<string, unknown>).status as string);
  const approvalStatus = normalizeText((record as PayrollRecord & Record<string, unknown>).approvalStatus as string);

  return (
    recordStatus.includes("approved") ||
    recordStatus.includes("locked") ||
    approvalStatus.includes("approved") ||
    approvalStatus.includes("locked")
  );
}

function hasActiveYearEndAnnualizationFile(year?: string | number, files: YearEndAnnualizationFile[] = []) {
  const targetYear = String(year || "").trim();
  if (!targetYear) return true;
  if (!Array.isArray(files) || files.length === 0) return true;
  return files.some(
    (file) =>
      String(file.year || "").trim() === targetYear &&
      file.archived !== true &&
      file.archiveStatus !== "Archived"
  );
}

function getRawYearEndTaxAdjustment(record: PayrollRecord) {
  return (
    toNumber(record.taxAnnualizationAdjustment) ||
    toNumber(record.yearEndTaxAdjustment) ||
    toNumber(record.annualizationTaxAdjustment) ||
    toNumber(record.annualizedTaxAdjustment) ||
    toNumber(record.finalTaxAdjustment) ||
    0
  );
}

function getActiveYearEndTaxAdjustment(record: PayrollRecord) {
  const raw = getRawYearEndTaxAdjustment(record);
  if (Math.abs(raw) < 0.01) return 0;

  const year = record.taxAnnualizationYear || record.year;
  if (!hasActiveYearEndAnnualizationFile(year)) return 0;

  return raw;
}

function getFinalNetPay(record: PayrollRecord) {
  const baseNetPay = toNumber(record.netPay);
  const adjustedNetPay = toNumber(record.adjustedNetPay);

  if (Math.abs(adjustedNetPay) >= 0.01) return adjustedNetPay;
  return baseNetPay;
}

function cleanLabel(value: string, wordsToRemove: string[] = []) {
  let label = String(value || "Item")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  wordsToRemove.forEach((word) => {
    label = label.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  });

  return label.replace(/\s+/g, " ").trim() || value || "Item";
}

function normalizeMoneyItems(items?: { id?: string; name: string; amount: number | string }[]) {
  return (items || [])
    .map((item, index) => ({
      id: item.id || `${item.name}-${index}`,
      name: item.name,
      amount: toNumber(item.amount),
    }))
    .filter((item) => Math.abs(item.amount) >= 0.01);
}

function getAllowanceRows(record: PayrollRecord) {
  const source = record as PayrollRecord & Record<string, unknown>;

  const listed = [
    { name: "Rice Subsidy", amount: toNumber(source.riceSubsidy as number) || toNumber(source.riceAllowance as number) || toNumber(source.rice as number) },
    { name: "Uniform / Clothing", amount: toNumber(source.uniformClothing as number) || toNumber(source.uniformClothingAllowance as number) },
    { name: "Laundry Allowance", amount: toNumber(source.laundryAllowance as number) || toNumber(source.laundry as number) },
    { name: "Medical Cash Dependents", amount: toNumber(source.medicalCashDependents as number) || toNumber(source.medicalCashAllowanceToDependents as number) },
    { name: "Actual Medical Assistance", amount: toNumber(source.actualMedicalAssistance as number) },
    { name: "Achievement Awards", amount: toNumber(source.achievementAwards as number) },
    { name: "Christmas / Anniversary Gifts", amount: toNumber(source.christmasAnniversaryGifts as number) },
    { name: "Meal Allowance OT/Night", amount: toNumber(source.mealAllowanceOTNight as number) || toNumber(source.mealAllowance as number) },
    { name: "Monetized Leave", amount: toNumber(source.monetizedLeavePrivate as number) },
    { name: "CBA / Productivity Incentives", amount: toNumber(source.cbaProductivityIncentives as number) },
    { name: "13th Month Pay", amount: toNumber(source.thirteenthMonthPay as number) || toNumber(source.thirteenthMonth as number) },
    { name: "Christmas Bonus", amount: toNumber(source.christmasBonus as number) },
    { name: "Other Taxable Allowances", amount: toNumber(source.otherTaxableAllowances as number) || toNumber(source.otherAllowanceAmount as number) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customAllowances).map((item) => ({
    name: cleanLabel(item.name, ["custom", "allowance"]),
    amount: item.amount,
  }));

  if (listed.length > 0 || custom.length > 0) return [...listed, ...custom];

  const totalAllowances = toNumber(record.totalAllowances);
  return totalAllowances ? [{ name: "Allowances", amount: totalAllowances }] : [];
}

function getPremiumRows(record: PayrollRecord) {
  const source = record as PayrollRecord & Record<string, unknown>;

  const listed = [
    { name: "Night Differential", amount: toNumber(source.nightDifferentialAmount as number) || toNumber(source.nightDifferentialPay as number) },
    { name: "Overtime Pay", amount: toNumber(source.overtimeAmount as number) || toNumber(source.overtimePay as number) },
    { name: "Rest Day / Day Off Work", amount: toNumber(source.restDayAmount as number) },
    { name: "Special Holiday Premium", amount: toNumber(source.specialHolidayAmount as number) || toNumber(source.holidayPayAmount as number) || toNumber(source.holidayPay as number) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customPremiums).map((item) => ({
    name: cleanLabel(item.name, ["custom", "premium"]),
    amount: item.amount,
  }));

  if (listed.length > 0 || custom.length > 0) return [...listed, ...custom];

  const totalPayrollPremium = toNumber(record.totalPayrollPremium);
  return totalPayrollPremium ? [{ name: "Payroll Premiums", amount: totalPayrollPremium }] : [];
}

function getDeductionRows(record: PayrollRecord) {
  const source = record as PayrollRecord & Record<string, unknown>;

  const sssEmployee =
    Math.abs(toNumber(record.sssEe)) >= 0.01
      ? toNumber(record.sssEe)
      : toNumber(record.sssRegularEe) + toNumber(record.sssWispEe);

  const rows = [
    { name: "Tardiness / Absences", amount: toNumber(record.totalAbsences) },
    { name: "Withholding Tax", amount: toNumber(record.withholdingTax) },
    { name: "SSS Employee", amount: sssEmployee },
    { name: "PhilHealth Employee", amount: toNumber(record.philhealthEe) },
    { name: "Pag-IBIG Employee", amount: toNumber(record.pagibigEe) },
    { name: "Payroll Advances", amount: toNumber(source.employeeAdvances as number) },
    { name: "Cash Advances", amount: toNumber(source.cashAdvances as number) },
    { name: "SSS Loan Repayment", amount: toNumber(source.sssLoanRepayment as number) },
    { name: "HDMF Loan Repayment", amount: toNumber(source.hdmfLoanRepayment as number) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customDeductions).map((item) => ({
    name: cleanLabel(item.name, ["custom", "deduction"]),
    amount: item.amount,
  }));

  const yearEnd = getActiveYearEndTaxAdjustment(record);
  const yearEndDeduction = yearEnd < 0 ? [{ name: "Year-End Additional Tax", amount: Math.abs(yearEnd) }] : [];

  return [...rows, ...custom, ...yearEndDeduction];
}

function getYearEndRefundRow(record: PayrollRecord) {
  const adjustment = getActiveYearEndTaxAdjustment(record);
  if (adjustment > 0) return { name: "Year-End Tax Refund", amount: adjustment };
  return null;
}

function getPayrollAdjustmentRows(record: PayrollRecord) {
  const hasRawYearEndTaxAdjustment = Math.abs(getRawYearEndTaxAdjustment(record)) >= 0.01;

  return (record.payrollAdjustments || [])
    .filter((item) => item.archiveStatus !== "Archived" && item.archived !== true)
    .map((item, index) => {
      const amount = toNumber(item.netPayEffect ?? item.finalAmount ?? item.amount);
      const rawLabel = item.adjustmentLabel || item.adjustmentCategory || item.reason || `Payroll Adjustment ${index + 1}`;
      const labelSource = [
        item.adjustmentLabel,
        item.adjustmentCategory,
        item.reason,
        item.source,
        item.sourceId,
        rawLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const isYearEndTaxAdjustment =
        labelSource.includes("year-end") ||
        labelSource.includes("year end") ||
        labelSource.includes("annualization") ||
        labelSource.includes("annualisation") ||
        labelSource.includes("tax adjustment") ||
        labelSource.includes("tax annual");

      const isGenericPayrollAdjustment = /^payroll adjustment\s*\d*$/i.test(rawLabel.trim());
      const shouldTreatAsYearEndTaxAdjustment =
        isYearEndTaxAdjustment || (isGenericPayrollAdjustment && hasRawYearEndTaxAdjustment);

      if (shouldTreatAsYearEndTaxAdjustment) {
        return null;
      }

      return { name: rawLabel, amount };
    })
    .filter((item): item is { name: string; amount: number } => item !== null && Math.abs(item.amount) >= 0.01);
}

function getPayrollDate(record: PayrollRecord) {
  return record.payrollDate || record.createdAt || "";
}

function getRecordTaxYear(record: PayrollRecord) {
  const source = record as PayrollRecord & Record<string, unknown>;

  const explicitYear = String(record.year || "").trim();
  if (/^20\d{2}$/.test(explicitYear)) return explicitYear;

  const monthYear = String(source.monthYear || "").trim();
  const monthYearMatch = monthYear.match(/20\d{2}/);
  if (monthYearMatch) return monthYearMatch[0];

  const periodText = String(
    record.payrollReference ||
      record.payrollRun ||
      record.payrollRunId ||
      record.payrollPeriod ||
      ""
  ).trim();
  const periodMatch = periodText.match(/20\d{2}/);
  if (periodMatch) return periodMatch[0];

  const payrollDate = String(record.payrollDate || "").trim();
  const payrollDateMatch = payrollDate.match(/20\d{2}/);
  return payrollDateMatch ? payrollDateMatch[0] : "";
}

function getRecordMonthNumber(record: PayrollRecord) {
  const source = record as PayrollRecord & Record<string, unknown>;

  const monthName = String(record.month || "").trim().toLowerCase();
  if (MONTH_NUMBER_BY_NAME[monthName]) return MONTH_NUMBER_BY_NAME[monthName];

  const monthYear = String(source.monthYear || "").trim();
  const monthYearMatch = monthYear.match(/^20\d{2}-(\d{2})/);
  if (monthYearMatch) return Number(monthYearMatch[1]);

  const text = normalizeText(
    `${record.payrollReference || ""} ${record.payrollRun || ""} ${record.payrollPeriod || ""}`
  );
  const monthFromText = Object.entries(MONTH_NUMBER_BY_NAME).find(([month]) => text.includes(month));
  if (monthFromText) return monthFromText[1];

  const payrollDate = new Date(record.payrollDate || "");
  if (!Number.isNaN(payrollDate.getTime())) return payrollDate.getMonth() + 1;

  return 0;
}

function getPayrollCutoffOrder(record: PayrollRecord) {
  const period = normalizeText(getPayPeriod(record));

  if (period.includes("first") || period.includes("1st") || period.includes("cutoff 1") || period.includes("week 1")) return 1;
  if (period.includes("second") || period.includes("2nd") || period.includes("cutoff 2") || period.includes("week 2")) return 2;
  if (period.includes("third") || period.includes("3rd") || period.includes("cutoff 3") || period.includes("week 3")) return 3;
  if (period.includes("fourth") || period.includes("4th") || period.includes("cutoff 4") || period.includes("week 4")) return 4;

  return 1;
}

function getPayrollPeriodSortValue(record: PayrollRecord) {
  const monthNumber = getRecordMonthNumber(record);
  const cutoffOrder = getPayrollCutoffOrder(record);
  return monthNumber * 10 + cutoffOrder;
}

function getPayrollPeriodAbsoluteSortValue(record: PayrollRecord) {
  const year = Number(getRecordTaxYear(record));
  const monthNumber = getRecordMonthNumber(record);
  const cutoffOrder = getPayrollCutoffOrder(record);

  if (!year || !monthNumber) return 0;
  return year * 1000 + monthNumber * 10 + cutoffOrder;
}

function getPayPeriod(record: PayrollRecord) {
  return record.payrollPeriod || record.payrollRun || record.payrollReference || "Payroll Period";
}

function getPayCoverage(record: PayrollRecord) {
  if (record.periodCovered) return record.periodCovered;
  if (record.dateFrom && record.dateTo) return `${formatLongDate(record.dateFrom)} - ${formatLongDate(record.dateTo)}`;
  return getPayPeriod(record);
}

function getYtdRecords(current: PayrollRecord, allRecords: PayrollRecord[]) {
  const currentEmployee = current.employeeNo;
  const currentSortValue = getPayrollPeriodAbsoluteSortValue(current);

  return allRecords
    .filter((record) => {
      if (record.employeeNo !== currentEmployee) return false;
      if (record.archiveStatus === "Archived") return false;

      const recordSortValue = getPayrollPeriodAbsoluteSortValue(record);
      if (!recordSortValue || !currentSortValue) return false;

      return recordSortValue <= currentSortValue;
    })
    .sort((a, b) => getPayrollPeriodAbsoluteSortValue(a) - getPayrollPeriodAbsoluteSortValue(b));
}

function sum(records: PayrollRecord[], getter: (record: PayrollRecord) => number) {
  return records.reduce((total, record) => total + getter(record), 0);
}

function getYtdForNamedRow(current: PayrollRecord, allRecords: PayrollRecord[], rowName: string, type: "earning" | "deduction") {
  const ytdRecords = getYtdRecords(current, allRecords);

  return ytdRecords.reduce((total, record) => {
    const rows =
      type === "earning"
        ? [
            { name: "REG BASIC", amount: toNumber(record.basicPay || record.regularPay) },
            ...getAllowanceRows(record),
            ...getPremiumRows(record),
            ...(getYearEndRefundRow(record) ? [getYearEndRefundRow(record)!] : []),
            ...getPayrollAdjustmentRows(record).filter((item) => item.amount > 0),
          ]
        : [
            ...getDeductionRows(record),
            ...getPayrollAdjustmentRows(record).filter((item) => item.amount < 0).map((item) => ({
              ...item,
              amount: Math.abs(item.amount),
            })),
          ];

    const normalizedTarget = normalizeText(rowName);
    const matched = rows.find((row) => normalizeText(row.name) === normalizedTarget);

    return total + (matched?.amount || 0);
  }, 0);
}


function buildEmployeePayslipDocument(record: PayrollRecord, printableHtml = ""): PayslipDocument {
  const now = new Date().toISOString();
  const payrollReference = record.payrollReference || record.payrollRun || record.id;
  const payrollPeriod = getPayPeriod(record);
  const payrollDate = getPayrollDate(record);
  const fileName = buildSafeFilename(
    `Payslip-${record.employeeNo}-${record.month || ""}-${record.year || ""}-${payrollPeriod}`
  );

  return {
    id: `PAYSLIP-${record.id}`,
    documentId: `PAYSLIP-${record.id}`,
    employeeNo: record.employeeNo,
    employeeId: record.employeeNo,
    employeeName: record.employeeName,
    payrollRecordId: record.id,
    recordId: record.id,
    payrollReference,
    month: String(record.month || ""),
    year: String(record.year || ""),
    payrollPeriod,
    payPeriod: payrollPeriod,
    period: payrollPeriod,
    payrollDate,
    payDate: payrollDate,
    grossPay: toNumber(record.grossPay),
    totalDeductions: toNumber(record.totalDeductions),
    deductions: toNumber(record.totalDeductions),
    netPay: getFinalNetPay(record),
    finalNetPay: getFinalNetPay(record),
    title: payrollReference,
    fileName,
    printableHtml,
    html: printableHtml,
    approvedAt: now,
    status: "Approved",
    createdAt: now,
    generatedAt: now,
  };
}

async function saveEmployeePayslipDocuments(documents: PayslipDocument[]) {
  if (typeof window === "undefined") return;

  const existing = await getDataArray<PayslipDocument>(EMPLOYEE_PAYSLIP_DOCUMENTS_KEY, []);
  const safeExisting = Array.isArray(existing) ? existing : [];
  const nextIds = new Set(documents.map((document) => document.id));
  const preserved = safeExisting.filter((document) => !nextIds.has(document.id));
  const nextDocuments = [...preserved, ...documents];

  await setDataArray(EMPLOYEE_PAYSLIP_DOCUMENTS_KEY, nextDocuments);

  window.dispatchEvent(new Event(`${EMPLOYEE_PAYSLIP_DOCUMENTS_KEY}-updated`));
}


function buildSafeFilename(value: string) {
  return value.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

function getPrintableDocumentHead() {
  return `
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: Arial, Helvetica, sans-serif;
      }

      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 9999;
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 14px;
        background: #0f172a;
      }

      .print-toolbar button {
        border: 0;
        border-radius: 12px;
        padding: 11px 18px;
        font-weight: 900;
        cursor: pointer;
      }

      .print-primary {
        background: #1d4ed8;
        color: #ffffff;
      }

      .print-secondary {
        background: #ffffff;
        color: #0f172a;
      }

      .print-shell {
        width: 297mm;
        min-height: 210mm;
        margin: 0 auto;
        background: #ffffff;
      }

      .payslip-page {
        width: 297mm !important;
        height: 210mm !important;
        margin: 0 auto !important;
        padding: 3mm 8mm 4mm !important;
        box-shadow: none !important;
        overflow: hidden !important;
        background: #ffffff !important;
        color: #0f172a !important;
        font-size: 10px !important;
      }

      .payslip-page img {
        width: 54px !important;
        height: 42px !important;
        max-width: 54px !important;
        max-height: 42px !important;
        object-fit: contain !important;
        display: block !important;
      }

      .grid { display: grid; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .leading-tight { line-height: 1.15; }
      .justify-between { justify-content: space-between; }
      .place-items-center { place-items: center; }
      .items-start { align-items: flex-start; }
      .object-contain { object-fit: contain; }
      .w-full { width: 100%; }
      .bg-white { background: #ffffff !important; }
      .bg-sky-100 { background: #e0f2fe !important; }
      .bg-sky-300 { background: #7dd3fc !important; }
      .text-white { color: #ffffff !important; }
      .text-slate-900 { color: #0f172a !important; }
      .text-slate-500 { color: #64748b !important; }
      .text-sky-700 { color: #0369a1 !important; }
      .font-bold { font-weight: 700; }
      .font-black { font-weight: 900; }
      .uppercase { text-transform: uppercase; }
      .text-left { text-align: left; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .border { border: 1px solid #7dd3fc; }
      .border-sky-300 { border-color: #7dd3fc !important; }
      .border-b { border-bottom: 1px solid #7dd3fc; }
      .border-b-\[3px\] { border-bottom: 3px solid #7dd3fc; }
      .border-t-\[3px\] { border-top: 3px solid #7dd3fc; }
      .rounded-xl { border-radius: 12px; }
      .gap-1 { gap: 4px; }
      .gap-1\.5 { gap: 6px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 10px; }
      .gap-4 { gap: 16px; }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .grid-cols-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
      .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .grid-cols-\[64px_1fr_220px\] { grid-template-columns: 64px 1fr 220px; }
      .grid-cols-\[72px_1fr\] { grid-template-columns: 72px 1fr; }
      .grid-cols-\[120px_1fr\] { grid-template-columns: 120px 1fr; }
      .grid-cols-\[1\.08fr_0\.98fr\] { grid-template-columns: 1.08fr 0.98fr; }
      .h-\[42px\] { height: 42px; }
      .w-\[54px\] { width: 54px; }
      .text-\[8px\] { font-size: 8px; }
      .text-\[10px\] { font-size: 10px; }
      .text-\[10\.5px\] { font-size: 10.5px; }
      .text-\[18px\] { font-size: 18px; }
      .h-\[48px\] { height: 48px; }
      .w-\[60px\] { width: 60px; }
      .text-\[9px\] { font-size: 9px; }
      .text-\[11px\] { font-size: 11px; }
      .text-\[12px\] { font-size: 12px; }
      .text-\[21px\] { font-size: 21px; }
      .text-\[\#0f4c81\] { color: #0f4c81 !important; }
      .tracking-\[0\.35em\] { letter-spacing: 0.35em; }
      .p-2 { padding: 8px; }
      .px-2 { padding-left: 8px; padding-right: 8px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .py-2 { padding-top: 8px; padding-bottom: 8px; }
      .py-\[2px\] { padding-top: 2px; padding-bottom: 2px; }
      .pt-\[2px\] { padding-top: 2px; }
      .pb-2 { padding-bottom: 8px; }
      .pt-1 { padding-top: 4px; }
      .mt-1 { margin-top: 4px; }
      .mt-2 { margin-top: 8px; }
      .mt-3 { margin-top: 12px; }

      table {
        border-collapse: collapse;
      }

      th,
      td {
        line-height: 1.18;
        vertical-align: top;
      }

      .payslip-page table th,
      .payslip-page table td {
        padding-top: 2px !important;
        padding-bottom: 2px !important;
      }

      .payslip-page .border-b-\[3px\] {
        border-bottom-width: 2px !important;
      }

      .payslip-page .border-t-\[3px\] {
        border-top-width: 2px !important;
      }

      @media print {
        .print-toolbar {
          display: none !important;
        }

        .print-shell {
          width: 297mm !important;
          min-height: 210mm !important;
          margin: 0 !important;
        }

        .payslip-page {
          width: 297mm !important;
          height: 210mm !important;
          page-break-after: always !important;
        }
      }
    </style>
  `;
}

function buildPrintablePayslipHtml(title: string, payslipMarkup: string) {
  return `<!doctype html>
<html>
  <head>
    <title>${title}</title>
    ${getPrintableDocumentHead()}
  </head>
  <body onload="setTimeout(() => window.focus(), 150)">
    <div class="print-toolbar">
      <button class="print-primary" onclick="window.print()">Print / Save as PDF</button>
      <button class="print-secondary" onclick="window.close()">Close</button>
    </div>
    <main class="print-shell">
      ${payslipMarkup}
    </main>
  </body>
</html>`;
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-black uppercase tracking-[0.08em] text-slate-600">{children}</div>;
}

function FieldSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
    />
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
    />
  );
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

function PayslipPage({
  company,
  employee,
  record,
  allApprovedRecords,
  includeYtd,
}: {
  company: CompanyProfile;
  employee?: Employee;
  record: PayrollRecord;
  allApprovedRecords: PayrollRecord[];
  includeYtd: boolean;
}) {
  const companyName =
    company.companyName ||
    company.registeredName ||
    company.businessName ||
    company.tradeName ||
    company.employerName ||
    "Company Name";

  const companyAddress =
    company.companyAddress ||
    company.registeredAddress ||
    company.businessAddress ||
    company.address ||
    "Company Address";

  const logo = company.logoDataUrl || company.companyLogoDataUrl || company.logo || "";

  const basicPay = toNumber(record.basicPay || record.regularPay);
  const netPay = getFinalNetPay(record);

  const earningRows = [
    { name: "REG BASIC", current: basicPay },
    ...getAllowanceRows(record).map((row) => ({ name: row.name.toUpperCase(), current: row.amount })),
    ...getPremiumRows(record).map((row) => ({ name: row.name.toUpperCase(), current: row.amount })),
    ...(getYearEndRefundRow(record)
      ? [{ name: getYearEndRefundRow(record)!.name.toUpperCase(), current: getYearEndRefundRow(record)!.amount }]
      : []),
    ...getPayrollAdjustmentRows(record)
      .filter((item) => item.amount > 0)
      .map((item) => ({ name: item.name.toUpperCase(), current: item.amount })),
  ].filter((row) => Math.abs(row.current) >= 0.01);

  const deductionRows = [
    ...getDeductionRows(record).map((row) => ({ name: row.name.toUpperCase(), current: row.amount })),
    ...getPayrollAdjustmentRows(record)
      .filter((item) => item.amount < 0)
      .map((item) => ({ name: item.name.toUpperCase(), current: Math.abs(item.amount) })),
  ].filter((row) => Math.abs(row.current) >= 0.01);

  const currentEarningsTotal = earningRows.reduce((total, row) => total + row.current, 0);
  const currentDeductionsTotal = deductionRows.reduce((total, row) => total + row.current, 0);

  const ytdRecords = getYtdRecords(record, allApprovedRecords);
  const ytdRecordIds = new Set(ytdRecords.map((item) => item.id));
  const ytdEarnings = sum(ytdRecords, (item) => {
    const itemBasicPay = toNumber(item.basicPay || item.regularPay);
    const itemEarnings = [
      { name: "REG BASIC", amount: itemBasicPay },
      ...getAllowanceRows(item),
      ...getPremiumRows(item),
      ...(getYearEndRefundRow(item) ? [getYearEndRefundRow(item)!] : []),
      ...getPayrollAdjustmentRows(item).filter((adjustment) => adjustment.amount > 0),
    ];

    return itemEarnings.reduce((total, row) => total + row.amount, 0);
  });
  const ytdDeductions = sum(ytdRecords, (item) => {
    const itemDeductions = [
      ...getDeductionRows(item),
      ...getPayrollAdjustmentRows(item)
        .filter((adjustment) => adjustment.amount < 0)
        .map((adjustment) => ({ ...adjustment, amount: Math.abs(adjustment.amount) })),
    ];

    return itemDeductions.reduce((total, row) => total + row.amount, 0);
  });
  const ytdNetPay = sum(ytdRecords, (item) => getFinalNetPay(item));

  return (
    <article
      className="payslip-page bg-white text-[11px] text-slate-900"
      style={{
        width: "297mm",
        height: "210mm",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "3mm 8mm 4mm",
      }}
    >
      <div className="grid grid-cols-[64px_1fr_220px] items-center gap-3 border-b-[3px] border-sky-300 pb-2">
        {logo ? (
          <img
            src={logo}
            alt="Company Logo"
            className="h-[42px] w-[54px] object-contain"
            style={{ width: 54, height: 42, maxWidth: 54, maxHeight: 42, objectFit: "contain" }}
          />
        ) : (
          <div className="grid h-[42px] w-[54px] place-items-center rounded-xl bg-sky-100 text-[8px] font-black text-sky-700">
            LOGO
          </div>
        )}

        <div>
          <div className="text-[18px] font-black text-[#0f4c81]">{companyName}</div>
          <div className="mt-1 text-[10px] text-slate-900">{companyAddress}</div>
        </div>

        <div className="text-right text-[10px]">
          <div className="font-black uppercase text-slate-900">Payslip</div>
          <div><strong>Pay Date:</strong> {formatDate(getPayrollDate(record))}</div>
          <div><strong>Pay Period:</strong> {getPayPeriod(record)}</div>
        </div>
      </div>

      <div className="border-b-[3px] border-sky-300 py-1">
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1">
            <CompactInfo label="Employee Name" value={getEmployeeName(employee, record)} />
            <CompactInfo label="Employee Code" value={employee?.payslipId || record.employeeNo} />
          </div>
          <div className="grid gap-1">
            <CompactInfo label="Department" value={record.department || employee?.department || "—"} />
            <CompactInfo label="Position" value={getPosition(employee)} />
          </div>
          <div className="grid gap-1">
            <CompactInfo label="Monthly Rate" value={money(getEmployeeRate(employee, record))} />
            <CompactInfo label="Employment Type" value={record.employmentStatus || employee?.employmentStatus || employee?.employeeType || "—"} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 py-1">
        <CompactInfo label="SSS No." value={firstFilled(employee?.sssNumber, employee?.sssNo, employee?.sss)} />
        <CompactInfo label="TIN" value={firstFilled(employee?.tin, employee?.tinNumber)} />
        <CompactInfo label="Pag-IBIG No." value={firstFilled(employee?.pagibig, employee?.pagibigNumber, employee?.pagIbigNumber, employee?.pagibigNo, employee?.pagIbigNo, employee?.hdmfNumber, employee?.hdmfNo)} />
        <CompactInfo label="PhilHealth No." value={firstFilled(employee?.philhealth, employee?.philhealthNumber, employee?.philHealthNumber, employee?.philhealthNo, employee?.philHealthNo, employee?.phicNumber, employee?.phicNo)} />
      </div>

      <div className="grid grid-cols-[1.08fr_0.98fr] gap-3" style={{ marginTop: 0 }}>
        <div>
          <SectionTitle>EARNINGS</SectionTitle>
          <table className="w-full border border-sky-300 text-[10px]">
            <thead>
              <tr>
                <TableHead>Description</TableHead>
                <TableHead align="right">Current</TableHead>
                {includeYtd ? <TableHead align="right">YTD</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {earningRows.map((row) => (
                <tr key={`earning-${row.name}`}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell align="right">{money(row.current)}</TableCell>
                  {includeYtd ? (
                    <TableCell align="right">{money(getYtdForNamedRow(record, allApprovedRecords.filter((item) => ytdRecordIds.has(item.id)), row.name, "earning"))}</TableCell>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>

          <SectionTitle className="mt-2">CURRENT TOTALS</SectionTitle>
          <div className="grid grid-cols-3 border border-sky-300 p-2">
            <Total label="Earnings" value={money(currentEarningsTotal)} />
            <Total label="Deductions" value={money(currentDeductionsTotal)} />
            <Total label="Net Pay" value={money(netPay)} />
          </div>
        </div>

        <div>
          <SectionTitle>DEDUCTIONS</SectionTitle>
          <table className="w-full border border-sky-300 text-[10px]">
            <thead>
              <tr>
                <TableHead>Description</TableHead>
                <TableHead align="right">Current</TableHead>
                {includeYtd ? <TableHead align="right">YTD</TableHead> : null}
              </tr>
            </thead>
            <tbody>
              {deductionRows.length > 0 ? (
                deductionRows.map((row) => (
                  <tr key={`deduction-${row.name}`}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell align="right">{money(row.current)}</TableCell>
                    {includeYtd ? (
                      <TableCell align="right">{money(getYtdForNamedRow(record, allApprovedRecords.filter((item) => ytdRecordIds.has(item.id)), row.name, "deduction"))}</TableCell>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <TableCell>No deductions</TableCell>
                  <TableCell align="right">—</TableCell>
                  {includeYtd ? <TableCell align="right">—</TableCell> : null}
                </tr>
              )}
            </tbody>
          </table>

          <SectionTitle className="mt-2">LOANS</SectionTitle>
          <table className="w-full border border-sky-300 text-[10px]">
            <thead>
              <tr>
                <TableHead>Loan Type</TableHead>
                <TableHead align="right">Loan Amount</TableHead>
                <TableHead align="right">Amount Paid</TableHead>
                <TableHead align="right">Balance</TableHead>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TableCell>No loans</TableCell>
                <TableCell align="right">—</TableCell>
                <TableCell align="right">—</TableCell>
                <TableCell align="right">—</TableCell>
              </tr>
            </tbody>
          </table>

          <SectionTitle className="mt-2">YTD TOTALS</SectionTitle>
          <div className="grid grid-cols-3 border border-sky-300 p-2">
            <Total label="Earnings" value={money(ytdEarnings)} />
            <Total label="Deductions" value={money(ytdDeductions)} />
            <Total label="Net Pay" value={money(ytdNetPay)} />
          </div>
        </div>
      </div>

      <SectionTitle className="mt-2">DIRECT DEPOSIT</SectionTitle>
      <table className="w-full border border-sky-300 text-[10px]">
        <thead>
          <tr>
            <TableHead>Bank Account</TableHead>
            <TableHead>Account Number</TableHead>
            <TableHead>Account Type</TableHead>
            <TableHead align="right">Amount</TableHead>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>{employee?.bankName || "—"}</TableCell>
            <TableCell>{employee?.bankAccountNumber || "—"}</TableCell>
            <TableCell>{employee?.bankAccountType || "Payroll"}</TableCell>
            <TableCell align="right">{money(netPay)}</TableCell>
          </tr>
        </tbody>
      </table>

      <div className="mt-1 flex justify-between border-t-[3px] border-sky-300 pt-1 text-[8px] font-bold text-slate-500">
        <span>Payroll Reference: {record.payrollReference || record.payrollRun || record.id}</span>
        <span>CONFIDENTIAL</span>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span>{label} :</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function CompactInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1 text-[10px]" style={{ lineHeight: 1.15 }}>
      <span className="font-bold text-slate-900">{label}:</span>
      <strong className="font-black text-slate-900">{value || "—"}</strong>
    </div>
  );
}

function SmallInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-black">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`bg-sky-300 px-2 py-[2px] text-center text-[10px] font-black uppercase tracking-[0.25em] text-white ${className}`}>
      {children}
    </div>
  );
}

function TableHead({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`border-b border-sky-300 px-2 py-[2px] font-black ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function TableCell({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className={`border-b border-sky-300 px-2 py-[2px] ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-black">{label}</div>
      <div>{value}</div>
    </div>
  );
}

export default function PayslipsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [approvals, setApprovals] = useState<Record<string, PayrollRunApproval>>({});
  const [company, setCompany] = useState<CompanyProfile>({});

  const [selectedMonth, setSelectedMonth] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedEmploymentStatus, setSelectedEmploymentStatus] = useState("ALL");
  const [selectedEmployee, setSelectedEmployee] = useState("ALL");
  const [search, setSearch] = useState("");
  const [includeYtd, setIncludeYtd] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      const [employees, records, approvals, company] = await Promise.all([
        getCollectionItems<Employee>(storageKeys.employees),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getConfigItem<Record<string, PayrollRunApproval>>(PAYROLL_RUN_APPROVALS_KEY, {}),
        getConfigItem<CompanyProfile>(storageKeys.companyInformation, {}),
      ]);
      setEmployees(employees);
      setRecords(records);
      setApprovals(approvals || {});
      setCompany(company || {});
    }

    load();
    window.addEventListener("payroll-records-updated", load as EventListener);
    window.addEventListener("payroll-run-approvals-updated", load as EventListener);

    return () => {
      window.removeEventListener("payroll-records-updated", load as EventListener);
      window.removeEventListener("payroll-run-approvals-updated", load as EventListener);
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

  const approvedRecords = useMemo(() => {
    return records.filter((record) => isApprovedRecord(record, approvals, records));
  }, [records, approvals]);

  const options = useMemo(() => {
    return {
      months: MONTH_ORDER.filter((month) =>
        records.some((record) => String(record.month || "") === month)
      ),
      years: Array.from(new Set(records.map((record) => String(record.year || "")).filter(Boolean)))
        .sort((a, b) => Number(b) - Number(a)),
      periods: Array.from(new Set(approvedRecords.map((record) => getPayPeriod(record)).filter(Boolean))).sort(),
      departments: Array.from(new Set(approvedRecords.map((record) => String(record.department || "")).filter(Boolean))).sort(),
      statuses: Array.from(new Set(approvedRecords.map((record) => String(record.employmentStatus || "")).filter(Boolean))).sort(),
    };
  }, [approvedRecords, records]);

  const filteredRecords = useMemo(() => {
    return approvedRecords.filter((record) => {
      const employee = employees.find((item) => item.employeeNo === record.employeeNo);
      const employeeName = getEmployeeName(employee, record);

      const matchesMonth = selectedMonth === "ALL" || record.month === selectedMonth;
      const matchesYear = selectedYear === "ALL" || String(record.year || "") === selectedYear;
      const matchesPeriod = selectedPeriod === "ALL" || getPayPeriod(record) === selectedPeriod;
      const matchesDepartment = selectedDepartment === "ALL" || record.department === selectedDepartment;
      const matchesStatus = selectedEmploymentStatus === "ALL" || record.employmentStatus === selectedEmploymentStatus;
      const matchesEmployee = selectedEmployee === "ALL" || record.employeeNo === selectedEmployee;
      const matchesSearch =
        !search.trim() ||
        normalizeText(employeeName).includes(normalizeText(search)) ||
        normalizeText(record.employeeNo).includes(normalizeText(search));

      return matchesMonth && matchesYear && matchesPeriod && matchesDepartment && matchesStatus && matchesEmployee && matchesSearch;
    });
  }, [
    approvedRecords,
    employees,
    search,
    selectedDepartment,
    selectedEmployee,
    selectedEmploymentStatus,
    selectedMonth,
    selectedPeriod,
    selectedYear,
  ]);

  useEffect(() => {
    const visible = new Set(filteredRecords.map((record) => record.id));
    setSelectedIds((current) => current.filter((id) => visible.has(id)));
  }, [filteredRecords]);

  // Automatically save every approved payslip that appears in the Payslips tab into employeePayslipDocuments
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Array.isArray(filteredRecords) || filteredRecords.length === 0) return;

    const timer = window.setTimeout(() => {
      const autoSavedDocuments = filteredRecords.map((record) => {
        return buildEmployeePayslipDocument(record, "");
      });

      saveEmployeePayslipDocuments(autoSavedDocuments);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [filteredRecords]);

  const selectedRecords = filteredRecords.filter((record) => selectedIds.includes(record.id));

  function getEmployee(record: PayrollRecord) {
    return employees.find((item) => item.employeeNo === record.employeeNo);
  }

  function toggleAll() {
    if (selectedIds.length === filteredRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRecords.map((record) => record.id));
    }
  }

  function toggleRecord(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function exportRecordAsPdf(record: PayrollRecord) {
    setBusy(true);

    try {
      const element = document.querySelector<HTMLElement>(`[data-payslip-id="${record.id}"] .payslip-page`);
      if (!element) throw new Error("Payslip page not found.");

      const title = buildSafeFilename(
        `Payslip-${record.employeeNo}-${record.month || ""}-${record.year || ""}-${getPayPeriod(record)}`
      );
      const html = buildPrintablePayslipHtml(title, element.outerHTML);
      saveEmployeePayslipDocuments([buildEmployeePayslipDocument(record, html)]);
      const payslipWindow = window.open("", "_blank");

      if (!payslipWindow) {
        window.alert("Please allow pop-ups to view or print the payslip.");
        return;
      }

      logAudit({
        action: "PRINTED",
        entityType: "Report_Payslip",
        entityId: `${record.employeeNo}-${record.year}-${record.month}-${record.payrollPeriod || ""}`,
        entityName: `Payslip ${record.employeeName || record.employeeNo} ${record.month || ""} ${record.year || ""}`,
        details: "Opened for print/PDF",
      });
      payslipWindow.document.open();
      payslipWindow.document.write(html);
      payslipWindow.document.close();
    } catch (error) {
      console.error(error);
      window.alert("Unable to open this payslip right now.");
    } finally {
      setBusy(false);
    }
  }

  async function exportPayslipsToExcel(recordsToExport: PayrollRecord[]) {
    if (recordsToExport.length === 0) {
      window.alert("Please select at least one payslip.");
      return;
    }

    setBusy(true);

    try {
      const ExcelJS = (await import("exceljs")).default;
      const { saveAs } = await import("file-saver");
      const wb = new ExcelJS.Workbook();

      const numFmt = "#,##0.00";

      function addPayslipSheet(record: PayrollRecord) {
        const employee = getEmployee(record);
        const safeName = `${record.employeeNo || "EMP"}_${getPayPeriod(record)}`
          .replace(/[/\\?*[\]:]/g, "-")
          .slice(0, 31);
        const ws = wb.addWorksheet(safeName);

        ws.getColumn("A").width = 38;
        ws.getColumn("B").width = 20;

        function row(a: string | number, b?: string | number, style?: {
          bold?: boolean;
          fillArgb?: string;
          fontColor?: string;
          fontSize?: number;
          mergeAB?: boolean;
          alignA?: "left" | "center" | "right";
          alignB?: "left" | "center" | "right";
          borderTop?: boolean;
          borderBottom?: boolean;
        }) {
          const r = ws.addRow([a, b ?? ""]);
          const opts = style ?? {};
          const cellA = r.getCell(1);
          const cellB = r.getCell(2);

          if (opts.mergeAB) {
            ws.mergeCells(r.number, 1, r.number, 2);
            cellA.alignment = { horizontal: opts.alignA ?? "center", vertical: "middle", wrapText: true };
          } else {
            cellA.alignment = { horizontal: opts.alignA ?? "left", vertical: "middle" };
            cellB.alignment = { horizontal: opts.alignB ?? "right", vertical: "middle" };
          }

          const fontBase = { name: "Calibri", size: opts.fontSize ?? 11 };

          if (opts.fillArgb) {
            const fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: opts.fillArgb } };
            cellA.fill = fill;
            cellB.fill = fill;
          }

          if (opts.bold) {
            cellA.font = { ...fontBase, bold: true, color: { argb: opts.fontColor ?? "FF111827" } };
            cellB.font = { ...fontBase, bold: true, color: { argb: opts.fontColor ?? "FF111827" } };
          } else {
            cellA.font = { ...fontBase, color: { argb: opts.fontColor ?? "FF334155" } };
            cellB.font = { ...fontBase, color: { argb: opts.fontColor ?? "FF334155" } };
          }

          const borderStyle = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
          if (opts.borderTop || opts.borderBottom) {
            [cellA, cellB].forEach((c) => {
              c.border = {
                top: opts.borderTop ? borderStyle : undefined,
                bottom: opts.borderBottom ? borderStyle : undefined,
              };
            });
          }

          r.height = 18;
          return r;
        }

        function amtRow(label: string, amount: number, style?: Parameters<typeof row>[2]) {
          const r = row(label, amount, style);
          r.getCell(2).numFmt = numFmt;
          return r;
        }

        function sectionHeader(label: string, fillArgb: string) {
          const r = row(label, "", { bold: true, fillArgb, fontColor: "FFFFFFFF", mergeAB: true, alignA: "center" });
          r.height = 20;
          return r;
        }

        function emptyRow() {
          ws.addRow([]);
        }

        // Title
        const titleRow = row("PAYSLIP", undefined, { bold: true, fontSize: 16, mergeAB: true, fillArgb: "FF0F4C81", fontColor: "FFFFFFFF" });
        titleRow.height = 30;

        row(getPayPeriod(record), undefined, { mergeAB: true, fillArgb: "FF1E40AF", fontColor: "FFE0F2FE", fontSize: 10 });
        if (record.payrollReference) {
          row(`Ref: ${record.payrollReference}`, undefined, { mergeAB: true, fillArgb: "FF1E40AF", fontColor: "FF93C5FD", fontSize: 9 });
        }

        emptyRow();

        // Employee info
        sectionHeader("EMPLOYEE INFORMATION", "FF334155");
        row("Employee Name", getEmployeeName(employee, record), { bold: false, fillArgb: "FFF8FAFC", borderBottom: true });
        row("Employee No.", record.employeeNo || "—", { fillArgb: "FFFFFFFF", borderBottom: true });
        row("Department", record.department || employee?.department || "—", { fillArgb: "FFF8FAFC", borderBottom: true });
        row("Position", getPosition(employee), { fillArgb: "FFFFFFFF", borderBottom: true });
        if (employee?.bankName) {
          row("Bank", employee.bankName, { fillArgb: "FFF8FAFC", borderBottom: true });
        }
        row("Pay Date", formatDate(getPayrollDate(record)), { fillArgb: "FFFFFFFF", borderBottom: true });

        emptyRow();

        // Earnings
        const basicPay = toNumber(record.basicPay || record.regularPay);
        const allowanceRows = getAllowanceRows(record);
        const premiumRows = getPremiumRows(record);
        const yearEndRefund = getYearEndRefundRow(record);
        const adjRows = getPayrollAdjustmentRows(record);
        const earningAdj = adjRows.filter((a) => a.amount > 0);

        sectionHeader("EARNINGS", "FF1D4ED8");

        if (basicPay > 0.005) amtRow("Basic Pay", basicPay, { fillArgb: "FFDBEAFE", borderBottom: true });
        allowanceRows.forEach((r) => { if (r.amount > 0.005) amtRow(r.name, r.amount, { fillArgb: "FFDBEAFE", borderBottom: true }); });
        premiumRows.forEach((r) => { if (r.amount > 0.005) amtRow(r.name, r.amount, { fillArgb: "FFDBEAFE", borderBottom: true }); });
        if (yearEndRefund && yearEndRefund.amount > 0.005) amtRow(yearEndRefund.name, yearEndRefund.amount, { fillArgb: "FFDBEAFE", borderBottom: true });
        earningAdj.forEach((r) => amtRow(r.name, r.amount, { fillArgb: "FFDBEAFE", borderBottom: true }));

        const grossPay = toNumber(record.grossPay);
        amtRow("GROSS PAY", grossPay, { bold: true, fillArgb: "FF1D4ED8", fontColor: "FFFFFFFF", borderTop: true });

        emptyRow();

        // Deductions
        const deductionRows = getDeductionRows(record);
        const deductionAdj = adjRows.filter((a) => a.amount < 0);

        sectionHeader("DEDUCTIONS", "FFB91C1C");
        deductionRows.forEach((r) => { if (r.amount > 0.005) amtRow(r.name, r.amount, { fillArgb: "FFFFF1F2", borderBottom: true }); });
        deductionAdj.forEach((r) => amtRow(r.name, Math.abs(r.amount), { fillArgb: "FFFFF1F2", borderBottom: true }));

        const totalDed = toNumber(record.totalDeductions);
        amtRow("TOTAL DEDUCTIONS", totalDed, { bold: true, fillArgb: "FFB91C1C", fontColor: "FFFFFFFF", borderTop: true });

        emptyRow();

        // Net Pay
        const netPay = getFinalNetPay(record);
        const netPayRow = amtRow("NET PAY", netPay, { bold: true, fillArgb: "FF065F46", fontColor: "FFFFFFFF", fontSize: 13 });
        netPayRow.height = 26;
        netPayRow.getCell(2).numFmt = numFmt;
      }

      for (const record of recordsToExport) {
        addPayslipSheet(record);
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, buildSafeFilename(`Payslips-${selectedMonth}-${selectedYear}-${selectedPeriod}.xlsx`));
      recordsToExport.forEach((record) => {
        logAudit({
          action: "EXPORTED",
          entityType: "Report_Payslip",
          entityId: `${record.employeeNo}-${record.year}-${record.month}-${record.payrollPeriod || ""}`,
          entityName: `Payslip ${record.employeeName || record.employeeNo} ${record.month || ""} ${record.year || ""}`,
          details: "Excel export",
        });
      });
    } catch (err) {
      console.error(err);
      window.alert("Unable to export payslips to Excel.");
    } finally {
      setBusy(false);
    }
  }

  async function exportRecordsAsZip(recordsToExport: PayrollRecord[]) {
    if (recordsToExport.length === 0) {
      window.alert("Please select at least one payslip.");
      return;
    }

    setBusy(true);

    try {
      const zip = new JSZip();
      const generatedDocuments: PayslipDocument[] = [];

      for (const record of recordsToExport) {
        const element = document.querySelector<HTMLElement>(`[data-payslip-id="${record.id}"] .payslip-page`);
        if (!element) continue;

        const title = buildSafeFilename(
          `Payslip-${record.employeeNo}-${record.month || ""}-${record.year || ""}-${getPayPeriod(record)}`
        );
        const html = buildPrintablePayslipHtml(title, element.outerHTML);
        generatedDocuments.push(buildEmployeePayslipDocument(record, html));
        zip.file(`${title}.html`, html);
      }

      if (generatedDocuments.length > 0) {
        saveEmployeePayslipDocuments(generatedDocuments);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildSafeFilename(`Printable-Payslips-${selectedMonth}-${selectedYear}-${selectedPeriod}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert("Unable to generate ZIP file.");
    } finally {
      setBusy(false);
    }
  }

  const activeTheme = normalizeTheme(theme);
  const accentButtonTextColor = getReadableAccentTextColor(activeTheme.accentColor, activeTheme.bannerButtonTextColor);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle: React.CSSProperties = {
    backgroundColor: activeTheme.bannerColor,
    backgroundImage: activeTheme.bannerImageDataUrl
      ? `linear-gradient(${activeTheme.bannerColor}${bannerOverlayAlpha}, ${activeTheme.bannerColor}${bannerOverlayAlpha}), url(${activeTheme.bannerImageDataUrl})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <main
      className="reports-theme-page min-h-screen px-4 py-5 text-slate-950 sm:px-6 lg:px-8"
      style={{
        "--report-banner": activeTheme.bannerColor,
        "--report-accent": activeTheme.accentColor,
        "--report-banner-text": activeTheme.bannerTextColor,
        "--report-button-text": accentButtonTextColor,
        background: `linear-gradient(180deg, ${activeTheme.bannerColor} 0%, ${activeTheme.bannerColor} 290px, #f4f8fc 290px, #f4f8fc 100%)`,
      } as React.CSSProperties}
    >
      <style>{`
        .reports-theme-page {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .reports-theme-page .report-panel {
          border: 1px solid rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.96) !important;
          border-radius: 16px !important;
          box-shadow: 0 14px 38px -32px rgba(8,47,73,0.78) !important;
        }

        .reports-theme-page input,
        .reports-theme-page select {
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
        }

        .reports-theme-page input:focus,
        .reports-theme-page select:focus {
          border-color: var(--report-accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--report-accent) 18%, transparent), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .reports-theme-page .report-primary {
          background: var(--report-accent) !important;
          border-color: var(--report-accent) !important;
          color: var(--report-button-text) !important;
        }

        .reports-theme-page table th {
          font-size: 10px !important;
          letter-spacing: 0.02em !important;
          font-weight: 800 !important;
        }

        .reports-theme-page table td {
          font-size: 12px !important;
          color: #334155;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          body * {
            visibility: hidden !important;
          }

          .payslip-print-area {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }

          .payslip-print-area,
          .payslip-print-area * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .payslip-page {
            width: 297mm !important;
            height: 210mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: always !important;
          }
        }
      `}</style>

      <div className="mx-auto grid max-w-[1500px] gap-6">
        <section
          className="no-print relative overflow-hidden rounded-2xl border px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
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
                  Reports Module
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Payslip Desk
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Payslips</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
                Generate and download payslips from approved payroll records.
              </p>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Ready</p>
                <p className="mt-1 font-semibold">{filteredRecords.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Selected</p>
                <p className="mt-1 font-semibold">{selectedRecords.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Approved</p>
                <p className="mt-1 font-semibold">{approvedRecords.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="report-panel no-print rounded-2xl border border-white bg-white/95 p-4">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Payslip Filters</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Only approved or locked payroll records are shown here.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || selectedRecords.length === 0}
                onClick={() => exportPayslipsToExcel(selectedRecords)}
                className="report-primary rounded-xl px-4 py-2 text-xs font-semibold shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export Selected to Excel
              </button>

              <button
                type="button"
                disabled={busy || filteredRecords.length === 0}
                onClick={() => exportPayslipsToExcel(filteredRecords)}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export All to Excel
              </button>

              <button
                type="button"
                disabled={busy || selectedRecords.length === 0}
                onClick={() => exportRecordsAsZip(selectedRecords)}
                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-[#0a4f8f] shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download Selected HTML ZIP
              </button>

              <button
                type="button"
                disabled={busy || filteredRecords.length === 0}
                onClick={() => exportRecordsAsZip(filteredRecords)}
                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-[#0a4f8f] shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download All HTML ZIP
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <label>
              <FilterLabel>Month</FilterLabel>
              <FieldSelect value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                <option value="ALL">All Months</option>
                {options.months.map((month) => (
                  <option key={month}>{month}</option>
                ))}
              </FieldSelect>
            </label>

            <label>
              <FilterLabel>Year</FilterLabel>
              <FieldSelect value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                <option value="ALL">All Years</option>
                {options.years.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </FieldSelect>
            </label>

            <label>
              <FilterLabel>Pay Period</FilterLabel>
              <FieldSelect value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)}>
                <option value="ALL">All Periods</option>
                {options.periods.map((period) => (
                  <option key={period}>{period}</option>
                ))}
              </FieldSelect>
            </label>

            <label>
              <FilterLabel>Department</FilterLabel>
              <FieldSelect value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}>
                <option value="ALL">All Departments</option>
                {options.departments.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </FieldSelect>
            </label>

            <label>
              <FilterLabel>Employment Type</FilterLabel>
              <FieldSelect value={selectedEmploymentStatus} onChange={(event) => setSelectedEmploymentStatus(event.target.value)}>
                <option value="ALL">All Types</option>
                {options.statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </FieldSelect>
            </label>

            <label>
              <FilterLabel>Search</FilterLabel>
              <FieldInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or employee no." />
            </label>
          </div>
        </section>

        <section className="report-panel no-print overflow-x-auto rounded-2xl border border-white bg-white/95 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Approved Payslips</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {filteredRecords.length} payslip(s) ready.
              </p>
            </div>
          </div>

          <table className="w-full min-w-[1100px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredRecords.length > 0 && selectedIds.length === filteredRecords.length}
                    onChange={toggleAll}
                  />
                </th>
                {["Employee", "Employee No.", "Department", "Type", "Period", "Pay Date", "Gross Pay", "Deductions", "Net Pay", "Actions"].map(
                  (header) => (
                    <th key={header} className="border-b border-slate-200 p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const employee = getEmployee(record);

                return (
                  <tr key={record.id} className="border-b border-slate-200 transition hover:bg-sky-50">
                    <td className="border-b border-slate-100 p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleRecord(record.id)}
                      />
                    </td>
                    <td className="border-b border-slate-100 p-3 font-semibold text-slate-900">{getEmployeeName(employee, record)}</td>
                    <td className="border-b border-slate-100 p-3">{record.employeeNo}</td>
                    <td className="border-b border-slate-100 p-3">{record.department || "—"}</td>
                    <td className="border-b border-slate-100 p-3">{record.employmentStatus || "—"}</td>
                    <td className="border-b border-slate-100 p-3">{getPayPeriod(record)}</td>
                    <td className="border-b border-slate-100 p-3">{formatDate(getPayrollDate(record))}</td>
                    <td className="border-b border-slate-100 p-3 font-bold">{money(record.grossPay)}</td>
                    <td className="border-b border-slate-100 p-3 font-bold">{money(record.totalDeductions)}</td>
                    <td className="border-b border-slate-100 p-3 font-semibold" style={{ color: activeTheme.accentColor }}>{money(getFinalNetPay(record))}</td>
                    <td className="border-b border-slate-100 p-3">
                      <button
                        type="button"
                        onClick={() => exportRecordAsPdf(record)}
                        disabled={busy}
                        className="report-primary rounded-xl px-3 py-2 text-xs font-semibold shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] disabled:opacity-50"
                      >
                        View / Print Payslip
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-500">
              No approved payroll records found for the selected filters.
            </div>
          ) : null}
        </section>

        <section
          ref={printAreaRef}
          className="payslip-print-area"
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: "297mm",
            height: "210mm",
            overflow: "hidden",
            pointerEvents: "none",
            opacity: 0,
          }}
        >
          {filteredRecords.map((record) => (
            <div key={`page-wrap-${record.id}`} data-payslip-id={record.id}>
              <PayslipPage
                company={company}
                employee={getEmployee(record)}
                record={record}
                allApprovedRecords={approvedRecords}
                includeYtd={includeYtd}
              />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
