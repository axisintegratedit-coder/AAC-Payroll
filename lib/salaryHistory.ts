export type SalaryHistoryEntry = {
  effectiveDate: string;
  baseSalary: number;
  reason: string;
  changedBy: string;
  changedAt: string;
};

export type EmployeeWithSalaryHistory = {
  basicPay?: number;
  baseSalary?: number;
  hireDate?: string;
  createdAt?: string;
  dateAdded?: string;
  salaryHistory?: SalaryHistoryEntry[];
};

export type PayrollCutoffSalaryDate = {
  payDate?: string;
  payrollDate?: string;
  actualPayrollDate?: string;
};

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function fallbackEffectiveDate(employee: EmployeeWithSalaryHistory): string {
  const candidate = String(employee.hireDate || employee.createdAt || employee.dateAdded || "").slice(0, 10);
  return isValidIsoDate(candidate) ? candidate : "1900-01-01";
}

function readBaseSalary(employee: EmployeeWithSalaryHistory): number {
  return Number(employee.baseSalary ?? employee.basicPay) || 0;
}

export function normalizeSalaryHistory(employee: EmployeeWithSalaryHistory): SalaryHistoryEntry[] {
  const normalized = (employee.salaryHistory || [])
    .filter((entry) => entry && isValidIsoDate(String(entry.effectiveDate || "")))
    .map((entry) => ({
      effectiveDate: entry.effectiveDate,
      baseSalary: Number(entry.baseSalary) || 0,
      reason: String(entry.reason || "Salary history"),
      changedBy: String(entry.changedBy || "unknown"),
      changedAt: String(entry.changedAt || ""),
    }))
    .filter((entry) => entry.baseSalary > 0);

  if (normalized.length === 0) {
    const baseSalary = readBaseSalary(employee);
    if (baseSalary > 0) {
      normalized.push({
        effectiveDate: fallbackEffectiveDate(employee),
        baseSalary,
        reason: "Initial base salary",
        changedBy: "system",
        changedAt: "",
      });
    }
  }

  return normalized.sort((a, b) => {
    const dateSort = a.effectiveDate.localeCompare(b.effectiveDate);
    if (dateSort !== 0) return dateSort;
    return String(a.changedAt || "").localeCompare(String(b.changedAt || ""));
  });
}

export function appendSalaryHistoryEntry(
  employee: EmployeeWithSalaryHistory,
  entry: SalaryHistoryEntry
): SalaryHistoryEntry[] {
  return normalizeSalaryHistory(employee).concat(entry);
}

export function getCurrentBaseSalary(employee: EmployeeWithSalaryHistory, asOfDate = todayIsoDate()): number {
  return getSalaryForDate(employee, asOfDate);
}

export function getSalaryForDate(employee: EmployeeWithSalaryHistory, payDate: string): number {
  const rawPayDate = String(payDate || "").trim();
  if (!isValidIsoDate(rawPayDate)) return readBaseSalary(employee);

  const entry = normalizeSalaryHistory(employee)
    .filter((item) => item.effectiveDate <= rawPayDate)
    .sort((a, b) => {
      const dateSort = b.effectiveDate.localeCompare(a.effectiveDate);
      if (dateSort !== 0) return dateSort;
      return String(b.changedAt || "").localeCompare(String(a.changedAt || ""));
    })[0];

  return entry?.baseSalary ?? readBaseSalary(employee);
}

export function getSalaryForCutoff(
  employee: EmployeeWithSalaryHistory,
  cutoff: PayrollCutoffSalaryDate
): number {
  const payDate = cutoff.payDate || cutoff.payrollDate || cutoff.actualPayrollDate || "";
  return getSalaryForDate(employee, payDate);
}
