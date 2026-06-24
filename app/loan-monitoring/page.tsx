"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { logAudit } from "@/lib/auditTrail";
import { canAccessAdminPageAsync, getCurrentAdminUser } from "@/lib/adminAuth";
import { storageKeys } from "@/lib/appStorage";
import { getCollectionItems, setCollectionItems } from "@/lib/firestore";
import {
  normalizeLoanType,
  normalizeLoanDeductionFrequency,
  normalizeLoanCutoffSlot,
  stripUndefinedAndEmptyStrings,
  type PayrollLoanCutoffSlot,
  type PayrollLoanDeductionFrequency,
  type PayrollLoanRecord,
  type PayrollLoanStatus,
  type PayrollLoanType,
} from "@/lib/loans";

type Employee = {
  employeeNo: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  department?: string;
  archived?: boolean;
};

type LoanDraft = {
  employeeId: string;
  loanType: PayrollLoanType;
  loanName: string;
  principalAmount: number;
  maximumAmount?: number;
  amortizationPerCutoff: number;
  deductionFrequency: PayrollLoanDeductionFrequency;
  monthlyDeductionCutoff?: PayrollLoanCutoffSlot;
  startDate: string;
  endDate?: string;
  status: PayrollLoanStatus;
  remainingBalance: number;
};

const loanTypes: PayrollLoanType[] = ["SSS Loan", "HDMF Loan", "Calamity Loan", "Capped Deduction"];
const deductionFrequencyOptions: PayrollLoanDeductionFrequency[] = ["Semi-monthly", "Monthly"];
const cutoffOptions: PayrollLoanCutoffSlot[] = ["15th", "30th/31st"];
const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getFullName(employee: Employee) {
  return [employee.lastName, [employee.firstName, employee.middleName].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || employee.employeeNo;
}

function makeLoanId() {
  return `payroll-loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft(): LoanDraft {
  return {
    employeeId: "",
    loanType: "SSS Loan",
    loanName: "SSS Loan",
    principalAmount: 0,
    maximumAmount: undefined,
    amortizationPerCutoff: 0,
    deductionFrequency: "Semi-monthly",
    monthlyDeductionCutoff: undefined,
    startDate: "",
    endDate: "",
    status: "Active",
    remainingBalance: 0,
  };
}

function normalizeLoan(raw: PayrollLoanRecord): PayrollLoanRecord {
  const principalAmount = Number(raw.principalAmount) || 0;
  return {
    ...raw,
    loanType: normalizeLoanType(raw.loanType),
    loanName: raw.loanName || normalizeLoanType(raw.loanType),
    principalAmount,
    maximumAmount: raw.maximumAmount === undefined || raw.maximumAmount === null ? undefined : Number(raw.maximumAmount) || 0,
    amortizationPerCutoff: Number(raw.amortizationPerCutoff) || 0,
    deductionFrequency: normalizeLoanDeductionFrequency(raw.deductionFrequency),
    monthlyDeductionCutoff: normalizeLoanDeductionFrequency(raw.deductionFrequency) === "Monthly"
      ? normalizeLoanCutoffSlot(raw.monthlyDeductionCutoff) || "30th/31st"
      : undefined,
    remainingBalance: raw.remainingBalance === undefined || raw.remainingBalance === null ? principalAmount : Number(raw.remainingBalance) || 0,
    status: raw.status === "Paid" ? "Paid" : "Active",
  };
}

function serializeDiff(before: unknown, after: unknown) {
  const beforeRecord = (before || {}) as Record<string, unknown>;
  const afterRecord = (after || {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]));
  return Object.fromEntries(
    keys
      .filter((key) => JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]))
      .map((key) => [key, { before: beforeRecord[key] ?? null, after: afterRecord[key] ?? null }])
  );
}

function currentUserName() {
  const user = getCurrentAdminUser();
  return user?.name || user?.email || "Admin";
}

export default function LoanMonitoringPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loans, setLoans] = useState<PayrollLoanRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<"All" | PayrollLoanStatus>("All");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loanTypeFilter, setLoanTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<LoanDraft>(emptyDraft());
  const [deleteTarget, setDeleteTarget] = useState<PayrollLoanRecord | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      const access = await canAccessAdminPageAsync(["Owner", "Super User", "HR Admin", "Payroll Admin"]);
      if (cancelled) return;
      if (!access.allowed) {
        router.replace(access.redirectTo);
        return;
      }
      setAuthChecking(false);
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (authChecking) return;
    async function loadData() {
      setLoading(true);
      const [rawEmployees, rawLoans] = await Promise.all([
        getCollectionItems<Employee>(storageKeys.employees),
        getCollectionItems<PayrollLoanRecord>(storageKeys.payrollLoans),
      ]);
      setEmployees(rawEmployees.filter((employee) => !employee.archived));
      setLoans(rawLoans.map(normalizeLoan));
      setLoading(false);
    }
    loadData();
  }, [authChecking]);

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((employee) => map.set(employee.employeeNo.toLowerCase(), employee));
    return map;
  }, [employees]);

  const departments = useMemo(() => {
    const set = new Set(employees.map((employee) => employee.department || "").filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const employeeSearchResults = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return employees
      .filter((employee) => `${employee.employeeNo} ${getFullName(employee)} ${employee.department || ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [employeeSearch, employees]);

  const filtered = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return loans.filter((loan) => {
      const employee = employeeById.get(loan.employeeId.toLowerCase());
      const department = loan.department || employee?.department || "";
      const employeeName = loan.employeeName || (employee ? getFullName(employee) : "");
      if (statusFilter !== "All" && loan.status !== statusFilter) return false;
      if (departmentFilter && department !== departmentFilter) return false;
      if (loanTypeFilter && loan.loanType !== loanTypeFilter) return false;
      if (query && !`${loan.employeeId} ${employeeName} ${department} ${loan.loanName} ${loan.loanType}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [employeeById, loans, statusFilter, departmentFilter, loanTypeFilter, searchText]);

  const activeRows = filtered.filter((loan) => loan.status === "Active");
  const totals = {
    principalAmount: activeRows.reduce((sum, loan) => sum + loan.principalAmount, 0),
    amountPaid: activeRows.reduce((sum, loan) => sum + Math.max(0, loan.principalAmount - loan.remainingBalance), 0),
    remainingBalance: activeRows.reduce((sum, loan) => sum + loan.remainingBalance, 0),
  };

  function openCreateModal() {
    setEditingId("");
    setDraft(emptyDraft());
    setEmployeeSearch("");
    setFormError("");
    setModalMode("create");
  }

  function openEditModal(loan: PayrollLoanRecord) {
    setEditingId(loan.id);
    setDraft({
      employeeId: loan.employeeId,
      loanType: loan.loanType,
      loanName: loan.loanName,
      principalAmount: loan.principalAmount,
      maximumAmount: loan.maximumAmount ?? undefined,
      amortizationPerCutoff: loan.amortizationPerCutoff,
      deductionFrequency: normalizeLoanDeductionFrequency(loan.deductionFrequency),
      monthlyDeductionCutoff: normalizeLoanDeductionFrequency(loan.deductionFrequency) === "Monthly"
        ? normalizeLoanCutoffSlot(loan.monthlyDeductionCutoff) || "30th/31st"
        : undefined,
      startDate: loan.startDate,
      endDate: loan.endDate || "",
      status: loan.status,
      remainingBalance: loan.remainingBalance,
    });
    setEmployeeSearch("");
    setFormError("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId("");
    setDraft(emptyDraft());
    setEmployeeSearch("");
    setFormError("");
  }

  function chooseEmployee(employeeNo: string) {
    const employee = employeeById.get(employeeNo.toLowerCase());
    setDraft((current) => ({ ...current, employeeId: employeeNo }));
    setEmployeeSearch(employee ? `${employee.employeeNo} · ${getFullName(employee)}` : employeeNo);
  }

  function validateDraft() {
    if (!draft.employeeId.trim()) return "Select an employee.";
    if (!employeeById.has(draft.employeeId.trim().toLowerCase())) return "Selected employee was not found.";
    if (!draft.loanName.trim()) return "Loan name is required.";
    if (!draft.startDate) return "Start date is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startDate)) return "Start date must be YYYY-MM-DD.";
    if (draft.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.endDate)) return "End date must be YYYY-MM-DD.";
    if (draft.endDate && draft.endDate < draft.startDate) return "End date cannot be before start date.";
    if (!Number.isFinite(Number(draft.principalAmount)) || Number(draft.principalAmount) <= 0) return "Principal amount must be greater than 0.";
    if (!Number.isFinite(Number(draft.amortizationPerCutoff)) || Number(draft.amortizationPerCutoff) <= 0) return "Amortization per cutoff must be greater than 0.";
    if (draft.deductionFrequency === "Monthly" && !draft.monthlyDeductionCutoff) return "Choose which cutoff this monthly loan deducts on.";
    if (draft.maximumAmount !== undefined && Number(draft.maximumAmount) < 0) return "Maximum amount cannot be negative.";
    if (!Number.isFinite(Number(draft.remainingBalance)) || Number(draft.remainingBalance) < 0) return "Remaining balance cannot be negative.";
    return "";
  }

  async function saveLoan() {
    const error = validateDraft();
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const userName = currentUserName();
    const employee = employeeById.get(draft.employeeId.trim().toLowerCase());
    const cleanDraft = stripUndefinedAndEmptyStrings({
      ...draft,
      employeeId: draft.employeeId.trim(),
      employeeName: employee ? getFullName(employee) : undefined,
      department: employee?.department || undefined,
      loanType: draft.loanType,
      loanName: draft.loanName.trim(),
      principalAmount: Number(draft.principalAmount) || 0,
      maximumAmount: draft.maximumAmount === undefined || draft.maximumAmount === null ? undefined : Number(draft.maximumAmount),
      amortizationPerCutoff: Number(draft.amortizationPerCutoff) || 0,
      deductionFrequency: draft.deductionFrequency,
      monthlyDeductionCutoff: draft.deductionFrequency === "Monthly" ? draft.monthlyDeductionCutoff : undefined,
      remainingBalance: Number(draft.remainingBalance) || 0,
      endDate: draft.endDate || undefined,
    }) as Omit<PayrollLoanRecord, "id" | "createdAt" | "createdBy">;

    try {
      if (modalMode === "create") {
        const loan: PayrollLoanRecord = {
          id: makeLoanId(),
          ...cleanDraft,
          status: cleanDraft.remainingBalance <= 0 ? "Paid" : cleanDraft.status,
          createdAt: now,
          createdBy: userName,
        };
        const nextLoans = [...loans, loan];
        await setCollectionItems(storageKeys.payrollLoans, nextLoans.map((item) => stripUndefinedAndEmptyStrings(item)));
        setLoans(nextLoans);
        await logAudit({
          action: "CREATED",
          entityType: "PayrollLoan",
          entityId: loan.id,
          entityName: loan.loanName,
          details: JSON.stringify({ event: "PAYROLL_LOAN_CREATED", before: null, after: loan, changedBy: userName, changedAt: now }),
        });
      } else {
        const before = loans.find((loan) => loan.id === editingId);
        if (!before) throw new Error("Loan not found.");
        const after: PayrollLoanRecord = {
          ...before,
          ...cleanDraft,
          status: cleanDraft.remainingBalance <= 0 ? "Paid" : cleanDraft.status,
          updatedAt: now,
          updatedBy: userName,
        };
        const nextLoans = loans.map((loan) => (loan.id === editingId ? after : loan));
        await setCollectionItems(storageKeys.payrollLoans, nextLoans.map((item) => stripUndefinedAndEmptyStrings(item)));
        setLoans(nextLoans);
        await logAudit({
          action: "EDITED",
          entityType: "PayrollLoan",
          entityId: after.id,
          entityName: after.loanName,
          details: JSON.stringify({ event: "PAYROLL_LOAN_CHANGED", before, after, diff: serializeDiff(before, after), changedBy: userName, changedAt: now }),
        });
      }
      closeModal();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save loan.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLoan() {
    if (!deleteTarget) return;
    setSaving(true);
    const now = new Date().toISOString();
    const userName = currentUserName();
    const before = deleteTarget;
    const nextLoans = loans.filter((loan) => loan.id !== before.id);
    await setCollectionItems(storageKeys.payrollLoans, nextLoans.map((item) => stripUndefinedAndEmptyStrings(item)));
    setLoans(nextLoans);
    await logAudit({
      action: "DELETED",
      entityType: "PayrollLoan",
      entityId: before.id,
      entityName: before.loanName,
      details: JSON.stringify({ event: "PAYROLL_LOAN_DELETED", before, after: null, diff: serializeDiff(before, null), changedBy: userName, changedAt: now }),
    });
    setDeleteTarget(null);
    setSaving(false);
  }

  function handleExportCsv() {
    const headers = [
      "Employee No.",
      "Employee Name",
      "Department",
      "Loan Type",
      "Loan Name",
      "Start Date",
      "End Date",
      "Principal Amount",
      "Amount Paid",
      "Remaining Balance",
      "Amortization Per Cutoff",
      "Deduction Frequency",
      "Monthly Cutoff",
      "Status",
    ];
    const csvRows = [
      headers.join(","),
      ...filtered.map((loan) => {
        const employee = employeeById.get(loan.employeeId.toLowerCase());
        const employeeName = loan.employeeName || (employee ? getFullName(employee) : "");
        const department = loan.department || employee?.department || "";
        return [
          loan.employeeId,
          `"${employeeName}"`,
          `"${department}"`,
          `"${loan.loanType}"`,
          `"${loan.loanName}"`,
          loan.startDate,
          loan.endDate || "",
          loan.principalAmount,
          Math.max(0, loan.principalAmount - loan.remainingBalance),
          loan.remainingBalance,
          loan.amortizationPerCutoff,
          loan.deductionFrequency || "Semi-monthly",
          loan.monthlyDeductionCutoff || "",
          loan.status,
        ].join(",");
      }),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loan-monitoring.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authChecking || loading) {
    return (
      <main className="min-h-screen pg-bg p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          Loading loan data...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pg-bg p-6">
      {saving ? <div className="fixed inset-x-0 top-0 z-[80] h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 shadow-[0_0_18px_rgba(14,165,233,0.45)]" /> : null}

      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-2xl border border-white bg-white/95 p-6 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#0a4f8f]">
                <CheckCircle2 className="h-4 w-4" />
                Payroll Runs
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Loan Monitoring</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Canonical loan records live here. Payroll runs read active deductions from this page and decrement balances only after a run is saved.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleExportCsv} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                Export CSV
              </button>
              <button type="button" onClick={openCreateModal} className={`${buttonClassName} bg-[#0a4f8f] text-white shadow-[0_18px_35px_-22px_rgba(14,116,144,0.9)] hover:bg-[#073c6d]`}>
                <Plus className="h-4 w-4" />
                Add Loan
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["Active Principal", formatCurrency(totals.principalAmount)],
              ["Active Paid", formatCurrency(totals.amountPaid)],
              ["Active Remaining", formatCurrency(totals.remainingBalance)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</div>
                <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(8,47,73,0.65)]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClassName} pl-9`} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search employee, loan, department" />
            </label>
            <select className={inputClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | PayrollLoanStatus)}>
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Paid">Paid</option>
            </select>
            <select className={inputClassName} value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              <option value="">All Departments</option>
              {departments.map((department) => <option key={department}>{department}</option>)}
            </select>
            <select className={inputClassName} value={loanTypeFilter} onChange={(event) => setLoanTypeFilter(event.target.value)}>
              <option value="">All Loan Types</option>
              {loanTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No loans found matching the current filters.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1160px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    {["Employee", "Department", "Loan", "Period", "Principal", "Paid", "Remaining", "Per Cutoff", "Status", "Actions"].map((header) => (
                      <th key={header} className="px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((loan) => {
                    const employee = employeeById.get(loan.employeeId.toLowerCase());
                    const employeeName = loan.employeeName || (employee ? getFullName(employee) : loan.employeeId);
                    const department = loan.department || employee?.department || "-";
                    const paid = Math.max(0, loan.principalAmount - loan.remainingBalance);
                    return (
                      <tr key={loan.id} className="border-b border-slate-100">
                        <td className="px-3 py-3 text-sm font-bold text-slate-950">
                          <div>{employeeName}</div>
                          <div className="text-xs font-semibold text-slate-500">{loan.employeeId}</div>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-700">{department}</td>
                        <td className="px-3 py-3 text-sm">
                          <div className="font-black text-amber-800">{loan.loanName}</div>
                          <div className="text-xs font-semibold text-slate-500">{loan.loanType}</div>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-700">
                          {loan.startDate || "-"}{loan.endDate ? ` to ${loan.endDate}` : ""}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(loan.principalAmount)}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-emerald-700">{formatCurrency(paid)}</td>
                        <td className="px-3 py-3 text-right text-sm font-black text-rose-700">{formatCurrency(loan.remainingBalance)}</td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-slate-700">
                          <div>{formatCurrency(loan.amortizationPerCutoff)}</div>
                          <div className="text-xs font-bold text-slate-500">
                            {loan.deductionFrequency || "Semi-monthly"}
                            {loan.deductionFrequency === "Monthly" && loan.monthlyDeductionCutoff ? ` · ${loan.monthlyDeductionCutoff}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${loan.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => openEditModal(loan)} className={`${buttonClassName} border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50`}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(loan)} className={`${buttonClassName} border border-rose-200 bg-rose-50 px-3 text-rose-700 hover:bg-rose-100`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-black text-slate-950">{modalMode === "create" ? "Add Loan" : "Edit Loan"}</h2>
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{formError}</div> : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Employee</span>
                <input className={inputClassName} value={employeeSearch || draft.employeeId} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employee no. or name" />
                <div className="grid max-h-44 gap-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {employeeSearchResults.map((employee) => (
                    <button key={employee.employeeNo} type="button" onClick={() => chooseEmployee(employee.employeeNo)} className={`rounded-lg px-3 py-2 text-left text-sm font-bold ${draft.employeeId === employee.employeeNo ? "bg-sky-100 text-[#0a4f8f]" : "bg-white text-slate-700 hover:bg-sky-50"}`}>
                      {employee.employeeNo} · {getFullName(employee)}
                      <span className="ml-2 text-xs text-slate-500">{employee.department || ""}</span>
                    </button>
                  ))}
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Loan Type</span>
                <select className={inputClassName} value={draft.loanType} onChange={(event) => {
                  const nextType = event.target.value as PayrollLoanType;
                  setDraft({ ...draft, loanType: nextType, loanName: draft.loanName === draft.loanType ? nextType : draft.loanName });
                }}>
                  {loanTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Loan Name</span>
                <input className={inputClassName} value={draft.loanName} onChange={(event) => setDraft({ ...draft, loanName: event.target.value })} placeholder="e.g. HMO, SSS Salary Loan" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Principal Amount</span>
                <input type="number" min={0} className={inputClassName} value={draft.principalAmount} onChange={(event) => {
                  const amount = Number(event.target.value);
                  setDraft({ ...draft, principalAmount: amount, remainingBalance: modalMode === "create" ? amount : draft.remainingBalance });
                }} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Maximum Amount / Cap</span>
                <input type="number" min={0} className={inputClassName} value={draft.maximumAmount ?? ""} onChange={(event) => setDraft({ ...draft, maximumAmount: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Amortization Per Cutoff</span>
                <input type="number" min={0} className={inputClassName} value={draft.amortizationPerCutoff} onChange={(event) => setDraft({ ...draft, amortizationPerCutoff: Number(event.target.value) })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Deduction Frequency</span>
                <select
                  className={inputClassName}
                  value={draft.deductionFrequency}
                  onChange={(event) => {
                    const frequency = event.target.value as PayrollLoanDeductionFrequency;
                    setDraft({
                      ...draft,
                      deductionFrequency: frequency,
                      monthlyDeductionCutoff: frequency === "Monthly" ? draft.monthlyDeductionCutoff || "30th/31st" : undefined,
                    });
                  }}
                >
                  {deductionFrequencyOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {draft.deductionFrequency === "Monthly" ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Which Cutoff</span>
                  <select
                    className={inputClassName}
                    value={draft.monthlyDeductionCutoff || ""}
                    onChange={(event) => setDraft({ ...draft, monthlyDeductionCutoff: event.target.value as PayrollLoanCutoffSlot })}
                  >
                    <option value="">Select cutoff</option>
                    {cutoffOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Remaining Balance</span>
                <input type="number" min={0} className={inputClassName} value={draft.remainingBalance} onChange={(event) => setDraft({ ...draft, remainingBalance: Number(event.target.value), status: Number(event.target.value) <= 0 ? "Paid" : draft.status })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Start Date</span>
                <input type="date" className={inputClassName} value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">End Date / Until</span>
                <input type="date" className={inputClassName} value={draft.endDate || ""} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Status</span>
                <select className={inputClassName} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as PayrollLoanStatus })}>
                  <option>Active</option>
                  <option>Paid</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={saving} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Cancel</button>
              <button type="button" onClick={saveLoan} disabled={saving} className={`${buttonClassName} bg-[#0a4f8f] text-white hover:bg-[#073c6d]`}>
                {saving ? "Saving..." : "Save Loan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.45)]">
            <h2 className="text-lg font-black text-slate-950">Delete Loan</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Delete {deleteTarget.loanName} for {deleteTarget.employeeName || deleteTarget.employeeId}? This removes the canonical loan record.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={saving} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>Cancel</button>
              <button type="button" onClick={deleteLoan} disabled={saving} className={`${buttonClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
