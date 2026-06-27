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

export type DeMinimisBenefit = {
  id: string;
  name: string;
  suggestedType: DeMinimisSuggestedType;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  hasOwnCeiling: boolean;
  ceiling?: number;
  frequency: DeMinimisFrequency;
  monthlyCutoff?: DeMinimisCutoffSlot;
  annualMonth?: string;
  annualCutoff?: DeMinimisCutoffSlot;
  // True once `amount` has been stored as the per-cutoff half for a Semi-monthly item.
  // Guards the one-time migration that halves legacy full-month records exactly once.
  semiMonthlyHalved?: boolean;
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
};

export type DeMinimisSuggestedTypePreset = {
  suggestedType: DeMinimisSuggestedType;
  name: string;
  hasOwnCeiling: boolean;
  ceiling?: number;
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
    hasOwnCeiling: true,
    ceiling: 5000,
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

export const DE_MINIMIS_SUGGESTED_TYPE_PRESETS: DeMinimisSuggestedTypePreset[] = [
  {
    suggestedType: "Rice Subsidy",
    name: "Rice Subsidy",
    hasOwnCeiling: true,
    ceiling: 2000,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Uniform Allowance",
    name: "Uniform Allowance",
    hasOwnCeiling: true,
    ceiling: 6000,
    frequency: "Annual",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Laundry Allowance",
    name: "Laundry Allowance",
    hasOwnCeiling: true,
    ceiling: 300,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Medical Cash Allowance",
    name: "Medical Cash Allowance",
    hasOwnCeiling: true,
    ceiling: 1500,
    frequency: "Monthly",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Medical Assistance",
    name: "Medical Assistance",
    hasOwnCeiling: true,
    ceiling: 10000,
    frequency: "Annual",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Achievement Award",
    name: "Achievement Award",
    hasOwnCeiling: true,
    ceiling: 10000,
    frequency: "Annual",
    remarks: DE_MINIMIS_BIR_VERIFICATION_NOTE,
  },
  {
    suggestedType: "Custom",
    name: "",
    hasOwnCeiling: false,
    frequency: "Monthly",
    remarks: "",
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
      };
    });
}
