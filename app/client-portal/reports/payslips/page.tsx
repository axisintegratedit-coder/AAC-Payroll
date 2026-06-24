"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, Search, X } from "lucide-react";
import { getConfigItem, getCollectionItems } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { getClientPortalSessionAsync } from "../../lib/auth";
import { logAudit } from "@/lib/auditTrail";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  archiveStatus?: "Active" | "Archived";
  archived?: boolean;
};

type PayrollRecord = {
  id: string;
  employeeNo?: string;
  employeeName?: string;
  department?: string;
  employmentStatus?: string;
  payrollPeriod?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  bulkRunId?: string;
  month?: string | number;
  year?: string | number;
  payrollDate?: string;
  dateFrom?: string;
  dateTo?: string;
  periodCovered?: string;
  basicPay?: number | string;
  regularPay?: number | string;
  grossPay?: number | string;
  totalDeductions?: number | string;
  netPay?: number | string;
  adjustedNetPay?: number | string;
  withholdingTax?: number | string;
  sssEe?: number | string;
  sssRegularEe?: number | string;
  sssWispEe?: number | string;
  philhealthEe?: number | string;
  pagibigEe?: number | string;
  totalAllowances?: number | string;
  totalPayrollPremium?: number | string;
  totalAbsences?: number | string;
  taxableIncome?: number | string;
  taxAnnualizationAdjustment?: number | string;
  yearEndTaxAdjustment?: number | string;
  annualizationTaxAdjustment?: number | string;
  annualizedTaxAdjustment?: number | string;
  finalTaxAdjustment?: number | string;
  taxAnnualizationYear?: string | number;
  payrollAdjustments?: PayrollAdjustment[];
  customPremiums?: { id?: string; name: string; amount: number | string }[];
  customAllowances?: { id?: string; name: string; amount: number | string }[];
  customDeductions?: { id?: string; name: string; amount: number | string }[];
  archiveStatus?: "Active" | "Archived";
  createdAt?: string;
  absencesHours?: number | string;
  monthYear?: string;
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
  standardHoursPerDay?: number | string;
  workingDaysPerMonth?: number | string;
  loans?: {
    id?: string;
    loanName?: string;
    originalAmount?: number | string;
    outstandingBalance?: number | string;
    monthlyDeduction?: number | string;
  }[];
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

// ─── helpers ────────────────────────────────────────────────────────────────

function toNum(v: number | string | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function money(v: number | string | undefined | null) {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNum(v));
}

function peso(v: number | string | undefined) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(toNum(v));
}

function fmtPeriod(r: PayrollRecord): string {
  if (r.periodCovered) return r.periodCovered;
  if (r.dateFrom && r.dateTo) return `${fmtDate(r.dateFrom)} – ${fmtDate(r.dateTo)}`;
  if (r.payrollPeriod) return r.payrollPeriod;
  if (r.month && r.year) return `${r.month} ${r.year}`;
  return r.payrollReference || r.payrollRun || "—";
}

function fmtDate(d: string | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "numeric", day: "numeric" });
}

function firstFilled(...values: Array<string | number | undefined | null>) {
  return values.map((v) => String(v ?? "").trim()).find(Boolean) || "—";
}

function normalizeText(v?: string | number) {
  return String(v ?? "").trim().toLowerCase();
}

function cleanLabel(value: string, wordsToRemove: string[] = []) {
  let label = String(value || "Item").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  wordsToRemove.forEach((w) => { label = label.replace(new RegExp(`\\b${w}\\b`, "gi"), ""); });
  return label.replace(/\s+/g, " ").trim() || value || "Item";
}

function normalizeMoneyItems(items?: { id?: string; name: string; amount: number | string }[]) {
  return (items || [])
    .map((item, i) => ({ id: item.id || `${item.name}-${i}`, name: item.name, amount: toNum(item.amount) }))
    .filter((item) => Math.abs(item.amount) >= 0.01);
}

function sumRecords(records: PayrollRecord[], getter: (r: PayrollRecord) => number) {
  return records.reduce((t, r) => t + getter(r), 0);
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getPayPeriod(record: PayrollRecord): string {
  return fmtPeriod(record);
}

function getPayrollDate(record: PayrollRecord) {
  return record.payrollDate || record.createdAt || "";
}

function getFinalNetPay(record: PayrollRecord) {
  const adjusted = toNum(record.adjustedNetPay);
  if (Math.abs(adjusted) >= 0.01) return adjusted;
  return toNum(record.netPay);
}

function getRawYearEndTaxAdjustment(record: PayrollRecord) {
  return (
    toNum(record.taxAnnualizationAdjustment) ||
    toNum(record.yearEndTaxAdjustment) ||
    toNum(record.annualizationTaxAdjustment) ||
    toNum(record.annualizedTaxAdjustment) ||
    toNum(record.finalTaxAdjustment) ||
    0
  );
}

function getActiveYearEndTaxAdjustment(record: PayrollRecord) {
  const raw = getRawYearEndTaxAdjustment(record);
  return Math.abs(raw) < 0.01 ? 0 : raw;
}

function getYearEndRefundRow(record: PayrollRecord) {
  const adj = getActiveYearEndTaxAdjustment(record);
  if (adj > 0) return { name: "Year-End Tax Refund", amount: adj };
  return null;
}

function getAllowanceRows(record: PayrollRecord) {
  const src = record as any;
  const listed = [
    { name: "Rice Subsidy", amount: toNum(src.riceSubsidy) || toNum(src.riceAllowance) || toNum(src.rice) },
    { name: "Uniform / Clothing", amount: toNum(src.uniformClothing) || toNum(src.uniformClothingAllowance) },
    { name: "Laundry Allowance", amount: toNum(src.laundryAllowance) || toNum(src.laundry) },
    { name: "Medical Cash Dependents", amount: toNum(src.medicalCashDependents) || toNum(src.medicalCashAllowanceToDependents) },
    { name: "Actual Medical Assistance", amount: toNum(src.actualMedicalAssistance) },
    { name: "Achievement Awards", amount: toNum(src.achievementAwards) },
    { name: "Christmas / Anniversary Gifts", amount: toNum(src.christmasAnniversaryGifts) },
    { name: "Meal Allowance OT/Night", amount: toNum(src.mealAllowanceOTNight) || toNum(src.mealAllowance) },
    { name: "Monetized Leave", amount: toNum(src.monetizedLeavePrivate) },
    { name: "CBA / Productivity Incentives", amount: toNum(src.cbaProductivityIncentives) },
    { name: "13th Month Pay", amount: toNum(src.thirteenthMonthPay) || toNum(src.thirteenthMonth) },
    { name: "Christmas Bonus", amount: toNum(src.christmasBonus) },
    { name: "Other Taxable Allowances", amount: toNum(src.otherTaxableAllowances) || toNum(src.otherAllowanceAmount) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customAllowances).map((item) => ({
    name: cleanLabel(item.name, ["custom", "allowance"]),
    amount: item.amount,
  }));

  if (listed.length > 0 || custom.length > 0) return [...listed, ...custom];
  const totalAllowances = toNum(record.totalAllowances);
  return totalAllowances ? [{ name: "Allowances", amount: totalAllowances }] : [];
}

function getPremiumRows(record: PayrollRecord) {
  const src = record as any;
  const listed = [
    { name: "Night Differential", amount: toNum(src.nightDifferentialAmount) || toNum(src.nightDifferentialPay) },
    { name: "Overtime Pay", amount: toNum(src.overtimeAmount) || toNum(src.overtimePay) },
    { name: "Rest Day / Day Off Work", amount: toNum(src.restDayAmount) },
    { name: "Special Holiday Premium", amount: toNum(src.specialHolidayAmount) || toNum(src.holidayPayAmount) || toNum(src.holidayPay) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customPremiums).map((item) => ({
    name: cleanLabel(item.name, ["custom", "premium"]),
    amount: item.amount,
  }));

  if (listed.length > 0 || custom.length > 0) return [...listed, ...custom];
  const totalPayrollPremium = toNum(record.totalPayrollPremium);
  return totalPayrollPremium ? [{ name: "Payroll Premiums", amount: totalPayrollPremium }] : [];
}

function getDeductionRows(record: PayrollRecord) {
  const src = record as any;
  const sssEe = Math.abs(toNum(record.sssEe)) >= 0.01
    ? toNum(record.sssEe)
    : toNum(record.sssRegularEe) + toNum(record.sssWispEe);

  const rows = [
    { name: "Tardiness / Absences", amount: toNum(record.totalAbsences) },
    { name: "Withholding Tax", amount: toNum(record.withholdingTax) },
    { name: "SSS Employee", amount: sssEe },
    { name: "PhilHealth Employee", amount: toNum(record.philhealthEe) },
    { name: "Pag-IBIG Employee", amount: toNum(record.pagibigEe) },
    { name: "Payroll Advances", amount: toNum(src.employeeAdvances) },
    { name: "Cash Advances", amount: toNum(src.cashAdvances) },
    { name: "SSS Loan Repayment", amount: toNum(src.sssLoanRepayment) },
    { name: "HDMF Loan Repayment", amount: toNum(src.hdmfLoanRepayment) },
  ].filter((item) => Math.abs(item.amount) >= 0.01);

  const custom = normalizeMoneyItems(record.customDeductions).map((item) => ({
    name: cleanLabel(item.name, ["custom", "deduction"]),
    amount: item.amount,
  }));

  const yearEnd = getActiveYearEndTaxAdjustment(record);
  const yearEndDed = yearEnd < 0 ? [{ name: "Year-End Additional Tax", amount: Math.abs(yearEnd) }] : [];

  return [...rows, ...custom, ...yearEndDed];
}

function getPayrollAdjustmentRows(record: PayrollRecord) {
  const hasRawYearEnd = Math.abs(getRawYearEndTaxAdjustment(record)) >= 0.01;
  return (record.payrollAdjustments || [])
    .filter((item) => item.archiveStatus !== "Archived" && item.archived !== true)
    .map((item, index) => {
      const amount = toNum(item.netPayEffect ?? item.finalAmount ?? item.amount);
      const rawLabel = item.adjustmentLabel || item.adjustmentCategory || item.reason || `Payroll Adjustment ${index + 1}`;
      const labelSource = [item.adjustmentLabel, item.adjustmentCategory, item.reason, item.source, item.sourceId, rawLabel]
        .filter(Boolean).join(" ").toLowerCase();

      const isYearEnd = labelSource.includes("year-end") || labelSource.includes("year end") ||
        labelSource.includes("annualization") || labelSource.includes("annualisation") ||
        labelSource.includes("tax adjustment") || labelSource.includes("tax annual");
      const isGeneric = /^payroll adjustment\s*\d*$/i.test(rawLabel.trim());

      if (isYearEnd || (isGeneric && hasRawYearEnd)) return null;
      return { name: rawLabel, amount };
    })
    .filter((item): item is { name: string; amount: number } => item !== null && Math.abs(item.amount) >= 0.01);
}

function getEmployeeName(employee?: Employee, record?: PayrollRecord) {
  if (employee?.employeeName) return employee.employeeName.toUpperCase();
  const fromParts = [employee?.lastName, employee?.firstName, employee?.middleName].filter(Boolean).join(", ").trim();
  return (fromParts || record?.employeeName || "—").toUpperCase();
}

function getPosition(employee?: Employee) {
  return firstFilled(employee?.designation, employee?.position, employee?.jobTitle);
}

function getEmployeeRate(employee?: Employee, record?: PayrollRecord) {
  return toNum(employee?.monthlyRate || employee?.basicPay || record?.basicPay);
}

const MONTH_ORDER = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NUMBER_BY_NAME = MONTH_ORDER.reduce<Record<string, number>>((map, m, i) => { map[m.toLowerCase()] = i + 1; return map; }, {});

function getRecordMonthNumber(record: PayrollRecord) {
  const monthName = String(record.month || "").trim().toLowerCase();
  if (MONTH_NUMBER_BY_NAME[monthName]) return MONTH_NUMBER_BY_NAME[monthName];
  const payDate = new Date(record.payrollDate || "");
  if (!Number.isNaN(payDate.getTime())) return payDate.getMonth() + 1;
  return 0;
}

function getRecordTaxYear(record: PayrollRecord) {
  const yr = String(record.year || "").trim();
  if (/^20\d{2}$/.test(yr)) return yr;
  const payDate = record.payrollDate ? new Date(record.payrollDate) : null;
  if (payDate && !Number.isNaN(payDate.getTime())) return String(payDate.getFullYear());
  return "";
}

function getPayrollCutoffOrder(record: PayrollRecord) {
  const period = normalizeText(fmtPeriod(record));
  if (period.includes("first")) return 1;
  if (period.includes("second")) return 2;
  if (period.includes("mid")) return 1;
  if (period.includes("end")) return 2;
  return 0;
}

function getPayrollPeriodAbsoluteSortValue(record: PayrollRecord) {
  const year = getRecordTaxYear(record);
  const month = getRecordMonthNumber(record);
  const cutoff = getPayrollCutoffOrder(record);
  if (!year || !month) return 0;
  return Number(year) * 10000 + month * 100 + cutoff;
}

function getYtdRecords(current: PayrollRecord, allRecords: PayrollRecord[]) {
  const currentSortValue = getPayrollPeriodAbsoluteSortValue(current);
  return allRecords.filter((r) => {
    if (r.employeeNo !== current.employeeNo) return false;
    if (r.archiveStatus === "Archived") return false;
    const sv = getPayrollPeriodAbsoluteSortValue(r);
    if (!sv || !currentSortValue) return false;
    return sv <= currentSortValue;
  }).sort((a, b) => getPayrollPeriodAbsoluteSortValue(a) - getPayrollPeriodAbsoluteSortValue(b));
}

// ─── payslip HTML builder (mirrors admin PayslipPage) ─────────────────────

function getPrintableDocumentHead() {
  return `
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { margin: 0; padding: 0; background: #ffffff !important; color: #0f172a !important; font-family: Arial, Helvetica, sans-serif; }
      .print-toolbar { position: sticky; top: 0; z-index: 9999; display: flex; justify-content: center; gap: 12px; padding: 14px; background: #0f172a; }
      .print-toolbar button { border: 0; border-radius: 12px; padding: 11px 18px; font-weight: 900; cursor: pointer; }
      .print-primary { background: #1d4ed8; color: #ffffff; }
      .print-secondary { background: #ffffff; color: #0f172a; }
      .print-shell { width: 297mm; min-height: 210mm; margin: 0 auto; background: #ffffff; }
      .payslip-page { width: 297mm !important; height: 210mm !important; margin: 0 auto !important; padding: 3mm 8mm 4mm !important; box-shadow: none !important; overflow: hidden !important; background: #ffffff !important; color: #0f172a !important; font-size: 10px !important; }
      .payslip-page img { width: 54px !important; height: 42px !important; max-width: 54px !important; max-height: 42px !important; object-fit: contain !important; display: block !important; }
      .grid { display: grid; } .flex { display: flex; } .items-center { align-items: center; }
      .justify-between { justify-content: space-between; } .place-items-center { place-items: center; }
      .object-contain { object-fit: contain; } .w-full { width: 100%; }
      .bg-white { background: #ffffff !important; } .bg-sky-100 { background: #e0f2fe !important; }
      .bg-sky-300 { background: #7dd3fc !important; } .text-white { color: #ffffff !important; }
      .text-slate-900 { color: #0f172a !important; } .text-slate-500 { color: #64748b !important; }
      .text-sky-700 { color: #0369a1 !important; }
      .font-bold { font-weight: 700; } .font-black { font-weight: 900; }
      .uppercase { text-transform: uppercase; } .text-left { text-align: left; }
      .text-right { text-align: right; } .text-center { text-align: center; }
      .border { border: 1px solid #7dd3fc; } .border-sky-300 { border-color: #7dd3fc !important; }
      .border-b { border-bottom: 1px solid #7dd3fc; }
      .border-b-\\[3px\\] { border-bottom: 3px solid #7dd3fc; }
      .border-t-\\[3px\\] { border-top: 3px solid #7dd3fc; }
      .rounded-xl { border-radius: 12px; }
      .gap-1 { gap: 4px; } .gap-2 { gap: 8px; } .gap-3 { gap: 10px; } .gap-4 { gap: 16px; }
      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .grid-cols-\\[64px_1fr_220px\\] { grid-template-columns: 64px 1fr 220px; }
      .grid-cols-\\[1\\.08fr_0\\.98fr\\] { grid-template-columns: 1.08fr 0.98fr; }
      .h-\\[42px\\] { height: 42px; } .w-\\[54px\\] { width: 54px; }
      .text-\\[8px\\] { font-size: 8px; } .text-\\[10px\\] { font-size: 10px; }
      .text-\\[18px\\] { font-size: 18px; } .text-\\[11px\\] { font-size: 11px; }
      .text-\\[\\#0f4c81\\] { color: #0f4c81 !important; }
      .tracking-\\[0\\.25em\\] { letter-spacing: 0.25em; }
      .p-2 { padding: 8px; } .px-2 { padding-left: 8px; padding-right: 8px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .py-\\[2px\\] { padding-top: 2px; padding-bottom: 2px; }
      .pb-2 { padding-bottom: 8px; } .pt-1 { padding-top: 4px; }
      .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; }
      table { border-collapse: collapse; }
      th, td { line-height: 1.18; vertical-align: top; }
      .payslip-page table th, .payslip-page table td { padding-top: 2px !important; padding-bottom: 2px !important; }
      .payslip-page .border-b-\\[3px\\] { border-bottom-width: 2px !important; }
      .payslip-page .border-t-\\[3px\\] { border-top-width: 2px !important; }
      @media print {
        .print-toolbar { display: none !important; }
        .print-shell { width: 297mm !important; min-height: 210mm !important; margin: 0 !important; }
        .payslip-page { width: 297mm !important; height: 210mm !important; page-break-after: always !important; }
      }
    </style>
  `;
}

function buildPayslipBody(
  record: PayrollRecord,
  employee: Employee | undefined,
  company: CompanyProfile,
  allRecords: PayrollRecord[]
): string {
  const companyName = company.companyName || company.registeredName || company.businessName || company.tradeName || company.employerName || "Company Name";
  const companyAddress = company.companyAddress || company.registeredAddress || company.businessAddress || company.address || "Company Address";
  const logo = company.logoDataUrl || company.companyLogoDataUrl || company.logo || "";

  const basicPay = toNum(record.basicPay || record.regularPay);
  const netPay = getFinalNetPay(record);

  const earningRows = [
    { name: "REG BASIC", current: basicPay },
    ...getAllowanceRows(record).map((r) => ({ name: r.name.toUpperCase(), current: r.amount })),
    ...getPremiumRows(record).map((r) => ({ name: r.name.toUpperCase(), current: r.amount })),
    ...(getYearEndRefundRow(record) ? [{ name: getYearEndRefundRow(record)!.name.toUpperCase(), current: getYearEndRefundRow(record)!.amount }] : []),
    ...getPayrollAdjustmentRows(record).filter((a) => a.amount > 0).map((a) => ({ name: a.name.toUpperCase(), current: a.amount })),
  ].filter((r) => Math.abs(r.current) >= 0.01);

  const deductionRows = [
    ...getDeductionRows(record).map((r) => ({ name: r.name.toUpperCase(), current: r.amount })),
    ...getPayrollAdjustmentRows(record).filter((a) => a.amount < 0).map((a) => ({ name: a.name.toUpperCase(), current: Math.abs(a.amount) })),
  ].filter((r) => Math.abs(r.current) >= 0.01);

  const currentEarningsTotal = earningRows.reduce((t, r) => t + r.current, 0);
  const currentDeductionsTotal = deductionRows.reduce((t, r) => t + r.current, 0);

  const ytdRecords = getYtdRecords(record, allRecords);

  function getYtdForRow(rowName: string, type: "earning" | "deduction"): number {
    return ytdRecords.reduce((total, item) => {
      const rows = type === "earning"
        ? [
            { name: "REG BASIC", amount: toNum(item.basicPay || item.regularPay) },
            ...getAllowanceRows(item),
            ...getPremiumRows(item),
            ...(getYearEndRefundRow(item) ? [getYearEndRefundRow(item)!] : []),
            ...getPayrollAdjustmentRows(item).filter((a) => a.amount > 0),
          ]
        : [
            ...getDeductionRows(item),
            ...getPayrollAdjustmentRows(item).filter((a) => a.amount < 0).map((a) => ({ ...a, amount: Math.abs(a.amount) })),
          ];
      const matched = rows.find((r) => normalizeText(r.name) === normalizeText(rowName));
      return total + (matched?.amount ?? 0);
    }, 0);
  }

  const ytdEarnings = sumRecords(ytdRecords, (item) => {
    const rows = [
      { amount: toNum(item.basicPay || item.regularPay) },
      ...getAllowanceRows(item),
      ...getPremiumRows(item),
      ...(getYearEndRefundRow(item) ? [getYearEndRefundRow(item)!] : []),
      ...getPayrollAdjustmentRows(item).filter((a) => a.amount > 0),
    ];
    return rows.reduce((t, r) => t + r.amount, 0);
  });

  const ytdDeductions = sumRecords(ytdRecords, (item) => {
    const rows = [
      ...getDeductionRows(item),
      ...getPayrollAdjustmentRows(item).filter((a) => a.amount < 0).map((a) => ({ ...a, amount: Math.abs(a.amount) })),
    ];
    return rows.reduce((t, r) => t + r.amount, 0);
  });

  const ytdNetPay = sumRecords(ytdRecords, (item) => getFinalNetPay(item));

  const empName = getEmployeeName(employee, record);
  const empCode = firstFilled(employee?.payslipId, record.employeeNo);
  const dept = record.department || employee?.department || "—";
  const position = getPosition(employee);
  const rate = money(getEmployeeRate(employee, record));
  const empType = record.employmentStatus || employee?.employmentStatus || employee?.employeeType || "—";
  const sss = firstFilled(employee?.sssNumber, employee?.sssNo, employee?.sss);
  const tin = firstFilled(employee?.tin, employee?.tinNumber);
  const pagibig = firstFilled(employee?.pagibig, employee?.pagibigNumber, employee?.pagIbigNumber, employee?.pagibigNo, employee?.pagIbigNo, employee?.hdmfNumber, employee?.hdmfNo);
  const philhealth = firstFilled(employee?.philhealth, employee?.philhealthNumber, employee?.philHealthNumber, employee?.philhealthNo, employee?.philHealthNo, employee?.phicNumber, employee?.phicNo);
  const bankName = employee?.bankName || "—";
  const bankAccount = employee?.bankAccountNumber || "—";
  const bankType = employee?.bankAccountType || "Payroll";

  const logoHtml = logo
    ? `<img src="${logo}" alt="Company Logo" style="width:54px;height:42px;max-width:54px;max-height:42px;object-fit:contain;display:block;" />`
    : `<div class="grid h-[42px] w-[54px] place-items-center rounded-xl bg-sky-100 text-[8px] font-black text-sky-700" style="width:54px;height:42px;display:grid;place-items:center;border-radius:12px;background:#e0f2fe;font-size:8px;font-weight:900;color:#0369a1;">LOGO</div>`;

  const ref = record.payrollReference || record.payrollRun || record.id;

  const ci = (label: string, value: string) =>
    `<div class="flex items-center gap-1 text-[10px]" style="display:flex;align-items:center;gap:4px;font-size:10px;line-height:1.15;"><span class="font-black text-slate-900">${escapeHtml(label)}:</span> <strong class="font-black text-slate-900">${escapeHtml(value)}</strong></div>`;

  const sectionTitle = (label: string, extraClass = "") =>
    `<div class="bg-sky-300 px-2 py-[2px] text-center text-[10px] font-black uppercase tracking-[0.25em] text-white${extraClass}" style="background:#7dd3fc;padding:2px 8px;text-align:center;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.25em;color:#ffffff;">${escapeHtml(label)}</div>`;

  const th = (label: string, align = "left") =>
    `<th class="border-b border-sky-300 px-2 py-[2px] font-black ${align === "right" ? "text-right" : "text-left"}" style="border-bottom:1px solid #7dd3fc;padding:2px 8px;font-weight:900;text-align:${align};">${escapeHtml(label)}</th>`;

  const td = (val: string, align = "left") =>
    `<td class="border-b border-sky-300 px-2 py-[2px] ${align === "right" ? "text-right" : "text-left"}" style="border-bottom:1px solid #7dd3fc;padding:2px 8px;text-align:${align};">${val}</td>`;

  const earningRowsHtml = earningRows.map((r) => `<tr>${td(escapeHtml(r.name))}${td(money(r.current), "right")}${td(money(getYtdForRow(r.name, "earning")), "right")}</tr>`).join("");
  const deductionRowsHtml = deductionRows.length > 0
    ? deductionRows.map((r) => `<tr>${td(escapeHtml(r.name))}${td(money(r.current), "right")}${td(money(getYtdForRow(r.name, "deduction")), "right")}</tr>`).join("")
    : `<tr>${td("No deductions")}${td("—", "right")}${td("—", "right")}</tr>`;

  return `
    <article class="payslip-page bg-white text-[11px] text-slate-900" style="width:297mm;height:210mm;box-sizing:border-box;overflow:hidden;padding:3mm 8mm 4mm;background:#ffffff;color:#0f172a;font-size:10px;">
      <div class="grid grid-cols-[64px_1fr_220px] items-center gap-3 border-b-[3px] border-sky-300 pb-2" style="display:grid;grid-template-columns:64px 1fr 220px;align-items:center;gap:10px;border-bottom:3px solid #7dd3fc;padding-bottom:8px;">
        ${logoHtml}
        <div>
          <div class="text-[18px] font-black text-[#0f4c81]" style="font-size:18px;font-weight:900;color:#0f4c81;">${escapeHtml(companyName)}</div>
          <div class="mt-1 text-[10px] text-slate-900" style="margin-top:4px;font-size:10px;color:#0f172a;">${escapeHtml(companyAddress)}</div>
        </div>
        <div class="text-right text-[10px]" style="text-align:right;font-size:10px;">
          <div class="font-black uppercase text-slate-900" style="font-weight:900;text-transform:uppercase;color:#0f172a;">Payslip</div>
          <div><strong>Pay Date:</strong> ${escapeHtml(formatDate(getPayrollDate(record)))}</div>
          <div><strong>Pay Period:</strong> ${escapeHtml(getPayPeriod(record))}</div>
        </div>
      </div>

      <div class="border-b-[3px] border-sky-300 py-1" style="border-bottom:3px solid #7dd3fc;padding-top:4px;padding-bottom:4px;">
        <div class="grid grid-cols-3 gap-3" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
          <div class="grid gap-1" style="display:grid;gap:4px;">
            ${ci("Employee Name", empName)}
            ${ci("Employee Code", empCode)}
          </div>
          <div class="grid gap-1" style="display:grid;gap:4px;">
            ${ci("Department", dept)}
            ${ci("Position", position)}
          </div>
          <div class="grid gap-1" style="display:grid;gap:4px;">
            ${ci("Monthly Rate", rate)}
            ${ci("Employment Type", empType)}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-2 py-1" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding-top:4px;padding-bottom:4px;">
        ${ci("SSS No.", sss)}
        ${ci("TIN", tin)}
        ${ci("Pag-IBIG No.", pagibig)}
        ${ci("PhilHealth No.", philhealth)}
      </div>

      <div class="grid grid-cols-[1.08fr_0.98fr] gap-3" style="display:grid;grid-template-columns:1.08fr 0.98fr;gap:10px;">
        <div>
          ${sectionTitle("EARNINGS")}
          <table class="w-full border border-sky-300 text-[10px]" style="width:100%;border:1px solid #7dd3fc;border-collapse:collapse;font-size:10px;">
            <thead><tr>${th("Description")}${th("Current", "right")}${th("YTD", "right")}</tr></thead>
            <tbody>${earningRowsHtml}</tbody>
          </table>
          ${sectionTitle("CURRENT TOTALS", " mt-2")}
          <div class="grid grid-cols-3 border border-sky-300 p-2" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #7dd3fc;padding:8px;">
            <div><div class="font-black" style="font-weight:900;">Earnings</div><div>${money(currentEarningsTotal)}</div></div>
            <div><div class="font-black" style="font-weight:900;">Deductions</div><div>${money(currentDeductionsTotal)}</div></div>
            <div><div class="font-black" style="font-weight:900;">Net Pay</div><div>${money(netPay)}</div></div>
          </div>
        </div>
        <div>
          ${sectionTitle("DEDUCTIONS")}
          <table class="w-full border border-sky-300 text-[10px]" style="width:100%;border:1px solid #7dd3fc;border-collapse:collapse;font-size:10px;">
            <thead><tr>${th("Description")}${th("Current", "right")}${th("YTD", "right")}</tr></thead>
            <tbody>${deductionRowsHtml}</tbody>
          </table>
          ${sectionTitle("LOANS", " mt-2")}
          <table class="w-full border border-sky-300 text-[10px]" style="width:100%;border:1px solid #7dd3fc;border-collapse:collapse;font-size:10px;">
            <thead><tr>${th("Loan Type")}${th("Loan Amount", "right")}${th("Amount Paid", "right")}${th("Balance", "right")}</tr></thead>
            <tbody>${(() => {
              const src = record as any;
              const empLoans = (employee?.loans || []).filter((l) => toNum(l.monthlyDeduction) > 0);
              const sssLoan = toNum(src.sssLoanRepayment);
              const hdmfLoan = toNum(src.hdmfLoanRepayment);
              const customLoanDeds = (record.customDeductions || []).filter((d) => toNum(d.amount) > 0);
              const loanRows: { name: string; amt: number }[] = [
                ...(sssLoan > 0 ? [{ name: "SSS Loan", amt: sssLoan }] : []),
                ...(hdmfLoan > 0 ? [{ name: "HDMF Loan", amt: hdmfLoan }] : []),
                ...customLoanDeds.map((d) => ({ name: d.name, amt: toNum(d.amount) })),
                ...empLoans.filter((l) => !sssLoan && !hdmfLoan && !customLoanDeds.length).map((l) => ({ name: l.loanName || "Loan", amt: toNum(l.monthlyDeduction) / 2 })),
              ];
              if (!loanRows.length) return `<tr>${td("No loans")}${td("—", "right")}${td("—", "right")}${td("—", "right")}</tr>`;
              return loanRows.map((l) => `<tr>${td(l.name)}${td(money(l.amt), "right")}${td("—", "right")}${td("—", "right")}</tr>`).join("");
            })()}</tbody>
          </table>
          ${sectionTitle("YTD TOTALS", " mt-2")}
          <div class="grid grid-cols-3 border border-sky-300 p-2" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #7dd3fc;padding:8px;">
            <div><div class="font-black" style="font-weight:900;">Earnings</div><div>${money(ytdEarnings)}</div></div>
            <div><div class="font-black" style="font-weight:900;">Deductions</div><div>${money(ytdDeductions)}</div></div>
            <div><div class="font-black" style="font-weight:900;">Net Pay</div><div>${money(ytdNetPay)}</div></div>
          </div>
        </div>
      </div>

      ${sectionTitle("DIRECT DEPOSIT", " mt-1")}
      <table class="w-full border border-sky-300 text-[10px]" style="width:100%;border:1px solid #7dd3fc;border-collapse:collapse;font-size:10px;">
        <thead><tr>${th("Bank Account")}${th("Account Number")}${th("Account Type")}${th("Amount", "right")}</tr></thead>
        <tbody><tr>${td(escapeHtml(bankName))}${td(escapeHtml(bankAccount))}${td(escapeHtml(bankType))}${td(money(netPay), "right")}</tr></tbody>
      </table>

      <div class="mt-1 flex justify-between border-t-[3px] border-sky-300 pt-1 text-[8px] font-bold text-slate-500" style="margin-top:4px;display:flex;justify-content:space-between;border-top:3px solid #7dd3fc;padding-top:4px;font-size:8px;font-weight:700;color:#64748b;">
        <span>Payroll Reference: ${escapeHtml(ref)}</span>
        <span>CONFIDENTIAL</span>
      </div>
    </article>`;
}

function openPayslipWindow(record: PayrollRecord, employee: Employee | undefined, company: CompanyProfile, allRecords: PayrollRecord[]) {
  const body = buildPayslipBody(record, employee, company, allRecords);
  const title = `Payslip-${record.employeeNo || ""}-${record.month || ""}-${record.year || ""}`;
  const html = `<!doctype html>
<html>
  <head><title>${escapeHtml(title)}</title>${getPrintableDocumentHead()}</head>
  <body>
    <div class="print-toolbar">
      <button class="print-primary" onclick="window.print()">Print / Save as PDF</button>
      <button class="print-secondary" onclick="window.close()">Close</button>
    </div>
    <main class="print-shell">${body}</main>
  </body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { window.alert("Please allow pop-ups for this site so the payslip can open in a new tab."); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

// ─── page component ──────────────────────────────────────────────────────────

export default function ClientPortalPayslipsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [company, setCompany] = useState<CompanyProfile>({});
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [viewedRecord, setViewedRecord] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, raw, emps, co] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getCollectionItems<Employee>(storageKeys.employees),
        getConfigItem<CompanyProfile>(storageKeys.companyInformation, {} as CompanyProfile),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setRecords(Array.isArray(raw) ? raw.filter((r) => r.archiveStatus !== "Archived") : []);
      setEmployees(Array.isArray(emps) ? emps : []);
      setCompany(co || {});
    }
    load();
  }, [router]);

  const years = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.year) set.add(String(r.year));
      else if (r.payrollDate) set.add(String(new Date(r.payrollDate).getFullYear()));
    });
    return ["All", ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      const matchSearch = !q || r.employeeName?.toLowerCase().includes(q) || r.employeeNo?.toLowerCase().includes(q);
      const recYear = r.year ? String(r.year) : r.payrollDate ? String(new Date(r.payrollDate).getFullYear()) : "";
      const matchYear = yearFilter === "All" || recYear === yearFilter;
      return matchSearch && matchYear;
    });
  }, [records, search, yearFilter]);

  function getEmployee(employeeNo?: string) {
    if (!employeeNo) return undefined;
    return employees.find((e) => e.employeeNo === employeeNo);
  }

  const viewedEmployee = viewedRecord ? getEmployee(viewedRecord.employeeNo) : undefined;

  const allowanceAdj = (viewedRecord?.payrollAdjustments ?? []).filter(
    (a) => a.adjustmentType === "Addition" && toNum(a.finalAmount ?? a.amount) > 0
  );
  const deductionAdj = (viewedRecord?.payrollAdjustments ?? []).filter(
    (a) => a.adjustmentType === "Deduction" && toNum(a.finalAmount ?? a.amount) > 0
  );

  function handlePrintPayslip(record: PayrollRecord) {
    const emp = getEmployee(record.employeeNo);
    logAudit({
      action: "PRINTED",
      entityType: "Report_Payslip",
      entityId: `${record.employeeNo}-${record.year}-${record.month}-${record.payrollPeriod || ""}`,
      entityName: `Payslip ${record.employeeName || record.employeeNo} ${record.month || ""} ${record.year || ""}`,
      details: "Client portal print",
    });
    openPayslipWindow(record, emp, company, records);
  }

  return (
    <div className="flex min-h-screen flex-col pg-bg">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-8 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ backgroundColor: theme.bannerColor }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[32px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Payslips</h1>
            <p className="text-sm opacity-70" style={{ color: theme.bannerTextColor }}>View and print employee payslips — read-only access</p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by employee name or number…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]"
          >
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-500">{filtered.length} payslip{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Gross Pay</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net Pay</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No payslips found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.employeeName || "—"}</div>
                        <div className="text-xs text-slate-400">{r.employeeNo}{r.department ? ` · ${r.department}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmtPeriod(r)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{peso(r.grossPay)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{peso(r.totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{peso(r.adjustedNetPay ?? r.netPay)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setViewedRecord(r)}
                          className="rounded-lg border border-[#0a4f8f33] bg-[#0a4f8f0d] px-3 py-1.5 text-xs font-semibold text-[#0a4f8f] transition hover:bg-[#0a4f8f] hover:text-white"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payslip Detail Modal */}
      {viewedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Payslip</h2>
                <p className="text-sm text-slate-500">{viewedRecord.employeeName} · {fmtPeriod(viewedRecord)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintPayslip(viewedRecord)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button type="button" onClick={() => setViewedRecord(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Payslip summary content */}
            <div className="p-6 space-y-4 text-sm">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="text-lg font-bold text-slate-800">PAYSLIP</div>
                <div className="text-slate-500">Period: {fmtPeriod(viewedRecord)}</div>
                {viewedRecord.payrollReference && <div className="text-xs text-slate-400">Ref: {viewedRecord.payrollReference}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee Name</div>
                  <div className="mt-0.5 font-medium text-slate-800">{viewedRecord.employeeName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee No.</div>
                  <div className="mt-0.5 font-medium text-slate-800">{viewedRecord.employeeNo || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Department</div>
                  <div className="mt-0.5 text-slate-700">{viewedRecord.department || viewedEmployee?.department || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Position</div>
                  <div className="mt-0.5 text-slate-700">{viewedEmployee?.designation || viewedEmployee?.position || "—"}</div>
                </div>
                {viewedEmployee?.bankName && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bank</div>
                    <div className="mt-0.5 text-slate-700">{viewedEmployee.bankName}</div>
                  </div>
                )}
              </div>

              {/* Attendance */}
              {(() => {
                const hrsAbsent = toNum((viewedRecord as any).absencesHours);
                const emp = viewedEmployee;
                const hpd = toNum(emp?.standardHoursPerDay) || toNum((viewedRecord as any).standardHoursPerDay);
                const dpm = toNum(emp?.workingDaysPerMonth) || toNum((viewedRecord as any).workingDaysPerMonth);
                const totalHrs = hpd > 0 && dpm > 0 ? hpd * dpm : 0;
                const absAmt = toNum(viewedRecord.totalAbsences);
                if (!totalHrs && !hrsAbsent) return null;
                return (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</div>
                    <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/50">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-amber-100">
                          {dpm > 0 && <tr className="flex justify-between px-4 py-2"><td className="text-slate-600">Working Days / Month</td><td className="font-medium text-slate-800">{dpm}</td></tr>}
                          {hpd > 0 && <tr className="flex justify-between px-4 py-2"><td className="text-slate-600">Hours / Day</td><td className="font-medium text-slate-800">{hpd}</td></tr>}
                          {totalHrs > 0 && <tr className="flex justify-between px-4 py-2"><td className="text-slate-600">Total Hours</td><td className="font-medium text-slate-800">{totalHrs}</td></tr>}
                          {hrsAbsent > 0 && (
                            <tr className="flex justify-between px-4 py-2">
                              <td className="text-rose-600 font-medium">Hours Absent</td>
                              <td className="font-bold text-rose-700">{hrsAbsent} hrs</td>
                            </tr>
                          )}
                          {absAmt > 0 && (
                            <tr className="flex justify-between bg-rose-50 px-4 py-2">
                              <td className="text-rose-600 font-medium">Absence Deduction</td>
                              <td className="font-bold text-rose-700">-{peso(absAmt)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Earnings */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Earnings</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {toNum(viewedRecord.basicPay) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Basic Pay{toNum((viewedRecord as any).totalAbsences) > 0 ? " (prorated)" : ""}</td>
                          <td className="font-medium text-slate-800">{peso(viewedRecord.basicPay)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.totalAllowances) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Total Allowances</td>
                          <td className="font-medium text-slate-800">{peso(viewedRecord.totalAllowances)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.totalPayrollPremium) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Premiums & Overtime</td>
                          <td className="font-medium text-slate-800">{peso(viewedRecord.totalPayrollPremium)}</td>
                        </tr>
                      )}
                      {allowanceAdj.map((a, i) => (
                        <tr key={i} className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">{a.adjustmentLabel || "Adjustment"}</td>
                          <td className="font-medium text-slate-800">{peso(a.finalAmount ?? a.amount)}</td>
                        </tr>
                      ))}
                      <tr className="flex justify-between bg-slate-50 px-4 py-2.5">
                        <td className="font-semibold text-slate-700">Gross Pay</td>
                        <td className="font-bold text-slate-900">{peso(viewedRecord.grossPay)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Deductions</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {toNum(viewedRecord.totalAbsences) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Tardiness / Absences</td>
                          <td className="text-rose-700 font-medium">{peso(viewedRecord.totalAbsences)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.withholdingTax) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Withholding Tax</td>
                          <td className="text-slate-800">{peso(viewedRecord.withholdingTax)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.sssEe) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">SSS</td>
                          <td className="text-slate-800">{peso(viewedRecord.sssEe)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.philhealthEe) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">PhilHealth</td>
                          <td className="text-slate-800">{peso(viewedRecord.philhealthEe)}</td>
                        </tr>
                      )}
                      {toNum(viewedRecord.pagibigEe) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Pag-IBIG</td>
                          <td className="text-slate-800">{peso(viewedRecord.pagibigEe)}</td>
                        </tr>
                      )}
                      {(() => {
                        const src = viewedRecord as any;
                        const loans = [
                          { name: "SSS Loan Repayment", amt: toNum(src.sssLoanRepayment) },
                          { name: "HDMF Loan Repayment", amt: toNum(src.hdmfLoanRepayment) },
                        ].filter((l) => l.amt > 0);
                        const customLoanDeds = (viewedRecord.customDeductions || []).filter((d) => toNum(d.amount) > 0);
                        const allLoanItems = [
                          ...loans.map((l) => ({ name: l.name, amount: l.amt })),
                          ...customLoanDeds.map((d) => ({ name: d.name, amount: toNum(d.amount) })),
                        ];
                        if (!allLoanItems.length) return null;
                        return (
                          <>
                            <tr className="flex px-4 py-1.5 bg-amber-50"><td className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Loan Deductions</td></tr>
                            {allLoanItems.map((l, i) => (
                              <tr key={i} className="flex justify-between px-4 py-2">
                                <td className="text-slate-600 pl-2">{l.name}</td>
                                <td className="text-slate-800">{peso(l.amount)}</td>
                              </tr>
                            ))}
                          </>
                        );
                      })()}
                      {toNum((viewedRecord as any).employeeAdvances) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Payroll Advances</td>
                          <td className="text-slate-800">{peso((viewedRecord as any).employeeAdvances)}</td>
                        </tr>
                      )}
                      {toNum((viewedRecord as any).cashAdvances) > 0 && (
                        <tr className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">Cash Advances</td>
                          <td className="text-slate-800">{peso((viewedRecord as any).cashAdvances)}</td>
                        </tr>
                      )}
                      {deductionAdj.map((a, i) => (
                        <tr key={i} className="flex justify-between px-4 py-2">
                          <td className="text-slate-600">{a.adjustmentLabel || "Deduction"}</td>
                          <td className="text-slate-800">{peso(a.finalAmount ?? a.amount)}</td>
                        </tr>
                      ))}
                      <tr className="flex justify-between bg-slate-50 px-4 py-2.5">
                        <td className="font-semibold text-slate-700">Total Deductions</td>
                        <td className="font-bold text-rose-700">{peso(viewedRecord.totalDeductions)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Net Pay */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-emerald-800">Net Pay</div>
                  <div className="text-xl font-bold text-emerald-700">{peso(viewedRecord.adjustedNetPay ?? viewedRecord.netPay)}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handlePrintPayslip(viewedRecord)}
                  className="flex items-center gap-2 rounded-lg bg-[#0a4f8f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]"
                >
                  <Printer className="h-4 w-4" />
                  Print Payslip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
