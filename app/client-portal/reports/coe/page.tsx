"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Printer, Search } from "lucide-react";
import { getConfigItem, getDataArray, getCollectionItems } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { getClientPortalSessionAsync } from "../../lib/auth";
import { logAudit } from "@/lib/auditTrail";
import {
  applyAppTheme,
  DEFAULT_APP_THEME,
  normalizeTheme,
  type AppTheme,
} from "@/lib/appTheme";

type CoeHistoryItem = {
  id: string;
  employeeNo: string;
  employeeName: string;
  purpose: string;
  issueDate: string;
  includeCompensation: boolean;
  includeAllowance: boolean;
  includeContactDetails?: boolean;
  generatedAt: string;
  certifiedByName: string;
  certifiedByPosition: string;
  certifiedBySignatureDataUrl?: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyContactNumber?: string;
  companyLogoDataUrl?: string;
  status: "Draft" | "Subject for Approval" | "Approved" | "Rejected" | "Archived";
  submittedAt?: string;
  approvedAt?: string;
  approvedByName?: string;
  rejectedAt?: string;
  rejectedByName?: string;
};

type Employee = {
  employeeNo: string;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  company?: string;
  designation?: string;
  department?: string;
  employeeType?: string;
  employmentStatus?: string;
  hireDate?: string;
  separationDate?: string;
  basicPay?: number;
  riceSubsidy?: number;
  uniformClothingAllowance?: number;
  laundryAllowance?: number;
  actualMedicalAssistance?: number;
  medicalCashAllowanceToDependents?: number;
  mealAllowance?: number;
  christmasAnniversaryGifts?: number;
  achievementAwards?: number;
  otherAllowanceName?: string;
  otherAllowanceAmount?: number;
};

const STATUS_COLORS: Record<string, string> = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Subject for Approval": "bg-amber-50 text-amber-700 border-amber-200",
  Draft: "bg-slate-100 text-slate-600 border-slate-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  Archived: "bg-slate-100 text-slate-400 border-slate-200",
};

function fmt(d: string | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "2-digit" });
}

function formatPlainMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getFullName(employee?: Employee | null) {
  if (!employee) return "";
  return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(", ");
}

function getFormalName(employee?: Employee | null) {
  if (!employee) return "";
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

function getEmployeeAllowanceRows(employee?: Employee | null) {
  if (!employee) return [];
  const defs = [
    { label: "Rice Subsidy", monthly: Number(employee.riceSubsidy) || 0 },
    { label: "Uniform / Clothing Allowance", monthly: Number(employee.uniformClothingAllowance) || 0 },
    { label: "Laundry Allowance", monthly: Number(employee.laundryAllowance) || 0 },
    { label: "Actual Medical Assistance", monthly: Number(employee.actualMedicalAssistance) || 0 },
    { label: "Medical Cash Allowance to Dependents", monthly: Number(employee.medicalCashAllowanceToDependents) || 0 },
    { label: "Meal Allowance", monthly: Number(employee.mealAllowance) || 0 },
    { label: "Christmas / Anniversary Gifts", monthly: Number(employee.christmasAnniversaryGifts) || 0 },
    { label: "Achievement Awards", monthly: Number(employee.achievementAwards) || 0 },
    { label: employee.otherAllowanceName?.trim() || "Other Allowance", monthly: Number(employee.otherAllowanceAmount) || 0 },
  ];
  return defs.filter((a) => a.monthly > 0).map((a) => ({ label: a.label, monthly: a.monthly, annual: a.monthly * 12 }));
}

function buildCompensationTableHtml(
  rows: Array<{ label: string; monthly: number; annual: number }>,
  totalLabel?: string
) {
  const totalMonthly = rows.reduce((sum, r) => sum + r.monthly, 0);
  const totalAnnual = rows.reduce((sum, r) => sum + r.annual, 0);
  const showTotal = Boolean(totalLabel) && rows.length > 1;

  const bodyRows = rows
    .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="amount-cell">₱${formatPlainMoney(r.monthly)}</td><td class="amount-cell">₱${formatPlainMoney(r.annual)}</td></tr>`)
    .join("");

  const totalRow = showTotal
    ? `<tr><td class="total-cell">${escapeHtml(totalLabel || "")}</td><td class="total-cell amount-cell">₱${formatPlainMoney(totalMonthly)}</td><td class="total-cell amount-cell">₱${formatPlainMoney(totalAnnual)}</td></tr>`
    : "";

  return `
    <table>
      <thead><tr><th>Compensation Component</th><th style="text-align:right;">Monthly Amount</th><th style="text-align:right;">Annual Amount</th></tr></thead>
      <tbody>${bodyRows}${totalRow}</tbody>
    </table>`;
}

const SHARED_CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e2e8f0; color: #111827; font-family: "Times New Roman", Times, serif; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 14px; background: #0f172a; z-index: 20; }
  .toolbar button { border: 0; border-radius: 12px; padding: 11px 16px; font-weight: 900; cursor: pointer; }
  .primary-button { background: #1d4ed8; color: #ffffff; }
  .secondary-button { background: #ffffff; color: #0f172a; }
  .certificate-page { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 12mm 22mm 10mm; background: #ffffff; position: relative; box-shadow: 0 18px 45px rgba(15,23,42,0.18); overflow: hidden; }
  .certificate-page + .certificate-page { margin-top: 36px; }
  .draft-watermark { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(2,1fr); grid-template-rows: repeat(3,1fr); align-items: center; justify-items: center; color: rgba(100,116,139,0.18); font-size: 54px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; pointer-events: none; z-index: 0; overflow: hidden; }
  .draft-watermark span { display: block; transform: rotate(-28deg); white-space: nowrap; }
  .certificate-content { position: relative; z-index: 1; min-height: calc(297mm - 22mm); display: flex; flex-direction: column; }
  .status-pill { position: absolute; top: 12mm; right: 22mm; border: 1px solid #cbd5e1; background: rgba(248,250,252,0.92); color: #334155; border-radius: 999px; padding: 6px 10px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em; z-index: 2; }
  .certificate-header { display: flex; align-items: center; gap: 18px; border-bottom: 4px solid #0f4c81; padding-bottom: 12px; margin-bottom: 46px; }
  .company-logo { max-width: 150px; max-height: 75px; object-fit: contain; }
  .company-name { font-size: 18pt; font-weight: 700; color: #0f2f4a; text-transform: uppercase; letter-spacing: 0.04em; }
  .company-address { font-size: 10.5pt; color: #374151; margin-top: 6px; }
  h1 { text-align: center; color: #111827; font-size: 18pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin: 18px 0 42px; }
  p { font-size: 12pt; line-height: 1.65; text-align: justify; margin: 0 0 22px; }
  .compensation-block { margin-top: 34px; margin-bottom: 34px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11pt; color: #111827; }
  th { padding: 8px 10px; border: 1px solid #9ca3af; background: #f3f4f6; color: #111827; font-weight: 700; text-align: left; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10.5pt; }
  td { padding: 8px 10px; border: 1px solid #9ca3af; background: #ffffff; vertical-align: top; }
  .amount-cell { text-align: right; font-weight: 800; }
  .total-cell { padding: 10px 12px; border: 1px solid #94a3b8; background: #f8fafc; font-weight: 900; }
  .table-spacing { margin-top: 18px; }
  .empty-allowance-note { margin-top: 18px; padding: 12px 14px; border: 1px dashed #cbd5e1; border-radius: 14px; color: #64748b; font-size: 13px; font-weight: 700; }
  .signature-block { margin-top: 54px; page-break-inside: avoid; break-inside: avoid; }
  .signature-label { margin-bottom: 12px; font-weight: 700; }
  .signature-image { width: 170px; height: 44px; object-fit: contain; display: block; margin-bottom: 6px; }
  .signature-placeholder { height: 44px; }
  .signature-name { font-weight: 700; border-top: 1px solid #111827; width: 280px; padding-top: 8px; font-size: 12pt; text-transform: uppercase; line-height: 1.15; }
  .signature-position { font-size: 11pt; color: #374151; margin-top: 3px; }
  .footer { position: static; margin-top: auto; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: start; gap: 22px; font-size: 8.5pt; line-height: 1.2; color: #4b5563; border-top: 1px solid #d1d5db; padding-top: 6px; background: #ffffff; clear: both; }
  .footer em { display: block; max-width: 135mm; }
  .footer strong { white-space: nowrap; letter-spacing: 0.04em; }
  @media print {
    body { background: #ffffff; }
    .toolbar { display: none !important; }
    .status-pill { top: 12mm !important; right: 22mm !important; }
    .draft-watermark { color: rgba(100,116,139,0.2) !important; }
    .certificate-page { margin: 0; box-shadow: none; width: 210mm; height: 297mm; min-height: 297mm; padding: 12mm 22mm 10mm !important; overflow: hidden; page-break-after: always; break-after: page; }
    .certificate-page:last-child { page-break-after: auto; break-after: auto; }
    .signature-block { margin-top: 46px !important; }
    .signature-image { width: 160px !important; height: 38px !important; margin-bottom: 6px !important; }
    .signature-placeholder { height: 38px !important; }
    .footer { position: static !important; margin-top: auto !important; font-size: 8.5pt !important; padding-top: 5px !important; }
    p { font-size: 11pt !important; line-height: 1.55 !important; margin-bottom: 15px !important; }
    table { font-size: 10.5pt !important; page-break-inside: avoid !important; break-inside: avoid !important; }
    th, td { padding: 7px 9px !important; }
  }
`;

function buildCertificateSectionHtml(item: CoeHistoryItem, employee: Employee | null): string {
  if (!employee) return "";

  const certificateStatus = item.status || "Draft";
  const isDraft = certificateStatus !== "Approved";

  const watermarkHtml = isDraft
    ? `<div class="draft-watermark" aria-hidden="true"><span>DRAFT</span><span>DRAFT</span><span>DRAFT</span><span>DRAFT</span><span>DRAFT</span><span>DRAFT</span></div>`
    : "";

  const companyName = item.companyName || employee.company || "Company Name";
  const companyAddress = item.companyAddress || "Company Address";
  const companyEmail = item.companyEmail || "";
  const companyContactNumber = item.companyContactNumber || "";

  const logoHtml = item.companyLogoDataUrl
    ? `<img src="${item.companyLogoDataUrl}" alt="Company logo" class="company-logo" />`
    : "";

  const signatureHtml = item.certifiedBySignatureDataUrl
    ? `<img src="${item.certifiedBySignatureDataUrl}" alt="Signature" class="signature-image" />`
    : `<div class="signature-placeholder"></div>`;

  const allowanceRows = getEmployeeAllowanceRows(employee);
  const monthlyBasicPay = Number(employee.basicPay) || 0;
  const annualBasePay = monthlyBasicPay * 12;
  const totalMonthlyAllowance = allowanceRows.reduce((sum, r) => sum + r.monthly, 0);
  const totalAnnualAllowance = allowanceRows.reduce((sum, r) => sum + r.annual, 0);

  const compensationHtml = item.includeCompensation
    ? `<div class="compensation-block">
        <p>Upon request, the employee's compensation details are reflected below for reference:</p>
        ${buildCompensationTableHtml([{ label: "Basic Pay", monthly: monthlyBasicPay, annual: annualBasePay }])}
        ${item.includeAllowance
          ? allowanceRows.length > 0
            ? `<div class="table-spacing">${buildCompensationTableHtml(allowanceRows, "Total Allowances")}</div>`
            : `<div class="empty-allowance-note">No allowance amounts are currently saved in this employee's information.</div>`
          : ""}
        ${item.includeAllowance && allowanceRows.length > 0
          ? `<div class="table-spacing">${buildCompensationTableHtml([{ label: "Total Compensation Package", monthly: monthlyBasicPay + totalMonthlyAllowance, annual: annualBasePay + totalAnnualAllowance }])}</div>`
          : ""}
      </div>`
    : "";

  const contactParagraph = item.includeContactDetails
    ? `<p>For verification of this certificate, requests may be coursed through the company's authorized HR representative at <strong>${escapeHtml(companyEmail || "official company email")}</strong>${companyContactNumber ? ` or through <strong>${escapeHtml(companyContactNumber)}</strong>` : ""}.</p>`
    : `<p>For verification of this certificate, requests may be coursed through the company's authorized HR representative or official contact channel.</p>`;

  const employmentPeriod = employee.separationDate
    ? `to <strong>${escapeHtml(formatDate(employee.separationDate))}</strong>`
    : "to present";

  const departmentPhrase = employee.department
    ? ` under the <strong>${escapeHtml(employee.department)}</strong> department`
    : "";

  return `
    <section class="certificate-page">
      ${watermarkHtml}
      <div class="status-pill">${escapeHtml(certificateStatus)}</div>
      <div class="certificate-content">
        <div class="certificate-header">
          ${logoHtml}
          <div>
            <div class="company-name">${escapeHtml(companyName)}</div>
            <div class="company-address">${escapeHtml(companyAddress)}</div>
          </div>
        </div>

        <h1>Certificate of Employment</h1>

        <p>
          This is to certify that <strong>${escapeHtml(getFullName(employee).toUpperCase())}</strong>
          ${employee.separationDate ? "was" : "is"} employed by
          <strong>${escapeHtml(companyName.toUpperCase())}</strong> from
          <strong>${escapeHtml(formatDate(employee.hireDate))}</strong>
          ${employmentPeriod} as <strong>${escapeHtml(employee.designation || "—")}</strong>${departmentPhrase}
          with <strong>${escapeHtml(employee.employeeType || employee.employmentStatus || "—")}</strong>
          employment status.
        </p>

        ${compensationHtml}
        ${contactParagraph}

        <p>
          This certification is issued upon the request of <strong>${escapeHtml(getFormalName(employee))}</strong>
          for <strong>${escapeHtml(item.purpose || "Employment Verification")}</strong> purposes, issued this
          <strong>${escapeHtml(formatDate(item.issueDate))}</strong>.
        </p>

        <div class="signature-block">
          <div class="signature-label">Certified by:</div>
          ${signatureHtml}
          <div class="signature-name">${escapeHtml(item.certifiedByName || "Authorized Signatory")}</div>
          <div class="signature-position">${escapeHtml(item.certifiedByPosition || "")}</div>
        </div>

        <div class="footer">
          <em>This certificate is system-generated with an electronic signature and unique internal ticket number (${escapeHtml(item.id)}). Status: ${escapeHtml(certificateStatus)}.</em>
          <strong>CONFIDENTIAL</strong>
        </div>
      </div>
    </section>`;
}

function openCoeWindow(sections: string[], title: string) {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Please allow pop-ups for this site so the COE can open in a new tab.");
    return;
  }

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>${SHARED_CSS}</style>
      </head>
      <body>
        <div class="toolbar">
          <button class="primary-button" onclick="window.print()">Print / Save as PDF</button>
          <button class="secondary-button" onclick="window.close()">Close</button>
        </div>
        ${sections.join("\n")}
      </body>
    </html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}

export default function ClientPortalCoePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [coeHistory, setCoeHistory] = useState<CoeHistoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [themeRaw, raw, emps] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []),
        getCollectionItems<Employee>(storageKeys.employees),
      ]);
      const t = normalizeTheme(themeRaw);
      setTheme(t);
      applyAppTheme(t);
      setCoeHistory(Array.isArray(raw) ? raw.filter((c) => c.status !== "Archived") : []);
      setEmployees(Array.isArray(emps) ? emps : []);
    }
    load();
  }, [router]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return coeHistory.filter((c) => {
      const matchSearch =
        !q ||
        c.employeeName?.toLowerCase().includes(q) ||
        c.employeeNo?.toLowerCase().includes(q) ||
        c.purpose?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [coeHistory, search, statusFilter]);

  const allFilteredIds = filtered.map((c) => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));
  const someSelected = allFilteredIds.some((id) => selectedIds.has(id));
  const selectedCount = allFilteredIds.filter((id) => selectedIds.has(id)).length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function findEmployee(employeeNo: string) {
    return employees.find((e) => e.employeeNo === employeeNo) || null;
  }

  function handleViewCoe(item: CoeHistoryItem) {
    const employee = findEmployee(item.employeeNo);
    const section = buildCertificateSectionHtml(item, employee);
    if (!section) { window.alert("Employee record for this COE could not be found."); return; }
    openCoeWindow([section], `COE — ${item.employeeName}`);
  }

  function handlePrintSelected() {
    const selectedItems = filtered.filter((c) => selectedIds.has(c.id));
    const sections: string[] = [];
    const missing: string[] = [];

    for (const item of selectedItems) {
      const employee = findEmployee(item.employeeNo);
      const section = buildCertificateSectionHtml(item, employee);
      if (section) sections.push(section);
      else missing.push(item.employeeName);
    }

    if (sections.length === 0) {
      window.alert("No employee records found for the selected COEs.");
      return;
    }

    if (missing.length > 0) {
      window.alert(`Note: ${missing.length} COE(s) were skipped — employee records not found:\n${missing.join(", ")}`);
    }

    openCoeWindow(sections, `COEs — ${sections.length} certificate${sections.length !== 1 ? "s" : ""}`);
    selectedItems.forEach((item) => {
      logAudit({
        action: "PRINTED",
        entityType: "Report_COE",
        entityId: item.id,
        entityName: `COE ${item.employeeName} — ${item.purpose || ""}`,
        details: "Client portal print",
      });
    });
  }

  const bannerStyle = { backgroundColor: theme.bannerColor };

  return (
    <div className="flex min-h-screen flex-col pg-bg">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-8 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={bannerStyle}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 80% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[32px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>
              Certificates of Employment
            </h1>
            <p className="text-sm opacity-70" style={{ color: theme.bannerTextColor }}>
              View and print issued COEs — read-only access
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        {/* Filters + bulk action bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); }}
              placeholder="Search by name, employee no, or purpose…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setSelectedIds(new Set()); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]"
          >
            {["All", "Approved", "Subject for Approval", "Draft", "Rejected"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span className="text-sm text-slate-500">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>

          {someSelected && (
            <button
              type="button"
              onClick={handlePrintSelected}
              className="ml-auto flex items-center gap-2 rounded-lg bg-[#0a4f8f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]"
            >
              <Printer className="h-4 w-4" />
              Print Selected ({selectedCount})
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 accent-[#0a4f8f] cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Certified By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No certificates of employment found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((coe, idx) => {
                    const emp = employees.find((e) => e.employeeNo === coe.employeeNo);
                    const isSelected = selectedIds.has(coe.id);
                    return (
                      <tr
                        key={`${coe.id}-${idx}`}
                        className={`transition-colors ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/60"}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(coe.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-[#0a4f8f] cursor-pointer"
                            aria-label={`Select COE for ${coe.employeeName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{coe.employeeName}</div>
                          <div className="text-xs text-slate-400">{coe.employeeNo}{emp?.department ? ` · ${emp.department}` : ""}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{coe.purpose || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(coe.issueDate)}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{coe.certifiedByName || "—"}</div>
                          <div className="text-xs text-slate-400">{coe.certifiedByPosition || ""}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[coe.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {coe.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewCoe(coe)}
                            className="rounded-lg border border-[#0a4f8f33] bg-[#0a4f8f0d] px-3 py-1.5 text-xs font-semibold text-[#0a4f8f] transition hover:bg-[#0a4f8f] hover:text-white"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {someSelected && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
            <span className="text-blue-700 font-medium">{selectedCount} COE{selectedCount !== 1 ? "s" : ""} selected</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-blue-500 hover:text-blue-700 text-xs font-semibold"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={handlePrintSelected}
                className="flex items-center gap-1.5 rounded-lg bg-[#0a4f8f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0c3460]"
              >
                <Printer className="h-3.5 w-3.5" />
                Print {selectedCount} COE{selectedCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
