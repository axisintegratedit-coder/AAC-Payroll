"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, setConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";
import { auth } from "@/lib/firebase";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import {
  appendSalaryHistoryEntry,
  getCurrentBaseSalary,
  isValidIsoDate as isValidSalaryIsoDate,
  normalizeSalaryHistory,
  todayIsoDate,
  type SalaryHistoryEntry,
} from "@/lib/salaryHistory";
import { deMinimisBenefitTargetsEmployee, type DeMinimisBenefit } from "@/lib/deMinimis";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  IdCard,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";

type CustomAllowanceRecord = {
  name: string;
  amount: number | string;
  frequency?: string;
  releaseMonth?: string;
};

type LoanEntry = {
  id: string;
  loanName: string;
  name?: string;
  dateStarted: string;
  startDate?: string;
  endDate?: string;
  originalAmount: number;
  amount?: number | string;
  amountPaid?: number | string;
  outstandingBalance: number;
  balance?: number | string;
  frequency?: string;
  monthlyDeduction: number;
};
type EmployeeRecord = {
  employeeNo: string;
  lastName: string;
  firstName: string;
  middleName: string;
  gender: string;
  company: string;
  department: string;
  jobTitle: string;
  employeeType: string;
  employmentClassification: string;
  isMinimumWageEarner: string;
  immediateSupervisor: string;
  designatedWorkplace: string;
  employmentStatus: string;
  userType: string;
  jobCode: string;
  jobGrade: string;
  costName: string;
  eligibility: string;
  hireDate: string;
  expectedRegularizationDate: string;
  regularizationDate: string;
  expectedSeparationDate: string;
  separationDate: string;
  reasonForLeaving: string;
  employeeRemarks: string;
  biometricId: string;
  payrollRunType: string;
  payrollExempt?: string;
  shiftType: string;
  payslipId: string;
  basicPayFrequency?: "Monthly" | "Hourly" | string;
  standardHoursPerDay?: number | string;
  workingDaysPerMonth?: number | string;
  hourlyRate: number;
  basicPay: number;
  salaryHistory?: SalaryHistoryEntry[];
  riceSubsidy: number;
  uniformClothingAllowance: number;
  laundryAllowance: number;
  actualMedicalAssistance: number;
  medicalCashAllowanceToDependents: number;
  mealAllowance: number;
  christmasAnniversaryGifts: number;
  achievementAwards: number;
  thirteenthMonthPay: number;
  christmasBonus: number;
  otherAllowanceName: string;
  otherAllowanceAmount: number;
  allowanceFrequencies?: Record<string, string>;
  allowances?: CustomAllowanceRecord[];
  customAllowances?: CustomAllowanceRecord[];
  sss: string;
  philhealth: string;
  pagibig: string;
  tin: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  address: string;
  birthdate: string;
  contactNumber: string;
  emailAddress: string;
  employeePhotoDataUrl?: string;
  portalUsername?: string;
  portalPassword?: string;
  mustChangePassword?: boolean;
  portalStatus?: "Active" | "Locked" | "Disabled";
  lastPasswordChangedAt?: string;
  loans?: LoanEntry[];
  deductAllowanceOnAbsence?: boolean;
};

type BatchImportRow = Record<(typeof EMPLOYEE_IMPORT_HEADERS)[number], string> & {
  allowances?: CustomAllowanceRecord[];
  customAllowances?: CustomAllowanceRecord[];
  loans?: LoanEntry[];
};

function diffEmployeeRecord(before: EmployeeRecord, after: EmployeeRecord): string {
  const FIELDS: Array<[string, keyof EmployeeRecord]> = [
    ["Employee No.", "employeeNo"],
    ["Last Name", "lastName"],
    ["First Name", "firstName"],
    ["Middle Name", "middleName"],
    ["Gender", "gender"],
    ["Company", "company"],
    ["Department", "department"],
    ["Job Title", "jobTitle"],
    ["Payroll Type", "payrollRunType"],
    ["Employee Type", "employeeType"],
    ["Employment Classification", "employmentClassification"],
    ["Minimum Wage Earner", "isMinimumWageEarner"],
    ["Exempt", "payrollExempt"],
    ["Immediate Supervisor", "immediateSupervisor"],
    ["Location", "designatedWorkplace"],
    ["Employment Status", "employmentStatus"],
    ["User Type", "userType"],
    ["Job Code", "jobCode"],
    ["Job Grade", "jobGrade"],
    ["Cost Name", "costName"],
    ["Eligibility", "eligibility"],
    ["Shift", "shiftType"],
    ["Biometric ID", "biometricId"],
    ["Payslip ID", "payslipId"],
    ["Basic Pay Frequency", "basicPayFrequency"],
    ["Standard Hours Per Day", "standardHoursPerDay"],
    ["Working Days Per Month", "workingDaysPerMonth"],
    ["Basic Pay", "basicPay"],
    ["Hourly Rate", "hourlyRate"],
    ["Rice Subsidy", "riceSubsidy"],
    ["Uniform/Clothing Allowance", "uniformClothingAllowance"],
    ["Laundry Allowance", "laundryAllowance"],
    ["Actual Medical Assistance", "actualMedicalAssistance"],
    ["Medical Cash Allowance", "medicalCashAllowanceToDependents"],
    ["Meal Allowance", "mealAllowance"],
    ["Christmas/Anniversary Gifts", "christmasAnniversaryGifts"],
    ["Achievement Awards", "achievementAwards"],
    ["13th Month Pay", "thirteenthMonthPay"],
    ["Christmas Bonus", "christmasBonus"],
    ["Deduct Allowances on Absence", "deductAllowanceOnAbsence"],
    ["SSS", "sss"],
    ["PhilHealth", "philhealth"],
    ["Pag-IBIG", "pagibig"],
    ["TIN", "tin"],
    ["Bank Name", "bankName"],
    ["Bank Account No.", "bankAccountNumber"],
    ["Bank Account Type", "bankAccountType"],
    ["Hire Date", "hireDate"],
    ["Expected Regularization Date", "expectedRegularizationDate"],
    ["Regularization Date", "regularizationDate"],
    ["Expected Separation Date", "expectedSeparationDate"],
    ["Separation Date", "separationDate"],
    ["Reason for Leaving", "reasonForLeaving"],
    ["Birthdate", "birthdate"],
    ["Contact Number", "contactNumber"],
    ["Email", "emailAddress"],
    ["Address", "address"],
    ["Portal Username", "portalUsername"],
    ["Portal Status", "portalStatus"],
  ];
  const diffs = FIELDS
    .filter(([, key]) => String(before[key] ?? "") !== String(after[key] ?? ""))
    .map(([label, key]) => `${label}: ${String(before[key] ?? "(empty)")} → ${String(after[key] ?? "(empty)")}`);
  console.log("DIFF FIELDS CHECKED:", FIELDS.map(([label, key]) => ({
    label,
    before: String(before[key] ?? ""),
    after: String(after[key] ?? ""),
    changed: String(before[key] ?? "") !== String(after[key] ?? "")
  })));
  console.log("EMPLOYEE DIFF — before:", JSON.stringify(before), "after:", JSON.stringify(after), "result:", diffs);
  return diffs.length > 0 ? diffs.join("; ") : "No field changes detected";
}

const DEFAULT_DEPARTMENTS = [
  "Accounting",
  "Admin",
  "Customer Service",
  "Executive",
  "Finance",
  "Human Resource",
  "IT",
  "Marketing",
  "Operations",
  "Payroll",
  "Sales",
];

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0a4f8f] hover:file:bg-cyan-50 disabled:bg-slate-100 disabled:text-slate-500";
const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0a4f8f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] transition hover:-translate-y-0.5 hover:bg-[#073c6d] focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "inline-flex h-9 items-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-3.5 text-[13px] font-medium transition hover:border-cyan-200/50 hover:bg-white/[0.12]";
const subtlePanelClassName =
  "relative overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)] ring-1 ring-slate-900/[0.04] backdrop-blur";
const techGridStyle = {
  backgroundImage:
    "linear-gradient(rgba(56, 189, 248, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.16) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

const SHIFT_TYPE_OPTIONS = ["Day Shift", "Mid Shift", "Night Shift"] as const;

function isValidShiftType(value: string) {
  return SHIFT_TYPE_OPTIONS.some(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );
}


const BANK_ACCOUNT_TYPE_OPTIONS = ["Savings", "Checking", "Payroll", "Other"] as const;

const EMPLOYEE_TYPE_OPTIONS = ["Full-time", "Part-time", "Contractor", "Seasonal", "Probationary", "Intern"] as const;
const USER_TYPE_OPTIONS = ["Employee", "Administrator"] as const;
const EMPLOYMENT_CLASSIFICATION_OPTIONS = ["Rank-and-file", "Managerial", "Supervisory", "Managerial/Supervisory"] as const;

const REQUIRED_EMPLOYEE_IMPORT_HEADERS = [
  "employeeId",
  "payrollType",
  "lastName",
  "firstName",
  "department",
  "jobTitle",
  "location",
  "employeeType",
  "employmentStatus",
  "minimumWageEarner",
  "hireDate",
  "biometricId",
  "baseSalary",
  "exempt",
] as const;


function isValidBankAccountType(value: string) {
  return BANK_ACCOUNT_TYPE_OPTIONS.some(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );
}

function isValidEmployeeType(value: string) {
  return EMPLOYEE_TYPE_OPTIONS.some(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );
}

function isValidUserType(value: string) {
  return USER_TYPE_OPTIONS.some(
    (option) => option.toLowerCase() === value.trim().toLowerCase()
  );
}

function normalizeEmploymentClassification(value: string) {
  return value.trim().toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
}

function isValidEmploymentClassification(value: string) {
  const normalizedValue = normalizeEmploymentClassification(value);
  return EMPLOYMENT_CLASSIFICATION_OPTIONS.some(
    (option) => normalizeEmploymentClassification(option) === normalizedValue
  );
}

const EMPLOYEE_IMPORT_DATE_FIELDS = [
  "hireDate",
] as const;

function isEmployeeImportDateField(header: string): header is (typeof EMPLOYEE_IMPORT_DATE_FIELDS)[number] {
  return EMPLOYEE_IMPORT_DATE_FIELDS.includes(header as (typeof EMPLOYEE_IMPORT_DATE_FIELDS)[number]);
}

function normalizeCsvDate(value: string) {
  const trimmedValue = value.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedValue);
  if (!match) return trimmedValue;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return trimmedValue;
  if (month < 1 || month > 12) return trimmedValue;
  if (day < 1 || day > 31) return trimmedValue;

  const parsedDate = new Date(year, month - 1, day);
  const isValidDate =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;

  if (!isValidDate) return trimmedValue;

  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

function toIsoDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return value;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isValidCsvDate(value: string) {
  const normalized = normalizeCsvDate(value);
  const match = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(normalized);
  if (!match) return false;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);
  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function normalizeEmployeeImportDateToIso(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  if (isValidIsoDate(trimmedValue)) return trimmedValue;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedValue);
  if (!match) return trimmedValue;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);
  const isValidDate =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day;

  if (!isValidDate) return trimmedValue;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidEmployeeImportDate(value: string) {
  return isValidIsoDate(normalizeEmployeeImportDateToIso(value));
}

function isRequiredEmployeeImportHeader(header: string) {
  return REQUIRED_EMPLOYEE_IMPORT_HEADERS.includes(header as (typeof REQUIRED_EMPLOYEE_IMPORT_HEADERS)[number]);
}

function getEmployeeImportHeaderLabel(header: string) {
  return isRequiredEmployeeImportHeader(header) ? `${header} *` : header;
}

function normalizeDuplicateText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDuplicateId(value: string) {
  return digitsOnly(value);
}

function getEmployeeDuplicateKey(employee: Pick<EmployeeRecord, "employeeNo" | "lastName" | "firstName" | "middleName" | "sss" | "philhealth" | "pagibig" | "tin">) {
  return {
    employeeNo: normalizeDuplicateText(employee.employeeNo || ""),
    fullName: normalizeDuplicateText(
      [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(" ")
    ),
    sss: normalizeDuplicateId(employee.sss || ""),
    philhealth: normalizeDuplicateId(employee.philhealth || ""),
    pagibig: normalizeDuplicateId(employee.pagibig || ""),
    tin: normalizeDuplicateId(employee.tin || ""),
  };
}

function findDuplicateEmployeeFields(
  employees: EmployeeRecord[],
  candidate: Pick<EmployeeRecord, "employeeNo" | "lastName" | "firstName" | "middleName" | "sss" | "philhealth" | "pagibig" | "tin">,
  originalEmployeeNo = ""
) {
  const candidateKeys = getEmployeeDuplicateKey(candidate);
  const originalEmployeeNoKey = normalizeDuplicateText(originalEmployeeNo);
  const duplicateFields: string[] = [];

  employees.forEach((employee) => {
    const employeeKeys = getEmployeeDuplicateKey(employee);
    const isSameEditedEmployee =
      originalEmployeeNoKey && employeeKeys.employeeNo === originalEmployeeNoKey;

    if (isSameEditedEmployee) return;

    if (candidateKeys.employeeNo && employeeKeys.employeeNo === candidateKeys.employeeNo) {
      duplicateFields.push("Employee No.");
    }

    if (candidateKeys.fullName && employeeKeys.fullName === candidateKeys.fullName) {
      duplicateFields.push("Full Name");
    }

    if (candidateKeys.sss && employeeKeys.sss === candidateKeys.sss) {
      duplicateFields.push("SSS Number");
    }

    if (candidateKeys.philhealth && employeeKeys.philhealth === candidateKeys.philhealth) {
      duplicateFields.push("PhilHealth Number");
    }

    if (candidateKeys.pagibig && employeeKeys.pagibig === candidateKeys.pagibig) {
      duplicateFields.push("Pag-IBIG Number");
    }

    if (candidateKeys.tin && employeeKeys.tin === candidateKeys.tin) {
      duplicateFields.push("TIN");
    }
  });

  return Array.from(new Set(duplicateFields));
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

function formatTin(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatSssNumber(value: string) {
  return digitsOnly(value).slice(0, 10);
}

function formatPhilHealthNumber(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 2) return digits;
  if (digits.length <= 11) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 11)}-${digits.slice(11)}`;
}

function formatPagibigNumber(value: string) {
  const digits = digitsOnly(value).slice(0, 12);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

function formatPesoAmount(value: number) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function getSavedCompanyName(): Promise<string> {
  const companyInformation = await getConfigItem<Record<string, unknown>>(storageKeys.companyInformation, {});
  const companyName = String(companyInformation.companyName || "").trim();
  const tradeName = String(companyInformation.tradeName || "").trim();
  if (companyName) return companyName;
  if (tradeName) return tradeName;
  return "";
}

function normalizeDepartmentList(values: unknown[]) {
  const departmentsByName = new Map<string, string>();
  values.forEach((item) => {
    const cleanedName = String(item || "").trim();
    if (!cleanedName) return;
    const key = cleanedName.toLowerCase();
    if (!departmentsByName.has(key)) departmentsByName.set(key, cleanedName);
  });
  return Array.from(departmentsByName.values()).sort((a, b) => a.localeCompare(b));
}

function getNewDepartmentsFromImport(rows: BatchImportRow[], existingDepartments: string[]) {
  const existingDepartmentNames = new Set(
    existingDepartments.map((department) => department.trim().toLowerCase()).filter(Boolean)
  );
  const newDepartments = new Map<string, string>();

  rows.forEach((row) => {
    const department = row.department.trim();
    if (!department) return;
    const key = department.toLowerCase();
    if (existingDepartmentNames.has(key) || newDepartments.has(key)) return;
    newDepartments.set(key, department);
  });

  return Array.from(newDepartments.values());
}

function normalizeImportDepartmentName(value: string, existingDepartments: string[]) {
  const department = value.trim();
  if (!department) return "";
  const matchedDepartment = existingDepartments.find(
    (existingDepartment) => existingDepartment.trim().toLowerCase() === department.toLowerCase()
  );
  return matchedDepartment || department;
}

async function getSavedCompanyDepartments(): Promise<string[]> {
  const companyInformation = await getConfigItem<Record<string, unknown>>(storageKeys.companyInformation, {});
  const companyDepartments = Array.isArray(companyInformation.departments)
    ? normalizeDepartmentList(companyInformation.departments)
    : [];
  if (companyDepartments.length > 0) return companyDepartments;
  const savedDepartments = await getDataArray<string>(storageKeys.departments, []);
  if (Array.isArray(savedDepartments) && savedDepartments.length > 0) {
    return normalizeDepartmentList(savedDepartments);
  }
  return DEFAULT_DEPARTMENTS;
}

function generatePortalUsername(employeeNo: string) {
  return employeeNo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function generateTemporaryPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!";
  let password = "";

  for (let index = 0; index < length; index += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

const EMPLOYEE_IMPORT_HEADERS = [
  "employeeId",
  "payrollType",
  "lastName",
  "firstName",
  "middleName",
  "gender",
  "department",
  "jobTitle",
  "location",
  "employeeType",
  "employmentStatus",
  "minimumWageEarner",
  "hireDate",
  "biometricId",
  "baseSalary",
  "payFrequency",
  "workingDaysPerMonth",
  "standardHoursPerDay",
  "exempt",
  "sss",
  "philhealth",
  "pagibig",
  "tin",
  "bankName",
  "bankAccountType",
  "bankAccountNumber",
  "birthdate",
  "contactNumber",
  "emailAddress",
  "address",
  "immediateSupervisor",
] as const;

const BATCH_ALLOWANCE_FIELDS = [
  { field: "riceSubsidy", label: "Rice Subsidy" },
  { field: "uniformClothingAllowance", label: "Uniform / Clothing Allowance" },
  { field: "laundryAllowance", label: "Laundry Allowance" },
  { field: "actualMedicalAssistance", label: "Actual Medical Assistance" },
  { field: "medicalCashAllowanceToDependents", label: "Medical Cash Allowance to Dependents" },
  { field: "mealAllowance", label: "Meal Allowance" },
  { field: "christmasAnniversaryGifts", label: "Christmas / Anniversary Gifts" },
  { field: "achievementAwards", label: "Achievement Awards" },
  { field: "thirteenthMonthPay", label: "13th Month Pay" },
  { field: "christmasBonus", label: "Christmas Bonus" },
] as const;

type BatchAllowanceField = (typeof BATCH_ALLOWANCE_FIELDS)[number]["field"];
type BatchAllowanceScope = "all" | "department" | "employeeType" | "employmentStatus";
const BATCH_UPLOAD_SESSION_KEY = "axis_employee_batch_upload_preview";

type BasicPayFrequency = "Monthly" | "Hourly";

function normalizeBasicPayFrequency(value: unknown): BasicPayFrequency {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "hourly" || normalized === "perhour" || normalized === "hour") return "Hourly";
  return "Monthly";
}

function isValidBasicPayFrequency(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return !normalized || normalized === "monthly" || normalized === "hourly";
}

function getPositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function calculatePayFromBasicAmount(
  amountValue: unknown,
  frequencyValue: unknown,
  hoursValue: unknown,
  daysValue: unknown
) {
  const amount = getPositiveNumber(amountValue, 0);
  const frequency = normalizeBasicPayFrequency(frequencyValue);
  const hours = getPositiveNumber(hoursValue, 8);
  const days = getPositiveNumber(daysValue, 26);
  const monthlyHours = hours * days;
  const monthlyBasicPay = frequency === "Hourly" ? amount * monthlyHours : amount;
  const hourlyRate = monthlyHours > 0 ? monthlyBasicPay / monthlyHours : 0;

  return {
    frequency,
    hours,
    days,
    monthlyBasicPay,
    hourlyRate,
  };
}

function getEmployeePayValues(
  basicPayAmount: unknown,
  frequency: unknown,
  hoursValue: unknown,
  daysValue: unknown,
  fallbackHourlyRate?: unknown
) {
  const computed = calculatePayFromBasicAmount(basicPayAmount, frequency, hoursValue, daysValue);
  const fallbackHourly = getPositiveNumber(fallbackHourlyRate, 0);
  const hourlyRate = computed.hourlyRate || fallbackHourly;
  const monthlyBasicPay =
    computed.monthlyBasicPay || (computed.frequency === "Hourly" ? hourlyRate * computed.hours * computed.days : 0);

  return {
    ...computed,
    hourlyRate,
    monthlyBasicPay,
  };
}

const EMPLOYEE_IMPORT_SAMPLE_ROW = {
  employeeId: "EMP-001",
  payrollType: "A",
  lastName: "Santos",
  firstName: "Maria",
  middleName: "Lopez",
  gender: "Female",
  department: "Accounting",
  jobTitle: "Payroll Assistant",
  location: "Head Office",
  employeeType: "Rank and File",
  employmentStatus: "Regular",
  minimumWageEarner: "No",
  hireDate: "2024-01-15",
  biometricId: "BIO-001",
  baseSalary: "26000",
  payFrequency: "Semi-monthly",
  workingDaysPerMonth: "21.75",
  standardHoursPerDay: "8",
  exempt: "No",
} as const;

function escapeCsvValue(value: string | number) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

type DynamicAllowanceField = "amount" | "frequency" | "releaseMonth";
type DynamicLoanField =
  | "amount"
  | "amountPaid"
  | "balance"
  | "frequency"
  | "startDate"
  | "endDate"
  | "originalAmount"
  | "monthlyDeduction";

function parseAllowanceHeader(header: string): { name: string; field: DynamicAllowanceField } | null {
  const trimmedHeader = header.trim();
  const modernMatch = trimmedHeader.match(/^allowance_(.+?)_(amount|frequency|releaseMonth)$/i);
  if (modernMatch) {
    return {
      name: modernMatch[1].trim(),
      field: modernMatch[2] as DynamicAllowanceField,
    };
  }

  const legacyMatch = trimmedHeader.match(/^allowance_(.+)$/i);
  if (!legacyMatch) return null;
  return {
    name: legacyMatch[1].trim(),
    field: "amount",
  };
}

function parseLoanHeader(header: string): { name: string; field: DynamicLoanField } | null {
  const m = header.trim().match(/^loan_(.+?)_(amount|amountPaid|balance|frequency|startDate|endDate|originalAmount|monthlyDeduction)$/i);
  if (!m) return null;
  return { name: m[1].trim(), field: m[2] as DynamicLoanField };
}

function isDynamicImportHeader(header: string) {
  return Boolean(parseAllowanceHeader(header) || parseLoanHeader(header));
}

function readDynamicImportCell(row: BatchImportRow, header: string) {
  const allowance = parseAllowanceHeader(header);
  if (allowance) {
    const record = (row.allowances || row.customAllowances || []).find(
      (item) => item.name === allowance.name
    );
    if (!record) return "";
    return String(record[allowance.field] ?? "");
  }

  const loan = parseLoanHeader(header);
  if (loan) {
    const record = (row.loans || []).find((item) => (item.name || item.loanName) === loan.name);
    if (!record) return "";
    if (loan.field === "amount") return String(record.amount ?? record.originalAmount ?? "");
    if (loan.field === "balance") return String(record.balance ?? record.outstandingBalance ?? "");
    if (loan.field === "startDate") return String(record.startDate ?? record.dateStarted ?? "");
    return String(record[loan.field] ?? "");
  }

  return "";
}

function normalizeMoneyCell(value: string) {
  return value.trim().replace(/,/g, "");
}

function isNumericCell(value: string) {
  const normalized = normalizeMoneyCell(value);
  return normalized === "" || !Number.isNaN(Number(normalized));
}

function toNumberCell(value: number | string | undefined) {
  if (value === undefined) return 0;
  return Number(normalizeMoneyCell(String(value))) || 0;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputClassName} ${props.className || ""}`}
      style={props.style}
    />
  );
}

function TextAreaField(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${inputClassName} min-h-[120px] resize-y ${props.className || ""}`}
      style={props.style}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`${selectClassName} ${props.className || ""}`}
      style={props.style}
    />
  );
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="mb-2 text-sm font-semibold text-slate-700">
      {children}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </div>
  );
}

function TooltipIcon({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 4, verticalAlign: "middle" }}>
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#64748b", fontSize: 13, lineHeight: 1 }}
        aria-label="More information"
      >
        ⓘ
      </button>
      {visible ? (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0f172a",
          color: "#f1f5f9",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.5,
          whiteSpace: "normal",
          width: 220,
          zIndex: 50,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {text}
        </div>
      ) : null}
    </span>
  );
}

type AllowanceFrequency = "Monthly" | "Annual" | "Hourly";

function normalizeAllowanceFrequency(value: unknown): AllowanceFrequency {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "annual" || normalized === "yearly") return "Annual";
  if (normalized === "hourly" || normalized === "perhour" || normalized === "perhr" || normalized === "hour") return "Hourly";
  return "Monthly";
}

function isValidAllowanceFrequency(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return !normalized || ["monthly", "annual", "yearly", "hourly", "perhour", "perhr", "hour"].includes(normalized);
}

function AllowanceField({
  label,
  value,
  onChange,
  fieldKey,
  frequencies,
  onFrequencyChange,
  standardHoursPerDay,
  workingDaysPerMonth,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  fieldKey: string;
  frequencies: Record<string, AllowanceFrequency>;
  onFrequencyChange: (key: string, freq: AllowanceFrequency) => void;
  standardHoursPerDay: string;
  workingDaysPerMonth: string;
}) {
  const freq = frequencies[fieldKey] || "Monthly";
  const amount = Number(value) || 0;
  const hours = Number(standardHoursPerDay) || 8;
  const days = Number(workingDaysPerMonth) || 26;
  let monthlyEquiv: number | null = null;
  if (freq === "Annual") monthlyEquiv = amount / 12;
  else if (freq === "Hourly") monthlyEquiv = amount * hours * days;

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <InputField
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <SelectField
        value={freq}
        onChange={(e) => onFrequencyChange(fieldKey, e.target.value as AllowanceFrequency)}
        style={{ marginTop: 6 }}
      >
        <option value="Monthly">Monthly</option>
        <option value="Annual">Annual</option>
        <option value="Hourly">Hourly</option>
      </SelectField>
      {monthlyEquiv !== null ? (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: 600 }}>
          Monthly equivalent: ₱{monthlyEquiv.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${subtlePanelClassName} mb-6 p-5`}>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
      <div className="mb-4 flex items-start gap-3 border-b border-slate-200 pb-4">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-[#0a4f8f]">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          {helper ? <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{helper}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({
  children,
  columns = "repeat(2, minmax(0, 1fr))",
}: {
  children: React.ReactNode;
  columns?: string;
}) {
  const minWidth = columns.includes("5")
    ? "170px"
    : columns.includes("3")
    ? "220px"
    : "260px";

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_36px_-30px_rgba(8,47,73,0.72)] transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-950">{value || "-"}</div>
    </div>
  );
}

async function loadSavedEmployees(): Promise<EmployeeRecord[]> {
  return getCollectionItems<EmployeeRecord>(storageKeys.employees);
}

async function saveEmployeesToDirectory(nextEmployees: EmployeeRecord[]): Promise<void> {
  await setCollectionItems(storageKeys.employees, nextEmployees.map(e => ({ ...e, id: e.employeeNo })));
  window.dispatchEvent(new Event("employees-updated"));
}

function getSalaryChangedBy() {
  const user = auth.currentUser;
  return user?.displayName || user?.email || user?.uid || "unknown";
}

function buildSalaryHistoryForSave(
  beforeEmployee: EmployeeRecord | null,
  afterEmployee: EmployeeRecord,
  options: {
    effectiveDate: string;
    reason: string;
    changedAt: string;
    changedBy: string;
  }
) {
  const beforeBaseSalary = Number(beforeEmployee?.basicPay ?? 0) || 0;
  const afterBaseSalary = Number(afterEmployee.basicPay) || 0;
  const salaryChanged = !beforeEmployee || beforeBaseSalary !== afterBaseSalary;

  if (!salaryChanged) {
    return normalizeSalaryHistory(beforeEmployee || afterEmployee);
  }

  return appendSalaryHistoryEntry(beforeEmployee || afterEmployee, {
    effectiveDate: options.effectiveDate,
    baseSalary: afterBaseSalary,
    reason: options.reason,
    changedBy: options.changedBy,
    changedAt: options.changedAt,
  });
}

function formatMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}


function AddEmployeePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editEmployeeNo = searchParams.get("editEmployeeNo") || "";
  const viewEmployeeNo = searchParams.get("viewEmployeeNo") || "";
  const isBulkEmployeeEditMode = searchParams.get("mode") === "bulk-edit-employees";
  const isEditMode = editEmployeeNo.trim().length > 0;
  const isViewMode = !isEditMode && viewEmployeeNo.trim().length > 0;
  const selectedEmployeeNo = isEditMode ? editEmployeeNo : viewEmployeeNo;

  const [employeeNo, setEmployeeNo] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [gender, setGender] = useState("Female");

  const [company, setCompany] = useState("");
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [department, setDepartment] = useState("");
  const [isAddingNewDepartment, setIsAddingNewDepartment] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");
  const [editingDepartmentName, setEditingDepartmentName] = useState("");
  const [editedDepartmentName, setEditedDepartmentName] = useState("");
  async function saveDepartmentOptions(nextDepartments: string[]): Promise<string[]> {
    const cleanedDepartments = normalizeDepartmentList(nextDepartments);
    await setDataArray(storageKeys.departments, cleanedDepartments);
    setDepartmentOptions(cleanedDepartments);
    const companyInformation = await getConfigItem<Record<string, unknown>>(storageKeys.companyInformation, {});
    await setConfigItem(storageKeys.companyInformation, { ...companyInformation, departments: cleanedDepartments });
    if (!cleanedDepartments.includes(department)) {
      setDepartment("");
    }
    return cleanedDepartments;
  }

  async function handleDeleteDepartment(name: string) {
    const confirmed = window.confirm(`Delete department "${name}"?`);
    if (!confirmed) return;

    const nextDepartments = departmentOptions.filter((item) => item !== name);
    await saveDepartmentOptions(nextDepartments);

    if (department === name) {
      setDepartment("");
    }

    if (editingDepartmentName === name) {
      setEditingDepartmentName("");
      setEditedDepartmentName("");
    }
  }

  function handleStartEditDepartment(name: string) {
    setEditingDepartmentName(name);
    setEditedDepartmentName(name);
  }

  async function handleSaveEditedDepartment() {
    const cleanedNewName = editedDepartmentName.trim();

    if (!editingDepartmentName) return;

    if (!cleanedNewName) {
      window.alert("Please enter a department name.");
      return;
    }

    const alreadyExists = departmentOptions.some(
      (item) => item.toLowerCase() === cleanedNewName.toLowerCase() && item !== editingDepartmentName
    );

    if (alreadyExists) {
      window.alert("That department already exists.");
      return;
    }

    const nextDepartments = departmentOptions.map((item) =>
      item === editingDepartmentName ? cleanedNewName : item
    );

    await saveDepartmentOptions(nextDepartments);

    if (department === editingDepartmentName) {
      setDepartment(cleanedNewName);
    }

    setEditingDepartmentName("");
    setEditedDepartmentName("");
  }

  function handleCancelEditDepartment() {
    setEditingDepartmentName("");
    setEditedDepartmentName("");
  }

  async function handleAddDepartmentOption() {
    const cleanedName = newDepartment.trim();

    if (!cleanedName) {
      window.alert("Please enter a department name.");
      return;
    }

    const alreadyExists = departmentOptions.some(
      (item) => item.toLowerCase() === cleanedName.toLowerCase()
    );

    if (alreadyExists) {
      window.alert("That department already exists.");
      return;
    }

    await saveDepartmentOptions([...departmentOptions, cleanedName]);
    setDepartment(cleanedName);
    setIsAddingNewDepartment(false);
    setNewDepartment("");
  }
  const [jobTitle, setJobTitle] = useState("");
  const [payrollType, setPayrollType] = useState<"A" | "B">("A");
  const [employeeType, setEmployeeType] = useState("Rank and File");
  const [employmentClassification, setEmploymentClassification] = useState("Rank-and-file");
  const [isMinimumWageEarner, setIsMinimumWageEarner] = useState("No");
  const [payrollExempt, setPayrollExempt] = useState("No");
  const [immediateSupervisor, setImmediateSupervisor] = useState("");
  const [designatedWorkplace, setDesignatedWorkplace] = useState("");

  const [employmentStatus, setEmploymentStatus] = useState("Regular");
  const [userType, setUserType] = useState("Employee");
  const [jobCode, setJobCode] = useState("");
  const [jobGrade, setJobGrade] = useState("");
  const [costName, setCostName] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [expectedRegularizationDate, setExpectedRegularizationDate] = useState("");
  const [regularizationDate, setRegularizationDate] = useState("");
  const [expectedSeparationDate, setExpectedSeparationDate] = useState("");
  const [separationDate, setSeparationDate] = useState("");
  const [reasonForLeaving, setReasonForLeaving] = useState("");
  const [employeeRemarks, setEmployeeRemarks] = useState("");

  const [biometricId, setBiometricId] = useState("");
  const [shiftType, setShiftType] = useState("Day Shift");
  const [payslipId, setPayslipId] = useState("");

  const [hourlyRate, setHourlyRate] = useState("");
  const [basicPay, setBasicPay] = useState("");
  const [salaryEffectiveDate, setSalaryEffectiveDate] = useState(todayIsoDate());
  const [salaryChangeReason, setSalaryChangeReason] = useState("");
  const [basicPayFrequency, setBasicPayFrequency] = useState<BasicPayFrequency>("Monthly");
  const [standardHoursPerDay, setStandardHoursPerDay] = useState("8");
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState("21.75");
  const [riceSubsidy, setRiceSubsidy] = useState("0");
  const [uniformClothingAllowance, setUniformClothingAllowance] = useState("0");
  const [laundryAllowance, setLaundryAllowance] = useState("0");
  const [actualMedicalAssistance, setActualMedicalAssistance] = useState("0");
  const [medicalCashAllowanceToDependents, setMedicalCashAllowanceToDependents] = useState("0");
  const [mealAllowance, setMealAllowance] = useState("0");
  const [christmasAnniversaryGifts, setChristmasAnniversaryGifts] = useState("0");
  const [achievementAwards, setAchievementAwards] = useState("0");
  const [thirteenthMonthPay, setThirteenthMonthPay] = useState("0");
  const [christmasBonus, setChristmasBonus] = useState("0");
  const [deductAllowanceOnAbsence, setDeductAllowanceOnAbsence] = useState(false);
  const [customAllowanceRows, setCustomAllowanceRows] = useState<Array<{ id: string; name: string; amount: string; frequency: AllowanceFrequency }>>([]);
  const [deMinimisBenefits, setDeMinimisBenefits] = useState<DeMinimisBenefit[]>([]);

  const assignedDeMinimisBenefits = useMemo(() => {
    const assignmentEmployeeNo = (employeeNo.trim() || selectedEmployeeNo.trim() || "__new_employee__");

    return deMinimisBenefits.filter((benefit) =>
      deMinimisBenefitTargetsEmployee(benefit, {
        employeeNo: assignmentEmployeeNo,
        employeeType,
        employmentStatus,
        archived: false,
      })
    );
  }, [deMinimisBenefits, employeeNo, employeeType, employmentStatus, selectedEmployeeNo]);

  function addCustomAllowanceRow() {
    setCustomAllowanceRows((current) => [
      ...current,
      {
        id: `custom-allowance-${Date.now()}-${current.length + 1}`,
        name: "",
        amount: "0",
        frequency: "Monthly",
      },
    ]);
  }

  function updateCustomAllowanceRow(
    id: string,
    field: "name" | "amount" | "frequency",
    value: string
  ) {
    setCustomAllowanceRows((current) =>
      current.map((row) =>
        row.id === id
          ? { ...row, [field]: field === "frequency" ? normalizeAllowanceFrequency(value) : value }
          : row
      )
    );
  }

  function removeCustomAllowanceRow(id: string) {
    setCustomAllowanceRows((current) => current.filter((row) => row.id !== id));
  }

  const [loanRows, setLoanRows] = useState<Array<{
    id: string;
    loanName: string;
    dateStarted: string;
    endDate: string;
    frequency: string;
    originalAmount: string;
    outstandingBalance: string;
    isBalanceCustomized: boolean;
    monthlyDeduction: string;
  }>>([]);

  function addLoanRow() {
    setLoanRows((current) => [
      ...current,
      { id: `loan-${Date.now()}-${current.length + 1}`, loanName: "", dateStarted: "", endDate: "", frequency: "", originalAmount: "0", outstandingBalance: "0", isBalanceCustomized: false, monthlyDeduction: "0" },
    ]);
  }

  function updateLoanRow(id: string, field: string, value: string) {
    setLoanRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        if (field === "originalAmount" && !row.isBalanceCustomized) {
          return { ...row, originalAmount: value, outstandingBalance: value };
        }
        if (field === "outstandingBalance") {
          return { ...row, outstandingBalance: value, isBalanceCustomized: true };
        }
        return { ...row, [field]: value };
      })
    );
  }

  function removeLoanRow(id: string) {
    setLoanRows((current) => current.filter((row) => row.id !== id));
  }

  const [sss, setSSS] = useState("");
  const [philhealth, setPhilhealth] = useState("");
  const [pagibig, setPagibig] = useState("");
  const [tin, setTin] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountType, setBankAccountType] = useState("Savings");
  const [address, setAddress] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [employeePhotoDataUrl, setEmployeePhotoDataUrl] = useState("");
  const [portalUsername, setPortalUsername] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [portalStatus, setPortalStatus] = useState<"Active" | "Locked" | "Disabled">("Active");
  const [originalEmployeeSnapshot, setOriginalEmployeeSnapshot] = useState<EmployeeRecord | null>(null);
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [isDraggingBatchFile, setIsDraggingBatchFile] = useState(false);
  function handleEmployeePhotoUpload(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showFormWarning("Please upload an image file for the employee photo.");
      return;
    }

    const MAX_PHOTO_BYTES = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_PHOTO_BYTES) {
      showFormWarning("Employee photo must be 50 MB or smaller. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEmployeePhotoDataUrl(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }
  const [batchImportMessage, setBatchImportMessage] = useState("");
  const [formWarningMessage, setFormWarningMessage] = useState("");
  const [batchImportRows, setBatchImportRows] = useState<BatchImportRow[]>([]);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [batchCustomAllowanceHeaders, setBatchCustomAllowanceHeaders] = useState<string[]>([]);
  const [batchImportRowErrors, setBatchImportRowErrors] = useState<Record<number, string[]>>({});
  const hasRestoredBatchUploadRef = useRef(false);
  const [entryMode, setEntryMode] = useState<"batch" | "individual">("batch");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isAcceptedValuesOpen, setIsAcceptedValuesOpen] = useState(false);
  const [showDepartmentsModal, setShowDepartmentsModal] = useState(false);
  const [namedAllowanceFrequencies, setNamedAllowanceFrequencies] = useState<Record<string, AllowanceFrequency>>({});
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [isExistingEmployeeBatchMode, setIsExistingEmployeeBatchMode] = useState(false);
  const [existingEmployeeLoadScope, setExistingEmployeeLoadScope] = useState<"all" | "department" | "employeeType" | "employmentStatus" | "designatedWorkplace">("all");
  const [existingEmployeeLoadValue, setExistingEmployeeLoadValue] = useState("");
  const [batchAllowanceActionField, setBatchAllowanceActionField] = useState<BatchAllowanceField | "addCustomAllowance">("riceSubsidy");
  const [batchAllowanceActionAmount, setBatchAllowanceActionAmount] = useState("0");
  const [batchAllowanceActionScope, setBatchAllowanceActionScope] = useState<BatchAllowanceScope>("all");
  const [batchAllowanceActionValue, setBatchAllowanceActionValue] = useState("");
  const [batchNewAllowanceName, setBatchNewAllowanceName] = useState("");

  const fullName = useMemo(() => {
    const givenNames = [firstName, middleName].filter(Boolean).join(" ");
    return lastName && givenNames
      ? `${lastName}, ${givenNames}`
      : [lastName, firstName, middleName].filter(Boolean).join(" ");
  }, [firstName, middleName, lastName]);

  const currentPayValues = useMemo(
    () => getEmployeePayValues(basicPay, basicPayFrequency, standardHoursPerDay, workingDaysPerMonth, hourlyRate),
    [basicPay, basicPayFrequency, hourlyRate, standardHoursPerDay, workingDaysPerMonth]
  );

  const [existingEmployeeLoadOptions, setExistingEmployeeLoadOptions] = useState<string[]>([]);
  useEffect(() => {
    if (existingEmployeeLoadScope === "all") { setExistingEmployeeLoadOptions([]); return; }
    loadSavedEmployees().then((employees) => {
      const values = employees
        .filter(isActiveEmployeeRecord)
        .map((employee) => String(employee[existingEmployeeLoadScope] || "").trim())
        .filter(Boolean);
      setExistingEmployeeLoadOptions(Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)));
    });
  }, [existingEmployeeLoadScope]);
  const batchAllowanceActionOptions = useMemo(() => {
  if (batchAllowanceActionScope === "all") return [];

  const values = batchImportRows
    .map((row) => String(row[batchAllowanceActionScope] || "").trim())
    .filter(Boolean);

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}, [batchAllowanceActionScope, batchImportRows]);

function batchRowMatchesAllowanceScope(row: BatchImportRow) {
  if (batchAllowanceActionScope === "all") return true;
  if (!batchAllowanceActionValue) return true;
  return String(row[batchAllowanceActionScope] || "").trim() === batchAllowanceActionValue;
}

function applyBatchAllowanceAmount(nextAmount: string) {
  if (batchImportRows.length === 0) {
    showFormWarning("Please load or upload employees first before applying allowance changes.");
    return;
  }

  const amount = String(Number(nextAmount) || 0);
  const isAddingCustomAllowance = batchAllowanceActionField === "addCustomAllowance";
  const customAllowanceName = batchNewAllowanceName.trim();

  if (isAddingCustomAllowance && !customAllowanceName) {
    showFormWarning("Please enter the new allowance name before applying it.");
    return;
  }

  const customAllowanceHeader = isAddingCustomAllowance ? `allowance_${customAllowanceName}` : "";
  const selectedAllowance = BATCH_ALLOWANCE_FIELDS.find((item) => item.field === batchAllowanceActionField);

  const nextRows = batchImportRows.map((row) => {
    if (!batchRowMatchesAllowanceScope(row)) return row;

    if (isAddingCustomAllowance) {
      const existingCustomAllowances = Array.isArray(row.customAllowances) ? row.customAllowances : [];
      const otherCustomAllowances = existingCustomAllowances.filter(
        (allowance) => allowance.name.toLowerCase() !== customAllowanceName.toLowerCase()
      );

      return {
        ...row,
        [customAllowanceHeader]: amount,
        customAllowances:
          Number(amount) > 0
            ? [
                ...otherCustomAllowances,
                {
                  name: customAllowanceName,
                  amount: Number(amount) || 0,
                },
              ]
            : otherCustomAllowances,
      };
    }

    return {
      ...row,
      [batchAllowanceActionField]: amount,
    };
  });

  if (isAddingCustomAllowance && !batchCustomAllowanceHeaders.includes(customAllowanceHeader)) {
    setBatchCustomAllowanceHeaders((current) => [...current, customAllowanceHeader]);
  }

  const affectedRows = nextRows.filter(batchRowMatchesAllowanceScope).length;

  setBatchImportRows(nextRows);
  validateBatchRows(nextRows);
  setBatchImportMessage(
    `${isAddingCustomAllowance ? customAllowanceName : selectedAllowance?.label || "Allowance"} was set to ${Number(amount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} for ${affectedRows} row(s).`
  );
}

  useEffect(() => {
    if (isEditMode || isViewMode) return;

    const portalDefaultsId = window.setTimeout(() => {
      const cleanedEmployeeNo = employeeNo.trim();

      if (!cleanedEmployeeNo) {
        setPortalUsername("");
        setPortalPassword("");
        setMustChangePassword(true);
        setPortalStatus("Active");
        return;
      }

      setPortalUsername(generatePortalUsername(cleanedEmployeeNo));
      setPortalPassword((currentPassword) => currentPassword || generateTemporaryPassword());
      setMustChangePassword(true);
      setPortalStatus("Active");
    }, 0);

    return () => window.clearTimeout(portalDefaultsId);
  }, [employeeNo, isEditMode, isViewMode]);

  const loadDeMinimisBenefits = useCallback(async () => {
    const savedBenefits = await getCollectionItems<DeMinimisBenefit>(storageKeys.deMinimisBenefits);
    setDeMinimisBenefits(savedBenefits.filter((benefit) => !benefit.archived));
  }, []);

  useEffect(() => {
    loadDeMinimisBenefits();
    window.addEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);

    return () => {
      window.removeEventListener("de-minimis-benefits-updated", loadDeMinimisBenefits as EventListener);
    };
  }, [loadDeMinimisBenefits]);

  useEffect(() => {
    async function loadCompanyProfileDepartments() {
      const savedCompanyName = await getSavedCompanyName();
      if (savedCompanyName) setCompany(savedCompanyName);
      const companyDepartments = await getSavedCompanyDepartments();
      setDepartmentOptions(companyDepartments);
      if (department && !companyDepartments.includes(department)) setDepartment("");
    }

    loadCompanyProfileDepartments();
    window.addEventListener(`${storageKeys.companyInformation}-updated`, loadCompanyProfileDepartments as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.companyInformation}-updated`, loadCompanyProfileDepartments as EventListener);
    };
  }, [department]);

  useEffect(() => {
    const targetEmployeeNo = selectedEmployeeNo.trim();
    if (!targetEmployeeNo) return;

    async function loadEmployee() {
      const savedEmployees = await loadSavedEmployees();
      const foundEmployee = savedEmployees.find(
        (employee) => employee.employeeNo.toLowerCase() === targetEmployeeNo.toLowerCase()
      );

      if (!foundEmployee) {
        window.alert("Employee record not found.");
        return;
      }

      const savedCompanyName = await getSavedCompanyName();
      setEntryMode("individual");
      setEmployeeNo(foundEmployee.employeeNo || "");
      setLastName(foundEmployee.lastName || "");
      setFirstName(foundEmployee.firstName || "");
      setMiddleName(foundEmployee.middleName || "");
      setGender(foundEmployee.gender || "Female");
      setCompany(foundEmployee.company || savedCompanyName);
      setDepartment(foundEmployee.department || "");
      setIsAddingNewDepartment(false);
      setNewDepartment("");
      setJobTitle(foundEmployee.jobTitle || "");
      setPayrollType((foundEmployee.payrollRunType === "A" || foundEmployee.payrollRunType === "B") ? foundEmployee.payrollRunType : "A");
      setEmployeeType(foundEmployee.employeeType || "Rank and File");
      setEmploymentClassification(foundEmployee.employmentClassification || "Rank-and-file");
      setIsMinimumWageEarner(foundEmployee.isMinimumWageEarner || "No");
      setPayrollExempt(foundEmployee.payrollExempt?.toLowerCase() === "yes" ? "Yes" : "No");
      setImmediateSupervisor(foundEmployee.immediateSupervisor || "");
      setDesignatedWorkplace(foundEmployee.designatedWorkplace || "");
      setEmploymentStatus(["Regular", "Probationary", "Terminated"].includes(foundEmployee.employmentStatus || "") ? foundEmployee.employmentStatus : "Regular");
      setUserType(foundEmployee.userType || "Employee");
      setJobCode(foundEmployee.jobCode || "");
      setJobGrade(foundEmployee.jobGrade || "");
      setCostName(foundEmployee.costName || "");
      setEligibility(foundEmployee.eligibility || "");
      setHireDate(foundEmployee.hireDate || "");
      setExpectedRegularizationDate(foundEmployee.expectedRegularizationDate || "");
      setRegularizationDate(foundEmployee.regularizationDate || "");
      setExpectedSeparationDate(foundEmployee.expectedSeparationDate || "");
      setSeparationDate(foundEmployee.separationDate || "");
      setReasonForLeaving(foundEmployee.reasonForLeaving || "");
      setEmployeeRemarks(foundEmployee.employeeRemarks || "");
      setBiometricId(foundEmployee.biometricId || "");
      setShiftType(foundEmployee.shiftType || "Day Shift");
      setPayslipId(foundEmployee.payslipId || "");
      {
        const loadedFrequency = normalizeBasicPayFrequency(foundEmployee.basicPayFrequency);
        const loadedHours = getPositiveNumber(foundEmployee.standardHoursPerDay, 8);
        const loadedDays = getPositiveNumber(foundEmployee.workingDaysPerMonth, 21.75);
        const currentBaseSalary = getCurrentBaseSalary(foundEmployee);
        const loadedHourlyRate = Number(foundEmployee.hourlyRate) || calculatePayFromBasicAmount(currentBaseSalary, "Monthly", loadedHours, loadedDays).hourlyRate;
        setBasicPayFrequency(loadedFrequency);
        setStandardHoursPerDay(String(loadedHours));
        setWorkingDaysPerMonth(String(loadedDays));
        setHourlyRate(String(loadedHourlyRate || ""));
        setBasicPay(String(loadedFrequency === "Hourly" ? loadedHourlyRate || "" : currentBaseSalary ?? ""));
        setSalaryEffectiveDate(todayIsoDate());
        setSalaryChangeReason("");
      }
      setRiceSubsidy(String(foundEmployee.riceSubsidy ?? "0"));
      setUniformClothingAllowance(String(foundEmployee.uniformClothingAllowance ?? "0"));
      setLaundryAllowance(String(foundEmployee.laundryAllowance ?? "0"));
      setActualMedicalAssistance(String(foundEmployee.actualMedicalAssistance ?? "0"));
      setMedicalCashAllowanceToDependents(String(foundEmployee.medicalCashAllowanceToDependents ?? "0"));
      setMealAllowance(String(foundEmployee.mealAllowance ?? "0"));
      setChristmasAnniversaryGifts(String(foundEmployee.christmasAnniversaryGifts ?? "0"));
      setAchievementAwards(String(foundEmployee.achievementAwards ?? "0"));
      setThirteenthMonthPay(String(foundEmployee.thirteenthMonthPay ?? "0"));
      setChristmasBonus(String(foundEmployee.christmasBonus ?? "0"));
      setDeductAllowanceOnAbsence(foundEmployee.deductAllowanceOnAbsence ?? false);
      setNamedAllowanceFrequencies(
        foundEmployee.allowanceFrequencies && typeof foundEmployee.allowanceFrequencies === "object"
          ? Object.fromEntries(
              Object.entries(foundEmployee.allowanceFrequencies).map(([key, value]) => [key, normalizeAllowanceFrequency(value)])
            )
          : {}
      );
      setCustomAllowanceRows(
        Array.isArray(foundEmployee.customAllowances)
          ? foundEmployee.customAllowances.map((allowance, index) => ({
              id: `custom-allowance-edit-${index}-${Date.now()}`,
              name: allowance.name || "",
              amount: String(allowance.amount ?? "0"),
              frequency: normalizeAllowanceFrequency(allowance.frequency),
            }))
          : foundEmployee.otherAllowanceName || foundEmployee.otherAllowanceAmount
          ? [
              {
                id: `custom-allowance-edit-${Date.now()}`,
                name: foundEmployee.otherAllowanceName || "",
                amount: String(foundEmployee.otherAllowanceAmount ?? "0"),
                frequency: "Monthly",
              },
            ]
          : []
      );
      setSSS(foundEmployee.sss || "");
      setPhilhealth(foundEmployee.philhealth || "");
      setPagibig(foundEmployee.pagibig || "");
      setTin(foundEmployee.tin || "");
      setBankName(foundEmployee.bankName || "");
      setBankAccountNumber(foundEmployee.bankAccountNumber || "");
      setBankAccountType(foundEmployee.bankAccountType || "Savings");
      setAddress(foundEmployee.address || "");
      setBirthdate(foundEmployee.birthdate || "");
      setContactNumber(foundEmployee.contactNumber || "");
      setEmailAddress(foundEmployee.emailAddress || "");
      setEmployeePhotoDataUrl(foundEmployee.employeePhotoDataUrl || "");
      setPortalUsername(foundEmployee.portalUsername || generatePortalUsername(foundEmployee.employeeNo || ""));
      setPortalPassword(foundEmployee.portalPassword || generateTemporaryPassword());
      setMustChangePassword(foundEmployee.mustChangePassword ?? true);
      setPortalStatus(foundEmployee.portalStatus || "Active");
      setLoanRows(
        Array.isArray(foundEmployee.loans)
          ? foundEmployee.loans.map((loan) => ({
              id: loan.id || `loan-edit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              loanName: loan.loanName || "",
              dateStarted: toIsoDate(loan.dateStarted || loan.startDate || ""),
              endDate: toIsoDate(loan.endDate || ""),
              frequency: loan.frequency || "",
              originalAmount: String(loan.originalAmount ?? "0"),
              outstandingBalance: String(loan.outstandingBalance ?? "0"),
              isBalanceCustomized: true,
              monthlyDeduction: String(loan.monthlyDeduction ?? "0"),
            }))
          : []
      );
      setOriginalEmployeeSnapshot(foundEmployee);
      console.log("EMPLOYEE SNAPSHOT LOADED:", JSON.stringify(foundEmployee));
    }

    loadEmployee();
  }, [selectedEmployeeNo]);

  const SESSION_DRAFT_KEY = "axis_add_employee_draft";
  const SESSION_DRAFT_DISCARDED_KEY = "draft_discarded_add_employee";
  const SESSION_DRAFT_PROMPT_SHOWN_KEY = "draft_prompt_shown_add_employee";

  const saveBatchUploadPreview = useCallback((
    rows = batchImportRows,
    headers = batchCustomAllowanceHeaders,
    errors = batchImportRowErrors,
    message = batchImportMessage,
    isExistingBatch = isExistingEmployeeBatchMode
  ) => {
    try {
      if (rows.length === 0) {
        sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
        return;
      }

      sessionStorage.setItem(
        BATCH_UPLOAD_SESSION_KEY,
        JSON.stringify({
          rows,
          headers,
          errors,
          message,
          isExistingEmployeeBatchMode: isExistingBatch,
        })
      );
    } catch {
      // Ignore storage failures; the preview remains available in current memory.
    }
  }, [
    batchImportRows,
    batchCustomAllowanceHeaders,
    batchImportRowErrors,
    batchImportMessage,
    isExistingEmployeeBatchMode,
  ]);

  function clearBatchUploadPreview(message = "Batch upload cleared. Upload a CSV file to start over.") {
    try {
      sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
    } catch {}
    setBatchImportRows([]);
    setBatchCustomAllowanceHeaders([]);
    setBatchImportRowErrors({});
    setBatchImportMessage(message);
    setFormWarningMessage("");
    setIsExistingEmployeeBatchMode(false);
  }

  useEffect(() => {
    if (isEditMode || isViewMode) return;

    const restoreBatchUploadTimer = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(BATCH_UPLOAD_SESSION_KEY);
        if (!saved) return;

        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return;

        setEntryMode("batch");
        setBatchImportRows(parsed.rows);
        setBatchCustomAllowanceHeaders(Array.isArray(parsed.headers) ? parsed.headers : []);
        setBatchImportRowErrors(parsed.errors && typeof parsed.errors === "object" ? parsed.errors : {});
        setBatchImportMessage(
          parsed.message || `${parsed.rows.length} row(s) restored from your last CSV upload.`
        );
        setIsExistingEmployeeBatchMode(Boolean(parsed.isExistingEmployeeBatchMode));
      } catch {
        try {
          sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
        } catch {}
      } finally {
        hasRestoredBatchUploadRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(restoreBatchUploadTimer);
  }, [isEditMode, isViewMode]);

  useEffect(() => {
    if (isEditMode || isViewMode || !hasRestoredBatchUploadRef.current) return;

    const persistBatchUploadTimer = window.setTimeout(() => {
      saveBatchUploadPreview();
    }, 300);

    return () => window.clearTimeout(persistBatchUploadTimer);
  }, [
    isEditMode,
    isViewMode,
    batchImportRows,
    batchCustomAllowanceHeaders,
    batchImportRowErrors,
    batchImportMessage,
    isExistingEmployeeBatchMode,
    saveBatchUploadPreview,
  ]);

  function hasMeaningfulDraftContent(draft: Record<string, unknown>) {
    const meaningfulKeys = [
      "employeeNo", "lastName", "firstName", "middleName", "department", "jobTitle",
      "employeeType", "immediateSupervisor", "designatedWorkplace", "jobCode",
      "jobGrade", "costName", "eligibility", "hireDate", "expectedRegularizationDate",
      "regularizationDate", "expectedSeparationDate", "separationDate", "reasonForLeaving",
      "employeeRemarks", "biometricId", "payslipId", "hourlyRate", "basicPay", "sss",
      "philhealth", "pagibig", "tin", "bankName", "bankAccountNumber", "address",
      "birthdate", "contactNumber", "emailAddress", "portalUsername", "portalPassword",
      "employeePhotoDataUrl", "batchImportMessage", "existingEmployeeLoadValue",
      "batchAllowanceActionValue", "batchNewAllowanceName",
    ];
    if (meaningfulKeys.some((key) => String(draft[key] ?? "").trim())) return true;
    if (String(draft.userType || "Employee") !== "Employee") return true;
    if (String(draft.employmentStatus || "Regular") !== "Regular") return true;
    if (String(draft.gender || "") !== "") return true;
    if (String(draft.shiftType || "Day Shift") !== "Day Shift") return true;
    if (String(draft.bankAccountType || "Savings") !== "Savings") return true;
    if (String(draft.basicPayFrequency || "Monthly") !== "Monthly") return true;
    if (String(draft.standardHoursPerDay || "8") !== "8") return true;
    if (String(draft.workingDaysPerMonth || "21.75") !== "21.75") return true;
    if (String(draft.entryMode || "batch") !== "batch") return true;
    if (Array.isArray(draft.customAllowanceRows) && draft.customAllowanceRows.length > 0) return true;
    if (Array.isArray(draft.loanRows) && draft.loanRows.length > 0) return true;
    if (Array.isArray(draft.batchImportRows) && draft.batchImportRows.length > 0) return true;
    if (Array.isArray(draft.batchCustomAllowanceHeaders) && draft.batchCustomAllowanceHeaders.length > 0) return true;

    const moneyKeys = [
      "riceSubsidy", "uniformClothingAllowance", "laundryAllowance",
      "actualMedicalAssistance", "medicalCashAllowanceToDependents", "mealAllowance",
      "christmasAnniversaryGifts", "achievementAwards", "thirteenthMonthPay",
      "christmasBonus", "batchAllowanceActionAmount",
    ];
    return moneyKeys.some((key) => Number(String(draft[key] ?? "0").replace(/,/g, "")) > 0);
  }

  useEffect(() => {
    if (isEditMode || isViewMode) return;
    try {
      sessionStorage.removeItem(SESSION_DRAFT_PROMPT_SHOWN_KEY);
      if (sessionStorage.getItem(SESSION_DRAFT_DISCARDED_KEY) === "true") return;
      const saved = sessionStorage.getItem(SESSION_DRAFT_KEY);
      if (saved && sessionStorage.getItem(SESSION_DRAFT_PROMPT_SHOWN_KEY) !== "true") {
        setShowRestoreBanner(true);
        sessionStorage.setItem(SESSION_DRAFT_PROMPT_SHOWN_KEY, "true");
      }
    } catch {}
  }, [isEditMode, isViewMode]);

  function handleRestoreSession() {
    try {
      const saved = sessionStorage.getItem(SESSION_DRAFT_KEY);
      console.log("Add Employee draft contents:", saved);
      if (!saved) throw new Error("Missing draft");
      const draft = JSON.parse(saved);
      if (!draft || typeof draft !== "object") throw new Error("Invalid draft");
      setEntryMode(draft.entryMode === "batch" || draft.entryMode === "individual" ? draft.entryMode : "individual");
      setEmployeeNo(draft.employeeNo || "");
      setLastName(draft.lastName || "");
      setFirstName(draft.firstName || "");
      setMiddleName(draft.middleName || "");
      setGender(draft.gender || "Female");
      setDepartment(draft.department || "");
      setJobTitle(draft.jobTitle || "");
      setPayrollType((draft.payrollType === "A" || draft.payrollType === "B") ? draft.payrollType : "A");
      setEmployeeType(draft.employeeType || "Rank and File");
      setEmploymentClassification(draft.employmentClassification || "Rank-and-file");
      setIsMinimumWageEarner(draft.isMinimumWageEarner || "No");
      setPayrollExempt(draft.payrollExempt?.toLowerCase() === "yes" ? "Yes" : "No");
      setImmediateSupervisor(draft.immediateSupervisor || "");
      setDesignatedWorkplace(draft.designatedWorkplace || "");
      setEmploymentStatus(["Regular", "Probationary", "Terminated"].includes(draft.employmentStatus || "") ? draft.employmentStatus : "Regular");
      setUserType(draft.userType || "Employee");
      setJobCode(draft.jobCode || "");
      setJobGrade(draft.jobGrade || "");
      setCostName(draft.costName || "");
      setEligibility(draft.eligibility || "");
      setHireDate(draft.hireDate || "");
      setExpectedRegularizationDate(draft.expectedRegularizationDate || "");
      setRegularizationDate(draft.regularizationDate || "");
      setExpectedSeparationDate(draft.expectedSeparationDate || "");
      setSeparationDate(draft.separationDate || "");
      setReasonForLeaving(draft.reasonForLeaving || "");
      setEmployeeRemarks(draft.employeeRemarks || "");
      setBiometricId(draft.biometricId || "");
      setShiftType(draft.shiftType || "Day Shift");
      setPayslipId(draft.payslipId || "");
      setHourlyRate(draft.hourlyRate || "");
      setBasicPay(draft.basicPay || "");
      setBasicPayFrequency(normalizeBasicPayFrequency(draft.basicPayFrequency));
      setStandardHoursPerDay(draft.standardHoursPerDay || "8");
      setWorkingDaysPerMonth(draft.workingDaysPerMonth || "21.75");
      setRiceSubsidy(draft.riceSubsidy || "0");
      setUniformClothingAllowance(draft.uniformClothingAllowance || "0");
      setLaundryAllowance(draft.laundryAllowance || "0");
      setActualMedicalAssistance(draft.actualMedicalAssistance || "0");
      setMedicalCashAllowanceToDependents(draft.medicalCashAllowanceToDependents || "0");
      setMealAllowance(draft.mealAllowance || "0");
      setChristmasAnniversaryGifts(draft.christmasAnniversaryGifts || "0");
      setAchievementAwards(draft.achievementAwards || "0");
      setThirteenthMonthPay(draft.thirteenthMonthPay || "0");
      setChristmasBonus(draft.christmasBonus || "0");
      setDeductAllowanceOnAbsence(typeof draft.deductAllowanceOnAbsence === "boolean" ? draft.deductAllowanceOnAbsence : false);
      setCustomAllowanceRows(Array.isArray(draft.customAllowanceRows) ? draft.customAllowanceRows : []);
      setSSS(draft.sss || "");
      setPhilhealth(draft.philhealth || "");
      setPagibig(draft.pagibig || "");
      setTin(draft.tin || "");
      setBankName(draft.bankName || "");
      setBankAccountNumber(draft.bankAccountNumber || "");
      setBankAccountType(draft.bankAccountType || "Savings");
      setAddress(draft.address || "");
      setBirthdate(draft.birthdate || "");
      setContactNumber(draft.contactNumber || "");
      setEmailAddress(draft.emailAddress || "");
      setEmployeePhotoDataUrl(draft.employeePhotoDataUrl || "");
      setPortalUsername(draft.portalUsername || "");
      setPortalPassword(draft.portalPassword || "");
      setMustChangePassword(typeof draft.mustChangePassword === "boolean" ? draft.mustChangePassword : true);
      setPortalStatus(draft.portalStatus || "Active");
      setLoanRows(Array.isArray(draft.loanRows) ? draft.loanRows : []);
      setBatchImportMessage(draft.batchImportMessage || "");
      setBatchImportRows(Array.isArray(draft.batchImportRows) ? draft.batchImportRows : []);
      setBatchCustomAllowanceHeaders(Array.isArray(draft.batchCustomAllowanceHeaders) ? draft.batchCustomAllowanceHeaders : []);
      setBatchImportRowErrors(draft.batchImportRowErrors && typeof draft.batchImportRowErrors === "object" ? draft.batchImportRowErrors : {});
      setNamedAllowanceFrequencies(draft.namedAllowanceFrequencies && typeof draft.namedAllowanceFrequencies === "object" ? draft.namedAllowanceFrequencies : {});
      setIsExistingEmployeeBatchMode(Boolean(draft.isExistingEmployeeBatchMode));
      setExistingEmployeeLoadScope(draft.existingEmployeeLoadScope || "all");
      setExistingEmployeeLoadValue(draft.existingEmployeeLoadValue || "");
      setBatchAllowanceActionField(draft.batchAllowanceActionField || "riceSubsidy");
      setBatchAllowanceActionAmount(draft.batchAllowanceActionAmount || "0");
      setBatchAllowanceActionScope(draft.batchAllowanceActionScope || "all");
      setBatchAllowanceActionValue(draft.batchAllowanceActionValue || "");
      setBatchNewAllowanceName(draft.batchNewAllowanceName || "");
      try { sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY); } catch {}
    } catch {
      window.alert("Draft could not be restored.");
      try {
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY);
      } catch {}
    } finally {
      setShowRestoreBanner(false);
    }
  }

  function handleDiscardSession() {
    try {
      sessionStorage.removeItem(SESSION_DRAFT_KEY);
      sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
      sessionStorage.setItem(SESSION_DRAFT_DISCARDED_KEY, "true");
    } catch {}
    clearBatchUploadPreview("");
    setShowRestoreBanner(false);
  }

  useEffect(() => {
    if (isEditMode || isViewMode || showRestoreBanner) return;
    const draft = {
      employeeNo, lastName, firstName, middleName, gender, department, jobTitle,
      payrollType, employeeType, employmentClassification, isMinimumWageEarner, payrollExempt,
      immediateSupervisor, designatedWorkplace, employmentStatus, userType, jobCode, jobGrade, costName,
      eligibility, hireDate, expectedRegularizationDate, regularizationDate,
      expectedSeparationDate, separationDate, reasonForLeaving, employeeRemarks,
      biometricId, shiftType, payslipId, hourlyRate, basicPay, basicPayFrequency,
      standardHoursPerDay, workingDaysPerMonth, riceSubsidy,
      uniformClothingAllowance, laundryAllowance, actualMedicalAssistance,
      medicalCashAllowanceToDependents, mealAllowance, christmasAnniversaryGifts,
      achievementAwards, thirteenthMonthPay, christmasBonus, deductAllowanceOnAbsence, customAllowanceRows,
      loanRows,
      sss, philhealth, pagibig, tin, bankName, bankAccountNumber, bankAccountType,
      address, birthdate, contactNumber, emailAddress, employeePhotoDataUrl,
      portalUsername, portalPassword, mustChangePassword, portalStatus,
      entryMode, batchImportMessage, batchImportRows, batchCustomAllowanceHeaders,
      batchImportRowErrors, namedAllowanceFrequencies,
      isExistingEmployeeBatchMode, existingEmployeeLoadScope, existingEmployeeLoadValue,
      batchAllowanceActionField, batchAllowanceActionAmount, batchAllowanceActionScope,
      batchAllowanceActionValue, batchNewAllowanceName,
    };
    const saveTimeout = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(SESSION_DRAFT_DISCARDED_KEY) === "true") return;
        if (!hasMeaningfulDraftContent(draft)) {
          sessionStorage.removeItem(SESSION_DRAFT_KEY);
          return;
        }
        sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore draft persistence failures
      }
    }, 500);
    return () => window.clearTimeout(saveTimeout);
  }, [
    isEditMode, isViewMode, showRestoreBanner, employeeNo, lastName, firstName, middleName, gender,
    department, jobTitle, payrollType, employeeType, employmentClassification, isMinimumWageEarner, payrollExempt,
    immediateSupervisor, designatedWorkplace, employmentStatus, userType, jobCode,
    jobGrade, costName, eligibility, hireDate, expectedRegularizationDate,
    regularizationDate, expectedSeparationDate, separationDate, reasonForLeaving,
    employeeRemarks, biometricId, shiftType, payslipId, hourlyRate, basicPay,
    basicPayFrequency, standardHoursPerDay, workingDaysPerMonth,
    riceSubsidy, uniformClothingAllowance, laundryAllowance, actualMedicalAssistance,
    medicalCashAllowanceToDependents, mealAllowance, christmasAnniversaryGifts,
    achievementAwards, thirteenthMonthPay, christmasBonus, deductAllowanceOnAbsence, customAllowanceRows,
    loanRows,
    sss, philhealth, pagibig, tin, bankName, bankAccountNumber, bankAccountType,
    address, birthdate, contactNumber, emailAddress, employeePhotoDataUrl,
    portalUsername, portalPassword, mustChangePassword, portalStatus,
    entryMode, batchImportMessage, batchImportRows, batchCustomAllowanceHeaders,
    batchImportRowErrors, namedAllowanceFrequencies,
    isExistingEmployeeBatchMode, existingEmployeeLoadScope, existingEmployeeLoadValue,
    batchAllowanceActionField, batchAllowanceActionAmount, batchAllowanceActionScope,
    batchAllowanceActionValue, batchNewAllowanceName,
  ]);

  function showFormWarning(message: string) {
    setFormWarningMessage(message);
    window.alert(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getBatchRowValue(
    values: string[],
    headerIndexMap: Map<string, number>,
    header: (typeof EMPLOYEE_IMPORT_HEADERS)[number]
  ) {
    return values[headerIndexMap.get(header) ?? -1] ?? "";
  }

  function validateBatchRows(rows: BatchImportRow[], savedEmployees: EmployeeRecord[] = []) {
    const nextErrors: Record<number, string[]> = {};
    const seenEmployeeIds = new Map<string, number>();

    rows.forEach((row, rowIndex) => {
      const errors: string[] = [];

      // Required field checks
      if (!row.employeeId.trim()) errors.push("Employee ID is required.");
      if (!row.lastName.trim()) errors.push("Last Name is required.");
      if (!row.firstName.trim()) errors.push("First Name is required.");
      if (!row.department.trim()) errors.push("Department is required.");
      if (!row.jobTitle.trim()) errors.push("Job Title is required.");
      if (!row.location.trim()) errors.push("Location is required.");
      if (!row.biometricId.trim()) errors.push("Biometric ID is required.");

      // Payroll Type
      if (!row.payrollType.trim()) {
        errors.push("Payroll Type is required.");
      } else if (!["a", "b"].includes(row.payrollType.trim().toLowerCase())) {
        errors.push("Payroll Type must be A or B.");
      }

      // Employee Type
      if (!row.employeeType.trim()) {
        errors.push("Employee Type is required.");
      } else if (!["rank and file", "supervisory", "managerial"].includes(row.employeeType.trim().toLowerCase())) {
        errors.push("Employee Type must be 'Rank and File', 'Supervisory', or 'Managerial'.");
      }

      // Employment Status
      if (!row.employmentStatus.trim()) {
        errors.push("Employment Status is required.");
      } else if (!["regular", "probationary", "terminated"].includes(row.employmentStatus.trim().toLowerCase())) {
        errors.push("Employment Status must be Regular, Probationary, or Terminated.");
      }

      // Gender (optional — Male or Female only)
      if (row.gender.trim() && !["male", "female"].includes(row.gender.trim().toLowerCase())) {
        errors.push("Gender must be Male or Female if provided.");
      }

      // Minimum Wage Earner (required)
      if (!row.minimumWageEarner.trim()) {
        errors.push("Minimum Wage Earner is required.");
      } else if (!["yes", "no"].includes(row.minimumWageEarner.trim().toLowerCase())) {
        errors.push("Minimum Wage Earner must be Yes or No.");
      }

      // Exempt
      if (!row.exempt.trim()) {
        errors.push("Exempt is required.");
      } else if (!["yes", "no"].includes(row.exempt.trim().toLowerCase())) {
        errors.push("Exempt must be Yes or No.");
      }

      // Hire Date — accept MM/DD/YYYY or YYYY-MM-DD, then store internally as YYYY-MM-DD.
      const hireDateRaw = row.hireDate.trim();
      const hireDateIso = normalizeEmployeeImportDateToIso(hireDateRaw);
      if (!hireDateRaw) {
        errors.push("Hire Date is required.");
      } else if (!isValidIsoDate(hireDateIso)) {
        errors.push("Hire Date must be a valid MM/DD/YYYY or YYYY-MM-DD date, e.g. 07/19/2019 or 2019-07-19.");
      }

      // Base Salary
      const baseSalaryRaw = normalizeMoneyCell(row.baseSalary.trim());
      if (!baseSalaryRaw) {
        errors.push("Base Salary is required.");
      } else {
        const baseSalaryNum = Number(baseSalaryRaw);
        if (!Number.isFinite(baseSalaryNum) || baseSalaryNum <= 0) {
          errors.push("Base Salary must be a positive number.");
        }
      }

      // Working Days Per Month
      const wdpmRaw = row.workingDaysPerMonth.trim();
      if (wdpmRaw) {
        const wdpmNum = Number(wdpmRaw);
        if (!Number.isFinite(wdpmNum) || wdpmNum <= 0) {
          errors.push("Working Days Per Month must be a positive number.");
        }
      }

      // Standard Hours Per Day
      const shdRaw = row.standardHoursPerDay.trim();
      if (shdRaw) {
        const shdNum = Number(shdRaw);
        if (!Number.isFinite(shdNum) || shdNum <= 0) {
          errors.push("Standard Hours Per Day must be a positive number.");
        }
      }

      // Dynamic allowance/loan headers
      batchCustomAllowanceHeaders.forEach((header) => {
        const value = readDynamicImportCell(row, header).trim();
        const allowance = parseAllowanceHeader(header);
        const loan = parseLoanHeader(header);
        const numericDynamicFields = ["amount", "amountPaid", "balance", "originalAmount", "monthlyDeduction"];
        const dateDynamicFields = ["startDate", "endDate"];

        if (allowance?.field === "amount" && value && !isNumericCell(value)) {
          errors.push(`${header} must be a valid number.`);
        }
        if (allowance?.field === "frequency" && value && !isValidAllowanceFrequency(value)) {
          errors.push(`${header} must be Monthly, Annual, or Hourly.`);
        }
        if (loan && numericDynamicFields.includes(loan.field) && value && !isNumericCell(value)) {
          errors.push(`${header} must be a valid number.`);
        }
        if (loan && dateDynamicFields.includes(loan.field) && value && !isValidCsvDate(value)) {
          errors.push(`${header} must follow MM/DD/YYYY format, example: 01/15/2024.`);
        }
      });

      // Duplicate Employee ID within file
      const employeeIdKey = normalizeDuplicateText(row.employeeId);
      if (employeeIdKey) {
        const firstSeenRow = seenEmployeeIds.get(employeeIdKey);
        if (firstSeenRow !== undefined) {
          errors.push(`Employee ID is duplicated with Preview Row ${firstSeenRow + 1}.`);
        } else {
          seenEmployeeIds.set(employeeIdKey, rowIndex);
        }
      }

      // Duplicate Employee ID against saved records
      if (row.employeeId.trim() && !isExistingEmployeeBatchMode) {
        const existsInSaved = savedEmployees.some(
          (e) => normalizeDuplicateText(e.employeeNo) === employeeIdKey
        );
        if (existsInSaved) {
          errors.push("Employee ID already exists in the employee master file.");
        }
      }

      if (errors.length > 0) {
        nextErrors[rowIndex] = errors;
      }
    });

    setBatchImportRowErrors(nextErrors);
    return nextErrors;
  }

  function updateBatchImportCell(
    rowIndex: number,
    field: (typeof EMPLOYEE_IMPORT_HEADERS)[number],
    value: string
  ) {
    const nextRows = batchImportRows.map((row, index) => {
      if (index !== rowIndex) return row;
      return { ...row, [field]: value };
    });

    setBatchImportRows(nextRows);

    const nextErrors = validateBatchRows(nextRows);
    const firstErrorEntry = Object.entries(nextErrors)[0];

    if (firstErrorEntry) {
      const [firstErrorRowIndex, firstRowErrors] = firstErrorEntry;
      setBatchImportMessage(
        `Cannot save imported employees yet. Fix the red cells first. Preview Row ${Number(firstErrorRowIndex) + 1}: ${firstRowErrors[0]}`
      );
    } else {
      setBatchImportMessage(
        isExistingEmployeeBatchMode
          ? `${nextRows.length} row(s) loaded. Review them below, then click Update Employees.`
          : `${nextRows.length} row(s) loaded. Review them below, then click Save Imported Employees.`
      );
    }
  }

  function updateDynamicImportCell(rowIndex: number, header: string, value: string) {
    const allowanceHeader = parseAllowanceHeader(header);
    const loanHeader = parseLoanHeader(header);

    const nextRows = batchImportRows.map((row, index) => {
      if (index !== rowIndex) return row;

      if (allowanceHeader) {
        const sourceAllowances = row.allowances || row.customAllowances || [];
        const existingAllowance = sourceAllowances.find((item) => item.name === allowanceHeader.name);
        const trimmedValue = value.trim();
        const nextValue =
          allowanceHeader.field === "frequency"
            ? isValidAllowanceFrequency(trimmedValue)
              ? normalizeAllowanceFrequency(trimmedValue)
              : trimmedValue
            : value;
        const nextAllowance: CustomAllowanceRecord = {
          name: allowanceHeader.name,
          amount: existingAllowance?.amount ?? "",
          frequency: existingAllowance?.frequency ?? "",
          releaseMonth: existingAllowance?.releaseMonth ?? "",
          [allowanceHeader.field]: nextValue,
        };
        const nextAllowances = [
          ...sourceAllowances.filter((item) => item.name !== allowanceHeader.name),
          nextAllowance,
        ];
        return {
          ...row,
          allowances: nextAllowances,
          customAllowances: nextAllowances,
        };
      }

      if (loanHeader) {
        const sourceLoans = row.loans || [];
        const existingLoan = sourceLoans.find((item) => (item.name || item.loanName) === loanHeader.name);
        const nextLoan: LoanEntry = {
          id: existingLoan?.id || `loan-import-${loanHeader.name}-${rowIndex}`,
          loanName: loanHeader.name,
          name: loanHeader.name,
          dateStarted: existingLoan?.dateStarted || existingLoan?.startDate || "",
          startDate: existingLoan?.startDate || existingLoan?.dateStarted || "",
          endDate: existingLoan?.endDate || "",
          originalAmount: existingLoan?.originalAmount ?? toNumberCell(existingLoan?.amount),
          amount: existingLoan?.amount ?? "",
          amountPaid: existingLoan?.amountPaid ?? "",
          outstandingBalance: existingLoan?.outstandingBalance ?? toNumberCell(existingLoan?.balance),
          balance: existingLoan?.balance ?? "",
          frequency: existingLoan?.frequency || "",
          monthlyDeduction: existingLoan?.monthlyDeduction ?? 0,
        };

        if (loanHeader.field === "amount" || loanHeader.field === "originalAmount") {
          nextLoan.amount = value;
          nextLoan.originalAmount = toNumberCell(value);
        } else if (loanHeader.field === "balance") {
          nextLoan.balance = value;
          nextLoan.outstandingBalance = toNumberCell(value);
        } else if (loanHeader.field === "startDate") {
          const normalizedDate = normalizeCsvDate(value);
          nextLoan.startDate = normalizedDate;
          nextLoan.dateStarted = normalizedDate;
        } else if (loanHeader.field === "endDate") {
          nextLoan.endDate = normalizeCsvDate(value);
        } else if (loanHeader.field === "monthlyDeduction") {
          nextLoan.monthlyDeduction = toNumberCell(value);
        } else {
          nextLoan[loanHeader.field] = value;
        }

        return {
          ...row,
          loans: [
            ...sourceLoans.filter((item) => (item.name || item.loanName) !== loanHeader.name),
            nextLoan,
          ],
        };
      }

      return row;
    });

    setBatchImportRows(nextRows);

    const nextErrors = validateBatchRows(nextRows);
    const firstErrorEntry = Object.entries(nextErrors)[0];
    if (firstErrorEntry) {
      const [firstErrorRowIndex, firstRowErrors] = firstErrorEntry;
      setBatchImportMessage(
        `Cannot save imported employees yet. Fix the red cells first. Preview Row ${Number(firstErrorRowIndex) + 1}: ${firstRowErrors[0]}`
      );
    } else {
      setBatchImportMessage(
        isExistingEmployeeBatchMode
          ? `${nextRows.length} row(s) loaded. Review them below, then click Update Employees.`
          : `${nextRows.length} row(s) loaded. Review them below, then click Save Imported Employees.`
      );
    }
  }

  function removeBatchImportRow(rowIndex: number) {
    const nextRows = batchImportRows.filter((_, currentIndex) => currentIndex !== rowIndex);
    setBatchImportRows(nextRows);

    const nextErrors = validateBatchRows(nextRows);
    const firstErrorEntry = Object.entries(nextErrors)[0];

    if (nextRows.length === 0) {
      setBatchImportMessage(
        isExistingEmployeeBatchMode
          ? "All loaded employees have been removed. Load existing employees again to continue."
          : "All imported employees have been removed. Upload a CSV file again to continue."
      );
      return;
    }

    if (firstErrorEntry) {
      const [firstErrorRowIndex, firstRowErrors] = firstErrorEntry;
      setBatchImportMessage(
        `Cannot save imported employees yet. Fix the red cells first. Preview Row ${Number(firstErrorRowIndex) + 1}: ${firstRowErrors[0]}`
      );
    } else {
      setBatchImportMessage(
        isExistingEmployeeBatchMode
          ? `${nextRows.length} row(s) remaining for update. Removed employees will not be edited.`
          : `${nextRows.length} row(s) ready. Review them below, then click Save Imported Employees.`
      );
    }
  }

  async function handleSaveImportedRows() {
    setFormWarningMessage("");

    if (batchImportRows.length === 0) {
      showFormWarning(isExistingEmployeeBatchMode ? "Please load existing employees first." : "Please upload a CSV file first.");
      return;
    }

    const savedEmployeesBeforeImport = await loadSavedEmployees();

    const errors = validateBatchRows(batchImportRows, savedEmployeesBeforeImport);
    const firstErrorEntry = Object.entries(errors)[0];

    if (firstErrorEntry) {
      const [rowIndex, rowErrors] = firstErrorEntry;
      const message = `Cannot save imported employees yet. Fix the red cells first. Preview Row ${Number(rowIndex) + 1}: ${rowErrors[0]}`;
      setBatchImportMessage(message);
      showFormWarning(message);
      return;
    }

    setShowImportConfirm(true);
  }

  async function confirmSaveImportedRows() {
    setShowImportConfirm(false);
    setIsSavingImport(true);

    const savedEmployeesBeforeImport = await loadSavedEmployees();

    const importedEmployees: EmployeeRecord[] = batchImportRows.map((row) => {
      const employeeId = row.employeeId.trim();
      const existingEmployee = savedEmployeesBeforeImport.find(
        (e) => e.employeeNo.toLowerCase() === employeeId.toLowerCase() ||
               e.payslipId?.toLowerCase() === employeeId.toLowerCase()
      );

      const days = getPositiveNumber(row.workingDaysPerMonth, 21.75);
      const hours = getPositiveNumber(row.standardHoursPerDay, 8);
      const baseSalary = Number(normalizeMoneyCell(row.baseSalary)) || 0;
      // Compute hourly rate from base salary — do NOT store a separate column
      const computedHourlyRate = days > 0 && hours > 0 ? baseSalary / days / hours : 0;
      const hireDateIso = normalizeEmployeeImportDateToIso(row.hireDate);
      const salaryEffectiveDateForImport = isValidSalaryIsoDate(hireDateIso)
        ? hireDateIso
        : todayIsoDate();

      let mergedRecord: EmployeeRecord = {
        // Defaults for all required EmployeeRecord string fields not set below
        userType: "Employee", jobCode: "", jobGrade: "", costName: "", eligibility: "",
        expectedRegularizationDate: "", regularizationDate: "", expectedSeparationDate: "",
        separationDate: "", reasonForLeaving: "", employeeRemarks: "",
        shiftType: "Day Shift", riceSubsidy: 0,
        uniformClothingAllowance: 0, laundryAllowance: 0, actualMedicalAssistance: 0,
        medicalCashAllowanceToDependents: 0, mealAllowance: 0, christmasAnniversaryGifts: 0,
        achievementAwards: 0, thirteenthMonthPay: 0, christmasBonus: 0, otherAllowanceName: "",
        otherAllowanceAmount: 0, employmentClassification: "Rank-and-file",
        // Preserve all existing fields so unrelated data is not overwritten
        ...(existingEmployee ?? {}),
        employeeNo: employeeId,
        payslipId: employeeId,
        lastName: row.lastName.trim(),
        firstName: row.firstName.trim(),
        middleName: row.middleName.trim(),
        gender: row.gender?.trim() || existingEmployee?.gender || "",
        company: company.trim(),
        department: normalizeImportDepartmentName(row.department, departmentOptions),
        jobTitle: row.jobTitle.trim(),
        employeeType: row.employeeType.trim(),
        employmentStatus: row.employmentStatus.trim(),
        hireDate: hireDateIso,
        biometricId: row.biometricId.trim(),
        designatedWorkplace: row.location.trim(),
        payrollRunType: row.payrollType.trim().toUpperCase() as "A" | "B",
        basicPay: baseSalary,
        standardHoursPerDay: hours,
        workingDaysPerMonth: days,
        hourlyRate: computedHourlyRate,
        basicPayFrequency: "Monthly" as const,
        isMinimumWageEarner: row.minimumWageEarner.trim().toLowerCase() === "yes" ? "Yes" : "No",
        payrollExempt: row.exempt.trim().toLowerCase() === "yes" ? "Yes" : "No",
        // Government IDs, bank, and contact details from the CSV (fall back to
        // any existing value so a blank cell does not wipe saved data).
        sss: row.sss?.trim() || existingEmployee?.sss || "",
        philhealth: row.philhealth?.trim() || existingEmployee?.philhealth || "",
        pagibig: row.pagibig?.trim() || existingEmployee?.pagibig || "",
        tin: row.tin?.trim() || existingEmployee?.tin || "",
        bankName: row.bankName?.trim() || existingEmployee?.bankName || "",
        bankAccountType: row.bankAccountType?.trim() || existingEmployee?.bankAccountType || "Savings",
        bankAccountNumber: row.bankAccountNumber?.trim() || existingEmployee?.bankAccountNumber || "",
        birthdate: row.birthdate?.trim() || existingEmployee?.birthdate || "",
        contactNumber: row.contactNumber?.trim() || existingEmployee?.contactNumber || "",
        emailAddress: row.emailAddress?.trim() || existingEmployee?.emailAddress || "",
        address: row.address?.trim() || existingEmployee?.address || "",
        immediateSupervisor: row.immediateSupervisor?.trim() || existingEmployee?.immediateSupervisor || "",
        customAllowances: [
          ...(existingEmployee?.customAllowances?.filter((a) => a.name !== "De Minimis") ?? []),
          ...(row.allowances || row.customAllowances || []).map((a) => ({
            name: a.name,
            amount: toNumberCell(a.amount),
            frequency: normalizeAllowanceFrequency(a.frequency),
            releaseMonth: a.releaseMonth || "",
          })),
        ],
        loans: [],
        employeePhotoDataUrl: existingEmployee?.employeePhotoDataUrl || "",
        portalUsername: existingEmployee?.portalUsername || generatePortalUsername(employeeId),
        portalPassword: existingEmployee?.portalPassword || generateTemporaryPassword(),
        mustChangePassword: existingEmployee?.mustChangePassword ?? true,
        portalStatus: existingEmployee?.portalStatus || "Active",
        lastPasswordChangedAt: existingEmployee?.lastPasswordChangedAt || "",
      };

      const salaryHistory = buildSalaryHistoryForSave(existingEmployee || null, mergedRecord, {
        effectiveDate: existingEmployee ? todayIsoDate() : salaryEffectiveDateForImport,
        reason: existingEmployee ? "Batch import salary update" : "Initial base salary",
        changedAt: new Date().toISOString(),
        changedBy: getSalaryChangedBy(),
      });
      mergedRecord = {
        ...mergedRecord,
        salaryHistory,
        basicPay: getCurrentBaseSalary({ ...mergedRecord, salaryHistory }),
      };

      return mergedRecord;
    });

    const employeeMap = new Map<string, EmployeeRecord>();

    savedEmployeesBeforeImport.forEach((employee) => {
      employeeMap.set(employee.employeeNo, employee);
    });

    importedEmployees.forEach((employee) => {
      employeeMap.set(employee.employeeNo, employee);
    });

    const nextEmployees = Array.from(employeeMap.values());

    try {
      await saveEmployeesToDirectory(nextEmployees);
      try {
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_PROMPT_SHOWN_KEY);
      } catch {}
    } catch (error) {
      console.error("Failed to save imported employees", error);
      setIsSavingImport(false);
      window.alert("Imported employees could not be saved. Please try again or remove large employee photos.");
      return;
    }
    await saveDepartmentOptions([
      ...departmentOptions,
      ...batchImportRows.map((row) => row.department.trim()).filter(Boolean),
    ]);
    setFormWarningMessage("");
    importedEmployees.forEach((emp) => {
      const beforeEmployee = savedEmployeesBeforeImport.find((saved) => saved.employeeNo === emp.employeeNo);
      logAudit({
        action: isExistingEmployeeBatchMode ? "EDITED" : "CREATED",
        entityType: "Employee",
        entityId: emp.employeeNo,
        entityName: `${emp.lastName}, ${emp.firstName}${emp.middleName ? " " + emp.middleName : ""}`.trim(),
        details: beforeEmployee ? diffEmployeeRecord(beforeEmployee, emp) : "Batch imported",
      });
    });

    setBatchImportRows([]);
    setBatchCustomAllowanceHeaders([]);
    setBatchImportRowErrors({});
    try {
      sessionStorage.removeItem(BATCH_UPLOAD_SESSION_KEY);
    } catch {}

    setIsSavingImport(false);
    router.push("/employees");
  }

  function handleDownloadTemplate() {
    const templateSampleRow: Record<string, string> = {
      ...EMPLOYEE_IMPORT_SAMPLE_ROW,
      department: departmentOptions[0] || "Accounting",
    };

    const headerRow = EMPLOYEE_IMPORT_HEADERS.map((h) => escapeCsvValue(h)).join(",");
    const sampleRow = EMPLOYEE_IMPORT_HEADERS.map((h) => escapeCsvValue(templateSampleRow[h] ?? "")).join(",");

    const csvContent = [headerRow, sampleRow].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleBatchImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    // Reset the input so selecting the same file again still fires onChange.
    event.target.value = "";
    await processBatchFile(file);
  }

  async function handleBatchDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingBatchFile(false);
    if (isImportingBatch) return;
    const file = event.dataTransfer?.files?.[0] || null;
    await processBatchFile(file);
  }

  async function processBatchFile(file: File | null) {
    if (!file) return;

    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
    if (!isCsv) {
      const message = "Please drop a .csv file exported from the template.";
      setBatchImportMessage(message);
      showFormWarning(message);
      return;
    }

    setIsImportingBatch(true);
    setIsExistingEmployeeBatchMode(false);
    setBatchImportMessage("");
    setFormWarningMessage("");

    try {
      const fileText = await file.text();
      const lines = fileText
        .replace(/^\uFEFF/, "")
        .split(/\r\n|\r|\n/);

      while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
        lines.pop();
      }

      if (lines.length < 2) {
        const message = "The CSV file must include a header row and at least one employee row.";
        setBatchImportMessage(message);
        showFormWarning(message);
        return;
      }

      const headers = parseCsvLine(lines[0]);
      const missingHeaders = REQUIRED_EMPLOYEE_IMPORT_HEADERS.filter(
        (header) => !headers.includes(header)
      );

      if (missingHeaders.length > 0) {
        const message = `Missing column(s): ${missingHeaders.join(", ")}`;
        setBatchImportMessage(message);
        showFormWarning(message);
        return;
      }

      const headerIndexMap = new Map(headers.map((header, index) => [header, index]));
      const dynamicImportHeaders = headers.filter((header) => isDynamicImportHeader(header));
      const allowanceHeaders = dynamicImportHeaders.filter((header) => parseAllowanceHeader(header));
      const loanHeaders = dynamicImportHeaders.filter((header) => parseLoanHeader(header));
      setBatchCustomAllowanceHeaders(dynamicImportHeaders);
      const parsedRows: BatchImportRow[] = [];

      for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
        const values = parseCsvLine(lines[rowIndex]);
        const allowanceMap = new Map<string, CustomAllowanceRecord>();
        for (const header of allowanceHeaders) {
          const parsed = parseAllowanceHeader(header);
          if (!parsed) continue;
          const cellValue = values[headerIndexMap.get(header) ?? -1] ?? "";
          if (!allowanceMap.has(parsed.name)) {
            allowanceMap.set(parsed.name, {
              name: parsed.name,
              amount: "",
              frequency: "",
              releaseMonth: "",
            });
          }
          const allowance = allowanceMap.get(parsed.name)!;
          const trimmedCellValue = cellValue.trim();
          allowance[parsed.field] =
            parsed.field === "frequency"
              ? isValidAllowanceFrequency(trimmedCellValue)
                ? normalizeAllowanceFrequency(trimmedCellValue)
                : trimmedCellValue
              : trimmedCellValue;
        }
        const allowances = Array.from(allowanceMap.values()).filter((allowance) =>
          allowance.name &&
          (String(allowance.amount ?? "").trim() ||
            String(allowance.frequency ?? "").trim() ||
            String(allowance.releaseMonth ?? "").trim())
        );
        const customAllowances = allowances
          .filter((allowance) => String(allowance.amount ?? "").trim())
          .map((allowance) => ({
            ...allowance,
            amount: toNumberCell(allowance.amount),
          }));

        const loanMap = new Map<string, Partial<LoanEntry> & { id: string }>();
        for (const header of loanHeaders) {
          const parsed = parseLoanHeader(header);
          if (!parsed) continue;
          const { name, field } = parsed;
          const cellValue = values[headerIndexMap.get(header) ?? -1] || "";
          if (!loanMap.has(name)) {
            loanMap.set(name, {
              id: `loan-import-${name}-${rowIndex}`,
              loanName: name,
              name,
              originalAmount: 0,
              amount: "",
              amountPaid: "",
              outstandingBalance: 0,
              balance: "",
              monthlyDeduction: 0,
              frequency: "",
              dateStarted: "",
              startDate: "",
              endDate: "",
            });
          }
          const entry = loanMap.get(name)!;
          if (field === "amount" || field === "originalAmount") {
            entry.amount = cellValue.trim();
            entry.originalAmount = toNumberCell(cellValue);
          } else if (field === "balance") {
            entry.balance = cellValue.trim();
            entry.outstandingBalance = toNumberCell(cellValue);
          } else if (field === "startDate") {
            const normalizedDate = normalizeCsvDate(cellValue);
            entry.startDate = normalizedDate;
            entry.dateStarted = normalizedDate;
          } else if (field === "endDate") {
            entry.endDate = normalizeCsvDate(cellValue);
          } else if (field === "monthlyDeduction") {
            entry.monthlyDeduction = toNumberCell(cellValue);
          } else {
            entry[field] = cellValue.trim();
          }
        }
        const loans: LoanEntry[] = Array.from(loanMap.values())
          .filter((l) =>
            l.loanName &&
            (String(l.amount ?? "").trim() ||
              String(l.amountPaid ?? "").trim() ||
              String(l.balance ?? "").trim() ||
              String(l.frequency ?? "").trim() ||
              String(l.startDate ?? l.dateStarted ?? "").trim() ||
              String(l.endDate ?? "").trim() ||
              l.originalAmount ||
              l.outstandingBalance ||
              l.monthlyDeduction)
          )
          .map((l) => ({
            id: l.id!,
            loanName: l.loanName!,
            name: l.name || l.loanName!,
            dateStarted: l.dateStarted || l.startDate || "",
            startDate: l.startDate || l.dateStarted || "",
            endDate: l.endDate || "",
            originalAmount: l.originalAmount ?? toNumberCell(l.amount),
            amount: l.amount ?? String(l.originalAmount ?? ""),
            amountPaid: l.amountPaid ?? "",
            outstandingBalance: l.outstandingBalance ?? toNumberCell(l.balance),
            balance: l.balance ?? String(l.outstandingBalance ?? ""),
            frequency: l.frequency || "",
            monthlyDeduction: l.monthlyDeduction ?? 0,
          }));

        const row: BatchImportRow = {
          employeeId: getBatchRowValue(values, headerIndexMap, "employeeId").trim(),
          payrollType: getBatchRowValue(values, headerIndexMap, "payrollType").trim().toUpperCase(),
          lastName: getBatchRowValue(values, headerIndexMap, "lastName").trim(),
          firstName: getBatchRowValue(values, headerIndexMap, "firstName").trim(),
          middleName: getBatchRowValue(values, headerIndexMap, "middleName").trim(),
          gender: getBatchRowValue(values, headerIndexMap, "gender").trim(),
          department: normalizeImportDepartmentName(getBatchRowValue(values, headerIndexMap, "department"), departmentOptions),
          jobTitle: getBatchRowValue(values, headerIndexMap, "jobTitle").trim(),
          location: getBatchRowValue(values, headerIndexMap, "location").trim(),
          employeeType: getBatchRowValue(values, headerIndexMap, "employeeType").trim(),
          employmentStatus: getBatchRowValue(values, headerIndexMap, "employmentStatus").trim(),
          minimumWageEarner: getBatchRowValue(values, headerIndexMap, "minimumWageEarner").trim() || "No",
          hireDate: normalizeEmployeeImportDateToIso(getBatchRowValue(values, headerIndexMap, "hireDate")),
          biometricId: getBatchRowValue(values, headerIndexMap, "biometricId").trim(),
          baseSalary: getBatchRowValue(values, headerIndexMap, "baseSalary").trim(),
          payFrequency: getBatchRowValue(values, headerIndexMap, "payFrequency").trim() || "Semi-monthly",
          workingDaysPerMonth: getBatchRowValue(values, headerIndexMap, "workingDaysPerMonth").trim() || "21.75",
          standardHoursPerDay: getBatchRowValue(values, headerIndexMap, "standardHoursPerDay").trim() || "8",
          exempt: getBatchRowValue(values, headerIndexMap, "exempt").trim(),
          sss: getBatchRowValue(values, headerIndexMap, "sss").trim(),
          philhealth: getBatchRowValue(values, headerIndexMap, "philhealth").trim(),
          pagibig: getBatchRowValue(values, headerIndexMap, "pagibig").trim(),
          tin: getBatchRowValue(values, headerIndexMap, "tin").trim(),
          bankName: getBatchRowValue(values, headerIndexMap, "bankName").trim(),
          bankAccountType: getBatchRowValue(values, headerIndexMap, "bankAccountType").trim(),
          bankAccountNumber: getBatchRowValue(values, headerIndexMap, "bankAccountNumber").trim(),
          birthdate: normalizeEmployeeImportDateToIso(getBatchRowValue(values, headerIndexMap, "birthdate")),
          contactNumber: getBatchRowValue(values, headerIndexMap, "contactNumber").trim(),
          emailAddress: getBatchRowValue(values, headerIndexMap, "emailAddress").trim(),
          address: getBatchRowValue(values, headerIndexMap, "address").trim(),
          immediateSupervisor: getBatchRowValue(values, headerIndexMap, "immediateSupervisor").trim(),
          allowances,
          customAllowances,
          loans,
        };

        parsedRows.push(row);
      }

      setBatchImportRows(parsedRows);

      const autoCreatedDepartments = getNewDepartmentsFromImport(parsedRows, departmentOptions);

      if (autoCreatedDepartments.length > 0) {
        await saveDepartmentOptions([...departmentOptions, ...autoCreatedDepartments]);
      }

      const departmentSummary =
        autoCreatedDepartments.length > 0
          ? ` Auto-created department(s): ${autoCreatedDepartments.join(", ")}.`
          : "";

      const errors = validateBatchRows(parsedRows);
      const firstErrorEntry = Object.entries(errors)[0];

      if (firstErrorEntry) {
        const [rowIndex, rowErrors] = firstErrorEntry;
        const message = `Cannot save imported employees yet. Fix the red cells first. Preview Row ${Number(rowIndex) + 1}: ${rowErrors[0]}${departmentSummary}`;
        setBatchImportMessage(message);
        saveBatchUploadPreview(parsedRows, dynamicImportHeaders, errors, message, false);
        showFormWarning(message);
        return;
      } else {
        const message = `${parsedRows.length} row(s) loaded. Review them below, then click Save Imported Employees.${departmentSummary}`;
        setBatchImportMessage(message);
        saveBatchUploadPreview(parsedRows, dynamicImportHeaders, errors, message, false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch import failed.";
      setBatchImportMessage(message);
      showFormWarning(message);
    } finally {
      setIsImportingBatch(false);
    }
  }

  function isActiveEmployeeRecord(employee: EmployeeRecord) {
    const status = String(employee.employmentStatus || "").trim().toLowerCase();
    const separationDate = String(employee.separationDate || "").trim();
    const reasonForLeaving = String(employee.reasonForLeaving || "").trim();

    return !separationDate && !reasonForLeaving && status !== "inactive" && status !== "archived" && status !== "resigned";
  }

  function buildBatchRowFromEmployee(employee: EmployeeRecord): BatchImportRow {
    const days = getPositiveNumber(employee.workingDaysPerMonth, 21.75);
    const hours = getPositiveNumber(employee.standardHoursPerDay, 8);
    const baseSalary = Number(employee.basicPay ?? 0);
    return {
      employeeId: employee.payslipId || employee.employeeNo || "",
      payrollType: (employee.payrollRunType === "A" || employee.payrollRunType === "B") ? employee.payrollRunType : "A",
      lastName: employee.lastName || "",
      firstName: employee.firstName || "",
      middleName: employee.middleName || "",
      gender: employee.gender || "",
      department: employee.department || "",
      jobTitle: employee.jobTitle || "",
      location: employee.designatedWorkplace || "",
      employeeType: employee.employeeType || "",
      employmentStatus: employee.employmentStatus || "",
      minimumWageEarner: employee.isMinimumWageEarner?.toLowerCase() === "yes" ? "Yes" : "No",
      hireDate: employee.hireDate || "",
      biometricId: employee.biometricId || "",
      baseSalary: String(baseSalary),
      payFrequency: "Semi-monthly",
      workingDaysPerMonth: String(days),
      standardHoursPerDay: String(hours),
      exempt: employee.payrollExempt?.toLowerCase() === "yes" ? "Yes" : "No",
      sss: employee.sss || "",
      philhealth: employee.philhealth || "",
      pagibig: employee.pagibig || "",
      tin: employee.tin || "",
      bankName: employee.bankName || "",
      bankAccountType: employee.bankAccountType || "",
      bankAccountNumber: employee.bankAccountNumber || "",
      birthdate: employee.birthdate || "",
      contactNumber: employee.contactNumber || "",
      emailAddress: employee.emailAddress || "",
      address: employee.address || "",
      immediateSupervisor: employee.immediateSupervisor || "",
      customAllowances: employee.customAllowances || [],
      loans: [],
    };
  }
  async function loadExistingEmployeesIntoBatch() {
    const savedEmployees = await loadSavedEmployees();
    const activeEmployees = savedEmployees.filter(isActiveEmployeeRecord);

    const filteredEmployees = activeEmployees.filter((employee) => {
      if (existingEmployeeLoadScope === "all") return true;
      if (!existingEmployeeLoadValue) return true;
      return String(employee[existingEmployeeLoadScope] || "").trim() === existingEmployeeLoadValue;
    });

    const rowsToLoad = filteredEmployees.map(buildBatchRowFromEmployee);

    setEntryMode("batch");
    setIsExistingEmployeeBatchMode(true);
    setBatchImportRows(rowsToLoad);
    setBatchCustomAllowanceHeaders([]);
    setBatchImportRowErrors({});
    setBatchImportMessage(
      rowsToLoad.length > 0
        ? `${rowsToLoad.length} active employee record(s) loaded. Use Batch Allowance Manager to add or remove allowances, remove rows that should not be edited, then click Update Employees.`
        : "No active employee records found for the selected loading filter."
    );
  }

  useEffect(() => {
    if (!isBulkEmployeeEditMode) return;
    loadExistingEmployeesIntoBatch();
    // The loader intentionally runs when the route mode changes so it does not overwrite manual filter edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBulkEmployeeEditMode]);

  async function handleSaveEmployee() {
    if (isViewMode) {
      window.alert("This employee record is in view-only mode. Click Edit Employee to make changes.");
      return;
    }

    setFormWarningMessage("");
    const finalDepartment = isAddingNewDepartment
      ? newDepartment.trim()
      : department.trim();

    if (!employeeNo.trim()) {
      showFormWarning("Employee No. is required.");
      return;
    }

    if (!lastName.trim()) {
      showFormWarning("Last Name is required.");
      return;
    }

    if (!firstName.trim()) {
      showFormWarning("First Name is required.");
      return;
    }

    // Validate the chosen Employee Type / Employment Status only when one is provided.
    if (employeeType.trim() && !["Rank and File", "Supervisory", "Managerial"].includes(employeeType.trim())) {
      showFormWarning("Employee Type must be Rank and File, Supervisory, or Managerial.");
      return;
    }

    if (employmentStatus.trim() && !["Regular", "Probationary", "Terminated"].includes(employmentStatus.trim())) {
      showFormWarning("Employment Status must be Regular, Probationary, or Terminated.");
      return;
    }

    if (!basicPay.trim()) {
      showFormWarning("Basic Pay is required.");
      return;
    }

    if (sss.trim() && digitsOnly(sss).length !== 10) {
      showFormWarning("SSS Number must be exactly 10 digits.");
      return;
    }

    if (philhealth.trim() && digitsOnly(philhealth).length !== 12) {
      showFormWarning("PhilHealth Number must be exactly 12 digits.");
      return;
    }

    if (pagibig.trim() && digitsOnly(pagibig).length !== 12) {
      showFormWarning("Pag-IBIG Number must be exactly 12 digits.");
      return;
    }

    if (tin.trim() && digitsOnly(tin).length !== 12) {
      showFormWarning("TIN must be exactly 12 digits including the branch code.");
      return;
    }

    let savedEmployeesForDuplicateCheck: EmployeeRecord[];
    try {
      savedEmployeesForDuplicateCheck = await loadSavedEmployees();
    } catch (error) {
      console.error("Failed to load existing employees before saving", error);
      window.alert(
        "Could not reach the database to save this employee. Please check your connection and that your account has access, then try again."
      );
      return;
    }
    const duplicateEmployeeFields = findDuplicateEmployeeFields(
      savedEmployeesForDuplicateCheck,
      {
        employeeNo: employeeNo.trim(),
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        sss: sss.trim(),
        philhealth: philhealth.trim(),
        pagibig: pagibig.trim(),
        tin: tin.trim(),
      },
      isEditMode ? editEmployeeNo.trim() : ""
    );

    if (duplicateEmployeeFields.length > 0) {
      showFormWarning(
        `Duplicate record detected: ${duplicateEmployeeFields.join(", ")} already exists in the employee master file.`
      );
      return;
    }

    const customAllowances = customAllowanceRows
      .map((row) => ({
        name: row.name.trim(),
        amount: Number(row.amount) || 0,
        frequency: normalizeAllowanceFrequency(row.frequency),
      }))
      .filter((row) => row.name || row.amount > 0);

    const payValues = getEmployeePayValues(
      basicPay,
      basicPayFrequency,
      standardHoursPerDay,
      workingDaysPerMonth,
      hourlyRate
    );

    const beforeEmployee = isEditMode ? originalEmployeeSnapshot : null;
    const beforeBaseSalary = beforeEmployee ? getCurrentBaseSalary(beforeEmployee) : 0;
    const enteredBaseSalary = payValues.monthlyBasicPay;
    const salaryChanged = !beforeEmployee || beforeBaseSalary !== enteredBaseSalary;
    const salaryReason = salaryChangeReason.trim() || (!beforeEmployee ? "Initial base salary" : "");

    if (salaryChanged && !isValidSalaryIsoDate(salaryEffectiveDate)) {
      showFormWarning("Salary Effective Date must be a valid YYYY-MM-DD date.");
      return;
    }

    if (salaryChanged && !salaryReason) {
      showFormWarning("Salary Change Reason is required when changing the base salary.");
      return;
    }

    let employeeRecord: EmployeeRecord = {
      employeeNo: employeeNo.trim(),
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      gender: gender.trim(),
      company: company.trim(),
      department: finalDepartment,
      jobTitle: jobTitle.trim(),
      employeeType: employeeType.trim(),
      employmentClassification:
        employeeType.trim().toLowerCase() === "supervisory"
          ? "Supervisory"
          : employeeType.trim().toLowerCase() === "managerial"
            ? "Managerial"
            : "Rank-and-file",
      isMinimumWageEarner: isMinimumWageEarner.trim(),
      immediateSupervisor: immediateSupervisor.trim(),
      designatedWorkplace: designatedWorkplace.trim(),
      employmentStatus: employmentStatus.trim(),
      userType: userType.trim(),
      jobCode: jobCode.trim(),
      jobGrade: jobGrade.trim(),
      costName: costName.trim(),
      eligibility: eligibility.trim(),
      hireDate: hireDate.trim(),
      expectedRegularizationDate: expectedRegularizationDate.trim(),
      regularizationDate: regularizationDate.trim(),
      expectedSeparationDate: expectedSeparationDate.trim(),
      separationDate: separationDate.trim(),
      reasonForLeaving: reasonForLeaving.trim(),
      employeeRemarks: employeeRemarks.trim(),
      biometricId: biometricId.trim(),
      payrollRunType: payrollType,
      payrollExempt: payrollExempt.trim(),
      shiftType: shiftType.trim(),
      payslipId: payslipId.trim() || employeeNo.trim(),
      basicPayFrequency: "Monthly" as const,
      standardHoursPerDay: payValues.hours,
      workingDaysPerMonth: payValues.days,
      hourlyRate: payValues.days > 0 && payValues.hours > 0 ? payValues.monthlyBasicPay / payValues.days / payValues.hours : 0,
      basicPay: payValues.monthlyBasicPay,
      riceSubsidy: Number(riceSubsidy) || 0,
      uniformClothingAllowance: Number(uniformClothingAllowance) || 0,
      laundryAllowance: Number(laundryAllowance) || 0,
      actualMedicalAssistance: Number(actualMedicalAssistance) || 0,
      medicalCashAllowanceToDependents: Number(medicalCashAllowanceToDependents) || 0,
      mealAllowance: Number(mealAllowance) || 0,
      christmasAnniversaryGifts: Number(christmasAnniversaryGifts) || 0,
      achievementAwards: Number(achievementAwards) || 0,
      thirteenthMonthPay: Number(thirteenthMonthPay) || 0,
      christmasBonus: Number(christmasBonus) || 0,
      deductAllowanceOnAbsence,
      otherAllowanceName: customAllowances.map((allowance) => allowance.name).join(", "),
      otherAllowanceAmount: customAllowances.reduce((sum, allowance) => sum + allowance.amount, 0),
      allowanceFrequencies: namedAllowanceFrequencies,
      customAllowances: customAllowances.filter((a) => a.name !== "De Minimis"),
      sss: sss.trim(),
      philhealth: philhealth.trim(),
      pagibig: pagibig.trim(),
      tin: tin.trim(),
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankAccountType: bankAccountType.trim(),
      address: address.trim(),
      birthdate: birthdate.trim(),
      contactNumber: contactNumber.trim(),
      emailAddress: emailAddress.trim(),
      employeePhotoDataUrl: employeePhotoDataUrl.trim(),
      portalUsername: portalUsername.trim() || generatePortalUsername(employeeNo.trim()),
      portalPassword: portalPassword.trim() || generateTemporaryPassword(),
      mustChangePassword,
      portalStatus,
      lastPasswordChangedAt: mustChangePassword ? "" : new Date().toISOString(),
      loans: [],
    };

    const salaryChangedAt = new Date().toISOString();
    const salaryHistory = buildSalaryHistoryForSave(beforeEmployee, employeeRecord, {
      effectiveDate: salaryEffectiveDate,
      reason: salaryReason,
      changedAt: salaryChangedAt,
      changedBy: getSalaryChangedBy(),
    });
    const auditEmployeeRecord = employeeRecord;
    employeeRecord = {
      ...employeeRecord,
      salaryHistory,
      basicPay: getCurrentBaseSalary({ ...employeeRecord, salaryHistory }),
    };

    const updatedDepartmentOptions = await saveDepartmentOptions([
      ...departmentOptions,
      finalDepartment,
    ]);

    if (updatedDepartmentOptions.includes(finalDepartment)) {
      setDepartment(finalDepartment);
      setIsAddingNewDepartment(false);
      setNewDepartment("");
    }

    const savedEmployees = savedEmployeesForDuplicateCheck;
    const existingIndex = savedEmployees.findIndex((employee) => {
      if (isEditMode) {
        return (
          employee.employeeNo.toLowerCase() === editEmployeeNo.trim().toLowerCase() ||
          employee.employeeNo.toLowerCase() === employeeRecord.employeeNo.toLowerCase()
        );
      }

      return employee.employeeNo.toLowerCase() === employeeRecord.employeeNo.toLowerCase();
    });

    const nextEmployees = [...savedEmployees];

    if (existingIndex >= 0) {
      nextEmployees[existingIndex] = employeeRecord;
    } else {
      nextEmployees.push(employeeRecord);
    }

    try {
      await saveEmployeesToDirectory(nextEmployees);
      try {
        sessionStorage.removeItem(SESSION_DRAFT_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_DISCARDED_KEY);
        sessionStorage.removeItem(SESSION_DRAFT_PROMPT_SHOWN_KEY);
      } catch {}
    } catch (error) {
      console.error("Failed to save employee", error);
      window.alert("Employee could not be saved. Please try again or remove large employee photos.");
      return;
    }
    setFormWarningMessage("");
    console.log("AUDIT BEFORE EMPLOYEE:", JSON.stringify(beforeEmployee));
    console.log("AUDIT AFTER EMPLOYEE:", JSON.stringify(auditEmployeeRecord));
    logAudit({
      action: isEditMode ? "EDITED" : "CREATED",
      entityType: "Employee",
      entityId: employeeRecord.employeeNo,
      entityName: `${employeeRecord.lastName}, ${employeeRecord.firstName}${employeeRecord.middleName ? " " + employeeRecord.middleName : ""}`.trim(),
      details: isEditMode && beforeEmployee
        ? `${diffEmployeeRecord(beforeEmployee, auditEmployeeRecord)}${salaryChanged ? `; Salary History: ${formatPesoAmount(beforeBaseSalary)} → ${formatPesoAmount(enteredBaseSalary)} effective ${salaryEffectiveDate}; Reason: ${salaryReason}` : ""}`
        : undefined,
    });
    setOriginalEmployeeSnapshot(employeeRecord);
    window.alert(isEditMode ? "Employee record updated successfully." : "Employee record saved successfully.");

    if (isEditMode) {
      router.push(`/add-employee?viewEmployeeNo=${encodeURIComponent(employeeRecord.employeeNo)}`);
      return;
    }

    router.push("/employees");
  }

  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);

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

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = Math.round((activeTheme.bannerOverlayOpacity / 100) * 255).toString(16).padStart(2, "0");
  const bannerStyle = activeTheme.bannerImageDataUrl
    ? {
        backgroundColor: activeTheme.bannerColor,
        backgroundImage: `linear-gradient(90deg, ${activeTheme.bannerColor}${bannerOverlayAlpha} 0%, ${activeTheme.bannerColor}${bannerOverlayAlpha} 100%), url(${activeTheme.bannerImageDataUrl})`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : { backgroundColor: activeTheme.bannerColor };

  const pageTitle = isViewMode ? "View Employee" : isEditMode ? "Edit Employee" : "Add Employee";
  const pageModeLabel = isBulkEmployeeEditMode
    ? "Batch Update"
    : entryMode === "batch"
    ? "Batch Create"
    : isViewMode
    ? "View Only"
    : isEditMode
    ? "Edit Record"
    : "Individual Entry";
  const modeHelper = isBulkEmployeeEditMode
    ? "Load active employees into the table, update rows, then save the batch."
    : entryMode === "batch"
    ? "Download the CSV template, upload completed rows, review errors, then save."
    : isViewMode
    ? "Fields are locked for review."
    : isEditMode
    ? "Update the employee master file record."
    : "Complete the employee profile and payroll setup.";

  return (
    <div className="flex min-h-screen pg-bg text-[#0b2742]">
      <div className="min-w-0 flex-1">
        {/* BANNER */}
        <section
          className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ ...bannerStyle, borderColor: `${activeTheme.accentColor}33`, color: activeTheme.bannerTextColor }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 82% 20%, ${activeTheme.accentColor}33, transparent 30%), linear-gradient(135deg, ${activeTheme.accentColor}22, transparent 45%)`,
            }}
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${activeTheme.accentColor}24`, color: activeTheme.bannerTextColor, border: `0.5px solid ${activeTheme.accentColor}66` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />
                  {pageModeLabel}
                </span>
                <span
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold"
                  style={{ color: activeTheme.bannerTextColor }}
                >
                  Employee Management
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">{pageTitle}</h1>
              <p className="mt-1 text-sm opacity-85">{modeHelper}</p>
            </div>

            <div className="shrink-0">
              <Link
                href="/employees"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.10] px-4 py-2 text-sm font-semibold transition hover:bg-white/[0.18]"
                style={{ color: activeTheme.bannerTextColor }}
              >
                <UsersRound className="h-4 w-4" />
                View All Employees
              </Link>
            </div>
          </div>
          {formWarningMessage ? (
            <div className="relative mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {formWarningMessage}
            </div>
          ) : null}
        </section>

        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* MODE SELECTOR */}
        <section className={`${subtlePanelClassName} p-5`}>
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-full gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setEntryMode("batch")}
                disabled={isViewMode}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
                  entryMode === "batch"
                    ? "bg-[#0a4f8f] text-white shadow-[0_14px_28px_-20px_rgba(14,116,144,0.85)]"
                    : "text-slate-600 hover:bg-white hover:text-[#0a4f8f]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Batch CSV
              </button>
              <button
                type="button"
                onClick={() => setEntryMode("individual")}
                disabled={isViewMode}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition sm:flex-none ${
                  entryMode === "individual"
                    ? "bg-[#0a4f8f] text-white shadow-[0_14px_28px_-20px_rgba(14,116,144,0.85)]"
                    : "text-slate-600 hover:bg-white hover:text-[#0a4f8f]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <IdCard className="h-4 w-4" />
                Individual
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-slate-500">
                <span className="font-bold text-slate-700">{departmentOptions.length}</span> departments
              </span>
              {entryMode === "batch" && batchImportRows.length > 0 ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-[#0a4f8f] ring-1 ring-sky-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0a4f8f]" />
                    {batchImportRows.length} rows loaded
                  </span>
                  <button
                    type="button"
                    onClick={() => clearBatchUploadPreview()}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Clear / Start Over
                  </button>
                </>
              ) : null}
              {entryMode === "individual" && (fullName || employeeNo) ? (
                <span className="text-xs font-medium text-slate-500">
                  <span className="font-bold text-slate-700">{fullName || employeeNo}</span>
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {entryMode === "batch" ? (
        <Section title={isBulkEmployeeEditMode ? "Batch Update Employees" : "Batch Create Employees"}>
          {isBulkEmployeeEditMode ? (
            <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 to-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#0a4f8f]">Current workflow</p>
              <h3 className="mt-1.5 text-lg font-bold text-slate-900">Review the loaded employee table first</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                Existing active employees are loaded into the table below. Edit employee rows first, then use the tools below the table for loading groups or applying allowance changes.
              </p>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!isBulkEmployeeEditMode ? (
              <>
                {/* PRIMARY ACTION AREA */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className={primaryButtonClassName}
                    style={{ padding: "14px 20px", fontSize: 15, borderRadius: 16, justifyContent: "center" }}
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    Download CSV Template
                  </button>

                  <label
                    onDragOver={(e) => { e.preventDefault(); if (!isImportingBatch) setIsDraggingBatchFile(true); }}
                    onDragEnter={(e) => { e.preventDefault(); if (!isImportingBatch) setIsDraggingBatchFile(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingBatchFile(false); }}
                    onDrop={handleBatchDrop}
                    className={`relative flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-dashed px-5 py-3.5 transition hover:shadow-md ${isDraggingBatchFile ? "border-[#0a4f8f] bg-sky-100 ring-2 ring-sky-300" : "border-sky-200 bg-gradient-to-br from-sky-50 to-white hover:border-[#0a4f8f]"}`}
                    style={{ cursor: isImportingBatch ? "not-allowed" : "pointer" }}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{isDraggingBatchFile ? "Drop CSV to import" : "Browse or drag & drop CSV"}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">Drag a file here or click to upload the completed template</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center justify-center rounded-xl bg-[#0a4f8f] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(14,116,144,0.7)]">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleBatchImport}
                      disabled={isImportingBatch}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>

                {/* HOW IT WORKS — collapsible */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsInstructionsOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:text-[#0a4f8f]"
                  >
                    <span>How it works</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isInstructionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isInstructionsOpen ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                      <div className="grid gap-2">
                        {[
                          ["1", "Download the template", "Use the system-generated CSV so the headers stay correct."],
                          ["2", "Fill out required columns", "Headers marked with * in the preview table must be completed."],
                          ["3", "Use exact accepted values", "Wrong spelling for Department, Employee Type, Basic Pay Frequency, User Type, Shift Type, or Bank Account Type will be highlighted before saving."],
                          ["4", "Upload and review", "Check the red-highlighted cells in the preview table before saving imported employees."],
                        ].map(([step, title, helper]) => (
                          <div key={step} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0a4f8f] text-xs font-bold text-white">
                              {step}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{title}</p>
                              <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{helper}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* ACCEPTED VALUES — collapsible */}
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setIsAcceptedValuesOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:text-[#0a4f8f]"
                  >
                    <span>Accepted values &amp; departments</span>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isAcceptedValuesOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isAcceptedValuesOpen ? (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 text-sm text-slate-700">
                      <div className="grid gap-4">

                        {/* Employee Type + User Type */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Employee Type</p>
                            <div className="flex flex-wrap gap-2">
                              {EMPLOYEE_TYPE_OPTIONS.map((opt) => (
                                <span key={opt} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#0a4f8f]">{opt}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">User Type</p>
                            <div className="flex flex-wrap gap-2">
                              {USER_TYPE_OPTIONS.map((opt) => (
                                <span key={opt} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#0a4f8f]">{opt}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Shift Type + Bank Account Type */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Shift Type</p>
                            <div className="flex flex-wrap gap-2">
                              {SHIFT_TYPE_OPTIONS.map((opt) => (
                                <span key={opt} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#0a4f8f]">{opt}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bank Account Type</p>
                            <div className="flex flex-wrap gap-2">
                              {BANK_ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                <span key={opt} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#0a4f8f]">{opt}</span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Employment Status */}
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Employment Status — BIR / Alphalist code</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            {[
                              ["R", "Regular"],
                              ["C", "Contractual"],
                              ["CP", "Contractual / Project-based"],
                              ["S", "Seasonal"],
                              ["P", "Probationary"],
                              ["AL", "At-Large / Casual"],
                            ].map(([code, meaning]) => (
                              <span key={code} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                                <strong className="text-slate-950">{code}</strong> — {meaning}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Pay & Schedule */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pay &amp; Schedule Fields</p>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            <li><strong className="text-slate-900">Basic Pay Frequency:</strong> <code className="rounded border border-slate-200 bg-white px-1">Monthly</code> or <code className="rounded border border-slate-200 bg-white px-1">Hourly</code></li>
                            <li><strong className="text-slate-900">Standard Hours Per Day:</strong> working hours per day, e.g. <code className="rounded border border-slate-200 bg-white px-1">8</code></li>
                            <li><strong className="text-slate-900">Working Days Per Month:</strong> working days per month, e.g. <code className="rounded border border-slate-200 bg-white px-1">26</code> — used for absence deductions and hourly equivalents</li>
                            <li><strong className="text-slate-900">Hire Date:</strong> MM/DD/YYYY or YYYY-MM-DD accepted on import, e.g. <code className="rounded border border-slate-200 bg-white px-1">07/19/2019</code> or <code className="rounded border border-slate-200 bg-white px-1">2019-07-19</code>. Stored internally as YYYY-MM-DD.</li>
                            <li><strong className="text-slate-900">Christmas Bonus:</strong> year-end amount only, numeric, e.g. ₱10,000 → <code className="rounded border border-slate-200 bg-white px-1">10000</code></li>
                          </ul>
                        </div>

                        {/* Allowances */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Allowances</p>
                          <ul className="space-y-2 text-xs text-slate-700">
                            <li><strong className="text-slate-900">Fixed allowances</strong> — numeric only. Use <code className="rounded border border-slate-200 bg-white px-1">0</code> if none. Example: ₱2,500 → <code className="rounded border border-slate-200 bg-white px-1">2500</code></li>
                            <li><strong className="text-slate-900">Custom allowances</strong> — add a CSV column <code className="rounded border border-slate-200 bg-white px-1">allowance_&lt;Name&gt;</code>, e.g. <code className="rounded border border-slate-200 bg-white px-1">allowance_Transportation Allowance</code> = <code className="rounded border border-slate-200 bg-white px-1">2500</code></li>
                            <li><strong className="text-slate-900">Allowance frequency</strong> — use <code className="rounded border border-slate-200 bg-white px-1">allowance_&lt;Name&gt;_amount</code>, <code className="rounded border border-slate-200 bg-white px-1">allowance_&lt;Name&gt;_frequency</code> (Monthly / Annual / Hourly), and <code className="rounded border border-slate-200 bg-white px-1">allowance_&lt;Name&gt;_releaseMonth</code> for Annual items</li>
                          </ul>
                        </div>

                        {/* Loans */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Loans — one column per field per loan</p>
                          <ul className="space-y-1 text-xs text-slate-700">
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_amount</code> — original principal</li>
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_amountPaid</code> — total paid to date</li>
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_balance</code> — outstanding balance</li>
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_frequency</code> — payment schedule, e.g. <code className="rounded border border-slate-200 bg-white px-1">Monthly</code></li>
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_monthlyDeduction</code> — fixed deduction per period</li>
                            <li><code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_startDate</code> / <code className="rounded border border-slate-200 bg-white px-1">loan_&lt;Name&gt;_endDate</code> — MM/DD/YYYY</li>
                          </ul>
                        </div>

                        {/* Deduct Allowance on Absence — NEW */}
                        <div style={{ borderLeft: "3px solid #3b82f6", paddingLeft: 14, paddingTop: 2, paddingBottom: 2 }}>
                          <div className="mb-2 flex items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deduct allowance on absence</p>
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">NEW</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            <li>Controls whether fixed allowances (meal, transportation, rice subsidy, etc.) are prorated when an employee is absent during a payroll period.</li>
                            <li><strong className="text-slate-900">Individual form:</strong> toggle in the <em>Absence &amp; Allowance Settings</em> section of each employee profile (between section 5 and section 6).</li>
                            <li>
                              <strong className="text-slate-900">CSV column:</strong>{" "}
                              <code className="rounded bg-slate-100 px-1 font-mono">deduct_allowance_on_absence</code>
                              {" "}— accepted values:{" "}
                              <code className="rounded bg-slate-100 px-1 font-mono">YES</code> or <code className="rounded bg-slate-100 px-1 font-mono">NO</code>
                              {" "}(case-insensitive; blank defaults to NO)
                            </li>
                          </ul>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs">
                              <strong className="block text-blue-900">YES — prorate on absence</strong>
                              <span className="mt-0.5 block font-mono text-blue-700">allowance_paid = (allowance ÷ working_days) × days_present</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs">
                              <strong className="block text-slate-800">NO (default) — always full</strong>
                              <span className="mt-0.5 block text-slate-500">Full allowance paid regardless of absences</span>
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-xs text-slate-700">
                            <p className="font-semibold text-slate-900">Proration formula</p>
                            <p className="mt-1 font-mono text-blue-800">allowance_paid = (allowance_amount ÷ working_days_per_month) × days_present</p>
                            <p className="mt-2 text-slate-600">
                              <strong className="text-slate-800">Worked example:</strong>{" "}
                              ₱2,500 ÷ 26 working days × 24 days present = <strong className="text-slate-900">₱2,307.69</strong>
                            </p>
                            <p className="mt-2 text-slate-500">
                              The <strong className="text-slate-700">Working Days Per Month</strong> value in each employee&rsquo;s own record (section 6 → Basic Pay fields) drives the denominator in this formula.
                            </p>
                          </div>
                        </div>

                      </div>

                      {/* Departments */}
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Departments — type exactly as shown</p>
                        <div className="flex flex-wrap gap-2">
                          {departmentOptions.map((option) => (
                            <span key={option} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-[#0a4f8f]">{option}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

          {batchImportRows.length === 0 ? (
  <div
    style={{
      padding: 22,
      borderRadius: 28,
      border: "1px solid #bae6fd",
      background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)",
      boxShadow: "0 12px 30px rgba(14, 116, 144, 0.08)",
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0a4f8f" }}>
          Existing employee loader
        </p>
        <h3 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
          Edit Existing Employees
        </h3>
        <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.6, fontWeight: 700 }}>
          Load active employees into the editable batch table. Use the filters to load only a department, classification, employee type, MWE status, or employment status.
        </p>
      </div>
      <span
        style={{
          padding: "9px 14px",
          borderRadius: 999,
          border: "1px solid #bae6fd",
          background: "#ffffff",
          color: "#0a4f8f",
          fontSize: 12,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        Loads rows for editing
      </span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Load by
        </span>
        <SelectField
          value={existingEmployeeLoadScope}
          onChange={(event) => {
            setExistingEmployeeLoadScope(event.target.value as typeof existingEmployeeLoadScope);
            setExistingEmployeeLoadValue("");
          }}
        >
          <option value="all">All active employees</option>
          <option value="department">Department</option>
          <option value="employeeType">Employee Type</option>
          <option value="employmentClassification">Classification</option>
          <option value="isMinimumWageEarner">MWE Status</option>
          <option value="employmentStatus">Employment Status</option>
        </SelectField>
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Which value
        </span>
        <SelectField
          value={existingEmployeeLoadValue}
          onChange={(event) => setExistingEmployeeLoadValue(event.target.value)}
          disabled={existingEmployeeLoadScope === "all"}
        >
          <option value="">
            {existingEmployeeLoadScope === "all" ? "Not needed" : "All values"}
          </option>
          {existingEmployeeLoadOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
      </label>
    </div>

    <button
      type="button"
      onClick={loadExistingEmployeesIntoBatch}
      style={{
        width: "100%",
        marginTop: 14,
        padding: "14px 18px",
        borderRadius: 18,
        border: "1px solid #0a4f8f",
        background: "#0a4f8f",
        color: "#ffffff",
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 12px 24px rgba(14, 116, 144, 0.18)",
      }}
    >
      Load Existing Employees to Edit
    </button>
  </div>
) : null}
          </div>

          {batchImportMessage ? (
            <div
              style={{
                marginTop: 14,
                fontSize: 14,
                color: Object.keys(batchImportRowErrors).length > 0 ? "#b91c1c" : "#475569",
                background: Object.keys(batchImportRowErrors).length > 0 ? "#fff1f2" : "#f8fafc",
                border: Object.keys(batchImportRowErrors).length > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 12,
                fontWeight: Object.keys(batchImportRowErrors).length > 0 ? 700 : 500,
              }}
            >
              {batchImportMessage}
            </div>
          ) : null}

          {batchImportRows.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  overflowX: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 20,
                  background: "#fff",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1600 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 3,
                          width: 52,
                          minWidth: 52,
                          padding: 10,
                          borderBottom: "1px solid #e2e8f0",
                          background: "#f1f5f9",
                          textAlign: "center",
                          color: "#475569",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Remove
                      </th>
                      {[...EMPLOYEE_IMPORT_HEADERS, ...batchCustomAllowanceHeaders].map((header) => (
                        <th
                          key={header}
                          style={{
                            textAlign: "left",
                            padding: 10,
                            borderBottom: "1px solid #e2e8f0",
                            fontSize: 13,
                            color: "#475569",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getEmployeeImportHeaderLabel(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batchImportRows.map((row, rowIndex) => {
                      const rowErrors = batchImportRowErrors[rowIndex] || [];
                      const hasRowErrors = rowErrors.length > 0;

                      return (
                        <tr
                          key={`batch-row-${rowIndex}`}
                          style={{ background: hasRowErrors ? "#fffafc" : "#fff" }}
                        >
                          <td
                            style={{
                              position: "sticky",
                              left: 0,
                              zIndex: 2,
                              width: 52,
                              minWidth: 52,
                              padding: 8,
                              borderBottom: "1px solid #e2e8f0",
                              verticalAlign: "middle",
                              background: hasRowErrors ? "#fffafc" : "#fff",
                              textAlign: "center",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => removeBatchImportRow(rowIndex)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                              title="Remove employee from import preview"
                              aria-label={`Remove preview row ${rowIndex + 1}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                          {[...EMPLOYEE_IMPORT_HEADERS, ...batchCustomAllowanceHeaders].map((header) => {
                            const isDynamicField = isDynamicImportHeader(header);
                            const allowanceHeader = parseAllowanceHeader(header);
                            const loanHeader = parseLoanHeader(header);
                            const isRequiredField = isDynamicField ? false : isRequiredEmployeeImportHeader(header as (typeof EMPLOYEE_IMPORT_HEADERS)[number]);

                            const value = isDynamicField
                              ? readDynamicImportCell(row, header)
                              : row[header as (typeof EMPLOYEE_IMPORT_HEADERS)[number]] || "";
                            const isInvalidCell =
                              (isRequiredField && !String(value).trim()) ||
                              (header === "employeeType" && String(value).trim() && !["rank and file", "supervisory", "managerial"].includes(String(value).trim().toLowerCase())) ||
                              (header === "employmentStatus" && String(value).trim() && !["regular", "probationary", "terminated"].includes(String(value).trim().toLowerCase())) ||
                              (header === "gender" && String(value).trim() && !["male", "female"].includes(String(value).trim().toLowerCase())) ||
                              (header === "minimumWageEarner" && String(value).trim() && !["yes", "no"].includes(String(value).trim().toLowerCase())) ||
                              (header === "exempt" && String(value).trim() && !["yes", "no"].includes(String(value).trim().toLowerCase())) ||
                              (header === "payrollType" && String(value).trim() && !["a", "b"].includes(String(value).trim().toLowerCase())) ||
                              (header === "userType" && String(value).trim() && !isValidUserType(String(value))) ||
                              (isEmployeeImportDateField(header) && String(value).trim() && !isValidEmployeeImportDate(String(value))) ||
                              (["baseSalary", "riceSubsidy", "uniformClothingAllowance", "laundryAllowance", "actualMedicalAssistance", "medicalCashAllowanceToDependents", "mealAllowance", "christmasAnniversaryGifts", "achievementAwards", "thirteenthMonthPay", "christmasBonus", "otherAllowanceAmount"].includes(header) && String(value).trim() && !isNumericCell(String(value))) ||
                              (header === "deduct_allowance_on_absence" && String(value).trim() && !["yes", "no"].includes(String(value).trim().toLowerCase())) ||
                              (header === "sss" && String(value).trim() && digitsOnly(String(value)).length !== 10) ||
                              (header === "shiftType" && String(value).trim() && !isValidShiftType(String(value))) ||
                              (header === "bankAccountType" && String(value).trim() && !isValidBankAccountType(String(value))) ||
                              (header === "philhealth" && String(value).trim() && digitsOnly(String(value)).length !== 12) ||
                              (header === "pagibig" && String(value).trim() && digitsOnly(String(value)).length !== 12) ||
                              (header === "tin" && String(value).trim() && digitsOnly(String(value)).length !== 12) ||
                              (allowanceHeader?.field === "amount" && String(value).trim() && !isNumericCell(String(value))) ||
                              (loanHeader && ["amount", "amountPaid", "balance", "originalAmount", "monthlyDeduction"].includes(loanHeader.field) && String(value).trim() && !isNumericCell(String(value))) ||
                              (loanHeader && ["startDate", "endDate"].includes(loanHeader.field) && String(value).trim() && !isValidCsvDate(String(value)));

                            return (
                              <td
                                key={`${rowIndex}-${header}`}
                                style={{
                                  padding: 8,
                                  borderBottom: "1px solid #e2e8f0",
                                  verticalAlign: "top",
                                  background: isInvalidCell ? "#fff1f2" : hasRowErrors ? "#fffafc" : "#fff",
                                }}
                              >
                                <InputField
                                  value={value}
                                  onChange={(e) => {
                                    if (isDynamicField) {
                                      updateDynamicImportCell(rowIndex, header, e.target.value);
                                      return;
                                    }
                                    updateBatchImportCell(rowIndex, header as (typeof EMPLOYEE_IMPORT_HEADERS)[number], e.target.value);
                                  }}
                                  placeholder={isDynamicField ? "" : header}
                                  style={{
                                    minWidth: 150,
                                    borderColor: isInvalidCell ? "#fca5a5" : "#cbd5e1",
                                    background: isInvalidCell ? "#fff1f2" : "#fff",
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>


              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleSaveImportedRows}
                  disabled={isSavingImport}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 16,
                    border: "1px solid #0a4f8f",
                    background: isSavingImport ? "#64748b" : "#0a4f8f",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: isSavingImport ? "not-allowed" : "pointer",
                    opacity: isSavingImport ? 0.7 : 1,
                  }}
                >
                  {isBulkEmployeeEditMode ? "Update Employees" : "Save Imported Employees"}
                </button>
              </div>

              <div
                style={{
                  padding: 22,
                  borderRadius: 28,
                  border: "1px solid #bae6fd",
                  background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)",
                  boxShadow: "0 12px 30px rgba(14, 116, 144, 0.08)",
                  marginTop: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0a4f8f" }}>
                      Existing employee loader
                    </p>
                    <h3 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                      Edit Existing Employees
                    </h3>
                    <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.6, fontWeight: 700 }}>
                      Load active employees into the same table above. Use the filters to load only a department, classification, employee type, MWE status, or employment status.
                    </p>
                  </div>
                  <span
                    style={{
                      padding: "9px 14px",
                      borderRadius: 999,
                      border: "1px solid #bae6fd",
                      background: "#ffffff",
                      color: "#0a4f8f",
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Loads rows for editing
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Load by
                    </span>
                    <SelectField
                      value={existingEmployeeLoadScope}
                      onChange={(event) => {
                        setExistingEmployeeLoadScope(event.target.value as typeof existingEmployeeLoadScope);
                        setExistingEmployeeLoadValue("");
                      }}
                    >
                      <option value="all">All active employees</option>
                      <option value="department">Department</option>
                      <option value="employeeType">Employee Type</option>
                      <option value="employmentClassification">Classification</option>
                      <option value="isMinimumWageEarner">MWE Status</option>
                      <option value="employmentStatus">Employment Status</option>
                    </SelectField>
                  </label>

                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Which value
                    </span>
                    <SelectField
                      value={existingEmployeeLoadValue}
                      onChange={(event) => setExistingEmployeeLoadValue(event.target.value)}
                      disabled={existingEmployeeLoadScope === "all"}
                    >
                      <option value="">
                        {existingEmployeeLoadScope === "all" ? "Not needed" : "All values"}
                      </option>
                      {existingEmployeeLoadOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectField>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={loadExistingEmployeesIntoBatch}
                  style={{
                    width: "100%",
                    marginTop: 14,
                    padding: "14px 18px",
                    borderRadius: 18,
                    border: "1px solid #0a4f8f",
                    background: "#0a4f8f",
                    color: "#ffffff",
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 12px 24px rgba(14, 116, 144, 0.18)",
                  }}
                >
                  Load Existing Employees to Edit
                </button>
              </div>

              {batchImportRows.length > 0 ? (
                <div
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
                    borderRadius: 28,
                    padding: 20,
                    marginTop: 20,
                    boxShadow: "0 10px 30px rgba(14, 116, 144, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#0f172a", fontSize: 22, fontWeight: 900 }}>
                        Batch Allowance Manager
                      </h3>
                      <p style={{ margin: "6px 0 0", color: "#64748b", lineHeight: 1.6, fontWeight: 700 }}>
                        Add an allowance amount to all loaded rows or only to a selected group. To remove an allowance, choose it here and click Set to Zero.
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: "#ffffff",
                        color: "#0a4f8f",
                        fontSize: 12,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Applies to loaded table rows only
                    </div>
                  </div>

                  <div
  style={{
    display: "grid",
    gridTemplateColumns:
      batchAllowanceActionField === "addCustomAllowance"
        ? "1.1fr 1.1fr 0.7fr 1fr 1fr"
        : "1.2fr 0.8fr 1fr 1fr",
    gap: 12,
    alignItems: "end",
  }}
>
  <label style={{ display: "grid", gap: 8 }}>
    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      Allowance
    </span>
    <SelectField
      value={batchAllowanceActionField}
      onChange={(event) => setBatchAllowanceActionField(event.target.value as BatchAllowanceField | "addCustomAllowance")}
    >
      <option value="addCustomAllowance">+ Add New Allowance</option>
      {BATCH_ALLOWANCE_FIELDS.map((item) => (
        <option key={item.field} value={item.field}>
          {item.label}
        </option>
      ))}
    </SelectField>
  </label>

  {batchAllowanceActionField === "addCustomAllowance" ? (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        New Allowance Name
      </span>
      <InputField
        value={batchNewAllowanceName}
        onChange={(event) => setBatchNewAllowanceName(event.target.value)}
        placeholder="Example: Internet Allowance"
      />
    </label>
  ) : null}

  <label style={{ display: "grid", gap: 8 }}>
    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      Amount
    </span>
    <InputField
      type="number"
      value={batchAllowanceActionAmount}
      onChange={(event) => setBatchAllowanceActionAmount(event.target.value)}
    />
  </label>

  <label style={{ display: "grid", gap: 8 }}>
    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      Apply to
    </span>
    <SelectField
      value={batchAllowanceActionScope}
      onChange={(event) => {
        setBatchAllowanceActionScope(event.target.value as BatchAllowanceScope);
        setBatchAllowanceActionValue("");
      }}
    >
      <option value="all">All loaded employees</option>
      <option value="department">Department</option>
      <option value="employeeType">Employee Type</option>
      <option value="employmentClassification">Classification</option>
      <option value="isMinimumWageEarner">MWE Status</option>
      <option value="employmentStatus">Employment Status</option>
    </SelectField>
  </label>

  <label style={{ display: "grid", gap: 8 }}>
    <span style={{ fontSize: 12, color: "#0b2742", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      Which value
    </span>
    <SelectField
      value={batchAllowanceActionValue}
      onChange={(event) => setBatchAllowanceActionValue(event.target.value)}
      disabled={batchAllowanceActionScope === "all"}
    >
      <option value="">
        {batchAllowanceActionScope === "all" ? "Not needed" : "All values"}
      </option>
      {batchAllowanceActionOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </SelectField>
  </label>
                </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
                    <button
                      type="button"
                      onClick={() => applyBatchAllowanceAmount("0")}
                      style={{
                        padding: "12px 18px",
                        borderRadius: 16,
                        border: "1px solid #fecaca",
                        background: "#fff1f2",
                        color: "#be123c",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Set to Zero / Remove Allowance
                    </button>

                    <button
                      type="button"
                      onClick={() => applyBatchAllowanceAmount(batchAllowanceActionAmount)}
                      style={{
                        padding: "12px 18px",
                        borderRadius: 16,
                        border: "1px solid #0a4f8f",
                        background: "#0a4f8f",
                        color: "#ffffff",
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow: "0 12px 24px rgba(14, 116, 144, 0.18)",
                      }}
                    >
                      Apply Allowance Amount
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Section>
        ) : null}
        {entryMode === "individual" ? (
          <>
            <fieldset disabled={isViewMode} style={{ border: 0, padding: 0, margin: 0 }}>
        <Section title="1. Basic Information">
          <Grid columns="repeat(5, minmax(0, 1fr))">
            <label>
              <FieldLabel required>Employee No.</FieldLabel>
              <InputField
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="Enter employee number"
              />
            </label>
            <label>
              <FieldLabel required>Last Name</FieldLabel>
              <InputField
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
              />
            </label>
            <label>
              <FieldLabel required>First Name</FieldLabel>
              <InputField
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
              />
            </label>
            <label>
              <FieldLabel>Middle Name</FieldLabel>
              <InputField
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Enter middle name"
              />
            </label>
            <label>
  <FieldLabel>Gender</FieldLabel>
  <SelectField value={gender} onChange={(e) => setGender(e.target.value)}>
    <option value="">Select gender (optional)</option>
    <option value="Female">Female</option>
    <option value="Male">Male</option>
  </SelectField>
  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
    Used for employee master file records and HR reporting only.
  </div>
</label>
          </Grid>
        </Section>

        <Section title="2. Basic Job Information">
          <Grid columns="repeat(3, minmax(0, 1fr))">
            <label>
              <FieldLabel required>Department</FieldLabel>
              <SelectField
                value={isAddingNewDepartment ? "__new__" : department}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__new__") {
                    setIsAddingNewDepartment(true);
                    setDepartment("");
                  } else {
                    setIsAddingNewDepartment(false);
                    setDepartment(value);
                    setNewDepartment("");
                  }
                }}
              >
                <option value="">Select department</option>
                {departmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="__new__">+ Add new department and sync to Company Profile</option>
              </SelectField>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Department choices are pulled from Company Profile. Add or edit departments there so batch and individual employee records stay consistent.
              </div>
              {isAddingNewDepartment ? (
                <div style={{ marginTop: 10 }}>
                  <InputField
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Enter new department"
                  />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setShowDepartmentsModal(true)}
                style={{
                  marginTop: 10,
                  padding: "10px 16px",
                  borderRadius: 14,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#0a4f8f",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                Manage departments →
              </button>
            </label>
            <label>
              <FieldLabel required>Job Title</FieldLabel>
              <InputField
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Enter job title"
              />
            </label>
            <label>
              <FieldLabel required>Payroll Type</FieldLabel>
              <SelectField
                value={payrollType}
                onChange={(e) => setPayrollType(e.target.value as "A" | "B")}
              >
                <option value="A">A</option>
                <option value="B">B</option>
              </SelectField>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Controls how absences are prorated in the payroll run.
              </div>
            </label>
            <label>
              <FieldLabel required>Employee Type</FieldLabel>
              <SelectField
                value={employeeType}
                onChange={(e) => setEmployeeType(e.target.value)}
              >
                <option value="Rank and File">Rank and File</option>
                <option value="Supervisory">Supervisory</option>
                <option value="Managerial">Managerial</option>
              </SelectField>
            </label>
            <label>
              <FieldLabel required>Employment Status</FieldLabel>
              <SelectField
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
              >
                <option value="Regular">Regular</option>
                <option value="Probationary">Probationary</option>
                <option value="Terminated">Terminated</option>
              </SelectField>
            </label>
            <label>
              <FieldLabel required>Minimum Wage Earner?</FieldLabel>
              <SelectField
                value={isMinimumWageEarner}
                onChange={(e) => setIsMinimumWageEarner(e.target.value)}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </SelectField>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Choose Yes only if the employee is paid the applicable statutory minimum wage for the region/category. This is a TAX concept.
              </div>
            </label>
            <label>
              <FieldLabel required>Exempt</FieldLabel>
              <SelectField
                value={payrollExempt}
                onChange={(e) => setPayrollExempt(e.target.value)}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </SelectField>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Exempt from absence/late/undertime deductions. NOT the same as Minimum Wage Earner.
              </div>
            </label>
            <label>
              <FieldLabel required>Location</FieldLabel>
              <InputField
                value={designatedWorkplace}
                onChange={(e) => setDesignatedWorkplace(e.target.value)}
                placeholder="Enter work location"
              />
            </label>
            <label>
              <FieldLabel>Immediate Supervisor</FieldLabel>
              <InputField
                value={immediateSupervisor}
                onChange={(e) => setImmediateSupervisor(e.target.value)}
                placeholder="Enter immediate supervisor"
              />
            </label>
          </Grid>
        </Section>

        <Section title="3. Employment Details">
          <Grid columns="repeat(3, minmax(0, 1fr))">
            <label>
              <FieldLabel required>User Type</FieldLabel>
              <SelectField value={userType} onChange={(e) => setUserType(e.target.value)}>
                {USER_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectField>
            </label>
            <label>
              <FieldLabel required>Hire Date</FieldLabel>
              <InputField type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </label>
            <label>
              <FieldLabel>Expected Regularization Date</FieldLabel>
              <InputField
                type="date"
                value={expectedRegularizationDate}
                onChange={(e) => setExpectedRegularizationDate(e.target.value)}
              />
            </label>
            <label>
              <FieldLabel>Regularization Date</FieldLabel>
              <InputField
                type="date"
                value={regularizationDate}
                onChange={(e) => setRegularizationDate(e.target.value)}
              />
            </label>
            <label>
              <FieldLabel>Expected Separation Date</FieldLabel>
              <InputField
                type="date"
                value={expectedSeparationDate}
                onChange={(e) => setExpectedSeparationDate(e.target.value)}
              />
            </label>
            <label>
              <FieldLabel>Separation Date</FieldLabel>
              <InputField
                type="date"
                value={separationDate}
                onChange={(e) => setSeparationDate(e.target.value)}
              />
            </label>
            <label>
              <FieldLabel>Reason for Leaving</FieldLabel>
              <InputField
                value={reasonForLeaving}
                onChange={(e) => setReasonForLeaving(e.target.value)}
                placeholder="Enter reason for leaving"
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Employee Remarks</FieldLabel>
              <TextAreaField
                value={employeeRemarks}
                onChange={(e) => setEmployeeRemarks(e.target.value)}
                placeholder="Enter employee remarks"
                maxLength={300}
              />
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, textAlign: "right" }}>
                {employeeRemarks.length}/300
              </div>
            </label>
          </Grid>
        </Section>

        <Section title="4. Other Information">
          <Grid columns="repeat(3, minmax(0, 1fr))">
            <div
              style={{
                gridColumn: "1 / -1",
                padding: 14,
                borderRadius: 18,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#0b2742",
                fontSize: 13,
                fontWeight: 800,
                lineHeight: 1.5,
              }}
            >
              Payroll frequency is fixed as Semi-Monthly for this system, so it is automatically applied to all employee records.
            </div>
            <label>
              <FieldLabel>Biometric ID</FieldLabel>
              <InputField
                value={biometricId}
                onChange={(e) => setBiometricId(e.target.value)}
                placeholder="Enter biometric ID"
              />
            </label>
            <label>
              <FieldLabel>Payslip ID</FieldLabel>
              <InputField
                value={payslipId}
                onChange={(e) => setPayslipId(e.target.value)}
                placeholder="Enter payslip ID"
              />
            </label>
          </Grid>
        </Section>

        <Section title="5. Fixed Allowances">
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 18,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#0b2742",
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1.5,
            }}
          >
            Add fixed employee allowances here. Premiums are not included in this section. Use 0 if the employee does not receive a fixed amount. Select a frequency per allowance; Monthly/Annual/Hourly equivalents are computed automatically.
          </div>
          <Grid columns="repeat(3, minmax(0, 1fr))">
            <AllowanceField label="Rice Subsidy" value={riceSubsidy} onChange={setRiceSubsidy} fieldKey="riceSubsidy" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Uniform / Clothing Allowance" value={uniformClothingAllowance} onChange={setUniformClothingAllowance} fieldKey="uniformClothingAllowance" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Laundry Allowance" value={laundryAllowance} onChange={setLaundryAllowance} fieldKey="laundryAllowance" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Actual Medical Assistance" value={actualMedicalAssistance} onChange={setActualMedicalAssistance} fieldKey="actualMedicalAssistance" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Medical Cash Allowance to Dependents" value={medicalCashAllowanceToDependents} onChange={setMedicalCashAllowanceToDependents} fieldKey="medicalCashAllowanceToDependents" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Meal Allowance" value={mealAllowance} onChange={setMealAllowance} fieldKey="mealAllowance" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Christmas / Anniversary Gifts" value={christmasAnniversaryGifts} onChange={setChristmasAnniversaryGifts} fieldKey="christmasAnniversaryGifts" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="Achievement Awards" value={achievementAwards} onChange={setAchievementAwards} fieldKey="achievementAwards" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <AllowanceField label="13th Month Pay" value={thirteenthMonthPay} onChange={setThirteenthMonthPay} fieldKey="thirteenthMonthPay" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
            <div>
              <AllowanceField label="Christmas Bonus" value={christmasBonus} onChange={setChristmasBonus} fieldKey="christmasBonus" frequencies={namedAllowanceFrequencies} onFrequencyChange={(k, f) => setNamedAllowanceFrequencies((p) => ({ ...p, [k]: f }))} standardHoursPerDay={standardHoursPerDay} workingDaysPerMonth={workingDaysPerMonth} />
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Use this for December 31 or year-end bonus amounts only when applicable.
              </div>
            </div>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "grid",
                gap: 12,
                padding: 16,
                borderRadius: 22,
                border: "1px solid #dbeafe",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <FieldLabel>Customized Allowances</FieldLabel>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, fontWeight: 700 }}>
                    Add another allowance only when the fixed allowance is not listed above.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addCustomAllowanceRow}
                  style={{
                    border: "1px solid #0a4f8f",
                    background: "#0a4f8f",
                    color: "#ffffff",
                    borderRadius: 16,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 10px 20px rgba(14, 116, 144, 0.18)",
                  }}
                >
                  + Add Allowance
                </button>
              </div>

              {assignedDeMinimisBenefits.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 18,
                    border: "1px solid #bbf7d0",
                    background: "#f0fdf4",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#166534" }}>
                        De Minimis from catalog
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>
                        Read-only assignments from Payroll Runs &gt; De Minimis. Edit the catalog to change these benefits.
                      </div>
                    </div>
                    <span
                      style={{
                        borderRadius: 999,
                        background: "#dcfce7",
                        color: "#166534",
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Catalog managed
                    </span>
                  </div>
                  {assignedDeMinimisBenefits.map((benefit, index) => {
                    const amount = Number(benefit.amount) || 0;
                    const ceiling = Number(benefit.ceiling) || 0;
                    const excessPortion = benefit.hasOwnCeiling ? Math.max(0, amount - ceiling) : amount;
                    const treatment = benefit.hasOwnCeiling
                      ? `Own ceiling ${formatMoney(ceiling)}; excess to shared 90k bucket ${formatMoney(excessPortion)}`
                      : "Full amount feeds shared 90k bucket from first peso";

                    return (
                      <div
                        key={benefit.id || `${benefit.name}-${index}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 160px 160px minmax(220px, 1fr)",
                          gap: 12,
                          alignItems: "end",
                          padding: 12,
                          borderRadius: 18,
                          border: "1px solid #bbf7d0",
                          background: "#ffffff",
                        }}
                      >
                        <label>
                          <FieldLabel>{`Allowance Name ${index + 1}`}</FieldLabel>
                          <InputField value={benefit.name} readOnly />
                        </label>
                        <div>
                          <FieldLabel>Amount</FieldLabel>
                          <InputField value={String(amount)} readOnly />
                        </div>
                        <label>
                          <FieldLabel>Frequency</FieldLabel>
                          <SelectField value={benefit.frequency} disabled>
                            <option value="Monthly">Monthly</option>
                            <option value="Semi-monthly">Semi-monthly</option>
                            <option value="Annual">Annual</option>
                          </SelectField>
                        </label>
                        <div>
                          <FieldLabel>Ceiling / 90k Treatment</FieldLabel>
                          <div
                            style={{
                              minHeight: 64,
                              border: "1px solid #dbeafe",
                              background: "#f8fafc",
                              borderRadius: 14,
                              padding: "12px 14px",
                              color: "#334155",
                              fontSize: 12,
                              fontWeight: 800,
                              lineHeight: 1.45,
                            }}
                          >
                            {treatment}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {customAllowanceRows.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {customAllowanceRows.map((row, index) => {
                    const rowFreq = normalizeAllowanceFrequency(row.frequency);
                    const rowAmount = Number(row.amount) || 0;
                    const rowHours = Number(standardHoursPerDay) || 8;
                    const rowDays = Number(workingDaysPerMonth) || 26;
                    let rowMonthlyEquiv: number | null = null;
                    if (rowFreq === "Annual") rowMonthlyEquiv = rowAmount / 12;
                    else if (rowFreq === "Hourly") rowMonthlyEquiv = rowAmount * rowHours * rowDays;
                    return (
                    <div
                      key={row.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 160px 160px auto",
                        gap: 12,
                        alignItems: "end",
                        padding: 12,
                        borderRadius: 18,
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                      }}
                    >
                      <label>
                        <FieldLabel>{`Allowance Name ${index + 1}`}</FieldLabel>
                        <InputField
                          value={row.name}
                          onChange={(e) => updateCustomAllowanceRow(row.id, "name", e.target.value)}
                          placeholder="Example: Transportation Allowance"
                        />
                      </label>
                      <div>
                        <FieldLabel>Amount</FieldLabel>
                        <InputField
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateCustomAllowanceRow(row.id, "amount", e.target.value)}
                        />
                        {rowMonthlyEquiv !== null ? (
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: 600 }}>
                            Monthly: ₱{rowMonthlyEquiv.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        ) : null}
                      </div>
                      <label>
                        <FieldLabel>Frequency</FieldLabel>
                        <SelectField
                          value={rowFreq}
                          onChange={(e) => updateCustomAllowanceRow(row.id, "frequency", e.target.value)}
                        >
                          <option value="Monthly">Monthly</option>
                          <option value="Annual">Annual</option>
                          <option value="Hourly">Hourly</option>
                        </SelectField>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomAllowanceRow(row.id)}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fff1f2",
                          color: "#b91c1c",
                          borderRadius: 14,
                          padding: "12px 14px",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    background: "#ffffff",
                    borderRadius: 18,
                    padding: 14,
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  No customized allowance added. Click + Add Allowance if the employee has another fixed allowance.
                </div>
              )}
            </div>
          </Grid>
        </Section>

        <Section title="Absence &amp; Allowance Settings">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Deduct allowances on absence</FieldLabel>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.6, fontWeight: 700 }}>
                  When <strong style={{ color: "#0a4f8f" }}>ON</strong>, all fixed allowances are prorated for each calendar day absent:
                  <span style={{ display: "inline-block", marginLeft: 4, fontFamily: "monospace", color: "#0a4f8f", fontWeight: 800 }}>
                    allowance_paid = (allowance ÷ working_days_per_month) × days_present
                  </span>.
                  When <strong style={{ color: "#64748b" }}>OFF</strong> (default), allowances are always paid in full regardless of absences.
                </div>
              </div>
              <button
                type="button"
                disabled={isViewMode}
                onClick={() => { if (!isViewMode) setDeductAllowanceOnAbsence((prev) => !prev); }}
                role="switch"
                aria-checked={deductAllowanceOnAbsence}
                aria-label="Deduct allowances on absence"
                style={{
                  flexShrink: 0,
                  position: "relative",
                  width: 52,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  background: deductAllowanceOnAbsence ? "#0a4f8f" : "#cbd5e1",
                  cursor: isViewMode ? "not-allowed" : "pointer",
                  transition: "background 0.2s",
                  padding: 0,
                  outline: "none",
                  boxShadow: deductAllowanceOnAbsence ? "0 0 0 3px rgba(10,79,143,0.15)" : "none",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    left: deductAllowanceOnAbsence ? 26 : 4,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.20)",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                border: deductAllowanceOnAbsence ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                background: deductAllowanceOnAbsence ? "#eff6ff" : "#f8fafc",
                color: deductAllowanceOnAbsence ? "#1d4ed8" : "#64748b",
              }}
            >
              {deductAllowanceOnAbsence
                ? "YES — Allowances will be prorated. Formula: allowance_paid = (allowance ÷ working_days_per_month) × days_present"
                : "NO (default) — Full allowances are always paid regardless of absences."}
            </div>
          </div>
        </Section>

        <Section title="6. Government and Payroll Details">
          <div
            style={{
              marginBottom: 18,
              display: "grid",
              gap: 12,
              border: "1px solid #dbeafe",
              background: "#f8fafc",
              borderRadius: 18,
              padding: 14,
            }}
          >
            <Grid columns="repeat(2, minmax(0, 1fr))">
              <label>
                <FieldLabel required>Base Salary (Monthly)</FieldLabel>
                <InputField
                  type="number"
                  value={basicPay}
                  onChange={(e) => setBasicPay(e.target.value)}
                  placeholder="Enter monthly base salary"
                />
              </label>
              <label>
                <FieldLabel required>Salary Effective Date</FieldLabel>
                <InputField
                  type="date"
                  value={salaryEffectiveDate}
                  onChange={(e) => setSalaryEffectiveDate(e.target.value)}
                />
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                  Stored as YYYY-MM-DD and used as the permanent salary history date.
                </div>
              </label>
            </Grid>
            <Grid columns="repeat(2, minmax(0, 1fr))">
              <label>
                <FieldLabel>Salary Change Reason</FieldLabel>
                <InputField
                  value={salaryChangeReason}
                  onChange={(e) => setSalaryChangeReason(e.target.value)}
                  placeholder={isEditMode ? "e.g. Annual increase" : "Initial base salary"}
                />
              </label>
            </Grid>
            <Grid columns="repeat(2, minmax(0, 1fr))">
              <label>
                <FieldLabel required>Standard Hours Per Day</FieldLabel>
                <InputField
                  type="number"
                  value={standardHoursPerDay}
                  onChange={(e) => setStandardHoursPerDay(e.target.value)}
                  placeholder="e.g. 8"
                />
              </label>
              <label>
                <FieldLabel required>Working Days Per Month</FieldLabel>
                <InputField
                  type="number"
                  value={workingDaysPerMonth}
                  onChange={(e) => setWorkingDaysPerMonth(e.target.value)}
                  placeholder="e.g. 21.75"
                />
              </label>
            </Grid>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, fontWeight: 700 }}>
              Pay Frequency is Semi-monthly. Hourly rate is computed as: Base Salary ÷ Working Days Per Month ÷ Standard Hours Per Day.
            </div>
            <div style={{ fontSize: 12, color: "#0a4f8f", lineHeight: 1.5, fontWeight: 800 }}>
              Computed hourly rate: {formatPesoAmount(currentPayValues.hourlyRate)} / hour. Monthly equivalent: {formatPesoAmount(currentPayValues.monthlyBasicPay)}.
            </div>
            {originalEmployeeSnapshot ? (
              <div style={{ borderTop: "1px solid #dbeafe", paddingTop: 12 }}>
                <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
                  Salary History
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {normalizeSalaryHistory(originalEmployeeSnapshot).slice().reverse().map((entry, index) => (
                    <div
                      key={`${entry.effectiveDate}-${entry.changedAt || index}`}
                      style={{
                        display: "grid",
                        gap: 4,
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        background: "#ffffff",
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ color: "#0f172a", fontWeight: 900 }}>{formatPesoAmount(entry.baseSalary)}</span>
                        <span style={{ color: "#0a4f8f", fontSize: 12, fontWeight: 900 }}>{entry.effectiveDate}</span>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                        {entry.reason || "Salary history"} · {entry.changedBy || "unknown"}{entry.changedAt ? ` · ${new Date(entry.changedAt).toLocaleString("en-PH")}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Grid>
            <label>
              <FieldLabel>SSS Number</FieldLabel>
              <InputField
                value={sss}
                onChange={(e) => setSSS(formatSssNumber(e.target.value))}
                placeholder="10 digits"
                maxLength={10}
                inputMode="numeric"
              />
            </label>
            <label>
              <FieldLabel>PhilHealth Number</FieldLabel>
              <InputField
                value={philhealth}
                onChange={(e) => setPhilhealth(formatPhilHealthNumber(e.target.value))}
                placeholder="00-000000000-0"
                maxLength={14}
                inputMode="numeric"
              />
            </label>
            <label>
              <FieldLabel>Pag-IBIG Number</FieldLabel>
              <InputField
                value={pagibig}
                onChange={(e) => setPagibig(formatPagibigNumber(e.target.value))}
                placeholder="0000-0000-0000"
                maxLength={14}
                inputMode="numeric"
              />
            </label>
            <label>
              <FieldLabel>TIN</FieldLabel>
              <InputField
                value={tin}
                onChange={(e) => setTin(formatTin(e.target.value))}
                placeholder="000-000-000-000"
                maxLength={15}
                inputMode="numeric"
              />
            </label>
            <label>
              <FieldLabel required>Bank Name</FieldLabel>
              <InputField
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Enter bank name"
              />
            </label>
            <label>
              <FieldLabel required>Bank Account Number</FieldLabel>
              <InputField
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="Enter bank account number"
              />
            </label>
            <label>
              <FieldLabel required>Bank Account Type</FieldLabel>
              <SelectField
                value={bankAccountType}
                onChange={(e) => setBankAccountType(e.target.value)}
              >
                <option value="Savings">Savings</option>
                <option value="Checking">Checking</option>
                <option value="Payroll">Payroll</option>
                <option value="Other">Other</option>
              </SelectField>
            </label>
          </Grid>
        </Section>

        <Section title="7. Personal and Contact Information">
          <Grid>
            <label>
              <FieldLabel required>Birthdate</FieldLabel>
              <InputField type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </label>
            <label>
              <FieldLabel required>Contact Number</FieldLabel>
              <InputField
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Enter contact number"
              />
            </label>
            <label>
              <FieldLabel required>Email Address</FieldLabel>
              <InputField
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="Enter email address"
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              <FieldLabel required>Address</FieldLabel>
              <InputField
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter complete address"
              />
            </label>
          </Grid>
        </Section>


        <Section title="8. Employee Photo">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: 18,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 140,
                height: 140,
                position: "relative",
                borderRadius: 28,
                border: "1px solid #cbd5e1",
                background: employeePhotoDataUrl ? "#ffffff" : "#f8fafc",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              {employeePhotoDataUrl ? (
                <Image
                  src={employeePhotoDataUrl}
                  alt="Employee photo preview"
                  fill
                  sizes="140px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                "No Photo"
              )}
            </div>

            <div>
              <FieldLabel>Employee Photo</FieldLabel>
              <InputField
                type="file"
                accept="image/*"
                onChange={(event) => handleEmployeePhotoUpload(event.target.files?.[0] || null)}
                style={{ marginTop: 8 }}
              />
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
                Optional for individual employee entry only. This is not included in CSV imports. Imported employees can add or update their photo later from View Employees &gt; Edit.
              </div>
              {employeePhotoDataUrl ? (
                <button
                  type="button"
                  onClick={() => setEmployeePhotoDataUrl("")}
                  style={{
                    marginTop: 10,
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid #fecaca",
                    background: "#fff1f2",
                    color: "#be123c",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Remove Photo
                </button>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="9. Employee Portal Access">
          <Grid columns="repeat(2, minmax(0, 1fr))">
            <label>
              <FieldLabel>Portal Username</FieldLabel>
              <InputField
                value={portalUsername}
                onChange={(event) => setPortalUsername(event.target.value)}
                placeholder="Auto-generated username"
              />
            </label>

            <label>
              <FieldLabel>Temporary Password</FieldLabel>
              <InputField
                value={portalPassword}
                onChange={(event) => setPortalPassword(event.target.value)}
                placeholder="Auto-generated temporary password"
              />
            </label>

            <label>
              <FieldLabel>Portal Status</FieldLabel>
              <SelectField
                value={portalStatus}
                onChange={(event) => setPortalStatus(event.target.value as "Active" | "Locked" | "Disabled")}
              >
                <option value="Active">Active</option>
                <option value="Locked">Locked</option>
                <option value="Disabled">Disabled</option>
              </SelectField>
            </label>

            <label>
              <FieldLabel>Must Change Password?</FieldLabel>
              <SelectField
                value={mustChangePassword ? "Yes" : "No"}
                onChange={(event) => setMustChangePassword(event.target.value === "Yes")}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </SelectField>
            </label>
          </Grid>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 18 }}>
            <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, fontWeight: 700, maxWidth: 760 }}>
              The username and temporary password are used for the Employee Portal. The employee will be required to change the password on first login when Must Change Password is set to Yes.
            </div>
            <button
              type="button"
              onClick={() => {
                setPortalPassword(generateTemporaryPassword());
                setMustChangePassword(true);
                setPortalStatus("Active");
              }}
              style={{
                padding: "12px 18px",
                borderRadius: 16,
                border: "1px solid #0a4f8f",
                background: "#0a4f8f",
                color: "#ffffff",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              Reset Temporary Password
            </button>
          </div>
        </Section>

        {!isViewMode ? (
          <div className={`${subtlePanelClassName} flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between`}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-[#0a4f8f]">
                <Save className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                {isEditMode ? "Ready to Update Employee Record" : "Ready to Save Employee Record"}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-500">
                This employee record will be used in employee listings, payroll dropdowns, and payroll history.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveEmployee}
              className={primaryButtonClassName}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {isEditMode ? "Update Employee" : "Save Employee"}
            </button>
          </div>
        ) : null}
            </fieldset>

            {isViewMode ? (
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/add-employee?editEmployeeNo=${encodeURIComponent(selectedEmployeeNo)}`)}
                  className={primaryButtonClassName}
                >
                  <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
                  Edit Employee
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/employees")}
                  className={secondaryButtonClassName}
                >
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Back to Employees
                </button>
              </div>
            ) : null}
          </>
        ) : null}
        </div>
      </div>

      {/* Session restore banner */}
      {showRestoreBanner ? (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0f172a",
          color: "#f1f5f9",
          borderRadius: 18,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          zIndex: 100,
          maxWidth: 500,
          width: "calc(100% - 32px)",
        }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
            You have an unsaved draft. Restore it?
          </div>
          <button
            type="button"
            onClick={handleRestoreSession}
            style={{ padding: "8px 14px", borderRadius: 12, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
          >
            Restore
          </button>
          <button
            type="button"
            onClick={handleDiscardSession}
            style={{ padding: "8px 14px", borderRadius: 12, background: "#334155", color: "#cbd5e1", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Discard
          </button>
        </div>
      ) : null}

      {/* Departments modal */}
      {showDepartmentsModal ? (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDepartmentsModal(false); }}
        >
          <div className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]" style={{ maxHeight: "70vh" }}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
              <h3 className="m-0 text-base font-extrabold text-slate-950">Manage Departments</h3>
              <button
                type="button"
                onClick={() => setShowDepartmentsModal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              {departmentOptions.length === 0 ? (
                <div className="py-8 text-center text-sm font-medium text-slate-500">No departments yet.</div>
              ) : (
                departmentOptions.map((item) => (
                  <div
                    key={item}
                    className="group flex min-h-11 items-center justify-between gap-3 border-b border-slate-100 px-1 py-2 transition last:border-b-0 hover:bg-slate-50"
                  >
                    {editingDepartmentName === item ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          className="min-h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            value={editedDepartmentName}
                            onChange={(e) => setEditedDepartmentName(e.target.value)}
                            placeholder="Edit department name"
                          />
                        <button type="button" onClick={handleSaveEditedDepartment} className="inline-flex h-8 items-center justify-center rounded-lg bg-[#0a4f8f] px-3 text-xs font-bold text-white transition hover:bg-[#073c6d]">Save</button>
                        <button type="button" onClick={handleCancelEditDepartment} className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 truncate text-sm font-normal text-slate-800">{item}</div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditDepartment(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
                            title="Edit department"
                            aria-label={`Edit ${item}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDepartment(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete department"
                            aria-label={`Delete ${item}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="sticky bottom-0 z-10 border-t border-slate-100 bg-white px-5 py-4">
              <div className="flex items-center gap-2">
                <input
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleAddDepartmentOption();
                    }
                  }}
                  placeholder="Enter department name..."
                  className="min-h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="button"
                  onClick={handleAddDepartmentOption}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0a4f8f] px-3 text-xs font-bold text-white transition hover:bg-[#073c6d] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!newDepartment.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Import confirmation dialog */}
      {showImportConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "36px 40px", maxWidth: 420, width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
              {isBulkEmployeeEditMode ? "Update Employees?" : "Save Imported Employees?"}
            </div>
            <div style={{ fontSize: 14, color: "#475569", marginBottom: 28, lineHeight: 1.6 }}>
              You are about to {isBulkEmployeeEditMode ? "update" : "save"}{" "}
              <strong>{batchImportRows.length} employee record{batchImportRows.length !== 1 ? "s" : ""}</strong>.
              This action cannot be undone. Are you sure you want to continue?
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowImportConfirm(false)}
                style={{ padding: "10px 24px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSaveImportedRows}
                style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "#0a4f8f", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14 }}
              >
                Yes, {isBulkEmployeeEditMode ? "Update" : "Save"} Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saving progress overlay */}
      {isSavingImport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "36px 48px", maxWidth: 420, width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)", textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
              {isBulkEmployeeEditMode ? "Updating employees…" : "Saving employees…"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Please wait. Do not close this page.
            </div>
            <div style={{ height: 10, borderRadius: 99, background: "#e2e8f0", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 99,
                  background: "linear-gradient(90deg, #0a4f8f, #3b82f6)",
                  animation: "axis-progress-bar 1.4s ease-in-out infinite",
                  width: "60%",
                }}
              />
            </div>
          </div>
          <style>{`
            @keyframes axis-progress-bar {
              0% { transform: translateX(-100%); width: 60%; }
              50% { width: 80%; }
              100% { transform: translateX(200%); width: 60%; }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}

export default function AddEmployeePage() {
  return (
    <Suspense>
      <AddEmployeePageInner />
    </Suspense>
  );
}
