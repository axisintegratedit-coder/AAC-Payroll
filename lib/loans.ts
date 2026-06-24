import type { PayrollCutoffIdentity } from "@/lib/payrollRunImports";

export type PayrollLoanType = "SSS Loan" | "HDMF Loan" | "Calamity Loan" | "Capped Deduction";
export type PayrollLoanStatus = "Active" | "Paid";
export type PayrollLoanDeductionFrequency = "Semi-monthly" | "Monthly";
export type PayrollLoanCutoffSlot = "15th" | "30th/31st";

export type PayrollLoanRecord = {
  id: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  loanType: PayrollLoanType;
  loanName: string;
  principalAmount: number;
  maximumAmount?: number | null;
  amortizationPerCutoff: number;
  deductionFrequency?: PayrollLoanDeductionFrequency;
  monthlyDeductionCutoff?: PayrollLoanCutoffSlot | null;
  startDate: string;
  endDate?: string | null;
  status: PayrollLoanStatus;
  remainingBalance: number;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type PayrollLoanEmployee = {
  employeeNo: string;
  archived?: boolean;
};

export type LoanDeductionLine = {
  loanId: string;
  employeeId: string;
  loanType: PayrollLoanType;
  loanName: string;
  amount: number;
  remainingBalance: number;
  remainingBalanceAfterDeduction: number;
  cutoff: PayrollCutoffIdentity;
  cutoffLabel: string;
  cutoffPayDate?: string;
};

export function normalizeLoanType(value?: string): PayrollLoanType {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("sss")) return "SSS Loan";
  if (normalized.includes("hdmf") || normalized.includes("pag-ibig") || normalized.includes("pagibig")) return "HDMF Loan";
  if (normalized.includes("calamity")) return "Calamity Loan";
  return "Capped Deduction";
}

export function normalizeLoanDeductionFrequency(value?: string | null): PayrollLoanDeductionFrequency {
  return String(value || "").trim().toLowerCase() === "monthly" ? "Monthly" : "Semi-monthly";
}

export function normalizeLoanCutoffSlot(value?: string | null): PayrollLoanCutoffSlot | "" {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("15") || normalized.includes("first") || normalized === "1") return "15th";
  if (normalized.includes("30") || normalized.includes("31") || normalized.includes("second") || normalized === "2") {
    return "30th/31st";
  }
  return "";
}

export function stripUndefinedAndEmptyStrings<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedAndEmptyStrings(item)).filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, stripUndefinedAndEmptyStrings(item)])
        .filter(([, item]) => item !== undefined && item !== "")
    ) as T;
  }

  return value;
}

function cutoffPayDate(cutoff: PayrollCutoffIdentity) {
  return cutoff.payDate || cutoff.payrollDate || cutoff.coverageEndDate || cutoff.coverageStartDate || cutoff.monthYear || "";
}

export function loanScheduleMatchesCutoff(loan: PayrollLoanRecord, cutoff: PayrollCutoffIdentity) {
  const frequency = normalizeLoanDeductionFrequency(loan.deductionFrequency);
  if (frequency === "Semi-monthly") return true;

  const cutoffSlot = normalizeLoanCutoffSlot(cutoff.cutoffLabel || cutoff.cutoff || cutoff.cutoffId);
  const loanCutoffSlot = normalizeLoanCutoffSlot(loan.monthlyDeductionCutoff) || "30th/31st";
  return Boolean(cutoffSlot && cutoffSlot === loanCutoffSlot);
}

export function loanAppliesToCutoff(loan: PayrollLoanRecord, cutoff: PayrollCutoffIdentity) {
  if (loan.status !== "Active") return false;
  if ((Number(loan.remainingBalance) || 0) <= 0) return false;
  if (!loanScheduleMatchesCutoff(loan, cutoff)) return false;
  const payDate = cutoffPayDate(cutoff);
  if (loan.startDate && payDate && loan.startDate > payDate) return false;
  if (loan.endDate && payDate && payDate > loan.endDate) return false;
  return true;
}

export function getLoansForCutoff(
  employee: PayrollLoanEmployee,
  cutoff: PayrollCutoffIdentity,
  loans: PayrollLoanRecord[]
): LoanDeductionLine[] {
  const employeeNo = String(employee.employeeNo || "").trim().toLowerCase();
  if (!employeeNo || employee.archived) return [];

  const payDate = cutoffPayDate(cutoff);

  return loans
    .filter((loan) => String(loan.employeeId || "").trim().toLowerCase() === employeeNo)
    .filter((loan) => loanAppliesToCutoff(loan, cutoff))
    .map((loan) => {
      const remainingBalance = Math.max(Number(loan.remainingBalance) || 0, 0);
      const amortization = Math.max(Number(loan.amortizationPerCutoff) || 0, 0);
      const amount = Math.min(amortization, remainingBalance);
      return {
        loanId: loan.id,
        employeeId: loan.employeeId,
        loanType: loan.loanType,
        loanName: loan.loanName,
        amount,
        remainingBalance,
        remainingBalanceAfterDeduction: Math.max(0, remainingBalance - amount),
        cutoff,
        cutoffLabel: cutoff.cutoffLabel || cutoff.cutoff || cutoff.cutoffId || "",
        cutoffPayDate: payDate,
      };
    })
    .filter((line) => line.amount > 0);
}

export function applyLoanDeductionsToBalances(
  loansBefore: PayrollLoanRecord[],
  appliedLines: LoanDeductionLine[],
  actor: string,
  changedAt: string
): PayrollLoanRecord[] {
  const deductedByLoan = new Map<string, number>();

  for (const line of appliedLines) {
    deductedByLoan.set(line.loanId, (deductedByLoan.get(line.loanId) || 0) + Math.max(Number(line.amount) || 0, 0));
  }

  return loansBefore.map((loan) => {
    const deducted = deductedByLoan.get(loan.id) || 0;
    if (deducted <= 0) return loan;
    const remainingBalance = Math.max(0, (Number(loan.remainingBalance) || 0) - deducted);
    return stripUndefinedAndEmptyStrings({
      ...loan,
      remainingBalance,
      status: remainingBalance <= 0 ? "Paid" : loan.status,
      updatedAt: changedAt,
      updatedBy: actor,
    });
  });
}
