import type { PayrollCutoffIdentity } from "@/lib/payrollRunImports";
import { normalizeCutoffSlot, type DeMinimisCutoffSlot } from "@/lib/deMinimis";

export type StandingAllowanceFrequency = "Monthly" | "Semi-monthly";
export type StandingAllowanceCutoffSlot = DeMinimisCutoffSlot;
export type StandingAllowanceCategoryTarget = "All employees" | "All Rank and File" | "All Supervisory";

export type StandingAllowance = {
  id: string;
  name: string;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  taxable: boolean;
  applyBeforeTax: boolean;
  frequency: StandingAllowanceFrequency;
  monthlyCutoff?: StandingAllowanceCutoffSlot;
  remarks?: string;
  categoryTargets: StandingAllowanceCategoryTarget[];
  employeeTargets: string[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  archived?: boolean;
};

export type StandingAllowanceEmployee = {
  employeeNo: string;
  employeeType?: string;
  employmentStatus?: string;
  archived?: boolean;
};

export type StandingAllowanceLine = {
  allowanceId: string;
  name: string;
  amount: number;
  taxable: boolean;
  applyBeforeTax: boolean;
  frequency: StandingAllowanceFrequency;
};

export function standingAllowanceTargetsEmployee(allowance: StandingAllowance, employee: StandingAllowanceEmployee) {
  if (allowance.archived || employee.archived) return false;

  const employeeNo = String(employee.employeeNo || "").trim().toLowerCase();
  if (allowance.employeeTargets.some((target) => target.trim().toLowerCase() === employeeNo)) return true;

  const employeeType = String(employee.employeeType || "").trim().toLowerCase();
  return allowance.categoryTargets.some((target) => {
    if (target === "All employees") return true;
    if (target === "All Rank and File") return employeeType === "rank and file" || employeeType === "rank-and-file";
    if (target === "All Supervisory") return employeeType === "supervisory";
    return false;
  });
}

export function standingAllowanceAppliesToCutoff(allowance: StandingAllowance, cutoff: PayrollCutoffIdentity) {
  if (allowance.archived) return false;
  if (allowance.frequency === "Semi-monthly") return true;

  const cutoffSlot = normalizeCutoffSlot(cutoff.cutoffLabel || cutoff.cutoff || cutoff.cutoffId);
  return Boolean(allowance.monthlyCutoff && cutoffSlot === allowance.monthlyCutoff);
}

export function getAllowancesForCutoff(
  employee: StandingAllowanceEmployee,
  cutoff: PayrollCutoffIdentity,
  allowances: StandingAllowance[]
): StandingAllowanceLine[] {
  return allowances
    .filter((allowance) => standingAllowanceTargetsEmployee(allowance, employee))
    .filter((allowance) => standingAllowanceAppliesToCutoff(allowance, cutoff))
    .map((allowance) => ({
      allowanceId: allowance.id,
      name: allowance.name,
      amount: Math.max(Number(allowance.amount) || 0, 0),
      taxable: Boolean(allowance.taxable),
      applyBeforeTax: Boolean(allowance.applyBeforeTax),
      frequency: allowance.frequency,
    }));
}
