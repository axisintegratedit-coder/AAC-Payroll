"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { getCurrentAdminUser } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";

type Employee = {
  employeeNo: string;
  lastName: string;
  firstName: string;
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
  employeePhotoDataUrl?: string;
};

type CompanyProfile = {
  companyName?: string;
  registeredName?: string;
  businessName?: string;
  tradeName?: string;
  employerName?: string;
  companyAddress?: string;
  registeredAddress?: string;
  businessAddress?: string;
  address?: string;
  logoDataUrl?: string;
  companyLogoDataUrl?: string;
  logo?: string;
  email?: string;
  emailAddress?: string;
  contactNumber?: string;
  authorizedSignatory?: string;
  authorizedSignatoryPosition?: string;
  payrollOfficer?: string;
};

type Signatories = {
  coeSignatoryName?: string;
  coeSignatoryPosition?: string;
  certifiedByName?: string;
  certifiedByPosition?: string;
  preparedByName?: string;
  preparedByPosition?: string;
  checkedByName?: string;
  checkedByPosition?: string;
  approvedByName?: string;
  approvedByPosition?: string;
  authorizedRepName?: string;
  authorizedRepPosition?: string;
  authorizedRepTin?: string;
  authorizedRepresentativeName?: string;
  authorizedRepresentativePosition?: string;
  preparedBySignature?: string;
  checkedBySignature?: string;
  approvedBySignature?: string;
  authorizedRepSignature?: string;
  signatureDataUrl?: string;
  coeSignatureDataUrl?: string;
};

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
  submittedByName?: string;
  submittedByEmail?: string;
  submittedByUid?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedByUid?: string;
  rejectedAt?: string;
  rejectedByName?: string;
  rejectedByEmail?: string;
  rejectedByUid?: string;
  archivedAt?: string;
  archivedByName?: string;
  archivedByEmail?: string;
  archivedByUid?: string;
};

const PURPOSE_OPTIONS = [
  "Employment Verification",
  "School Requirement",
  "Credit Card Application",
  "Bank Loan Application",
  "Visa / Travel Requirement",
  "New Employment Requirement",
  "Government Requirement",
  "Personal Record",
  "Others",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value || 0);
}


function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function formatDateTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPlainMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getEmployeeAllowanceRows(employee?: Employee | null) {
  if (!employee) return [];

  const allowanceDefinitions = [
    { label: "Rice Subsidy", monthly: Number(employee.riceSubsidy) || 0 },
    { label: "Uniform / Clothing Allowance", monthly: Number(employee.uniformClothingAllowance) || 0 },
    { label: "Laundry Allowance", monthly: Number(employee.laundryAllowance) || 0 },
    { label: "Actual Medical Assistance", monthly: Number(employee.actualMedicalAssistance) || 0 },
    { label: "Medical Cash Allowance to Dependents", monthly: Number(employee.medicalCashAllowanceToDependents) || 0 },
    { label: "Meal Allowance", monthly: Number(employee.mealAllowance) || 0 },
    { label: "Christmas / Anniversary Gifts", monthly: Number(employee.christmasAnniversaryGifts) || 0 },
    { label: "Achievement Awards", monthly: Number(employee.achievementAwards) || 0 },
    {
      label: employee.otherAllowanceName?.trim() || "Other Allowance",
      monthly: Number(employee.otherAllowanceAmount) || 0,
    },
  ];

  return allowanceDefinitions
    .filter((allowance) => allowance.monthly > 0)
    .map((allowance) => ({
      label: allowance.label,
      monthly: allowance.monthly,
      annual: allowance.monthly * 12,
    }));
}

function getFullName(employee?: Employee | null) {
  if (!employee) return "";
  return [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(", ");
}

function getFormalName(employee?: Employee | null) {
  if (!employee) return "";
  return [employee.firstName, employee.middleName, employee.lastName]
    .filter(Boolean)
    .join(" ");
}

function getPossessiveLastName(employee?: Employee | null) {
  const lastName = employee?.lastName || "Employee";
  return `${lastName}${lastName.toLowerCase().endsWith("s") ? "'" : "'s"}`;
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function generateTicketNumber() {
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  const datePart = new Date().getTime().toString().slice(-5);
  return `COE-${datePart}-${randomPart}`;
}

function getReadableAccentTextColor(accentColor: string, preferredTextColor: string) {
  const hex = accentColor.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return preferredTextColor || "#0f172a";

  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.58 ? "#0f172a" : preferredTextColor || "#ffffff";
}


function getPreferredSignatorySource(signatories: Signatories) {
  if (signatories.approvedByName?.trim()) return "approved";
  if (signatories.authorizedRepName?.trim() || signatories.authorizedRepresentativeName?.trim()) {
    return "authorizedRepresentative";
  }
  if (signatories.checkedByName?.trim()) return "checked";
  if (signatories.preparedByName?.trim()) return "prepared";
  return "custom";
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAuditUserFallback() {
  const currentUser = getCurrentAdminUser();

  return {
    name: currentUser?.name || "Unknown User",
    email: currentUser?.email || "Unknown Email",
    uid: currentUser?.uid || "",
  };
}

function buildCompensationTableHtml(
  rows: Array<{ label: string; monthly: number; annual: number }>,
  totalLabel?: string
) {
  const totalMonthly = rows.reduce((sum, row) => sum + row.monthly, 0);
  const totalAnnual = rows.reduce((sum, row) => sum + row.annual, 0);
  const showTotal = Boolean(totalLabel) && rows.length > 1;

  const bodyRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td class="amount-cell">₱${formatPlainMoney(row.monthly)}</td>
          <td class="amount-cell">₱${formatPlainMoney(row.annual)}</td>
        </tr>
      `
    )
    .join("");

  const totalRow = showTotal
    ? `
      <tr>
        <td class="total-cell">${escapeHtml(totalLabel || "")}</td>
        <td class="total-cell amount-cell">₱${formatPlainMoney(totalMonthly)}</td>
        <td class="total-cell amount-cell">₱${formatPlainMoney(totalAnnual)}</td>
      </tr>
    `
    : "";

  return `
    <table>
      <thead>
        <tr>
          <th>Compensation Component</th>
          <th style="text-align:right;">Monthly Amount</th>
          <th style="text-align:right;">Annual Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${totalRow}
      </tbody>
    </table>
  `;
}

export default function CertificatesOfEmploymentPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({});
  const [signatories, setSignatories] = useState<Signatories>({});

  const [selectedEmployeeNo, setSelectedEmployeeNo] = useState("");
  const [purpose, setPurpose] = useState("Employment Verification");
  const [customPurpose, setCustomPurpose] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [includeCompensation, setIncludeCompensation] = useState(false);
  const [includeContactDetails, setIncludeContactDetails] = useState(false);
  const [includeAllowance, setIncludeAllowance] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("COE-PENDING");
  const [selectedSignatorySource, setSelectedSignatorySource] = useState("approved");
  const [customSignatoryName, setCustomSignatoryName] = useState("");
  const [customSignatoryPosition, setCustomSignatoryPosition] = useState("");
  const [coeHistory, setCoeHistory] = useState<CoeHistoryItem[]>([]);
  const [expandedAuditTrailIds, setExpandedAuditTrailIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<Partial<AppTheme>>(DEFAULT_APP_THEME);

  useEffect(() => {
    async function loadReportData() {
    setIssueDate(getTodayInputValue());
    setTicketNumber(generateTicketNumber());

    const savedEmployees = await getCollectionItems<Employee>(storageKeys.employees);
    setEmployees(Array.isArray(savedEmployees) ? savedEmployees : []);

    const companyInformationData = await getConfigItem<CompanyProfile>(
      storageKeys.companyInformation,
      {}
    );

    setCompanyProfile(companyInformationData || {});

    const loadedSignatories = await getConfigItem<Signatories>(
      storageKeys.signatories,
      {}
    );

    setSignatories(loadedSignatories || {});
    setSelectedSignatorySource(getPreferredSignatorySource(loadedSignatories || {}));

    const savedCoeHistory = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);
    setCoeHistory(Array.isArray(savedCoeHistory) ? savedCoeHistory : []);
    }

    const refreshReportData = async () => {
      const refreshedEmployees = await getCollectionItems<Employee>(storageKeys.employees);
      setEmployees(Array.isArray(refreshedEmployees) ? refreshedEmployees : []);

      setCompanyProfile(
        await getConfigItem<CompanyProfile>(storageKeys.companyInformation, {}) || {}
      );

      const refreshedSignatories = await getConfigItem<Signatories>(storageKeys.signatories, {}) || {};
      setSignatories(refreshedSignatories);
      setSelectedSignatorySource(getPreferredSignatorySource(refreshedSignatories));

      const refreshedCoeHistory = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);
      setCoeHistory(Array.isArray(refreshedCoeHistory) ? refreshedCoeHistory : []);
    };

    loadReportData();
    window.addEventListener(`${storageKeys.employees}-updated`, refreshReportData as EventListener);
    window.addEventListener(`${storageKeys.companyInformation}-updated`, refreshReportData as EventListener);
    window.addEventListener(`${storageKeys.signatories}-updated`, refreshReportData as EventListener);
    window.addEventListener(`${storageKeys.coeHistory}-updated`, refreshReportData as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.employees}-updated`, refreshReportData as EventListener);
      window.removeEventListener(`${storageKeys.companyInformation}-updated`, refreshReportData as EventListener);
      window.removeEventListener(`${storageKeys.signatories}-updated`, refreshReportData as EventListener);
      window.removeEventListener(`${storageKeys.coeHistory}-updated`, refreshReportData as EventListener);
    };
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

  const selectedEmployee = useMemo(() => {
    return employees.find((employee) => employee.employeeNo === selectedEmployeeNo) || null;
  }, [employees, selectedEmployeeNo]);

  const companyName =
    companyProfile.companyName ||
    companyProfile.registeredName ||
    companyProfile.businessName ||
    companyProfile.tradeName ||
    companyProfile.employerName ||
    selectedEmployee?.company ||
    "Company Name";

  const companyAddress =
    companyProfile.companyAddress ||
    companyProfile.registeredAddress ||
    companyProfile.businessAddress ||
    companyProfile.address ||
    "Company address";

  const companyEmail = companyProfile.emailAddress || companyProfile.email || "";

  const companyContactNumber = companyProfile.contactNumber || "";

  const logoDataUrl =
    companyProfile.logoDataUrl ||
    companyProfile.companyLogoDataUrl ||
    companyProfile.logo ||
    "";

  const signatoryChoices = useMemo(() => {
    const choices = [
      {
        value: "approved",
        label: "Approved By",
        helpText: "Best for official COE certification.",
        name:
          signatories.approvedByName ||
          signatories.coeSignatoryName ||
          signatories.certifiedByName ||
          "",
        position:
          signatories.approvedByPosition ||
          signatories.coeSignatoryPosition ||
          signatories.certifiedByPosition ||
          "",
        signature:
          signatories.approvedBySignature ||
          signatories.coeSignatureDataUrl ||
          signatories.signatureDataUrl ||
          "",
      },
      {
        value: "authorizedRepresentative",
        label: "BIR / Employer Representative",
        helpText: "Use when the COE needs the employer representative.",
        name:
          signatories.authorizedRepName ||
          signatories.authorizedRepresentativeName ||
          companyProfile.authorizedSignatory ||
          "",
        position:
          signatories.authorizedRepPosition ||
          signatories.authorizedRepresentativePosition ||
          companyProfile.authorizedSignatoryPosition ||
          "",
        signature: signatories.authorizedRepSignature || "",
      },
      {
        value: "checked",
        label: "Checked By",
        helpText: "Use only if this person should certify the COE.",
        name: signatories.checkedByName || "",
        position: signatories.checkedByPosition || "",
        signature: signatories.checkedBySignature || "",
      },
      {
        value: "prepared",
        label: "Prepared By",
        helpText: "Use only if this person should certify the COE.",
        name: signatories.preparedByName || "",
        position: signatories.preparedByPosition || "",
        signature: signatories.preparedBySignature || "",
      },
    ].filter((choice) => choice.name.trim());

    return [
      ...choices,
      {
        value: "custom",
        label: "Add another signatory",
        helpText: "Type a one-time signatory for this COE only.",
        name: customSignatoryName,
        position: customSignatoryPosition,
        signature: "",
      },
    ];
  }, [companyProfile, customSignatoryName, customSignatoryPosition, signatories]);

  const selectedSignatory =
    signatoryChoices.find((choice) => choice.value === selectedSignatorySource) ||
    signatoryChoices.find((choice) => choice.value !== "custom") ||
    signatoryChoices[0];

  const certifiedByName = selectedSignatory?.name || "Authorized Signatory";

  const certifiedByPosition = selectedSignatory?.position || "Authorized Representative";

  const signatureDataUrl =
    selectedSignatory?.signature ||
    signatories.coeSignatureDataUrl ||
    signatories.signatureDataUrl ||
    "";

  const finalPurpose = purpose === "Others" ? customPurpose.trim() || "personal purposes" : purpose;

  const monthlyBasicPay = Number(selectedEmployee?.basicPay) || 0;
  const annualBasePay = monthlyBasicPay * 12;
  const allowanceRows = getEmployeeAllowanceRows(selectedEmployee);
  const totalMonthlyAllowance = allowanceRows.reduce((sum, row) => sum + row.monthly, 0);
  const totalAnnualAllowance = allowanceRows.reduce((sum, row) => sum + row.annual, 0);

  function handleGenerateNewTicket() {
    setTicketNumber(generateTicketNumber());
  }

  async function handleSaveHistory() {
    if (!selectedEmployee) {
      window.alert("Please select an employee first.");
      return;
    }

    if (!issueDate) {
      window.alert("Please select an issue date first.");
      return;
    }

    if (!certifiedByName || certifiedByName === "Authorized Signatory") {
      window.alert("Please select or enter a COE signatory first.");
      return;
    }

    const auditUser = getAuditUserFallback();
    const submittedAt = new Date().toISOString();

    const historyItem: CoeHistoryItem = {
      id: ticketNumber,
      employeeNo: selectedEmployee.employeeNo,
      employeeName: getFullName(selectedEmployee),
      purpose: finalPurpose,
      issueDate,
      includeCompensation,
      includeAllowance,
      includeContactDetails,
      generatedAt: submittedAt,
      certifiedByName,
      certifiedByPosition,
      certifiedBySignatureDataUrl: signatureDataUrl,
      companyName,
      companyAddress,
      companyEmail,
      companyContactNumber,
      companyLogoDataUrl: logoDataUrl,
      status: "Subject for Approval",
      submittedAt,
      submittedByName: auditUser.name,
      submittedByEmail: auditUser.email,
      submittedByUid: auditUser.uid,
    };

    const existing = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);
    const nextHistory = Array.isArray(existing) ? [historyItem, ...existing] : [historyItem];

    await setDataArray(storageKeys.coeHistory, nextHistory);
    setCoeHistory(nextHistory);
    window.dispatchEvent(new Event(`${storageKeys.coeHistory}-updated`));
    logAudit({ action: "SUBMITTED", entityType: "Report_COE", entityId: ticketNumber, entityName: getFullName(selectedEmployee), details: `Purpose: ${finalPurpose}; Issue date: ${issueDate}` });
    window.alert("COE submitted for approval. It will only appear in the employee portal after approval.");
  }

  async function handleApproveCoe(coeId: string) {
    const auditUser = getAuditUserFallback();
    const approvedAt = new Date().toISOString();
    const approverName = auditUser.name || (certifiedByName && certifiedByName !== "Authorized Signatory" ? certifiedByName : "HR Approver");
    const existing = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);

    const nextHistory = existing.map((item: CoeHistoryItem) => {
      if (item.id !== coeId) return item;

      return {
        ...item,
        status: "Approved" as const,
        approvedAt,
        approvedBy: approverName,
        approvedByName: auditUser.name,
        approvedByEmail: auditUser.email,
        approvedByUid: auditUser.uid,
        certifiedBySignatureDataUrl: item.certifiedBySignatureDataUrl || signatureDataUrl,
        companyName: item.companyName || companyName,
        companyAddress: item.companyAddress || companyAddress,
        companyEmail: item.companyEmail || companyEmail,
        companyContactNumber: item.companyContactNumber || companyContactNumber,
        companyLogoDataUrl: item.companyLogoDataUrl || logoDataUrl,
      };
    });

    await setDataArray(storageKeys.coeHistory, nextHistory);
    setCoeHistory(nextHistory);
    window.dispatchEvent(new Event(`${storageKeys.coeHistory}-updated`));
    const approvedCoe = existing.find((item) => item.id === coeId);
    logAudit({ action: "APPROVED", entityType: "Report_COE", entityId: coeId, entityName: approvedCoe?.employeeName || coeId, details: `Approved by: ${approverName}` });
    window.alert("COE approved. It will now appear in the employee portal under Documents.");
  }

  async function handleRejectCoe(coeId: string) {
    const auditUser = getAuditUserFallback();
    const rejectedAt = new Date().toISOString();
    const existing = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);

    const nextHistory = existing.map((item: CoeHistoryItem) => {
      if (item.id !== coeId) return item;

      return {
        ...item,
        status: "Rejected" as const,
        rejectedAt,
        rejectedByName: auditUser.name,
        rejectedByEmail: auditUser.email,
        rejectedByUid: auditUser.uid,
      };
    });

    await setDataArray(storageKeys.coeHistory, nextHistory);
    setCoeHistory(nextHistory);
    window.dispatchEvent(new Event(`${storageKeys.coeHistory}-updated`));
    const rejectedCoe = existing.find((item) => item.id === coeId);
    logAudit({ action: "RETURNED", entityType: "Report_COE", entityId: coeId, entityName: rejectedCoe?.employeeName || coeId, details: "COE rejected" });
    window.alert("COE rejected. It will not appear in the employee portal.");
  }

  async function handleArchiveCoe(coeId: string) {
    const auditUser = getAuditUserFallback();
    const archivedAt = new Date().toISOString();
    const existing = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);

    const nextHistory = existing.map((item: CoeHistoryItem) => {
      if (item.id !== coeId) return item;

      return {
        ...item,
        status: "Archived" as const,
        archivedAt,
        archivedByName: auditUser.name,
        archivedByEmail: auditUser.email,
        archivedByUid: auditUser.uid,
      };
    });

    await setDataArray(storageKeys.coeHistory, nextHistory);
    setCoeHistory(nextHistory);
    window.dispatchEvent(new Event(`${storageKeys.coeHistory}-updated`));
    const archivedCoe = existing.find((item) => item.id === coeId);
    logAudit({ action: "ARCHIVED", entityType: "Report_COE", entityId: coeId, entityName: archivedCoe?.employeeName || coeId, details: "COE archived" });
    window.alert("COE archived. It will be hidden from active approval action and will not appear in the employee portal.");
  }

  async function handleRestoreCoe(coeId: string) {
    const auditUser = getAuditUserFallback();
    const restoredAt = new Date().toISOString();
    const existing = await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []);

    const nextHistory = existing.map((item: CoeHistoryItem) => {
      if (item.id !== coeId) return item;

      return {
        ...item,
        status: "Subject for Approval" as const,
        archivedAt: "",
        archivedByName: "",
        archivedByEmail: "",
        archivedByUid: "",
        submittedAt: item.submittedAt || restoredAt,
        submittedByName: item.submittedByName || auditUser.name,
        submittedByEmail: item.submittedByEmail || auditUser.email,
        submittedByUid: item.submittedByUid || auditUser.uid,
      };
    });

    await setDataArray(storageKeys.coeHistory, nextHistory);
    setCoeHistory(nextHistory);
    window.dispatchEvent(new Event(`${storageKeys.coeHistory}-updated`));
    window.alert("COE restored and returned to Subject for Approval.");
  }

  function toggleAuditTrail(coeId: string) {
    setExpandedAuditTrailIds((currentIds) =>
      currentIds.includes(coeId)
        ? currentIds.filter((id) => id !== coeId)
        : [...currentIds, coeId]
    );
  }

  function buildCertificateHtml() {
    if (!selectedEmployee) return "";

    const savedHistoryRecord = coeHistory.find((item) => item.id === ticketNumber);
    const certificateStatus = savedHistoryRecord?.status || "Draft";
    const isDraftCertificate = certificateStatus !== "Approved";
    const watermarkHtml = isDraftCertificate
      ? `<div class="draft-watermark" aria-hidden="true">
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
        </div>`
      : "";
    const statusPillHtml = `<div class="status-pill">${escapeHtml(certificateStatus)}</div>`;

    const compensationHtml = includeCompensation
      ? `
        <div class="compensation-block">
          <p>Upon request, the employee’s compensation details are reflected below for reference:</p>
          ${buildCompensationTableHtml([
            {
              label: "Basic Pay",
              monthly: monthlyBasicPay,
              annual: annualBasePay,
            },
          ])}
          ${
            includeAllowance
              ? allowanceRows.length > 0
                ? `<div class="table-spacing">${buildCompensationTableHtml(
                    allowanceRows,
                    "Total Allowances"
                  )}</div>`
                : `<div class="empty-allowance-note">No allowance amounts are currently saved in this employee’s information.</div>`
              : ""
          }
          ${
            includeAllowance && allowanceRows.length > 0
              ? `<div class="table-spacing">${buildCompensationTableHtml([
                  {
                    label: "Total Compensation Package",
                    monthly: monthlyBasicPay + totalMonthlyAllowance,
                    annual: annualBasePay + totalAnnualAllowance,
                  },
                ])}</div>`
              : ""
          }
        </div>
      `
      : "";

    const contactParagraph = includeContactDetails
      ? `
        <p>
          For verification of this certificate, requests may be coursed through the company’s authorized
          HR representative at <strong>${escapeHtml(companyEmail || "official company email")}</strong>${
            companyContactNumber
              ? ` or through <strong>${escapeHtml(companyContactNumber)}</strong>`
              : ""
          }.
        </p>
      `
      : `
        <p>
          For verification of this certificate, requests may be coursed through the company’s authorized
          HR representative or official contact channel.
        </p>
      `;

    const employmentPeriod = selectedEmployee.separationDate
      ? `to <strong>${escapeHtml(formatDate(selectedEmployee.separationDate))}</strong>`
      : "to present";

    const departmentPhrase = selectedEmployee.department
      ? ` under the <strong>${escapeHtml(selectedEmployee.department)}</strong> department`
      : "";

    const signatureHtml = signatureDataUrl
      ? `<img src="${signatureDataUrl}" alt="Signature" class="signature-image" />`
      : `<div class="signature-placeholder"></div>`;

    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Company logo" class="company-logo" />`
      : "";

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Certificate of Employment - ${escapeHtml(getFullName(selectedEmployee))}</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              background: #e2e8f0;
              color: #111827;
              font-family: "Times New Roman", Times, serif;
            }

            .toolbar {
              position: sticky;
              top: 0;
              display: flex;
              justify-content: center;
              gap: 10px;
              padding: 14px;
              background: #0f172a;
              z-index: 20;
            }

            .toolbar button {
              border: 0;
              border-radius: 12px;
              padding: 11px 16px;
              font-weight: 900;
              cursor: pointer;
            }

            .primary-button {
              background: #1d4ed8;
              color: #ffffff;
            }

            .secondary-button {
              background: #ffffff;
              color: #0f172a;
            }

            .certificate-page {
              width: 210mm;
              min-height: 297mm;
              margin: 18px auto;
              padding: 12mm 22mm 10mm;
              background: #ffffff;
              position: relative;
              box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
              overflow: hidden;
            }

            .draft-watermark {
              position: absolute;
              inset: 0;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              align-items: center;
              justify-items: center;
              color: rgba(100, 116, 139, 0.18);
              font-size: 54px;
              font-weight: 900;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 0;
              overflow: hidden;
            }

            .draft-watermark span {
              display: block;
              transform: rotate(-28deg);
              white-space: nowrap;
            }

            .certificate-content {
              position: relative;
              z-index: 1;
              min-height: calc(297mm - 22mm);
              display: flex;
              flex-direction: column;
            }

            .status-pill {
              position: absolute;
              top: 12mm;
              right: 22mm;
              border: 1px solid #cbd5e1;
              background: rgba(248, 250, 252, 0.92);
              color: #334155;
              border-radius: 999px;
              padding: 6px 10px;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              z-index: 2;
            }

            .certificate-header {
              display: flex;
              align-items: center;
              gap: 18px;
              border-bottom: 4px solid #0f4c81;
              padding-bottom: 12px;
              margin-bottom: 46px;
            }

            .company-logo {
              max-width: 150px;
              max-height: 75px;
              object-fit: contain;
            }

            .company-name {
              font-size: 18pt;
              font-weight: 700;
              color: #0f2f4a;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }

            .company-address {
              font-size: 10.5pt;
              color: #374151;
              margin-top: 6px;
            }

            h1 {
              text-align: center;
              color: #111827;
              font-size: 18pt;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              margin: 18px 0 42px;
            }

            p {
              font-size: 12pt;
              line-height: 1.65;
              text-align: justify;
              margin: 0 0 22px;
            }

            .compensation-block {
              margin-top: 34px;
              margin-bottom: 34px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
              font-size: 11pt;
              color: #111827;
            }

            th {
              padding: 8px 10px;
              border: 1px solid #9ca3af;
              background: #f3f4f6;
              color: #111827;
              font-weight: 700;
              text-align: left;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-size: 10.5pt;
            }

            td {
              padding: 8px 10px;
              border: 1px solid #9ca3af;
              background: #ffffff;
              vertical-align: top;
            }

            .amount-cell {
              text-align: right;
              font-weight: 800;
            }

            .total-cell {
              padding: 10px 12px;
              border: 1px solid #94a3b8;
              background: #f8fafc;
              font-weight: 900;
            }

            .table-spacing {
              margin-top: 18px;
            }

            .empty-allowance-note {
              margin-top: 18px;
              padding: 12px 14px;
              border: 1px dashed #cbd5e1;
              border-radius: 14px;
              color: #64748b;
              font-size: 13px;
              font-weight: 700;
            }

            .signature-block {
              margin-top: 54px;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .signature-label {
              margin-bottom: 12px;
              font-weight: 700;
            }

            .signature-image {
              width: 170px;
              height: 44px;
              object-fit: contain;
              display: block;
              margin-bottom: 6px;
            }

            .signature-placeholder {
              height: 44px;
            }

            .signature-name {
              font-weight: 700;
              border-top: 1px solid #111827;
              width: 280px;
              padding-top: 8px;
              font-size: 12pt;
              text-transform: uppercase;
              line-height: 1.15;
            }

            .signature-position {
              font-size: 11pt;
              color: #374151;
              margin-top: 3px;
            }

            .footer {
              position: static;
              margin-top: auto;
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              align-items: start;
              gap: 22px;
              font-size: 8.5pt;
              line-height: 1.2;
              color: #4b5563;
              border-top: 1px solid #d1d5db;
              padding-top: 6px;
              background: #ffffff;
              clear: both;
            }

            .footer em {
              display: block;
              max-width: 135mm;
            }

            .footer strong {
              white-space: nowrap;
              letter-spacing: 0.04em;
            }

            @media print {
              body {
                background: #ffffff;
              }

              .toolbar {
                display: none !important;
              }

              .status-pill {
                top: 12mm !important;
                right: 22mm !important;
              }

              .draft-watermark {
                color: rgba(100, 116, 139, 0.2) !important;
              }

              .certificate-page {
                margin: 0;
                box-shadow: none;
                width: 210mm;
                height: 297mm;
                min-height: 297mm;
                padding: 12mm 22mm 10mm !important;
                overflow: hidden;
              }

              .signature-block {
                margin-top: 46px !important;
              }

              .signature-image {
                width: 160px !important;
                height: 38px !important;
                margin-bottom: 6px !important;
              }

              .signature-placeholder {
                height: 38px !important;
              }

              .footer {
                position: static !important;
                margin-top: auto !important;
                font-size: 8.5pt !important;
                padding-top: 5px !important;
              }

              p {
                font-size: 11pt !important;
                line-height: 1.55 !important;
                margin-bottom: 15px !important;
              }

              table {
                font-size: 10.5pt !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              th,
              td {
                padding: 7px 9px !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button class="primary-button" onclick="window.print()">Print / Save as PDF</button>
            <button class="secondary-button" onclick="window.close()">Close</button>
          </div>

          <section class="certificate-page">
            ${watermarkHtml}
            ${statusPillHtml}
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
              This is to certify that <strong>${escapeHtml(getFullName(selectedEmployee).toUpperCase())}</strong>
              ${selectedEmployee.separationDate ? "was" : "is"} employed by
              <strong>${escapeHtml(companyName.toUpperCase())}</strong> from
              <strong>${escapeHtml(formatDate(selectedEmployee.hireDate))}</strong>
              ${employmentPeriod} as <strong>${escapeHtml(selectedEmployee.designation || "—")}</strong>${departmentPhrase}
              with <strong>${escapeHtml(selectedEmployee.employeeType || selectedEmployee.employmentStatus || "—")}</strong>
              employment status.
            </p>

            ${compensationHtml}

            ${contactParagraph}

            <p>
              This certification is issued upon the request of <strong>${escapeHtml(getFormalName(selectedEmployee))}</strong>
              for <strong>${escapeHtml(finalPurpose)}</strong> purposes, issued this
              <strong>${escapeHtml(formatDate(issueDate))}</strong>.
            </p>

            <div class="signature-block">
              <div class="signature-label">Certified by:</div>
              ${signatureHtml}
              <div class="signature-name">${escapeHtml(certifiedByName)}</div>
              <div class="signature-position">${escapeHtml(certifiedByPosition)}</div>
            </div>

            <div class="footer">
              <em>This certificate is system-generated with an electronic signature and unique internal ticket number (${escapeHtml(ticketNumber)}). Status: ${escapeHtml(certificateStatus)}.</em>
              <strong>CONFIDENTIAL</strong>
            </div>
            </div>
          </section>
        </body>
      </html>
    `;
  }

  function buildCertificateHtmlFromHistory(item: CoeHistoryItem) {
    const employee = employees.find((entry) => entry.employeeNo === item.employeeNo) || null;

    if (!employee) return "";

    const certificateStatus = item.status || "Draft";
    const isDraftCertificate = certificateStatus !== "Approved";
    const watermarkHtml = isDraftCertificate
      ? `<div class="draft-watermark" aria-hidden="true">
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
          <span>DRAFT</span>
        </div>`
      : "";
    const statusPillHtml = `<div class="status-pill">${escapeHtml(certificateStatus)}</div>`;
    const historyAllowanceRows = getEmployeeAllowanceRows(employee);
    const historyMonthlyBasicPay = Number(employee.basicPay) || 0;
    const historyAnnualBasePay = historyMonthlyBasicPay * 12;
    const historyTotalMonthlyAllowance = historyAllowanceRows.reduce((sum, row) => sum + row.monthly, 0);
    const historyTotalAnnualAllowance = historyAllowanceRows.reduce((sum, row) => sum + row.annual, 0);

    const compensationHtml = item.includeCompensation
      ? `
        <div class="compensation-block">
          <p>Upon request, the employee’s compensation details are reflected below for reference:</p>
          ${buildCompensationTableHtml([
            {
              label: "Basic Pay",
              monthly: historyMonthlyBasicPay,
              annual: historyAnnualBasePay,
            },
          ])}
          ${
            item.includeAllowance
              ? historyAllowanceRows.length > 0
                ? `<div class="table-spacing">${buildCompensationTableHtml(
                    historyAllowanceRows,
                    "Total Allowances"
                  )}</div>`
                : `<div class="empty-allowance-note">No allowance amounts are currently saved in this employee’s information.</div>`
              : ""
          }
          ${
            item.includeAllowance && historyAllowanceRows.length > 0
              ? `<div class="table-spacing">${buildCompensationTableHtml([
                  {
                    label: "Total Compensation Package",
                    monthly: historyMonthlyBasicPay + historyTotalMonthlyAllowance,
                    annual: historyAnnualBasePay + historyTotalAnnualAllowance,
                  },
                ])}</div>`
              : ""
          }
        </div>
      `
      : "";

    const contactParagraph = includeContactDetails
      ? `
        <p>
          For verification of this certificate, requests may be coursed through the company’s authorized
          HR representative at <strong>${escapeHtml(companyEmail || "official company email")}</strong>${
            companyContactNumber
              ? ` or through <strong>${escapeHtml(companyContactNumber)}</strong>`
              : ""
          }.
        </p>
      `
      : `
        <p>
          For verification of this certificate, requests may be coursed through the company’s authorized
          HR representative or official contact channel.
        </p>
      `;

    const employmentPeriod = employee.separationDate
      ? `to <strong>${escapeHtml(formatDate(employee.separationDate))}</strong>`
      : "to present";

    const departmentPhrase = employee.department
      ? ` under the <strong>${escapeHtml(employee.department)}</strong> department`
      : "";

    const historySignatureHtml = signatureDataUrl
      ? `<img src="${signatureDataUrl}" alt="Signature" class="signature-image" />`
      : `<div class="signature-placeholder"></div>`;

    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Company logo" class="company-logo" />`
      : "";

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Certificate of Employment - ${escapeHtml(getFullName(employee))}</title>
          <style>
            @page { size: A4; margin: 0; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #e2e8f0;
              color: #111827;
              font-family: "Times New Roman", Times, serif;
            }
            .toolbar {
              position: sticky;
              top: 0;
              display: flex;
              justify-content: center;
              gap: 10px;
              padding: 14px;
              background: #0f172a;
              z-index: 20;
            }
            .toolbar button {
              border: 0;
              border-radius: 12px;
              padding: 11px 16px;
              font-weight: 900;
              cursor: pointer;
            }
            .primary-button { background: #1d4ed8; color: #ffffff; }
            .secondary-button { background: #ffffff; color: #0f172a; }
            .certificate-page {
              width: 210mm;
              min-height: 297mm;
              margin: 18px auto;
              padding: 12mm 22mm 10mm;
              background: #ffffff;
              position: relative;
              box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
              overflow: hidden;
            }
            .draft-watermark {
              position: absolute;
              inset: 0;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(3, 1fr);
              align-items: center;
              justify-items: center;
              color: rgba(100, 116, 139, 0.18);
              font-size: 54px;
              font-weight: 900;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              pointer-events: none;
              z-index: 0;
              overflow: hidden;
            }
            .draft-watermark span {
              display: block;
              transform: rotate(-28deg);
              white-space: nowrap;
            }
            .certificate-content {
              position: relative;
              z-index: 1;
              min-height: calc(297mm - 22mm);
              display: flex;
              flex-direction: column;
            }
            .status-pill {
              position: absolute;
              top: 12mm;
              right: 22mm;
              border: 1px solid #cbd5e1;
              background: rgba(248, 250, 252, 0.92);
              color: #334155;
              border-radius: 999px;
              padding: 6px 10px;
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              z-index: 2;
            }
            .certificate-header {
              display: flex;
              align-items: center;
              gap: 18px;
              border-bottom: 4px solid #0f4c81;
              padding-bottom: 12px;
              margin-bottom: 46px;
            }
            .company-logo {
              max-width: 150px;
              max-height: 75px;
              object-fit: contain;
            }
            .company-name {
              font-size: 18pt;
              font-weight: 700;
              color: #0f2f4a;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .company-address {
              font-size: 10.5pt;
              color: #374151;
              margin-top: 6px;
            }
            h1 {
              text-align: center;
              color: #111827;
              font-size: 18pt;
              font-weight: 700;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              margin: 18px 0 42px;
            }
            p {
              font-size: 12pt;
              line-height: 1.65;
              text-align: justify;
              margin: 0 0 22px;
            }
            .compensation-block { margin-top: 34px; margin-bottom: 34px; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 16px;
              font-size: 11pt;
              color: #111827;
            }
            th {
              padding: 8px 10px;
              border: 1px solid #9ca3af;
              background: #f3f4f6;
              color: #111827;
              font-weight: 700;
              text-align: left;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              font-size: 10.5pt;
            }
            td {
              padding: 8px 10px;
              border: 1px solid #9ca3af;
              background: #ffffff;
              vertical-align: top;
            }
            .amount-cell { text-align: right; font-weight: 800; }
            .total-cell {
              padding: 10px 12px;
              border: 1px solid #94a3b8;
              background: #f8fafc;
              font-weight: 900;
            }
            .table-spacing { margin-top: 18px; }
            .empty-allowance-note {
              margin-top: 18px;
              padding: 12px 14px;
              border: 1px dashed #cbd5e1;
              border-radius: 14px;
              color: #64748b;
              font-size: 13px;
              font-weight: 700;
            }
            .signature-block {
              margin-top: 54px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .signature-label { margin-bottom: 12px; font-weight: 700; }
            .signature-image {
              width: 170px;
              height: 44px;
              object-fit: contain;
              display: block;
              margin-bottom: 6px;
            }
            .signature-placeholder { height: 44px; }
            .signature-name {
              font-weight: 700;
              border-top: 1px solid #111827;
              width: 280px;
              padding-top: 8px;
              font-size: 12pt;
              text-transform: uppercase;
              line-height: 1.15;
            }
            .signature-position { font-size: 11pt; color: #374151; margin-top: 3px; }
            .footer {
              position: static;
              margin-top: auto;
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              align-items: start;
              gap: 22px;
              font-size: 8.5pt;
              line-height: 1.2;
              color: #4b5563;
              border-top: 1px solid #d1d5db;
              padding-top: 6px;
              background: #ffffff;
              clear: both;
            }
            .footer em { display: block; max-width: 135mm; }
            .footer strong { white-space: nowrap; letter-spacing: 0.04em; }
            @media print {
              body { background: #ffffff; }
              .toolbar { display: none !important; }
              .status-pill { top: 12mm !important; right: 22mm !important; }
              .draft-watermark { color: rgba(100, 116, 139, 0.2) !important; }
              .certificate-page {
                margin: 0;
                box-shadow: none;
                width: 210mm;
                height: 297mm;
                min-height: 297mm;
                padding: 12mm 22mm 10mm !important;
                overflow: hidden;
              }
              .signature-block { margin-top: 46px !important; }
              .signature-image { width: 160px !important; height: 38px !important; margin-bottom: 6px !important; }
              .signature-placeholder { height: 38px !important; }
              .footer {
                position: static !important;
                margin-top: auto !important;
                font-size: 8.5pt !important;
                padding-top: 5px !important;
              }
              p { font-size: 11pt !important; line-height: 1.55 !important; margin-bottom: 15px !important; }
              table { font-size: 10.5pt !important; page-break-inside: avoid !important; break-inside: avoid !important; }
              th, td { padding: 7px 9px !important; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button class="primary-button" onclick="window.print()">Print / Save as PDF</button>
            <button class="secondary-button" onclick="window.close()">Close</button>
          </div>

          <section class="certificate-page">
            ${watermarkHtml}
            ${statusPillHtml}
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
                ${historySignatureHtml}
                <div class="signature-name">${escapeHtml(item.certifiedByName || certifiedByName)}</div>
                <div class="signature-position">${escapeHtml(item.certifiedByPosition || certifiedByPosition)}</div>
              </div>

              <div class="footer">
                <em>This certificate is system-generated with an electronic signature and unique internal ticket number (${escapeHtml(item.id)}). Status: ${escapeHtml(certificateStatus)}.</em>
                <strong>CONFIDENTIAL</strong>
              </div>
            </div>
          </section>
        </body>
      </html>
    `;
  }

  function handleViewQueuedCoe(item: CoeHistoryItem) {
    const html = buildCertificateHtmlFromHistory(item);

    if (!html) {
      window.alert("Employee record for this COE could not be found.");
      return;
    }

    const certificateWindow = window.open("", "_blank");

    if (!certificateWindow) {
      window.alert("Please allow pop-ups for this site so the COE can open in a new tab.");
      return;
    }

    certificateWindow.document.open();
    certificateWindow.document.write(html);
    certificateWindow.document.close();
    certificateWindow.focus();
  }

  function handlePrint() {
    if (!selectedEmployee) {
      window.alert("Please select an employee first.");
      return;
    }

    if (!issueDate) {
      window.alert("Please select an issue date first.");
      return;
    }

    if (!certifiedByName || certifiedByName === "Authorized Signatory") {
      window.alert("Please select or enter a COE signatory first.");
      return;
    }

    const certificateWindow = window.open("", "_blank");

    if (!certificateWindow) {
      window.alert("Please allow pop-ups for this site so the COE can open in a new tab.");
      return;
    }

    certificateWindow.document.open();
    certificateWindow.document.write(buildCertificateHtml());
    certificateWindow.document.close();
    certificateWindow.focus();
  }

  const activeTheme = normalizeTheme(theme);
  const accentButtonTextColor = getReadableAccentTextColor(activeTheme.accentColor, activeTheme.bannerButtonTextColor);
  const bannerOverlayAlpha = Math.max(0, Math.min(activeTheme.bannerOverlayOpacity ?? 0, 100)).toString(16).padStart(2, "0");
  const bannerStyle: React.CSSProperties = {
    backgroundColor: activeTheme.bannerColor,
    backgroundImage: activeTheme.bannerImageDataUrl
      ? `linear-gradient(${activeTheme.bannerColor}${bannerOverlayAlpha}, ${activeTheme.bannerColor}${bannerOverlayAlpha}), url(${activeTheme.bannerImageDataUrl})`
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${activeTheme.bannerColor} 0%, ${activeTheme.bannerColor} 290px, #f4f8fc 290px, #f4f8fc 100%)`,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0f172a",
        padding: "20px 24px 24px",
        ["--report-accent" as string]: activeTheme.accentColor,
        ["--report-button-text" as string]: accentButtonTextColor,
      }}
    >
      <style>{`
        .coe-report-page button {
          border-radius: 10px !important;
          box-shadow: 0 10px 24px -22px rgba(8,47,73,0.75);
        }

        .coe-report-page input,
        .coe-report-page select,
        .coe-report-page textarea {
          border-radius: 10px !important;
          font-size: 12px !important;
          min-height: 38px !important;
          padding: 9px 12px !important;
        }

        .coe-report-page input:focus,
        .coe-report-page select:focus,
        .coe-report-page textarea:focus {
          border-color: var(--report-accent) !important;
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--report-accent) 18%, transparent), 0 8px 18px -20px rgba(8,47,73,0.65) !important;
        }

        .coe-report-page .report-primary {
          background: var(--report-accent) !important;
          border-color: var(--report-accent) !important;
          color: var(--report-button-text) !important;
        }

        .coe-report-page table th {
          font-size: 10px !important;
          letter-spacing: 0.02em !important;
          font-weight: 800 !important;
        }

        .coe-report-page table td {
          font-size: 12px !important;
          color: #334155;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            overflow: hidden !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-area,
          .print-area * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
          }

          .print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 210mm !important;
            max-width: 210mm !important;
            min-height: 0 !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 12mm 22mm 12mm 22mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-footer {
            position: absolute !important;
            left: 22mm !important;
            right: 22mm !important;
            bottom: 10mm !important;
            margin-top: 0 !important;
          }

          .certificate-signature-block {
            margin-top: 38px !important;
          }

          .print-area p {
            font-size: 13.5px !important;
            line-height: 1.65 !important;
            margin-bottom: 16px !important;
          }

          .print-area table {
            font-size: 12px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .print-area th,
          .print-area td {
            padding: 7px 9px !important;
          }

          .print-area h2 {
            font-size: 24px !important;
            margin-top: 22px !important;
            margin-bottom: 34px !important;
          }

          .print-certificate-header {
            margin-bottom: 46px !important;
            padding-bottom: 12px !important;
          }
        }
      `}</style>

      <div className="coe-report-page" style={{ maxWidth: 1250, margin: "0 auto", display: "grid", gap: 20 }}>
        <section
          className="no-print"
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 16,
            border: `1px solid ${activeTheme.accentColor}33`,
            ...bannerStyle,
            color: activeTheme.bannerTextColor,
            boxShadow: "0 22px 60px -42px rgba(14,165,233,0.75)",
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.3,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, background: `${activeTheme.accentColor}24`, border: `0.5px solid ${activeTheme.accentColor}66`, color: activeTheme.bannerTextColor }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: activeTheme.accentColor }} />
                  HR Reports
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: activeTheme.bannerTextColor }}>
                  COE Desk
                </span>
              </div>
              <div>
                <h1 style={{ margin: "12px 0 0", fontSize: 30, lineHeight: 1.12, fontWeight: 650, color: activeTheme.bannerTextColor }}>
                  Certificates of Employment
                </h1>
                <p style={{ margin: "6px 0 0", maxWidth: 720, color: activeTheme.bannerTextColor, opacity: 0.85, fontSize: 14, fontWeight: 500, lineHeight: 1.6 }}>
                  Generate, submit, and approve employment certificates from employee and company records.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(92px, 1fr))", gap: 8, minWidth: 360 }}>
              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.07)", padding: "8px 12px" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.7 }}>Pending</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700 }}>{coeHistory.filter((item) => item.status === "Subject for Approval").length}</p>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.07)", padding: "8px 12px" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.7 }}>Approved</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700 }}>{coeHistory.filter((item) => item.status === "Approved").length}</p>
              </div>
              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.07)", padding: "8px 12px" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.7 }}>Employees</p>
                <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700 }}>{employees.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 420px) 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section
            style={panelStyle}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 22, lineHeight: 1.2, fontWeight: 900, color: "#0f172a" }}>COE Setup</h2>

            <div style={{ display: "grid", gap: 16 }}>
              <label>
                <div style={labelStyle}>Employee *</div>
                <select
                  value={selectedEmployeeNo}
                  onChange={(event) => {
                    setSelectedEmployeeNo(event.target.value);
                    setTicketNumber(generateTicketNumber());
                  }}
                  style={inputStyle}
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.employeeNo} value={employee.employeeNo}>
                      {getFullName(employee)} — {employee.employeeNo}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={labelStyle}>Purpose *</div>
                <select
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  style={inputStyle}
                >
                  {PURPOSE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {purpose === "Others" ? (
                <label>
                  <div style={labelStyle}>Custom Purpose *</div>
                  <input
                    value={customPurpose}
                    onChange={(event) => setCustomPurpose(event.target.value)}
                    placeholder="Example: scholarship application"
                    style={inputStyle}
                  />
                </label>
              ) : null}

              <label>
                <div style={labelStyle}>Issue Date *</div>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 14,
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  background: "#ffffff",
                  fontWeight: 800,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeCompensation}
                  onChange={(event) => setIncludeCompensation(event.target.checked)}
                />
                Include compensation details
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 14,
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  background: "#ffffff",
                  fontWeight: 800,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeContactDetails}
                  onChange={(event) => setIncludeContactDetails(event.target.checked)}
                />
                Include company email and contact number
              </label>

              {includeCompensation ? (
                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 14,
                    border: "1px solid #e2e8f0",
                    borderRadius: 20,
                    background: "#ffffff",
                    fontWeight: 800,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={includeAllowance}
                    onChange={(event) => setIncludeAllowance(event.target.checked)}
                  />
                  Include allowances from employee information
                </label>
              ) : null}

              <div
                style={{
                  padding: 16,
                  borderRadius: 24,
                  border: "1px solid #bfdbfe",
                  background: "#ffffff",
                  color: "#1e3a8a",
                  lineHeight: 1.6,
                }}
              >
                <label>
                  <div style={{ ...labelStyle, color: "#1e3a8a" }}>COE Signatory</div>
                  <select
                    value={selectedSignatorySource}
                    onChange={(event) => setSelectedSignatorySource(event.target.value)}
                    style={{ ...inputStyle, marginTop: 8 }}
                  >
                    {signatoryChoices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.name ? `${choice.label}: ${choice.name} (${choice.position || "No position"})` : choice.label}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedSignatorySource === "custom" ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <label>
                      <div style={{ ...labelStyle, color: "#1e3a8a" }}>
                        Custom Signatory Name
                      </div>
                      <input
                        value={customSignatoryName}
                        onChange={(event) => setCustomSignatoryName(event.target.value)}
                        placeholder="Enter signatory name"
                        style={inputStyle}
                      />
                    </label>

                    <label>
                      <div style={{ ...labelStyle, color: "#1e3a8a" }}>
                        Custom Signatory Position
                      </div>
                      <input
                        value={customSignatoryPosition}
                        onChange={(event) => setCustomSignatoryPosition(event.target.value)}
                        placeholder="Enter position"
                        style={inputStyle}
                      />
                    </label>
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 18,
                    background: "#f8fafc",
                    border: "1px solid #bfdbfe",
                  }}
                >
                  <strong>Selected Signatory:</strong>
                  <br />
                  {certifiedByName}
                  <br />
                  {certifiedByPosition}
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
                    {selectedSignatory?.helpText || "This person will appear as Certified by on the COE."}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={handleGenerateNewTicket} style={secondaryButtonStyle}>
                  Generate New Ticket No.
                </button>
                <button type="button" onClick={handleSaveHistory} style={secondaryButtonStyle}>
                  Submit for Approval
                </button>
                <button type="button" onClick={handlePrint} style={primaryButtonStyle}>
                  Generate COE PDF
                </button>
              </div>
            </div>
          </section>

          <section
            style={panelStyle}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 22, lineHeight: 1.2, fontWeight: 900, color: "#0f172a" }}>Preview Details</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <PreviewRow label="Company" value={companyName} />
              <PreviewRow label="Company Address" value={companyAddress} />
              <PreviewRow label="Company Email" value={includeContactDetails ? companyEmail || "—" : "Hidden"} />
              <PreviewRow label="Contact Number" value={includeContactDetails ? companyContactNumber || "—" : "Hidden"} />
              <PreviewRow label="Employee" value={selectedEmployee ? getFullName(selectedEmployee) : "—"} />
              <PreviewRow label="Position" value={selectedEmployee?.designation || "—"} />
              <PreviewRow label="Employment Status" value={selectedEmployee?.employmentStatus || "—"} />
              <PreviewRow label="Purpose" value={finalPurpose || "—"} />
              <PreviewRow label="Ticket No." value={ticketNumber} />
              <PreviewRow
                label="COE Status"
                value={coeHistory.find((item) => item.id === ticketNumber)?.status || "Draft"}
              />
            </div>
          </section>
        </div>

        <section
          className="no-print"
          style={panelStyle}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 900, color: "#0f172a" }}>
                COE Approval Queue
              </h2>
              <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 14, lineHeight: 1.6, fontWeight: 700 }}>
                COEs submitted for approval stay here first. Approved COEs will appear in the employee portal documents.
              </p>
            </div>

            <div
              style={{
                border: "1px solid #bae6fd",
                background: "#f0f9ff",
                color: "#0a4f8f",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {coeHistory.filter((item) => item.status === "Subject for Approval").length} Pending
            </div>
          </div>

          {coeHistory.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: 24,
                padding: 24,
                color: "#64748b",
                fontWeight: 800,
                background: "#f8fafc",
              }}
            >
              No COE submissions yet.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  tableLayout: "fixed",
                  minWidth: 1180,
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                    <th style={{ ...queueHeaderCellStyle, width: 130 }}>Ticket No.</th>
                    <th style={{ ...queueHeaderCellStyle, width: 170 }}>Employee</th>
                    <th style={{ ...queueHeaderCellStyle, width: 170 }}>Purpose</th>
                    <th style={{ ...queueHeaderCellStyle, width: 110 }}>Issue Date</th>
                    <th style={{ ...queueHeaderCellStyle, width: 110 }}>Submitted</th>
                    <th style={{ ...queueHeaderCellStyle, width: 250 }}>Audit Trail</th>
                    <th style={{ ...queueHeaderCellStyle, width: 170 }}>Status</th>
                    <th style={{ ...queueHeaderCellStyle, width: 190, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coeHistory.map((item) => (
                    <tr key={`${item.id}-${item.employeeNo}-${item.generatedAt || item.submittedAt || "coe"}`} style={{ borderBottom: "1px solid #e6edf5" }}>
                      <td style={queueBodyCellStyle}>
                        <strong style={{ wordBreak: "break-word" }}>{item.id}</strong>
                      </td>
                      <td style={queueBodyCellStyle}>
                        <div style={{ fontWeight: 800, lineHeight: 1.35, wordBreak: "break-word" }}>
                          {item.employeeName || item.employeeNo}
                        </div>
                        {item.employeeNo ? (
                          <div style={{ marginTop: 4, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                            {item.employeeNo}
                          </div>
                        ) : null}
                      </td>
                      <td style={queueBodyCellStyle}>
                        <div style={{ lineHeight: 1.4, wordBreak: "break-word" }}>{item.purpose || "—"}</div>
                      </td>
                      <td style={queueBodyCellStyle}>{formatDate(item.issueDate)}</td>
                      <td style={queueBodyCellStyle}>{formatDateTime(item.generatedAt || item.submittedAt)}</td>
                      <td style={queueBodyCellStyle}>
                        <button
                          type="button"
                          onClick={() => toggleAuditTrail(item.id)}
                          style={auditToggleButtonStyle}
                        >
                          {expandedAuditTrailIds.includes(item.id) ? "Hide Audit Trail" : "Show Audit Trail"}
                        </button>
                        {expandedAuditTrailIds.includes(item.id) ? <AuditTrailSummary item={item} /> : null}
                      </td>
                      <td style={queueBodyCellStyle}>
                        <div style={{ display: "flex", alignItems: "flex-start" }}>
                          <StatusPill status={item.status} />
                        </div>
                      </td>
                      <td style={{ ...queueBodyCellStyle, textAlign: "right", verticalAlign: "top" }}>
                        {item.status === "Archived" ? (
                          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                            <span style={{ color: "#64748b", fontWeight: 800 }}>Archived</span>
                            <button type="button" onClick={() => handleViewQueuedCoe(item)} style={viewFileButtonStyle}>
                              View File
                            </button>
                            <button type="button" onClick={() => handleRestoreCoe(item.id)} style={restoreButtonStyle}>
                              Restore
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                            <button type="button" onClick={() => handleViewQueuedCoe(item)} style={viewFileButtonStyle}>
                              View File
                            </button>
                            {item.status !== "Approved" ? (
                              <button type="button" onClick={() => handleApproveCoe(item.id)} style={approveButtonStyle}>
                                Approve
                              </button>
                            ) : (
                              <span style={{ color: "#059669", fontWeight: 900, alignSelf: "center" }}>
                                Forwarded to Portal
                              </span>
                            )}

                            {item.status !== "Rejected" && item.status !== "Approved" ? (
                              <button type="button" onClick={() => handleRejectCoe(item.id)} style={rejectButtonStyle}>
                                Reject
                              </button>
                            ) : null}

                            <button type="button" onClick={() => handleArchiveCoe(item.id)} style={archiveButtonStyle}>
                              Archive
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "150px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div style={{ color: "#64748b", fontWeight: 800 }}>{label}</div>
      <div style={{ color: "#0f172a", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function AuditTrailSummary({ item }: { item: CoeHistoryItem }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        fontSize: 12,
        lineHeight: 1.45,
        marginTop: 10,
        padding: 10,
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#f8fafc",
      }}
    >
      {item.submittedByEmail ? (
        <div>
          <strong>Submitted:</strong> {item.submittedByName || "—"}<br />
          <span style={{ color: "#64748b" }}>{item.submittedByEmail}</span><br />
          <span style={{ color: "#64748b", fontWeight: 800 }}>{formatDateTime(item.submittedAt || item.generatedAt)}</span>
        </div>
      ) : null}

      {item.approvedByEmail ? (
        <div>
          <strong>Approved:</strong> {item.approvedByName || item.approvedBy || "—"}<br />
          <span style={{ color: "#64748b" }}>{item.approvedByEmail}</span><br />
          <span style={{ color: "#64748b", fontWeight: 800 }}>{formatDateTime(item.approvedAt)}</span>
        </div>
      ) : null}

      {item.rejectedByEmail ? (
        <div>
          <strong>Rejected:</strong> {item.rejectedByName || "—"}<br />
          <span style={{ color: "#64748b" }}>{item.rejectedByEmail}</span><br />
          <span style={{ color: "#64748b", fontWeight: 800 }}>{formatDateTime(item.rejectedAt)}</span>
        </div>
      ) : null}

      {item.archivedByEmail ? (
        <div>
          <strong>Archived:</strong> {item.archivedByName || "—"}<br />
          <span style={{ color: "#64748b" }}>{item.archivedByEmail}</span><br />
          <span style={{ color: "#64748b", fontWeight: 800 }}>{formatDateTime(item.archivedAt)}</span>
        </div>
      ) : null}

      {!item.submittedByEmail && !item.approvedByEmail && !item.rejectedByEmail && !item.archivedByEmail ? (
        <span style={{ color: "#64748b", fontWeight: 800 }}>No audit record</span>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: CoeHistoryItem["status"] }) {
  const normalized = String(status || "Draft");
  const lowerStatus = normalized.toLowerCase();

  const style: React.CSSProperties = lowerStatus.includes("approved")
    ? {
        border: "1px solid #bbf7d0",
        background: "#dcfce7",
        color: "#047857",
      }
    : lowerStatus.includes("reject")
      ? {
          border: "1px solid #fecdd3",
          background: "#fff1f2",
          color: "#be123c",
        }
      : lowerStatus.includes("archive")
        ? {
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            color: "#64748b",
          }
        : lowerStatus.includes("subject")
          ? {
              border: "1px solid #fde68a",
              background: "#fffbeb",
              color: "#b45309",
            }
          : {
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              color: "#475569",
            };

  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {normalized}
    </span>
  );
}


const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 8,
  color: "#334155",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "11px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ef",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 24px -22px rgba(8,47,73,0.65)",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid var(--report-accent)",
  background: "var(--report-accent)",
  color: "var(--report-button-text)",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 18px 35px -20px rgba(14,116,144,0.8)",
};


const secondaryButtonStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid #dbe4ef",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 28px -22px rgba(8,47,73,0.75)",
};

const panelStyle: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.88)",
  borderRadius: 16,
  padding: 18,
  boxShadow: "0 14px 38px -32px rgba(8, 47, 73, 0.78)",
};

const queueHeaderCellStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #dbe4ef",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  verticalAlign: "middle",
  whiteSpace: "normal",
  lineHeight: 1.25,
};

const queueBodyCellStyle: React.CSSProperties = {
  padding: "14px",
  color: "#0f172a",
  verticalAlign: "top",
  lineHeight: 1.45,
  borderBottom: "1px solid #e6edf5",
};

const approveButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #059669",
  background: "#059669",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 110,
  textAlign: "center",
};

const rejectButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #fecdd3",
  background: "#fff1f2",
  color: "#be123c",
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 110,
  textAlign: "center",
};

const archiveButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 110,
  textAlign: "center",
};

const restoreButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #bae6fd",
  background: "#f0f9ff",
  color: "#0a4f8f",
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 110,
  textAlign: "center",
};

const auditToggleButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 900,
  cursor: "pointer",
  fontSize: 12,
};

const viewFileButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid #0a4f8f",
  background: "#0a4f8f",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 110,
  textAlign: "center",
};


const paragraphStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.9,
  textAlign: "justify",
  marginBottom: 28,
  color: "#0f172a",
};
