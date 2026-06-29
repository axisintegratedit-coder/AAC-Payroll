import type { DeMinimisBenefit, DeMinimisCeilingBasis } from "@/lib/deMinimis";

// ── BIR de minimis waterfall (RR 29-2025) ────────────────────────────────────
// For each de minimis line, evaluate in order:
//   1. Own ceiling: exempt up to the period ceiling (from ceiling_basis); excess = amount - exempt.
//      No own ceiling -> exempt_portion = 0, excess = full amount.
//   2. ₱90k bucket: if feeds_90k_bucket, add excess to the YTD 90k accumulator (which also holds
//      13th month, bonuses, other benefits). Exempt up to ₱90,000 cumulative/calendar year; only the
//      portion crossing ₱90,000 becomes taxable in the cutoff where it crosses.
//      If not feeding the bucket, the excess is immediately taxable this cutoff.
//   3. taxable_this_cutoff = (bucket excess crossing ₱90k) + (excess from non-bucket items).
// Pure exempt and still-under-₱90k bucket portions never touch the tax base but DO appear on payslips.
//
// NOTHING here hardcodes peso ceilings — all amounts come from the benefit catalog + settings.

export const NINETY_K_BUCKET_CAP = 90000; // BIR "other benefits" annual exemption cap (configurable)

export type CeilingBasisContext = {
  // Amount of this benefit's own-ceiling allowance ALREADY consumed this period, for the relevant
  // basis window. The engine subtracts these from the period ceiling so caps are respected across
  // cutoffs (e.g. a front-loaded monthly benefit doesn't get the full cap twice).
  monthToDateUsed?: number; // for ceiling_basis "monthly"
  semesterToDateUsed?: number; // for "per_semester"
  yearToDateUsed?: number; // for "annual"
  payableDaysInCutoff?: number; // for "daily"
};

// Resolve the exemption ceiling available to THIS line for THIS cutoff, given the basis + prior use.
export function resolvePeriodCeiling(
  benefit: Pick<DeMinimisBenefit, "ceiling" | "ceilingBasis" | "dailyMinWageRate">,
  ctx: CeilingBasisContext
): number {
  const basis: DeMinimisCeilingBasis = benefit.ceilingBasis || "monthly";
  const ceiling = Math.max(0, Number(benefit.ceiling) || 0);

  switch (basis) {
    case "per_cutoff":
      return ceiling;
    case "monthly":
      return Math.max(0, ceiling - (Number(ctx.monthToDateUsed) || 0));
    case "per_semester":
      return Math.max(0, ceiling - (Number(ctx.semesterToDateUsed) || 0));
    case "annual":
      return Math.max(0, ceiling - (Number(ctx.yearToDateUsed) || 0));
    case "daily": {
      // OT/night-shift meal allowance = 25% of the regional daily minimum wage × payable days.
      const dailyExempt = 0.25 * (Number(benefit.dailyMinWageRate) || 0);
      return Math.max(0, dailyExempt * (Number(ctx.payableDaysInCutoff) || 0));
    }
    default:
      return ceiling;
  }
}

export type WaterfallLineInput = {
  benefitId: string;
  name: string;
  amount: number;
  hasOwnCeiling: boolean;
  feeds90kBucket: boolean;
  ceiling?: number;
  ceilingBasis?: DeMinimisCeilingBasis;
  dailyMinWageRate?: number;
  requiresNonCash?: boolean;
  isCash?: boolean; // whether THIS configuration pays cash (for the non-cash warning)
  ceilingContext?: CeilingBasisContext;
};

export type WaterfallLineResult = {
  benefitId: string;
  name: string;
  amount: number;
  exemptPortion: number; // own-ceiling exempt (never taxed, never in bucket)
  toBucketPortion: number; // excess routed into the 90k bucket (still exempt until bucket crosses 90k)
  immediateTaxable: number; // excess from non-bucket items, taxable this cutoff
  bucketTaxableThisCutoff: number; // portion of this line's bucket contribution that crossed 90k
  nonCashWarning: boolean;
};

export type WaterfallResult = {
  lines: WaterfallLineResult[];
  // Totals for this cutoff:
  totalExempt: number; // own-ceiling exempt + bucket portion still under 90k
  totalToBucket: number; // amount added to the YTD bucket this cutoff (before crossing logic)
  taxableFromDeMinimis: number; // amount added to the WHT taxable base this cutoff
  bucketUsedBefore: number; // YTD bucket at start of this cutoff
  bucketUsedAfter: number; // YTD bucket after this cutoff's contributions
};

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// Process all de minimis lines for one cutoff. `ytdBucketUsedBefore` is the employee's YTD 90k bucket
// (13th month + bonuses + prior de minimis excess + other benefits) BEFORE this cutoff. `otherBenefits
// ToBucketThisCutoff` is non-de-minimis amounts (13th, bonuses, taxable allowances) that also feed the
// bucket THIS cutoff — they consume the cap first conceptually, but here we fold them into the running
// total in the order: existing YTD, then other-benefits, then de minimis bucket lines.
export function runDeMinimisWaterfall(input: {
  lines: WaterfallLineInput[];
  ytdBucketUsedBefore: number;
  otherBenefitsToBucketThisCutoff?: number;
  ninetyKCap?: number;
}): WaterfallResult {
  const cap = input.ninetyKCap ?? NINETY_K_BUCKET_CAP;
  const bucketBefore = Math.max(0, Number(input.ytdBucketUsedBefore) || 0);

  // Running bucket starts at YTD, then non-de-minimis "other benefits" land first (13th/bonus already
  // accrue earlier in a typical run), then each de minimis bucket line.
  let running = bucketBefore;
  const otherToBucket = Math.max(0, Number(input.otherBenefitsToBucketThisCutoff) || 0);
  // Other benefits cross first; their taxable crossing is handled by the existing comp engine, so here
  // we only advance the running total so de minimis sees the correct remaining headroom.
  running += otherToBucket;

  const lines: WaterfallLineResult[] = [];
  let taxableFromDeMinimis = 0;
  let totalExempt = 0;
  let totalToBucket = 0;

  for (const line of input.lines) {
    const amount = Math.max(0, round2(line.amount));

    // 1. Own ceiling.
    let exemptPortion = 0;
    let excess = amount;
    if (line.hasOwnCeiling) {
      const periodCeiling = resolvePeriodCeiling(
        { ceiling: line.ceiling, ceilingBasis: line.ceilingBasis, dailyMinWageRate: line.dailyMinWageRate },
        line.ceilingContext || {}
      );
      exemptPortion = Math.min(amount, periodCeiling);
      excess = round2(amount - exemptPortion);
    } else {
      exemptPortion = 0;
      excess = amount;
    }

    let toBucketPortion = 0;
    let immediateTaxable = 0;
    let bucketTaxableThisCutoff = 0;

    if (excess > 0) {
      if (line.feeds90kBucket) {
        // 2. Feed the 90k bucket. Portion under the cap stays exempt; portion crossing is taxable now.
        const headroom = Math.max(0, cap - running);
        const stillExempt = Math.min(excess, headroom);
        const crossing = round2(excess - stillExempt);
        toBucketPortion = excess;
        bucketTaxableThisCutoff = crossing;
        running = round2(running + excess);
        taxableFromDeMinimis += crossing;
        totalExempt += stillExempt;
        totalToBucket += excess;
      } else {
        // Non-bucket item over its own ceiling: immediately taxable this cutoff.
        immediateTaxable = excess;
        taxableFromDeMinimis += excess;
      }
    }

    totalExempt += exemptPortion;

    lines.push({
      benefitId: line.benefitId,
      name: line.name,
      amount,
      exemptPortion: round2(exemptPortion),
      toBucketPortion: round2(toBucketPortion),
      immediateTaxable: round2(immediateTaxable),
      bucketTaxableThisCutoff: round2(bucketTaxableThisCutoff),
      nonCashWarning: Boolean(line.requiresNonCash && line.isCash),
    });
  }

  return {
    lines,
    totalExempt: round2(totalExempt),
    totalToBucket: round2(totalToBucket),
    taxableFromDeMinimis: round2(taxableFromDeMinimis),
    bucketUsedBefore: round2(bucketBefore),
    bucketUsedAfter: round2(running),
  };
}
