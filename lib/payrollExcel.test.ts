import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { collectCustomNames, earningCols, deductionCols, attendanceCols, buildDetailedSheet, detailedHeaders, detailedSections, computeDetailedRowValues, type DetailedRecord } from "./payrollExcel";

const recordWithExtras: DetailedRecord = {
  employeeNo: "190719-447",
  employeeName: "Sample, A Sample",
  department: "Reprofiling",
  payrollRunType: "B",
  basicPay: 20251,
  totalAbsences: 8000,
  absencesHours: 88,
  importedAttendance: { daysAbsent: 11 },
  sssEe: 875,
  philhealthEe: 506.27,
  pagibigEe: 200,
  withholdingTax: 2398.04,
  sssLoanRepayment: 300,
  taxAnnualizationAdjustment: 1000,
  taxAnnualizationType: "Refund",
  allowanceProrationDeduction: 120,
  standingAllowanceLines: [{ name: "Internet Allowance", amount: 1000 }],
  deMinimisLines: [{ name: "De Minimis Allowance", amount: 5000 }],
  loanDeductions: [{ loanName: "Company Loan", amount: 500 }],
  oneTimeCredits: [
    { remarks: "Tax Refund", amount: 13333 },
    { remarks: "PTO", amount: 2532 },
  ],
  oneTimeDeductions: [{ remarks: "Uniform Damage", amount: 250 }],
};

describe("payrollExcel custom name collection", () => {
  it("collects standing allowances and one-time credit/deduction labels", () => {
    const cn = collectCustomNames([recordWithExtras]);
    expect(cn.standingAllowances).toContain("Internet Allowance");
    expect(cn.oneTimeCredits).toEqual(expect.arrayContaining(["Tax Refund", "PTO"]));
    expect(cn.oneTimeDeductions).toContain("Uniform Damage");
  });

  it("collects de minimis benefit names", () => {
    const cn = collectCustomNames([recordWithExtras]);
    expect(cn.deMinimis).toContain("De Minimis Allowance");
  });

  it("includes attendance columns and the added lines in the column set", () => {
    const cn = collectCustomNames([recordWithExtras]);
    expect(attendanceCols()).toEqual(["Days Absent", "Hrs Absent", "Absences Deduction"]);
    expect(earningCols(cn)).toEqual(expect.arrayContaining([
      "Basic Pay (Original)", "Basic Pay (After Absences)",
      "De Minimis Allowance", "Internet Allowance", "Tax Refund", "PTO",
    ]));
    expect(deductionCols(cn)).toContain("Uniform Damage");
  });
});

describe("payrollExcel sheet build", () => {
  it("writes attendance + added-line values into the data row", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Test");
    const cn = collectCustomNames([recordWithExtras]);
    buildDetailedSheet(ws, [recordWithExtras], {
      title: "Dec 2026 15th",
      companyName: "Boldr",
      period: "15th",
      payDate: "2026-12-15",
      approvalStatus: "Draft",
      cn,
    });

    const header = ws.getRow(6).values as (string | undefined)[];
    const flatHeader = header.filter(Boolean) as string[];
    expect(flatHeader).toContain("Payroll Type");
    expect(flatHeader).toContain("Hrs Absent");
    expect(flatHeader).toContain("Absences Deduction");
    expect(flatHeader).toContain("Basic Pay (Original)");
    expect(flatHeader).toContain("Basic Pay (After Absences)");
    expect(flatHeader).toContain("De Minimis Allowance");
    expect(flatHeader).toContain("Internet Allowance");
    expect(flatHeader).toContain("Tax Refund");
    expect(flatHeader).toContain("Uniform Damage");

    // Data row 7: locate cells by header position.
    const dataRow = ws.getRow(7);
    const colOf = (name: string) => flatHeader.indexOf(name) + 1;
    expect(dataRow.getCell(colOf("Payroll Type")).value).toBe("B");
    expect(dataRow.getCell(colOf("Days Absent")).value).toBe(11);
    expect(dataRow.getCell(colOf("Hrs Absent")).value).toBe(88);
    expect(dataRow.getCell(colOf("Absences Deduction")).value).toBe(8000);
    // Original = after-absences (20251) + absence deduction (8000).
    expect(dataRow.getCell(colOf("Basic Pay (After Absences)")).value).toBe(20251);
    expect(dataRow.getCell(colOf("Basic Pay (Original)")).value).toBe(28251);
    expect(dataRow.getCell(colOf("De Minimis Allowance")).value).toBe(5000);
    expect(dataRow.getCell(colOf("Internet Allowance")).value).toBe(1000);
    expect(dataRow.getCell(colOf("Tax Refund")).value).toBe(13333);
    expect(dataRow.getCell(colOf("Uniform Damage")).value).toBe(250);
    // Unadjusted total = de minimis 5000 + Internet 1000.
    expect(dataRow.getCell(colOf("Total Allowances (Unadjusted)")).value).toBe(6000);
    // Payroll Type B shows the proration deduction AND the adjusted total in their own columns.
    expect(flatHeader).toContain("Allowance Proration Deduction (B)");
    expect(flatHeader).toContain("Total Allowances (Adjusted)");
    expect(dataRow.getCell(colOf("Allowance Proration Deduction (B)")).value).toBe(120);
    expect(dataRow.getCell(colOf("Total Allowances (Adjusted)")).value).toBe(6000 - 120);
    // GROSS uses the ADJUSTED allowances; one-time credits are NOT in gross.
    const gross = 20251 + 0 + (6000 - 120);
    expect(dataRow.getCell(colOf("GROSS PAY")).value).toBe(gross);

    // Total Deductions = govt EE (1581.27) + WHT (2398.04) + SSS loan (300) + company loan (500) + one-time ded (250).
    const totalDeductions = (875 + 506.27 + 200) + 2398.04 + 300 + 500 + 250;
    expect(dataRow.getCell(colOf("Total Deductions")).value).toBeCloseTo(totalDeductions, 2);

    // Tax refund is a positive net adjustment.
    expect(dataRow.getCell(colOf("Tax Annualization Adj. (±)")).value).toBe(1000);

    // NET reconciles on the face of the sheet: Gross − Deductions + Tax Adj + One-Time Credits.
    const credits = 13333 + 2532;
    const expectedNet = gross - totalDeductions + 1000 + credits;
    expect(dataRow.getCell(colOf("Net Pay")).value).toBeCloseTo(expectedNet, 2);

    // Section subtotals each equal the sum of their own columns.
    expect(dataRow.getCell(colOf("Total Premiums")).value).toBe(0);
    expect(dataRow.getCell(colOf("Total One-Time Additions")).value).toBe(13333 + 2532);
    expect(dataRow.getCell(colOf("Total Statutory & Tax")).value).toBeCloseTo(875 + 506.27 + 200 + 2398.04, 2);
    expect(dataRow.getCell(colOf("Total Other Deductions")).value).toBeCloseTo(300 + 500, 2);
    expect(dataRow.getCell(colOf("Total One-Time Deductions")).value).toBe(250);
    // Taxable Income moved to the info area as a reference column.
    expect(flatHeader).toContain("Taxable Income (ref)");
  });

  it("headers and row values stay aligned, and section subtotals equal the sum of their columns", () => {
    const cn = collectCustomNames([recordWithExtras]);
    const headers = detailedHeaders(cn);
    const values = computeDetailedRowValues(recordWithExtras, cn, 0, "15th", "2026-12-15");
    expect(values.length).toBe(headers.length);

    const idx = (name: string) => headers.indexOf(name);
    const sumRange = (cols: string[]) => cols.reduce((s, c) => s + (Number(values[idx(c)]) || 0), 0);

    // Each section's subtotal column == sum of the preceding line columns in that section.
    for (const section of detailedSections(cn)) {
      const subtotalCol = section.cols.find((c) => /^Total /.test(c));
      if (!subtotalCol) continue;
      const lineCols = section.cols.filter((c) => c !== subtotalCol && !/Adjusted|Proration|Unadjusted/.test(c));
      if (!lineCols.length) continue;
      expect(Number(values[idx(subtotalCol)])).toBeCloseTo(sumRange(lineCols), 2);
    }
  });

  it("emits the 31 per-bucket premium peso columns (L–AP) without affecting Total Premiums", () => {
    const rec: DetailedRecord = {
      ...recordWithExtras,
      totalPayrollPremium: 0,
      premiumBucketAmounts: { "Ord-OT": 1250, "RD-ND-OT": 845 },
    };
    const cn = collectCustomNames([rec]);
    const headers = detailedHeaders(cn);
    const values = computeDetailedRowValues(rec, cn, 0, "15th", "2026-12-15");
    expect(values.length).toBe(headers.length);

    // The granular bucket columns carry the per-bucket pesos...
    const idx = (name: string) => headers.indexOf(name);
    expect(headers).toContain("Ord-OT (₱)");
    expect(headers).toContain("DH-RD-ND-OT (₱)");
    expect(values[idx("Ord-OT (₱)")]).toBe(1250);
    expect(values[idx("RD-ND-OT (₱)")]).toBe(845);
    // ...but Total Premiums stays at its independently-computed value (display-only buckets).
    expect(values[idx("Total Premiums")]).toBe(0);
  });

  it("draws coloured earnings sub-band banners (basic / premiums / allowances)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Test");
    const cn = collectCustomNames([recordWithExtras]);
    buildDetailedSheet(ws, [recordWithExtras], {
      title: "Dec 2026 15th", companyName: "Boldr", period: "15th",
      payDate: "2026-12-15", approvalStatus: "Draft", cn,
    });
    const bannerRow = ws.getRow(5);
    const labels: string[] = [];
    bannerRow.eachCell((cell) => { if (typeof cell.value === "string") labels.push(cell.value); });
    expect(labels).toEqual(expect.arrayContaining([
      "BASIC PAY", "PREMIUMS", "ALLOWANCES & DE MINIMIS", "ONE-TIME ADDITIONS", "GROSS",
    ]));
  });

  it("omits the allowance-proration column for Payroll Type A (no proration of allowances)", () => {
    const cnA = collectCustomNames([{ ...recordWithExtras, payrollRunType: "A", allowanceProrationDeduction: 0 }]);
    expect(cnA.showAllowanceProration).toBe(false);
    expect(earningCols(cnA)).not.toContain("Allowance Proration Deduction (B)");
    expect(earningCols(cnA)).not.toContain("Total Allowances (Adjusted)");
    expect(earningCols(cnA)).toContain("Total Allowances (Unadjusted)");
  });
});
