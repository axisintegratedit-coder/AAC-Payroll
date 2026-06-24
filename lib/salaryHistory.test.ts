import { describe, expect, it } from "vitest";
import { getSalaryForCutoff, type EmployeeWithSalaryHistory } from "./salaryHistory";

const employee: EmployeeWithSalaryHistory = {
  basicPay: 30000,
  salaryHistory: [
    {
      effectiveDate: "2026-05-01",
      baseSalary: 30000,
      reason: "Initial base salary",
      changedBy: "system",
      changedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      effectiveDate: "2026-06-10",
      baseSalary: 36000,
      reason: "Merit increase",
      changedBy: "payroll-admin",
      changedAt: "2026-06-09T08:00:00.000Z",
    },
  ],
};

describe("getSalaryForCutoff", () => {
  it("uses the new rate when a raise is effective before the cutoff pay date", () => {
    expect(getSalaryForCutoff(employee, { payDate: "2026-06-25" })).toBe(36000);
  });

  it("uses the new rate for the whole cutoff when a raise is effective inside the cutoff window", () => {
    expect(getSalaryForCutoff(employee, { payDate: "2026-06-15" })).toBe(36000);
  });

  it("uses the old rate when a raise is effective after the cutoff pay date", () => {
    expect(getSalaryForCutoff(employee, { payDate: "2026-06-05" })).toBe(30000);
  });
});
