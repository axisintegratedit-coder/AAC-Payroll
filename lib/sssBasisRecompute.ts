import {
  computeStatutory,
  type StatutorySettings,
  type EffectiveSSSConfig,
} from "./statutory";
import { computeWithholdingTaxByFrequency } from "./withholdingTax";

// Recompute a saved payroll record's SSS (and the fields that depend on it) when the SSS contribution
// basis changes. SSS enters the taxable base and net pay LINEARLY, so we apply the SSS delta exactly
// and recompute withholding tax fresh from the new taxable income — no need to re-derive the whole
// row. PHIC/HDMF are unaffected by the SSS basis, so they are untouched.

export type SssRecomputableRecord = {
  // Figures needed to re-bracket SSS.
  basicPay?: number; // per-cutoff basic AFTER proration
  totalAbsences?: number; // basicPay + totalAbsences ≈ full per-cutoff basic (engine's grossBasic)
  grossPay?: number; // per-cutoff gross pay
  payrollFrequency?: string;
  payrollDate?: string;
  // Current stored contribution + tax fields.
  sssEe?: number;
  sssMonthlySalaryCredit?: number;
  taxableIncome?: number;
  withholdingTax?: number;
  totalGovtEmployeeContrib?: number;
  totalDeductions?: number;
  netPay?: number;
};

function n(value: unknown): number {
  return Number(value) || 0;
}
function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export type SssRecomputeResult = {
  changed: boolean;
  patch: Partial<{
    sssEe: number;
    sssMonthlySalaryCredit: number;
    taxableIncome: number;
    withholdingTax: number;
    totalGovtEmployeeContrib: number;
    totalDeductions: number;
    netPay: number;
    statutorySettingsEffectiveFrom: string;
  }>;
};

// Returns a minimal patch (only the fields that change). Deterministic: same record + settings always
// yields the same result, so re-running is safe.
export function recomputeSssForRecord(
  record: SssRecomputableRecord,
  settings: StatutorySettings,
  sssConfig: EffectiveSSSConfig
): SssRecomputeResult {
  const fullBasicPay = round2(n(record.basicPay) + n(record.totalAbsences));
  const grossPay = n(record.grossPay);

  const statutory = computeStatutory(
    {
      grossBasic: fullBasicPay,
      grossPay,
      // Absence/late and adjustments are already baked into the saved basic/gross figures; the basis
      // switch only changes WHICH figure sets the MSC. We do not re-net here to avoid double-counting.
      absenceLateOnBasic: 0,
      basicAdjustments: 0,
      payDate: record.payrollDate,
      runType: "regular",
      hasAttendance: fullBasicPay > 0,
    },
    settings,
    sssConfig
  );

  const oldSss = round2(n(record.sssEe));
  const newSss = round2(statutory.sss);
  const deltaSss = round2(newSss - oldSss);

  if (deltaSss === 0 && (record.sssMonthlySalaryCredit ?? 0) === statutory.sssMsc) {
    return { changed: false, patch: {} };
  }

  // SSS is subtracted in the taxable base, so a higher SSS lowers taxable income by the same delta.
  const newTaxableIncome = Math.max(0, round2(n(record.taxableIncome) - deltaSss));
  const newWithholdingTax = round2(computeWithholdingTaxByFrequency(newTaxableIncome, record.payrollFrequency || ""));
  const deltaWht = round2(newWithholdingTax - n(record.withholdingTax));

  const newTotalGovtEE = round2(n(record.totalGovtEmployeeContrib) + deltaSss);
  const newTotalDeductions = round2(n(record.totalDeductions) + deltaSss + deltaWht);
  const newNetPay = Math.max(0, round2(n(record.netPay) - deltaSss - deltaWht));

  return {
    changed: true,
    patch: {
      sssEe: newSss,
      sssMonthlySalaryCredit: statutory.sssMsc,
      taxableIncome: newTaxableIncome,
      withholdingTax: newWithholdingTax,
      totalGovtEmployeeContrib: newTotalGovtEE,
      totalDeductions: newTotalDeductions,
      netPay: newNetPay,
      statutorySettingsEffectiveFrom: statutory.settingsEffectiveFrom,
    },
  };
}
