import { SPROUT_PREMIUM_BUCKETS } from "./payrollRunImports";
import { SEED_PREMIUM_MULTIPLIERS, type PremiumMultipliersConfig } from "./payrollSettingsTypes";

// The 31 granular premium-hour buckets (spreadsheet columns L–AP) carried from the Sprout
// attendance upload, surfaced as per-bucket PESO amounts. Display/export only — these do NOT
// change total premiums, gross, or tax (which keep their existing simplified computation).

export const PREMIUM_BUCKET_ORDER: readonly string[] = SPROUT_PREMIUM_BUCKETS;

// Column headers used in the on-screen register and the Excel export.
export const PREMIUM_BUCKET_COLUMN_HEADERS: string[] = PREMIUM_BUCKET_ORDER.map((bucket) => `${bucket} (₱)`);

// Buckets whose hours are ordinary regular-time hours ALREADY paid inside monthly basic salary,
// so only the night-differential PREMIUM (+10%) is added — never the full hour again. The DOLE
// finalMultiplier for these (1.00 × 1.10 = 1.10) is a day-value multiplier and would re-pay the
// base hour; we override it to the +0.10 premium portion only. OT/rest-day/holiday buckets are
// EXTRA hours not in basic, so they keep their full multiplier.
const PREMIUM_ONLY_MULTIPLIER_OVERRIDES: Record<string, number> = {
  "Ord-ND": 0.1,
};

function buildMultiplierMap(config: PremiumMultipliersConfig | null | undefined): Map<string, number> {
  const source = config && Array.isArray(config.rows) && config.rows.length > 0 ? config : SEED_PREMIUM_MULTIPLIERS;
  const map = new Map<string, number>();
  for (const row of source.rows) {
    const override = PREMIUM_ONLY_MULTIPLIER_OVERRIDES[row.bucket];
    map.set(row.bucket, override !== undefined ? override : Number(row.finalMultiplier) || 0);
  }
  return map;
}

// Peso per bucket = bucketHours × hourlyRate × finalMultiplier (from the saved multiplier config,
// falling back to the DOLE seed). Returns every bucket in canonical order, 0 when no hours.
export function computePremiumBucketAmounts(
  premiumHours: Record<string, number | string> | undefined,
  hourlyRate: number,
  config: PremiumMultipliersConfig | null | undefined
): Record<string, number> {
  const multipliers = buildMultiplierMap(config);
  const rate = Number(hourlyRate) || 0;
  const result: Record<string, number> = {};
  for (const bucket of PREMIUM_BUCKET_ORDER) {
    const hours = Number(premiumHours?.[bucket]) || 0;
    const multiplier = multipliers.get(bucket) || 0;
    result[bucket] = hours > 0 && rate > 0 && multiplier > 0 ? hours * rate * multiplier : 0;
  }
  return result;
}

// Ordered list of peso amounts matching PREMIUM_BUCKET_COLUMN_HEADERS.
export function premiumBucketAmountsToRow(amounts: Record<string, number> | undefined): number[] {
  return PREMIUM_BUCKET_ORDER.map((bucket) => Number(amounts?.[bucket]) || 0);
}
