"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { canAccessAdminPageAsync, getCurrentAdminUser } from "@/lib/adminAuth";
import {
  BOLDR_DEFAULT_DE_MINIMIS_ID,
  DE_MINIMIS_BIR_VERIFICATION_NOTE,
  DE_MINIMIS_SUGGESTED_TYPE_PRESETS,
  createBoldrDefaultDeMinimisBenefit,
  deMinimisBenefitTargetsEmployee,
  getDeMinimisForCutoff,
  type DeMinimisBenefit,
  type DeMinimisCategoryTarget,
  type DeMinimisCutoffSlot,
  type DeMinimisFrequency,
  type DeMinimisSuggestedType,
} from "@/lib/deMinimis";

type EmployeeRecord = {
  employeeNo: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  employeeType?: string;
  employmentStatus?: string;
  department?: string;
  customAllowances?: Array<{ name?: string; amount?: number | string; frequency?: string }>;
  deMinimis?: number | string;
  archived?: boolean;
};

type BenefitDraft = Omit<DeMinimisBenefit, "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "archived">;

const categoryTargetOptions: DeMinimisCategoryTarget[] = [
  "All employees",
  "All Rank and File",
  "All Supervisory",
];

const cutoffOptions: DeMinimisCutoffSlot[] = ["15th", "30th/31st"];
const frequencyOptions: DeMinimisFrequency[] = ["Monthly", "Semi-monthly", "Annual"];

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

function makeBenefitId() {
  return `de-minimis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Semi-monthly amounts are entered as the full monthly figure but stored per cutoff (÷2,
// since the benefit applies on both cutoffs). Halve on save, double back when editing.
function halveForSemiMonthly(value: number | undefined, frequency: DeMinimisFrequency) {
  if (value === undefined || value === null) return value;
  return frequency === "Semi-monthly" ? (Number(value) || 0) / 2 : value;
}

function doubleForSemiMonthly(value: number | undefined, frequency: DeMinimisFrequency) {
  if (value === undefined || value === null) return value;
  return frequency === "Semi-monthly" ? (Number(value) || 0) * 2 : value;
}

function emptyDraft(): BenefitDraft {
  return {
    name: "",
    suggestedType: "Custom",
    amount: 0,
    minAmount: undefined,
    maxAmount: undefined,
    hasOwnCeiling: false,
    ceiling: undefined,
    frequency: "Monthly",
    monthlyCutoff: "15th",
    annualMonth: "",
    annualCutoff: "15th",
    remarks: "",
    birVerificationNote: "",
    categoryTargets: [],
    employeeTargets: [],
  };
}

function normalizeBenefit(raw: DeMinimisBenefit): DeMinimisBenefit {
  return {
    ...raw,
    amount: Number(raw.amount) || 0,
    minAmount: raw.minAmount === undefined || raw.minAmount === null ? undefined : Number(raw.minAmount) || 0,
    maxAmount: raw.maxAmount === undefined || raw.maxAmount === null ? undefined : Number(raw.maxAmount) || 0,
    ceiling: raw.ceiling === undefined || raw.ceiling === null ? undefined : Number(raw.ceiling) || 0,
    categoryTargets: Array.isArray(raw.categoryTargets) ? raw.categoryTargets : [],
    employeeTargets: Array.isArray(raw.employeeTargets) ? raw.employeeTargets : [],
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

function stripUndefinedAndEmptyStrings<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedAndEmptyStrings(item))
      .filter((item) => item !== undefined) as T;
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

function isValidYearMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getCurrentUserName() {
  const user = getCurrentAdminUser();
  return user?.name || user?.email || "Admin";
}

function stripLegacyEmployeeDeMinimis(employee: EmployeeRecord): EmployeeRecord {
  const { deMinimis: _legacyDeMinimis, ...rest } = employee;
  return {
    ...rest,
    customAllowances: (employee.customAllowances || []).filter(
      (allowance) => String(allowance.name || "").trim().toLowerCase() !== "de minimis"
    ),
  };
}

export default function DeMinimisPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [benefits, setBenefits] = useState<DeMinimisBenefit[]>([]);
  const [searchText, setSearchText] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<BenefitDraft>(emptyDraft());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeMinimisBenefit | null>(null);
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
      const [rawEmployees, rawBenefits] = await Promise.all([
        getCollectionItems<EmployeeRecord>(storageKeys.employees),
        getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits),
      ]);
      const now = new Date().toISOString();
      const userName = getCurrentUserName();
      const hasBoldrDefault = rawBenefits.some((benefit) => benefit.id === BOLDR_DEFAULT_DE_MINIMIS_ID);
      const seededBenefits = hasBoldrDefault
        ? rawBenefits
        : [createBoldrDefaultDeMinimisBenefit({ createdAt: now, createdBy: "System migration" }), ...rawBenefits];
      const migratedEmployees = rawEmployees.map(stripLegacyEmployeeDeMinimis);
      const employeesChanged = JSON.stringify(rawEmployees) !== JSON.stringify(migratedEmployees);

      if (!hasBoldrDefault) {
        await setCollectionItems(
          storageKeys.deMinimisBenefits,
          seededBenefits.map((benefit) => stripUndefinedAndEmptyStrings(benefit))
        );
        window.dispatchEvent(new Event("de-minimis-benefits-updated"));
        await logAudit({
          action: "CREATED",
          entityType: "DeMinimisBenefit",
          entityId: BOLDR_DEFAULT_DE_MINIMIS_ID,
          entityName: "De Minimis Allowance",
          details: JSON.stringify({
            event: "BOLDR_DEFAULT_DE_MINIMIS_SEEDED",
            after: seededBenefits[0],
            changedBy: userName,
            changedAt: now,
          }),
        });
      }

      if (employeesChanged) {
        await setCollectionItems(storageKeys.employees, migratedEmployees.map((employee) => ({ ...employee, id: employee.employeeNo })));
        window.dispatchEvent(new Event("employees-updated"));
        await logAudit({
          action: "EDITED",
          entityType: "Employee",
          entityId: "legacy-de-minimis-migration",
          entityName: "Legacy De Minimis Migration",
          details: JSON.stringify({
            event: "LEGACY_EMPLOYEE_DE_MINIMIS_REMOVED",
            changedBy: userName,
            changedAt: now,
          }),
        });
      }

      setEmployees(migratedEmployees.filter((employee) => !employee.archived));

      // One-time migration: legacy Semi-monthly benefits were stored at the full month amount.
      // Halve them once and tag them so this never runs twice on the same record.
      const normalizedBenefits = seededBenefits.map(normalizeBenefit);
      const migratedBenefits = normalizedBenefits.map((benefit) =>
        benefit.frequency === "Semi-monthly" && !benefit.semiMonthlyHalved
          ? {
              ...benefit,
              amount: (Number(benefit.amount) || 0) / 2,
              minAmount: benefit.minAmount === undefined ? undefined : (Number(benefit.minAmount) || 0) / 2,
              maxAmount: benefit.maxAmount === undefined ? undefined : (Number(benefit.maxAmount) || 0) / 2,
              semiMonthlyHalved: true,
            }
          : benefit
      );
      if (JSON.stringify(normalizedBenefits) !== JSON.stringify(migratedBenefits)) {
        await setCollectionItems(
          storageKeys.deMinimisBenefits,
          migratedBenefits.map((benefit) => stripUndefinedAndEmptyStrings(benefit))
        );
        window.dispatchEvent(new Event("de-minimis-benefits-updated"));
      }
      setBenefits(migratedBenefits);
      setLoading(false);
    }
    loadData();
  }, [authChecking]);

  const activeBenefits = useMemo(() => benefits.filter((benefit) => !benefit.archived), [benefits]);
  const filteredBenefits = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return activeBenefits;
    return activeBenefits.filter((benefit) =>
      `${benefit.name} ${benefit.suggestedType} ${benefit.remarks || ""}`.toLowerCase().includes(query)
    );
  }, [activeBenefits, searchText]);

  const benefitRecipients = useMemo(() => {
    const map = new Map<string, EmployeeRecord[]>();
    activeBenefits.forEach((benefit) => {
      map.set(
        benefit.id,
        employees.filter((employee) => deMinimisBenefitTargetsEmployee(benefit, employee))
      );
    });
    return map;
  }, [activeBenefits, employees]);

  const employeeSearchResults = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees.slice(0, 8);
    return employees
      .filter((employee) => {
        const haystack = `${employee.employeeNo} ${formatEmployeeName(employee)} ${employee.department || ""}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [employeeSearch, employees]);

  const totals = useMemo(() => {
    const assignedEmployees = new Set<string>();
    let monthlyExposure = 0;
    let sharedBucketExposure = 0;

    activeBenefits.forEach((benefit) => {
      const recipients = benefitRecipients.get(benefit.id) || [];
      recipients.forEach((employee) => assignedEmployees.add(employee.employeeNo));

      const sampleCutoff = {
        monthYear: benefit.annualMonth || "2026-01",
        cutoff: benefit.monthlyCutoff || benefit.annualCutoff || "15th",
        cutoffLabel: benefit.monthlyCutoff || benefit.annualCutoff || "15th",
        payDate: benefit.annualMonth ? `${benefit.annualMonth}-15` : "2026-01-15",
      };
      const perRecipient = recipients.length > 0 ? recipients : [{ employeeNo: "__sample__" }];
      perRecipient.forEach((employee) => {
        const lines = getDeMinimisForCutoff(employee, sampleCutoff, [benefit]);
        monthlyExposure += lines.reduce((sum, line) => sum + line.amount, 0);
        sharedBucketExposure += lines.reduce((sum, line) => sum + line.sharedNinetyKBucketPortion, 0);
      });
    });

    return {
      activeBenefits: activeBenefits.length,
      assignedEmployees: assignedEmployees.size,
      monthlyExposure,
      sharedBucketExposure,
    };
  }, [activeBenefits, benefitRecipients]);

  function openCreateModal() {
    setFormError("");
    setEditingId("");
    setDraft(emptyDraft());
    setEmployeeSearch("");
    setModalMode("create");
  }

  function openEditModal(benefit: DeMinimisBenefit) {
    setFormError("");
    setEditingId(benefit.id);
    setDraft({
      name: benefit.name,
      suggestedType: benefit.suggestedType,
      amount: doubleForSemiMonthly(benefit.amount, benefit.frequency) ?? 0,
      minAmount: doubleForSemiMonthly(benefit.minAmount, benefit.frequency),
      maxAmount: doubleForSemiMonthly(benefit.maxAmount, benefit.frequency),
      hasOwnCeiling: benefit.hasOwnCeiling,
      ceiling: benefit.ceiling,
      frequency: benefit.frequency,
      monthlyCutoff: benefit.monthlyCutoff || "15th",
      annualMonth: benefit.annualMonth || "",
      annualCutoff: benefit.annualCutoff || "15th",
      remarks: benefit.remarks || "",
      birVerificationNote: benefit.birVerificationNote || "",
      categoryTargets: benefit.categoryTargets || [],
      employeeTargets: benefit.employeeTargets || [],
    });
    setEmployeeSearch("");
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId("");
    setDraft(emptyDraft());
    setFormError("");
    setEmployeeSearch("");
  }

  function applySuggestedType(value: DeMinimisSuggestedType) {
    const preset = DE_MINIMIS_SUGGESTED_TYPE_PRESETS.find((item) => item.suggestedType === value);
    setDraft((current) => ({
      ...current,
      suggestedType: value,
      name: preset?.name || current.name,
      hasOwnCeiling: preset?.hasOwnCeiling ?? false,
      ceiling: preset?.ceiling,
      frequency: preset?.frequency || current.frequency,
      birVerificationNote: value === "Custom" ? "" : DE_MINIMIS_BIR_VERIFICATION_NOTE,
      remarks: preset?.remarks || current.remarks,
    }));
  }

  function toggleCategoryTarget(target: DeMinimisCategoryTarget) {
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

  function removeEmployeeTarget(employeeNo: string) {
    setDraft((current) => ({
      ...current,
      employeeTargets: current.employeeTargets.filter((target) => target !== employeeNo),
    }));
  }

  function validateDraft() {
    if (!draft.name.trim()) return "Name is required.";
    if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) return "Amount must be greater than 0.";
    if (draft.minAmount !== undefined && Number(draft.minAmount) < 0) return "Minimum amount cannot be negative.";
    if (draft.maxAmount !== undefined && Number(draft.maxAmount) < 0) return "Maximum amount cannot be negative.";
    if (draft.minAmount !== undefined && draft.maxAmount !== undefined && Number(draft.minAmount) > Number(draft.maxAmount)) {
      return "Minimum amount cannot be greater than maximum amount.";
    }
    if (draft.hasOwnCeiling && (!Number.isFinite(Number(draft.ceiling)) || Number(draft.ceiling) < 0)) {
      return "Ceiling is required when Own Ceiling is Yes.";
    }
    if (draft.frequency === "Monthly" && !draft.monthlyCutoff) return "Choose the monthly cutoff placement.";
    if (draft.frequency === "Annual") {
      if (!draft.annualMonth || !isValidYearMonth(draft.annualMonth)) return "Annual month must use YYYY-MM.";
      if (!draft.annualCutoff) return "Choose the annual cutoff placement.";
    }
    if (draft.categoryTargets.length === 0 && draft.employeeTargets.length === 0) {
      return "Assign this benefit to at least one category or employee.";
    }
    return "";
  }

  async function saveBenefit() {
    const error = validateDraft();
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();
    const userName = getCurrentUserName();
    const cleanDraft = stripUndefinedAndEmptyStrings({
      ...draft,
      name: draft.name.trim(),
      amount: halveForSemiMonthly(Number(draft.amount) || 0, draft.frequency) ?? 0,
      minAmount:
        draft.minAmount === undefined || draft.minAmount === null
          ? undefined
          : halveForSemiMonthly(Number(draft.minAmount), draft.frequency),
      maxAmount:
        draft.maxAmount === undefined || draft.maxAmount === null
          ? undefined
          : halveForSemiMonthly(Number(draft.maxAmount), draft.frequency),
      semiMonthlyHalved: draft.frequency === "Semi-monthly" ? true : undefined,
      hasOwnCeiling: Boolean(draft.hasOwnCeiling),
      ceiling: draft.hasOwnCeiling ? Number(draft.ceiling) || 0 : undefined,
      monthlyCutoff: draft.frequency === "Monthly" ? draft.monthlyCutoff : undefined,
      annualMonth: draft.frequency === "Annual" ? draft.annualMonth : undefined,
      annualCutoff: draft.frequency === "Annual" ? draft.annualCutoff : undefined,
      remarks: draft.remarks?.trim() || undefined,
      birVerificationNote: draft.suggestedType === "Custom" ? undefined : DE_MINIMIS_BIR_VERIFICATION_NOTE,
      categoryTargets: draft.categoryTargets,
      employeeTargets: draft.employeeTargets,
    }) as BenefitDraft;

    try {
      if (modalMode === "create") {
        const benefit: DeMinimisBenefit = {
          id: makeBenefitId(),
          ...cleanDraft,
          createdAt: now,
          createdBy: userName,
        };
        const nextBenefits = [...benefits, benefit];
        await setCollectionItems(
          storageKeys.deMinimisBenefits,
          nextBenefits.map((benefit) => stripUndefinedAndEmptyStrings(benefit))
        );
        setBenefits(nextBenefits);
        window.dispatchEvent(new Event("de-minimis-benefits-updated"));
        await logAudit({
          action: "CREATED",
          entityType: "DeMinimisBenefit",
          entityId: benefit.id,
          entityName: benefit.name,
          details: JSON.stringify({
            event: "DE_MINIMIS_CREATED",
            before: null,
            after: benefit,
            changedBy: userName,
            changedAt: now,
          }),
        });
      } else {
        const before = benefits.find((benefit) => benefit.id === editingId);
        if (!before) throw new Error("Benefit not found.");
        const after: DeMinimisBenefit = {
          ...before,
          ...cleanDraft,
          updatedAt: now,
          updatedBy: userName,
        };
        const nextBenefits = benefits.map((benefit) => (benefit.id === editingId ? after : benefit));
        await setCollectionItems(
          storageKeys.deMinimisBenefits,
          nextBenefits.map((benefit) => stripUndefinedAndEmptyStrings(benefit))
        );
        setBenefits(nextBenefits);
        window.dispatchEvent(new Event("de-minimis-benefits-updated"));
        await logAudit({
          action: "EDITED",
          entityType: "DeMinimisBenefit",
          entityId: after.id,
          entityName: after.name,
          details: JSON.stringify({
            event: "DE_MINIMIS_CHANGED",
            before,
            after,
            diff: serializeDiff(before, after),
            changedBy: userName,
            changedAt: now,
          }),
        });
      }
      closeModal();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save de minimis benefit.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBenefit() {
    if (!deleteTarget) return;
    setSaving(true);
    const now = new Date().toISOString();
    const userName = getCurrentUserName();
    const before = deleteTarget;
    const nextBenefits = benefits.filter((benefit) => benefit.id !== before.id);
    await setCollectionItems(
      storageKeys.deMinimisBenefits,
      nextBenefits.map((benefit) => stripUndefinedAndEmptyStrings(benefit))
    );
    setBenefits(nextBenefits);
    window.dispatchEvent(new Event("de-minimis-benefits-updated"));
    await logAudit({
      action: "DELETED",
      entityType: "DeMinimisBenefit",
      entityId: before.id,
      entityName: before.name,
      details: JSON.stringify({
        event: "DE_MINIMIS_DELETED",
        before,
        after: null,
        diff: serializeDiff(before, null),
        changedBy: userName,
        changedAt: now,
      }),
    });
    setDeleteTarget(null);
    setSaving(false);
  }

  if (authChecking || loading) {
    return (
      <main className="min-h-screen pg-bg p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-500">
          Loading de minimis setup...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pg-bg p-6">
      {saving ? (
        <div className="fixed inset-x-0 top-0 z-[80] h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 shadow-[0_0_18px_rgba(14,165,233,0.45)]" />
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded-2xl border border-white bg-white/95 p-6 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#0a4f8f]">
                <CheckCircle2 className="h-4 w-4" />
                Payroll Runs
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">De Minimis</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                Define de minimis benefits once, assign them by category or employee, and let payroll runs pull the applicable lines by cutoff.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className={`${buttonClassName} bg-[#0a4f8f] text-white shadow-[0_18px_35px_-22px_rgba(14,116,144,0.9)] hover:bg-[#073c6d]`}
            >
              <Plus className="h-4 w-4" />
              Add De Minimis
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ["Active Benefits", totals.activeBenefits],
              ["Assigned Employees", totals.assignedEmployees],
              ["Cutoff Exposure", formatCurrency(totals.monthlyExposure)],
              ["Shared 90k Bucket", formatCurrency(totals.sharedBucketExposure)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">{label}</div>
                <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white bg-white/95 p-5 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={`${inputClassName} pl-9`}
                placeholder="Search benefit name, type, or remarks"
              />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              Seed ceilings are examples only. Verify against current BIR rules before go-live.
            </div>
          </div>

          {filteredBenefits.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">
              No de minimis benefits found.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredBenefits.map((benefit) => {
                const recipients = benefitRecipients.get(benefit.id) || [];
                const sharedBucketAmount = benefit.hasOwnCeiling
                  ? Math.max(0, benefit.amount - Number(benefit.ceiling || 0))
                  : benefit.amount;

                return (
                  <article key={benefit.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-slate-950">{benefit.name}</h2>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-black text-[#0a4f8f]">
                            {benefit.suggestedType}
                          </span>
                          {benefit.hasOwnCeiling ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                              Own ceiling
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                              Shared 90k from first peso
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-600">
                          {formatCurrency(benefit.amount)} • {benefit.frequency}
                          {benefit.frequency === "Monthly" ? ` • ${benefit.monthlyCutoff}` : ""}
                          {benefit.frequency === "Annual" ? ` • ${benefit.annualMonth || "No month"} ${benefit.annualCutoff || ""}` : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(benefit)}
                          className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-sky-50 hover:text-[#0a4f8f]`}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(benefit)}
                          className={`${buttonClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Ceiling</div>
                        <div className="mt-1 text-sm font-black text-slate-950">
                          {benefit.hasOwnCeiling ? formatCurrency(Number(benefit.ceiling) || 0) : "None"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Excess to 90k Bucket</div>
                        <div className="mt-1 text-sm font-black text-slate-950">{formatCurrency(sharedBucketAmount)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Assignment Rules</div>
                        <div className="mt-1 text-sm font-black text-slate-950">
                          {[...(benefit.categoryTargets || []), `${benefit.employeeTargets.length} employee(s)`].join(", ")}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Current Recipients</div>
                        <div className="mt-1 text-sm font-black text-slate-950">{recipients.length}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Resolved Recipients</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recipients.length === 0 ? (
                          <span className="text-sm font-semibold text-slate-500">No current employees match this assignment.</span>
                        ) : (
                          recipients.slice(0, 24).map((employee) => (
                            <span key={employee.employeeNo} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                              {formatEmployeeName(employee)} ({employee.employeeNo})
                            </span>
                          ))
                        )}
                        {recipients.length > 24 ? (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-500">
                            +{recipients.length - 24} more
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {benefit.remarks ? <p className="mt-3 text-sm font-semibold text-slate-600">{benefit.remarks}</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4">
          <div className="my-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  {modalMode === "create" ? "Add De Minimis" : "Edit De Minimis"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Define the catalog item and assignment rules in one place.
                </p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
                {formError}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Suggested Type</div>
                <select
                  value={draft.suggestedType}
                  onChange={(event) => applySuggestedType(event.target.value as DeMinimisSuggestedType)}
                  className={inputClassName}
                >
                  {DE_MINIMIS_SUGGESTED_TYPE_PRESETS.map((preset) => (
                    <option key={preset.suggestedType} value={preset.suggestedType}>{preset.suggestedType}</option>
                  ))}
                </select>
              </label>
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Name *</div>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className={inputClassName}
                  placeholder="Rice Subsidy"
                />
              </label>
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Amount *</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) }))}
                  className={inputClassName}
                />
                {draft.frequency === "Semi-monthly" ? (
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    Enter the full monthly amount. It will be split as {formatCurrency((Number(draft.amount) || 0) / 2)} per cutoff.
                  </div>
                ) : null}
              </label>
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Minimum Amount</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.minAmount ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, minAmount: event.target.value ? Number(event.target.value) : undefined }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Maximum Amount</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.maxAmount ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, maxAmount: event.target.value ? Number(event.target.value) : undefined }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Has Own Ceiling *</div>
                <select
                  value={draft.hasOwnCeiling ? "Yes" : "No"}
                  onChange={(event) => setDraft((current) => ({ ...current, hasOwnCeiling: event.target.value === "Yes" }))}
                  className={inputClassName}
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              {draft.hasOwnCeiling ? (
                <label>
                  <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Ceiling *</div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.ceiling ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, ceiling: Number(event.target.value) }))}
                    className={inputClassName}
                  />
                </label>
              ) : null}
              <label>
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Frequency *</div>
                <select
                  value={draft.frequency}
                  onChange={(event) => setDraft((current) => ({ ...current, frequency: event.target.value as DeMinimisFrequency }))}
                  className={inputClassName}
                >
                  {frequencyOptions.map((frequency) => <option key={frequency}>{frequency}</option>)}
                </select>
              </label>
              {draft.frequency === "Monthly" ? (
                <label>
                  <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Monthly Cutoff *</div>
                  <select
                    value={draft.monthlyCutoff || "15th"}
                    onChange={(event) => setDraft((current) => ({ ...current, monthlyCutoff: event.target.value as DeMinimisCutoffSlot }))}
                    className={inputClassName}
                  >
                    {cutoffOptions.map((cutoff) => <option key={cutoff}>{cutoff}</option>)}
                  </select>
                </label>
              ) : null}
              {draft.frequency === "Annual" ? (
                <>
                  <label>
                    <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Annual Month *</div>
                    <input
                      type="month"
                      value={draft.annualMonth || ""}
                      onChange={(event) => setDraft((current) => ({ ...current, annualMonth: event.target.value }))}
                      className={inputClassName}
                    />
                  </label>
                  <label>
                    <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Annual Cutoff *</div>
                    <select
                      value={draft.annualCutoff || "15th"}
                      onChange={(event) => setDraft((current) => ({ ...current, annualCutoff: event.target.value as DeMinimisCutoffSlot }))}
                      className={inputClassName}
                    >
                      {cutoffOptions.map((cutoff) => <option key={cutoff}>{cutoff}</option>)}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="md:col-span-3">
                <div className="mb-1.5 text-xs font-black uppercase tracking-[0.08em] text-slate-500">Remarks</div>
                <textarea
                  value={draft.remarks || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))}
                  className={`${inputClassName} min-h-20`}
                  placeholder="Optional notes"
                />
              </label>
            </div>

            {draft.suggestedType !== "Custom" ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                {DE_MINIMIS_BIR_VERIFICATION_NOTE}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">Category Assignment</h3>
                <div className="mt-3 grid gap-2">
                  {categoryTargetOptions.map((target) => (
                    <label key={target} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={draft.categoryTargets.includes(target)}
                        onChange={() => toggleCategoryTarget(target)}
                        className="h-4 w-4 accent-[#0a4f8f]"
                      />
                      {target}
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.08em] text-slate-500">Specific Employees</h3>
                <input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  className={`${inputClassName} mt-3`}
                  placeholder="Search by employee name or number"
                />
                <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto">
                  {employeeSearchResults.map((employee) => {
                    const selected = draft.employeeTargets.includes(employee.employeeNo);
                    return (
                      <button
                        type="button"
                        key={employee.employeeNo}
                        onClick={() => selected ? removeEmployeeTarget(employee.employeeNo) : addEmployeeTarget(employee.employeeNo)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${
                          selected
                            ? "border-sky-300 bg-sky-50 text-[#0a4f8f]"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                        }`}
                      >
                        {formatEmployeeName(employee)} ({employee.employeeNo})
                      </button>
                    );
                  })}
                </div>
                {draft.employeeTargets.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft.employeeTargets.map((employeeNo) => (
                      <button
                        type="button"
                        key={employeeNo}
                        onClick={() => removeEmployeeTarget(employeeNo)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                      >
                        {employeeNo} x
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                Cancel
              </button>
              <button type="button" onClick={saveBenefit} disabled={saving} className={`${buttonClassName} bg-[#0a4f8f] text-white hover:bg-[#073c6d]`}>
                {saving ? "Saving..." : "Save De Minimis"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <h2 className="text-xl font-black text-slate-950">Delete De Minimis Benefit</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Delete {deleteTarget.name}? This removes the catalog item and its assignment rules.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className={`${buttonClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                Cancel
              </button>
              <button type="button" onClick={deleteBenefit} disabled={saving} className={`${buttonClassName} bg-rose-600 text-white hover:bg-rose-700`}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
