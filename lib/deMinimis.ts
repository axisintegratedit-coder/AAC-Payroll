import type { PayrollCutoffIdentity } from "@/lib/payrollRunImports";

export type DeMinimisFrequency = "Monthly" | "Semi-monthly" | "Annual";
export type DeMinimisCutoffSlot = "15th" | "30th/31st";
export type DeMinimisSuggestedType =
  | "Rice Subsidy"
  | "Uniform Allowance"
  | "Laundry Allowance"
  | "Medical Cash Allowance"
  | "Medical Assistance"
  | "Achievement Award"
  | "Custom";
export type DeMinimisCategoryTarget = "All employees" | "All Rank and File" | "All Supervisory";

// How a benefit's own ceiling is measured for the period. Drives ceiling proration in the engine.
export type DeMinimisCeilingBasis = "per_cutoff" | "monthly" | "per_semester" | "annual" | "daily";

export type DeMinimisBenefit = {
  id: string;
  name: string;
  suggestedType: DeMinimisSuggestedType;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  hasOwnCeiling: boolean;
  ceiling?: number;
  // ── BIR waterfall classification (RR 29-2025). All ceilings are DATA, never hardcoded in logic. ──
  ceilingBasis?: DeMinimisCeilingBasis; // default "monthly"
  feeds90kBucket?: boolean; // default true — over-ceiling excess flows to the ₱90k other-benefits bucket
  requiresNonCash?: boolean; // e.g. achievement award must be tangible property to stay exempt
  isEnumerated?: boolean; // true = named BIR de minimis item; false = general/uncategorized benefit
  rrReference?: string; // e.g. "RR 29-2025"
  dailyMinWageRate?: number; // region-dependent daily minimum wage, for ceilingBasis "daily" (25% of this)
  frequency: DeMinimisFrequency;
  monthlyCutoff?: DeMinimisCutoffSlot;
  annualMonth?: string;
  annualCutoff?: DeMinimisCutoffSlot;
  remarks?: string;
  birVerificationNote?: string;
  categoryTargets: DeMinimisCategoryTarget[];
  employeeTargets: string[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  archived?: boolean;
};

export type DeMinimisEmployee = {
  employeeNo: string;
  employeeType?: string;
  employmentStatus?: string;
  archived?: boolean;
};

export type DeMinimisLine = {
  benefitId: string;
  name: string;
  amount: number;
  hasOwnCeiling: boolean;
  ceiling?: number;
  exemptPortion: number;
  excessPortion: number;
  frequency: DeMinimisFrequency;
  sharedNinetyKBucketPortion: number;
  // BIR waterfall classification carried through for the tax engine.
  ceilingBasis?: DeMinimisCeilingBasis;
  feeds90kBucket?: boolean;
  requiresNonCash?: boolean;
  isEnumerated?: boolean;
  dailyMinWageRate?: number;
};

export type DeMinimisSuggestedTypePreset = {
  suggestedType: DeMinimisSuggestedType;
  name: string;
  hasOwnCeiling: boolean;
  ceiling?: number;
  ceilingBasis?: DeMinimisCeilingBasis;
  feeds90kBucket?: boolean;
  requiresNonCash?: boolean;
  isEnumerated?: boolean;
  rrReference?: string;
  frequency: DeMinimisFrequency;
  remarks: string;
};

export const DE_MINIMIS_BIR_VERIFICATION_NOTE =
  "Seed ceiling only. Verify against current BIR rules before go-live.";

export const BOLDR_DEFAULT_DE_MINIMIS_ID = "boldr-default-de-minimis-allowance";
export const BOLDR_DEFAULT_DE_MINIMIS_REMARKS =
  "Seeded from Boldr employee import value. Verify with Boldr whether the 5,000 is fully exempt or feeds the shared 90k bucket.";

export function createBoldrDefaultDeMinimisBenefit(options: {
  createdAt: string;
  createdBy?: string;
}): DeMinimisBenefit {
  return {
    id: BOLDR_DEFAULT_DE_MINIMIS_ID,
    name: "De Minimis Allowance",
    suggestedType: "Custom",
    amount: 5000,
    // Modeled as a GENERAL benefit until Boldr provides a per-category breakdown: no standalone
    // exemption, full amount routes to the ₱90k other-benefits bucket (instead of silently exempting).
    hasOwnCeiling: false,
    ceiling: undefined,
    ceilingBasis: "monthly",
    feeds90kBucket: true,
    isEnumerated: false,
    frequency: "Monthly",
    monthlyCutoff: "15th",
    remarks: BOLDR_DEFAULT_DE_MINIMIS_REMARKS,
    birVerificationNote: BOLDR_DEFAULT_DE_MINIMIS_REMARKS,
    categoryTargets: ["All employees"],
    employeeTargets: [],
    createdAt: options.createdAt,
    createdBy: options.createdBy,
  };
}

// RR 29-2025 enumerated ceilings. ⚠ STARTING VALUES — verify against the full text before go-live.
const RR = "RR 29-2025";
export const DE_MINIMIS_SUGGESTED_TYPE_PRESETS: DeMinimisSuggestedTypePreset[] = [
  {
    suggestedType: "Rice Subsidy",
    name: "Rice Subsidy",
    hasOwnCeiling: true,
    ceiling: 2000,
    ceilingBasis: "monthly",
    feeds90kBucket: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Laundry Allowance",
    name: "Laundry Allowance",
    hasOwnCeiling: true,
    ceiling: 400,
    ceilingBasis: "monthly",
    feeds90kBucket: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Medical Cash Allowance",
    name: "Medical cash allowance to dependents",
    hasOwnCeiling: true,
    ceiling: 333,
    ceilingBasis: "monthly",
    feeds90kBucket: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Uniform Allowance",
    name: "Uniform / Clothing Allowance",
    hasOwnCeiling: true,
    ceiling: 8000,
    ceilingBasis: "annual",
    feeds90kBucket: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Annual",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Medical Assistance",
    name: "Actual Medical Assistance",
    hasOwnCeiling: true,
    ceiling: 12000,
    ceilingBasis: "annual",
    feeds90kBucket: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Annual",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Achievement Award",
    name: "Employee Achievement Award",
    hasOwnCeiling: true,
    ceiling: 12000,
    ceilingBasis: "annual",
    feeds90kBucket: true,
    requiresNonCash: true,
    isEnumerated: true,
    rrReference: RR,
    frequency: "Annual",
    remarks: "Must be tangible property, not cash, to stay exempt. " + DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Custom",
    name: "General Benefit (uncategorized cash)",
    hasOwnCeiling: false,
    feeds90kBucket: true,
    isEnumerated: false,
    frequency: "Semi-monthly",
    remarks: "No standalone exemption — full amount routes to the ₱90k other-benefits bucket.",
  },
];

export function normalizeCutoffSlot(value?: string): DeMinimisCutoffSlot | "" {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("15") || normalized.includes("first") || normalized === "1") return "15th";
  if (
    normalized.includes("30") ||
    normalized.includes("31") ||
    normalized.includes("second") ||
    normalized === "2"
  ) {
    return "30th/31st";
  }
  return "";
}

function cutoffMonthMatches(cutoff: PayrollCutoffIdentity, annualMonth?: string) {
  if (!annualMonth) return false;
  const candidates = [
    cutoff.monthYear,
    cutoff.payDate?.slice(0, 7),
    cutoff.payrollDate?.slice(0, 7),
    cutoff.coverageStartDate?.slice(0, 7),
    cutoff.coverageEndDate?.slice(0, 7),
  ];
  return candidates.includes(annualMonth);
}

export function deMinimisBenefitTargetsEmployee(benefit: DeMinimisBenefit, employee: DeMinimisEmployee) {
  if (employee.archived || benefit.archived) return false;
  const employeeNo = employee.employeeNo.trim().toLowerCase();
  if (benefit.employeeTargets.some((target) => target.trim().toLowerCase() === employeeNo)) return true;

  const employeeType = String(employee.employeeType || "").trim().toLowerCase();
  return benefit.categoryTargets.some((target) => {
    if (target === "All employees") return true;
    if (target === "All Rank and File") return employeeType === "rank and file" || employeeType === "rank-and-file";
    if (target === "All Supervisory") return employeeType === "supervisory";
    return false;
  });
}

export function deMinimisBenefitAppliesToCutoff(benefit: DeMinimisBenefit, cutoff: PayrollCutoffIdentity) {
  if (benefit.archived) return false;
  const cutoffSlot = normalizeCutoffSlot(cutoff.cutoffLabel || cutoff.cutoff || cutoff.cutoffId);

  if (benefit.frequency === "Semi-monthly") return true;
  if (benefit.frequency === "Monthly") return Boolean(benefit.monthlyCutoff && cutoffSlot === benefit.monthlyCutoff);
  if (benefit.frequency === "Annual") {
    return Boolean(
      benefit.annualCutoff &&
        cutoffSlot === benefit.annualCutoff &&
        cutoffMonthMatches(cutoff, benefit.annualMonth)
    );
  }
  return false;
}

export function getDeMinimisForCutoff(
  employee: DeMinimisEmployee,
  cutoff: PayrollCutoffIdentity,
  benefits: DeMinimisBenefit[]
): DeMinimisLine[] {
  return benefits
    .filter((benefit) => deMinimisBenefitTargetsEmployee(benefit, employee))
    .filter((benefit) => deMinimisBenefitAppliesToCutoff(benefit, cutoff))
    .map((benefit) => {
      const amount = Math.max(Number(benefit.amount) || 0, 0);
      const ceiling = Math.max(Number(benefit.ceiling) || 0, 0);
      const exemptPortion = benefit.hasOwnCeiling ? Math.min(amount, ceiling) : 0;
      const excessPortion = benefit.hasOwnCeiling ? Math.max(0, amount - ceiling) : amount;

      return {
        benefitId: benefit.id,
        name: benefit.name,
        amount,
        hasOwnCeiling: benefit.hasOwnCeiling,
        ceiling: benefit.hasOwnCeiling ? ceiling : undefined,
        exemptPortion,
        excessPortion,
        frequency: benefit.frequency,
        sharedNinetyKBucketPortion: excessPortion,
        // Default missing flags to the safe BIR behavior: excess feeds the 90k bucket.
        ceilingBasis: benefit.ceilingBasis ?? "monthly",
        feeds90kBucket: benefit.feeds90kBucket ?? true,
        requiresNonCash: benefit.requiresNonCash ?? false,
        isEnumerated: benefit.isEnumerated ?? benefit.hasOwnCeiling,
        dailyMinWageRate: benefit.dailyMinWageRate,
      };
    });
}
