"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, List, Search, X } from "lucide-react";
import { getConfigItem, getDataArray } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { getClientPortalSessionAsync } from "../../lib/auth";
import { logAudit } from "@/lib/auditTrail";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";

type AlphalistSummary = {
  totalEmployees: number;
  schedule1Employees: number;
  schedule2Mwes: number;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  taxWithheld: number;
  overwithheldRefunded: number;
  finalTaxWithheld: number;
};

type Schedule1Row = {
  sequenceNo: number;
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  employmentStatus: string;
  fromDate: string;
  toDate: string;
  presentGrossCompensation: number;
  presentTotalNonTaxable: number;
  presentTotalTaxable: number;
  totalTaxableCompensation: number;
  taxDue: number;
  amountOfTaxWithheldAsAdjusted: number;
};

type Schedule2Row = {
  sequenceNo: number;
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  employmentStatus: string;
  fromDate: string;
  toDate: string;
  presentGrossCompensation: number;
  presentTotalNonTaxable: number;
  presentTotalTaxable: number;
  totalTaxableCompensation: number;
  taxDue: number;
};

type SavedAlphalistReport = {
  id: string;
  year: string;
  fileName: string;
  revisionNumber: string;
  summary: AlphalistSummary;
  schedule1Rows: Schedule1Row[];
  schedule2Rows: Schedule2Row[];
  savedAt: string;
};

function downloadAlphalistExcel(report: SavedAlphalistReport) {
  const money = (v: number | undefined) =>
    new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);

  const s1Rows = (report.schedule1Rows ?? []).map((r, i) => `
    <tr>
      <td>${r.sequenceNo ?? i + 1}</td>
      <td>${[r.lastName, r.firstName, r.middleName].filter(Boolean).join(", ")}</td>
      <td>${r.employeeNo ?? ""}</td>
      <td>${r.employmentStatus ?? ""}</td>
      <td>${r.fromDate ?? ""}</td>
      <td>${r.toDate ?? ""}</td>
      <td style="text-align:right">${money(r.presentGrossCompensation)}</td>
      <td style="text-align:right">${money(r.presentTotalNonTaxable)}</td>
      <td style="text-align:right">${money(r.presentTotalTaxable)}</td>
      <td style="text-align:right">${money(r.amountOfTaxWithheldAsAdjusted)}</td>
    </tr>`).join("");

  const s2Rows = (report.schedule2Rows ?? []).map((r, i) => `
    <tr>
      <td>${r.sequenceNo ?? i + 1}</td>
      <td>${[r.lastName, r.firstName, r.middleName].filter(Boolean).join(", ")}</td>
      <td>${r.employeeNo ?? ""}</td>
      <td>${r.employmentStatus ?? ""}</td>
      <td>${r.fromDate ?? ""}</td>
      <td>${r.toDate ?? ""}</td>
      <td style="text-align:right">${money(r.presentGrossCompensation)}</td>
      <td style="text-align:right">${money(r.presentTotalNonTaxable)}</td>
      <td style="text-align:right">${money(r.presentTotalTaxable)}</td>
      <td style="text-align:right">${money(r.taxDue)}</td>
    </tr>`).join("");

  const html = `<html><head><meta charset="UTF-8"/>
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
      th, td { border: 1px solid #cbd5e1; padding: 5px 8px; }
      th { background: #e2e8f0; font-weight: bold; }
      .title { font-size: 14px; font-weight: bold; }
      .section { background: #1e3a5f; color: white; font-weight: bold; }
    </style></head><body>
    <table>
      <tr><td colspan="10" class="title">Alphalist of Employees — Tax Year ${report.year}</td></tr>
      <tr><td colspan="10">File: ${report.fileName} | Revision: ${report.revisionNumber || "Original"} | Saved: ${report.savedAt ? new Date(report.savedAt).toLocaleDateString("en-PH") : ""}</td></tr>
      <tr><td colspan="10"></td></tr>
      <tr><td colspan="10" class="section">SCHEDULE 1 — Regular Employees</td></tr>
      <tr>
        <th>#</th><th>Name</th><th>Employee No.</th><th>Status</th>
        <th>From</th><th>To</th>
        <th>Gross Compensation</th><th>Non-Taxable</th><th>Taxable</th><th>Tax Withheld (Adjusted)</th>
      </tr>
      ${s1Rows || "<tr><td colspan='10'>No Schedule 1 employees.</td></tr>"}
      <tr><td colspan="10"></td></tr>
      <tr><td colspan="10" class="section">SCHEDULE 2 — Minimum Wage Earners (MWEs)</td></tr>
      <tr>
        <th>#</th><th>Name</th><th>Employee No.</th><th>Status</th>
        <th>From</th><th>To</th>
        <th>Gross Compensation</th><th>Non-Taxable</th><th>Taxable</th><th>Tax Due</th>
      </tr>
      ${s2Rows || "<tr><td colspan='10'>No Schedule 2 employees.</td></tr>"}
    </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = (report.fileName || `Alphalist-${report.year}`).replace(/[^a-z0-9-_ ]/gi, "_");
  link.download = `${safeName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function peso(v: number | undefined) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(v ?? 0);
}

function fmt(d: string | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function ClientPortalAlphalistPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [reports, setReports] = useState<SavedAlphalistReport[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [viewedReport, setViewedReport] = useState<SavedAlphalistReport | null>(null);
  const [schedule, setSchedule] = useState<"1" | "2">("1");

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, raw] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getDataArray<SavedAlphalistReport>(storageKeys.savedAlphalistReports, []),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setReports(Array.isArray(raw) ? raw : []);
    }
    load();
  }, [router]);

  const years = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => { if (r.year) set.add(String(r.year)); });
    return ["All", ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter((r) => {
      const matchSearch = !q || r.year?.includes(q) || r.fileName?.toLowerCase().includes(q);
      const matchYear = yearFilter === "All" || String(r.year) === yearFilter;
      return matchSearch && matchYear;
    });
  }, [reports, search, yearFilter]);

  const viewedRows = viewedReport
    ? schedule === "1"
      ? viewedReport.schedule1Rows ?? []
      : viewedReport.schedule2Rows ?? []
    : [];

  return (
    <div className="flex min-h-screen flex-col pg-bg">
      <style>{`@media print { header, nav { display: none !important; } }`}</style>
      {/* Banner */}
      <section
        className="print:hidden relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-8 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ backgroundColor: theme.bannerColor }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[32px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
            <List className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Alphalist</h1>
            <p className="text-sm opacity-70" style={{ color: theme.bannerTextColor }}>Annual alphalist of employees — read-only access</p>
          </div>
        </div>
      </section>

      <div className="print:hidden mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by year or filename…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
            />
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]"
          >
            {years.map((y) => <option key={y}>{y}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-500">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3 text-right">Total Employees</th>
                  <th className="px-4 py-3 text-right">Gross Compensation</th>
                  <th className="px-4 py-3 text-right">Tax Withheld</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No alphalist reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.year}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{r.fileName || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{r.summary?.totalEmployees ?? 0}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{peso(r.summary?.grossCompensation)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{peso(r.summary?.taxWithheld)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => { setViewedReport(r); setSchedule("1"); }}
                          className="rounded-lg border border-[#0a4f8f33] bg-[#0a4f8f0d] px-3 py-1.5 text-xs font-semibold text-[#0a4f8f] transition hover:bg-[#0a4f8f] hover:text-white"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {viewedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-transparent print:p-0">
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl print:shadow-none print:rounded-none print:max-h-none print:overflow-visible">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 print:hidden">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Alphalist — {viewedReport.year}</h2>
                <p className="text-sm text-slate-500">{viewedReport.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_Alphalist", entityId: viewedReport.id, entityName: `Alphalist ${viewedReport.year}`, details: "Client portal Excel download" }); downloadAlphalistExcel(viewedReport); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Download className="h-4 w-4" />Download Excel
                </button>
                <button type="button" onClick={() => setViewedReport(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="text-base font-bold text-slate-800 uppercase tracking-wide">Alphalist of Employees</div>
                <div className="text-sm text-slate-500">Annual Information Return · Year {viewedReport.year}</div>
              </div>

              {/* Summary cards */}
              {viewedReport.summary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryCard label="Total Employees" value={String(viewedReport.summary.totalEmployees ?? 0)} />
                  <SummaryCard label="Schedule 1" value={String(viewedReport.summary.schedule1Employees ?? 0)} sub="Regular employees" />
                  <SummaryCard label="Schedule 2" value={String(viewedReport.summary.schedule2Mwes ?? 0)} sub="MWEs" />
                  <SummaryCard label="Tax Withheld" value={peso(viewedReport.summary.taxWithheld)} />
                  <SummaryCard label="Gross Compensation" value={peso(viewedReport.summary.grossCompensation)} />
                  <SummaryCard label="Non-Taxable" value={peso(viewedReport.summary.nonTaxableCompensation)} />
                  <SummaryCard label="Taxable" value={peso(viewedReport.summary.taxableCompensation)} />
                  <SummaryCard label="Final Tax Withheld" value={peso(viewedReport.summary.finalTaxWithheld)} />
                </div>
              )}

              {/* Schedule tabs */}
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
                {(["1", "2"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSchedule(s)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${schedule === s ? "bg-white shadow-sm text-[#0a4f8f]" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Schedule {s} {s === "2" ? "(MWEs)" : ""}
                  </button>
                ))}
              </div>

              {/* Employee rows */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Employee</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2 text-right">Gross</th>
                        <th className="px-3 py-2 text-right">Non-Taxable</th>
                        <th className="px-3 py-2 text-right">Taxable</th>
                        <th className="px-3 py-2 text-right">Tax Withheld</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewedRows.length === 0 ? (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">No employees in this schedule.</td></tr>
                      ) : (
                        viewedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-slate-400">{row.sequenceNo ?? idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-700">{[row.lastName, row.firstName, row.middleName].filter(Boolean).join(", ")}</div>
                              <div className="text-slate-400">{row.employeeNo}</div>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{row.employmentStatus || "—"}</td>
                            <td className="px-3 py-2 text-slate-500">{fmt(row.fromDate)} – {fmt(row.toDate)}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{peso(row.presentGrossCompensation)}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{peso(row.presentTotalNonTaxable)}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{peso(row.presentTotalTaxable)}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">
                              {schedule === "1"
                                ? peso((row as Schedule1Row).amountOfTaxWithheldAsAdjusted)
                                : peso(row.taxDue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-1 text-xs text-slate-400 text-center">Saved: {fmt(viewedReport.savedAt)}</div>
              <div className="flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_Alphalist", entityId: viewedReport.id, entityName: `Alphalist ${viewedReport.year}`, details: "Client portal Excel download" }); downloadAlphalistExcel(viewedReport); }}
                  className="flex items-center gap-2 rounded-lg bg-[#0a4f8f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]"
                >
                  <Download className="h-4 w-4" />Download Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
