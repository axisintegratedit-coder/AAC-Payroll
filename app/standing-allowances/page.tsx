"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { canAccessAdminPageAsync, getCurrentAdminUser } from "@/lib/adminAuth";
import {
  getAllowancesForCutoff,
  standingAllowanceTargetsEmployee,
  type StandingAllowance,
  type StandingAllowanceCategoryTarget,
  type StandingAllowanceCutoffSlot,
  type StandingAllowanceFrequency,
} from "@/lib/standingAllowances";

type EmployeeRecord = {
  employeeNo: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  employeeType?: string;
  employmentStatus?: string;
  department?: string;
  archived?: boolean;
};

type AllowanceDraft = Omit<StandingAllowance, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "archived">;

const categoryTargetOptions: StandingAllowanceCategoryTarget[] = ["All employees", "All Rank and File", "All Supervisory"];
const frequencyOptions: StandingAllowanceFrequency[] = ["Monthly", "Semi-monthly"];
const cutoffOptions: StandingAllowanceCutoffSlot[] = ["15th", "30th/31st"];

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
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

function formatEmployeeName(employee: EmployeeRecord) {
  return [employee.lastName, [employee.firstName, employee.middleName].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ") || employee.employeeNo;
}

function makeAllowanceId() {
  return `standing-allowance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDraft(): AllowanceDraft {
  return {
    name: "",
    amount: 0,
    minAmount: undefined,
    maxAmount: undefined,
    taxable: false,
    applyBeforeTax: false,
    frequency: "Monthly",
    monthlyCutoff: "15th",
    remarks: "",
    categoryTargets: [],
    employeeTargets: [],
  };
}

function normalizeAllowance(raw: StandingAllowance): StandingAllowance {
  return {
    ...raw,
    amount: Number(raw.amount) || 0,
    minAmount: raw.minAmount === undefined || raw.minAmount === null ? undefined : Number(raw.minAmount) || 0,
    maxAmount: raw.maxAmount === undefined || raw.maxAmount === null ? undefined : Number(raw.maxAmount) || 0,
    taxable: Boolean(raw.taxable),
    applyBeforeTax: Boolean(raw.applyBeforeTax),
    categoryTargets: Array.isArray(raw.categoryTargets) ? raw.categoryTargets : [],
    employeeTargets: Array.isArray(raw.employeeTargets) ? raw.employeeTargets : [],
  };
}

function stripUndefinedAndEmptyStrings<T>(value: T): T {
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

export default function StandingAllowancesPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [allowances, setAllowances] = useState<StandingAllowance[]>([]);
  const [searchText, setSearchText] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<AllowanceDraft>(emptyDraft());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StandingAllowance | null>(null);
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
      const [rawEmployees, rawAllowances] = await Promise.all([
        getCollectionItems<EmployeeRecord>(storageKeys.employees),
        getCollectionItems<StandingAllowance>(storageKeys.standingAllowances),
      ]);
      setEmployees(rawEmployees.filter((employee) => !employee.archived));
      setAllowances(rawAllowances.map(normalizeAllowance));
      setLoading(false);
    }
    loadData();
  }, [authChecking]);

  const activeAllowances = useMemo(() => allowances.filter((allowance) => !allowance.archived), [allowances]);
  const filteredAllowances = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return activeAllowances;
    return activeAllowances.filter((allowance) => `${allowance.name} ${allowance.remarks || ""}`.toLowerCase().includes(query));
  }, [activeAllowances, searchText]);

  const allowanceRecipients = useMemo(() => {
    const map = new Map<string, EmployeeRecord[]>();
    activeAllowances.forEach((allowance) => {
      map.set(allowance.id, employees.filter((employee) => standingAllowanceTargetsEmployee(allowance, employee)));
    });
    return map;
  }, [activeAllowances, employees]);

  const employeeSearchResults = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees.slice(0, 8);
    return employees
      .filter((employee) => `${employee.employeeNo} ${formatEmployeeName(employee)} ${employee.department || ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [employeeSearch, employees]);

  const totals = useMemo(() => {
    const assignedEmployees = new Set<string>();
    let cutoffExposure = 0;
    activeAllowances.forEach((allowance) => {
      const recipients = allowanceRecipients.get(allowance.id) || [];
      recipients.forEach((employee) => assignedEmployees.add(employee.employeeNo));
      const sampleCutoff = { monthYear: "2026-01", cutoff: allowance.monthlyCutoff || "15th", cutoffLabel: allowance.monthlyCutoff || "15th" };
      const sampleRecipients = recipients.length > 0 ? recipients : [{ employeeNo: "__sample__" }];
      sampleRecipients.forEach((employee) => {
        cutoffExposure += getAllowancesForCutoff(employee, sampleCutoff, [allowance]).reduce((sum, line) => sum + line.amount, 0);
      });
    });
    return { activeAllowances: activeAllowances.length, assignedEmployees: assignedEmployees.size, cutoffExposure };
  }, [activeAllowances, allowanceRecipients]);

  function openCreateModal() {
    setEditingId("");
    setDraft(emptyDraft());
    setEmployeeSearch("");
    setFormError("");
    setModalMode("create");
  }

  function openEditModal(allowance: StandingAllowance) {
    setEditingId(allowance.id);
    setDraft({
      name: allowance.name,
      amount: allowance.amount,
      minAmount: allowance.minAmount,
      maxAmount: allowance.maxAmount,
      taxable: allowance.taxable,
      applyBeforeTax: allowance.applyBeforeTax,
      frequency: allowance.frequency,
      monthlyCutoff: allowance.monthlyCutoff || "15th",
      remarks: allowance.remarks || "",
      categoryTargets: allowance.categoryTargets || [],
      employeeTargets: allowance.employeeTargets || [],
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

  function toggleCategoryTarget(target: StandingAllowanceCategoryTarget) {
    setDraft((current) => ({
      ...current,
      categoryTargets: current.categoryTargets.includes(target)
        ? current.categoryTargets.filter((item) => item !== target)
        : [...current.categoryTargets, target],
    }));
  }

  function addEmployeeTarget(employeeNo: string) {
    setDraft((current) => {
      if (current.employeeTargets.some((target) => target.toLowerCase() === employeeNo.toLowerCase())) return current;
      return { ...current, employeeTargets: [...current.employeeTargets, employeeNo] };
    });
  }

  function validateDraft() {
    if (!draft.name.trim()) return "Name is required.";
    if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) return "Amount must be greater than 0.";
    if (draft.minAmount !== undefined && Number(draft.minAmount) < 0) return "Minimum amount cannot be negative.";
    if (draft.maxAmount !== undefined && Number(draft.maxAmount) < 0) return "Maximum amount cannot be negative.";
    if (draft.minAmount !== undefined && draft.maxAmount !== undefined && Number(draft.minAmount) > Number(draft.maxAmount)) {
      return "Minimum amount cannot be greater than maximum amount.";
    }
    if (draft.frequency === "Monthly" && !draft.monthlyCutoff) return "Choose the monthly cutoff placement.";
    if (draft.categoryTargets.length === 0 && draft.employeeTargets.length === 0) return "Assign this allowance to at least one category or employee.";
    return "";
  }

  async function saveAllowance() {
    const error = validateDraft();
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const userName = currentUserName();
    const cleanDraft = stripUndefinedAndEmptyStrings({
      ...draft,
      name: draft.name.trim(),
      amount: Number(draft.amount) || 0,
      minAmount: draft.minAmount === undefined || draft.minAmount === null ? undefined : Number(draft.minAmount),
      maxAmount: draft.maxAmount === undefined || draft.maxAmount === null ? undefined : Number(draft.maxAmount),
      taxable: Boolean(draft.taxable),
      applyBeforeTax: Boolean(draft.applyBeforeTax),
      monthlyCutoff: draft.frequency === "Monthly" ? draft.monthlyCutoff : undefined,
      remarks: draft.remarks?.trim() || undefined,
      categoryTargets: draft.categoryTargets,
      employeeTargets: draft.employeeTargets,
    }) as AllowanceDraft;

    try {
      if (modalMode === "create") {
        const allowance: StandingAllowance = { id: makeAllowanceId(), ...cleanDraft, createdAt: now, createdBy: userName };
        const nextAllowances = [...allowances, allowance];
        await setCollectionItems(storageKeys.standingAllowances, nextAllowances.map((item) => stripUndefinedAndEmptyStrings(item)));
        setAllowances(nextAllowances);
        await logAudit({
          action: "CREATED",
          entityType: "StandingAllowance",
          entityId: allowance.id,
          entityName: allowance.name,
          details: JSON.stringify({ event: "STANDING_ALLOWANCE_CREATED", before: null, after: allowance, changedBy: userName, changedAt: now }),
        });
      } else {
        const before = allowances.find((allowance) => allowance.id === editingId);
        if (!before) throw new Error("Allowance not found.");
        const after: StandingAllowance = { ...before, ...cleanDraft, updatedAt: now, updatedBy: userName };
        const nextAllowances = allowances.map((allowance) => (allowance.id === editingId ? after : allowance));
        await setCollectionItems(storageKeys.standingAllowances, nextAllowances.map((item) => stripUndefinedAndEmptyStrings(item)));
        setAllowances(nextAllowances);
        await logAudit({
          action: "EDITED",
          entityType: "StandingAllowance",
          entityId: after.id,
          entityName: after.name,
          details: JSON.stringify({ event: "STANDING_ALLOWANCE_CHANGED", before, after, diff: serializeDiff(before, after), changedBy: userName, changedAt: now }),
        });
      }
      window.dispatchEvent(new Event("standing-allowances-updated"));
      closeModal();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save allowance.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAllowance() {
    if (!deleteTarget) return;
    setSaving(true);
    const now = new Date().toISOString();
    const userName = currentUserName();
    const before = deleteTarget;
    const nextAllowances = allowances.filter((allowance) => allowance.id !== before.id);
    await setCollectionItems(storageKeys.standingAllowances, nextAllowances.map((item) => stripUndefinedAndEmptyStrings(item)));
    setAllowances(nextAllowances);
    window.dispatchEvent(new Event("standing-allowances-updated"));
    await logAudit({
      action: "DELETED",
      entityType: "StandingAllowance",
      entityId: before.id,
      entityName: before.name,
      details: JSON.stringify({ event: "STANDING_ALLOWANCE_DELETED", before, after: null, diff: serializeDiff(before, null), changedBy: userName, changedAt: now }),
    });
    setDeleteTarget(null);
    setSaving(false);
  }

  if (authChecking || loading) {
    return (
      <main className="min-h-screen pg-bg p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          Loading standing allowances...
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
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Standing Allowances</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Define recurring allowances once, assign them by category or employee, and let payroll runs pull applicable allowance lines by cutoff.
              </p>
            </div>
            <button type="button" onClick={openCreateModal} className={`${buttonClassName} bg-[#0a4f8f] text-white shadow-[0_18px_35px_-22px_rgba(14,116,144,0.9)] hover:bg-[#073c6d]`}>
              <Plus className="h-4 w-4" />
              Add Allowance
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["Active Allowances", totals.activeAllowances],
              ["Assigned Employees", totals.assignedEmployees],
              ["Sample Cutoff Exposure", formatCurrency(totals.cutoffExposure)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</div>
                <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-38px_rgba(8,47,73,0.65)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputClassName} pl-9`} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search allowances" />
            </label>
          </div>

          {filteredAllowances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No standing allowances yet.</div>
          ) : (
            <div className="grid gap-3">
              {filteredAllowances.map((allowance) => {
                const recipients = allowanceRecipients.get(allowance.id) || [];
                return (
                  <article key={allowance.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_12px_28px_-24px_rgba(8,47,73,0.72)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-950">{allowance.name}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {formatCurrency(allowance.amount)} · {allowance.frequency}
                          {allowance.frequency === "Monthly" ? ` · ${allowance.monthlyCutoff}` : " · both cutoffs"} · {allowance.taxable ? "Taxable" : "Non-taxable"} · {allowance.applyBeforeTax ? "Before tax" : "After tax"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => openEditModal(allowance)} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(allowance)} className={`${buttonClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {allowance.categoryTargets.map((target) => (
                        <span key={target} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0a4f8f]">{target}</span>
                      ))}
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {recipients.length} current recipient{recipients.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-black text-slate-950">{modalMode === "create" ? "Add Allowance" : "Edit Allowance"}</h2>
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{formError}</div> : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Name</span>
                <input className={inputClassName} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Amount</span>
                <input type="number" className={inputClassName} value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Minimum Amount</span>
                <input type="number" className={inputClassName} value={draft.minAmount ?? ""} onChange={(event) => setDraft({ ...draft, minAmount: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Maximum Amount</span>
                <input type="number" className={inputClassName} value={draft.maxAmount ?? ""} onChange={(event) => setDraft({ ...draft, maxAmount: event.target.value === "" ? undefined : Number(event.target.value) })} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Taxable</span>
                <select className={inputClassName} value={draft.taxable ? "Yes" : "No"} onChange={(event) => setDraft({ ...draft, taxable: event.target.value === "Yes" })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Apply Before Tax</span>
                <select className={inputClassName} value={draft.applyBeforeTax ? "Yes" : "No"} onChange={(event) => setDraft({ ...draft, applyBeforeTax: event.target.value === "Yes" })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Frequency</span>
                <select className={inputClassName} value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as StandingAllowanceFrequency })}>
                  {frequencyOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {draft.frequency === "Monthly" ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Monthly Cutoff</span>
                  <select className={inputClassName} value={draft.monthlyCutoff || "15th"} onChange={(event) => setDraft({ ...draft, monthlyCutoff: event.target.value as StandingAllowanceCutoffSlot })}>
                    {cutoffOptions.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Remarks</span>
                <textarea className={inputClassName} rows={3} value={draft.remarks || ""} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-950">Category Assignment</div>
                <div className="mt-3 grid gap-2">
                  {categoryTargetOptions.map((target) => (
                    <label key={target} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <input type="checkbox" checked={draft.categoryTargets.includes(target)} onChange={() => toggleCategoryTarget(target)} />
                      {target}
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black text-slate-950">Specific Employees</div>
                <input className={`${inputClassName} mt-3`} value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search employee" />
                <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto">
                  {employeeSearchResults.map((employee) => (
                    <button key={employee.employeeNo} type="button" onClick={() => addEmployeeTarget(employee.employeeNo)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-sky-50">
                      {formatEmployeeName(employee)} · {employee.employeeNo}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.employeeTargets.map((employeeNo) => (
                    <button key={employeeNo} type="button" onClick={() => setDraft({ ...draft, employeeTargets: draft.employeeTargets.filter((target) => target !== employeeNo) })} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-[#0a4f8f]">
                      {employeeNo} ×
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModal} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700`}>Cancel</button>
              <button type="button" disabled={saving} onClick={saveAllowance} className={`${buttonClassName} bg-[#0a4f8f] text-white hover:bg-[#073c6d]`}>
                {saving ? "Saving..." : "Save Allowance"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_70px_-30px_rgba(15,23,42,0.45)]">
            <h2 className="text-lg font-black text-slate-950">Delete allowance?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600">This removes {deleteTarget.name} from future payroll runs.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700`}>Cancel</button>
              <button type="button" disabled={saving} onClick={deleteAllowance} className={`${buttonClassName} border border-rose-200 bg-rose-600 text-white hover:bg-rose-700`}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
