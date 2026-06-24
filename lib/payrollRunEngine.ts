import type {
  PayrollAttendanceRow,
  PayrollCutoffIdentity,
  SpecialItem,
} from "@/lib/payrollRunImports";
import { getDeMinimisForCutoff, type DeMinimisBenefit, type DeMinimisLine } from "@/lib/deMinimis";
import { getAllowancesForCutoff, type StandingAllowance, type StandingAllowanceLine } from "@/lib/standingAllowances";
import { getLoansForCutoff, type LoanDeductionLine, type PayrollLoanRecord } from "@/lib/loans";
import { getSalaryForCutoff, type SalaryHistoryEntry } from "@/lib/salaryHistory";

export type PayrollEngineEmployee = {
  employeeNo: string;
  name: string;
  basicPay: number;
  baseSalary?: number;
  salaryHistory?: SalaryHistoryEntry[];
  payrollType?: string;
  employeeType?: string;
  employmentStatus?: string;
  payrollExempt?: boolean;
  workingDaysPerMonth?: number;
  standardHoursPerDay?: number;
  hourlyRate?: number;
};

export type PayrollComputationSettings = Record<string, unknown>;

export type OneTimeItemLine = {
  instructionType: string;
  amount: number;
  category: "ONE_TIME_CREDIT" | "ONE_TIME_DEDUCTION";
  remarks?: string;
};

export type ComputeStandardPayrollInput<Employee extends PayrollEngineEmployee = PayrollEngineEmployee> = {
  employee: Employee;
  baseSalary: number;
  attendanceRow?: PayrollAttendanceRow;
  standingAllowanceLines: StandingAllowanceLine[];
  loanDeductionLines: LoanDeductionLine[];
  settings?: PayrollComputationSettings;
  runCutoff: PayrollCutoffIdentity;
  workPeriodCutoff: PayrollCutoffIdentity;
  deMinimisLines: DeMinimisLine[];
};

export type ComputeStandardPayrollResult = {
  grossPay: number;
  deductions: number;
  netPay: number;
  columns: Record<string, number | string | boolean>;
  computationPending: true;
  warnings: string[];
};

export type PayrollPipelineResult = {
  adjustedBase: number;
  computed: ComputeStandardPayrollResult;
  oneTimeCreditLines: OneTimeItemLine[];
  oneTimeDeductionLines: OneTimeItemLine[];
  standingAllowanceLines: StandingAllowanceLine[];
  deMinimisLines: DeMinimisLine[];
  loanDeductionLines: LoanDeductionLine[];
  finalGrossPay: number;
  finalDeductions: number;
  finalNetPay: number;
  columns: Record<string, number | string | boolean>;
};

function itemAppliesToEmployee(item: SpecialItem, employeeNo: string) {
  return item.employeeId.trim().toLowerCase() !== "all" && item.employeeId === employeeNo;
}

export function computeStandardPayroll<Employee extends PayrollEngineEmployee>(
  input: ComputeStandardPayrollInput<Employee>
): ComputeStandardPayrollResult {
  // TODO: Implement premium-hour bucket math, SSS, PhilHealth, Pag-IBIG, and BIR tax.
  // This stub intentionally returns a safe placeholder for import/review/save wiring only.
  const grossPay = Math.max(Number(input.baseSalary) || 0, 0);

  return {
    grossPay,
    deductions: 0,
    netPay: grossPay,
    columns: {
      adjustedBase: grossPay,
      computationPending: true,
      attendanceImported: Boolean(input.attendanceRow),
      standingAllowanceLines: input.standingAllowanceLines.length,
      standingAllowanceAmount: input.standingAllowanceLines.reduce((sum, line) => sum + line.amount, 0),
      loanDeductionLines: input.loanDeductionLines.length,
      loanDeductionAmount: input.loanDeductionLines.reduce((sum, line) => sum + line.amount, 0),
      deMinimisLines: input.deMinimisLines.length,
      deMinimisAmount: input.deMinimisLines.reduce((sum, line) => sum + line.amount, 0),
      deMinimisExemptPortion: input.deMinimisLines.reduce((sum, line) => sum + line.exemptPortion, 0),
      deMinimisShared90kBucketPortion: input.deMinimisLines.reduce(
        (sum, line) => sum + line.sharedNinetyKBucketPortion,
        0
      ),
      runCutoff: input.runCutoff.cutoffLabel || input.runCutoff.cutoff,
      workPeriodCutoff: input.workPeriodCutoff.cutoffLabel || input.workPeriodCutoff.cutoff,
    },
    computationPending: true,
    warnings: ["Computation pending: statutory and premium-hour math is not implemented yet."],
  };
}

export function applyOneTimeItems(
  computed: ComputeStandardPayrollResult,
  specialItems: SpecialItem[],
  employeeNo: string
) {
  const employeeItems = specialItems.filter((item) => itemAppliesToEmployee(item, employeeNo));
  const oneTimeCreditLines = employeeItems
    .filter((item) => item.category === "ONE_TIME_CREDIT")
    .map((item) => ({
      instructionType: item.instructionType,
      amount: item.amount,
      category: "ONE_TIME_CREDIT" as const,
      remarks: item.remarks,
    }));
  const oneTimeDeductionLines = employeeItems
    .filter((item) => item.category === "ONE_TIME_DEDUCTION")
    .map((item) => ({
      instructionType: item.instructionType,
      amount: item.amount,
      category: "ONE_TIME_DEDUCTION" as const,
      remarks: item.remarks,
    }));

  const credits = oneTimeCreditLines.reduce((sum, item) => sum + item.amount, 0);
  const deductions = oneTimeDeductionLines.reduce((sum, item) => sum + item.amount, 0);
  const netPayBeforeFloor = computed.netPay + credits - deductions;

  return {
    oneTimeCreditLines,
    oneTimeDeductionLines,
    finalGrossPay: computed.grossPay + credits,
    finalDeductions: computed.deductions + deductions,
    finalNetPay: Math.max(0, netPayBeforeFloor),
  };
}

export function runPayrollPipeline<Employee extends PayrollEngineEmployee>(input: {
  employee: Employee;
  specialItems: SpecialItem[];
  attendanceRow?: PayrollAttendanceRow;
  standingAllowances?: StandingAllowance[];
  payrollLoans?: PayrollLoanRecord[];
  deMinimisBenefits?: DeMinimisBenefit[];
  settings?: PayrollComputationSettings;
  cutoffIdentity: PayrollCutoffIdentity;
  workPeriodCutoff?: PayrollCutoffIdentity;
}): PayrollPipelineResult {
  const workPeriodCutoff = input.workPeriodCutoff || input.attendanceRow?.workPeriodCutoff || input.cutoffIdentity;
  const adjustedBase = getSalaryForCutoff(input.employee, workPeriodCutoff);
  const deMinimisLines = getDeMinimisForCutoff(input.employee, workPeriodCutoff, input.deMinimisBenefits || []);
  const standingAllowanceLines = getAllowancesForCutoff(input.employee, workPeriodCutoff, input.standingAllowances || []);
  const loanDeductionLines = getLoansForCutoff(input.employee, workPeriodCutoff, input.payrollLoans || []);
  const computed = computeStandardPayroll({
    employee: input.employee,
    baseSalary: adjustedBase,
    attendanceRow: input.attendanceRow,
    standingAllowanceLines,
    loanDeductionLines,
    settings: input.settings,
    runCutoff: input.cutoffIdentity,
    workPeriodCutoff,
    deMinimisLines,
  });
  const oneTime = applyOneTimeItems(computed, input.specialItems, input.employee.employeeNo);

  return {
    adjustedBase,
    computed,
    oneTimeCreditLines: oneTime.oneTimeCreditLines,
    oneTimeDeductionLines: oneTime.oneTimeDeductionLines,
    standingAllowanceLines,
    deMinimisLines,
    loanDeductionLines,
    finalGrossPay: oneTime.finalGrossPay,
    finalDeductions: oneTime.finalDeductions,
    finalNetPay: oneTime.finalNetPay,
    columns: computed.columns,
  };
}
