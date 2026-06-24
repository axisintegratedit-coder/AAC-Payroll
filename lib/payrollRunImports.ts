import * as XLSX from "xlsx";

export type PayrollCutoffIdentity = {
  monthYear: string;
  cutoff: string;
  cutoffId?: string;
  cutoffLabel?: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
  payDate?: string;
  payrollDate?: string;
};

export type ValidationError = {
  sheet: string;
  row: number;
  field: string;
  message: string;
};

export type SpecialItemCategory =
  | "ONE_TIME_CREDIT"
  | "ONE_TIME_DEDUCTION"
  | "GLOBAL_RULE";

export type SpecialItem = {
  id: string;
  employeeId: string;
  instructionType: string;
  category: SpecialItemCategory;
  amount: number;
  effectiveDate: string;
  remarks?: string;
};

export type AttendanceStatusType = "none" | "floating" | "suspension" | "LOA" | "ML";

export type PayrollAttendanceRow = {
  employeeId: string;
  daysPresent: number;
  daysAbsent: number;
  undertimeMins?: number;
  lateMins?: number;
  statusType: AttendanceStatusType;
  statusDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  workPeriodCutoff: PayrollCutoffIdentity;
  lateEndorsed: boolean;
  lateEndorsementReason?: string;
  leadingColumns: Record<string, string | number | boolean | null>;
  premiumHours: Record<string, number>;
};

export type PayrollAllowanceLoanItemType =
  | "Taxable Allowance"
  | "Non-Taxable Allowance"
  | "De Minimis"
  | "Bonus"
  | "SSS Loan"
  | "HDMF Loan"
  | "Calamity Loan"
  | "Misc Deduction";

export type PayrollAllowanceLoanItem = {
  id: string;
  employeeId: string;
  itemType: PayrollAllowanceLoanItemType;
  itemName: string;
  amount: number;
  taxable: boolean;
  applyBeforeTax: boolean;
  maximumAmount?: number;
  splitPerCutoff: boolean;
  applyCutoff: "1" | "2" | "Both";
  monthlyLimit: boolean;
  effectiveDate: string;
  remarks?: string;
};

export type SpecialItemsParseResult = {
  items: SpecialItem[];
  errors: ValidationError[];
};

export type PayrollComputationImport = {
  attendanceRows: PayrollAttendanceRow[];
};

export type PayrollComputationParseResult = PayrollComputationImport & {
  errors: ValidationError[];
};

const SPECIAL_ITEM_CATEGORY_BY_TYPE: Record<string, SpecialItemCategory> = {
  "13th month": "ONE_TIME_CREDIT",
  "pto": "ONE_TIME_CREDIT",
  "tax refund": "ONE_TIME_CREDIT",
  "pto crediting": "ONE_TIME_CREDIT",
  "bonus": "ONE_TIME_CREDIT",
  "sss sl": "ONE_TIME_DEDUCTION",
  "hdmf mpl": "ONE_TIME_DEDUCTION",
  "adv": "ONE_TIME_DEDUCTION",
  "advance": "ONE_TIME_DEDUCTION",
  "sss based on net basic pay": "GLOBAL_RULE",
  "sss on net": "GLOBAL_RULE",
  "phic on gross": "GLOBAL_RULE",
  "philhealth on gross": "GLOBAL_RULE",
  "hdmf 200/100": "GLOBAL_RULE",
};

const VALID_ONE_TIME_SPECIAL_ITEM_TYPES = new Set([
  "13th month",
  "pto",
  "pto crediting",
  "tax refund",
  "bonus",
  "sss loan",
  "sss sl",
  "hdmf loan",
  "hdmf mpl",
  "adv",
  "advance",
  "misc deduction",
]);

const SPECIAL_ITEM_CATEGORY_LABELS = new Set([
  "one-time deductions",
  "one time deductions",
  "one-time deduction",
  "one time deduction",
  "one-time credits",
  "one time credits",
  "one-time credit",
  "one time credit",
]);

const BASE_ADJUSTMENT_TYPES = new Set([
  "salary increase",
  "basic salary change",
  "base adjustment",
  "base salary adjustment",
  "salary adjustment",
]);

const YES_NO = ["Yes", "No"];
const ATTENDANCE_STATUS_TYPES: AttendanceStatusType[] = ["none", "floating", "suspension", "LOA", "ML"];
const ATTENDANCE_FIXED_HEADERS = [
  "employeeId",
  "daysPresent",
  "daysAbsent",
  "undertimeMins",
  "lateMins",
  "statusType",
  "statusDays",
  "paidLeaveDays",
  "unpaidLeaveDays",
  "workPeriodCutoff",
  "lateEndorsementReason",
];
export const SPROUT_PREMIUM_BUCKETS = [
  "Ord-OT",
  "Ord-ND",
  "Ord-ND-OT",
  "RD",
  "RD-OT",
  "RD-ND",
  "RD-ND-OT",
  "SH",
  "SH-OT",
  "SH-ND",
  "SH-ND-OT",
  "LH",
  "LH-OT",
  "LH-ND",
  "LH-ND-OT",
  "SH-RD",
  "SH-RD-OT",
  "SH-RD-ND",
  "SH-RD-ND-OT",
  "LH-RD",
  "LH-RD-OT",
  "LH-RD-ND",
  "LH-RD-ND-OT",
  "DH",
  "DH-ND",
  "DH-RD",
  "DH-RD-ND",
  "DH-OT",
  "DH-ND-OT",
  "DH-RD-OT",
  "DH-RD-ND-OT",
] as const;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isBlank(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(XLSX.read(reader.result, { type: "array", cellDates: false }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: false });
}

function getCell(row: Record<string, unknown>, field: string) {
  const wanted = normalizeHeader(field);
  const matchedKey = Object.keys(row).find((key) => normalizeHeader(key) === wanted);
  return matchedKey ? row[matchedKey] : "";
}

function parseRequiredText(row: Record<string, unknown>, field: string, sheet: string, rowNumber: number, errors: ValidationError[]) {
  const value = String(getCell(row, field) ?? "").trim();
  if (!value) {
    errors.push({ sheet, row: rowNumber, field, message: "Required field is blank." });
  }
  return value;
}

function parseNumberField(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  errors: ValidationError[],
  required = false
) {
  const raw = getCell(row, field);
  if (isBlank(raw)) {
    if (required) errors.push({ sheet, row: rowNumber, field, message: "Required number is blank." });
    return undefined;
  }
  const parsed = Number(String(raw).replace(/[,\s₱]/g, ""));
  if (!Number.isFinite(parsed)) {
    errors.push({ sheet, row: rowNumber, field, message: "Must be numeric." });
    return undefined;
  }
  return parsed;
}

function parsePremiumHoursValue(value: unknown) {
  if (isBlank(value)) return 0;

  const raw = String(value).trim();
  if (!raw || raw === "0" || raw === "00:00") return 0;

  const hhmm = /^(\d+):([0-5]\d)$/.exec(raw);
  if (hhmm) {
    const hours = Number(hhmm[1]);
    const minutes = Number(hhmm[2]);
    return hours + minutes / 60;
  }

  const parsed = Number(raw.replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isValidIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function normalizeImportDateToIso(rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slashDate) {
    const [, month, day, year] = slashDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return raw;
}

function parseDateField(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  errors: ValidationError[],
  options: { required?: boolean; defaultValue?: string } = {}
) {
  const raw = String(getCell(row, field) ?? "").trim();
  if (!raw) {
    if (options.defaultValue) return options.defaultValue;
    if (options.required !== false) {
      errors.push({ sheet, row: rowNumber, field, message: "Required date is blank." });
    }
    return "";
  }

  const normalized = normalizeImportDateToIso(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    errors.push({ sheet, row: rowNumber, field, message: "Use YYYY-MM-DD or MM/DD/YYYY." });
    return normalized;
  }

  if (!isValidIsoCalendarDate(normalized)) {
    errors.push({ sheet, row: rowNumber, field, message: "Invalid calendar date." });
  }

  return normalized;
}

function parseEnum<T extends string>(
  row: Record<string, unknown>,
  field: string,
  values: readonly T[],
  sheet: string,
  rowNumber: number,
  errors: ValidationError[]
) {
  const raw = String(getCell(row, field) ?? "").trim();
  const matched = values.find((value) => value.toLowerCase() === raw.toLowerCase());
  if (!matched) {
    errors.push({ sheet, row: rowNumber, field, message: `Must be one of: ${values.join(", ")}.` });
  }
  return matched || (raw as T);
}

function parseOptionalEnum<T extends string>(
  row: Record<string, unknown>,
  field: string,
  values: readonly T[],
  defaultValue: T,
  sheet: string,
  rowNumber: number,
  errors: ValidationError[]
) {
  const raw = String(getCell(row, field) ?? "").trim();
  if (!raw) return defaultValue;

  const matched = values.find((value) => value.toLowerCase() === raw.toLowerCase());
  if (!matched) {
    errors.push({ sheet, row: rowNumber, field, message: `Must be one of: ${values.join(", ")}.` });
  }
  return matched || defaultValue;
}

function parseYesNo(row: Record<string, unknown>, field: string, sheet: string, rowNumber: number, errors: ValidationError[]) {
  return parseEnum(row, field, YES_NO, sheet, rowNumber, errors) === "Yes";
}

function rowHasAnyValue(row: Record<string, unknown>) {
  return Object.values(row).some((value) => !isBlank(value));
}

function cutoffMatches(value: string, cutoff: PayrollCutoffIdentity) {
  const normalizedValue = normalizeKey(value);
  return [cutoff.cutoffId, cutoff.cutoff, cutoff.cutoffLabel]
    .filter(Boolean)
    .some((candidate) => normalizeKey(candidate) === normalizedValue);
}

function resolveWorkPeriodCutoff(
  rawValue: string,
  runCutoff: PayrollCutoffIdentity,
  availableCutoffs: PayrollCutoffIdentity[],
  sheet: string,
  rowNumber: number,
  errors: ValidationError[]
) {
  const value = rawValue.trim();
  if (!value) return runCutoff;

  const matched = availableCutoffs.find((cutoff) => cutoffMatches(value, cutoff));
  if (!matched) {
    errors.push({ sheet, row: rowNumber, field: "workPeriodCutoff", message: "Unknown work period cutoff." });
    return runCutoff;
  }

  return matched;
}

export function getSpecialItemCategory(instructionType: string, employeeId: string): SpecialItemCategory | null {
  if (employeeId.trim().toLowerCase() === "all") return "GLOBAL_RULE";
  return SPECIAL_ITEM_CATEGORY_BY_TYPE[normalizeKey(instructionType)] || null;
}

function getOneTimeSpecialItemCategoryFromAmount(amount: number): SpecialItemCategory {
  return amount < 0 ? "ONE_TIME_DEDUCTION" : "ONE_TIME_CREDIT";
}

export async function parseSpecialItemsWorkbook(
  file: File,
  employeeIds: Set<string>,
  cutoffIdentity: PayrollCutoffIdentity
): Promise<SpecialItemsParseResult> {
  const workbook = await readWorkbook(file);
  const rows = sheetRows(workbook, "SpecialItems") || sheetRows(workbook, workbook.SheetNames[0] || "");
  const errors: ValidationError[] = [];
  const items: SpecialItem[] = [];
  const sheet = "SpecialItems";

  if (!rows) {
    return { items, errors: [{ sheet, row: 1, field: "sheet", message: "Missing SpecialItems sheet." }] };
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const employeeId = parseRequiredText(row, "employeeId", sheet, rowNumber, errors);
    const instructionType = parseRequiredText(row, "instructionType", sheet, rowNumber, errors);
    const rawAmount = parseNumberField(row, "amount", sheet, rowNumber, errors, true) ?? 0;
    const effectiveDate = parseDateField(row, "effectiveDate", sheet, rowNumber, errors, { required: false });
    const isGlobalRule = employeeId.trim().toLowerCase() === "all";
    const category = isGlobalRule ? getSpecialItemCategory(instructionType, employeeId) : getOneTimeSpecialItemCategoryFromAmount(rawAmount);
    const normalizedInstruction = normalizeKey(instructionType);

    if (employeeId && employeeId.toLowerCase() !== "all" && !employeeIds.has(employeeId)) {
      errors.push({ sheet, row: rowNumber, field: "employeeId", message: "Employee is not loaded in this run." });
    }
    if (BASE_ADJUSTMENT_TYPES.has(normalizedInstruction)) {
      errors.push({
        sheet,
        row: rowNumber,
        field: "instructionType",
        message: "Base-salary changes must be recorded in Employees > Salary History, not Special Items.",
      });
    }
    if (SPECIAL_ITEM_CATEGORY_LABELS.has(normalizedInstruction)) {
      errors.push({ sheet, row: rowNumber, field: "instructionType", message: "Use a specific instruction type, not a category label." });
    }
    if (!isGlobalRule && !VALID_ONE_TIME_SPECIAL_ITEM_TYPES.has(normalizedInstruction)) {
      errors.push({ sheet, row: rowNumber, field: "instructionType", message: "Unknown instruction type." });
    }
    if (isGlobalRule && !category) {
      errors.push({ sheet, row: rowNumber, field: "instructionType", message: "Unknown global rule note." });
    }
    if (cutoffIdentity.monthYear && effectiveDate && !effectiveDate.startsWith(`${cutoffIdentity.monthYear}-`)) {
      errors.push({ sheet, row: rowNumber, field: "effectiveDate", message: `Must be within run month ${cutoffIdentity.monthYear}.` });
    }

    items.push({
      id: `special-${rowNumber}-${employeeId}-${instructionType}`,
      employeeId,
      instructionType,
      category: category || "ONE_TIME_CREDIT",
      amount: Math.abs(rawAmount),
      effectiveDate,
      remarks: String(getCell(row, "remarks") || "").trim() || undefined,
    });
  });

  return { items, errors };
}

export async function parsePayrollComputationWorkbook(
  file: File,
  employeeIds: Set<string>,
  cutoffIdentity: PayrollCutoffIdentity,
  availableCutoffs: PayrollCutoffIdentity[] = [cutoffIdentity]
): Promise<PayrollComputationParseResult> {
  const workbook = await readWorkbook(file);
  const attendanceRowsRaw = sheetRows(workbook, "Attendance");
  const errors: ValidationError[] = [];
  const attendanceRows: PayrollAttendanceRow[] = [];

  if (!attendanceRowsRaw) {
    errors.push({ sheet: "Attendance", row: 1, field: "sheet", message: "Missing Attendance sheet." });
  }

  (attendanceRowsRaw || []).filter(rowHasAnyValue).forEach((row, index) => {
    const rowNumber = index + 2;
    const employeeId = parseRequiredText(row, "employeeId", "Attendance", rowNumber, errors);
    const daysPresent = parseNumberField(row, "daysPresent", "Attendance", rowNumber, errors, true) ?? 0;
    const daysAbsent = parseNumberField(row, "daysAbsent", "Attendance", rowNumber, errors, true) ?? 0;
    const statusType = parseOptionalEnum(row, "statusType", ATTENDANCE_STATUS_TYPES, "none", "Attendance", rowNumber, errors);
    const statusDays = parseNumberField(row, "statusDays", "Attendance", rowNumber, errors) ?? 0;
    const paidLeaveDays = parseNumberField(row, "paidLeaveDays", "Attendance", rowNumber, errors) ?? 0;
    const unpaidLeaveDays = parseNumberField(row, "unpaidLeaveDays", "Attendance", rowNumber, errors) ?? 0;
    const workPeriodCutoff = resolveWorkPeriodCutoff(
      String(getCell(row, "workPeriodCutoff") || "").trim(),
      cutoffIdentity,
      availableCutoffs,
      "Attendance",
      rowNumber,
      errors
    );
    const lateEndorsementReason = String(getCell(row, "lateEndorsementReason") || "").trim() || undefined;
    const lateEndorsed = !cutoffMatches(workPeriodCutoff.cutoffId || workPeriodCutoff.cutoff || "", cutoffIdentity);

    if (employeeId && !employeeIds.has(employeeId)) {
      errors.push({ sheet: "Attendance", row: rowNumber, field: "employeeId", message: "Employee is not loaded in this run." });
    }
    if (lateEndorsed && !lateEndorsementReason) {
      errors.push({ sheet: "Attendance", row: rowNumber, field: "lateEndorsementReason", message: "Reason is required when workPeriodCutoff differs from the run cutoff." });
    }

    const rowHeaders = Object.keys(row);
    const fixedHeaderSet = new Set(ATTENDANCE_FIXED_HEADERS.map(normalizeHeader));
    const templatePremiumHeaderSet = new Set(SPROUT_PREMIUM_BUCKETS.map(normalizeHeader));
    const premiumHeaders = [
      ...SPROUT_PREMIUM_BUCKETS,
      ...rowHeaders.filter(
        (header) =>
          !fixedHeaderSet.has(normalizeHeader(header)) &&
          !templatePremiumHeaderSet.has(normalizeHeader(header))
      ),
    ];
    const leadingColumns = Object.fromEntries(
      rowHeaders
        .filter((header) => fixedHeaderSet.has(normalizeHeader(header)) && !["employeeId", "daysPresent", "daysAbsent"].includes(header))
        .map((header) => [header, row[header] as string | number | boolean | null])
    );
    const premiumHours: Record<string, number> = {};

    premiumHeaders.forEach((header) => {
      const parsed = parsePremiumHoursValue(getCell(row, header));
      if (parsed === undefined) {
        errors.push({ sheet: "Attendance", row: rowNumber, field: header, message: "Premium-hour bucket must be decimal hours or HH:MM." });
      } else {
        premiumHours[header] = parsed;
      }
    });

    attendanceRows.push({
      employeeId,
      daysPresent,
      daysAbsent,
      undertimeMins: parseNumberField(row, "undertimeMins", "Attendance", rowNumber, errors),
      lateMins: parseNumberField(row, "lateMins", "Attendance", rowNumber, errors),
      statusType,
      statusDays,
      paidLeaveDays,
      unpaidLeaveDays,
      workPeriodCutoff,
      lateEndorsed,
      lateEndorsementReason,
      leadingColumns,
      premiumHours,
    });
  });

  return { attendanceRows, errors };
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename, { bookType: "xlsx" });
}

export function downloadSpecialItemsTemplate(cutoffIdentity: PayrollCutoffIdentity) {
  const rows = [
    {
      employeeId: "EMP-002",
      instructionType: "Bonus",
      amount: 5000,
      effectiveDate: "",
      remarks: "One-time credit example",
    },
    {
      employeeId: "EMP-003",
      instructionType: "SSS Loan",
      amount: -1500,
      effectiveDate: "",
      remarks: "One-time deduction example",
    },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "SpecialItems");
  downloadWorkbook(workbook, `special-items-template-${cutoffIdentity.monthYear || "month-year"}.xlsx`);
}

export function downloadPayrollComputationTemplate(cutoffIdentity: PayrollCutoffIdentity) {
  const workbook = XLSX.utils.book_new();
  const attendanceHeaders = [...ATTENDANCE_FIXED_HEADERS, ...SPROUT_PREMIUM_BUCKETS];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([attendanceHeaders]),
    "Attendance"
  );
  downloadWorkbook(workbook, `payroll-computation-template-${cutoffIdentity.monthYear || "month-year"}.xlsx`);
}
