"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Download, Search, X } from "lucide-react";
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

type BirRow = {
  item: string;
  label: string;
  amount: number;
  formula?: string;
};

type Saved1601CReport = {
  id: string;
  month: string;
  monthLabel: string;
  coveragePeriod: string;
  companyName: string;
  tin: string;
  taxesWithheld: number;
  taxRequiredForRemittance?: number;
  adjustment: number;
  manualAdjustment?: number;
  yearEndTaxAdjustment?: number;
  penalties: number;
  totalAmountRemitted: number;
  dateRemitted: string;
  draweeBank: string;
  referenceNumber: string;
  rows?: BirRow[];
  savedAt: string;
  archiveStatus?: "Active" | "Archived";
};

function escapeHtml(s: string | number | undefined): string {
  if (s === undefined || s === null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function plainAmount(value: number): string {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function build1601CPrintHtml(report: Saved1601CReport): string {
  const rowsHtml = (report.rows ?? []).map((row) => `
    <tr>
      <td style="text-align:center;font-weight:900;">${escapeHtml(row.item)}</td>
      <td>
        <strong>${escapeHtml(row.label)}</strong>
        ${row.formula ? `<br/><span style="color:#64748b;font-size:11px;">${escapeHtml(row.formula)}</span>` : ""}
      </td>
      <td style="text-align:right;font-weight:700;">${plainAmount(row.amount)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>1601-C — ${escapeHtml(report.monthLabel)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 0; }
    .toolbar { display: flex; justify-content: center; gap: 12px; padding: 14px; background: #0f172a; }
    .toolbar button { border: 0; border-radius: 12px; padding: 11px 18px; font-weight: 900; cursor: pointer; }
    .btn-primary { background: #1d4ed8; color: #fff; }
    .btn-secondary { background: #fff; color: #0f172a; }
    .page { max-width: 800px; margin: 0 auto; padding: 28px 24px; }
    h1 { font-size: 20px; font-weight: 900; color: #1e3a5f; margin: 0 0 3px; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0 0 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
    .info-table td:first-child { font-weight: 700; color: #475569; width: 42%; background: #f8fafc; }
    .info-table tr:last-child td { font-weight: 900; background: #f0fdf4; color: #065f46; }
    .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; background: #1e3a5f; padding: 7px 12px; margin: 0 0 0; border: 0; }
    .rows-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .rows-table th { background: #e5e7eb; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 7px 12px; border: 1px solid #d1d5db; text-align: left; }
    .rows-table th:last-child { text-align: right; }
    .rows-table td { padding: 7px 12px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 12px; }
    .rows-table tr:nth-child(even) td { background: #f8fafc; }
    .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print {
      .toolbar { display: none !important; }
      body { margin: 0; background: white; }
      .page {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        max-width: none !important;
        width: 100% !important;
        max-height: none !important;
        overflow: visible !important;
      }
      * { overflow: visible !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-primary" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn-secondary" onclick="window.close()">Close</button>
  </div>
  <div class="page">
    <h1>BIR Form 1601-C</h1>
    <p class="subtitle">Monthly Remittance Return of Income Taxes Withheld on Compensation</p>
    <table class="info-table">
      <tr><td>Month</td><td>${escapeHtml(report.monthLabel)}</td></tr>
      <tr><td>Coverage Period</td><td>${escapeHtml(report.coveragePeriod)}</td></tr>
      <tr><td>Company Name</td><td>${escapeHtml(report.companyName)}</td></tr>
      <tr><td>TIN</td><td>${escapeHtml(report.tin)}</td></tr>
      <tr><td>Date Remitted</td><td>${escapeHtml(report.dateRemitted)}</td></tr>
      <tr><td>Drawee Bank / Bank Code / Agency</td><td>${escapeHtml(report.draweeBank)}</td></tr>
      <tr><td>TRA/eROR/eAR Number</td><td>${escapeHtml(report.referenceNumber)}</td></tr>
      <tr><td>Manual Adjustment</td><td>${plainAmount(report.manualAdjustment ?? 0)}</td></tr>
      <tr><td>Prior-Year Credit / YTA Adjustment</td><td>${plainAmount(report.yearEndTaxAdjustment ?? 0)}</td></tr>
      <tr><td>Total Adjustment / Item 26</td><td>${plainAmount(report.adjustment)}</td></tr>
      <tr><td>Tax Required for Remittance</td><td>${plainAmount(report.taxRequiredForRemittance ?? (report.taxesWithheld + report.adjustment))}</td></tr>
      <tr><td>Penalties</td><td>${plainAmount(report.penalties)}</td></tr>
      <tr><td>Total Amount Remitted</td><td>${plainAmount(report.totalAmountRemitted)}</td></tr>
    </table>
    ${(report.rows && report.rows.length > 0) ? `
    <p class="section-title">Computation of Tax</p>
    <table class="rows-table">
      <thead><tr><th style="width:60px;text-align:center;">Item</th><th>Description</th><th style="width:160px;">Amount</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>` : ""}
    <div class="footer">BIR Form 1601-C &mdash; ${escapeHtml(report.monthLabel)} &mdash; Saved: ${report.savedAt ? new Date(report.savedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"} &mdash; CONFIDENTIAL</div>
  </div>
</body>
</html>`;
}

function download1601CExcel(report: Saved1601CReport) {
  const money = (v: number | undefined) =>
    new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v ?? 0);

  const rowsHtml = (report.rows ?? []).map((row) => `
    <tr>
      <td style="text-align:center;font-weight:bold;">${escapeHtml(row.item)}</td>
      <td>${escapeHtml(row.label)}${row.formula ? ` — ${escapeHtml(row.formula)}` : ""}</td>
      <td style="text-align:right;">${money(row.amount)}</td>
    </tr>`).join("");

  const html = `<html><head><meta charset="UTF-8"/>
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
      th, td { border: 1px solid #cbd5e1; padding: 5px 8px; }
      th { background: #e2e8f0; font-weight: bold; }
      .title { font-size: 14px; font-weight: bold; }
      .section { background: #1e3a5f; color: white; font-weight: bold; }
      .total { background: #f0fdf4; font-weight: bold; color: #065f46; }
    </style></head><body>
    <table>
      <tr><td colspan="3" class="title">BIR Form 1601-C — ${escapeHtml(report.monthLabel)}</td></tr>
      <tr><td colspan="3">Monthly Remittance Return of Income Taxes Withheld on Compensation</td></tr>
      <tr><td colspan="3"></td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Month</td><td colspan="2">${escapeHtml(report.monthLabel)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Coverage Period</td><td colspan="2">${escapeHtml(report.coveragePeriod)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Company Name</td><td colspan="2">${escapeHtml(report.companyName)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">TIN</td><td colspan="2">${escapeHtml(report.tin)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Date Remitted</td><td colspan="2">${escapeHtml(report.dateRemitted)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Drawee Bank / Agency</td><td colspan="2">${escapeHtml(report.draweeBank)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">TRA/eROR/eAR Number</td><td colspan="2">${escapeHtml(report.referenceNumber)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Manual Adjustment</td><td colspan="2">${money(report.manualAdjustment ?? 0)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Prior-Year Credit / YTA Adjustment</td><td colspan="2">${money(report.yearEndTaxAdjustment ?? 0)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Total Adjustment / Item 26</td><td colspan="2">${money(report.adjustment)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Tax Required for Remittance</td><td colspan="2">${money(report.taxRequiredForRemittance ?? (report.taxesWithheld + report.adjustment))}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;">Penalties</td><td colspan="2">${money(report.penalties)}</td></tr>
      <tr><td style="font-weight:bold;background:#f0fdf4;color:#065f46;">Total Amount Remitted</td><td colspan="2" style="font-weight:bold;background:#f0fdf4;color:#065f46;">${money(report.totalAmountRemitted)}</td></tr>
      ${(report.rows && report.rows.length > 0) ? `
      <tr><td colspan="3"></td></tr>
      <tr><td colspan="3" class="section">COMPUTATION OF TAX</td></tr>
      <tr><th>Item</th><th>Description</th><th>Amount</th></tr>
      ${rowsHtml}` : ""}
      <tr><td colspan="3"></td></tr>
      <tr><td colspan="3" style="font-size:10px;color:#94a3b8;">BIR Form 1601-C — ${escapeHtml(report.monthLabel)} — Saved: ${report.savedAt ? new Date(report.savedAt).toLocaleDateString("en-PH") : "—"} — CONFIDENTIAL</td></tr>
    </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = `1601-C-${(report.monthLabel || report.month || "report").replace(/[^a-z0-9-_ ]/gi, "_")}`;
  link.download = `${safeName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function open1601CWindow(report: Saved1601CReport) {
  const win = window.open("", "_blank");
  if (!win) { window.alert("Please allow pop-ups for this site to open the report."); return; }
  win.document.open();
  win.document.write(build1601CPrintHtml(report));
  win.document.close();
  win.focus();
}

function peso(v: number | undefined) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(v ?? 0);
}

function fmt(d: string | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${bold ? "bg-slate-50" : ""}`}>
      <span className={`text-sm ${bold ? "font-semibold text-slate-700" : "text-slate-600"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-slate-900" : "font-medium text-slate-800"}`}>{value}</span>
    </div>
  );
}

export default function ClientPortal1601CPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [reports, setReports] = useState<Saved1601CReport[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [viewedReport, setViewedReport] = useState<Saved1601CReport | null>(null);

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, raw] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setReports(Array.isArray(raw) ? raw.filter((r) => r.archiveStatus !== "Archived") : []);
    }
    load();
  }, [router]);

  const years = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.savedAt) set.add(String(new Date(r.savedAt).getFullYear()));
    });
    return ["All", ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter((r) => {
      const matchSearch = !q || r.monthLabel?.toLowerCase().includes(q) || r.coveragePeriod?.toLowerCase().includes(q) || r.companyName?.toLowerCase().includes(q);
      const recYear = r.savedAt ? String(new Date(r.savedAt).getFullYear()) : "";
      const matchYear = yearFilter === "All" || recYear === yearFilter;
      return matchSearch && matchYear;
    });
  }, [reports, search, yearFilter]);

  return (
    <div className="flex min-h-screen flex-col pg-bg">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-8 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ backgroundColor: theme.bannerColor }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[32px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
            <Calculator className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Tax Info on 1601-C</h1>
            <p className="text-sm opacity-70" style={{ color: theme.bannerTextColor }}>Monthly withholding tax remittance reports — read-only access</p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by month, period, or company…"
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
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 text-right">Taxes Withheld</th>
                  <th className="px-4 py-3 text-right">Total Remitted</th>
                  <th className="px-4 py-3">Date Remitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No 1601-C reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.monthLabel || r.month}</div>
                        <div className="text-xs text-slate-400">{r.coveragePeriod}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{r.companyName || "—"}</div>
                        <div className="text-xs text-slate-400">TIN: {r.tin || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{peso(r.taxesWithheld)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{peso(r.totalAmountRemitted)}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(r.dateRemitted)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setViewedReport(r)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">1601-C Report</h2>
                <p className="text-sm text-slate-500">{viewedReport.monthLabel} — {viewedReport.coveragePeriod}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_1601C", entityId: viewedReport.id || viewedReport.month, entityName: `1601-C ${viewedReport.monthLabel}`, details: "Client portal download" }); download1601CExcel(viewedReport); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Download className="h-4 w-4" />Download Excel
                </button>
                <button type="button" onClick={() => setViewedReport(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="text-base font-bold text-slate-800 uppercase tracking-wide">BIR Form 1601-C</div>
                <div className="text-sm text-slate-500">Monthly Remittance Return of Income Taxes Withheld on Compensation</div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Company</div>
                  <div className="mt-0.5 font-medium text-slate-800">{viewedReport.companyName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">TIN</div>
                  <div className="mt-0.5 font-medium text-slate-800">{viewedReport.tin || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage Period</div>
                  <div className="mt-0.5 font-medium text-slate-800">{viewedReport.coveragePeriod || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date Remitted</div>
                  <div className="mt-0.5 font-medium text-slate-800">{fmt(viewedReport.dateRemitted)}</div>
                </div>
                {viewedReport.draweeBank && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drawee Bank</div>
                    <div className="mt-0.5 font-medium text-slate-800">{viewedReport.draweeBank}</div>
                  </div>
                )}
                {viewedReport.referenceNumber && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reference No.</div>
                    <div className="mt-0.5 font-medium text-slate-800">{viewedReport.referenceNumber}</div>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 divide-y divide-slate-100">
                <Row label="Taxes Withheld on Compensation" value={peso(viewedReport.taxesWithheld)} />
                {viewedReport.taxRequiredForRemittance !== undefined && (
                  <Row label="Tax Required for Remittance" value={peso(viewedReport.taxRequiredForRemittance)} />
                )}
                <Row label="Adjustment" value={peso(viewedReport.adjustment)} />
                {viewedReport.manualAdjustment !== undefined && viewedReport.manualAdjustment !== 0 && (
                  <Row label="Manual Adjustment" value={peso(viewedReport.manualAdjustment)} />
                )}
                <Row label="Penalties" value={peso(viewedReport.penalties)} />
                <Row label="Total Amount Remitted" value={peso(viewedReport.totalAmountRemitted)} bold />
              </div>

              <div className="pt-2 text-xs text-slate-400 text-center">Saved: {fmt(viewedReport.savedAt)}</div>
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_1601C", entityId: viewedReport.id || viewedReport.month, entityName: `1601-C ${viewedReport.monthLabel}`, details: "Client portal download" }); download1601CExcel(viewedReport); }}
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
