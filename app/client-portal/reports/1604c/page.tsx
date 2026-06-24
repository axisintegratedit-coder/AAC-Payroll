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

type MonthSummary = {
  month: string;
  monthNumber: string;
  taxesWithheld: number;
  adjustment: number;
  penalties: number;
  totalAmountRemitted: number;
  dateOfRemittance: string;
  draweeBank: string;
  referenceNumber: string;
};

type Saved1604CReport = {
  id: string;
  year: string;
  companyName: string;
  tin: string;
  fileName: string;
  revisionNumber: string;
  amendedReturn: "Yes" | "No";
  sheetsAttached: string;
  releasedRefunds: "Yes" | "No" | "N/A";
  refundDate: string;
  totalOverremittance: string;
  firstCreditingMonth: string;
  firstCreditingYear: string;
  monthlySummaries: MonthSummary[];
  totals: {
    taxesWithheld: number;
    adjustment: number;
    penalties: number;
    totalAmountRemitted: number;
  };
  savedAt: string;
  archiveStatus?: "Active" | "Archived";
};

function escapeHtml(s: string | number | undefined): string {
  if (s === undefined || s === null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function build1604CPrintHtml(report: Saved1604CReport): string {
  const rowsHtml = (report.monthlySummaries ?? []).map((row) => `
    <tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${escapeHtml(row.dateOfRemittance)}</td>
      <td>${escapeHtml(row.draweeBank)}</td>
      <td>${escapeHtml(row.referenceNumber)}</td>
      <td style="text-align:right;">${formatMoney(row.taxesWithheld)}</td>
      <td style="text-align:right;">${formatMoney(row.adjustment)}</td>
      <td style="text-align:right;">${formatMoney(row.penalties)}</td>
      <td style="text-align:right;font-weight:700;">${formatMoney(row.totalAmountRemitted)}</td>
    </tr>`).join("");

  const totals = report.totals ?? { taxesWithheld: 0, adjustment: 0, penalties: 0, totalAmountRemitted: 0 };

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>1604-C — ${escapeHtml(report.year)}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm 18mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0f172a; margin: 0; padding: 0; }
    .toolbar { display: flex; justify-content: center; gap: 12px; padding: 14px; background: #0f172a; }
    .toolbar button { border: 0; border-radius: 12px; padding: 11px 18px; font-weight: 900; cursor: pointer; }
    .btn-primary { background: #1d4ed8; color: #fff; }
    .btn-secondary { background: #fff; color: #0f172a; }
    .page { max-width: 1100px; margin: 0 auto; padding: 28px 24px; }
    h1 { font-size: 20px; font-weight: 900; color: #1e3a5f; margin: 0 0 3px; }
    .subtitle { font-size: 12px; color: #64748b; margin: 0 0 20px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
    .info-table td:first-child { font-weight: 700; color: #475569; width: 36%; background: #f8fafc; }
    .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; background: #1e3a5f; padding: 7px 12px; margin: 0; }
    .rows-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .rows-table th { background: #e5e7eb; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 7px 8px; border: 1px solid #d1d5db; text-align: left; }
    .rows-table th.num { text-align: right; }
    .rows-table td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 11px; }
    .rows-table td.num { text-align: right; }
    .rows-table tr:nth-child(even) td { background: #f8fafc; }
    .rows-table tfoot td { font-weight: 900; background: #f0fdf4; color: #065f46; border-top: 2px solid #bbf7d0; }
    .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print {
      .toolbar { display: none !important; }
      body { margin: 0; background: white; }
      .page {
        margin: 0 !important;
        padding: 10mm !important;
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
    <h1>BIR Form 1604-C</h1>
    <p class="subtitle">Annual Information Return of Income Taxes Withheld on Compensation</p>
    <table class="info-table">
      <tr><td>File Name</td><td>${escapeHtml(report.fileName)}</td></tr>
      <tr><td>Year</td><td>${escapeHtml(report.year)}</td></tr>
      <tr><td>Company Name</td><td>${escapeHtml(report.companyName)}</td></tr>
      <tr><td>TIN</td><td>${escapeHtml(report.tin)}</td></tr>
      <tr><td>Amended Return?</td><td>${escapeHtml(report.amendedReturn)}</td></tr>
      <tr><td>Number of Sheet/s Attached</td><td>${escapeHtml(report.sheetsAttached)}</td></tr>
      <tr><td>Released refund/s to employee/s?</td><td>${escapeHtml(report.releasedRefunds)}</td></tr>
      <tr><td>Refund Date</td><td>${escapeHtml(report.refundDate)}</td></tr>
      <tr><td>Total Overremittance</td><td>${escapeHtml(report.totalOverremittance)}</td></tr>
      <tr><td>Month of First Crediting</td><td>${escapeHtml(report.firstCreditingMonth)}</td></tr>
      <tr><td>Internal Credit Year</td><td>${escapeHtml(report.firstCreditingYear)}</td></tr>
    </table>
    <p class="section-title">Monthly Summary</p>
    <table class="rows-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Date of Remittance</th>
          <th>Drawee Bank / Bank Code / Agency</th>
          <th>TRA/eROR/eAR Number</th>
          <th class="num">Taxes Withheld</th>
          <th class="num">Adjustment</th>
          <th class="num">Penalties</th>
          <th class="num">Total Remitted</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="font-weight:900;">TOTAL</td>
          <td class="num">${formatMoney(totals.taxesWithheld)}</td>
          <td class="num">${formatMoney(totals.adjustment)}</td>
          <td class="num">${formatMoney(totals.penalties)}</td>
          <td class="num">${formatMoney(totals.totalAmountRemitted)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">BIR Form 1604-C &mdash; ${escapeHtml(report.year)} &mdash; Saved: ${report.savedAt ? new Date(report.savedAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"} &mdash; CONFIDENTIAL</div>
  </div>
</body>
</html>`;
}

function download1604CExcel(report: Saved1604CReport) {
  const totals = report.totals ?? { taxesWithheld: 0, adjustment: 0, penalties: 0, totalAmountRemitted: 0 };

  const rowsHtml = (report.monthlySummaries ?? []).map((row) => `
    <tr>
      <td>${escapeHtml(row.month)}</td>
      <td>${escapeHtml(row.dateOfRemittance)}</td>
      <td>${escapeHtml(row.draweeBank)}</td>
      <td>${escapeHtml(row.referenceNumber)}</td>
      <td style="text-align:right;">${formatMoney(row.taxesWithheld)}</td>
      <td style="text-align:right;">${formatMoney(row.adjustment)}</td>
      <td style="text-align:right;">${formatMoney(row.penalties)}</td>
      <td style="text-align:right;font-weight:bold;">${formatMoney(row.totalAmountRemitted)}</td>
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
      <tr><td colspan="8" class="title">BIR Form 1604-C — ${escapeHtml(report.year)}</td></tr>
      <tr><td colspan="8">Annual Information Return of Income Taxes Withheld on Compensation</td></tr>
      <tr><td colspan="8"></td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">File Name</td><td colspan="6">${escapeHtml(report.fileName)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Year</td><td colspan="6">${escapeHtml(report.year)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Company Name</td><td colspan="6">${escapeHtml(report.companyName)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">TIN</td><td colspan="6">${escapeHtml(report.tin)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Amended Return?</td><td colspan="6">${escapeHtml(report.amendedReturn)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Number of Sheet/s Attached</td><td colspan="6">${escapeHtml(report.sheetsAttached)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Released refund/s to employee/s?</td><td colspan="6">${escapeHtml(report.releasedRefunds)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Refund Date</td><td colspan="6">${escapeHtml(report.refundDate)}</td></tr>
      <tr><td style="font-weight:bold;background:#f8fafc;" colspan="2">Total Overremittance</td><td colspan="6">${escapeHtml(report.totalOverremittance)}</td></tr>
      <tr><td colspan="8"></td></tr>
      <tr><td colspan="8" class="section">MONTHLY SUMMARY</td></tr>
      <tr>
        <th>Month</th><th>Date of Remittance</th><th>Drawee Bank / Agency</th><th>TRA/eROR/eAR Number</th>
        <th>Taxes Withheld</th><th>Adjustment</th><th>Penalties</th><th>Total Remitted</th>
      </tr>
      ${rowsHtml}
      <tr>
        <td colspan="4" class="total">TOTAL</td>
        <td class="total" style="text-align:right;">${formatMoney(totals.taxesWithheld)}</td>
        <td class="total" style="text-align:right;">${formatMoney(totals.adjustment)}</td>
        <td class="total" style="text-align:right;">${formatMoney(totals.penalties)}</td>
        <td class="total" style="text-align:right;">${formatMoney(totals.totalAmountRemitted)}</td>
      </tr>
      <tr><td colspan="8"></td></tr>
      <tr><td colspan="8" style="font-size:10px;color:#94a3b8;">BIR Form 1604-C — ${escapeHtml(report.year)} — Saved: ${report.savedAt ? new Date(report.savedAt).toLocaleDateString("en-PH") : "—"} — CONFIDENTIAL</td></tr>
    </table>
  </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `1604-C-${(report.year || "report").replace(/[^a-z0-9-_ ]/gi, "_")}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function open1604CWindow(report: Saved1604CReport) {
  const win = window.open("", "_blank");
  if (!win) { window.alert("Please allow pop-ups for this site to open the report."); return; }
  win.document.open();
  win.document.write(build1604CPrintHtml(report));
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

export default function ClientPortal1604CPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [reports, setReports] = useState<Saved1604CReport[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [viewedReport, setViewedReport] = useState<Saved1604CReport | null>(null);

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, raw] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []),
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
    reports.forEach((r) => { if (r.year) set.add(String(r.year)); });
    return ["All", ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter((r) => {
      const matchSearch = !q || r.year?.includes(q) || r.companyName?.toLowerCase().includes(q) || r.fileName?.toLowerCase().includes(q);
      const matchYear = yearFilter === "All" || String(r.year) === yearFilter;
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
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Tax Info on 1604-C</h1>
            <p className="text-sm opacity-70" style={{ color: theme.bannerTextColor }}>Annual information return — read-only access</p>
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
              placeholder="Search by year or company…"
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
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Amended</th>
                  <th className="px-4 py-3 text-right">Total Tax Withheld</th>
                  <th className="px-4 py-3 text-right">Total Remitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No 1604-C reports found.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{r.year}</div>
                        <div className="text-xs text-slate-400">{r.fileName || ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{r.companyName || "—"}</div>
                        <div className="text-xs text-slate-400">TIN: {r.tin || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${r.amendedReturn === "Yes" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {r.amendedReturn === "Yes" ? "Amended" : "Original"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{peso(r.totals?.taxesWithheld)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">{peso(r.totals?.totalAmountRemitted)}</td>
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
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">1604-C Report — {viewedReport.year}</h2>
                <p className="text-sm text-slate-500">{viewedReport.companyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_1604C", entityId: viewedReport.id, entityName: `1604-C Tax Year ${viewedReport.year}`, details: "Client portal download" }); download1604CExcel(viewedReport); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  <Download className="h-4 w-4" />Download Excel
                </button>
                <button type="button" onClick={() => setViewedReport(null)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="text-base font-bold text-slate-800 uppercase tracking-wide">BIR Form 1604-C</div>
                <div className="text-sm text-slate-500">Annual Information Return of Income Taxes Withheld on Compensation</div>
                <div className="mt-1 text-sm text-slate-600 font-medium">Year: {viewedReport.year}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                {[
                  ["Company", viewedReport.companyName],
                  ["TIN", viewedReport.tin],
                  ["Amended Return", viewedReport.amendedReturn],
                  ["Sheets Attached", viewedReport.sheetsAttached || "—"],
                  ["Released Refunds", viewedReport.releasedRefunds || "—"],
                  ["Refund Date", fmt(viewedReport.refundDate)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                    <div className="mt-0.5 font-medium text-slate-800">{value || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Monthly summaries */}
              {viewedReport.monthlySummaries && viewedReport.monthlySummaries.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly Summary</div>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-2">Month</th>
                            <th className="px-3 py-2 text-right">Tax Withheld</th>
                            <th className="px-3 py-2 text-right">Adjustment</th>
                            <th className="px-3 py-2 text-right">Penalties</th>
                            <th className="px-3 py-2 text-right">Total Remitted</th>
                            <th className="px-3 py-2">Date Remitted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {viewedReport.monthlySummaries.map((ms) => (
                            <tr key={ms.month}>
                              <td className="px-3 py-2 font-medium text-slate-700">{ms.month}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{peso(ms.taxesWithheld)}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{peso(ms.adjustment)}</td>
                              <td className="px-3 py-2 text-right text-slate-600">{peso(ms.penalties)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-800">{peso(ms.totalAmountRemitted)}</td>
                              <td className="px-3 py-2 text-slate-500">{fmt(ms.dateOfRemittance)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                            <td className="px-3 py-2 text-slate-700">Totals</td>
                            <td className="px-3 py-2 text-right text-slate-800">{peso(viewedReport.totals?.taxesWithheld)}</td>
                            <td className="px-3 py-2 text-right text-slate-800">{peso(viewedReport.totals?.adjustment)}</td>
                            <td className="px-3 py-2 text-right text-slate-800">{peso(viewedReport.totals?.penalties)}</td>
                            <td className="px-3 py-2 text-right text-emerald-700">{peso(viewedReport.totals?.totalAmountRemitted)}</td>
                            <td className="px-3 py-2" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-1 text-xs text-slate-400 text-center">Saved: {fmt(viewedReport.savedAt)}</div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { logAudit({ action: "DOWNLOADED", entityType: "Report_1604C", entityId: viewedReport.id, entityName: `1604-C Tax Year ${viewedReport.year}`, details: "Client portal download" }); download1604CExcel(viewedReport); }}
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
