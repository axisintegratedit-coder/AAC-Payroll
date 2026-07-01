// Settings-driven statutory contributions (SSS, PhilHealth, Pag-IBIG) reproducing Boldr's stated
// rules verbatim from their spec workbook ("Special Instruction" + "Remarks" sheets):
//   - SSS  : 5% of MSC, MSC bracketed from NET BASIC pay (MSC-centered ranges)
//   - PHIC : 2.5% (employee share) of GROSS BASIC pay
//   - HDMF : flat — P200/month, P100 per cutoff
//   - Zero rule: no attendance / no basic salary => NO SSS, PHIC, HDMF.
//
// Effective-dated config lives in the existing JSONB config store (no SQL schema change); each row
// and the settings object carry effectiveFrom / effectiveTo so old rows are superseded, not deleted.

// ─── SSS effective-dated bracket table (5% EE, MSC-centered ranges) ───────────

export type EffectiveSSSBracket = {
  msc: number;
  rangeMin: number; // MSC-centered: msc-250 (first bracket floors at 0)
  rangeMax: number; // msc+249.99 (last bracket caps at globalCeiling)
  eeTotal: number; // 0.05 * MSC
  erTotal: number; // 0.10 * MSC
  ecEr: number; // MSC < 15000 ? 10 : 30
  regularSsMsc: number; // min(MSC, 20000)
  mpfMsc: number; // max(MSC - 20000, 0)
};

export type EffectiveSSSConfig = {
  effectiveFrom: string; // ISO date YYYY-MM-DD
  effectiveTo: string | null; // null = open-ended (current)
  globalFloor: number; // 5000
  globalCeiling: number; // 35000
  step: number; // 500
  employeeRate: number; // 0.05
  brackets: EffectiveSSSBracket[];
};

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Build the official 2025/2026 schedule: MSC 5,000..35,000 in 500 steps, EE = 5% of MSC,
// MSC-centered ranges (range_min = MSC-250, range_max = MSC+249.99). First floors at 0, last caps.
export function buildSSSBrackets(floor = 5000, ceiling = 35000, step = 500): EffectiveSSSBracket[] {
  const brackets: EffectiveSSSBracket[] = [];
  const mscValues: number[] = [];
  for (let msc = floor; msc <= ceiling; msc += step) mscValues.push(msc);

  mscValues.forEach((msc, index) => {
    const isFirst = index === 0;
    const isLast = index === mscValues.length - 1;
    brackets.push({
      msc,
      rangeMin: isFirst ? 0 : msc - step / 2,
      rangeMax: isLast ? ceiling : msc + step / 2 - 0.01,
      eeTotal: round2(0.05 * msc),
      erTotal: round2(0.1 * msc),
      ecEr: msc < 15000 ? 10 : 30,
      regularSsMsc: Math.min(msc, 20000),
      mpfMsc: Math.max(msc - 20000, 0),
    });
  });
  return brackets;
}

export const SEED_EFFECTIVE_SSS_CONFIG: EffectiveSSSConfig = {
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  globalFloor: 5000,
  globalCeiling: 35000,
  step: 500,
  employeeRate: 0.05,
  brackets: buildSSSBrackets(5000, 35000, 500),
};

// Look up the bracket whose MSC-centered range contains `netBasic`. Values below the first range
// fall to the floor MSC; values above the last cap at the ceiling MSC.
export function lookupSSSBracket(netBasic: number, config: EffectiveSSSConfig): EffectiveSSSBracket {
  const value = Number(netBasic) || 0;
  const brackets = config.brackets;
  const match = brackets.find((b) => value >= b.rangeMin && value <= b.rangeMax);
  if (match) return match;
  // Below first range_min (shouldn't happen since first floors at 0) -> floor; above last -> ceiling.
  return value < brackets[0].rangeMin ? brackets[0] : brackets[brackets.length - 1];
}

// ─── PhilHealth / Pag-IBIG / global knobs ────────────────────────────────────

export type StatutoryPhilHealthConfig = {
  premiumRate: number; // 0.05
  eeShareRate: number; // 0.025 (employee share of gross basic)
  floorMonthly: number; // 10000
  ceilingMonthly: number; // 100000
};

export type StatutoryPagibigConfig = {
  eeFlatPerCutoff: number; // 100
  erFlatPerCutoff: number; // 100
  eeFlatMonthly: number; // 200
  erFlatMonthly: number; // 200
  mfsCap: number; // 10000
};

export type SssContributionBasis = "gross" | "basic";

export type StatutorySettings = {
  effectiveFrom: string;
  effectiveTo: string | null;
  sssBasisSource: "net_basic";
  // Which compensation figure sets the SSS MSC bracket. "basic" = per-cutoff basic pay (current
  // behavior); "gross" = per-cutoff gross pay. The zero-skip and floor/ceiling clamp are unchanged.
  sssContributionBasis?: SssContributionBasis; // default "basic" (preserves existing behavior)
  // Boldr payslips D & E: non-exempt w/ absences still got SSS on the GROSS MSC bracket (500),
  // implying absence/late is NOT netted from the SSS base. Default FALSE matches observed output.
  // TODO: confirm with Boldr (Ma'am Donna) whether SSS "Net Basic" excludes absence/late.
  sssNetOfAbsenceLate: boolean;
  // The -12,800 "Basic Salary Adj" case (Sample G): SSS bracketed on 10,400 -> MSC 10,500 -> 525.
  // Adjustments ARE netted.
  sssNetOfAdjustments: boolean;
  philhealthBasis: "gross_basic";
  pagibigMode: "flat_per_cutoff";
  // EOM/final-pay runs showed PHIC & HDMF at FULL MONTH in one cutoff while SSS stayed per-cutoff —
  // this CONTRADICTS Boldr's stated flat-100/per-cutoff rules. Treat as unconfirmed; default FALSE.
  // TODO: confirm whether EOM/final PHIC & HDMF full-month is intended.
  eomTrueupEnabled: boolean;
  philhealth: StatutoryPhilHealthConfig;
  pagibig: StatutoryPagibigConfig;
};

export const SEED_STATUTORY_SETTINGS: StatutorySettings = {
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  sssBasisSource: "net_basic",
  sssContributionBasis: "basic",
  sssNetOfAbsenceLate: false,
  sssNetOfAdjustments: true,
  philhealthBasis: "gross_basic",
  pagibigMode: "flat_per_cutoff",
  eomTrueupEnabled: false,
  philhealth: { premiumRate: 0.05, eeShareRate: 0.025, floorMonthly: 10000, ceilingMonthly: 100000 },
  pagibig: { eeFlatPerCutoff: 100, erFlatPerCutoff: 100, eeFlatMonthly: 200, erFlatMonthly: 200, mfsCap: 10000 },
};

// ─── Engine ──────────────────────────────────────────────────────────────────

export type StatutoryRunType = "regular" | "eom_adjustment" | "final_pay";

export type StatutoryInput = {
  grossBasic: number; // per-cutoff basic before absence/late/adjustments
  grossPay?: number; // per-cutoff gross pay (basic + premiums + adjusted allowances) — used when
  //                    sssContributionBasis === "gross" to set the MSC bracket. Falls back to basic.
  absenceLateOnBasic?: number; // amount of absence/late attributable to basic (>=0)
  basicAdjustments?: number; // signed salary adjustments to basic (e.g. -12800)
  monthlyGrossBasic?: number; // used only for EOM/final PHIC true-up
  payDate?: string;
  runType?: StatutoryRunType;
  hasAttendance: boolean;
};

export type StatutoryResult = {
  sss: number;
  philhealth: number;
  pagibig: number;
  // Diagnostics persisted alongside the amounts for auditability.
  sssMsc: number;
  sssNetBasic: number;
  settingsEffectiveFrom: string;
};

export function computeStatutory(
  input: StatutoryInput,
  settings: StatutorySettings,
  sssConfig: EffectiveSSSConfig
): StatutoryResult {
  const grossBasic = Number(input.grossBasic) || 0;
  const basicAdjustments = Number(input.basicAdjustments) || 0;
  const absenceLateOnBasic = Math.max(0, Number(input.absenceLateOnBasic) || 0);
  const runType: StatutoryRunType = input.runType || "regular";

  const zero: StatutoryResult = {
    sss: 0,
    philhealth: 0,
    pagibig: 0,
    sssMsc: 0,
    sssNetBasic: 0,
    settingsEffectiveFrom: settings.effectiveFrom,
  };

  // ZERO RULE first: no attendance OR no positive basic => no contributions at all.
  if (!input.hasAttendance || grossBasic + basicAdjustments <= 0) {
    return zero;
  }

  // SSS — the compensation figure that sets the MSC bracket is chosen by sssContributionBasis:
  //   "basic" (default) = per-cutoff basic pay (existing behavior);
  //   "gross"           = per-cutoff gross pay.
  // Adjustments/absence netting still apply to whichever base is selected; the zero-skip above stays
  // on basic regardless. Everything downstream (floor/ceiling clamp, EE/ER, EC, WISP) is unchanged.
  const basis = settings.sssContributionBasis || "basic";
  const mscBase = basis === "gross" ? (Number(input.grossPay) || grossBasic) : grossBasic;
  const sssNetBasic =
    mscBase +
    (settings.sssNetOfAdjustments ? basicAdjustments : 0) -
    (settings.sssNetOfAbsenceLate ? absenceLateOnBasic : 0);
  const bracket = lookupSSSBracket(sssNetBasic, sssConfig);
  const sss = round2(bracket.eeTotal); // full per-cutoff amount, no /2

  // PHIC — 2.5% (employee share) of GROSS basic. Do NOT subtract absence/late or adjustments.
  let philhealth = round2(settings.philhealth.eeShareRate * grossBasic);

  // PAGIBIG — flat per cutoff.
  let pagibig = settings.pagibig.eeFlatPerCutoff;

  // EOM/FINAL override (only when enabled and on an EOM/final run): PHIC on full-month clamped gross
  // basic, HDMF at the full-month flat. SSS stays per-cutoff (unchanged).
  if (settings.eomTrueupEnabled && (runType === "eom_adjustment" || runType === "final_pay")) {
    const monthlyGrossBasic = Number(input.monthlyGrossBasic) || grossBasic;
    const clamped = Math.min(
      Math.max(monthlyGrossBasic, settings.philhealth.floorMonthly),
      settings.philhealth.ceilingMonthly
    );
    philhealth = round2(settings.philhealth.eeShareRate * clamped);
    pagibig = settings.pagibig.eeFlatMonthly;
  }

  return {
    sss,
    philhealth,
    pagibig,
    sssMsc: bracket.msc,
    sssNetBasic: round2(sssNetBasic),
    settingsEffectiveFrom: settings.effectiveFrom,
  };
}

// Resolve the effective-dated config/settings as of a pay date. With a single open-ended seed this
// returns it directly; supports superseding by effectiveTo without deleting old rows.
export function resolveStatutoryForDate<T extends { effectiveFrom: string; effectiveTo: string | null }>(
  candidates: T[],
  payDate: string | undefined,
  fallback: T
): T {
  if (!candidates.length) return fallback;
  const date = payDate || "9999-12-31";
  const matches = candidates.filter(
    (c) => c.effectiveFrom <= date && (c.effectiveTo === null || c.effectiveTo >= date)
  );
  if (matches.length) {
    return matches.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  }
  return candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] || fallback;
}
