import type ExcelJS from "exceljs";
import { PREMIUM_BUCKET_COLUMN_HEADERS, premiumBucketAmountsToRow } from "./premiumBuckets";

export type DetailedRecord = {
  id?: string;
  employeeNo?: string;
  employeeName?: string;
  department?: string;
  jobTitle?: string;
  designation?: string;
  position?: string;
  employmentStatus?: string;
  payrollRunType?: string;
  // attendance
  absencesHours?: number | string;
  totalAbsences?: number | string;
  importedAttendance?: { daysAbsent?: number | string };
  // earnings
  basicPay?: number | string;
  nightDifferentialAmount?: number | string;
  overtimeAmount?: number | string;
  restDayAmount?: number | string;
  specialHolidayAmount?: number | string;
  customPremiums?: { name: string; amount?: number | string }[];
  premiumBucketAmounts?: Record<string, number>;
  totalPayrollPremium?: number | string;
  riceSubsidy?: number | string;
  uniformClothing?: number | string;
  laundryAllowance?: number | string;
  medicalCashDependents?: number | string;
  actualMedicalAssistance?: number | string;
  achievementAwards?: number | string;
  christmasAnniversaryGifts?: number | string;
  mealAllowanceOTNight?: number | string;
  monetizedLeavePrivate?: number | string;
  cbaProductivityIncentives?: number | string;
  thirteenthMonthPay?: number | string;
  christmasBonus?: number | string;
  otherTaxableAllowances?: number | string;
  customAllowances?: { name: string; amount?: number | string }[];
  totalAllowances?: number | string;
  allowanceProrationDeduction?: number | string;
  grossPay?: number | string;
  // deductions
  sssEe?: number | string;
  philhealthEe?: number | string;
  pagibigEe?: number | string;
  totalGovtEmployeeContrib?: number | string;
  taxableIncome?: number | string;
  withholdingTax?: number | string;
  employeeAdvances?: number | string;
  cashAdvances?: number | string;
  sssLoanRepayment?: number | string;
  hdmfLoanRepayment?: number | string;
  taxAnnualizationAdjustment?: number | string;
  taxAnnualizationType?: "Refund" | "Additional Deduction" | "No Adjustment" | string;
  customDeductions?: { name: string; amount?: number | string }[];
  customDeductionsTotal?: number | string;
  totalDeductions?: number | string;
  // pipeline-applied lines (added beyond the system defaults)
  standingAllowanceLines?: { name?: string; amount?: number | string }[];
  deMinimisLines?: { name?: string; amount?: number | string }[];
  loanDeductions?: { name?: string; loanName?: string; loanType?: string; amount?: number | string }[];
  oneTimeCredits?: { remarks?: string; instructionType?: string; amount?: number | string }[];
  oneTimeDeductions?: { remarks?: string; instructionType?: string; amount?: number | string }[];
  // net
  adjustedNetPay?: number | string;
  netPay?: number | string;
};

function loanLabel(item: { name?: string; loanName?: string; loanType?: string }): string {
  return (item.name || item.loanName || item.loanType || "Loan Repayment").trim();
}

function lineLabel(item: { remarks?: string; instructionType?: string }, fallback: string): string {
  const remarks = (item.remarks || "").trim();
  if (remarks) return remarks;
  const type = (item.instructionType || "").trim();
  return type || fallback;
}

export type CustomNames = {
  premiums: string[];
  allowances: string[];
  deductions: string[];
  standingAllowances: string[];
  deMinimis: string[];
  loanDeductions: string[];
  oneTimeCredits: string[];
  oneTimeDeductions: string[];
  showAllowanceProration: boolean;
};

export function m(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v.replace(/[₱,\s]/g, "")); return Number.isFinite(n) ? n : 0; }
  return 0;
}

// Blend an ARGB hex toward white so data-row band tints read lighter than their header banner.
function lighten(argb: string, amount = 0.55): string {
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0").toUpperCase();
  return `FF${mix(r)}${mix(g)}${mix(b)}`;
}

export function fmtD(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function collectCustomNames(records: DetailedRecord[]): CustomNames {
  const premiums: string[] = [], allowances: string[] = [], deductions: string[] = [];
  const standingAllowances: string[] = [], deMinimis: string[] = [], loanDeductions: string[] = [], oneTimeCredits: string[] = [], oneTimeDeductions: string[] = [];
  for (const r of records) {
    for (const p of (r.customPremiums || [])) if (!premiums.includes(p.name)) premiums.push(p.name);
    for (const a of (r.customAllowances || [])) if (!allowances.includes(a.name)) allowances.push(a.name);
    for (const d of (r.customDeductions || [])) if (!deductions.includes(d.name)) deductions.push(d.name);
    for (const s of (r.standingAllowanceLines || [])) { const n = (s.name || "Standing Allowance").trim(); if (n && !standingAllowances.includes(n)) standingAllowances.push(n); }
    for (const dm of (r.deMinimisLines || [])) { const n = (dm.name || "De Minimis").trim(); if (n && !deMinimis.includes(n)) deMinimis.push(n); }
    for (const l of (r.loanDeductions || [])) { const n = loanLabel(l); if (n && !loanDeductions.includes(n)) loanDeductions.push(n); }
    for (const c of (r.oneTimeCredits || [])) { const n = lineLabel(c, "One-Time Credit"); if (!oneTimeCredits.includes(n)) oneTimeCredits.push(n); }
    for (const d of (r.oneTimeDeductions || [])) { const n = lineLabel(d, "One-Time Deduction"); if (!oneTimeDeductions.includes(n)) oneTimeDeductions.push(n); }
  }
  // Show the allowance-proration column only when a Payroll Type B run actually prorated allowances.
  const showAllowanceProration = records.some((r) => (r.payrollRunType === "B") && m(r.allowanceProrationDeduction) > 0);
  return { premiums, allowances, deductions, standingAllowances, deMinimis, loanDeductions, oneTimeCredits, oneTimeDeductions, showAllowanceProration };
}

// Attendance columns shown before earnings so the pay impact of absences is explicit.
export function attendanceCols(): string[] {
  return ["Days Absent", "Hrs Absent", "Absences Deduction"];
}

export type EarningBand = { label: string; cols: string[]; fg: string; bg: string };

// Earnings is split into colour-coded sub-bands so Basic Pay, Premiums, Allowances (incl. de
// minimis), one-time credits and the gross total are visually distinct.
export function earningBands(cn: CustomNames): EarningBand[] {
  return [
    { label: "BASIC PAY", fg: "FF1E5F3A", bg: "FFD7ECD9", cols: ["Basic Pay (Original)", "Basic Pay (After Absences)"] },
    { label: "PREMIUMS", fg: "FF1E3A5F", bg: "FFDCE6F4", cols: ["Night Differential", "Overtime", "Rest Day", "Special Holiday", ...cn.premiums, "Total Premiums"] },
    // Granular per-bucket premium pesos (columns L–AP from the Sprout attendance upload). These are
    // a reference breakdown only — intentionally NOT summed into Total Premiums above.
    { label: "PREMIUM BREAKDOWN (₱)", fg: "FF1E3A5F", bg: "FFEAF1FA", cols: [...PREMIUM_BUCKET_COLUMN_HEADERS] },
    { label: "ALLOWANCES & DE MINIMIS", fg: "FF6B4E16", bg: "FFFBF0D5", cols: [
      "Rice Subsidy", "Uniform/Clothing", "Laundry Allowance", "Medical Cash (Deps)",
      "Actual Medical Assist.", "Achievement Awards", "Christmas/Anniv. Gifts",
      "Meal Allowance", "Monetized Leave", "CBA/Productivity",
      "13th Month Pay", "Christmas Bonus", "Other Taxable Allow.",
      ...cn.deMinimis, ...cn.allowances, ...cn.standingAllowances,
      "Total Allowances (Unadjusted)",
      ...(cn.showAllowanceProration ? ["Allowance Proration Deduction (B)", "Total Allowances (Adjusted)"] : []),
    ] },
    ...(cn.oneTimeCredits.length ? [{ label: "ONE-TIME ADDITIONS", fg: "FF2E5A2E", bg: "FFE6F4DD", cols: [...cn.oneTimeCredits, "Total One-Time Additions"] } as EarningBand] : []),
    { label: "GROSS", fg: "FF1E5F3A", bg: "FFC9E5CC", cols: ["GROSS PAY"] },
  ];
}

export function earningCols(cn: CustomNames): string[] {
  return earningBands(cn).flatMap((band) => band.cols);
}

export function deductionBands(cn: CustomNames): EarningBand[] {
  return [
    { label: "STATUTORY & TAX", fg: "FF5F1E1E", bg: "FFF6DDD6", cols: [
      "SSS (EE)", "PhilHealth (EE)", "Pag-IBIG (EE)", "Withholding Tax",
      "Total Statutory & Tax",
    ] },
    { label: "OTHER DEDUCTIONS", fg: "FF7A2E2E", bg: "FFFCE9E2", cols: [
      "Employee Advances", "Cash Advances", "SSS Loan", "HDMF Loan",
      ...cn.loanDeductions,
      ...cn.deductions,
      "Total Other Deductions",
    ] },
    ...(cn.oneTimeDeductions.length
      ? [{ label: "ONE-TIME DEDUCTIONS", fg: "FF8A3A1E", bg: "FFFBE3D2", cols: [...cn.oneTimeDeductions, "Total One-Time Deductions"] } as EarningBand]
      : []),
    { label: "TOTAL", fg: "FF5F1E1E", bg: "FFF1CFC5", cols: ["Total Deductions"] },
  ];
}

// Items applied AFTER total deductions to arrive at net pay: signed tax-annualization adjustment
// (Refund adds, Additional Deduction subtracts) plus one-time credits. Kept separate so
// Net = Gross − Total Deductions + Tax Adjustment + One-Time Credits reconciles on the face of the sheet.
export function netAdjustmentCols(): string[] {
  return ["Tax Annualization Adj. (±)", "Net Pay"];
}

export function deductionCols(cn: CustomNames): string[] {
  return deductionBands(cn).flatMap((band) => band.cols);
}

// Fixed employee-info columns shared by the Excel export and the on-screen detailed view.
export function infoCols(): string[] {
  return ["#", "Employee No.", "Employee Name", "Department", "Position", "Payroll Type", "Payroll Schedule", "Pay Date", "Taxable Income (ref)"];
}

// One section header band (used to draw the coloured group banners on screen and in Excel).
export type DetailedSection = { label: string; cols: string[]; fg: string; bg: string };

export function detailedSections(cn: CustomNames): DetailedSection[] {
  return [
    { label: "EMPLOYEE INFORMATION", fg: "FF1E3A5F", bg: "FFD9E1F2", cols: infoCols() },
    { label: "ATTENDANCE", fg: "FF7A4A00", bg: "FFFDE9CE", cols: attendanceCols() },
    ...earningBands(cn),
    ...deductionBands(cn),
    { label: "NET PAY", fg: "FF3A1E5F", bg: "FFFFF2CC", cols: netAdjustmentCols() },
  ];
}

export function detailedHeaders(cn: CustomNames): string[] {
  return detailedSections(cn).flatMap((s) => s.cols);
}

// Columns that hold text (left-aligned) rather than numbers; everything else is a peso amount.
const TEXT_COLUMNS = new Set([
  "#", "Employee No.", "Employee Name", "Department", "Position", "Payroll Type", "Payroll Schedule", "Pay Date",
]);

export function isTextColumn(header: string): boolean {
  return TEXT_COLUMNS.has(header);
}

// Compute the ordered cell values for one record. Single source of truth shared by Excel + UI so the
// on-screen detailed view always matches the exported workbook exactly.
export function computeDetailedRowValues(
  r: DetailedRecord,
  cn: CustomNames,
  index: number,
  period: string,
  payDate: string
): (string | number)[] {
  const cpV = cn.premiums.map((n) => { const f = (r.customPremiums || []).find((p) => p.name === n); return f ? m(f.amount) : 0; });
  const caV = cn.allowances.map((n) => { const f = (r.customAllowances || []).find((a) => a.name === n); return f ? m(f.amount) : 0; });
  const cdV = cn.deductions.map((n) => { const f = (r.customDeductions || []).find((d) => d.name === n); return f ? m(f.amount) : 0; });
  const saV = cn.standingAllowances.map((n) => { const f = (r.standingAllowanceLines || []).find((s) => (s.name || "Standing Allowance").trim() === n); return f ? m(f.amount) : 0; });
  const dmV = cn.deMinimis.map((n) => { const f = (r.deMinimisLines || []).find((d) => (d.name || "De Minimis").trim() === n); return f ? m(f.amount) : 0; });
  const ldV = cn.loanDeductions.map((n) => { const f = (r.loanDeductions || []).find((l) => loanLabel(l) === n); return f ? m(f.amount) : 0; });
  const ocV = cn.oneTimeCredits.map((n) => { const f = (r.oneTimeCredits || []).find((c) => lineLabel(c, "One-Time Credit") === n); return f ? m(f.amount) : 0; });
  const odV = cn.oneTimeDeductions.map((n) => { const f = (r.oneTimeDeductions || []).find((d) => lineLabel(d, "One-Time Deduction") === n); return f ? m(f.amount) : 0; });

  const daysAbsent = m(r.importedAttendance?.daysAbsent);
  const hrsAbsent = m(r.absencesHours);
  const absenceDeduction = m(r.totalAbsences);
  const basicAfterAbsences = m(r.basicPay);
  const basicOriginal = basicAfterAbsences + absenceDeduction;

  const premiumFixed = m(r.nightDifferentialAmount) + m(r.overtimeAmount) + m(r.restDayAmount) + m(r.specialHolidayAmount);
  const totalPremiums = premiumFixed + cpV.reduce((s, v) => s + v, 0);
  const allowanceFixed =
    m(r.riceSubsidy) + m(r.uniformClothing) + m(r.laundryAllowance) + m(r.medicalCashDependents) +
    m(r.actualMedicalAssistance) + m(r.achievementAwards) + m(r.christmasAnniversaryGifts) +
    m(r.mealAllowanceOTNight) + m(r.monetizedLeavePrivate) + m(r.cbaProductivityIncentives) +
    m(r.thirteenthMonthPay) + m(r.christmasBonus) + m(r.otherTaxableAllowances);
  const totalAllowancesUnadjusted =
    allowanceFixed + dmV.reduce((s, v) => s + v, 0) + caV.reduce((s, v) => s + v, 0) + saV.reduce((s, v) => s + v, 0);
  const allowanceProrationDeduction = cn.showAllowanceProration ? m(r.allowanceProrationDeduction) : 0;
  const totalAllowancesAdjusted = Math.max(0, totalAllowancesUnadjusted - allowanceProrationDeduction);
  const oneTimeCreditTotal = ocV.reduce((s, v) => s + v, 0);
  const gross = basicAfterAbsences + totalPremiums + totalAllowancesAdjusted;

  // Each deduction section ends with its own subtotal; Total Deductions = sum of the subtotals,
  // so every total equals the sum of the columns in its section.
  const totalStatutoryTax = m(r.sssEe) + m(r.philhealthEe) + m(r.pagibigEe) + m(r.withholdingTax);
  const totalOtherDeductions =
    m(r.employeeAdvances) + m(r.cashAdvances) + m(r.sssLoanRepayment) + m(r.hdmfLoanRepayment) +
    ldV.reduce((s, v) => s + v, 0) + cdV.reduce((s, v) => s + v, 0);
  const totalOneTimeDeductions = odV.reduce((s, v) => s + v, 0);
  const totalDeductions = totalStatutoryTax + totalOtherDeductions + totalOneTimeDeductions;

  const taxAdjAmount = m(r.taxAnnualizationAdjustment);
  const taxAdjSigned = r.taxAnnualizationType === "Refund" ? taxAdjAmount : r.taxAnnualizationType === "Additional Deduction" ? -taxAdjAmount : 0;
  const net = Math.max(0, gross - totalDeductions + taxAdjSigned + oneTimeCreditTotal);

  return [
    index + 1, r.employeeNo || "—", r.employeeName || "—", r.department || "—",
    r.jobTitle || r.designation || r.position || r.employmentStatus || "—",
    r.payrollRunType || "—",
    period, fmtD(payDate), m(r.taxableIncome),
    daysAbsent, hrsAbsent, absenceDeduction,
    basicOriginal, basicAfterAbsences, m(r.nightDifferentialAmount), m(r.overtimeAmount), m(r.restDayAmount), m(r.specialHolidayAmount),
    ...cpV, totalPremiums,
    ...premiumBucketAmountsToRow(r.premiumBucketAmounts),
    m(r.riceSubsidy), m(r.uniformClothing), m(r.laundryAllowance), m(r.medicalCashDependents),
    m(r.actualMedicalAssistance), m(r.achievementAwards), m(r.christmasAnniversaryGifts),
    m(r.mealAllowanceOTNight), m(r.monetizedLeavePrivate), m(r.cbaProductivityIncentives),
    m(r.thirteenthMonthPay), m(r.christmasBonus), m(r.otherTaxableAllowances),
    ...dmV, ...caV, ...saV,
    totalAllowancesUnadjusted,
    ...(cn.showAllowanceProration ? [allowanceProrationDeduction, totalAllowancesAdjusted] : []),
    ...(cn.oneTimeCredits.length ? [...ocV, oneTimeCreditTotal] : []),
    gross,
    m(r.sssEe), m(r.philhealthEe), m(r.pagibigEe), m(r.withholdingTax), totalStatutoryTax,
    m(r.employeeAdvances), m(r.cashAdvances), m(r.sssLoanRepayment), m(r.hdmfLoanRepayment),
    ...ldV, ...cdV, totalOtherDeductions,
    ...(cn.oneTimeDeductions.length ? [...odV, totalOneTimeDeductions] : []),
    totalDeductions,
    taxAdjSigned, net,
  ];
}

export function buildDetailedSheet(
  ws: ExcelJS.Worksheet,
  records: DetailedRecord[],
  opts: { title: string; companyName: string; period: string; payDate: string; approvalStatus: string; cn: CustomNames }
) {
  const { title, companyName, period, payDate, approvalStatus, cn } = opts;

  const thin: ExcelJS.Border = { style: "thin", color: { argb: "FF000000" } };
  const bdr: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
  const base: Partial<ExcelJS.Font> = { name: "Times New Roman", size: 11 };
  const bold: Partial<ExcelJS.Font> = { ...base, bold: true };

  const aHdrs = attendanceCols();
  const eHdrs = earningCols(cn);
  const dHdrs = deductionCols(cn);
  const allHeadersList = detailedHeaders(cn);
  const INFO = infoCols().length;
  const ATT = aHdrs.length;
  const nHdrs = netAdjustmentCols();
  const total = INFO + ATT + eHdrs.length + dHdrs.length + nHdrs.length;

  ws.columns = [
    6, 13, 28, 20, 20, 12, 16, 14, 14,
    ...aHdrs.map((h) => Math.min(Math.max(h.length * 0.9, 11), 16)),
    ...eHdrs.map((h) => Math.min(Math.max(h.length * 0.9, 13), 18)),
    ...dHdrs.map((h) => Math.min(Math.max(h.length * 0.9, 13), 18)),
    18, 14,
  ].map((w) => ({ width: w }));

  const tRow = (rn: number, val: string, b = false, sz = 11) => {
    ws.mergeCells(rn, 1, rn, total);
    const row = ws.getRow(rn);
    for (let c = 1; c <= total; c++) row.getCell(c).border = bdr;
    const cell = row.getCell(1);
    cell.value = val;
    cell.font = { name: "Times New Roman", bold: b, size: sz };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    row.height = b ? 24 : 18;
  };
  tRow(1, companyName || "Company", true, 14);
  tRow(2, "PAYROLL REGISTER — DETAILED", true, 13);
  tRow(3, `Pay Period: ${title}`);
  tRow(4, `Payroll Schedule: ${period}     Pay Date: ${fmtD(payDate)}     Status: ${approvalStatus}`);

  // Row 5: section banners
  const aStart = INFO + 1;
  const eStart = INFO + ATT + 1;
  const dStart = INFO + ATT + eHdrs.length + 1;
  const nStart = INFO + ATT + eHdrs.length + dHdrs.length + 1; // net-adjustment band start
  const npCol = total; // Net Pay (last column)
  const r5 = ws.getRow(5);
  r5.height = 20;

  const section = (s: number, e: number, label: string, fg: string, bg: string) => {
    ws.mergeCells(5, s, 5, e);
    const cell = r5.getCell(s);
    cell.value = label;
    cell.font = { name: "Times New Roman", bold: true, size: 11, color: { argb: fg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = s; c <= e; c++) r5.getCell(c).border = bdr;
  };
  section(1, INFO, "EMPLOYEE INFORMATION", "FF1E3A5F", "FFD9E1F2");
  section(aStart, aStart + ATT - 1, "ATTENDANCE", "FF7A4A00", "FFFDE9CE");

  // Earnings and deductions are drawn as coloured sub-bands; build a per-column colour map so the
  // banner, header and data cells all share the same band colour.
  const eBands = earningBands(cn);
  const dBands = deductionBands(cn);
  const colBg = new Map<number, string>();
  let cursor = eStart;
  for (const band of eBands) {
    section(cursor, cursor + band.cols.length - 1, band.label, band.fg, band.bg);
    for (let c = cursor; c < cursor + band.cols.length; c++) colBg.set(c, band.bg);
    cursor += band.cols.length;
  }
  cursor = dStart;
  for (const band of dBands) {
    section(cursor, cursor + band.cols.length - 1, band.label, band.fg, band.bg);
    for (let c = cursor; c < cursor + band.cols.length; c++) colBg.set(c, band.bg);
    cursor += band.cols.length;
  }
  // NET band spans the signed tax adjustment + the final net pay.
  section(nStart, total, "NET PAY", "FF3A1E5F", "FFFFF2CC");
  for (let c = nStart; c <= total; c++) colBg.set(c, "FFFFF2CC");

  // Row 6: column headers
  ws.views = [{ state: "frozen", ySplit: 6 }];
  const allH = allHeadersList;
  const r6 = ws.getRow(6);
  r6.height = 36;
  allH.forEach((h, i) => {
    const cell = r6.getCell(i + 1);
    cell.value = h;
    cell.font = bold;
    const col = i + 1;
    let bg = "FFD9E1F2";
    if (col >= aStart && col < eStart) bg = "FFFDE9CE";
    if (col >= eStart) bg = colBg.get(col) || bg;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    cell.border = bdr;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Data rows
  const DS = 7;
  records.forEach((r, idx) => {
    const row = ws.getRow(DS + idx);
    const vals = computeDetailedRowValues(r, cn, idx, period, payDate);

    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      const col = i + 1;
      const text = isTextColumn(allHeadersList[i] || "");
      cell.value = v;
      cell.font = (i === vals.length - 1) ? bold : base;
      cell.border = bdr;
      cell.alignment = { horizontal: text ? (i === 0 ? "center" : "left") : "right", vertical: "middle" };
      if (!text) cell.numFmt = "#,##0.00";
      // Tint earnings/deduction data cells with a light version of their band colour for grouping.
      const band = colBg.get(col);
      if (band) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lighten(band) } };
    });
    row.height = 18;
  });

  // Totals row
  const totN = DS + records.length;
  const totRow = ws.getRow(totN);
  totRow.height = 20;
  ws.mergeCells(totN, 1, totN, INFO);
  const tl = totRow.getCell(1);
  tl.value = `TOTAL — ${records.length} employee${records.length !== 1 ? "s" : ""}`;
  tl.font = bold;
  tl.alignment = { horizontal: "center", vertical: "middle" };
  tl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  for (let c = 1; c <= INFO; c++) totRow.getCell(c).border = bdr;
  for (let c = INFO + 1; c <= total; c++) {
    const cell = totRow.getCell(c);
    const L = ws.getColumn(c).letter;
    cell.value = { formula: `SUM(${L}${DS}:${L}${totN - 1})` };
    cell.font = bold;
    cell.border = bdr;
    cell.numFmt = "#,##0.00";
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  }
}

export type ExportablePayrollRun = {
  id: string;
  title: string;
  period: string;
  payDate: string;
  approvalStatus: string;
  records: DetailedRecord[];
};

function safeSheetName(title: string, index: number): string {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ] characters, must be unique.
  const cleaned = (title || `Run ${index + 1}`).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) || `Run ${index + 1}`;
  return `${cleaned}`;
}

/**
 * Build and download a detailed payroll workbook — one worksheet per run. Shared by the admin and
 * client portals so both produce the identical detailed register that the run-detail page exports.
 */
export async function exportPayrollRunsToExcel(
  runs: ExportablePayrollRun[],
  opts: { companyName: string; fileLabel?: string }
): Promise<void> {
  const ExcelJSMod = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");
  const wb = new ExcelJSMod.Workbook();

  const usedNames = new Set<string>();
  runs.forEach((run, index) => {
    let name = safeSheetName(run.title, index);
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) {
      name = `${name.slice(0, 28)} ${suffix++}`;
    }
    usedNames.add(name.toLowerCase());
    const ws = wb.addWorksheet(name);
    const cn = collectCustomNames(run.records);
    buildDetailedSheet(ws, run.records, {
      title: run.title,
      companyName: opts.companyName,
      period: run.period,
      payDate: run.payDate,
      approvalStatus: run.approvalStatus,
      cn,
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const baseLabel =
    opts.fileLabel ||
    (runs.length === 1
      ? runs[0].title.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_")
      : `${runs.length}_Payroll_Runs`);
  saveAs(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `Payroll_Detailed_${baseLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
