"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Search } from "lucide-react";
import { getClientPortalSessionAsync } from "../lib/auth";
import { getConfigItem, getCollectionItems } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";
import { exportPayrollRunsToExcel, type DetailedRecord } from "@/lib/payrollExcel";

type PayrollRecord = DetailedRecord & {
  bulkRunId?: string;
  payrollReference?: string;
  payrollPeriod?: string;
  payrollDate?: string;
  payDate?: string;
  month?: string;
  year?: string;
  createdAt?: string;
  archiveStatus?: "Active" | "Archived";
};

type PayrollRunApproval = { status?: string; approvedByName?: string; approvedAt?: string; };

// ── Identical hash logic used by the admin ──────────────────────────────────
function hashPayrollRunKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function buildPayrollRunIdentity(groupKey: string, records: PayrollRecord[]) {
  const src = records.map((r) => `${r.id || ""}:${r.createdAt || ""}`).sort().join("|");
  return `${groupKey}-${hashPayrollRunKey(src || groupKey)}`;
}
// ───────────────────────────────────────────────────────────────────────────

function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v.replace(/[₱,\s]/g, "")); return Number.isFinite(n) ? n : 0; }
  return 0;
}
function peso(v: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(v || 0);
}
function fmtDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

type RunGroup = {
  id: string;
  key: string;
  title: string;
  records: PayrollRecord[];
  date: string;
  gross: number;
  net: number;
  deductions: number;
  period: string;
};

function groupRecords(records: PayrollRecord[]): RunGroup[] {
  const map = new Map<string, PayrollRecord[]>();
  for (const r of records) {
    // Archived runs are excluded from the client view and from all totals.
    if (r.archiveStatus === "Archived") continue;
    const period = (r.payrollPeriod || "Monthly Payroll").trim();
    const key = `${r.year || ""}-${r.month || ""}-${period}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([key, recs]) => {
    const first = recs[0];
    const period = first?.payrollPeriod || "Monthly Payroll";
    const title = `${first?.month || ""} ${first?.year || ""} ${period}`.trim();
    const id = buildPayrollRunIdentity(key, recs);
    return {
      id, key, title, records: recs, period,
      date: first?.payrollDate || first?.payDate || "",
      gross: recs.reduce((s, r) => s + money(r.grossPay), 0),
      net: recs.reduce((s, r) => s + money(r.netPay), 0),
      deductions: recs.reduce((s, r) => s + money(r.totalDeductions), 0),
    };
  });
}

function statusBadge(status: string) {
  const normalizedStatus = normalizeStatus(status);
  const cls =
    normalizedStatus === "Approved" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalizedStatus === "Submitted" || normalizedStatus === "Checked" ? "border-blue-200 bg-blue-50 text-blue-700"
    : normalizedStatus === "Adjusted" ? "border-amber-200 bg-amber-50 text-amber-700"
    : normalizedStatus === "Archived" ? "border-slate-300 bg-slate-100 text-slate-600"
    : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>{normalizedStatus}</span>;
}

function normalizeStatus(status?: string) {
  return status === "For Review" ? "Submitted" : status === "Locked" ? "Approved" : status === "Returned for Revision" ? "Draft" : status || "Draft";
}

export default function ClientPortalPayrollRecordsPage() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [approvals, setApprovals] = useState<Record<string, PayrollRunApproval>>({});
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All Years");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [companyName, setCompanyName] = useState("");
  const [exportingRunId, setExportingRunId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, records, approvals, companyInfo] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getConfigItem<Record<string, PayrollRunApproval>>(storageKeys.payrollRunApprovals, {}),
        getConfigItem<{ companyName?: string }>(storageKeys.companyInformation, {}),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setRecords(records);
      setApprovals(approvals);
      setCompanyName(companyInfo.companyName ?? "");
    }
    load();
  }, [router]);

  const groups = useMemo(() => groupRecords(records), [records]);

  const years = useMemo(() => {
    const ys = new Set(records.map((r) => r.year).filter(Boolean));
    return ["All Years", ...Array.from(ys).sort((a, b) => Number(b) - Number(a))];
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter((g) => {
      const status = normalizeStatus(approvals[g.id]?.status);
      if (yearFilter !== "All Years" && !g.records.some((r) => r.year === yearFilter)) return false;
      if (statusFilter !== "All Status" && status !== statusFilter) return false;
      if (!q) return true;
      return g.title.toLowerCase().includes(q) || g.key.toLowerCase().includes(q);
    });
  }, [groups, approvals, search, yearFilter, statusFilter]);

  const handleExport = async (g: RunGroup) => {
    setExportingRunId(g.id);
    try {
      await exportPayrollRunsToExcel(
        [{
          id: g.id,
          title: g.title,
          period: g.period,
          payDate: g.date,
          approvalStatus: normalizeStatus(approvals[g.id]?.status),
          records: g.records,
        }],
        { companyName }
      );
    } catch (error) {
      console.error("Failed to export payroll run", error);
      window.alert("Failed to export payroll records. Please try again.");
    } finally {
      setExportingRunId(null);
    }
  };

  const bannerStyle: React.CSSProperties = { backgroundColor: theme.bannerColor };

  return (
    <div className="min-h-screen pg-bg text-[#0b2742]">
      {/* Banner */}
      <section className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{ ...bannerStyle, borderColor: `${theme.accentColor}33` }}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold" style={{ color: theme.bannerTextColor }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />Payroll Runs
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Payroll Records</h1>
          <p className="mt-1 text-sm opacity-85" style={{ color: theme.bannerTextColor }}>{groups.length} payroll run{groups.length !== 1 ? "s" : ""}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: 200 }}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payroll runs…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0a4f8f]">
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0a4f8f]">
            {["All Status", "Draft", "Submitted", "Checked", "Approved", "Adjusted", "Archived"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pay Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Employees</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Gross Pay</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Details</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Export</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const status = approvals[g.id]?.status || "Draft";
                  return (
                    <tr key={g.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{g.title}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{g.period}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(g.date)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{g.records.length}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{peso(g.gross)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{peso(g.net)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(status)}</td>
                      <td className="px-4 py-3 text-center">
                        <a
                          href={`/client-portal/payroll-records/${encodeURIComponent(g.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0a4f8f] underline-offset-4 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleExport(g)}
                          disabled={exportingRunId === g.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0a4f8f] underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Download className="h-3 w-3" /> {exportingRunId === g.id ? "Exporting…" : "Excel"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">No payroll runs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            Showing {filtered.length} of {groups.length} runs
          </div>
        </div>
      </div>
    </div>
  );
}
