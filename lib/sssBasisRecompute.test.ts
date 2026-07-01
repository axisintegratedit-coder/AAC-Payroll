import { describe, it, expect } from "vitest";
import { recomputeSssForRecord } from "./sssBasisRecompute";
import { SEED_EFFECTIVE_SSS_CONFIG, SEED_STATUTORY_SETTINGS } from "./statutory";

const sssConfig = SEED_EFFECTIVE_SSS_CONFIG;

// A saved semi-monthly Draft record originally computed on BASIC (10,150 -> MSC 10,000 -> SSS 500).
const baseRecord = {
  basicPay: 10150,
  totalAbsences: 0,
  grossPay: 30000, // includes OT/allowances
  payrollFrequency: "Semi-monthly",
  sssEe: 500,
  sssMonthlySalaryCredit: 10000,
  taxableIncome: 24500, // gross 30000 - contributions etc. (illustrative)
  withholdingTax: 3200,
  totalGovtEmployeeContrib: 1200,
  totalDeductions: 4400,
  netPay: 25600,
};

describe("recomputeSssForRecord", () => {
  it("no change when basis stays 'basic'", () => {
    const r = recomputeSssForRecord(baseRecord, SEED_STATUTORY_SETTINGS, sssConfig);
    expect(r.changed).toBe(false);
    expect(r.patch).toEqual({});
  });

  it("switching to 'gross' re-brackets SSS on gross and cascades tax/net", () => {
    const grossSettings = { ...SEED_STATUTORY_SETTINGS, sssContributionBasis: "gross" as const };
    const r = recomputeSssForRecord(baseRecord, grossSettings, sssConfig);
    expect(r.changed).toBe(true);
    // gross 30,000 -> MSC 30,000 -> SSS 1,500. delta +1,000.
    expect(r.patch.sssEe).toBe(1500);
    expect(r.patch.sssMonthlySalaryCredit).toBe(30000);
    expect(r.patch.totalGovtEmployeeContrib).toBe(2200); // 1200 + 1000
    // taxable drops by the SSS delta (1000) -> 23,500.
    expect(r.patch.taxableIncome).toBe(23500);
    // net drops by deltaSss + deltaWht (both increase deductions).
    expect(r.patch.netPay!).toBeLessThan(25600);
  });

  it("net pay floors at 0", () => {
    const grossSettings = { ...SEED_STATUTORY_SETTINGS, sssContributionBasis: "gross" as const };
    const tiny = { ...baseRecord, netPay: 100, totalDeductions: 100 };
    const r = recomputeSssForRecord(tiny, grossSettings, sssConfig);
    expect(r.patch.netPay).toBe(0);
  });

  it("zero-skip: basic 0 -> SSS 0 even on gross basis", () => {
    const grossSettings = { ...SEED_STATUTORY_SETTINGS, sssContributionBasis: "gross" as const };
    const noBasic = { ...baseRecord, basicPay: 0, totalAbsences: 0, sssEe: 500 };
    const r = recomputeSssForRecord(noBasic, grossSettings, sssConfig);
    expect(r.patch.sssEe).toBe(0);
  });
});
