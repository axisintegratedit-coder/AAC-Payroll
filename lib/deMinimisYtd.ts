// Deterministic YTD 90k-bucket state, derived from POSTED payroll records (never a drifting counter).
// Re-runs and corrections stay correct because we recompute from history every time.

export type YtdPayrollRecordLike = {
  employeeNo?: string | number;
  year?: string | number;
  month?: string | number;
  monthYear?: string;
  payrollDate?: string;
  id?: string;
  bulkRunId?: string;
  // Amount this record contributed to the 90k bucket (de minimis excess + other benefits). Newer
  // records persist `ninetyKBucketContribution`; older ones fall back to the saved DMB fields.
  ninetyKBucketContribution?: number;
  excessDMBTo90k?: number;
  taxableDMBAfter90k?: number;
  // Per-benefit own-ceiling consumption for annual/semester/monthly-basis ceilings.
  ownCeilingUsed?: Record<string, number>;
};

function num(value: unknown): number {
  return Number(value) || 0;
}

// Calendar year of a record from the most reliable field available.
export function recordYear(record: YtdPayrollRecordLike): string {
  if (record.year) return String(record.year);
  const source = record.monthYear || record.payrollDate || "";
  const match = String(source).match(/(\d{4})/);
  return match ? match[1] : "";
}

// One record's contribution to the 90k bucket. Prefer the explicit field; else use the saved
// "excess to 90k" amount (which is exactly the bucket-feeding portion under the old per-cutoff model).
export function bucketContributionOf(record: YtdPayrollRecordLike): number {
  if (record.ninetyKBucketContribution !== undefined && record.ninetyKBucketContribution !== null) {
    return num(record.ninetyKBucketContribution);
  }
  // Old records: excessDMBTo90k was the capped (≤90k) amount; taxableDMBAfter90k was the over-cap part.
  // Their sum is the total that fed the bucket this cutoff.
  return num(record.excessDMBTo90k) + num(record.taxableDMBAfter90k);
}

export type YtdBucketState = {
  ytd90kBucketUsed: number;
  ytdOwnCeilingUsed: Record<string, number>; // { benefitId: amountUsedThisYear }
};

// Derive YTD bucket + own-ceiling usage for an employee/year from posted records, EXCLUDING the run
// currently being computed (so the current cutoff sees the state as of just before it).
export function deriveYtdBucketState(
  records: YtdPayrollRecordLike[],
  employeeNo: string | number,
  year: string,
  options?: { excludeRunIds?: Set<string>; excludeRecordIds?: Set<string> }
): YtdBucketState {
  const emp = String(employeeNo);
  const excludeRuns = options?.excludeRunIds;
  const excludeRecords = options?.excludeRecordIds;

  let ytd90kBucketUsed = 0;
  const ytdOwnCeilingUsed: Record<string, number> = {};

  for (const record of records) {
    if (String(record.employeeNo) !== emp) continue;
    if (recordYear(record) !== String(year)) continue;
    if (excludeRecords && record.id && excludeRecords.has(record.id)) continue;
    if (excludeRuns && record.bulkRunId && excludeRuns.has(record.bulkRunId)) continue;

    ytd90kBucketUsed += bucketContributionOf(record);
    const used = record.ownCeilingUsed || {};
    for (const [benefitId, amount] of Object.entries(used)) {
      ytdOwnCeilingUsed[benefitId] = (ytdOwnCeilingUsed[benefitId] || 0) + num(amount);
    }
  }

  return {
    ytd90kBucketUsed: Math.round(ytd90kBucketUsed * 100) / 100,
    ytdOwnCeilingUsed,
  };
}
