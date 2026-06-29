import { describe, it, expect } from "vitest";
import { runDeMinimisWaterfall, resolvePeriodCeiling, type WaterfallLineInput } from "./deMinimisWaterfall";

const general = (amount: number): WaterfallLineInput => ({
  benefitId: "general",
  name: "General Benefit",
  amount,
  hasOwnCeiling: false,
  feeds90kBucket: true,
});

const rice = (amount: number, monthToDateUsed = 0): WaterfallLineInput => ({
  benefitId: "rice",
  name: "Rice Subsidy",
  amount,
  hasOwnCeiling: true,
  feeds90kBucket: true,
  ceiling: 2000,
  ceilingBasis: "monthly",
  ceilingContext: { monthToDateUsed },
});

describe("De Minimis waterfall — acceptance cases", () => {
  it("1. Boldr general benefit ₱2,500/cutoff, bucket at ₱0 -> all exempt to bucket, ₱0 taxable", () => {
    const r = runDeMinimisWaterfall({ lines: [general(2500)], ytdBucketUsedBefore: 0 });
    expect(r.taxableFromDeMinimis).toBe(0);
    expect(r.totalToBucket).toBe(2500);
    expect(r.bucketUsedAfter).toBe(2500);
    expect(r.totalExempt).toBe(2500); // still under 90k
  });

  it("2. Crossing ₱90k mid-year: bucket at ₱89,000, ₱2,500 general -> ₱1,000 exempt, ₱1,500 taxable", () => {
    const r = runDeMinimisWaterfall({ lines: [general(2500)], ytdBucketUsedBefore: 89000 });
    expect(r.taxableFromDeMinimis).toBe(1500);
    expect(r.lines[0].bucketTaxableThisCutoff).toBe(1500);
    expect(r.totalExempt).toBe(1000);
    expect(r.bucketUsedAfter).toBe(91500);
  });

  it("3. Rice within ceiling (₱1,000/cutoff, ₱2,000/month cap) -> fully exempt, nothing to bucket/tax", () => {
    const r = runDeMinimisWaterfall({ lines: [rice(1000, 0)], ytdBucketUsedBefore: 0 });
    expect(r.taxableFromDeMinimis).toBe(0);
    expect(r.totalToBucket).toBe(0);
    expect(r.lines[0].exemptPortion).toBe(1000);
    expect(r.bucketUsedAfter).toBe(0);
  });

  it("4. Rice over ceiling (₱1,500/cutoff, ₱2,000 already used this month) -> excess to bucket", () => {
    // Month cap 2,000, already used 2,000 this month -> period ceiling 0 -> full 1,500 is excess -> bucket.
    const r = runDeMinimisWaterfall({ lines: [rice(1500, 2000)], ytdBucketUsedBefore: 0 });
    expect(r.lines[0].exemptPortion).toBe(0);
    expect(r.totalToBucket).toBe(1500);
    expect(r.taxableFromDeMinimis).toBe(0); // bucket still under 90k
  });

  it("4b. Rice over ceiling within the month (₱2,000 cap, ₱1,000 used) -> ₱1,000 exempt, ₱500 to bucket", () => {
    const r = runDeMinimisWaterfall({ lines: [rice(1500, 1000)], ytdBucketUsedBefore: 0 });
    expect(r.lines[0].exemptPortion).toBe(1000); // remaining monthly cap
    expect(r.totalToBucket).toBe(500);
    expect(r.taxableFromDeMinimis).toBe(0);
  });

  it("5. No-90k immediate-tax item over its own ceiling -> excess taxable immediately", () => {
    const line: WaterfallLineInput = {
      benefitId: "flat",
      name: "Flat cash (no bucket)",
      amount: 3000,
      hasOwnCeiling: true,
      feeds90kBucket: false,
      ceiling: 1000,
      ceilingBasis: "per_cutoff",
    };
    const r = runDeMinimisWaterfall({ lines: [line], ytdBucketUsedBefore: 0 });
    expect(r.lines[0].exemptPortion).toBe(1000);
    expect(r.lines[0].immediateTaxable).toBe(2000);
    expect(r.taxableFromDeMinimis).toBe(2000);
    expect(r.totalToBucket).toBe(0);
    expect(r.bucketUsedAfter).toBe(0);
  });

  it("other benefits (13th/bonus) consume the cap before de minimis", () => {
    // Bucket at 88,000, 13th-month 1,000 also lands this cutoff, then 2,000 general benefit.
    const r = runDeMinimisWaterfall({
      lines: [general(2000)],
      ytdBucketUsedBefore: 88000,
      otherBenefitsToBucketThisCutoff: 1000,
    });
    // After other benefits: running 89,000. General 2,000 -> 1,000 exempt, 1,000 taxable.
    expect(r.taxableFromDeMinimis).toBe(1000);
    expect(r.bucketUsedAfter).toBe(91000);
  });
});

describe("resolvePeriodCeiling", () => {
  it("daily basis = 25% of regional daily min wage × payable days", () => {
    const c = resolvePeriodCeiling(
      { ceiling: 0, ceilingBasis: "daily", dailyMinWageRate: 600 },
      { payableDaysInCutoff: 11 }
    );
    expect(c).toBe(0.25 * 600 * 11); // 1,650
  });

  it("annual basis nets YTD used", () => {
    const c = resolvePeriodCeiling({ ceiling: 8000, ceilingBasis: "annual" }, { yearToDateUsed: 6000 });
    expect(c).toBe(2000);
  });
});
