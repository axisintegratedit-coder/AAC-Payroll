"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Search } from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getCollectionItems } from "@/lib/firestore";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { buildDetailedSheet, collectCustomNames, fmtD, m, type DetailedRecord } from "@/lib/payrollExcel";

type PayrollRecord = DetailedRecord & {
  payrollPeriod?: string;
  payrollDate?: string;
  month?: string;
  year?: string;
  createdAt?: string;
  payrollRunId?: string;
  bulkRunId?: string;
};

type Approval = { status?: string; preparedByName?: string; checkedByName?: string; approvedByName?: string; approvedAt?: string; };

function hashPayrollRunKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) { hash = (hash << 5) - hash + value.charCodeAt(i); hash |= 0; }
  return Math.abs(hash).toString(36);
}
function buildPayrollRunIdentity(groupKey: string, records: PayrollRecord[]) {
  const src = records.map((r) => `${r.id || ""}:${r.createdAt || ""}`).sort().join("|");
  return `${groupKey}-${hashPayrollRunKey(src || groupKey)}`;
}

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
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

const summaryColumns = [
  { label: "#", width: 56, align: "center" as const },
  { label: "Employee No.", width: 150, align: "left" as const },
  { label: "Employee Name", width: 260, align: "left" as const },
  { label: "Department", width: 190, align: "left" as const },
  { label: "Position", width: 220, align: "left" as const },
  { label: "Payroll Schedule", width: 170, align: "left" as const },
  { label: "Pay Date", width: 160, align: "left" as const },
  { label: "Basic Pay", width: 150, align: "right" as const },
  { label: "Premiums", width: 150, align: "right" as const },
  { label: "Allowances", width: 150, align: "right" as const },
  { label: "Gross Pay", width: 150, align: "right" as const },
  { label: "SSS EE", width: 130, align: "right" as const },
  { label: "PhilHealth EE", width: 150, align: "right" as const },
  { label: "Pag-IBIG EE", width: 140, align: "right" as const },
  { label: "W/Tax", width: 140, align: "right" as const },
  { label: "Other Deductions", width: 170, align: "right" as const },
  { label: "Total Deductions", width: 170, align: "right" as const },
  { label: "Net Pay", width: 160, align: "right" as const },
];

function govtEmployeeTotal(record: PayrollRecord) {
  return money(record.totalGovtEmployeeContrib) || money(record.sssEe) + money(record.philhealthEe) + money(record.pagibigEe);
}

function otherDeductionsTotal(record: PayrollRecord) {
  const custom = (record.customDeductions || []).reduce((sum, item) => sum + money(item.amount), 0);
  const explicit =
    money(record.employeeAdvances) +
    money(record.cashAdvances) +
    money(record.sssLoanRepayment) +
    money(record.hdmfLoanRepayment) +
    custom;
  if (explicit > 0) return explicit;
  return Math.max(money(record.totalDeductions) - govtEmployeeTotal(record) - money(record.withholdingTax), 0);
}

type RunGroup = { id: string; title: string; records: PayrollRecord[]; date: string; gross: number; net: number; deductions: number; period: string; };

function groupRecords(records: PayrollRecord[]): RunGroup[] {
  const map = new Map<string, PayrollRecord[]>();
  for (const r of records) {
    const period = (r.payrollPeriod || "Monthly Payroll").trim();
    // Must match the groupKey formula in payroll-records/page.tsx exactly so hashes align.
    const key = r.payrollRunId || r.bulkRunId || `${r.year || ""}-${r.month || ""}-${period}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).map(([key, recs]) => {
    const first = recs[0];
    const period = first?.payrollPeriod || "Monthly Payroll";
    const title = `${first?.month || ""} ${first?.year || ""} ${period}`.trim();
    const id = buildPayrollRunIdentity(key, recs);
    return {
      id, title, records: recs, period,
      date: first?.payrollDate || "",
      gross: recs.reduce((s, r) => s + money(r.grossPay), 0),
      net: recs.reduce((s, r) => s + money(r.adjustedNetPay ?? r.netPay), 0),
      deductions: recs.reduce((s, r) => s + money(r.totalDeductions), 0),
    };
  });
}

async function exportToExcel(group: RunGroup, approvalStatus: string, companyName: string) {
  const ExcelJSMod = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");
  const wb = new ExcelJSMod.Workbook();
  const ws = wb.addWorksheet("Payroll Summary");
  const cn = collectCustomNames(group.records);
  buildDetailedSheet(ws, group.records, { title: group.title, companyName, period: group.period, payDate: group.date, approvalStatus, cn });
  const safe = group.title.replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_");
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Payroll_Detailed_${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const PAGE_SIZE = 50;

export default function AdminPayrollRunDetail() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const runId = rawId ? decodeURIComponent(rawId) : "";

  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);
  const [group, setGroup] = useState<RunGroup | null>(null);
  const [approval, setApproval] = useState<Approval>({});
  const [companyName, setCompanyName] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      const [theme, records, approvals, companyInfo] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME),
        getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
        getConfigItem<Record<string, Approval>>(storageKeys.payrollRunApprovals, {}),
        getConfigItem<{ companyName?: string }>(storageKeys.companyInformation, {}),
      ]);
      const t = normalizeTheme(theme);
      setTheme(t);
      applyAppTheme(t);
      const groups = groupRecords(records);
      const found = groups.find((g) => g.id === runId);
      setGroup(found ?? null);
      if (found) setApproval(approvals[found.id] ?? {});
      setCompanyName(companyInfo.companyName ?? "");
    }
    load();
  }, [runId]);

  const status = approval.status || "Draft";

  const filteredRecords = useMemo(() => {
    if (!group) return [];
    const q = search.toLowerCase();
    if (!q) return group.records;
    return group.records.filter(
      (r) => r.employeeName?.toLowerCase().includes(q) || r.employeeNo?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q)
    );
  }, [group, search]);

  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE);
  const pageRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeTheme = normalizeTheme(theme);

  const statusCls =
    status === "Approved" || status === "Locked" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "For Review" || status === "Checked" ? "border-blue-200 bg-blue-50 text-blue-700"
    : status === "Returned for Revision" ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-slate-200 bg-slate-50 text-slate-600";

  if (!group) {
    return (
      <div className="flex min-h-screen items-center justify-center pg-bg">
        <div className="text-center text-slate-500">
          <p className="text-lg font-semibold">Payroll run not found.</p>
          <button type="button" onClick={() => router.back()} className="mt-4 text-sm text-[#0a4f8f] underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(180deg, ${activeTheme.topNavColor} 0%, ${activeTheme.bannerColor} 220px, #f4f8fc 220px)` }}>
      {/* Banner */}
      <section className="relative overflow-hidden border-b px-6 py-6"
        style={{ backgroundColor: activeTheme.bannerColor, borderColor: `${activeTheme.accentColor}33` }}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 82% 20%, ${activeTheme.accentColor}33, transparent 30%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[36px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative mx-auto max-w-7xl">
          <button type="button" onClick={() => router.back()}
            className="mb-3 flex items-center gap-1.5 text-sm font-semibold opacity-80 hover:opacity-100 transition"
            style={{ color: activeTheme.bannerTextColor }}>
            <ArrowLeft className="h-4 w-4" /> Back to Payroll Records
          </button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: activeTheme.bannerTextColor }}>Payroll Summary</h1>
              <p className="mt-1 text-sm opacity-75" style={{ color: activeTheme.bannerTextColor }}>
                {group.title} · {group.records.length} employees · {group.period} · {fmtDate(group.date)}
              </p>
            </div>
            <button type="button"
              onClick={() => exportToExcel(group, status, companyName).catch(console.error)}
              className="flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              <Download className="h-4 w-4" /> Export to Excel
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Payroll Schedule", value: group.period },
            { label: "Pay Date", value: fmtDate(group.date) },
            { label: "Employees", value: String(group.records.length) },
            { label: "Gross Pay", value: peso(group.gross) },
            { label: "Deductions", value: peso(group.deductions) },
            { label: "Net Pay", value: peso(group.net) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusCls}`}>
            Status: {status}
          </span>
          {approval.preparedByName && <span className="text-sm text-slate-500">Prepared by {approval.preparedByName}</span>}
          {approval.checkedByName && <span className="text-sm text-slate-500">· Checked by {approval.checkedByName}</span>}
          {approval.approvedByName && <span className="text-sm text-slate-500">· Approved by {approval.approvedByName}{approval.approvedAt ? ` (${fmtDate(approval.approvedAt)})` : ""}</span>}
        </div>

        {/* Search */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: 220 }}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, employee no., or department…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
          </div>
          <span className="text-sm text-slate-500">
            {filteredRecords.length} employee{filteredRecords.length !== 1 ? "s" : ""}
            {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="table-fixed border-collapse text-sm" style={{ minWidth: summaryColumns.reduce((sum, column) => sum + column.width, 0) }}>
              <colgroup>
                {summaryColumns.map((column) => (
                  <col key={column.label} style={{ width: column.width }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {summaryColumns.map((column) => (
                    <th
                      key={column.label}
                      className={`whitespace-nowrap border-r border-slate-100 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRecords.length === 0 ? (
                  <tr><td colSpan={summaryColumns.length} className="px-4 py-8 text-center text-slate-400">No employees found.</td></tr>
                ) : (
                  pageRecords.map((r, i) => {
                    const idx = (page - 1) * PAGE_SIZE + i + 1;
                    return (
                      <tr key={r.id || r.employeeNo || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-center text-xs text-slate-400">{idx}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 font-mono text-xs text-slate-500">{r.employeeNo || "—"}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 font-semibold text-slate-800">{r.employeeName || "—"}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-slate-600">{r.department || "—"}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-slate-600">{r.jobTitle || r.designation || r.position || r.employmentStatus || "—"}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-slate-600">{group.period}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-slate-600">{fmtDate(group.date)}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.basicPay))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.totalPayrollPremium))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.totalAllowances))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right font-semibold text-slate-800">{peso(money(r.grossPay))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.sssEe))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.philhealthEe))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.pagibigEe))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(money(r.withholdingTax))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right text-slate-700">{peso(otherDeductionsTotal(r))}</td>
                        <td className="whitespace-nowrap border-r border-slate-100 px-3 py-2.5 text-right font-semibold text-slate-800">{peso(money(r.totalDeductions))}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-800">{peso(money(r.adjustedNetPay ?? r.netPay))}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredRecords.length > 0 && page === totalPages && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/70">
                    <td colSpan={7} className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-sm font-semibold text-slate-700">Total ({group.records.length} employees)</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.basicPay), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.totalPayrollPremium), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.totalAllowances), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.gross)}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.sssEe), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.philhealthEe), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.pagibigEe), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + money(r.withholdingTax), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.records.reduce((s, r) => s + otherDeductionsTotal(r), 0))}</td>
                    <td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-bold text-slate-900">{peso(group.deductions)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-900">{peso(group.net)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-xs text-slate-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length}</span>
              <div className="flex gap-1">
                <button type="button" disabled={page === 1} onClick={() => setPage(1)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">«</button>
                <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return (
                    <button key={p} type="button" onClick={() => setPage(p)}
                      className={`rounded border px-2.5 py-1 text-xs ${p === page ? "border-[#0a4f8f] bg-[#0a4f8f] text-white" : "border-slate-200 hover:bg-slate-50"}`}>{p}</button>
                  );
                })}
                <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">›</button>
                <button type="button" disabled={page === totalPages} onClick={() => setPage(totalPages)} className="rounded border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 hover:bg-slate-50">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
