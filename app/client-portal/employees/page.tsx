"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { getClientPortalSessionAsync } from "../lib/auth";
import { getConfigItem, getCollectionItems } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { deMinimisBenefitTargetsEmployee, type DeMinimisBenefit } from "@/lib/deMinimis";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";

type Employee = {
  employeeNo?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  employeeName?: string;
  department?: string;
  designation?: string;
  position?: string;
  jobTitle?: string;
  employeeType?: string;
  employmentClassification?: string;
  employmentStatus?: string;
  hireDate?: string;
  regularizationDate?: string;
  emailAddress?: string;
  contactNumber?: string;
  address?: string;
  gender?: string;
  birthdate?: string;
  sss?: string;
  sssNo?: string;
  sssNumber?: string;
  philhealth?: string;
  philhealthNo?: string;
  philhealthNumber?: string;
  pagibig?: string;
  pagibigNo?: string;
  pagibigNumber?: string;
  tin?: string;
  tinNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  basicPay?: number | string;
  monthlyRate?: number | string;
  hourlyRate?: number | string;
  basicPayFrequency?: string;
  standardHoursPerDay?: number | string;
  workingDaysPerMonth?: number | string;
  riceSubsidy?: number | string;
  uniformClothingAllowance?: number | string;
  laundryAllowance?: number | string;
  medicalCashAllowanceToDependents?: number | string;
  actualMedicalAssistance?: number | string;
  achievementAwards?: number | string;
  christmasAnniversaryGifts?: number | string;
  mealAllowance?: number | string;
  thirteenthMonthPay?: number | string;
  christmasBonus?: number | string;
  otherAllowanceName?: string;
  otherAllowanceAmount?: number | string;
  allowances?: { name: string; amount: number | string; frequency?: string }[];
  customAllowances?: { name: string; amount: number | string; frequency?: string }[];
  loans?: {
    id?: string;
    loanName?: string;
    dateStarted?: string;
    startDate?: string;
    endDate?: string;
    frequency?: string;
    originalAmount?: number | string;
    outstandingBalance?: number | string;
    monthlyDeduction?: number | string;
  }[];
  archived?: boolean;
  immediateSupervisor?: string;
  employeePhotoDataUrl?: string;
};

function displayName(e: Employee): string {
  if (e.employeeName) return e.employeeName;
  const last = (e.lastName || "").trim();
  const first = [e.firstName, e.middleName]
    .map((n) => (n || "").trim())
    .filter(Boolean)
    .join(" ");
  if (last && first) return `${last}, ${first}`;
  return last || first || e.employeeNo || "—";
}

function positionLabel(e: Employee): string {
  return e.jobTitle || e.designation || e.position || e.employmentClassification || "—";
}

function statusLabel(e: Employee): string {
  return e.employeeType || e.employmentStatus || "—";
}

function maskAccount(num?: string): string {
  if (!num) return "—";
  return num.length > 4 ? "•".repeat(num.length - 4) + num.slice(-4) : num;
}

function toNum(v: number | string | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function formatDisplayDate(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function formatDate(d?: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function peso(v: unknown): string {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v.replace(/[₱,\s]/g, ""))
        : 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

type Row = { label: string; value: string };
function Detail({ rows }: { rows: Row[] }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {r.label}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">
            {r.value || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function ClientPortalEmployeesPage() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All Departments");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [deMinimisBenefits, setDeMinimisBenefits] = useState<DeMinimisBenefit[]>([]);
  const [page, setPage] = useState(1);

  const selectedDeMinimis = useMemo(() => {
    if (!selected) return [];
    return deMinimisBenefits.filter((benefit) =>
      deMinimisBenefitTargetsEmployee(benefit, {
        employeeNo: selected.employeeNo || "",
        employeeType: selected.employeeType,
        employmentStatus: selected.employmentStatus,
        archived: selected.archived,
      })
    );
  }, [deMinimisBenefits, selected]);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) {
        router.replace("/client-portal/login");
        return;
      }

      const [raw, emps, benefits] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getCollectionItems<Employee>(storageKeys.employees),
        getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits),
      ]);
      const t = normalizeTheme(raw);
      setTheme(t);
      applyAppTheme(t);
      setEmployees(emps);
      setDeMinimisBenefits(benefits.filter((b) => !b.archived));
    }
    load();
  }, [router]);

  const active = useMemo(() => employees.filter((e) => !e.archived), [employees]);

  const departments = useMemo(
    () => ["All Departments", ...Array.from(new Set(active.map((e) => e.department || "").filter(Boolean))).sort()],
    [active]
  );

  const statuses = useMemo(
    () => ["All Status", ...Array.from(new Set(active.map((e) => statusLabel(e)).filter((s) => s !== "—"))).sort()],
    [active]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return active.filter((e) => {
      if (deptFilter !== "All Departments" && e.department !== deptFilter) return false;
      if (statusFilter !== "All Status" && statusLabel(e) !== statusFilter) return false;
      if (!q) return true;
      return (
        displayName(e).toLowerCase().includes(q) ||
        (e.employeeNo || "").toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q) ||
        positionLabel(e).toLowerCase().includes(q)
      );
    });
  }, [active, search, deptFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEmployees = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  const bannerStyle: React.CSSProperties = { backgroundColor: theme.bannerColor };

  return (
    <div className="min-h-screen pg-bg text-[#0b2742]">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{ ...bannerStyle, borderColor: `${theme.accentColor}33` }}
      >
        <div className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold" style={{ color: theme.bannerTextColor }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
              Employees
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>
            View Employees
          </h1>
          <p className="mt-1 text-sm opacity-85" style={{ color: theme.bannerTextColor }}>
            {active.length} active employee{active.length !== 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: 200 }}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Search by name, number, department…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); resetPage(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f]"
          >
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#0a4f8f]"
          >
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          {(search || deptFilter !== "All Departments" || statusFilter !== "All Status") && (
            <button
              type="button"
              onClick={() => { setSearch(""); setDeptFilter("All Departments"); setStatusFilter("All Status"); resetPage(); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageEmployees.map((e, i) => (
                  <tr key={e.employeeNo || i} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{displayName(e)}</div>
                      <div className="text-xs text-slate-500">{e.employeeNo}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{positionLabel(e)}</td>
                    <td className="px-4 py-3 text-slate-600">{e.department || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {statusLabel(e)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelected(e)}
                        className="rounded border border-[#0a4f8f] px-3 py-1.5 text-xs font-semibold text-[#0a4f8f] transition hover:bg-blue-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button type="button" disabled={page === 1} onClick={() => setPage(1)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">«</button>
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={p} type="button" onClick={() => setPage(p)}
                      className={`rounded border px-2.5 py-1 text-xs ${p === page ? "border-[#0a4f8f] bg-[#0a4f8f] text-white" : "border-slate-200 hover:bg-slate-50"}`}>
                      {p}
                    </button>
                  );
                })}
                <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">›</button>
                <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">»</button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            {filtered.length > 0
              ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} employee${filtered.length !== 1 ? "s" : ""}${filtered.length < active.length ? ` (filtered from ${active.length})` : ""}`
              : `No employees match your filters`}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-20px_rgba(8,47,73,0.25)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {selected.employeePhotoDataUrl ? (
                    <img src={selected.employeePhotoDataUrl} alt="Employee" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#0a4f8f] to-[#0c3460] text-xl font-semibold text-white">
                      {(selected.firstName?.charAt(0) || selected.lastName?.charAt(0) || "E").toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">{displayName(selected)}</div>
                  <div className="text-sm text-slate-500">{selected.employeeNo} · {positionLabel(selected)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5">
              {/* Basic Info */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Basic Information</p>
                <Detail rows={[
                  { label: "Full Name", value: displayName(selected) },
                  { label: "Employee No.", value: selected.employeeNo || "—" },
                  { label: "Department", value: selected.department || "—" },
                  { label: "Position / Title", value: positionLabel(selected) },
                  { label: "Employment Status", value: statusLabel(selected) },
                  { label: "Supervisor", value: selected.immediateSupervisor || "—" },
                  { label: "Hire Date", value: formatDate(selected.hireDate) },
                  { label: "Regularization Date", value: formatDate(selected.regularizationDate) },
                ]} />
              </section>

              {/* Contact */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Personal & Contact</p>
                <Detail rows={[
                  { label: "Birthdate", value: formatDate(selected.birthdate) },
                  { label: "Gender", value: selected.gender || "—" },
                  { label: "Email", value: selected.emailAddress || "—" },
                  { label: "Contact No.", value: selected.contactNumber || "—" },
                  { label: "Address", value: selected.address || "—" },
                ]} />
              </section>

              {/* Government IDs */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Government IDs</p>
                <Detail rows={[
                  { label: "SSS", value: selected.sss || selected.sssNo || selected.sssNumber || "—" },
                  { label: "PhilHealth", value: selected.philhealth || selected.philhealthNo || selected.philhealthNumber || "—" },
                  { label: "Pag-IBIG", value: selected.pagibig || selected.pagibigNo || selected.pagibigNumber || "—" },
                  { label: "TIN", value: selected.tin || selected.tinNumber || "—" },
                ]} />
              </section>

              {/* Basic Pay */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Basic Pay</p>
                <Detail rows={[
                  { label: "Basic Pay", value: peso(selected.basicPay || selected.monthlyRate || 0) },
                  { label: "Frequency", value: selected.basicPayFrequency || "Monthly" },
                  { label: "Hrs / Day", value: selected.standardHoursPerDay != null ? String(selected.standardHoursPerDay) : "—" },
                  { label: "Days / Month", value: selected.workingDaysPerMonth != null ? String(selected.workingDaysPerMonth) : "—" },
                  ...(toNum(selected.hourlyRate) > 0 ? [{ label: "Hourly Rate", value: peso(selected.hourlyRate) }] : []),
                  { label: "Bank", value: selected.bankName || "—" },
                  { label: "Account No.", value: maskAccount(selected.bankAccountNumber) },
                ]} />
              </section>

              {/* Fixed Allowances */}
              {(() => {
                const fixed = [
                  { label: "Rice Subsidy", v: selected.riceSubsidy },
                  { label: "Uniform / Clothing", v: selected.uniformClothingAllowance },
                  { label: "Laundry", v: selected.laundryAllowance },
                  { label: "Medical Dependents", v: selected.medicalCashAllowanceToDependents },
                  { label: "Actual Medical", v: selected.actualMedicalAssistance },
                  { label: "Achievement Awards", v: selected.achievementAwards },
                  { label: "Christmas / Anniversary Gifts", v: selected.christmasAnniversaryGifts },
                  { label: "Meal Allowance", v: selected.mealAllowance },
                  { label: "13th Month Pay", v: selected.thirteenthMonthPay },
                  { label: "Christmas Bonus", v: selected.christmasBonus },
                  { label: selected.otherAllowanceName || "Other Allowance", v: selected.otherAllowanceAmount },
                ].filter((r) => toNum(r.v) > 0);
                if (!fixed.length) return null;
                return (
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Fixed Allowances</p>
                    <Detail rows={fixed.map((r) => ({ label: r.label, value: peso(r.v) }))} />
                  </section>
                );
              })()}

              {/* Custom Allowances */}
              {(() => {
                const custom = (selected.allowances || selected.customAllowances || []).filter((a) => toNum(a.amount) > 0);
                if (!custom.length) return null;
                return (
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Extra Allowances</p>
                    <Detail rows={custom.map((a) => ({ label: `${a.name}${a.frequency ? ` (${a.frequency})` : ""}`, value: peso(a.amount) }))} />
                  </section>
                );
              })()}

              {/* De Minimis Benefits */}
              {selectedDeMinimis.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">De Minimis Benefits</p>
                  <Detail rows={selectedDeMinimis.map((b) => ({
                    label: `${b.name}${b.frequency ? ` (${b.frequency})` : ""}`,
                    value: peso(toNum(b.amount)),
                  }))} />
                </section>
              )}

              {/* Loans */}
              {(() => {
                const loans = selected.loans || [];
                if (!loans.length) return null;
                return (
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Loans</p>
                    <div className="flex flex-col gap-3">
                      {loans.map((loan, i) => {
                        const balance = toNum(loan.outstandingBalance);
                        const original = toNum(loan.originalAmount);
                        const paid = original - balance;
                        const monthly = toNum(loan.monthlyDeduction);
                        const perCutoff = monthly / 2;
                        const isPaid = balance <= 0;
                        const startDate = loan.dateStarted || loan.startDate;
                        return (
                          <div key={loan.id || i} className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-bold text-amber-900">{loan.loanName || `Loan #${i + 1}`}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{isPaid ? "Paid" : "Active"}</span>
                            </div>
                            <Detail rows={[
                              { label: "Start Date", value: formatDisplayDate(startDate) },
                              { label: "End Date", value: formatDisplayDate(loan.endDate) },
                              { label: "Frequency", value: loan.frequency || "—" },
                              { label: "Original Amount", value: peso(loan.originalAmount) },
                              { label: "Outstanding Balance", value: peso(loan.outstandingBalance) },
                              { label: "Amount Paid", value: peso(paid > 0 ? paid : 0) },
                              { label: "Monthly Deduction", value: monthly > 0 ? peso(monthly) : "—" },
                              ...(monthly > 0 ? [{ label: "Per Cutoff Deduction", value: `${peso(perCutoff)} (÷ 2)` }] : []),
                            ]} />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Read-only view · Contact administrator to request changes
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
