"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, ClipboardList, FileText, FolderOpen, LayoutDashboard, LogOut, User } from "lucide-react";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems, upsertCollectionItem } from "@/lib/firestore";

type MoneyLike = number | string | undefined | null;

type CustomAmountItem = {
  id?: string;
  name?: string;
  label?: string;
  amount?: MoneyLike;
};

type EmployeeRecord = {
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  gender?: string;
  department?: string;
  designation?: string;
  position?: string;
  jobTitle?: string;
  employeeType?: string;
  employmentClassification?: string;
  employmentStatus?: string;
  company?: string;
  userType?: string;
  jobCode?: string;
  jobGrade?: string;
  costName?: string;
  eligibility?: string;
  isMinimumWageEarner?: string;
  basicPay?: MoneyLike;
  monthlyRate?: MoneyLike;
  hourlyRate?: MoneyLike;
  riceSubsidy?: MoneyLike;
  riceAllowance?: MoneyLike;
  uniformClothingAllowance?: MoneyLike;
  uniformClothing?: MoneyLike;
  uniformAllowance?: MoneyLike;
  laundryAllowance?: MoneyLike;
  actualMedicalAssistance?: MoneyLike;
  medicalCashAllowanceToDependents?: MoneyLike;
  medicalCashDependents?: MoneyLike;
  mealAllowance?: MoneyLike;
  mealAllowanceOTNight?: MoneyLike;
  christmasAnniversaryGifts?: MoneyLike;
  achievementAwards?: MoneyLike;
  thirteenthMonthPay?: MoneyLike;
  christmasBonus?: MoneyLike;
  otherAllowanceName?: string;
  otherAllowanceAmount?: MoneyLike;
  customAllowances?: CustomAmountItem[];
  immediateSupervisor?: string;
  designatedWorkplace?: string;
  hireDate?: string;
  expectedRegularizationDate?: string;
  regularizationDate?: string;
  expectedSeparationDate?: string;
  separationDate?: string;
  reasonForLeaving?: string;
  employeeRemarks?: string;
  biometricId?: string;
  payrollRunType?: string;
  shiftType?: string;
  payslipId?: string;
  birthdate?: string;
  contactNumber?: string;
  emailAddress?: string;
  address?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  sss?: string;
  sssNumber?: string;
  sssNo?: string;
  philhealth?: string;
  philhealthNumber?: string;
  philHealthNumber?: string;
  philhealthNo?: string;
  philHealthNo?: string;
  phicNumber?: string;
  phicNo?: string;
  pagibig?: string;
  pagibigNumber?: string;
  pagIbigNumber?: string;
  pagibigNo?: string;
  pagIbigNo?: string;
  hdmfNumber?: string;
  hdmfNo?: string;
  tin?: string;
  tinNumber?: string;
  employeePhotoDataUrl?: string;
  portalUsername?: string;
  portalPassword?: string;
  mustChangePassword?: boolean;
  portalStatus?: "Active" | "Locked" | "Disabled";
  lastPasswordChangedAt?: string;
};

type LeaveRequest = {
  id?: string;
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  status?: string;
  managerStatus?: string;
  hrStatus?: string;
  createdAt?: string;
};

type LeavePolicy = {
  id: string;
  leaveType: string;
  applicableTo?: string;
  genderApplicability?: string;
  employmentStatusApplicability?: string;
  specificEmployeeNos?: string[];
  annualDays?: number;
  eligibilityMonths?: number;
  paid?: boolean;
  convertible?: boolean;
  carryOver?: boolean;
  maxCarryOverDays?: number;
  replenishesYearEnd?: boolean;
  allowHalfDay?: boolean;
  allowNegativeBalance?: boolean;
  deductIfUnpaid?: boolean;
  governmentMandated?: boolean;
  active?: boolean;
  archived?: boolean;
  policyStatus?: "Draft" | "Saved" | "Checked" | "Approved";
  preparedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
};

type LeaveMonetizationRequest = {
  id: string;
  employeeNo: string;
  employeeName: string;
  leaveType: string;
  requestedDays: number;
  reason?: string;
  dateFiled: string;
  managerApprovedAt?: string;
  hrApprovedAt?: string;
  payrollReference?: string;
  status: "Pending Manager Approval" | "Pending HR Approval" | "Approved" | "Assigned to Payroll" | "Posted" | "Rejected";
  createdAt: string;
};

type EmployeePayslipDocument = {
  id?: string;
  documentId?: string;
  recordId?: string;
  payrollRecordId?: string;
  payrollReference?: string;
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  payrollDate?: string;
  payDate?: string;
  month?: string;
  year?: string | number;
  payrollPeriod?: string;
  payPeriod?: string;
  period?: string;
  grossPay?: MoneyLike;
  totalDeductions?: MoneyLike;
  deductions?: MoneyLike;
  netPay?: MoneyLike;
  finalNetPay?: MoneyLike;
  adjustedNetPay?: MoneyLike;
  taxAnnualizationAdjustment?: MoneyLike;
  yearEndTaxAdjustment?: MoneyLike;
  annualizationTaxAdjustment?: MoneyLike;
  annualizedTaxAdjustment?: MoneyLike;
  finalTaxAdjustment?: MoneyLike;
  taxAnnualizationType?: string;
  taxAnnualizationYear?: string | number;
  title?: string;
  fileName?: string;
  html?: string;
  printableHtml?: string;
  documentHtml?: string;
  payslipHtml?: string;
  createdAt?: string;
  generatedAt?: string;
  status?: string;
};

type PayrollRecord = {
  id?: string;
  employeeNo?: string;
  employeeId?: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  position?: string;
  designation?: string;
  jobTitle?: string;
  payrollReference?: string;
  payrollRun?: string;
  payrollRunId?: string;
  bulkRunId?: string;
  payrollRunName?: string;
  runName?: string;
  cutoffName?: string;
  name?: string;
  title?: string;
  label?: string;
  payrollDate?: string;
  actualPayrollDate?: string;
  payDate?: string;
  cutoffLabel?: string;
  cutoffType?: string;
  runType?: string;
  payrollFrequency?: string;
  payrollPeriod?: string;
  periodName?: string;
  payPeriod?: string;
  periodCovered?: string;
  payCoverage?: string;
  coverage?: string;
  coveragePeriod?: string;
  cutoffStartDate?: string;
  cutoffEndDate?: string;
  periodStartDate?: string;
  periodEndDate?: string;
  startDate?: string;
  endDate?: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
  month?: string;
  year?: string | number;
  grossPay?: MoneyLike;
  taxableIncome?: MoneyLike;
  basicPay?: MoneyLike;
  regularPay?: MoneyLike;
  regularHours?: MoneyLike;
  hourlyRate?: MoneyLike;
  monthlyRate?: MoneyLike;
  overtimePay?: MoneyLike;
  overtimeHours?: MoneyLike;
  overtimeAmount?: MoneyLike;
  nightDifferentialPay?: MoneyLike;
  nightDifferentialHours?: MoneyLike;
  nightDiffHours?: MoneyLike;
  nightDifferentialAmount?: MoneyLike;
  holidayPay?: MoneyLike;
  holidayHours?: MoneyLike;
  restDayHours?: MoneyLike;
  restDayAmount?: MoneyLike;
  specialHolidayHours?: MoneyLike;
  specialHolidayAmount?: MoneyLike;
  premiumPay?: MoneyLike;
  premium?: MoneyLike;
  totalPayrollPremium?: MoneyLike;
  allowance?: MoneyLike;
  allowances?: MoneyLike;
  totalAllowance?: MoneyLike;
  totalAllowances?: MoneyLike;
  riceSubsidy?: MoneyLike;
  riceAllowance?: MoneyLike;
  rice?: MoneyLike;
  uniformClothing?: MoneyLike;
  uniformClothingAllowance?: MoneyLike;
  uniformAllowance?: MoneyLike;
  laundryAllowance?: MoneyLike;
  laundry?: MoneyLike;
  medicalCashDependents?: MoneyLike;
  medicalCashAllowanceToDependents?: MoneyLike;
  actualMedicalAssistance?: MoneyLike;
  achievementAwards?: MoneyLike;
  christmasAnniversaryGifts?: MoneyLike;
  mealAllowanceOTNight?: MoneyLike;
  mealAllowance?: MoneyLike;
  meal?: MoneyLike;
  monetizedLeavePrivate?: MoneyLike;
  cbaProductivityIncentives?: MoneyLike;
  thirteenthMonthPay?: MoneyLike;
  thirteenthMonth?: MoneyLike;
  thirteenMonthPay?: MoneyLike;
  christmasBonus?: MoneyLike;
  otherTaxableAllowances?: MoneyLike;
  customPremiums?: CustomAmountItem[];
  customAllowances?: CustomAmountItem[];
  customDeductions?: CustomAmountItem[];
  netPay?: MoneyLike;
  finalNetPay?: MoneyLike;
  adjustedNetPay?: MoneyLike;
  taxAnnualizationAdjustment?: MoneyLike;
  yearEndTaxAdjustment?: MoneyLike;
  annualizationTaxAdjustment?: MoneyLike;
  annualizedTaxAdjustment?: MoneyLike;
  finalTaxAdjustment?: MoneyLike;
  taxAnnualizationType?: string;
  taxAnnualizationYear?: string | number;
  totalDeductions?: MoneyLike;
  deductions?: MoneyLike;
  withholdingTax?: MoneyLike;
  tax?: MoneyLike;
  totalAbsences?: MoneyLike;
  employeeAdvances?: MoneyLike;
  cashAdvances?: MoneyLike;
  sssLoanRepayment?: MoneyLike;
  hdmfLoanRepayment?: MoneyLike;
  sssEe?: MoneyLike;
  sssEmployee?: MoneyLike;
  philhealthEe?: MoneyLike;
  philhealthEmployee?: MoneyLike;
  phicEe?: MoneyLike;
  pagibigEe?: MoneyLike;
  pagibigEmployee?: MoneyLike;
  hdmfEe?: MoneyLike;
  loans?: MoneyLike;
  loanDeduction?: MoneyLike;
  otherDeductions?: MoneyLike;
  otherDeduction?: MoneyLike;
  employerContributions?: MoneyLike;
  status?: string;
  approvalStatus?: string;
  payrollStatus?: string;
  runStatus?: string;
  approvedStatus?: string;
  approvedAt?: string;
  lockedAt?: string;
  approvedByName?: string;
  approvedBy?: string;
  archiveStatus?: "Active" | "Archived";
  transportationAllowance?: MoneyLike;
  transportAllowance?: MoneyLike;
  transport?: MoneyLike;
  internetAllowance?: MoneyLike;
  internet?: MoneyLike;
  medicalAllowance?: MoneyLike;
  medical?: MoneyLike;
  createdAt?: string;
};

type ChangeRequest = {
  id: string;
  employeeNo: string;
  employeeName: string;
  requestType: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
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
  status?: "Draft" | "Subject for Approval" | "Approved" | "Rejected" | "Archived";
  submittedAt?: string;
  submittedByName?: string;
  submittedByEmail?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
};

type CompanyProfile = {
  companyName?: string;
  businessName?: string;
  registeredName?: string;
  registeredBusinessName?: string;
  legalName?: string;
  tradeName?: string;
  name?: string;
  address?: string;
  companyAddress?: string;
  businessAddress?: string;
  registeredAddress?: string;
  email?: string;
  emailAddress?: string;
  companyEmail?: string;
  primaryEmail?: string;
  contactNumber?: string;
  phone?: string;
  mobileNumber?: string;
  telephoneNumber?: string;
  logoDataUrl?: string;
  companyLogoDataUrl?: string;
  logo?: string;
};

type Signatories = {
  approvedCoeName?: string;
  approvedCoePosition?: string;
  approvedCoeSignatureDataUrl?: string;
  coeName?: string;
  coePosition?: string;
  coeSignatureDataUrl?: string;
  authorizedRepresentativeName?: string;
  authorizedRepresentativePosition?: string;
  authorizedRepresentativeSignatureDataUrl?: string;
  hrSignatoryName?: string;
  hrSignatoryPosition?: string;
  hrSignatureDataUrl?: string;
  name?: string;
  position?: string;
  signatureDataUrl?: string;
  approvedBySignature?: string;
  authorizedRepSignature?: string;
  checkedBySignature?: string;
  preparedBySignature?: string;
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
};

type TabKey = "dashboard" | "details" | "attendance" | "changes" | "leaves" | "payslips" | "documents";

type SavedYearEndAnnualizationFileStatus = {
  year?: string | number;
  archived?: boolean;
};

const STORAGE_KEYS = {
  employees: "employees",
  leaveRequests: "leaveRequests",
  leavePolicies: "leavePolicies",
  payrollRecords: "payrollRecords",
  employeePayslipDocuments: "employeePayslipDocuments",
  employeeChangeRequests: "employeeChangeRequests",
  coeHistory: "coeHistory",
  companyProfile: "companyProfile",
  signatories: "signatories",
};

const LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY = "leaveMonetizationRequests";
const LEAVE_MONETIZATION_WINDOW_STORAGE_KEY = "leaveMonetizationWindow";
const YEAR_END_ANNUALIZATION_FILES_KEY = "yearEndTaxAnnualizationFiles";

function normalizePortalUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

async function readStorage<T>(key: string, fallback: T): Promise<T> {
  if (key === STORAGE_KEYS.employees) return await getCollectionItems<EmployeeRecord>(storageKeys.employees) as T;
  if (key === STORAGE_KEYS.payrollRecords) return await getCollectionItems<PayrollRecord>(storageKeys.payrollRecords) as T;
  if (key === STORAGE_KEYS.coeHistory) return await getDataArray<CoeHistoryItem>(storageKeys.coeHistory, []) as T;
  return await getDataArray<unknown>(key, Array.isArray(fallback) ? [] : []) as T;
}

async function saveStorage<T>(key: string, value: T) {
  if (key === STORAGE_KEYS.employees && Array.isArray(value)) {
    await setCollectionItems(storageKeys.employees, value.map((item) => ({ ...(item as EmployeeRecord), id: (item as EmployeeRecord).employeeNo })));
    return;
  }
  await setDataArray(key, Array.isArray(value) ? value : [value]);
}

async function readAnyStorage<T>(keys: string[], fallback: T): Promise<T> {
  for (const key of keys) {
    const parsed = await getConfigItem<T | null>(key, null);
    if (parsed) return parsed;
  }
  return fallback;
}

function toMoneyNumber(value?: MoneyLike) {
  const parsed = Number(String(value ?? "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function peso(value?: MoneyLike) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toMoneyNumber(value));
}

function formatPlainMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function displayText(value?: string | number | null) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function firstTextValue(...values: Array<string | undefined | null>) {
  return values.find((value) => String(value || "").trim())?.trim() || "";
}

function escapeHtml(value?: string | number | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
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

function formatPortalClockTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatElapsedTime(startValue?: string, endValue?: string) {
  if (!startValue) return "00:00:00";
  const start = new Date(startValue).getTime();
  const end = endValue ? new Date(endValue).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "00:00:00";

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatFormalDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "2-digit" });
}

function getFullName(employee: EmployeeRecord) {
  return [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(" ");
}

function getEmployeeDisplayNameForPortal(employee: EmployeeRecord) {
  return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(", ");
}

function getCoeDisplayName(employee: EmployeeRecord) {
  return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(", ");
}

function getBirStatusText(value?: string) {
  const normalized = String(value || "").trim().toUpperCase();
  const statusMap: Record<string, string> = {
    R: "R - Regular",
    C: "C - Casual",
    CP: "CP - Contractual / Project-Based",
    S: "S - Seasonal",
    P: "P - Probationary",
    AL: "AL - Apprentice / Learner",
  };
  return statusMap[normalized] || displayText(value);
}

function getEmployeeStatusForLeave(employee: EmployeeRecord) {
  return String(employee.employmentStatus || employee.employmentClassification || employee.employeeType || "").trim();
}

function leavePolicyAppliesToEmployee(policy: LeavePolicy, employee: EmployeeRecord) {
  const basis = policy.applicableTo || "All employees";
  const ruleValue = String(policy.employmentStatusApplicability || "").trim();

  if (basis === "All employees" || basis === "Covered employees") return true;

  if (basis === "By department") {
    return Boolean(ruleValue) && String(employee.department || "").trim() === ruleValue;
  }

  if (basis === "By gender") {
    return Boolean(ruleValue) && String(employee.gender || "").trim() === ruleValue;
  }

  if (basis === "By employment status") {
    return Boolean(ruleValue) && getEmployeeStatusForLeave(employee) === ruleValue;
  }

  if (basis === "Specific employees") {
    return (policy.specificEmployeeNos || []).includes(employee.employeeNo);
  }

  return true;
}

function leavePolicyDescription(policy: LeavePolicy) {
  const rules = [
    `${toMoneyNumber(policy.annualDays).toFixed(2)} annual day(s)`,
    `${toMoneyNumber(policy.eligibilityMonths).toFixed(0)} eligibility month(s)`,
    policy.paid ? "Paid leave" : "Unpaid leave",
    policy.convertible ? "Convertible" : "Not convertible",
    policy.carryOver ? `Carry over allowed up to ${toMoneyNumber(policy.maxCarryOverDays).toFixed(2)} day(s)` : "No carry over",
    policy.replenishesYearEnd ? "Replenishes year-end" : "No year-end replenishment",
    policy.allowHalfDay ? "Half-day allowed" : "Full-day only",
  ];
  return rules.join(" • ");
}

function getPortalLeaveRequestDays(request: LeaveRequest) {
  const startValue = request.startDate || "";
  const endValue = request.endDate || "";
  if (!startValue || !endValue) return 0;

  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}

function isPortalLeaveApproved(request: LeaveRequest) {
  return String(request.status || request.hrStatus || request.managerStatus || "").toLowerCase().includes("approved");
}

function isPortalLeavePending(request: LeaveRequest) {
  return String(request.status || request.hrStatus || request.managerStatus || "").toLowerCase().includes("pending");
}

function getPortalPhotoInitials(employee?: EmployeeRecord | null) {
  if (!employee) return "EP";
  const firstInitial = String(employee.firstName || "").trim().charAt(0).toUpperCase();
  const lastInitial = String(employee.lastName || "").trim().charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`.trim() || "EP";
}

function maskAccountNumber(value?: string) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "—";
  if (cleanValue.length <= 4) return cleanValue;
  return `${"•".repeat(Math.max(cleanValue.length - 4, 0))}${cleanValue.slice(-4)}`;
}

function normalizeMoneyItems(items: unknown, defaultLabel: string) {
  return Array.isArray(items)
    ? items
        .map((item) => {
          const sourceItem = item as CustomAmountItem;
          return {
            label: String(sourceItem.name || sourceItem.label || defaultLabel).trim() || defaultLabel,
            amount: toMoneyNumber(sourceItem.amount),
          };
        })
        .filter((item) => Math.abs(item.amount) >= 0.01)
    : [];
}

function getPortalAllowanceRows(employee?: EmployeeRecord | null) {
  if (!employee) return [];
  const source = employee as EmployeeRecord & Record<string, MoneyLike>;

  const standardAllowances = [
    { label: "Rice Subsidy", amount: toMoneyNumber(source.riceSubsidy || source.riceAllowance || 0) },
    { label: "Uniform / Clothing Allowance", amount: toMoneyNumber(source.uniformClothingAllowance || source.uniformClothing || source.uniformAllowance || 0) },
    { label: "Laundry Allowance", amount: toMoneyNumber(source.laundryAllowance || 0) },
    { label: "Actual Medical Assistance", amount: toMoneyNumber(source.actualMedicalAssistance || 0) },
    { label: "Medical Cash Allowance to Dependents", amount: toMoneyNumber(source.medicalCashAllowanceToDependents || source.medicalCashDependents || 0) },
    { label: "Meal Allowance", amount: toMoneyNumber(source.mealAllowance || source.mealAllowanceOTNight || 0) },
    { label: "Christmas / Anniversary Gifts", amount: toMoneyNumber(source.christmasAnniversaryGifts || 0) },
    { label: "Achievement Awards", amount: toMoneyNumber(source.achievementAwards || 0) },
  ];

  const customAllowances = normalizeMoneyItems(employee.customAllowances, "Custom Allowance");

  const legacyOtherAllowance =
    customAllowances.length === 0 && (employee.otherAllowanceName || toMoneyNumber(employee.otherAllowanceAmount) > 0)
      ? [{ label: String(employee.otherAllowanceName || "Other Allowance"), amount: toMoneyNumber(employee.otherAllowanceAmount) }]
      : [];

  return [...standardAllowances, ...customAllowances, ...legacyOtherAllowance].filter(
    (allowance) => Math.abs(allowance.amount) >= 0.01
  );
}

function getEmployeeAllowanceRows(employee?: EmployeeRecord | null) {
  return getPortalAllowanceRows(employee).map((allowance) => ({
    label: allowance.label,
    monthly: allowance.amount,
    annual: allowance.amount * 12,
  }));
}

function getPortalBasicPay(employee?: EmployeeRecord | null) {
  if (!employee) return 0;
  return toMoneyNumber(employee.basicPay || employee.monthlyRate || 0);
}

function getPortalTotalAllowance(employee?: EmployeeRecord | null) {
  return getPortalAllowanceRows(employee).reduce((sum, allowance) => sum + allowance.amount, 0);
}

function getPortalTotalMonthlyPackage(employee?: EmployeeRecord | null) {
  return getPortalBasicPay(employee) + getPortalTotalAllowance(employee);
}

function buildCompensationTableHtml(rows: Array<{ label: string; monthly: number; annual: number }>, totalLabel?: string) {
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
      <tbody>${bodyRows}${totalRow}</tbody>
    </table>
  `;
}

function monthNameToIndex(value?: string | number) {
  const normalized = String(value || "").trim().toLowerCase();
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const index = months.findIndex((month) => month === normalized || month.startsWith(normalized.slice(0, 3)));
  return index >= 0 ? index : -1;
}

function monthYearFromDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long" });
}

function getPayslipMonthYear(document: Partial<EmployeePayslipDocument>, fallbackPayroll?: PayrollRecord) {
  const explicitMonth = String(document.month || fallbackPayroll?.month || "").trim();
  const explicitYear = String(document.year || fallbackPayroll?.year || "").trim();
  if (explicitMonth && explicitYear) return `${explicitMonth} ${explicitYear}`;

  const fromDate = monthYearFromDate(
    String(document.payrollDate || document.payDate || fallbackPayroll?.payrollDate || fallbackPayroll?.payDate || "")
  );
  return fromDate || "Payslip";
}

function getPayslipCutoff(document: Partial<EmployeePayslipDocument>, fallbackPayroll?: PayrollRecord) {
  return (
    firstTextValue(
      document.payrollPeriod,
      document.payPeriod,
      document.period,
      fallbackPayroll?.payrollPeriod,
      fallbackPayroll?.payPeriod,
      fallbackPayroll?.cutoffLabel,
      fallbackPayroll?.cutoffName,
      fallbackPayroll?.periodName
    ) || "Payroll Period"
  );
}

function getPayslipSortTime(document: EmployeePayslipDocument, payrolls: PayrollRecord[]) {
  const matchedPayroll = payrolls.find(
    (payroll) =>
      String(payroll.id || "") === String(document.recordId || document.payrollRecordId || "") ||
      String(payroll.payrollReference || payroll.payrollRun || "") === String(document.payrollReference || "")
  );

  const explicitYear = Number(String(document.year || matchedPayroll?.year || "").trim());
  const explicitMonthIndex = monthNameToIndex(document.month || matchedPayroll?.month);
  if (Number.isFinite(explicitYear) && explicitYear > 0 && explicitMonthIndex >= 0) {
    const cutoff = getPayslipCutoff(document, matchedPayroll).toLowerCase();
    const cutoffDay = cutoff.includes("second") || cutoff.includes("2nd") ? 31 : 15;
    return new Date(explicitYear, explicitMonthIndex, cutoffDay).getTime();
  }

  const dateSource = firstTextValue(
    matchedPayroll?.coverageEndDate,
    matchedPayroll?.cutoffEndDate,
    matchedPayroll?.periodEndDate,
    matchedPayroll?.endDate,
    document.payrollDate,
    document.payDate,
    matchedPayroll?.payrollDate,
    matchedPayroll?.actualPayrollDate,
    matchedPayroll?.payDate
  );
  const parsed = new Date(dateSource).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRawYearEndTaxAdjustment(record: PayrollRecord | EmployeePayslipDocument) {
  const explicitAdjustment = toMoneyNumber(
    record.taxAnnualizationAdjustment ??
      record.yearEndTaxAdjustment ??
      record.annualizationTaxAdjustment ??
      record.annualizedTaxAdjustment ??
      record.finalTaxAdjustment ??
      0
  );

  if (Math.abs(explicitAdjustment) >= 0.01) return explicitAdjustment;

  const adjustedNetPay = toMoneyNumber(record.adjustedNetPay);
  const regularNetPay = toMoneyNumber(record.netPay ?? record.finalNetPay);

  if (Math.abs(adjustedNetPay) >= 0.01 && Math.abs(regularNetPay) >= 0.01) return adjustedNetPay - regularNetPay;
  return 0;
}

function hasActiveYearEndTaxAnnualizationFile(year?: string | number) {
  const targetYear = String(year || "").trim();
  if (!targetYear) return false;
  return true;
}

function getVisibleYearEndTaxAdjustment(record: PayrollRecord | EmployeePayslipDocument) {
  const adjustment = getRawYearEndTaxAdjustment(record);
  if (Math.abs(adjustment) < 0.01) return 0;
  return hasActiveYearEndTaxAnnualizationFile(record.taxAnnualizationYear || record.year) ? adjustment : 0;
}

function getYearEndTaxAdjustmentLabel(amount: number) {
  if (amount > 0) return "YEAR-END TAX REFUND";
  if (amount < 0) return "YEAR-END ADDITIONAL TAX";
  return "YEAR-END TAX ADJUSTMENT";
}

function statusTone(status?: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("approved") || normalized.includes("locked")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized.includes("reject") || normalized.includes("decline")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized.includes("pending") || normalized.includes("review")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

async function updateEmployeePortalPhoto(employees: EmployeeRecord[], employeeNo: string, photoDataUrl: string) {
  const nextEmployees = employees.map((item) =>
    String(item.employeeNo || "").toLowerCase() === employeeNo.toLowerCase()
      ? { ...item, employeePhotoDataUrl: photoDataUrl }
      : item
  );

  await saveStorage(STORAGE_KEYS.employees, nextEmployees);
  window.dispatchEvent(new Event(`${STORAGE_KEYS.employees}-updated`));
  window.dispatchEvent(new Event("employees-updated"));
  return nextEmployees;
}

function PortalInfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{value || "—"}</div>
    </div>
  );
}

function PortalDetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function PortalPhotoCard({ employee, onPhotoChange }: { employee: EmployeeRecord; onPhotoChange: (dataUrl: string) => void }) {
  function handlePhotoUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please upload an image file only.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => onPhotoChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {employee.employeePhotoDataUrl ? (
                <img src={employee.employeePhotoDataUrl} alt="Employee profile photo" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#0a4f8f] to-[#0c3460] text-2xl font-semibold text-white">
                  {getPortalPhotoInitials(employee)}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Profile Photo</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{getEmployeeDisplayNameForPortal(employee)}</div>
              <div className="mt-0.5 text-sm text-slate-500">Employee No. {displayText(employee.employeeNo)}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]">
              Change Photo
              <input type="file" accept="image/*" onChange={(event) => handlePhotoUpload(event.target.files?.[0] || null)} className="hidden" />
            </label>
            {employee.employeePhotoDataUrl ? (
              <button type="button" onClick={() => onPhotoChange("")} className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
                Remove Photo
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="px-5 py-3 text-sm text-slate-500">
        You may update your profile photo here. Other details are view-only — submit a change request to HR for corrections.
      </div>
    </div>
  );
}

export default function EmployeePortalPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([]);
  const [leaveMonetizationRequests, setLeaveMonetizationRequests] = useState<LeaveMonetizationRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [employeePayslipDocuments, setEmployeePayslipDocuments] = useState<EmployeePayslipDocument[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [coeHistory, setCoeHistory] = useState<CoeHistoryItem[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({});
  const [signatories, setSignatories] = useState<Signatories>({});
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loggedEmployeeNo, setLoggedEmployeeNo] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestType, setRequestType] = useState("Contact Number");
  const [currentValue, setCurrentValue] = useState("");
  const [requestedValue, setRequestedValue] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [selectedLeavePolicyId, setSelectedLeavePolicyId] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [monetizationWindowFrom, setMonetizationWindowFrom] = useState("");
  const [monetizationWindowTo, setMonetizationWindowTo] = useState("");
  const [selectedMonetizationLeavePolicyId, setSelectedMonetizationLeavePolicyId] = useState("");
  const [monetizationRequestedDays, setMonetizationRequestedDays] = useState("");
  const [monetizationReason, setMonetizationReason] = useState("");

  const [demoClockStatus, setDemoClockStatus] = useState<"Not Timed In" | "Timed In" | "Completed">("Not Timed In");
  const [demoTimeInAt, setDemoTimeInAt] = useState("");
  const [demoTimeOutAt, setDemoTimeOutAt] = useState("");
  const [demoNow, setDemoNow] = useState(new Date());

  useEffect(() => {
    const possibleHeaders = Array.from(document.querySelectorAll("header, nav"));
    const hiddenElements: HTMLElement[] = [];

    possibleHeaders.forEach((element) => {
      const htmlElement = element as HTMLElement;
      const text = htmlElement.innerText || "";
      if (text.includes("Axis Payroll System") || (text.includes("Payroll Runs") && text.includes("Reports") && text.includes("Users"))) {
        htmlElement.dataset.employeePortalHidden = "true";
        htmlElement.style.display = "none";
        hiddenElements.push(htmlElement);
      }
    });

    document.body.dataset.employeePortalPage = "true";

    return () => {
      hiddenElements.forEach((element) => {
        if (element.dataset.employeePortalHidden === "true") {
          element.style.display = "";
          delete element.dataset.employeePortalHidden;
        }
      });
      delete document.body.dataset.employeePortalPage;
    };
  }, []);

  useEffect(() => {
    async function refreshPortalData() {
      setEmployees(await readStorage<EmployeeRecord[]>(STORAGE_KEYS.employees, []));
      setLeaveRequests(await readStorage<LeaveRequest[]>(STORAGE_KEYS.leaveRequests, []));
      setLeavePolicies(await readStorage<LeavePolicy[]>(STORAGE_KEYS.leavePolicies, []));
      setLeaveMonetizationRequests(await readStorage<LeaveMonetizationRequest[]>(LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY, []));
      const storedMonetizationWindow = await getConfigItem<{ dateFrom?: string; dateTo?: string; locked?: boolean }>(LEAVE_MONETIZATION_WINDOW_STORAGE_KEY, { dateFrom: "", dateTo: "", locked: true });
      setMonetizationWindowFrom(storedMonetizationWindow.dateFrom || "");
      setMonetizationWindowTo(storedMonetizationWindow.dateTo || "");
      setPayrollRecords(await readStorage<PayrollRecord[]>(STORAGE_KEYS.payrollRecords, []));
      setEmployeePayslipDocuments(await readStorage<EmployeePayslipDocument[]>(STORAGE_KEYS.employeePayslipDocuments, []));
      setChangeRequests(await readStorage<ChangeRequest[]>(STORAGE_KEYS.employeeChangeRequests, []));
      setCoeHistory(await readStorage<CoeHistoryItem[]>(STORAGE_KEYS.coeHistory, []));
      setCompanyProfile(await readAnyStorage<CompanyProfile>([storageKeys.companyInformation, STORAGE_KEYS.companyProfile, "companySettings", "businessProfile"], {}));
      setSignatories(await readAnyStorage<Signatories>([storageKeys.signatories, STORAGE_KEYS.signatories, "companySignatories", "authorizedSignatories", "signatorySettings"], {}));
    }

    refreshPortalData();
    const eventNames = [
      `${STORAGE_KEYS.coeHistory}-updated`,
      `${STORAGE_KEYS.companyProfile}-updated`,
      `${STORAGE_KEYS.signatories}-updated`,
      `${STORAGE_KEYS.employees}-updated`,
      `${STORAGE_KEYS.leaveRequests}-updated`,
      `${STORAGE_KEYS.leavePolicies}-updated`,
      "leave-monetization-requests-updated",
      "leave-monetization-window-updated",
      `${STORAGE_KEYS.payrollRecords}-updated`,
      `${STORAGE_KEYS.employeePayslipDocuments}-updated`,
      `${STORAGE_KEYS.employeeChangeRequests}-updated`,
      "employees-updated",
      "payroll-records-updated",
    ];

    eventNames.forEach((eventName) => window.addEventListener(eventName, refreshPortalData as EventListener));
    return () => eventNames.forEach((eventName) => window.removeEventListener(eventName, refreshPortalData as EventListener));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setDemoNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const employee = useMemo(
    () => employees.find((item) => item.employeeNo?.toLowerCase() === loggedEmployeeNo.toLowerCase()),
    [employees, loggedEmployeeNo]
  );

  const employeeName = employee ? getFullName(employee) : "";

  const myLeaves = useMemo(() => {
    return leaveRequests.filter((request) => String(request.employeeNo || request.employeeId || "").toLowerCase() === loggedEmployeeNo.toLowerCase());
  }, [leaveRequests, loggedEmployeeNo]);

  const myApprovedLeavePolicies = useMemo(() => {
    if (!employee) return [];
    return leavePolicies
      .filter((policy) =>
        policy.policyStatus === "Approved" &&
        policy.active !== false &&
        policy.archived !== true &&
        leavePolicyAppliesToEmployee(policy, employee)
      )
      .sort((a, b) => String(a.leaveType || "").localeCompare(String(b.leaveType || "")));
  }, [leavePolicies, employee]);

  const myConvertibleLeavePolicies = useMemo(() => {
    return myApprovedLeavePolicies.filter((policy) => policy.convertible === true);
  }, [myApprovedLeavePolicies]);

  const myLeaveMonetizationRequests = useMemo(() => {
    return leaveMonetizationRequests
      .filter((request) => String(request.employeeNo || "").toLowerCase() === loggedEmployeeNo.toLowerCase())
      .sort((a, b) => new Date(b.createdAt || b.dateFiled).getTime() - new Date(a.createdAt || a.dateFiled).getTime());
  }, [leaveMonetizationRequests, loggedEmployeeNo]);

  const isMonetizationWindowOpen = useMemo(() => {
    if (!monetizationWindowFrom || !monetizationWindowTo) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(monetizationWindowFrom);
    const end = new Date(monetizationWindowTo);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && today >= start && today <= end;
  }, [monetizationWindowFrom, monetizationWindowTo]);

  const myPayrolls = useMemo(() => {
    return payrollRecords
      .filter((record) => {
        const recordEmployeeNo = String(record.employeeNo || record.employeeId || "").toLowerCase();
        const recordName = String(record.employeeName || "").toLowerCase();
        return record.archiveStatus !== "Archived" && (recordEmployeeNo === loggedEmployeeNo.toLowerCase() || Boolean(employeeName && recordName === employeeName.toLowerCase()));
      })
      .sort((a, b) => getPayrollSequenceValue(b) - getPayrollSequenceValue(a));
  }, [payrollRecords, loggedEmployeeNo, employeeName]);

  const myPayslipDocuments = useMemo(() => {
    const normalizedEmployeeNo = loggedEmployeeNo.toLowerCase();
    const normalizedEmployeeName = employeeName.toLowerCase();

    return employeePayslipDocuments
      .filter((document) => {
        const documentEmployeeNo = String(document.employeeNo || document.employeeId || "").toLowerCase();
        const documentEmployeeName = String(document.employeeName || "").toLowerCase();
        const documentStatus = String(document.status || "Approved").toLowerCase();
        return documentStatus !== "archived" && (documentEmployeeNo === normalizedEmployeeNo || Boolean(normalizedEmployeeName && documentEmployeeName === normalizedEmployeeName));
      })
      .sort((a, b) => getPayslipSortTime(b, payrollRecords) - getPayslipSortTime(a, payrollRecords));
  }, [employeePayslipDocuments, employeeName, loggedEmployeeNo, payrollRecords]);

  const myChangeRequests = useMemo(
    () => changeRequests.filter((request) => request.employeeNo.toLowerCase() === loggedEmployeeNo.toLowerCase()),
    [changeRequests, loggedEmployeeNo]
  );

  const myApprovedCoeDocuments = useMemo(() => {
    const normalizedEmployeeNo = loggedEmployeeNo.toLowerCase();
    const normalizedEmployeeName = employeeName.toLowerCase();

    return coeHistory.filter((item) => {
      const documentEmployeeNo = String(item.employeeNo || "").toLowerCase();
      const documentEmployeeName = String(item.employeeName || "").toLowerCase();
      const documentStatus = String(item.status || "").toLowerCase();
      return documentStatus === "approved" && (documentEmployeeNo === normalizedEmployeeNo || Boolean(normalizedEmployeeName && documentEmployeeName === normalizedEmployeeName));
    });
  }, [coeHistory, employeeName, loggedEmployeeNo]);

  function loginEmployee() {
    const username = normalizePortalUsername(usernameInput);
    const password = passwordInput.trim();
    if (!username || !password) {
      window.alert("Please enter your username and password.");
      return;
    }

    const foundEmployee = employees.find((item) => {
      const storedUsername = normalizePortalUsername(String(item.portalUsername || ""));
      const employeeNoUsername = normalizePortalUsername(String(item.employeeNo || ""));
      const storedPassword = String(item.portalPassword || "").trim();
      return (storedUsername === username || employeeNoUsername === username) && storedPassword === password;
    });

    if (!foundEmployee) {
      window.alert("Invalid username or password. Please try again or contact HR.");
      return;
    }

    if (foundEmployee.portalStatus === "Locked" || foundEmployee.portalStatus === "Disabled") {
      window.alert(`Your employee portal access is ${foundEmployee.portalStatus.toLowerCase()}. Please contact HR.`);
      return;
    }

    setLoggedEmployeeNo(foundEmployee.employeeNo);
  }

  function logoutEmployee() {
    setLoggedEmployeeNo("");
    setUsernameInput("");
    setPasswordInput("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function demoTimeIn() {
    const now = new Date().toISOString();
    setDemoClockStatus("Timed In");
    setDemoTimeInAt(now);
    setDemoTimeOutAt("");
  }

  function demoTimeOut() {
    if (!demoTimeInAt) return;
    setDemoClockStatus("Completed");
    setDemoTimeOutAt(new Date().toISOString());
  }

  function resetDemoAttendance() {
    setDemoClockStatus("Not Timed In");
    setDemoTimeInAt("");
    setDemoTimeOutAt("");
  }

  async function changePassword() {
    if (!employee) return;
    if (!newPassword.trim() || !confirmPassword.trim()) {
      window.alert("Please enter and confirm your new password.");
      return;
    }
    if (newPassword.trim().length < 8) {
      window.alert("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      window.alert("Passwords do not match.");
      return;
    }

    const updatedEmployee = {
      ...employee,
      portalPassword: newPassword,
      mustChangePassword: false,
      lastPasswordChangedAt: new Date().toISOString(),
    };

    try {
      // Write ONLY this employee's document so the new password is saved to the
      // database (visible to admins under Employees and used on the next login),
      // instead of rewriting the whole employees collection.
      await upsertCollectionItem(STORAGE_KEYS.employees, { ...updatedEmployee, id: updatedEmployee.employeeNo });
    } catch (error) {
      console.error("Failed to save new password", error);
      window.alert("Could not save your new password. Please try again or contact HR.");
      return;
    }

    setEmployees((current) =>
      current.map((item) => (item.employeeNo === employee.employeeNo ? updatedEmployee : item))
    );
    setNewPassword("");
    setConfirmPassword("");
    window.alert("Password changed successfully.");
  }

  async function submitChangeRequest() {
    if (!employee) return;
    if (!requestedValue.trim()) {
      window.alert("Please enter the requested change.");
      return;
    }

    const nextRequest: ChangeRequest = {
      id: `change-${Date.now()}`,
      employeeNo: employee.employeeNo,
      employeeName: getFullName(employee),
      requestType,
      currentValue: currentValue.trim(),
      requestedValue: requestedValue.trim(),
      reason: requestReason.trim(),
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    const nextRequests = [nextRequest, ...changeRequests];
    setChangeRequests(nextRequests);
    await saveStorage(STORAGE_KEYS.employeeChangeRequests, nextRequests);
    setCurrentValue("");
    setRequestedValue("");
    setRequestReason("");
    window.alert("Change request submitted to HR.");
  }

  // Leave filing function for employee portal
  async function submitLeaveRequestFromPortal() {
    if (!employee) return;

    const selectedPolicy = myApprovedLeavePolicies.find((policy) => policy.id === selectedLeavePolicyId);
    if (!selectedPolicy) {
      window.alert("Please select an approved leave type issued by HR/Management.");
      return;
    }

    if (!leaveStartDate || !leaveEndDate) {
      window.alert("Please select the leave start date and end date.");
      return;
    }

    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      window.alert("Please enter a valid leave date range.");
      return;
    }

    const nextRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeNo: employee.employeeNo,
      employeeId: employee.employeeNo,
      employeeName: getFullName(employee),
      leaveType: selectedPolicy.leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: leaveReason.trim(),
      status: "Pending Manager Approval",
      managerStatus: "Pending",
      hrStatus: "Pending",
      createdAt: new Date().toISOString(),
    };

    const nextRequests = [nextRequest, ...leaveRequests];
    setLeaveRequests(nextRequests);
    await saveStorage(STORAGE_KEYS.leaveRequests, nextRequests);
    window.dispatchEvent(new Event(`${STORAGE_KEYS.leaveRequests}-updated`));
    window.dispatchEvent(new Event("leave-requests-updated"));

    setSelectedLeavePolicyId("");
    setLeaveStartDate("");
    setLeaveEndDate("");
    setLeaveReason("");
    window.alert("Leave request submitted to HR/Management for approval.");
  }

  async function submitLeaveMonetizationRequestFromPortal() {
    if (!employee) return;

    if (!isMonetizationWindowOpen) {
      window.alert("Leave monetization filing is currently closed. Please wait for HR to open the filing window.");
      return;
    }

    const selectedPolicy = myConvertibleLeavePolicies.find((policy) => policy.id === selectedMonetizationLeavePolicyId);
    if (!selectedPolicy) {
      window.alert("Please select an approved convertible leave type.");
      return;
    }

    const requestedDays = toMoneyNumber(monetizationRequestedDays);
    if (requestedDays <= 0) {
      window.alert("Please enter the number of leave days to monetize.");
      return;
    }

    const maxAllowedDays = toMoneyNumber(selectedPolicy.annualDays);
    if (maxAllowedDays > 0 && requestedDays > maxAllowedDays) {
      window.alert(`Requested days cannot exceed ${maxAllowedDays.toFixed(2)} day(s) for this leave policy.`);
      return;
    }

    const nextRequest: LeaveMonetizationRequest = {
      id: `LM-${Date.now()}`,
      employeeNo: employee.employeeNo,
      employeeName: getFullName(employee),
      leaveType: selectedPolicy.leaveType,
      requestedDays,
      reason: monetizationReason.trim(),
      dateFiled: new Date().toISOString(),
      status: "Pending Manager Approval",
      createdAt: new Date().toISOString(),
    };

    const nextRequests = [nextRequest, ...leaveMonetizationRequests];
    setLeaveMonetizationRequests(nextRequests);
    await saveStorage(LEAVE_MONETIZATION_REQUESTS_STORAGE_KEY, nextRequests);
    window.dispatchEvent(new Event("leave-monetization-requests-updated"));

    setSelectedMonetizationLeavePolicyId("");
    setMonetizationRequestedDays("");
    setMonetizationReason("");
    window.alert("Leave monetization request submitted to Manager/HR for approval.");
  }

  async function handlePortalPhotoChange(dataUrl: string) {
    if (!employee) return;
    const nextEmployees = await updateEmployeePortalPhoto(employees, employee.employeeNo, dataUrl);
    setEmployees(nextEmployees);
  }

  function openStoredPayslipDocument(document: EmployeePayslipDocument) {
    const html = document.printableHtml || document.documentHtml || document.payslipHtml || document.html;
    if (!html) {
      const matchedPayroll = myPayrolls.find((payroll) => {
        const payrollId = String(payroll.id || "");
        const payrollReference = String(payroll.payrollReference || payroll.payrollRun || "");
        const documentRecordId = String(document.recordId || document.payrollRecordId || "");
        const documentReference = String(document.payrollReference || "");
        return Boolean(documentRecordId && payrollId === documentRecordId) || Boolean(documentReference && payrollReference === documentReference);
      });

      if (matchedPayroll) {
        openPayslipDocument(matchedPayroll);
        return;
      }

      window.alert("The payslip file is not available yet. Please ask HR to regenerate the payslip from the Payslips tab.");
      return;
    }

    const payslipWindow = window.open("", "_blank");
    if (!payslipWindow) {
      window.alert("Please allow pop-ups to view or download the payslip.");
      return;
    }
    payslipWindow.document.open();
    payslipWindow.document.write(html);
    payslipWindow.document.close();
  }

  async function openApprovedCoeDocument(document: CoeHistoryItem) {
    if (!employee) return;
    const latestSignatories = await readAnyStorage<Signatories>([storageKeys.signatories, STORAGE_KEYS.signatories, "companySignatories", "authorizedSignatories", "signatorySettings"], signatories);

    const companyName = firstTextValue(document.companyName, companyProfile.companyName, companyProfile.businessName, companyProfile.registeredName, companyProfile.registeredBusinessName, companyProfile.legalName, companyProfile.tradeName, companyProfile.name) || "Company Name";
    const companyAddress = firstTextValue(document.companyAddress, companyProfile.companyAddress, companyProfile.address, companyProfile.businessAddress, companyProfile.registeredAddress) || "Company Address";
    const companyEmail = firstTextValue(document.companyEmail, companyProfile.companyEmail, companyProfile.email, companyProfile.emailAddress, companyProfile.primaryEmail);
    const companyContact = firstTextValue(document.companyContactNumber, companyProfile.contactNumber, companyProfile.phone, companyProfile.mobileNumber, companyProfile.telephoneNumber);
    const logoDataUrl = firstTextValue(document.companyLogoDataUrl, companyProfile.companyLogoDataUrl, companyProfile.logoDataUrl, companyProfile.logo);
    const logoHtml = logoDataUrl ? `<img src="${escapeHtml(logoDataUrl)}" alt="Company Logo" class="company-logo" />` : "";

    const signatoryName = firstTextValue(document.certifiedByName, latestSignatories.approvedByName, latestSignatories.coeSignatoryName, latestSignatories.certifiedByName, latestSignatories.approvedCoeName, latestSignatories.coeName, latestSignatories.authorizedRepName, latestSignatories.authorizedRepresentativeName, latestSignatories.hrSignatoryName, latestSignatories.checkedByName, latestSignatories.preparedByName, latestSignatories.name) || "Authorized Signatory";
    const signatoryPosition = firstTextValue(document.certifiedByPosition, latestSignatories.approvedByPosition, latestSignatories.coeSignatoryPosition, latestSignatories.certifiedByPosition, latestSignatories.approvedCoePosition, latestSignatories.coePosition, latestSignatories.authorizedRepPosition, latestSignatories.authorizedRepresentativePosition, latestSignatories.hrSignatoryPosition, latestSignatories.checkedByPosition, latestSignatories.preparedByPosition, latestSignatories.position) || "Authorized Representative";
    const signatureDataUrl = firstTextValue(document.certifiedBySignatureDataUrl, latestSignatories.approvedBySignature, latestSignatories.coeSignatureDataUrl, latestSignatories.approvedCoeSignatureDataUrl, latestSignatories.signatureDataUrl, latestSignatories.authorizedRepSignature, latestSignatories.authorizedRepresentativeSignatureDataUrl, latestSignatories.hrSignatureDataUrl, latestSignatories.checkedBySignature, latestSignatories.preparedBySignature);
    const signatureHtml = signatureDataUrl ? `<img src="${escapeHtml(signatureDataUrl)}" alt="Electronic Signature" class="signature-image" />` : `<div class="signature-placeholder"></div>`;

    const employmentPeriod = employee.hireDate ? `from <strong>${escapeHtml(formatFormalDate(employee.hireDate))}</strong>` : "with the company";
    const departmentPhrase = employee.department ? ` under the <strong>${escapeHtml(employee.department)}</strong> department` : "";
    const allowanceRows = getEmployeeAllowanceRows(employee);
    const monthlyBasicPay = getPortalBasicPay(employee);
    const annualBasePay = monthlyBasicPay * 12;
    const totalMonthlyAllowance = allowanceRows.reduce((sum, row) => sum + row.monthly, 0);
    const totalAnnualAllowance = allowanceRows.reduce((sum, row) => sum + row.annual, 0);

    const compensationHtml = document.includeCompensation
      ? `
        <div class="compensation-block">
          <p>Upon request, the employee’s compensation details are reflected below for reference:</p>
          ${buildCompensationTableHtml([{ label: "Basic Pay", monthly: monthlyBasicPay, annual: annualBasePay }])}
          ${document.includeAllowance ? allowanceRows.length > 0 ? `<div class="table-spacing">${buildCompensationTableHtml(allowanceRows, "Total Allowances")}</div>` : `<div class="empty-allowance-note">No allowance amounts are currently saved in this employee’s information.</div>` : ""}
          ${document.includeAllowance && allowanceRows.length > 0 ? `<div class="table-spacing">${buildCompensationTableHtml([{ label: "Total Compensation Package", monthly: monthlyBasicPay + totalMonthlyAllowance, annual: annualBasePay + totalAnnualAllowance }])}</div>` : ""}
        </div>
      `
      : "";

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Certificate of Employment - ${escapeHtml(getFullName(employee))}</title><style>
      .compensation-block{margin-top:34px;margin-bottom:34px} table{width:100%;border-collapse:collapse;margin-top:16px;font-size:11pt;color:#111827} th{padding:8px 10px;border:1px solid #9ca3af;background:#f3f4f6;color:#111827;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.04em;font-size:10.5pt} td{padding:8px 10px;border:1px solid #9ca3af;background:#fff;vertical-align:top}.amount-cell{text-align:right;font-weight:800}.total-cell{padding:10px 12px;border:1px solid #94a3b8;background:#f8fafc;font-weight:900}.table-spacing{margin-top:18px}.empty-allowance-note{margin-top:18px;padding:12px 14px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;font-size:13px;font-weight:700}@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#111827;font-family:"Times New Roman",Times,serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:14px;background:#0f172a;z-index:20}.toolbar button{border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer}.primary-button{background:#1d4ed8;color:#fff}.secondary-button{background:#fff;color:#0f172a}.certificate-page{width:210mm;min-height:297mm;margin:18px auto;padding:12mm 22mm 10mm;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.18);overflow:hidden}.certificate-content{min-height:calc(297mm - 22mm);display:flex;flex-direction:column}.certificate-header{display:flex;align-items:center;gap:18px;border-bottom:4px solid #0f4c81;padding-bottom:12px;margin-bottom:46px}.company-logo{max-width:150px;max-height:75px;object-fit:contain}.company-name{font-size:18pt;font-weight:700;color:#0f2f4a;text-transform:uppercase;letter-spacing:.04em}.company-address{font-size:10.5pt;color:#374151;margin-top:6px}h1{text-align:center;color:#111827;font-size:18pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:18px 0 42px}p{font-size:12pt;line-height:1.65;text-align:justify;margin:0 0 22px}.closing-section{margin-top:34px;page-break-inside:avoid;break-inside:avoid}.signature-block{margin-top:28px;page-break-inside:avoid;break-inside:avoid}.signature-label{margin-bottom:12px;font-weight:700}.signature-image{width:190px;height:52px;object-fit:contain;display:block;margin-bottom:6px}.signature-placeholder{height:52px}.signature-name{font-weight:700;border-top:1px solid #111827;width:280px;padding-top:8px;font-size:12pt;text-transform:uppercase;line-height:1.15}.signature-position{font-size:11pt;color:#374151;margin-top:3px}.footer{margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:22px;font-size:8.5pt;line-height:1.2;color:#4b5563;border-top:1px solid #d1d5db;padding-top:6px;background:#fff}.footer em{display:block;max-width:135mm}.footer strong{white-space:nowrap;letter-spacing:.04em}@media print{body{background:#fff}.toolbar{display:none!important}.certificate-page{margin:0;box-shadow:none;width:210mm;height:297mm;min-height:297mm;padding:12mm 22mm 10mm!important;overflow:hidden}p{font-size:11pt!important;line-height:1.55!important;margin-bottom:15px!important}.footer{margin-top:auto!important;font-size:8.5pt!important;padding-top:5px!important}.signature-image{width:180px!important;height:46px!important;margin-bottom:6px!important}.signature-placeholder{height:46px!important}}
    </style></head><body><div class="toolbar"><button class="primary-button" onclick="window.print()">Print / Save as PDF</button><button class="secondary-button" onclick="window.close()">Close</button></div><section class="certificate-page"><div class="certificate-content"><div class="certificate-body"><div class="certificate-header">${logoHtml}<div><div class="company-name">${escapeHtml(companyName)}</div><div class="company-address">${escapeHtml(companyAddress)}</div></div></div><h1>Certificate of Employment</h1><p>This is to certify that <strong>${escapeHtml(getCoeDisplayName(employee).toUpperCase())}</strong> is employed by <strong>${escapeHtml(companyName.toUpperCase())}</strong> ${employmentPeriod} as <strong>${escapeHtml(employee.jobTitle || employee.employmentClassification || "—")}</strong>${departmentPhrase} with <strong>${escapeHtml(employee.employeeType || employee.employmentStatus || "—")}</strong> employment status.</p>${compensationHtml}${document.includeContactDetails && (companyEmail || companyContact) ? `<p>For verification of this certificate, requests may be coursed through the company’s authorized HR representative at ${companyEmail ? `<strong>${escapeHtml(companyEmail)}</strong>` : ""}${companyEmail && companyContact ? " or through " : ""}${companyContact ? `<strong>${escapeHtml(companyContact)}</strong>` : ""}.</p>` : ""}</div><div class="closing-section"><p>This certification is issued upon the request of <strong>${escapeHtml(getFullName(employee))}</strong> for <strong>${escapeHtml(document.purpose || "Employment Verification")}</strong> purposes, issued this <strong>${escapeHtml(formatFormalDate(document.issueDate))}</strong>.</p><div class="signature-block"><div class="signature-label">Certified by:</div>${signatureHtml}<div class="signature-name">${escapeHtml(signatoryName)}</div><div class="signature-position">${escapeHtml(signatoryPosition)}</div></div></div><div class="footer"><em>This certificate is system-generated with an electronic signature and unique internal ticket number (${escapeHtml(document.id)}). Status: APPROVED.</em><strong>CONFIDENTIAL</strong></div></div></section></body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.alert("Please allow pop-ups to view or download the approved COE.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  // Printable management leave policy document function
  async function openApprovedLeavePolicyDocument(policy: LeavePolicy) {
    if (!employee) return;

    const latestCompanyProfile = await readAnyStorage<CompanyProfile>([storageKeys.companyInformation, STORAGE_KEYS.companyProfile, "companySettings", "businessProfile"], companyProfile);
    const companyName = firstTextValue(latestCompanyProfile.companyName, latestCompanyProfile.businessName, latestCompanyProfile.registeredName, latestCompanyProfile.registeredBusinessName, latestCompanyProfile.legalName, latestCompanyProfile.tradeName, latestCompanyProfile.name) || "Company Name";
    const companyAddress = firstTextValue(latestCompanyProfile.companyAddress, latestCompanyProfile.address, latestCompanyProfile.businessAddress, latestCompanyProfile.registeredAddress) || "Company Address";
    const logoDataUrl = firstTextValue(latestCompanyProfile.companyLogoDataUrl, latestCompanyProfile.logoDataUrl, latestCompanyProfile.logo);
    const logoHtml = logoDataUrl ? `<img src="${escapeHtml(logoDataUrl)}" alt="Company Logo" class="company-logo" />` : "";
    const approvedBy = firstTextValue(policy.approvedByName, policy.approvedBy) || "Management";

    const rules = [
      ["Leave Type", policy.leaveType || "—"],
      ["Annual Leave Credits", `${toMoneyNumber(policy.annualDays).toFixed(2)} day(s)`],
      ["Eligibility", `${toMoneyNumber(policy.eligibilityMonths).toFixed(0)} month(s) of service`],
      ["Paid Leave", policy.paid ? "Yes" : "No"],
      ["Convertible to Cash", policy.convertible ? "Yes" : "No"],
      ["Carry Over Allowed", policy.carryOver ? "Yes" : "No"],
      ["Maximum Carry Over", `${toMoneyNumber(policy.maxCarryOverDays).toFixed(2)} day(s)`],
      ["Year-End Replenishment", policy.replenishesYearEnd ? "Yes" : "No"],
      ["Half-Day Filing", policy.allowHalfDay ? "Allowed" : "Not allowed"],
      ["Negative Balance", policy.allowNegativeBalance ? "Allowed" : "Not allowed"],
      ["Unpaid Leave Treatment", policy.deductIfUnpaid ? "May reduce paid days/pay when unpaid" : "No automatic unpaid deduction rule"],
      ["Government-Mandated", policy.governmentMandated ? "Yes" : "No"],
    ];

    const ruleRows = rules.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Management Leave Policy - ${escapeHtml(policy.leaveType || "Leave")}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#111827;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:14px;background:#0f172a;z-index:20}.toolbar button{border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer}.primary-button{background:#1d4ed8;color:#fff}.secondary-button{background:#fff;color:#0f172a}.page{width:210mm;min-height:297mm;margin:18px auto;padding:18mm 20mm;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.18)}.header{display:flex;align-items:center;gap:16px;border-bottom:4px solid #1d4ed8;padding-bottom:14px;margin-bottom:28px}.company-logo{max-width:120px;max-height:70px;object-fit:contain}.company-name{font-size:20px;font-weight:900;color:#0f172a;text-transform:uppercase}.company-address{margin-top:4px;font-size:12px;color:#475569}.badge{display:inline-flex;margin-bottom:18px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}h1{font-size:25px;margin:0 0 12px;color:#0f172a}.intro{font-size:14px;line-height:1.7;color:#334155;margin-bottom:22px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}td{border:1px solid #cbd5e1;padding:11px 12px;vertical-align:top}td:first-child{width:38%;font-weight:900;background:#f8fafc;color:#334155}.note{margin-top:24px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:18px;padding:14px 16px;font-size:13px;line-height:1.7;color:#1e3a8a}.signature{margin-top:38px}.signature-line{margin-top:44px;border-top:1px solid #111827;width:280px;padding-top:8px;font-weight:900;text-transform:uppercase}.small{font-size:12px;color:#64748b}.footer{margin-top:42px;border-top:1px solid #cbd5e1;padding-top:10px;font-size:11px;color:#64748b;display:flex;justify-content:space-between}@media print{body{background:#fff}.toolbar{display:none!important}.page{margin:0;box-shadow:none;width:210mm;min-height:297mm}}</style></head><body><div class="toolbar"><button class="primary-button" onclick="window.print()">Print / Save as PDF</button><button class="secondary-button" onclick="window.close()">Close</button></div><section class="page"><div class="header">${logoHtml}<div><div class="company-name">${escapeHtml(companyName)}</div><div class="company-address">${escapeHtml(companyAddress)}</div></div></div><div class="badge">Issued by Management</div><h1>Management Leave Policy Document</h1><p class="intro">This document confirms that <strong>${escapeHtml(getEmployeeDisplayNameForPortal(employee))}</strong> is covered by the following approved leave policy created and approved by HR/Management. This document is for employee reference and does not replace any company handbook, employment contract, or statutory rule applicable to the employee.</p><table>${ruleRows}</table><div class="note"><strong>Management Notice:</strong> This approved leave policy is released by management through the HR system. Leave filing, usage, conversion, and payroll treatment remain subject to company review, management approval, and applicable labor rules.</div><div class="signature"><div class="small">Approved by:</div><div class="signature-line">${escapeHtml(approvedBy)}</div><div class="small">Approved Date: ${escapeHtml(formatDate(policy.approvedAt))}</div></div><div class="footer"><span>Employee No. ${escapeHtml(employee.employeeNo)} • Policy ID: ${escapeHtml(policy.id)}</span><strong>CONFIDENTIAL</strong></div></section></body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.alert("Please allow pop-ups to view or download the leave policy document.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  function getPayrollSequenceValue(payroll: PayrollRecord) {
    const payrollSource = payroll as PayrollRecord & Record<string, MoneyLike>;
    const explicitYear = Number(String(payroll.year || "").trim());
    const dateFallback = new Date(String(payroll.payrollDate || payrollSource.actualPayrollDate || payrollSource.payDate || ""));
    const payrollYear = Number.isFinite(explicitYear) && explicitYear > 0 ? explicitYear : Number.isNaN(dateFallback.getTime()) ? 0 : dateFallback.getFullYear();
    const explicitMonthIndex = monthNameToIndex(payroll.month);
    const payrollMonthIndex = explicitMonthIndex >= 0 ? explicitMonthIndex : Number.isNaN(dateFallback.getTime()) ? -1 : dateFallback.getMonth();
    const periodText = String(payroll.payrollPeriod || payroll.payPeriod || payroll.periodName || payroll.cutoffLabel || payroll.cutoffName || payroll.runType || "").toLowerCase();
    const cutoffOrder = periodText.includes("second") || periodText.includes("2nd") ? 2 : 1;
    if (!payrollYear || payrollMonthIndex < 0) return 0;
    return payrollYear * 10000 + (payrollMonthIndex + 1) * 100 + cutoffOrder;
  }

  function isPayrollApprovedForPayslip(payroll: PayrollRecord) {
    const payrollSource = payroll as PayrollRecord & Record<string, MoneyLike>;
    const statusText = String(payrollSource.approvalStatus || payrollSource.status || payrollSource.payrollStatus || payrollSource.runStatus || payrollSource.approvedStatus || "").toLowerCase();
    if (statusText.includes("approved") || statusText.includes("locked")) return true;
    if (payrollSource.approvedAt || payrollSource.lockedAt || payrollSource.approvedByName || payrollSource.approvedBy) return true;

    const runIdCandidates = [payroll.id, payroll.payrollReference, payroll.payrollRun, payroll.payrollRunId, payroll.bulkRunId, payroll.payrollRunName, payroll.runName, payroll.title, payroll.label]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return runIdCandidates.length > 0;
  }

  async function openPayslipDocument(record: PayrollRecord) {
    if (!employee) return;
    const source = record as PayrollRecord & Record<string, MoneyLike>;
    const money = (value: MoneyLike) => new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toMoneyNumber(value));
    const runDate = (value?: string) => formatDate(value).replace(/,/g, "");
    const fullName = getEmployeeDisplayNameForPortal(employee).toUpperCase();

    const latestCompanyProfile = await readAnyStorage<CompanyProfile>([storageKeys.companyInformation, STORAGE_KEYS.companyProfile, "companySettings", "businessProfile"], companyProfile);
    const companyName = firstTextValue(latestCompanyProfile.companyName, latestCompanyProfile.businessName, latestCompanyProfile.registeredName, latestCompanyProfile.registeredBusinessName, latestCompanyProfile.legalName, latestCompanyProfile.tradeName, latestCompanyProfile.name) || "Company Name";
    const companyAddress = firstTextValue(latestCompanyProfile.companyAddress, latestCompanyProfile.address, latestCompanyProfile.businessAddress, latestCompanyProfile.registeredAddress) || "Company Address";
    const logoDataUrl = firstTextValue(latestCompanyProfile.companyLogoDataUrl, latestCompanyProfile.logoDataUrl, latestCompanyProfile.logo);
    const companyLogoHtml = logoDataUrl ? `<img src="${escapeHtml(logoDataUrl)}" alt="Company Logo" class="company-logo" />` : `<div class="company-logo-placeholder">COMPANY</div>`;

    const payrollReference = String(record.payrollReference || record.payrollRun || record.id || "Payslip");
    const payDate = String(record.payrollDate || source.actualPayrollDate || source.payDate || source.createdAt || "");
    const payPeriod = String(record.cutoffLabel || source.payrollPeriod || source.periodName || source.payPeriod || "—");
    const coverageStart = runDate(String(source.coverageStartDate || source.cutoffStartDate || source.periodStartDate || source.startDate || ""));
    const coverageEnd = runDate(String(source.coverageEndDate || source.cutoffEndDate || source.periodEndDate || source.endDate || ""));
    const generatedCoverage = [coverageStart, coverageEnd].filter((value) => value && value !== "—").join(" - ");
    const payCoverage = String(source.payCoverage || source.periodCovered || source.coverage || source.coveragePeriod || generatedCoverage || "—");

    const basicPay = toMoneyNumber(source.basicPay || source.regularPay || 0);
    const premiumItems = [
      { label: "OVERTIME", hours: String(source.overtimeHours || ""), amount: toMoneyNumber(source.overtimeAmount || source.overtimePay || 0) },
      { label: "NIGHT DIFFERENTIAL", hours: String(source.nightDiffHours || source.nightDifferentialHours || ""), amount: toMoneyNumber(source.nightDifferentialAmount || source.nightDifferentialPay || 0) },
      { label: "REST DAY / DAY OFF WORK", hours: String(source.restDayHours || ""), amount: toMoneyNumber(source.restDayAmount || 0) },
      { label: "SPECIAL HOLIDAY PREMIUM", hours: String(source.specialHolidayHours || source.holidayHours || ""), amount: toMoneyNumber(source.specialHolidayAmount || source.holidayPay || 0) },
      ...normalizeMoneyItems(source.customPremiums, "Custom Premium").map((item) => ({ ...item, label: item.label.toUpperCase(), hours: "" })),
    ].filter((item) => Math.abs(item.amount) >= 0.01);
    const premiumDetailTotal = premiumItems.reduce((sum, item) => sum + item.amount, 0);
    const premiumPay = premiumDetailTotal || toMoneyNumber(source.totalPayrollPremium || source.premiumPay || source.premium || 0);

    const standardAllowanceItems = [
      { label: "RICE SUBSIDY", amount: toMoneyNumber(source.riceSubsidy || source.riceAllowance || source.rice || 0) },
      { label: "UNIFORM / CLOTHING", amount: toMoneyNumber(source.uniformClothing || source.uniformClothingAllowance || source.uniformAllowance || 0) },
      { label: "LAUNDRY ALLOWANCE", amount: toMoneyNumber(source.laundryAllowance || source.laundry || 0) },
      { label: "MEDICAL CASH DEPENDENTS", amount: toMoneyNumber(source.medicalCashDependents || source.medicalCashAllowanceToDependents || 0) },
      { label: "ACTUAL MEDICAL ASSISTANCE", amount: toMoneyNumber(source.actualMedicalAssistance || 0) },
      { label: "ACHIEVEMENT AWARDS", amount: toMoneyNumber(source.achievementAwards || 0) },
      { label: "CHRISTMAS / ANNIVERSARY GIFTS", amount: toMoneyNumber(source.christmasAnniversaryGifts || 0) },
      { label: "MEAL ALLOWANCE OT/NIGHT", amount: toMoneyNumber(source.mealAllowanceOTNight || source.mealAllowance || 0) },
      { label: "MONETIZED LEAVE", amount: toMoneyNumber(source.monetizedLeavePrivate || 0) },
      { label: "CBA / PRODUCTIVITY INCENTIVES", amount: toMoneyNumber(source.cbaProductivityIncentives || 0) },
      { label: "13TH MONTH PAY", amount: toMoneyNumber(source.thirteenthMonthPay || source.thirteenthMonth || source.thirteenMonthPay || 0) },
      { label: "CHRISTMAS BONUS", amount: toMoneyNumber(source.christmasBonus || 0) },
      { label: "OTHER TAXABLE ALLOWANCES", amount: toMoneyNumber(source.otherTaxableAllowances || 0) },
    ].filter((item) => Math.abs(item.amount) >= 0.01);
    const customAllowanceItems = normalizeMoneyItems(source.customAllowances, "Custom Allowance").map((item) => ({ ...item, label: item.label.toUpperCase() }));
    const allowanceItems = [...standardAllowanceItems, ...customAllowanceItems];
    const detailedAllowanceTotal = allowanceItems.reduce((sum, item) => sum + item.amount, 0);
    const allowancePay = detailedAllowanceTotal || toMoneyNumber(source.totalAllowances || source.totalAllowance || source.allowances || source.allowance || 0);
    const grossPay = toMoneyNumber(record.grossPay || basicPay + premiumPay + allowancePay - toMoneyNumber(source.totalAbsences || 0));

    const withholdingTax = toMoneyNumber(source.withholdingTax || source.tax || 0);
    const sssEe = toMoneyNumber(source.sssEe || source.sssEmployee || 0);
    const philhealthEe = toMoneyNumber(source.philhealthEe || source.philhealthEmployee || source.phicEe || 0);
    const pagibigEe = toMoneyNumber(source.pagibigEe || source.pagibigEmployee || source.hdmfEe || 0);
    const absences = toMoneyNumber(source.totalAbsences || 0);
    const payrollAdvances = toMoneyNumber(source.employeeAdvances || 0);
    const cashAdvances = toMoneyNumber(source.cashAdvances || 0);
    const sssLoanRepayment = toMoneyNumber(source.sssLoanRepayment || 0);
    const hdmfLoanRepayment = toMoneyNumber(source.hdmfLoanRepayment || 0);
    const customDeductionItems = normalizeMoneyItems(source.customDeductions, "Custom Deduction").map((item) => ({ ...item, label: item.label.toUpperCase() }));
    const customDeductionsTotal = customDeductionItems.reduce((sum, item) => sum + item.amount, 0);
    const loans = toMoneyNumber(source.loans || source.loanDeduction || 0) + sssLoanRepayment + hdmfLoanRepayment;
    const otherDeductions = toMoneyNumber(source.otherDeductions || source.otherDeduction || 0) + absences + payrollAdvances + cashAdvances + customDeductionsTotal;
    const yearEndTaxAdjustment = getVisibleYearEndTaxAdjustment({ ...record, taxAnnualizationYear: record.taxAnnualizationYear || record.year });
    const yearEndTaxDeduction = yearEndTaxAdjustment < 0 ? Math.abs(yearEndTaxAdjustment) : 0;
    const yearEndTaxRefund = yearEndTaxAdjustment > 0 ? yearEndTaxAdjustment : 0;
    const totalDeductions = toMoneyNumber(record.totalDeductions || withholdingTax + sssEe + philhealthEe + pagibigEe + loans + otherDeductions) + yearEndTaxDeduction - yearEndTaxRefund;
    const netPay = toMoneyNumber(record.adjustedNetPay ?? record.netPay ?? source.finalNetPay ?? grossPay - totalDeductions);

    const currentSequence = getPayrollSequenceValue(record);
    const ytdRecords = myPayrolls
      .filter((payroll) => {
        const payrollSequence = getPayrollSequenceValue(payroll);
        return payrollSequence > 0 && currentSequence > 0 && payrollSequence <= currentSequence && isPayrollApprovedForPayslip(payroll);
      })
      .sort((a, b) => getPayrollSequenceValue(a) - getPayrollSequenceValue(b));

    const sumYtd = (getter: (item: PayrollRecord & Record<string, MoneyLike>) => number) =>
      ytdRecords.reduce((sum, item) => sum + getter(item as PayrollRecord & Record<string, MoneyLike>), 0);

    const getRecordAllowanceDetailAmount = (item: PayrollRecord & Record<string, MoneyLike>, allowanceLabel: string) => {
      const matchedCustomAllowance = normalizeMoneyItems(item.customAllowances, "Custom Allowance").find(
        (allowance) => allowance.label.trim().toLowerCase() === allowanceLabel.trim().toLowerCase()
      );
      if (matchedCustomAllowance) return matchedCustomAllowance.amount;
      const normalizedLabel = allowanceLabel.toLowerCase();
      if (normalizedLabel.includes("rice")) return toMoneyNumber(item.riceSubsidy || item.riceAllowance || item.rice || 0);
      if (normalizedLabel.includes("uniform")) return toMoneyNumber(item.uniformClothing || item.uniformClothingAllowance || item.uniformAllowance || 0);
      if (normalizedLabel.includes("laundry")) return toMoneyNumber(item.laundryAllowance || item.laundry || 0);
      if (normalizedLabel.includes("meal")) return toMoneyNumber(item.mealAllowanceOTNight || item.mealAllowance || item.meal || 0);
      if (normalizedLabel.includes("transport")) return toMoneyNumber(item.transportationAllowance || item.transportAllowance || item.transport || 0);
      if (normalizedLabel.includes("internet")) return toMoneyNumber(item.internetAllowance || item.internet || 0);
      if (normalizedLabel.includes("medical")) return toMoneyNumber(item.medicalCashDependents || item.actualMedicalAssistance || item.medicalAllowance || item.medical || 0);
      if (normalizedLabel.includes("13th") || normalizedLabel.includes("thirteenth")) return toMoneyNumber(item.thirteenthMonthPay || item.thirteenthMonth || item.thirteenMonthPay || 0);
      if (normalizedLabel.includes("christmas")) return toMoneyNumber(item.christmasBonus || item.christmasAnniversaryGifts || 0);
      if (normalizedLabel.includes("other taxable")) return toMoneyNumber(item.otherTaxableAllowances || 0);
      return 0;
    };

    const ytdBasicPay = sumYtd((item) => toMoneyNumber(item.basicPay || item.regularPay || 0));
    const ytdAllowance = sumYtd((item) => {
      const detailTotal =
        toMoneyNumber(item.riceSubsidy || item.riceAllowance || item.rice || 0) +
        toMoneyNumber(item.uniformClothing || item.uniformClothingAllowance || item.uniformAllowance || 0) +
        toMoneyNumber(item.laundryAllowance || item.laundry || 0) +
        toMoneyNumber(item.medicalCashDependents || item.medicalCashAllowanceToDependents || 0) +
        toMoneyNumber(item.actualMedicalAssistance || 0) +
        toMoneyNumber(item.achievementAwards || 0) +
        toMoneyNumber(item.christmasAnniversaryGifts || 0) +
        toMoneyNumber(item.mealAllowanceOTNight || item.mealAllowance || item.meal || 0) +
        toMoneyNumber(item.monetizedLeavePrivate || 0) +
        toMoneyNumber(item.cbaProductivityIncentives || 0) +
        toMoneyNumber(item.thirteenthMonthPay || item.thirteenthMonth || item.thirteenMonthPay || 0) +
        toMoneyNumber(item.christmasBonus || 0) +
        toMoneyNumber(item.otherTaxableAllowances || 0) +
        normalizeMoneyItems(item.customAllowances, "Custom Allowance").reduce((sum, customItem) => sum + customItem.amount, 0);
      return detailTotal || toMoneyNumber(item.totalAllowances || item.totalAllowance || item.allowances || item.allowance || 0);
    });
    const ytdPremiums = sumYtd((item) => {
      const detailTotal =
        toMoneyNumber(item.overtimeAmount || item.overtimePay || 0) +
        toMoneyNumber(item.nightDifferentialAmount || item.nightDifferentialPay || 0) +
        toMoneyNumber(item.restDayAmount || 0) +
        toMoneyNumber(item.specialHolidayAmount || item.holidayPay || 0) +
        normalizeMoneyItems(item.customPremiums, "Custom Premium").reduce((sum, customItem) => sum + customItem.amount, 0);
      return detailTotal || toMoneyNumber(item.totalPayrollPremium || item.premiumPay || item.premium || 0);
    });
    const ytdGross = sumYtd((item) => toMoneyNumber(item.grossPay || 0));
    const ytdWithholdingTax = sumYtd((item) => toMoneyNumber(item.withholdingTax || item.tax || 0));
    const ytdSssEe = sumYtd((item) => toMoneyNumber(item.sssEe || item.sssEmployee || 0));
    const ytdPhilhealthEe = sumYtd((item) => toMoneyNumber(item.philhealthEe || item.philhealthEmployee || item.phicEe || 0));
    const ytdPagibigEe = sumYtd((item) => toMoneyNumber(item.pagibigEe || item.pagibigEmployee || item.hdmfEe || 0));
    const ytdLoans = sumYtd((item) => toMoneyNumber(item.loans || item.loanDeduction || 0) + toMoneyNumber(item.sssLoanRepayment || 0) + toMoneyNumber(item.hdmfLoanRepayment || 0));
    const ytdOtherDeductions = sumYtd((item) => toMoneyNumber(item.otherDeductions || item.otherDeduction || 0) + toMoneyNumber(item.totalAbsences || 0) + toMoneyNumber(item.employeeAdvances || 0) + toMoneyNumber(item.cashAdvances || 0) + normalizeMoneyItems(item.customDeductions, "Custom Deduction").reduce((sum, customItem) => sum + customItem.amount, 0));
    const ytdYearEndTaxAdjustment = sumYtd((item) => getVisibleYearEndTaxAdjustment({ ...item, taxAnnualizationYear: item.taxAnnualizationYear || item.year }));
    const ytdYearEndTaxDeduction = ytdYearEndTaxAdjustment < 0 ? Math.abs(ytdYearEndTaxAdjustment) : 0;
    const ytdYearEndTaxRefund = ytdYearEndTaxAdjustment > 0 ? ytdYearEndTaxAdjustment : 0;
    const ytdDeductions = sumYtd((item) => toMoneyNumber(item.totalDeductions || 0)) + ytdYearEndTaxDeduction - ytdYearEndTaxRefund;
    const ytdNetPay = sumYtd((item) => toMoneyNumber(item.adjustedNetPay ?? item.netPay ?? item.finalNetPay ?? 0));

    const earningRows = [
      { label: "REG BASIC", hours: String(source.regularHours || ""), current: basicPay, ytd: ytdBasicPay },
      ...premiumItems.map((item) => ({
        label: item.label,
        hours: item.hours,
        current: item.amount,
        ytd: sumYtd((payroll) => {
          const matchedCustomPremium = normalizeMoneyItems(payroll.customPremiums, "Custom Premium").find((customItem) => customItem.label.trim().toLowerCase() === item.label.trim().toLowerCase());
          if (matchedCustomPremium) return matchedCustomPremium.amount;
          if (item.label.includes("OVERTIME")) return toMoneyNumber(payroll.overtimeAmount || payroll.overtimePay || 0);
          if (item.label.includes("NIGHT")) return toMoneyNumber(payroll.nightDifferentialAmount || payroll.nightDifferentialPay || 0);
          if (item.label.includes("REST DAY")) return toMoneyNumber(payroll.restDayAmount || 0);
          if (item.label.includes("SPECIAL HOLIDAY")) return toMoneyNumber(payroll.specialHolidayAmount || payroll.holidayPay || 0);
          return 0;
        }),
      })),
      ...(premiumItems.length === 0 && Math.abs(premiumPay) >= 0.01 ? [{ label: "PAYROLL PREMIUM", hours: "", current: premiumPay, ytd: ytdPremiums }] : []),
      ...(allowanceItems.length > 0 ? allowanceItems.map((item) => ({ label: item.label.toUpperCase(), hours: "", current: item.amount, ytd: sumYtd((payroll) => getRecordAllowanceDetailAmount(payroll, item.label)) })) : [{ label: "ALLOWANCES", hours: "", current: allowancePay, ytd: ytdAllowance }]),
    ].filter((row) => Math.abs(row.current) >= 0.01 || Math.abs(row.ytd) >= 0.01 || row.label === "REG BASIC");

    const deductionRows = [
      { label: "WITHHOLDING TAX", current: withholdingTax, ytd: ytdWithholdingTax },
      { label: "SSS EMPLOYEE", current: sssEe, ytd: ytdSssEe },
      { label: "PHILHEALTH EMPLOYEE", current: philhealthEe, ytd: ytdPhilhealthEe },
      { label: "PAG-IBIG EMPLOYEE", current: pagibigEe, ytd: ytdPagibigEe },
      yearEndTaxDeduction > 0 ? { label: getYearEndTaxAdjustmentLabel(-yearEndTaxDeduction), current: yearEndTaxDeduction, ytd: ytdYearEndTaxDeduction } : null,
      yearEndTaxRefund > 0 ? { label: getYearEndTaxAdjustmentLabel(yearEndTaxRefund), current: -yearEndTaxRefund, ytd: -ytdYearEndTaxRefund } : null,
      { label: "TARDINESS / ABSENCES", current: absences, ytd: sumYtd((item) => toMoneyNumber(item.totalAbsences || 0)) },
      { label: "PAYROLL ADVANCES", current: payrollAdvances, ytd: sumYtd((item) => toMoneyNumber(item.employeeAdvances || 0)) },
      { label: "CASH ADVANCES", current: cashAdvances, ytd: sumYtd((item) => toMoneyNumber(item.cashAdvances || 0)) },
      { label: "SSS LOAN REPAYMENT", current: sssLoanRepayment, ytd: sumYtd((item) => toMoneyNumber(item.sssLoanRepayment || 0)) },
      { label: "HDMF LOAN REPAYMENT", current: hdmfLoanRepayment, ytd: sumYtd((item) => toMoneyNumber(item.hdmfLoanRepayment || 0)) },
      ...customDeductionItems.map((item) => ({ label: item.label, current: item.amount, ytd: sumYtd((payroll) => normalizeMoneyItems(payroll.customDeductions, "Custom Deduction").find((customItem) => customItem.label.trim().toLowerCase() === item.label.trim().toLowerCase())?.amount || 0) })),
      { label: "LOANS", current: toMoneyNumber(source.loans || source.loanDeduction || 0), ytd: ytdLoans },
      { label: "OTHER DEDUCTIONS", current: toMoneyNumber(source.otherDeductions || source.otherDeduction || 0), ytd: ytdOtherDeductions },
    ].filter((row): row is { label: string; current: number; ytd: number } => row !== null && (Math.abs(row.current) >= 0.01 || Math.abs(row.ytd) >= 0.01));

    const monthlyRate = source.monthlyRate || source.basicPay || employee.monthlyRate || employee.basicPay || basicPay;
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Payslip - ${escapeHtml(fullName)}</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;color:#111827;font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:14px;background:#0f172a;z-index:20}.toolbar button{border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer}.primary-button{background:#1d4ed8;color:#fff}.secondary-button{background:#fff;color:#0f172a}.payslip-page{width:297mm;min-height:210mm;margin:18px auto;padding:14mm 16mm;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.18)}.company-header{display:grid;grid-template-columns:92px 1fr;gap:18px;align-items:center;border-bottom:4px solid #7dd3fc;padding-bottom:12px}.company-logo{width:66px;max-height:66px;object-fit:contain;justify-self:center}.company-logo-placeholder{width:66px;height:66px;display:grid;place-items:center;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:900;font-size:10px;text-align:center}.company-name{font-size:24px;font-weight:900;color:#0f4c81}.company-address{margin-top:8px;font-size:12px;color:#0f172a}.employee-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:18px;border-bottom:4px solid #7dd3fc;padding:12px 0;font-size:13px}.line{display:grid;grid-template-columns:130px 1fr;gap:10px;margin:0 0 12px}.value{font-weight:900}.government-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;padding:12px 0 18px;font-size:13px}.gov-title{font-weight:900;margin-bottom:6px}.main-grid{display:grid;grid-template-columns:1.08fr .98fr;gap:12px;align-items:start}.section-title{background:#7cc8ec;color:#fff;text-align:center;font-weight:900;letter-spacing:.32em;padding:8px 10px;text-transform:uppercase}table{width:100%;border-collapse:collapse;border:1px solid #7cc8ec;font-size:13px}th,td{padding:7px 8px;border-bottom:1px solid #7cc8ec;text-align:left}th{font-weight:900}.amount{text-align:right}.box{border:1px solid #7cc8ec;margin-top:8px}.totals-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;padding:10px;font-size:13px}.total-label{font-weight:900;margin-bottom:6px}.right-stack{display:grid;gap:8px}.direct-deposit{margin-top:10px}.footer{margin-top:14px;color:#64748b;font-size:10px;display:flex;justify-content:space-between}@media print{body{background:#fff}.toolbar{display:none!important}.payslip-page{margin:0;box-shadow:none;width:297mm;min-height:210mm;padding:14mm 16mm!important}}</style></head><body><div class="toolbar"><button class="primary-button" onclick="window.print()">Print / Save as PDF</button><button class="secondary-button" onclick="window.close()">Close</button></div><section class="payslip-page"><div class="company-header">${companyLogoHtml}<div><div class="company-name">${escapeHtml(companyName)}</div><div class="company-address">${escapeHtml(companyAddress)}</div></div></div><div class="employee-grid"><div><div class="line"><span>Employee Name :</span><span class="value">${escapeHtml(fullName)}</span></div><div class="line"><span>Employee Code :</span><span class="value">${escapeHtml(employee.employeeNo)}</span></div></div><div><div class="line"><span>Department :</span><span class="value">${escapeHtml(employee.department || record.department || "—")}</span></div><div class="line"><span>Position :</span><span class="value">${escapeHtml(employee.designation || employee.position || employee.jobTitle || record.designation || record.position || record.jobTitle || employee.employmentClassification || "—")}</span></div></div><div><div class="line"><span>Monthly Rate :</span><span class="value">${money(monthlyRate)}</span></div><div class="line"><span>Employment Type :</span><span class="value">${escapeHtml(employee.employeeType || employee.employmentStatus || "—")}</span></div></div></div><div class="government-grid"><div><div class="gov-title">SSS No.</div><div>${escapeHtml(employee.sssNumber || employee.sssNo || employee.sss || "—")}</div></div><div><div class="gov-title">TIN</div><div>${escapeHtml(employee.tin || employee.tinNumber || "—")}</div></div><div><div class="gov-title">Pag-IBIG No.</div><div>${escapeHtml(employee.pagibig || employee.pagibigNumber || employee.pagIbigNumber || employee.pagibigNo || employee.pagIbigNo || employee.hdmfNumber || employee.hdmfNo || "—")}</div></div><div><div class="gov-title">PhilHealth No.</div><div>${escapeHtml(employee.philhealth || employee.philhealthNumber || employee.philHealthNumber || employee.philhealthNo || employee.philHealthNo || employee.phicNumber || employee.phicNo || "—")}</div></div><div><div class="gov-title">Pay Date</div><div>${escapeHtml(runDate(payDate))}</div><div class="gov-title" style="margin-top:10px;">Pay Period</div><div>${escapeHtml(payPeriod)}</div><div class="gov-title" style="margin-top:10px;">Pay Coverage</div><div>${escapeHtml(payCoverage)}</div></div></div><div class="main-grid"><div><div class="section-title">Earnings</div><table><thead><tr><th>Description</th><th>Hours</th><th class="amount">Current</th><th class="amount">YTD</th></tr></thead><tbody>${earningRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.hours)}</td><td class="amount">${money(row.current)}</td><td class="amount">${money(row.ytd)}</td></tr>`).join("")}</tbody></table><div class="box"><div class="section-title">Current Totals</div><div class="totals-grid"><div><div class="total-label">Earnings</div><div>${money(basicPay + premiumPay + allowancePay + yearEndTaxRefund)}</div></div><div><div class="total-label">Deductions</div><div>${money(totalDeductions)}</div></div><div><div class="total-label">Net Pay</div><div>${money(netPay)}</div></div></div></div></div><div class="right-stack"><div><div class="section-title">Deductions</div><table><thead><tr><th>Description</th><th class="amount">Current</th><th class="amount">YTD</th></tr></thead><tbody>${deductionRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="amount">${money(row.current)}</td><td class="amount">${money(row.ytd)}</td></tr>`).join("") || `<tr><td>—</td><td class="amount">—</td><td class="amount">—</td></tr>`}</tbody></table></div><div><div class="section-title">Loans</div><table><thead><tr><th>Loan Type</th><th class="amount">Loan Amount</th><th class="amount">Amount Paid</th><th class="amount">Balance</th></tr></thead><tbody><tr><td>—</td><td class="amount">—</td><td class="amount">—</td><td class="amount">—</td></tr></tbody></table></div><div class="box" style="margin-top:0;"><div class="section-title">YTD Totals</div><div class="totals-grid"><div><div class="total-label">Earnings</div><div>${money(ytdGross || grossPay)}</div></div><div><div class="total-label">Deductions</div><div>${money(ytdDeductions || totalDeductions)}</div></div><div><div class="total-label">Net Pay</div><div>${money(ytdNetPay || netPay)}</div></div></div></div></div></div><div class="direct-deposit"><div class="section-title">Direct Deposit</div><table><thead><tr><th>Bank Account</th><th class="amount">Account Number</th><th class="amount">Account Type</th><th class="amount">Amount</th></tr></thead><tbody><tr><td>${escapeHtml(employee.bankName || "—")}</td><td class="amount">${escapeHtml(employee.bankAccountNumber || "—")}</td><td class="amount">${escapeHtml(employee.bankAccountType || "Payroll")}</td><td class="amount">${money(netPay)}</td></tr></tbody></table></div><div class="footer"><span>Payroll Reference: ${escapeHtml(payrollReference)}</span><strong>CONFIDENTIAL</strong></div></section></body></html>`;

    const payslipWindow = window.open("", "_blank");
    if (!payslipWindow) {
      window.alert("Please allow pop-ups to view or download the payslip.");
      return;
    }
    payslipWindow.document.open();
    payslipWindow.document.write(html);
    payslipWindow.document.close();
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "details", label: "My Details" },
    { key: "payslips", label: `Payslips${myPayslipDocuments.length ? ` (${myPayslipDocuments.length})` : ""}` },
  ];

  if (!employee) {
    return <LoginScreen usernameInput={usernameInput} passwordInput={passwordInput} setUsernameInput={setUsernameInput} setPasswordInput={setPasswordInput} loginEmployee={loginEmployee} />;
  }

  if (employee.mustChangePassword) {
    return <PasswordChangeScreen employee={employee} newPassword={newPassword} confirmPassword={confirmPassword} setNewPassword={setNewPassword} setConfirmPassword={setConfirmPassword} changePassword={changePassword} logoutEmployee={logoutEmployee} />;
  }

  const pendingLeaveCount = myLeaves.filter((item) => String(item.status || item.hrStatus || "").toLowerCase().includes("pending")).length;
  const pendingChangeCount = myChangeRequests.filter((c) => c.status === "Pending").length;
  const payslipCount = myPayslipDocuments.length || myPayrolls.length;

  const portalNavTiles: { key: TabKey; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", hint: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
    { key: "details", label: "My Profile", hint: "Personal info", icon: <User className="h-5 w-5" /> },
    { key: "payslips", label: "Payslips", hint: payslipCount > 0 ? `${payslipCount} slips` : "No slips yet", icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-[#0b2742]">
      {/* BANNER */}
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ background: "linear-gradient(135deg, #0a2540 0%, #0c3460 55%, #0a4f8f 100%)", color: "#ffffff" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 82% 20%, rgba(14,165,233,0.28), transparent 35%), linear-gradient(135deg, rgba(14,165,233,0.10), transparent 50%)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 text-xl font-semibold shadow-sm">
              {employee.employeePhotoDataUrl
                ? <img src={employee.employeePhotoDataUrl} alt="Employee" className="h-full w-full object-cover" />
                : <span className="text-white/90">{(employee.firstName?.charAt(0) || employee.lastName?.charAt(0) || "E").toUpperCase()}</span>}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  Employee Portal
                </span>
                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold opacity-80">{employee.employeeNo}</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">Hi, {employee.firstName || getEmployeeDisplayNameForPortal(employee)}</h1>
              <p className="mt-1 text-sm opacity-75">{[employee.department, employee.jobTitle || employee.designation].filter(Boolean).join(" · ") || "No position set"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logoutEmployee}
            className="flex items-center gap-2 self-start rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 lg:self-auto"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </section>

      {/* STATS STRIP */}
      <div className="flex divide-x divide-slate-200 border-b border-slate-200 bg-white">
        <div className="flex-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Employee No.</p>
          <p className="mt-1 text-base font-bold text-slate-900">{employee.employeeNo || "—"}</p>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</p>
          <p className="mt-1 text-base font-bold text-slate-900">{employee.department || "—"}</p>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Latest Net Pay</p>
          <p className="mt-1 text-base font-bold text-slate-900">{myPayrolls[0] ? peso(myPayrolls[0].adjustedNetPay ?? myPayrolls[0].netPay) : "—"}</p>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending Leaves</p>
          <p className="mt-1 text-base font-bold text-slate-900">{pendingLeaveCount}</p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* NAVIGATION HUB */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {portalNavTiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              onClick={() => setActiveTab(tile.key)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition ${
                activeTab === tile.key
                  ? "border-[#0a4f8f] bg-[#0a4f8f] text-white shadow-[0_4px_16px_-4px_rgba(10,79,143,0.35)]"
                  : "border-slate-200 bg-white text-slate-500 hover:border-[#0a4f8f44] hover:bg-blue-50/70 hover:text-[#0a4f8f]"
              }`}
            >
              {tile.icon}
              <span className="text-xs font-semibold leading-tight">{tile.label}</span>
              <span className={`text-[10px] leading-tight ${activeTab === tile.key ? "text-white/70" : "text-slate-400"}`}>{tile.hint}</span>
            </button>
          ))}
        </div>

        {/* CONTENT PANEL */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(8,47,73,0.10)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
            <span className="text-[#0a4f8f]">{portalNavTiles.find((t) => t.key === activeTab)?.icon}</span>
            <h2 className="text-sm font-semibold text-slate-800">{tabs.find((t) => t.key === activeTab)?.label || "Dashboard"}</h2>
          </div>
          <div className="p-5">
            {activeTab === "dashboard" ? <DashboardPanel employee={employee} myPayslipCount={payslipCount} /> : null}
            {activeTab === "details" ? <EmployeeDetailsPanel employee={employee} onPhotoChange={handlePortalPhotoChange} /> : null}
            {activeTab === "attendance" ? <AttendanceDemoPanel employee={employee} demoNow={demoNow} demoClockStatus={demoClockStatus} demoTimeInAt={demoTimeInAt} demoTimeOutAt={demoTimeOutAt} demoTimeIn={demoTimeIn} demoTimeOut={demoTimeOut} resetDemoAttendance={resetDemoAttendance} /> : null}
            {activeTab === "changes" ? <ChangesPanel requestType={requestType} setRequestType={setRequestType} currentValue={currentValue} setCurrentValue={setCurrentValue} requestedValue={requestedValue} setRequestedValue={setRequestedValue} requestReason={requestReason} setRequestReason={setRequestReason} submitChangeRequest={submitChangeRequest} myChangeRequests={myChangeRequests} /> : null}
            {activeTab === "leaves" ? (
              <LeavesPanel
                myLeaves={myLeaves}
                myApprovedLeavePolicies={myApprovedLeavePolicies}
                selectedLeavePolicyId={selectedLeavePolicyId}
                setSelectedLeavePolicyId={setSelectedLeavePolicyId}
                leaveStartDate={leaveStartDate}
                setLeaveStartDate={setLeaveStartDate}
                leaveEndDate={leaveEndDate}
                setLeaveEndDate={setLeaveEndDate}
                leaveReason={leaveReason}
                setLeaveReason={setLeaveReason}
                submitLeaveRequestFromPortal={submitLeaveRequestFromPortal}
                openApprovedLeavePolicyDocument={openApprovedLeavePolicyDocument}
                myConvertibleLeavePolicies={myConvertibleLeavePolicies}
                myLeaveMonetizationRequests={myLeaveMonetizationRequests}
                monetizationWindowFrom={monetizationWindowFrom}
                monetizationWindowTo={monetizationWindowTo}
                isMonetizationWindowOpen={isMonetizationWindowOpen}
                selectedMonetizationLeavePolicyId={selectedMonetizationLeavePolicyId}
                setSelectedMonetizationLeavePolicyId={setSelectedMonetizationLeavePolicyId}
                monetizationRequestedDays={monetizationRequestedDays}
                setMonetizationRequestedDays={setMonetizationRequestedDays}
                monetizationReason={monetizationReason}
                setMonetizationReason={setMonetizationReason}
                submitLeaveMonetizationRequestFromPortal={submitLeaveMonetizationRequestFromPortal}
              />
            ) : null}
            {activeTab === "payslips" ? <PayslipsPanel myPayslipDocuments={myPayslipDocuments} myPayrolls={myPayrolls} openStoredPayslipDocument={openStoredPayslipDocument} openPayslipDocument={openPayslipDocument} /> : null}
            {activeTab === "documents" ? (
              <DocumentsPanel
                myApprovedCoeDocuments={myApprovedCoeDocuments}
                myApprovedLeavePolicies={myApprovedLeavePolicies}
                openApprovedCoeDocument={openApprovedCoeDocument}
                openApprovedLeavePolicyDocument={openApprovedLeavePolicyDocument}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginScreen({ usernameInput, passwordInput, setUsernameInput, setPasswordInput, loginEmployee }: { usernameInput: string; passwordInput: string; setUsernameInput: (value: string) => void; setPasswordInput: (value: string) => void; loginEmployee: () => void }) {
  return (
    <main className="min-h-screen bg-slate-50 text-[#0b2742]">
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ background: "linear-gradient(135deg, #0a2540 0%, #0c3460 55%, #0a4f8f 100%)", color: "#ffffff" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 82% 20%, rgba(14,165,233,0.28), transparent 35%)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Employee Portal
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Employee Login</h1>
          <p className="mt-1 text-sm opacity-75">Access your profile, payslips, and leave requests in one secure place.</p>
        </div>
      </section>
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(8,47,73,0.10)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">Sign in to Employee Portal</h2>
            <p className="mt-1 text-sm text-slate-500">Use the username and password provided by HR.</p>
          </div>
          <div className="p-5">
            <div className="grid gap-4">
              <label>
                <div className="mb-1.5 text-sm font-semibold text-slate-700">Username</div>
                <input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value)} placeholder="e.g. emp002" className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
              </label>
              <label>
                <div className="mb-1.5 text-sm font-semibold text-slate-700">Password</div>
                <input value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} placeholder="Enter password" type="password" className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
              </label>
              <button type="button" onClick={loginEmployee} className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]">Login</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PasswordChangeScreen({ employee, newPassword, confirmPassword, setNewPassword, setConfirmPassword, changePassword, logoutEmployee }: { employee: EmployeeRecord; newPassword: string; confirmPassword: string; setNewPassword: (value: string) => void; setConfirmPassword: (value: string) => void; changePassword: () => void; logoutEmployee: () => void }) {
  return (
    <main className="min-h-screen bg-slate-50 text-[#0b2742]">
      <section
        className="relative overflow-hidden border-b border-[#0a4f8f33] px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.55)]"
        style={{ background: "linear-gradient(135deg, #0a2540 0%, #0c3460 55%, #0a4f8f 100%)", color: "#ffffff" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 82% 20%, rgba(14,165,233,0.28), transparent 35%)" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold">First Login</span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Set Your Password</h1>
          <p className="mt-1 text-sm opacity-75">Hi, {employee.firstName || "Employee"}. Please create a new password before continuing.</p>
        </div>
      </section>
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(8,47,73,0.10)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">Create New Password</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4">
              <label>
                <div className="mb-1.5 text-sm font-semibold text-slate-700">New Password</div>
                <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="Minimum 8 characters" className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
              </label>
              <label>
                <div className="mb-1.5 text-sm font-semibold text-slate-700">Confirm Password</div>
                <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" placeholder="Re-enter new password" className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={changePassword} className="rounded-lg border border-[#0a4f8f] bg-[#0a4f8f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c3460]">Save New Password</button>
                <button type="button" onClick={logoutEmployee} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Logout</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function AttendanceDemoPanel({
  employee,
  demoNow,
  demoClockStatus,
  demoTimeInAt,
  demoTimeOutAt,
  demoTimeIn,
  demoTimeOut,
  resetDemoAttendance,
}: {
  employee: EmployeeRecord;
  demoNow: Date;
  demoClockStatus: "Not Timed In" | "Timed In" | "Completed";
  demoTimeInAt: string;
  demoTimeOutAt: string;
  demoTimeIn: () => void;
  demoTimeOut: () => void;
  resetDemoAttendance: () => void;
}) {
  const isTimedIn = demoClockStatus === "Timed In";
  const isCompleted = demoClockStatus === "Completed";
  const elapsedTime = isTimedIn ? formatElapsedTime(demoTimeInAt, demoNow.toISOString()) : formatElapsedTime(demoTimeInAt, demoTimeOutAt);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className={`p-6 ${isTimedIn ? "bg-emerald-50" : isCompleted ? "bg-blue-50" : "bg-amber-50"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Demo Timekeeping</div>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Today’s Time Clock</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Front-end demo only. Time logs are not yet saved to backend, payroll, or official attendance records.</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${isTimedIn ? "border-emerald-200 bg-emerald-100 text-emerald-700" : isCompleted ? "border-blue-200 bg-blue-100 text-blue-700" : "border-amber-200 bg-amber-100 text-amber-700"}`}>
              {demoClockStatus}
            </span>
          </div>
        </div>

        <div className="grid gap-5 p-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
            <div className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Current Time</div>
            <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">{demoNow.toLocaleTimeString("en-PH")}</div>
            <div className="mt-2 text-sm font-bold text-slate-500">{demoNow.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <PortalInfoCard label="Time In" value={formatPortalClockTime(demoTimeInAt)} />
            <PortalInfoCard label="Time Out" value={formatPortalClockTime(demoTimeOutAt)} />
            <PortalInfoCard label="Running Time" value={elapsedTime} />
          </div>

          <div className="flex flex-wrap gap-3">
            {!isTimedIn && !isCompleted ? (
              <button type="button" onClick={demoTimeIn} className="rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800">Time In</button>
            ) : null}

            {isTimedIn ? (
              <button type="button" onClick={demoTimeOut} className="rounded-2xl bg-rose-700 px-6 py-4 text-sm font-black text-white shadow-sm transition hover:bg-rose-800">Time Out</button>
            ) : null}

            {isCompleted ? (
              <button type="button" disabled className="cursor-not-allowed rounded-2xl border border-slate-300 bg-slate-100 px-6 py-4 text-sm font-black text-slate-500">Shift Completed</button>
            ) : null}

            {(isTimedIn || isCompleted) ? (
              <button type="button" onClick={resetDemoAttendance} className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50">Reset Demo</button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">How this will work later</h3>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-black text-slate-900">1. Employee logs in</div><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Employee opens the portal using their HR-generated username and password.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-black text-slate-900">2. Employee clicks Time In</div><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">The system records the exact timestamp, employee number, date, and source as Employee Portal.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-black text-slate-900">3. Timer runs until Time Out</div><p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Future backend can compute total hours, late minutes, undertime, overtime, and attendance status.</p></div>
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
          Suggested future fields: employeeNo, timeIn, timeOut, totalHours, location, device, status, and approval notes.
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Employee</div>
          <div className="mt-2 text-sm font-black text-slate-950">{getEmployeeDisplayNameForPortal(employee)}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{employee.employeeNo} • {employee.department || "No department"} • {employee.shiftType || "Shift not set"}</div>
        </div>
      </section>
    </div>
  );
}

function DashboardPanel({ employee, myPayslipCount }: { employee: EmployeeRecord; myPayslipCount: number }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <InfoPanel title="Employment Snapshot">
          <InfoRow label="Full Name" value={getFullName(employee)} />
          <InfoRow label="Job Title" value={employee.jobTitle || "—"} />
          <InfoRow label="Employment Status" value={getBirStatusText(employee.employmentStatus)} />
          <InfoRow label="Immediate Supervisor" value={employee.immediateSupervisor || "—"} />
        </InfoPanel>
        <InfoPanel title="Payroll Summary">
          <InfoRow label="Payslips Available" value={String(myPayslipCount)} />
          <InfoRow label="Department" value={employee.department || "—"} />
          <InfoRow label="Employee No." value={employee.employeeNo || "—"} />
        </InfoPanel>
      </div>
    </div>
  );
}

function EmployeeDetailsPanel({ employee, onPhotoChange }: { employee: EmployeeRecord; onPhotoChange: (dataUrl: string) => void }) {
  const allowanceRows = getPortalAllowanceRows(employee);

  return (
    <div className="grid gap-6">
      <PortalPhotoCard employee={employee} onPhotoChange={onPhotoChange} />
      <PortalDetailSection title="Basic Employee Information"><PortalInfoCard label="Employee No." value={displayText(employee.employeeNo)} /><PortalInfoCard label="Full Name" value={getEmployeeDisplayNameForPortal(employee)} /><PortalInfoCard label="Company" value={displayText(employee.company)} /><PortalInfoCard label="Department" value={displayText(employee.department)} /><PortalInfoCard label="Job Title" value={displayText(employee.jobTitle || employee.position || employee.designation)} /><PortalInfoCard label="Employee Type" value={displayText(employee.employeeType)} /><PortalInfoCard label="Employment Classification" value={displayText(employee.employmentClassification)} /><PortalInfoCard label="BIR Employment Status" value={getBirStatusText(employee.employmentStatus)} /><PortalInfoCard label="Minimum Wage Earner" value={displayText(employee.isMinimumWageEarner)} /><PortalInfoCard label="User Type" value={displayText(employee.userType)} /></PortalDetailSection>
      <PortalInfoCard label="Gender" value={displayText(employee.gender)} />
      <PortalDetailSection title="Job and Work Assignment"><PortalInfoCard label="Immediate Supervisor" value={displayText(employee.immediateSupervisor)} /><PortalInfoCard label="Designated Workplace" value={displayText(employee.designatedWorkplace)} /><PortalInfoCard label="Job Code" value={displayText(employee.jobCode)} /><PortalInfoCard label="Job Grade" value={displayText(employee.jobGrade)} /><PortalInfoCard label="Cost Name" value={displayText(employee.costName)} /><PortalInfoCard label="Eligibility" value={displayText(employee.eligibility)} /><PortalInfoCard label="Biometric ID" value={displayText(employee.biometricId)} /><PortalInfoCard label="Shift Type" value={displayText(employee.shiftType)} /><PortalInfoCard label="Payslip ID" value={displayText(employee.payslipId)} /></PortalDetailSection>
      <PortalDetailSection title="Employment Dates and Status Notes"><PortalInfoCard label="Hire Date" value={formatDate(employee.hireDate)} /><PortalInfoCard label="Expected Regularization Date" value={formatDate(employee.expectedRegularizationDate)} /><PortalInfoCard label="Regularization Date" value={formatDate(employee.regularizationDate)} /><PortalInfoCard label="Expected Separation Date" value={formatDate(employee.expectedSeparationDate)} /><PortalInfoCard label="Separation Date" value={formatDate(employee.separationDate)} /><PortalInfoCard label="Reason for Leaving" value={displayText(employee.reasonForLeaving)} /><PortalInfoCard label="Employee Remarks" value={displayText(employee.employeeRemarks)} /></PortalDetailSection>
      <PortalDetailSection title="Personal and Contact Information"><PortalInfoCard label="Birthdate" value={formatDate(employee.birthdate)} /><PortalInfoCard label="Contact Number" value={displayText(employee.contactNumber)} /><PortalInfoCard label="Email Address" value={displayText(employee.emailAddress)} /><PortalInfoCard label="Address" value={displayText(employee.address)} /></PortalDetailSection>
      <PortalDetailSection title="Government Identification Numbers"><PortalInfoCard label="SSS Number" value={displayText(employee.sss || employee.sssNumber || employee.sssNo)} /><PortalInfoCard label="PhilHealth Number" value={displayText(employee.philhealth || employee.philhealthNumber || employee.philHealthNumber || employee.philhealthNo || employee.philHealthNo || employee.phicNumber || employee.phicNo)} /><PortalInfoCard label="Pag-IBIG Number" value={displayText(employee.pagibig || employee.pagibigNumber || employee.pagIbigNumber || employee.pagibigNo || employee.pagIbigNo || employee.hdmfNumber || employee.hdmfNo)} /><PortalInfoCard label="TIN" value={displayText(employee.tin || employee.tinNumber)} /></PortalDetailSection>
      <PortalDetailSection title="Bank Details"><PortalInfoCard label="Bank Name" value={displayText(employee.bankName)} /><PortalInfoCard label="Bank Account Type" value={displayText(employee.bankAccountType)} /><PortalInfoCard label="Bank Account Number" value={maskAccountNumber(employee.bankAccountNumber)} /></PortalDetailSection>
      <PortalDetailSection title="Payroll Setup and Fixed Allowances"><PortalInfoCard label="Payroll Frequency" value={displayText(employee.payrollRunType || "Semi-Monthly")} /><PortalInfoCard label="Monthly Basic Pay" value={peso(getPortalBasicPay(employee))} /><PortalInfoCard label="Hourly Rate" value={peso(employee.hourlyRate)} /><PortalInfoCard label="Total Fixed Allowances" value={peso(getPortalTotalAllowance(employee))} /><PortalInfoCard label="Total Monthly Package" value={peso(getPortalTotalMonthlyPackage(employee))} /><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm md:col-span-2 xl:col-span-3"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Allowance Breakdown</div><div className="mt-1 text-sm font-bold text-slate-600">Fixed allowances only. 13th month pay, Christmas bonus, and other year-end benefits are intentionally excluded here.</div></div><div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">View-only</div></div>{allowanceRows.length > 0 ? <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100 text-left text-xs font-black uppercase tracking-[0.08em] text-slate-500"><th className="px-4 py-3">Allowance</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{allowanceRows.map((allowance, index) => <tr key={`${allowance.label}-${index}`} className="border-t border-slate-200"><td className="px-4 py-3 font-extrabold text-slate-800">{allowance.label}</td><td className="px-4 py-3 text-right font-black text-slate-950">{peso(allowance.amount)}</td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-500">No fixed allowance is currently saved for this employee.</div>}</div></PortalDetailSection>
      <PortalDetailSection title="Employee Portal Access"><PortalInfoCard label="Portal Username" value={displayText(employee.portalUsername)} /><PortalInfoCard label="Portal Status" value={displayText(employee.portalStatus || "Active")} /><PortalInfoCard label="Must Change Password" value={employee.mustChangePassword ? "Yes" : "No"} /><PortalInfoCard label="Last Password Changed" value={formatDateTime(employee.lastPasswordChangedAt)} /></PortalDetailSection>
    </div>
  );
}

function ChangesPanel(props: { requestType: string; setRequestType: (value: string) => void; currentValue: string; setCurrentValue: (value: string) => void; requestedValue: string; setRequestedValue: (value: string) => void; requestReason: string; setRequestReason: (value: string) => void; submitChangeRequest: () => void; myChangeRequests: ChangeRequest[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"><h3 className="m-0 text-lg font-black text-slate-950">Request Detail Change</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Submit requested updates for HR review.</p><div className="mt-4 grid gap-3"><select value={props.requestType} onChange={(event) => props.setRequestType(event.target.value)} className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none"><option>Contact Number</option><option>Email Address</option><option>Address</option><option>Bank Account Number</option><option>Bank Name</option><option>Government ID</option><option>Other Employee Detail</option></select><input value={props.currentValue} onChange={(event) => props.setCurrentValue(event.target.value)} placeholder="Current value" className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none" /><input value={props.requestedValue} onChange={(event) => props.setRequestedValue(event.target.value)} placeholder="Requested value" className="rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none" /><textarea value={props.requestReason} onChange={(event) => props.setRequestReason(event.target.value)} placeholder="Reason or note" className="min-h-24 rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-sm font-bold outline-none" /><button onClick={props.submitChangeRequest} className="rounded-[14px] border border-blue-700 bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800">Submit Request</button></div></div>
      <SimpleTable title="My Change Requests" rows={props.myChangeRequests} empty="No change requests yet." headers={["Type", "Requested Value", "Status", "Date"]} renderRow={(request) => <tr key={request.id} className="border-b border-slate-200"><td className="p-3 font-bold text-slate-900">{request.requestType}</td><td className="p-3 text-slate-600">{request.requestedValue}</td><td className="p-3"><Badge status={request.status} /></td><td className="p-3 text-slate-500">{formatDate(request.createdAt)}</td></tr>} />
    </div>
  );
}

function LeavesPanel({
  myLeaves,
  myApprovedLeavePolicies,
  selectedLeavePolicyId,
  setSelectedLeavePolicyId,
  leaveStartDate,
  setLeaveStartDate,
  leaveEndDate,
  setLeaveEndDate,
  leaveReason,
  setLeaveReason,
  submitLeaveRequestFromPortal,
  openApprovedLeavePolicyDocument,
  myConvertibleLeavePolicies,
  myLeaveMonetizationRequests,
  monetizationWindowFrom,
  monetizationWindowTo,
  isMonetizationWindowOpen,
  selectedMonetizationLeavePolicyId,
  setSelectedMonetizationLeavePolicyId,
  monetizationRequestedDays,
  setMonetizationRequestedDays,
  monetizationReason,
  setMonetizationReason,
  submitLeaveMonetizationRequestFromPortal,
}: {
  myLeaves: LeaveRequest[];
  myApprovedLeavePolicies: LeavePolicy[];
  selectedLeavePolicyId: string;
  setSelectedLeavePolicyId: (value: string) => void;
  leaveStartDate: string;
  setLeaveStartDate: (value: string) => void;
  leaveEndDate: string;
  setLeaveEndDate: (value: string) => void;
  leaveReason: string;
  setLeaveReason: (value: string) => void;
  submitLeaveRequestFromPortal: () => void;
  openApprovedLeavePolicyDocument: (policy: LeavePolicy) => void;
  myConvertibleLeavePolicies: LeavePolicy[];
  myLeaveMonetizationRequests: LeaveMonetizationRequest[];
  monetizationWindowFrom: string;
  monetizationWindowTo: string;
  isMonetizationWindowOpen: boolean;
  selectedMonetizationLeavePolicyId: string;
  setSelectedMonetizationLeavePolicyId: (value: string) => void;
  monetizationRequestedDays: string;
  setMonetizationRequestedDays: (value: string) => void;
  monetizationReason: string;
  setMonetizationReason: (value: string) => void;
  submitLeaveMonetizationRequestFromPortal: () => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">My Leave Balances</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              View your annual credits, approved leaves used, pending leaves, monetized days, and estimated remaining balance.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
            {myApprovedLeavePolicies.length} active leave type(s)
          </span>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600">
              <tr>
                <th className="p-3">Leave Type</th>
                <th className="p-3 text-right">Annual Credits</th>
                <th className="p-3 text-right">Approved Used</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 text-right">Monetized</th>
                <th className="p-3 text-right">Estimated Remaining</th>
              </tr>
            </thead>
            <tbody>
              {myApprovedLeavePolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-sm font-bold text-slate-500">
                    No approved leave balance is available for your employee record yet.
                  </td>
                </tr>
              ) : myApprovedLeavePolicies.map((policy) => {
                const annualCredits = toMoneyNumber(policy.annualDays);
                const approvedUsed = myLeaves
                  .filter((request) => request.leaveType === policy.leaveType && isPortalLeaveApproved(request))
                  .reduce((sum, request) => sum + getPortalLeaveRequestDays(request), 0);
                const pendingDays = myLeaves
                  .filter((request) => request.leaveType === policy.leaveType && isPortalLeavePending(request))
                  .reduce((sum, request) => sum + getPortalLeaveRequestDays(request), 0);
                const monetizedDays = myLeaveMonetizationRequests
                  .filter((request) => request.leaveType === policy.leaveType && request.status !== "Rejected")
                  .reduce((sum, request) => sum + toMoneyNumber(request.requestedDays), 0);
                const estimatedRemaining = Math.max(annualCredits - approvedUsed - monetizedDays, 0);

                return (
                  <tr key={`leave-balance-${policy.id}`} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                    <td className="p-3 font-black text-slate-950">
                      {policy.leaveType}
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {policy.paid ? "Paid" : "Unpaid"} • {policy.convertible ? "Convertible" : "Not convertible"}
                      </div>
                    </td>
                    <td className="p-3 text-right font-black text-slate-950">{annualCredits.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-rose-700">{approvedUsed.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-amber-700">{pendingDays.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{monetizedDays.toFixed(2)}</td>
                    <td className="p-3 text-right font-black text-blue-700">{estimatedRemaining.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs italic leading-5 text-slate-500">
          Estimated remaining balance deducts approved leave usage and non-rejected monetization requests. Pending leave requests are shown separately for visibility.
        </p>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Approved Leave Policies from HR/Management</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Only approved leave policies created by HR/Management and applicable to your employee record appear here.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-700">
            {myApprovedLeavePolicies.length} approved leave(s)
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {myApprovedLeavePolicies.length === 0 ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-500">
              No approved HR/Management leave policies are available for your employee record yet.
            </div>
          ) : myApprovedLeavePolicies.map((policy) => (
            <div key={`approved-leave-policy-${policy.id}`} className="grid gap-3 rounded-2xl border border-blue-100 bg-white p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="text-sm font-black text-slate-950">{policy.leaveType}</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{leavePolicyDescription(policy)}</div>
                <div className="mt-2 text-xs font-bold text-blue-700">Issued by Management • Approved {formatDate(policy.approvedAt)}</div>
              </div>
              <button
                type="button"
                onClick={() => openApprovedLeavePolicyDocument(policy)}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
              >
                View Policy Document
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">File Leave Request</h3>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Employees may file leave only from approved HR/Management leave policies shown above.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Leave Type</span>
            <select
              value={selectedLeavePolicyId}
              onChange={(event) => setSelectedLeavePolicyId(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Select approved leave type</option>
              {myApprovedLeavePolicies.map((policy) => (
                <option key={`file-option-${policy.id}`} value={policy.id}>{policy.leaveType}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Start Date</span>
            <input
              type="date"
              value={leaveStartDate}
              onChange={(event) => setLeaveStartDate(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">End Date</span>
            <input
              type="date"
              value={leaveEndDate}
              onChange={(event) => setLeaveEndDate(event.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Reason / Notes</span>
            <textarea
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
              rows={4}
              placeholder="Enter reason or notes for HR/Management review"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={submitLeaveRequestFromPortal}
          disabled={myApprovedLeavePolicies.length === 0}
          className="mt-4 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Submit Leave Request
        </button>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Leave Monetization</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              Filing window: {formatDate(monetizationWindowFrom)} - {formatDate(monetizationWindowTo)} • {isMonetizationWindowOpen ? "Open for filing" : "Closed"}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
              Requests follow Manager approval → HR final approval → Payroll assignment → Payroll posting.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${isMonetizationWindowOpen ? "border-emerald-200 bg-white text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
            {myLeaveMonetizationRequests.length} request(s)
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
          <h4 className="text-sm font-black text-slate-950">File Monetization Request</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_160px]">
            <select
              value={selectedMonetizationLeavePolicyId}
              onChange={(event) => setSelectedMonetizationLeavePolicyId(event.target.value)}
              disabled={!isMonetizationWindowOpen || myConvertibleLeavePolicies.length === 0}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">Select convertible leave type</option>
              {myConvertibleLeavePolicies.map((policy) => (
                <option key={`monetize-option-${policy.id}`} value={policy.id}>{policy.leaveType}</option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              step="0.5"
              value={monetizationRequestedDays}
              onChange={(event) => setMonetizationRequestedDays(event.target.value)}
              disabled={!isMonetizationWindowOpen || myConvertibleLeavePolicies.length === 0}
              placeholder="Days"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />

            <textarea
              value={monetizationReason}
              onChange={(event) => setMonetizationReason(event.target.value)}
              disabled={!isMonetizationWindowOpen || myConvertibleLeavePolicies.length === 0}
              rows={3}
              placeholder="Reason / notes for HR"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 md:col-span-2"
            />
          </div>

          <button
            type="button"
            onClick={submitLeaveMonetizationRequestFromPortal}
            disabled={!isMonetizationWindowOpen || myConvertibleLeavePolicies.length === 0}
            className="mt-3 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Submit Monetization Request
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-emerald-100 bg-white">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-emerald-50 text-xs font-black uppercase tracking-wide text-emerald-800">
              <tr>
                <th className="p-3">Request</th>
                <th className="p-3">Leave Type</th>
                <th className="p-3 text-right">Days</th>
                <th className="p-3">Payroll</th>
                <th className="p-3">Status / Notification</th>
              </tr>
            </thead>
            <tbody>
              {myLeaveMonetizationRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-sm font-bold text-slate-500">
                    No monetization requests yet.
                  </td>
                </tr>
              ) : myLeaveMonetizationRequests.map((request) => (
                <tr key={request.id} className="border-t border-emerald-100">
                  <td className="p-3 font-bold text-slate-900">
                    {request.id}
                    <br />
                    <span className="text-xs font-semibold text-slate-500">Filed {formatDate(request.dateFiled)}</span>
                  </td>
                  <td className="p-3 font-bold text-slate-800">{request.leaveType}</td>
                  <td className="p-3 text-right font-black text-slate-950">{request.requestedDays.toFixed(2)}</td>
                  <td className="p-3 font-semibold text-slate-700">{request.payrollReference || "—"}</td>
                  <td className="p-3">
                    <Badge status={request.status} />
                    <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {request.status === "Assigned to Payroll" ? `Approved and assigned to payroll ${request.payrollReference || "—"}.` : null}
                      {request.status === "Posted" ? `Posted to payroll ${request.payrollReference || "—"} as suggested monetized leave addition.` : null}
                      {request.status === "Rejected" ? "Rejected by management/HR." : null}
                      {request.status === "Pending Manager Approval" ? "Waiting for manager approval." : null}
                      {request.status === "Pending HR Approval" ? "Waiting for HR final approval." : null}
                      {request.status === "Approved" ? "Approved by HR. Waiting for payroll assignment." : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SimpleTable
        title="My Leave Requests"
        rows={myLeaves}
        empty="No leave requests found."
        headers={["Leave Type", "Date Range", "Reason", "Status"]}
        renderRow={(leave) => (
          <tr key={leave.id || `${leave.leaveType}-${leave.startDate}`} className="border-b border-slate-200">
            <td className="p-3 font-bold text-slate-900">{leave.leaveType || "Leave"}</td>
            <td className="p-3 text-slate-600">{formatDate(leave.startDate)} — {formatDate(leave.endDate)}</td>
            <td className="p-3 text-slate-600">{leave.reason || "—"}</td>
            <td className="p-3"><Badge status={leave.status || leave.hrStatus || leave.managerStatus || "Pending"} /></td>
          </tr>
        )}
      />
    </div>
  );
}

function PayslipsPanel({ myPayslipDocuments, myPayrolls, openStoredPayslipDocument, openPayslipDocument }: { myPayslipDocuments: EmployeePayslipDocument[]; myPayrolls: PayrollRecord[]; openStoredPayslipDocument: (document: EmployeePayslipDocument) => void; openPayslipDocument: (payroll: PayrollRecord) => void }) {
  if (myPayslipDocuments.length > 0) {
    return <SimpleTable title="My Payslips" rows={myPayslipDocuments} empty="No generated payslip documents found yet." headers={["Payslip", "Date", "Gross Pay", "Deductions", "Net Pay", "Action"]} renderRow={(document) => <tr key={`${document.id || document.documentId || document.recordId || document.payrollRecordId || "payslip"}-${document.employeeNo || document.employeeId || "employee"}-${document.payrollDate || document.payDate || document.createdAt || "date"}`} className="border-b border-slate-200"><td className="p-3 font-bold text-slate-900">{getPayslipMonthYear(document)}<br /><span className="text-xs font-semibold text-slate-500">{getPayslipCutoff(document)}</span></td><td className="p-3 text-slate-600">{formatDate(document.payrollDate || document.payDate || document.generatedAt || document.createdAt)}</td><td className="p-3 text-slate-600">{peso(document.grossPay)}</td><td className="p-3 text-slate-600">{peso(document.totalDeductions || document.deductions)}</td><td className="p-3 font-black text-blue-700">{peso(document.adjustedNetPay ?? document.netPay ?? document.finalNetPay)}</td><td className="p-3"><button type="button" onClick={() => openStoredPayslipDocument(document)} className="rounded-xl border border-blue-700 bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-800">View / Download</button></td></tr>} />;
  }

  return <SimpleTable title="My Payslips" rows={myPayrolls} empty="No payslips found yet. Once HR generates payslips from the Payslips tab, they will appear here." headers={["Payroll", "Date", "Gross Pay", "Deductions", "Net Pay", "Action"]} renderRow={(payroll) => <tr key={`${payroll.id || payroll.payrollReference || "payroll"}-${payroll.employeeNo || payroll.employeeId || "employee"}-${payroll.payrollDate || payroll.cutoffLabel || "date"}`} className="border-b border-slate-200"><td className="p-3 font-bold text-slate-900">{getPayslipMonthYear({}, payroll)}<br /><span className="text-xs font-semibold text-slate-500">{getPayslipCutoff({}, payroll)}</span></td><td className="p-3 text-slate-600">{formatDate(payroll.payrollDate)}</td><td className="p-3 text-slate-600">{peso(payroll.grossPay)}</td><td className="p-3 text-slate-600">{peso(payroll.totalDeductions)}</td><td className="p-3 font-black text-blue-700">{peso(payroll.adjustedNetPay ?? payroll.netPay)}</td><td className="p-3"><button type="button" onClick={() => openPayslipDocument(payroll)} className="rounded-xl border border-blue-700 bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-800">View / Download</button></td></tr>} />;
}

function DocumentsPanel({
  myApprovedCoeDocuments,
  myApprovedLeavePolicies,
  openApprovedCoeDocument,
  openApprovedLeavePolicyDocument,
}: {
  myApprovedCoeDocuments: CoeHistoryItem[];
  myApprovedLeavePolicies: LeavePolicy[];
  openApprovedCoeDocument: (document: CoeHistoryItem) => void;
  openApprovedLeavePolicyDocument: (policy: LeavePolicy) => void;
}) {
  return (
    <div className="grid gap-4">
      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Management Leave Policy Documents</h3>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Approved leave policies issued by management and applicable to your employee record.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black text-blue-700">
            {myApprovedLeavePolicies.length} document(s)
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {myApprovedLeavePolicies.length === 0 ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-4 text-sm font-semibold text-slate-500">
              No approved management leave policy documents are available yet.
            </div>
          ) : myApprovedLeavePolicies.map((policy) => (
            <div key={`leave-policy-doc-${policy.id}`} className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">{policy.leaveType}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">
                  Issued by Management • Approved {formatDate(policy.approvedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openApprovedLeavePolicyDocument(policy)}
                className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-800"
              >
                View Document
              </button>
            </div>
          ))}
        </div>
      </section>

      <SimpleTable
        title="My Approved Documents"
        rows={myApprovedCoeDocuments}
        empty="No approved COE documents yet. Submitted COEs will appear here only after approval."
        headers={["Document", "Purpose", "Issue Date", "Status", "Action"]}
        renderRow={(document) => (
          <tr key={`${document.id}-${document.employeeNo}-${document.generatedAt || document.approvedAt || document.issueDate || "coe"}`} className="border-b border-slate-200">
            <td className="p-3 font-bold text-slate-900">Certificate of Employment<br /><span className="text-xs font-semibold text-slate-500">{document.id}</span></td>
            <td className="p-3 text-slate-600">{document.purpose || "—"}</td>
            <td className="p-3 text-slate-600">{formatDate(document.issueDate)}{document.approvedAt ? <div className="mt-1 text-xs font-semibold text-slate-500">Approved: {formatDateTime(document.approvedAt)}</div> : null}</td>
            <td className="p-3"><Badge status={document.status || "Approved"} />{document.approvedByName || document.approvedByEmail ? <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">Approved by {document.approvedByName || "—"}{document.approvedByEmail ? <><br />{document.approvedByEmail}</> : null}</div> : null}</td>
            <td className="p-3"><button type="button" onClick={() => openApprovedCoeDocument(document)} className="rounded-xl border border-blue-700 bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-800">View / Download</button></td>
          </tr>
        )}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-bold leading-tight text-slate-900">{value}</p>
    </div>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="grid gap-2 p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-right text-sm font-semibold text-slate-800">{value || "—"}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex rounded border px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>{status || "Pending"}</span>;
}

function SimpleTable<T>({ title, rows, empty, headers, renderRow }: { title: string; rows: T[]; empty: string; headers: string[]; renderRow: (row: T) => React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5"><h3 className="m-0 text-lg font-black text-slate-950">{title}</h3></div>
      {rows.length === 0 ? <div className="p-5 text-sm font-bold text-slate-500">{empty}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600"><tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead><tbody>{rows.map((row) => renderRow(row))}</tbody></table></div>}
    </div>
  );
}
