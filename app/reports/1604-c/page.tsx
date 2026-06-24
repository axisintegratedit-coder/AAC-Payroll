"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setConfigItem, setDataArray, getCollectionItems } from "@/lib/firestore";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { logAudit, getAuditsByEntity, formatAuditTimestamp, auditActionLabel, type AuditEntry } from "@/lib/auditTrail";

type PayrollRecord = {
  id?: string;
  payrollReference?: string;
  payrollDate?: string;
  payDate?: string;
  payoutDate?: string;
  datePaid?: string;
  periodEnd?: string;
  taxWithheld?: number | string;
  withholdingTax?: number | string;
  compensationTaxWithheld?: number | string;
  status?: string;
  archiveStatus?: "Active" | "Archived";
};

type CompanyInfo = {
  companyName?: string;
  tradeName?: string;
  address?: string;
  contactNumber?: string;
  emailAddress?: string;
  tin?: string;
  rdoCode?: string;
  zipCode?: string;
  category?: string;
  topWithholdingAgent?: string;
  authorizedSignatory?: string;
  authorizedSignatoryPosition?: string;
};

type MonthKey =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

type MonthlyRemittanceInput = {
  dateOfRemittance: string;
  draweeBank: string;
  referenceNumber: string;
  adjustment: string;
  penalties: string;
};

type Form1604CSettings = {
  amendedReturn: "Yes" | "No";
  sheetsAttached: string;
  reportFileName: string;
  revisionNumber: string;
  releasedRefunds: "Yes" | "No" | "N/A";
  refundDate: string;
  totalOverremittance: string;
  firstCreditingMonth: string;
  firstCreditingYear: string;
  remittances: Record<MonthKey, MonthlyRemittanceInput>;
};

type MonthSummary = {
  month: MonthKey;
  monthNumber: string;
  taxesWithheld: number;
  adjustment: number;
  penalties: number;
  totalAmountRemitted: number;
  dateOfRemittance: string;
  draweeBank: string;
  referenceNumber: string;
};

type Saved1601CReport = {
  id: string;
  month: string;
  monthLabel: string;
  coveragePeriod: string;
  companyName: string;
  tin: string;
  taxesWithheld: number;
  adjustment: number;
  penalties: number;
  totalAmountRemitted: number;
  dateRemitted: string;
  draweeBank: string;
  referenceNumber: string;
  savedAt: string;
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
  archivedAt?: string;
  archivedBy?: string;
};

const PAYROLL_STORAGE_KEYS = [
  "payrollRecords",
  "payrollRuns",
  "approvedPayrollRecords",
  "savedPayrollRecords",
];

const COMPANY_STORAGE_KEYS = ["companyInformation", "companyProfile"];
const SETTINGS_STORAGE_KEY = "form1604CSettings";

function getReadableAccentTextColor(accentColor: string, preferredTextColor: string) {
  const hex = accentColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return preferredTextColor || "#0f172a";
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.58 ? "#0f172a" : preferredTextColor || "#ffffff";
}

const MONTHS: MonthKey[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function money(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRecordDate(record: PayrollRecord): string {
  return (
    record.payDate ||
    record.payoutDate ||
    record.datePaid ||
    record.payrollDate ||
    record.periodEnd ||
    ""
  );
}

function getRecordYear(record: PayrollRecord): string {
  const rawDate = getRecordDate(record);
  if (!rawDate) return "";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getFullYear());
}

function getRecordMonthIndex(record: PayrollRecord): number {
  const rawDate = getRecordDate(record);
  if (!rawDate) return -1;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return -1;
  return date.getMonth();
}

function getTaxWithheld(record: PayrollRecord): number {
  return (
    money(record.taxWithheld) ||
    money(record.withholdingTax) ||
    money(record.compensationTaxWithheld)
  );
}

function isDeletedRecord(record: PayrollRecord): boolean {
  return String(record.status || "").toLowerCase().trim() === "deleted";
}

async function loadFirstAvailable<T>(keys: string[], fallback: T): Promise<T> {
  for (const key of keys) {
    const parsed = Array.isArray(fallback)
      ? await getDataArray<unknown>(key, []) as T | null
      : await getConfigItem<T | null>(key, null);
    if (parsed === null) continue;

    if (Array.isArray(fallback)) {
      if (Array.isArray(parsed)) return parsed as T;
    } else if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  }

  return fallback;
}

function createEmptyRemittanceInput(): MonthlyRemittanceInput {
  return {
    dateOfRemittance: "",
    draweeBank: "",
    referenceNumber: "",
    adjustment: "0",
    penalties: "0",
  };
}

function createDefaultRemittances(): Record<MonthKey, MonthlyRemittanceInput> {
  return MONTHS.reduce((accumulator, month) => {
    accumulator[month] = createEmptyRemittanceInput();
    return accumulator;
  }, {} as Record<MonthKey, MonthlyRemittanceInput>);
}

function createDefaultSettings(): Form1604CSettings {
  return {
    amendedReturn: "No",
    sheetsAttached: "0",
    reportFileName: "",
    revisionNumber: "",
    releasedRefunds: "N/A",
    refundDate: "",
    totalOverremittance: "0",
    firstCreditingMonth: "",
    firstCreditingYear: "",
    remittances: createDefaultRemittances(),
  };
}

async function load1604CSettings(): Promise<Form1604CSettings> {
  const defaults = createDefaultSettings();
  const parsed = await getConfigItem<Partial<Form1604CSettings> | null>(SETTINGS_STORAGE_KEY, null);

  if (!parsed) return defaults;

  return {
    ...defaults,
    ...parsed,
    remittances: {
      ...defaults.remittances,
      ...(parsed.remittances || {}),
    },
  };
}

function get1604CSettingsKey(year: string): string {
  return `${SETTINGS_STORAGE_KEY}-${year}`;
}

async function load1604CSettingsForYear(year: string): Promise<Form1604CSettings> {
  const defaults = createDefaultSettings();
  if (!year) return defaults;

  const parsed = await getConfigItem<Partial<Form1604CSettings> | null>(get1604CSettingsKey(year), null);

  if (!parsed) return defaults;

  return {
    ...defaults,
    ...parsed,
    remittances: {
      ...defaults.remittances,
      ...(parsed.remittances || {}),
    },
  };
}

function getAvailableYears(records: PayrollRecord[]): string[] {
  const years = new Set<string>();
  records.forEach((record) => {
    const year = getRecordYear(record);
    if (year) years.add(year);
  });

  if (years.size === 0) years.add(String(new Date().getFullYear()));
  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function getInternalCreditYear(selectedYear: string, storedCreditYear?: string): string {
  if (storedCreditYear) return storedCreditYear;
  const baseYear = Number(selectedYear || new Date().getFullYear());
  return Number.isFinite(baseYear) ? String(baseYear + 1) : "";
}

function getDefault1604CFileName(year: string, amendedReturn: "Yes" | "No", revisionNumber?: string): string {
  if (!year) return "1604-C Worksheet";
  const revisionLabel = amendedReturn === "Yes" && revisionNumber ? ` - Revision ${revisionNumber}` : " - Original";
  return `1604-C Tax Year ${year}${revisionLabel}`;
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return Promise.resolve();
}

export default function TaxInfo1604CPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({});
  const [settings, setSettings] = useState<Form1604CSettings>(createDefaultSettings());
  const [selectedYear, setSelectedYear] = useState("");
  const [saved1601CReports, setSaved1601CReports] = useState<Saved1601CReport[]>([]);
  const [saved1604CReports, setSaved1604CReports] = useState<Saved1604CReport[]>([]);
  const [saved1604CAuditEntries, setSaved1604CAuditEntries] = useState<Record<string, AuditEntry[]>>({});
  const [saved1604CView, setSaved1604CView] = useState<"Active" | "Archived">("Active");
  const [showAnnualDetails, setShowAnnualDetails] = useState(false);
  const [viewedSaved1604CReport, setViewedSaved1604CReport] = useState<Saved1604CReport | null>(null);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    async function load() {
    const payrollData = await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords);
    const activePayrollData = Array.isArray(payrollData)
      ? payrollData.filter((record) => record.archiveStatus !== "Archived")
      : [];
    const companyData = await getConfigItem<CompanyInfo>(storageKeys.companyInformation, {});
    const savedSettings = createDefaultSettings();

    const saved1601C = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
    const saved1604C = await getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []);

    setRecords(activePayrollData);
    setCompany(companyData || {});
    setSettings(savedSettings);
    setSelectedYear("");
    setSaved1601CReports(Array.isArray(saved1601C) ? saved1601C : []);
    setSaved1604CReports(Array.isArray(saved1604C) ? saved1604C.filter((report) => report.archiveStatus !== "Archived") : []);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadTheme() {
      const savedTheme = normalizeTheme(await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME));
      setTheme(savedTheme);
      applyAppTheme(savedTheme);
    }

    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    return () => {
      window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!selectedYear) return;

    async function saveSettings() {
    const settingsToSave = {
      ...settings,
      firstCreditingYear: getInternalCreditYear(selectedYear, settings.firstCreditingYear),
    };

    await setConfigItem(get1604CSettingsKey(selectedYear), settingsToSave);
    await setConfigItem(SETTINGS_STORAGE_KEY, settingsToSave);
    }

    saveSettings();
  }, [settings, selectedYear]);

  useEffect(() => {
    const handleSaved1601CReportsUpdated = async () => {
      const savedReports = await getDataArray<Saved1601CReport>(storageKeys.saved1601CReports, []);
      setSaved1601CReports(Array.isArray(savedReports) ? savedReports : []);
    };

    window.addEventListener("saved-1601c-reports-updated", handleSaved1601CReportsUpdated);
    return () => window.removeEventListener("saved-1601c-reports-updated", handleSaved1601CReportsUpdated);
  }, []);

  useEffect(() => {
    async function loadAuditEntries() {
      const entries = await Promise.all(
        saved1604CReports.map(async (report) => [report.id, await getAuditsByEntity("Report_1604C", report.id)] as const)
      );
      setSaved1604CAuditEntries(Object.fromEntries(entries));
    }

    loadAuditEntries();
  }, [saved1604CReports]);

  const availableYears = useMemo(() => getAvailableYears(records), [records]);

  const monthlySummaries = useMemo<MonthSummary[]>(() => {
    if (!selectedYear) {
      return MONTHS.map((month, index) => ({
        month,
        monthNumber: String(index + 1).padStart(2, "0"),
        taxesWithheld: 0,
        adjustment: 0,
        penalties: 0,
        totalAmountRemitted: 0,
        dateOfRemittance: "",
        draweeBank: "",
        referenceNumber: "",
      }));
    }
    return MONTHS.map((month, index) => {
      const remittance = settings.remittances[month] || createEmptyRemittanceInput();
      const monthKey = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
      const savedReport = saved1601CReports.find((report) => report.month === monthKey);
      const taxesWithheld = savedReport?.taxesWithheld || 0;
      const adjustment = savedReport?.adjustment ?? money(remittance.adjustment);
      const penalties = savedReport?.penalties ?? money(remittance.penalties);

      return {
        month,
        monthNumber: String(index + 1).padStart(2, "0"),
        taxesWithheld,
        adjustment,
        penalties,
        totalAmountRemitted: savedReport?.totalAmountRemitted ?? taxesWithheld + adjustment + penalties,
        dateOfRemittance: savedReport?.dateRemitted || remittance.dateOfRemittance,
        draweeBank: savedReport?.draweeBank || remittance.draweeBank,
        referenceNumber: savedReport?.referenceNumber || remittance.referenceNumber,
      };
    });
  }, [selectedYear, settings.remittances, saved1601CReports]);

  const totals = useMemo(() => {
    return monthlySummaries.reduce(
      (accumulator, month) => ({
        taxesWithheld: accumulator.taxesWithheld + month.taxesWithheld,
        adjustment: accumulator.adjustment + month.adjustment,
        penalties: accumulator.penalties + month.penalties,
        totalAmountRemitted: accumulator.totalAmountRemitted + month.totalAmountRemitted,
      }),
      {
        taxesWithheld: 0,
        adjustment: 0,
        penalties: 0,
        totalAmountRemitted: 0,
      }
    );
  }, [monthlySummaries]);

  const employeeCount = useMemo(() => {
    const employeeKeys = new Set<string>();
    records.forEach((record) => {
      if (isDeletedRecord(record)) return;
      if (record.archiveStatus === "Archived") return;
      if (getRecordYear(record) !== selectedYear) return;
      const key = record.id || record.payrollReference || JSON.stringify(record);
      employeeKeys.add(key);
    });
    return employeeKeys.size;
  }, [records, selectedYear]);

  function updateSetting<K extends keyof Form1604CSettings>(key: K, value: Form1604CSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function handleYearChange(year: string) {
    setSelectedYear(year);
    setSettings(year ? await load1604CSettingsForYear(year) : createDefaultSettings());
    setViewedSaved1604CReport(null);
  }

  function updateRemittance(month: MonthKey, key: keyof MonthlyRemittanceInput, value: string) {
    setSettings((current) => ({
      ...current,
      remittances: {
        ...current.remittances,
        [month]: {
          ...(current.remittances[month] || createEmptyRemittanceInput()),
          [key]: value,
        },
      },
    }));
  }

  // copyAllValues removed

  async function loadSaved1604CReports(view: "Active" | "Archived" = saved1604CView): Promise<Saved1604CReport[]> {
    const savedReports = await getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []);
    if (!Array.isArray(savedReports)) return [];

    return savedReports.filter((report) =>
      view === "Archived" ? report.archiveStatus === "Archived" : report.archiveStatus !== "Archived"
    );
  }

  async function switchSaved1604CView(nextView: "Active" | "Archived") {
    setSaved1604CView(nextView);
    setSaved1604CReports(await loadSaved1604CReports(nextView));
    setViewedSaved1604CReport(null);
  }

  function buildSaved1604CReport(): Saved1604CReport | null {
    if (!selectedYear) {
      window.alert("Please select a year before saving the 1604-C worksheet.");
      return null;
    }

    const fileName = settings.reportFileName.trim() || getDefault1604CFileName(selectedYear, settings.amendedReturn, settings.revisionNumber);

    return {
      id: `${selectedYear}-${Date.now()}`,
      year: selectedYear,
      companyName: company.companyName || "",
      tin: company.tin || "",
      fileName,
      revisionNumber: settings.revisionNumber,
      amendedReturn: settings.amendedReturn,
      sheetsAttached: settings.sheetsAttached,
      releasedRefunds: settings.releasedRefunds,
      refundDate: settings.refundDate,
      totalOverremittance: settings.totalOverremittance,
      firstCreditingMonth: settings.firstCreditingMonth,
      firstCreditingYear: getInternalCreditYear(selectedYear, settings.firstCreditingYear),
      monthlySummaries,
      totals,
      savedAt: new Date().toISOString(),
    };
  }

  function build1604CExcelContent(report: Saved1604CReport): string {
    const rowsHtml = report.monthlySummaries
      .map(
        (row) => `
          <tr>
            <td>${row.month}</td>
            <td>${row.dateOfRemittance || ""}</td>
            <td>${row.draweeBank || ""}</td>
            <td>${row.referenceNumber || ""}</td>
            <td style="text-align:right;">${formatMoney(row.taxesWithheld)}</td>
            <td style="text-align:right;">${formatMoney(row.adjustment)}</td>
            <td style="text-align:right;">${formatMoney(row.penalties)}</td>
            <td style="text-align:right;">${formatMoney(row.totalAmountRemitted)}</td>
          </tr>`
      )
      .join("");

    return `
      <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
            th, td { border: 1px solid #999; padding: 8px; vertical-align: top; }
            th { background: #e5e7eb; font-weight: bold; }
            .title { font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="8" class="title">BIR Form 1604-C Worksheet</td></tr>
            <tr><td>File Name</td><td colspan="7">${report.fileName}</td></tr>
            <tr><td>Year</td><td colspan="7">${report.year}</td></tr>
            <tr><td>Company Name</td><td colspan="7">${report.companyName}</td></tr>
            <tr><td>TIN</td><td colspan="7">${report.tin}</td></tr>
            <tr><td>Amended Return?</td><td colspan="7">${report.amendedReturn}</td></tr>
            <tr><td>Number of Sheet/s Attached</td><td colspan="7">${report.sheetsAttached}</td></tr>
            <tr><td>Released refund/s to employee/s?</td><td colspan="7">${report.releasedRefunds}</td></tr>
            <tr><td>Refund Date</td><td colspan="7">${report.refundDate}</td></tr>
            <tr><td>Total Overremittance</td><td colspan="7">${report.totalOverremittance}</td></tr>
            <tr><td>Month of First Crediting</td><td colspan="7">${report.firstCreditingMonth}</td></tr>
            <tr><td>Internal Credit Year</td><td colspan="7">${report.firstCreditingYear}</td></tr>
            <tr><td colspan="8"></td></tr>
            <tr>
              <th>Month</th>
              <th>Date of Remittance</th>
              <th>Drawee Bank / Bank Code / Agency</th>
              <th>TRA/eROR/eAR Number</th>
              <th>Taxes Withheld</th>
              <th>Adjustment</th>
              <th>Penalties</th>
              <th>Total Amount Remitted</th>
            </tr>
            ${rowsHtml}
            <tr>
              <th colspan="4">TOTAL</th>
              <th style="text-align:right;">${formatMoney(report.totals.taxesWithheld)}</th>
              <th style="text-align:right;">${formatMoney(report.totals.adjustment)}</th>
              <th style="text-align:right;">${formatMoney(report.totals.penalties)}</th>
              <th style="text-align:right;">${formatMoney(report.totals.totalAmountRemitted)}</th>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  function download1604CExcelReport(report: Saved1604CReport) {
    const excelContent = build1604CExcelContent(report);
    const blob = new Blob([excelContent], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeFileName = (report.fileName || `1604C-${report.year}`).replace(/[^a-z0-9-_ ]/gi, "_");
    link.download = `${safeFileName}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function save1604CReport() {
    const nextReport = buildSaved1604CReport();
    if (!nextReport) return;

    const savedReports = await getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []);
    const activeNextReport = {
      ...nextReport,
      archiveStatus: "Active" as const,
    };
    const nextReports = [
      ...(Array.isArray(savedReports) ? savedReports : []),
      activeNextReport,
    ].sort((a, b) => {
      const yearDifference = Number(b.year) - Number(a.year);
      if (yearDifference !== 0) return yearDifference;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    await setDataArray(storageKeys.saved1604CReports, nextReports);
    setSaved1604CView("Active");
    setSaved1604CReports(nextReports.filter((report) => report.archiveStatus !== "Archived"));
    setViewedSaved1604CReport(activeNextReport);
    logAudit({ action: "SAVED", entityType: "Report_1604C", entityId: activeNextReport.id, entityName: `1604-C Tax Year ${activeNextReport.year}` });
    window.alert("1604-C worksheet saved. It is ready for viewing and Excel download.");
  }

  function export1604CExcelReport() {
    const report = buildSaved1604CReport();
    if (!report) return;
    logAudit({ action: "EXPORTED", entityType: "Report_1604C", entityId: report.id, entityName: `1604-C Tax Year ${report.year}`, details: "Excel export" });
    download1604CExcelReport(report);
  }

  async function archiveSaved1604CReport(report: Saved1604CReport) {
    const confirmed = window.confirm(
      `Archive the saved 1604-C worksheet "${report.fileName || `1604-C Tax Year ${report.year}`}"? It will be hidden from active files but kept for audit trail.`
    );

    if (!confirmed) return;

    const currentReports = await getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []);
    const now = new Date().toISOString();
    const nextReports = Array.isArray(currentReports)
      ? currentReports.map((savedReport) => {
          if (savedReport.id !== report.id) return savedReport;

          return {
            ...savedReport,
            archiveStatus: "Archived" as const,
            archivedAt: now,
            archivedBy: "Current User",
          };
        })
      : [];

    await setDataArray(storageKeys.saved1604CReports, nextReports);
    setSaved1604CReports(nextReports.filter((savedReport) => savedReport.archiveStatus !== "Archived"));

    if (viewedSaved1604CReport?.id === report.id) {
      setViewedSaved1604CReport(null);
    }

    logAudit({ action: "ARCHIVED", entityType: "Report_1604C", entityId: report.id, entityName: `1604-C Tax Year ${report.year}` });
    window.alert("Saved 1604-C worksheet archived.");
  }

  async function restoreSaved1604CReport(report: Saved1604CReport) {
    const confirmed = window.confirm(
      `Restore the saved 1604-C worksheet "${report.fileName || `1604-C Tax Year ${report.year}`}"? It will appear again in active files.`
    );

    if (!confirmed) return;

    const currentReports = await getDataArray<Saved1604CReport>(storageKeys.saved1604CReports, []);
    const nextReports = Array.isArray(currentReports)
      ? currentReports.map((savedReport) => {
          if (savedReport.id !== report.id) return savedReport;

          return {
            ...savedReport,
            archiveStatus: "Active" as const,
            archivedAt: undefined,
            archivedBy: undefined,
          };
        })
      : [];

    await setDataArray(storageKeys.saved1604CReports, nextReports);
    setSaved1604CReports(nextReports.filter((savedReport) => savedReport.archiveStatus === "Archived"));

    if (viewedSaved1604CReport?.id === report.id) {
      setViewedSaved1604CReport(null);
    }

    logAudit({ action: "RESTORED", entityType: "Report_1604C", entityId: report.id, entityName: `1604-C Tax Year ${report.year}` });
    window.alert("Saved 1604-C worksheet restored.");
  }

  const activeTheme = normalizeTheme(theme);
  const accentButtonTextColor = getReadableAccentTextColor(activeTheme.accentColor, activeTheme.bannerButtonTextColor);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle = {
    backgroundColor: activeTheme.bannerColor,
    backgroundImage: activeTheme.bannerImageDataUrl
      ? `linear-gradient(${activeTheme.bannerColor}${bannerOverlayAlpha}, ${activeTheme.bannerColor}${bannerOverlayAlpha}), url(${activeTheme.bannerImageDataUrl})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <main
      className="axis-1604c-page min-h-screen px-4 py-5 text-slate-950 sm:px-6 lg:px-8"
      style={{
        "--report-banner": activeTheme.bannerColor,
        "--report-accent": activeTheme.accentColor,
        "--report-button-text": accentButtonTextColor,
      } as CSSProperties}
    >
      <style>{`
        .axis-1604c-page {
          background: linear-gradient(180deg, var(--report-banner) 0%, var(--report-banner) 290px, #f4f8fc 290px, #f4f8fc 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .axis-1604c-page > div > section:not(.axis-1604c-hero) {
          border: 1px solid rgba(255,255,255,0.88) !important;
          background: rgba(255,255,255,0.96) !important;
          border-radius: 16px !important;
          box-shadow: 0 14px 38px -32px rgba(8,47,73,0.78) !important;
        }

        .axis-1604c-page input,
        .axis-1604c-page select,
        .axis-1604c-page textarea {
          border-color: #dbe4ef !important;
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .axis-1604c-page button {
          border-radius: 10px !important;
          box-shadow: 0 10px 24px -22px rgba(8,47,73,0.75);
        }

        .axis-1604c-page table {
          border-collapse: separate !important;
          border-spacing: 0 !important;
          background: #ffffff;
        }

        .axis-1604c-page thead,
        .axis-1604c-page thead tr {
          background: #f8fafc !important;
        }

        .axis-1604c-page th {
          border-bottom: 1px solid #dbe4ef !important;
          color: #475569 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          letter-spacing: 0.02em !important;
        }

        .axis-1604c-page td {
          border-color: #e6edf5 !important;
          font-size: 12px !important;
        }

        .axis-1604c-page tbody tr:hover {
          background: #f0f9ff !important;
        }

        .axis-1604c-page .bg-blue-700,
        .axis-1604c-page .hover\\:bg-blue-800:hover {
          background-color: var(--report-accent) !important;
          color: var(--report-button-text) !important;
        }

        .axis-1604c-page .text-blue-700,
        .axis-1604c-page .text-blue-800,
        .axis-1604c-page .text-blue-900,
        .axis-1604c-page .text-blue-950 {
          color: var(--report-accent) !important;
        }

        .axis-1604c-page .border-blue-100,
        .axis-1604c-page .border-blue-200,
        .axis-1604c-page .border-blue-700 {
          border-color: color-mix(in srgb, var(--report-accent) 28%, #dbe4ef) !important;
        }

        .axis-1604c-page .bg-blue-50 {
          background-color: color-mix(in srgb, var(--report-accent) 9%, #ffffff) !important;
        }

        @media print {
          * { overflow: visible !important; max-height: none !important; height: auto !important; }
          header { display: none !important; }
          .axis-1604c-page {
            background: white !important;
            padding: 8px !important;
            min-height: 0 !important;
          }
          .axis-1604c-page > div { gap: 16px !important; }
          .axis-1604c-page button { display: none !important; }
          .axis-1604c-page .axis-1604c-hero {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
      <div className="mx-auto grid max-w-7xl gap-6">
        <section
          className="axis-1604c-hero relative overflow-hidden rounded-2xl border px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderColor: `${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${activeTheme.accentColor}24`, border: `0.5px solid ${activeTheme.accentColor}66`, color: activeTheme.bannerTextColor }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: activeTheme.accentColor }} />
                  Tax Reports
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold" style={{ color: activeTheme.bannerTextColor }}>
                  Annual Withholding
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Tax Info on 1604-C</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">
                Review the annual filing summary from saved monthly 1601-C worksheets.
              </p>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Tax Year</p>
                <p className="mt-1 font-semibold">{selectedYear || "Select"}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">1601-C Files</p>
                <p className="mt-1 font-semibold">{saved1601CReports.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Saved 1604-C</p>
                <p className="mt-1 font-semibold">{saved1604CReports.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">1604-C Workflow</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">Complete this annual report in four stages</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                The page flows from top to bottom, so the user knows what to review first and what to save last.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
              Current stage: {selectedYear ? "Review and finalize" : "Select tax year"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                step: "01",
                title: "Choose year",
                desc: "Select the tax year to pull saved 1601-C monthly summaries.",
                active: !selectedYear,
              },
              {
                step: "02",
                title: "Set annual details",
                desc: "Complete file name, amendment, attachments, and refund details.",
                active: Boolean(selectedYear),
              },
              {
                step: "03",
                title: "Review remittances",
                desc: "Check the monthly 1601-C remittance totals and annual totals.",
                active: Boolean(selectedYear),
              },
              {
                step: "04",
                title: "Save or export",
                desc: "Save the annual worksheet or export it as Excel.",
                active: Boolean(selectedYear),
              },
            ].map((stage) => (
              <div
                key={stage.step}
                className={`rounded-[22px] border p-4 transition ${stage.active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-black ${stage.active ? "bg-blue-700 text-white" : "bg-white text-slate-500"}`}>
                    {stage.step}
                  </span>
                  <p className="font-black text-slate-950">{stage.title}</p>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{stage.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Worksheet Actions Bar */}
        <section className="rounded-[28px] border border-blue-200 border-l-8 border-l-blue-700 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Worksheet Actions</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Save or export after reviewing the report</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                These actions are placed here so the banner stays clean while still keeping the final step easy to find.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={save1604CReport}
                className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800"
              >
                Save 1604-C File
              </button>
              <button
                onClick={export1604CExcelReport}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Export Worksheet
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-l-8 border-l-blue-700 pl-4 lg:grid-cols-5" aria-label="Step 1 tax year and annual totals">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Step 1 • Tax Year</p>
            <select
              value={selectedYear}
              onChange={(event) => handleYearChange(event.target.value)}
              className="mt-3 w-full rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select year</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <SummaryCard label="Total Taxes Withheld" value={`₱${formatMoney(totals.taxesWithheld)}`} tone="green" />
          <SummaryCard label="Total Adjustments" value={`₱${formatMoney(totals.adjustment)}`} tone="indigo" />
          <SummaryCard label="Total Penalties" value={`₱${formatMoney(totals.penalties)}`} tone="amber" />
          <SummaryCard label="Total Amount Remitted" value={`₱${formatMoney(totals.totalAmountRemitted)}`} tone="blue" />
        </section>

        <section className="rounded-[32px] border border-slate-200 border-t-4 border-t-slate-400 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                Information Section
              </div>
              <h2 className="text-xl font-black">Part I - Background Information</h2>
              <p className="mt-1 text-sm text-slate-600">Company information is pulled from your Company Profile page.</p>
            </div>
            <div className="text-right text-xs font-bold uppercase tracking-wide text-slate-500">For BIR Form 1604-C</div>
          </div>

          {!selectedYear ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Select a tax year first to load annual filing details and remittance values.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <InfoBox label="TIN" value={company.tin || "Not set"} />
              <InfoBox label="RDO Code" value={company.rdoCode || "Not set"} />
              <InfoBox label="Withholding Agent Name" value={company.companyName || "Not set"} />
              <InfoBox label="Registered Address" value={company.address || "Not set"} wide />
              <InfoBox label="Contact Number" value={company.contactNumber || "Not set"} />
              <InfoBox label="Email Address" value={company.emailAddress || "Not set"} />
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-amber-200 border-l-8 border-l-amber-500 bg-white p-6 shadow-sm">
          <div className="mb-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Editable Annual Details
          </div>
          <h2 className="text-xl font-black">Step 2 • Annual Filing Details</h2>
          <p className="mt-1 text-sm text-slate-600">Complete only what is needed. Optional annual details are tucked into simple cards so the page stays clean.</p>
          <button
            type="button"
            onClick={() => setShowAnnualDetails((current) => !current)}
            className="mt-4 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {showAnnualDetails ? "Hide annual detail fields" : "Show annual detail fields"}
          </button>

          {!selectedYear ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Select a tax year first to load annual filing details and remittance values.
            </div>
          ) : showAnnualDetails ? (
          <div className="mt-5 grid gap-5">
            <div className="rounded-[26px] border border-blue-100 bg-blue-50/40 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Step 1</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">File Identification</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Use this area to name the annual 1604-C file and mark whether it is the original or a revision.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm">Required</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Saved File Name</span>
              <input
                value={settings.reportFileName}
                onChange={(event) => updateSetting("reportFileName", event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder={getDefault1604CFileName(selectedYear, settings.amendedReturn, settings.revisionNumber)}
              />
              <span className="text-xs font-semibold text-slate-500">Use this to distinguish original files from revised/amended versions.</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Amended Return?</span>
              <select
                value={settings.amendedReturn}
                onChange={(event) => updateSetting("amendedReturn", event.target.value as "Yes" | "No")}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-slate-700">Revision No. / Version</span>
              <input
                value={settings.revisionNumber}
                onChange={(event) => updateSetting("revisionNumber", event.target.value)}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                placeholder="Example: 1, 2, Final"
              />
            </label>

              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Step 2</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">Attachments</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Enter the number of sheets attached to the official 1604-C filing. This can later match your Alphalist attachment count.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Number of Sheet/s Attached</span>
                  <input
                    value={settings.sheetsAttached}
                    onChange={(event) => updateSetting("sheetsAttached", event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    placeholder="0"
                  />
                  <span className="text-xs font-semibold text-slate-500">Official Item 3. Later, this can be auto-filled from the Alphalist attachment count.</span>
                </label>
              </div>
            </div>

            <div className="rounded-[26px] border border-amber-200 bg-amber-50/40 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Step 3</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">Refund / Overremittance Details</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Fill this only when the employer released refunds or has overremittance to credit. Leave as N/A and zero when not applicable.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-amber-700 shadow-sm">Conditional</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Released refund/s to employee/s?</span>
                  <select
                    value={settings.releasedRefunds}
                    onChange={(event) => updateSetting("releasedRefunds", event.target.value as "Yes" | "No" | "N/A")}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="N/A">N/A</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Refund Date</span>
                  <input
                    type="date"
                    value={settings.refundDate}
                    onChange={(event) => updateSetting("refundDate", event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Total Overremittance on Tax Withheld</span>
                  <input
                    value={settings.totalOverremittance}
                    onChange={(event) => updateSetting("totalOverremittance", event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    placeholder="0.00"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">Month of First Crediting of Overremittance</span>
                  <select
                    value={settings.firstCreditingMonth}
                    onChange={(event) => updateSetting("firstCreditingMonth", event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select month</option>
                    {MONTHS.map((month, index) => (
                      <option key={month} value={String(index + 1).padStart(2, "0")}>{month}</option>
                    ))}
                  </select>
                  <span className="text-xs font-semibold text-slate-500">Official 1604-C requires month only.</span>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">System Credit Year</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">
                    {getInternalCreditYear(selectedYear, settings.firstCreditingYear)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Auto-used by the system for the future 1601-C credit. This is not an official 1604-C field.
                  </p>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              Annual detail fields are hidden to keep the page clean. Click “Show annual detail fields” when you need to edit file name, attachments, refund, or overremittance details.
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-[32px] border border-emerald-200 border-l-8 border-l-emerald-600 bg-white shadow-sm">
          <div className="border-b border-emerald-100 bg-emerald-50/40 p-6">
            <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700 shadow-sm">
              Generated Summary Table
            </div>
            <h2 className="text-xl font-black">Step 3 • Summary of Remittances per BIR Form 1601-C</h2>
            <p className="mt-1 text-sm text-slate-600">Values are pulled from saved 1601-C monthly worksheets. To update a month, go back to 1601-C, enter the remittance details, then click Save for 1604-C.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Date of Remittance</th>
                  <th className="px-4 py-3">Drawee Bank / Bank Code / Agency</th>
                  <th className="px-4 py-3">TRA/eROR/eAR Number</th>
                  <th className="px-4 py-3 text-right">Taxes Withheld</th>
                  <th className="px-4 py-3 text-right">Adjustment</th>
                  <th className="px-4 py-3 text-right">Penalties</th>
                  <th className="px-4 py-3 text-right">Total Amount Remitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {monthlySummaries.map((row) => (
                  <tr key={row.month} className="align-top">
                    <td className="px-4 py-3 font-bold text-slate-950">{row.month}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{row.dateOfRemittance || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{row.draweeBank || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{row.referenceNumber || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(row.taxesWithheld)}</td>
                    <td className="px-4 py-3">
                      <span className="block w-32 text-right font-semibold text-slate-900">{formatMoney(row.adjustment)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block w-32 text-right font-semibold text-slate-900">{formatMoney(row.penalties)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-950">{formatMoney(row.totalAmountRemitted)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-950">
                <tr>
                  <td className="px-4 py-4" colSpan={4}>TOTAL</td>
                  <td className="px-4 py-4 text-right">{formatMoney(totals.taxesWithheld)}</td>
                  <td className="px-4 py-4 text-right">{formatMoney(totals.adjustment)}</td>
                  <td className="px-4 py-4 text-right">{formatMoney(totals.penalties)}</td>
                  <td className="px-4 py-4 text-right">{formatMoney(totals.totalAmountRemitted)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="rounded-[32px] border border-purple-200 border-l-8 border-l-purple-600 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-purple-100 bg-purple-50/40 -m-6 mb-0 rounded-t-[32px] p-6 pb-5">
            <div className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700 shadow-sm">
              Saved / View-Only Files
            </div>
            <h2 className="text-xl font-black text-slate-950">Step 4 • Saved 1604-C Files</h2>
            <p className="text-sm text-slate-600">
              Saved annual worksheets are ready for viewing and Excel download.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchSaved1604CView("Active")}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${saved1604CView === "Active" ? "border-blue-700 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Active Files
            </button>
            <button
              type="button"
              onClick={() => switchSaved1604CView("Archived")}
              className={`rounded-full border px-4 py-2 text-sm font-black transition ${saved1604CView === "Archived" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Archive Tab
            </button>
          </div>

          {saved1604CReports.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
              {saved1604CView === "Archived"
                ? "No archived 1604-C files yet. Archived worksheets will appear here for audit trail."
                : "No saved 1604-C files yet. Select a year, review the monthly remittance summary, then click Save 1604-C File."}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {saved1604CReports.map((report) => {
                const auditEntries = saved1604CAuditEntries[report.id] ?? [];
                return (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-black text-slate-950">{report.fileName || `1604-C Tax Year ${report.year}`}</p>
                      <p className="text-sm text-slate-600">
                        Taxes withheld: ₱{formatMoney(report.totals.taxesWithheld)} • Total remitted: ₱{formatMoney(report.totals.totalAmountRemitted)} • Saved {new Date(report.savedAt).toLocaleString("en-PH")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setViewedSaved1604CReport(report);
                          setTimeout(() => {
                            document.getElementById("saved-1604c-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 50);
                        }}
                        className="rounded-[14px] border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-100"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          logAudit({ action: "EXPORTED", entityType: "Report_1604C", entityId: report.id, entityName: `1604-C Tax Year ${report.year}`, details: "Excel export (saved file)" });
                          download1604CExcelReport(report);
                        }}
                        className="rounded-[14px] bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                      >
                        Download Excel
                      </button>
                      {saved1604CView === "Active" ? (
                        <button
                          onClick={() => archiveSaved1604CReport(report)}
                          className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-700 shadow-sm transition hover:bg-amber-100"
                        >
                          Archive
                        </button>
                      ) : (
                        <button
                          onClick={() => restoreSaved1604CReport(report)}
                          className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                  {auditEntries.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Audit Trail</p>
                      <ol className="flex flex-col gap-1.5">
                        {auditEntries.map((e: AuditEntry) => (
                          <li key={e.id} className="flex items-start gap-2 text-xs">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                            <span className="font-semibold text-slate-700">{auditActionLabel(e.action)}</span>
                            {e.details && <span className="text-slate-500">· {e.details}</span>}
                            <span className="text-slate-400">{formatAuditTimestamp(e.timestamp)} · {e.performedBy}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {viewedSaved1604CReport && (
            <div id="saved-1604c-view" className="mt-5 rounded-[24px] border border-purple-300 border-l-8 border-l-purple-700 bg-white p-5 shadow-sm ring-4 ring-purple-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
                    View Mode Only
                  </div>
                  <h3 className="text-lg font-black text-purple-950">
                    Viewing {viewedSaved1604CReport.fileName || `1604-C Tax Year ${viewedSaved1604CReport.year}`}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-purple-800">
                    Saved {new Date(viewedSaved1604CReport.savedAt).toLocaleString("en-PH")} • This section is read-only and does not edit the generated table above.
                  </p>
                </div>
                <button
                  onClick={() => setViewedSaved1604CReport(null)}
                  className="rounded-[14px] border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-900 shadow-sm transition hover:bg-blue-100"
                >
                  Close View
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="Revision / Version" value={viewedSaved1604CReport.revisionNumber || "Original"} />
                <InfoBox label="Total Taxes Withheld" value={`₱${formatMoney(viewedSaved1604CReport.totals.taxesWithheld)}`} />
                <InfoBox label="Total Adjustments" value={`₱${formatMoney(viewedSaved1604CReport.totals.adjustment)}`} />
                <InfoBox label="Total Penalties" value={`₱${formatMoney(viewedSaved1604CReport.totals.penalties)}`} />
                <InfoBox label="Total Amount Remitted" value={`₱${formatMoney(viewedSaved1604CReport.totals.totalAmountRemitted)}`} />
              </div>

              <div className="mt-5 overflow-hidden rounded-[24px] border border-purple-200 bg-white shadow-sm">
                <div className="border-b border-purple-100 bg-purple-50/60 p-5">
                  <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700 shadow-sm">
                    Saved Snapshot
                  </div>
                  <h4 className="text-lg font-black text-slate-950">Saved Summary of Remittances</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    View-only snapshot based on the saved 1604-C file. This table mirrors the generated Step 3 summary and cannot be edited here.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Month</th>
                        <th className="px-4 py-3">Date of Remittance</th>
                        <th className="px-4 py-3">Drawee Bank / Bank Code / Agency</th>
                        <th className="px-4 py-3">TRA/eROR/eAR Number</th>
                        <th className="px-4 py-3 text-right">Taxes Withheld</th>
                        <th className="px-4 py-3 text-right">Adjustment</th>
                        <th className="px-4 py-3 text-right">Penalties</th>
                        <th className="px-4 py-3 text-right">Total Amount Remitted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {viewedSaved1604CReport.monthlySummaries.map((row) => (
                        <tr key={`${viewedSaved1604CReport.id}-${row.month}`} className="align-top">
                          <td className="px-4 py-3 font-bold text-slate-950">{row.month}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900">{row.dateOfRemittance || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900">{row.draweeBank || "—"}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900">{row.referenceNumber || "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{formatMoney(row.taxesWithheld)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.adjustment)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.penalties)}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-950">{formatMoney(row.totalAmountRemitted)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-950">
                      <tr>
                        <td className="px-4 py-4" colSpan={4}>TOTAL</td>
                        <td className="px-4 py-4 text-right">{formatMoney(viewedSaved1604CReport.totals.taxesWithheld)}</td>
                        <td className="px-4 py-4 text-right">{formatMoney(viewedSaved1604CReport.totals.adjustment)}</td>
                        <td className="px-4 py-4 text-right">{formatMoney(viewedSaved1604CReport.totals.penalties)}</td>
                        <td className="px-4 py-4 text-right">{formatMoney(viewedSaved1604CReport.totals.totalAmountRemitted)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[32px] border border-blue-200 bg-white p-5 text-sm leading-6 text-blue-950 shadow-sm">
          <p className="font-black">Year-end tax adjustments</p>
          <p className="mt-1">
            1604-C includes refund/overremittance information after year-end adjustment. The detailed employee-by-employee year-end adjustment belongs in the Alphalist and BIR Form 2316, while this page summarizes the employer-level annual remittance totals.
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "green" | "indigo" | "amber" | "blue" }) {
  const toneClasses = {
    green: "border-emerald-200 bg-white text-emerald-700 shadow-sm",
    indigo: "border-indigo-200 bg-white text-indigo-700 shadow-sm",
    amber: "border-amber-200 bg-white text-amber-700 shadow-sm",
    blue: "border-blue-200 bg-white text-blue-700 shadow-sm",
  };

  return (
    <div className={`rounded-[24px] border p-5 ${toneClasses[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-2 text-[22px] font-black leading-tight">{value}</p>
    </div>
  );
}

function InfoBox({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm ${wide ? "lg:col-span-2" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
}
