import { describe, it, expect } from "vitest";
import { computePremiumBucketAmounts } from "./premiumBuckets";
import { SEED_PREMIUM_MULTIPLIERS } from "./payrollSettingsTypes";

describe("computePremiumBucketAmounts", () => {
  const rate = 100; // ₱100/hr

  it("pays Ord-ND as the +10% premium only (base hour is already in basic)", () => {
    const amounts = computePremiumBucketAmounts({ "Ord-ND": 8 }, rate, SEED_PREMIUM_MULTIPLIERS);
    // 8 hrs × 100 × 0.10 = 80 — NOT 880 (which would re-pay the base hour).
    expect(amounts["Ord-ND"]).toBeCloseTo(80, 2);
  });

  it("pays OT/rest-day/holiday buckets at the full DOLE multiplier (extra hours, not in basic)", () => {
    const amounts = computePremiumBucketAmounts(
      { "Ord-OT": 8, "RD": 8, "LH": 8, "DH": 8 },
      rate,
      SEED_PREMIUM_MULTIPLIERS
    );
    expect(amounts["Ord-OT"]).toBeCloseTo(8 * 100 * 1.25, 2); // 1000
    expect(amounts["RD"]).toBeCloseTo(8 * 100 * 1.3, 2); // 1040
    expect(amounts["LH"]).toBeCloseTo(8 * 100 * 2.0, 2); // 1600
    expect(amounts["DH"]).toBeCloseTo(8 * 100 * 3.0, 2); // 2400
  });

  it("keeps combined-premium ND buckets (RD-ND etc.) at their full multiplier", () => {
    const amounts = computePremiumBucketAmounts({ "RD-ND": 8 }, rate, SEED_PREMIUM_MULTIPLIERS);
    // 1.30 × 1.10 = 1.43 → 8 × 100 × 1.43 = 1144. These hours are NOT in basic.
    expect(amounts["RD-ND"]).toBeCloseTo(1144, 2);
  });

  it("returns 0 for buckets with no hours and when rate is 0", () => {
    const noHours = computePremiumBucketAmounts({}, rate, SEED_PREMIUM_MULTIPLIERS);
    expect(noHours["Ord-OT"]).toBe(0);
    const noRate = computePremiumBucketAmounts({ "Ord-OT": 8 }, 0, SEED_PREMIUM_MULTIPLIERS);
    expect(noRate["Ord-OT"]).toBe(0);
  });
});
