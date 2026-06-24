"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { storageKeys } from "@/lib/appStorage";
import { getConfigItem, removeConfigItem, getDataArray, setDataArray, getCollectionItems, setCollectionItems } from "@/lib/firestore";
import { logAudit } from "@/lib/auditTrail";

type PayrollRecord = {
  id: string;
  employeeName: string;
  payrollPeriod: string;
  monthYear: string;
  netPay: number;
  basicPay?: number;
  dailyRate?: number;
  hourlyRate?: number;
  regularHours?: number;
  overtimeHours?: number;
  nightDifferentialHours?: number;
  absences?: number;
  lateHours?: number;
  undertimeHours?: number;
  payrollAdjustments?: SavedPayrollAdjustment[];
  adjustedNetPay?: number;
  archiveStatus?: "Active" | "Archived";
};

type AdjustmentCategory =
  | "taxableAllowance"
  | "nonTaxableAllowance"
  | "deMinimis"
  | "premium"
  | "bonus"
  | "commission"
  | "absence"
  | "late"
  | "undertime"
  | "overtime"
  | "nightDifferential"
  | "sssEe"
  | "sssEr"
  | "philhealthEe"
  | "philhealthEr"
  | "pagibigEe"
  | "pagibigEr"
  | "withholdingTax"
  | "yearEndTaxRefund"
  | "yearEndAdditionalWithholdingTax"
  | "loan"
  | "cashAdvance"
  | "otherAddition"
  | "otherDeduction";

type AdjustmentRow = {
  id: string;
  savedAdjustmentId?: string;
  adjustmentBatchId?: string;
  payrollReference?: string;
  employeeId: string;
  employeeIds?: string[];
  adjustmentCategory: AdjustmentCategory;
  hours: number;
  originalHours: number;
  rate: number;
  amount: number;
  computedAmount: number;
  reason: string;
};

type SavedPayrollAdjustment = {
  id: string;
  adjustmentBatchId: string;
  payrollReference: string;
  employeeId: string;
  employeeName: string;
  adjustmentCategory: AdjustmentCategory;
  adjustmentLabel: string;
  adjustmentType: "Addition" | "Deduction" | "Employer Contribution";
  hours: number;
  originalHours: number;
  rate: number;
  amount: number;
  finalAmount: number;
  netPayEffect: number;
  reason: string;
  createdAt: string;
};
const adjustmentOptions: {
  value: AdjustmentCategory;
  label: string;
  type: "Addition" | "Deduction" | "Employer Contribution";
  needsHours: boolean;
  amountLabel: string;
}[] = [
  {
    value: "taxableAllowance",
    label: "Taxable Allowance - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "Taxable Allowance Amount",
  },
  {
    value: "nonTaxableAllowance",
    label: "Non-Taxable Allowance - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "Non-Taxable Allowance Amount",
  },
  {
    value: "deMinimis",
    label: "De Minimis Benefit - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "De Minimis Amount",
  },
  {
    value: "premium",
    label: "Premium Pay - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "Additional Premium Amount",
  },
  {
    value: "bonus",
    label: "Bonus - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "Bonus Amount",
  },
  {
    value: "commission",
    label: "Commission - Additional",
    type: "Addition",
    needsHours: false,
    amountLabel: "Commission Amount",
  },
  {
    value: "overtime",
    label: "Overtime Pay - Hours Based",
    type: "Addition",
    needsHours: true,
    amountLabel: "Computed Overtime Pay",
  },
  {
    value: "nightDifferential",
    label: "Night Differential - Hours Based",
    type: "Addition",
    needsHours: true,
    amountLabel: "Computed Night Differential",
  },
  {
    value: "absence",
    label: "Absences - Deduction",
    type: "Deduction",
    needsHours: true,
    amountLabel: "Computed Absence Deduction",
  },
  {
    value: "late",
    label: "Late Hours - Deduction",
    type: "Deduction",
    needsHours: true,
    amountLabel: "Computed Late Deduction",
  },
  {
    value: "undertime",
    label: "Undertime - Deduction",
    type: "Deduction",
    needsHours: true,
    amountLabel: "Computed Undertime Deduction",
  },
  {
    value: "sssEe",
    label: "SSS Employee Share - Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "SSS Employee Share Amount",
  },
  {
    value: "sssEr",
    label: "SSS Employer Share - Employer Contribution",
    type: "Employer Contribution",
    needsHours: false,
    amountLabel: "SSS Employer Share Amount",
  },
  {
    value: "philhealthEe",
    label: "PhilHealth Employee Share - Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "PhilHealth Employee Share Amount",
  },
  {
    value: "philhealthEr",
    label: "PhilHealth Employer Share - Employer Contribution",
    type: "Employer Contribution",
    needsHours: false,
    amountLabel: "PhilHealth Employer Share Amount",
  },
  {
    value: "pagibigEe",
    label: "Pag-IBIG Employee Share - Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Pag-IBIG Employee Share Amount",
  },
  {
    value: "pagibigEr",
    label: "Pag-IBIG Employer Share - Employer Contribution",
    type: "Employer Contribution",
    needsHours: false,
    amountLabel: "Pag-IBIG Employer Share Amount",
  },
  {
    value: "withholdingTax",
    label: "Withholding Tax - Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Withholding Tax Amount",
  },
  {
    value: "yearEndTaxRefund",
    label: "Year-End Tax Refund - Addition",
    type: "Addition",
    needsHours: false,
    amountLabel: "Tax Refund Amount",
  },
  {
    value: "yearEndAdditionalWithholdingTax",
    label: "Year-End Additional Withholding Tax - Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Additional Withholding Tax Amount",
  },
  {
    value: "loan",
    label: "Loan Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Loan Amount",
  },
  {
    value: "cashAdvance",
    label: "Cash Advance Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Cash Advance Amount",
  },
  {
    value: "otherAddition",
    label: "Other Addition",
    type: "Addition",
    needsHours: false,
    amountLabel: "Amount",
  },
  {
    value: "otherDeduction",
    label: "Other Deduction",
    type: "Deduction",
    needsHours: false,
    amountLabel: "Amount",
  },
];

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberValue = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPayrollRunParts = (key: string) => {
  const match = String(key || "").match(/^(\d{4}-\d{2})-(.+)$/);

  if (!match) {
    return {
      monthYear: "",
      cutoffText: key,
    };
  }

  return {
    monthYear: match[1],
    cutoffText: match[2],
  };
};

const getPayrollRunSortValue = (key: string) => {
  const { monthYear, cutoffText } = getPayrollRunParts(key);
  const monthYearParts = monthYear.match(/^(\d{4})-(\d{2})$/);
  const year = monthYearParts ? Number(monthYearParts[1]) : 9999;
  const month = monthYearParts ? Number(monthYearParts[2]) : 99;
  const cutoffOrder = cutoffText.toLowerCase().includes("first")
    ? 1
    : cutoffText.toLowerCase().includes("second")
    ? 2
    : 3;

  return year * 10000 + month * 100 + cutoffOrder;
};

const formatPayrollRunKey = (key: string) => {
  const { monthYear, cutoffText } = getPayrollRunParts(key);
  const monthYearParts = monthYear.match(/^(\d{4})-(\d{2})$/);

  if (!monthYearParts) return key;

  const date = new Date(Number(monthYearParts[1]), Number(monthYearParts[2]) - 1, 1);
  const monthLabel = date.toLocaleString("en-US", { month: "long", year: "numeric" });

  return `${monthLabel} - ${cutoffText || "Payroll"}`;
};

function PayrollAdjustmentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("mode") === "edit";
  const isYearEndTaxMode = searchParams.get("mode") === "year-end-tax";
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<string>("");
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
    const [parsedPayrollRecords, draft, savedAdjustmentRaw] = await Promise.all([
      getCollectionItems<PayrollRecord>(storageKeys.payrollRecords),
      getConfigItem<any | null>("payrollAdjustmentDraft", null),
      isEditMode ? getConfigItem<SavedPayrollAdjustment | null>(storageKeys.payrollAdjustmentEditDraft, null) : Promise.resolve(null),
    ]);
    const activeRecords = parsedPayrollRecords.filter((record) => record.archiveStatus !== "Archived");
    setPayrollRecords(activeRecords);

    // --- Year-End Tax Mode: Auto-load draft from Year-End Tax Annualization ---
    if (isYearEndTaxMode && !isEditMode) {

      if (draft?.mode === "year-end-tax-annualization" && Array.isArray(draft.adjustments)) {
        const activePayrollRecords = Array.isArray(parsedPayrollRecords)
          ? parsedPayrollRecords.filter((record) => record.archiveStatus !== "Archived")
          : [];
        const defaultPayrollKey = `${draft.targetPayrollMonth === "December 2026" ? "2026-12" : "2026-12"}-${draft.targetPayrollPeriod || "Second Cutoff"}`;
        const fallbackPayrollKey = activePayrollRecords
          .map((record) => `${record.monthYear}-${record.payrollPeriod}`)
          .filter((key) => key && !key.includes("undefined") && !key.includes("null"))
          .sort((a, b) => getPayrollRunSortValue(a) - getPayrollRunSortValue(b))
          .at(-1) || "";
        const targetPayrollKey = activePayrollRecords.some(
          (record) => `${record.monthYear}-${record.payrollPeriod}` === defaultPayrollKey
        )
          ? defaultPayrollKey
          : fallbackPayrollKey;
        const targetPayrollRecords = activePayrollRecords.filter(
          (record) => `${record.monthYear}-${record.payrollPeriod}` === targetPayrollKey
        );

        setSelectedPayroll(targetPayrollKey);
        setAdjustments(
          draft.adjustments.map((adjustment: any) => {
            const matchedEmployee = targetPayrollRecords.find(
              (record) =>
                String(record.id || "") === String(adjustment.employeeNo || "") ||
                String(record.id || "") === String(adjustment.employeeId || "") ||
                String(record.employeeName || "").trim().toLowerCase() ===
                  String(adjustment.employeeName || "").trim().toLowerCase()
            );
            const isDeduction = adjustment.adjustmentType === "Deduction" || Number(adjustment.signedAmount || 0) > 0;
            const yearEndAdjustmentCategory: AdjustmentCategory = isDeduction
              ? "yearEndAdditionalWithholdingTax"
              : "yearEndTaxRefund";

            return {
              id: adjustment.id || `YEA-${Date.now()}-${adjustment.employeeNo || adjustment.employeeName}`,
              employeeId: matchedEmployee?.id || "",
              employeeIds: matchedEmployee?.id ? [matchedEmployee.id] : [],
              adjustmentCategory: yearEndAdjustmentCategory,
              hours: 0,
              originalHours: 0,
              rate: 0,
              amount: Math.abs(numberValue(adjustment.amount || adjustment.signedAmount)),
              computedAmount: Math.abs(numberValue(adjustment.amount || adjustment.signedAmount)),
              reason:
                adjustment.reason ||
                `${adjustment.adjustmentField || "Year-end tax adjustment"} from Year-End Tax Annualization`,
            } as AdjustmentRow;
          })
        );
      }
    }

    // --- Edit mode logic ---
    if (!isEditMode) return;

    const savedAdjustment = savedAdjustmentRaw;

    if (!savedAdjustment) {
      alert("No payroll adjustment was selected for editing.");
      router.push("/payroll-records");
      return;
    }

    const option = getAdjustmentOption(savedAdjustment.adjustmentCategory);

    setSelectedPayroll(savedAdjustment.payrollReference);
    setEditingAdjustmentId(savedAdjustment.id);
    setAdjustments([
      {
        id: savedAdjustment.id,
        savedAdjustmentId: savedAdjustment.id,
        adjustmentBatchId: savedAdjustment.adjustmentBatchId,
        payrollReference: savedAdjustment.payrollReference,
        employeeId: savedAdjustment.employeeId,
        employeeIds: [savedAdjustment.employeeId],
        adjustmentCategory: savedAdjustment.adjustmentCategory,
        hours: savedAdjustment.hours || 0,
        originalHours: savedAdjustment.originalHours || 0,
        rate: savedAdjustment.rate || 0,
        amount: option.needsHours ? 0 : savedAdjustment.finalAmount || savedAdjustment.amount || 0,
        computedAmount: savedAdjustment.finalAmount || 0,
        reason: savedAdjustment.reason || "",
      },
    ]);
  }
  init();
  }, [isEditMode, isYearEndTaxMode]);

  const payrollRunKeys = useMemo(
    () =>
      [
        ...new Set(
          payrollRecords
            .map((p) => `${p.monthYear}-${p.payrollPeriod}`)
            .filter((key) => key && !key.includes("undefined") && !key.includes("null"))
        ),
      ].sort((a, b) => getPayrollRunSortValue(a) - getPayrollRunSortValue(b)),
    [payrollRecords]
  );

  const selectedPayrollRecords = useMemo(() => {
    const matchingRecords = payrollRecords.filter(
      (p) => `${p.monthYear}-${p.payrollPeriod}` === selectedPayroll
    );
    const uniqueEmployees = new Map<string, PayrollRecord>();

    matchingRecords.forEach((record) => {
      const uniqueKey = record.id || record.employeeName;
      if (!uniqueEmployees.has(uniqueKey)) {
        uniqueEmployees.set(uniqueKey, record);
      }
    });

    return Array.from(uniqueEmployees.values());
  }, [payrollRecords, selectedPayroll]);

  const getEmployeeById = (employeeId: string) =>
    selectedPayrollRecords.find((employee) => employee.id === employeeId);

  const getAdjustmentOption = (category: AdjustmentCategory) =>
    adjustmentOptions.find((option) => option.value === category) ||
    adjustmentOptions[0];

  const getOriginalHours = (
    employee: PayrollRecord | undefined,
    category: AdjustmentCategory
  ) => {
    if (!employee) return 0;

    if (category === "overtime") return numberValue(employee.overtimeHours);
    if (category === "nightDifferential") {
      return numberValue(employee.nightDifferentialHours);
    }
    if (category === "absence") return numberValue(employee.absences);
    if (category === "late") return numberValue(employee.lateHours);
    if (category === "undertime") return numberValue(employee.undertimeHours);

    return numberValue(employee.regularHours);
  };

  const getHourlyRate = (employee: PayrollRecord | undefined) => {
    if (!employee) return 0;

    const savedHourlyRate = numberValue(employee.hourlyRate);
    if (savedHourlyRate > 0) return savedHourlyRate;

    const dailyRate = numberValue(employee.dailyRate);
    if (dailyRate > 0) return dailyRate / 8;

    const basicPay = numberValue(employee.basicPay);
    if (basicPay > 0) return basicPay / 22 / 8;

    return 0;
  };

  const computeAmount = (
    category: AdjustmentCategory,
    hours: number,
    rate: number,
    amount: number
  ) => {
    const option = getAdjustmentOption(category);

    if (!option.needsHours) return amount;

    if (category === "overtime") return hours * rate * 1.25;
    if (category === "nightDifferential") return hours * rate * 0.1;

    return hours * rate;
  };

  const addAdjustmentRow = () => {
    if (isEditMode) {
      alert("Only one saved adjustment can be edited at a time.");
      return;
    }
    const firstEmployee = selectedPayrollRecords[0];
    const defaultCategory: AdjustmentCategory = "taxableAllowance";
    const rate = getHourlyRate(firstEmployee);

    setAdjustments((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        employeeId: firstEmployee?.id || "",
        employeeIds: firstEmployee?.id ? [firstEmployee.id] : [],
        adjustmentCategory: defaultCategory,
        hours: 0,
        originalHours: getOriginalHours(firstEmployee, defaultCategory),
        rate,
        amount: 0,
        computedAmount: 0,
        reason: "",
      },
    ]);
  };
  const toggleAdjustmentEmployee = (rowId: string, employeeId: string) => {
    setAdjustments((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const currentEmployeeIds = row.employeeIds?.length
          ? row.employeeIds
          : row.employeeId
          ? [row.employeeId]
          : [];
        const nextEmployeeIds = currentEmployeeIds.includes(employeeId)
          ? currentEmployeeIds.filter((id) => id !== employeeId)
          : [...currentEmployeeIds, employeeId];
        const firstSelectedEmployee = selectedPayrollRecords.find(
          (employee) => employee.id === nextEmployeeIds[0]
        );

        const updatedRow: AdjustmentRow = {
          ...row,
          employeeIds: nextEmployeeIds,
          employeeId: nextEmployeeIds[0] || "",
        };

        if (nextEmployeeIds.length > 0) {
          updatedRow.originalHours = getOriginalHours(firstSelectedEmployee, updatedRow.adjustmentCategory);
          updatedRow.rate = getHourlyRate(firstSelectedEmployee);
        } else {
          updatedRow.originalHours = 0;
          updatedRow.rate = 0;
        }

        updatedRow.computedAmount = computeAmount(
          updatedRow.adjustmentCategory,
          numberValue(updatedRow.hours),
          numberValue(updatedRow.rate),
          numberValue(updatedRow.amount)
        );

        return updatedRow;
      })
    );
  };

  const setAllAdjustmentEmployees = (rowId: string, shouldSelectAll: boolean) => {
    setAdjustments((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const nextEmployeeIds = shouldSelectAll
          ? selectedPayrollRecords.map((employee) => employee.id)
          : [];
        const firstSelectedEmployee = selectedPayrollRecords.find(
          (employee) => employee.id === nextEmployeeIds[0]
        );

        const updatedRow: AdjustmentRow = {
          ...row,
          employeeIds: nextEmployeeIds,
          employeeId: nextEmployeeIds[0] || "",
          originalHours: nextEmployeeIds.length > 0 ? getOriginalHours(firstSelectedEmployee, row.adjustmentCategory) : 0,
          rate: nextEmployeeIds.length > 0 ? getHourlyRate(firstSelectedEmployee) : 0,
        };

        updatedRow.computedAmount = computeAmount(
          updatedRow.adjustmentCategory,
          numberValue(updatedRow.hours),
          numberValue(updatedRow.rate),
          numberValue(updatedRow.amount)
        );

        return updatedRow;
      })
    );
  };

  const updateAdjustment = (
    id: string,
    field: keyof AdjustmentRow,
    value: string | number
  ) => {
    setAdjustments((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        const updatedRow = { ...row, [field]: value } as AdjustmentRow;
        const employee = getEmployeeById(updatedRow.employeeId);
        const option = getAdjustmentOption(updatedRow.adjustmentCategory);

        if (field === "employeeId" || field === "adjustmentCategory") {
          updatedRow.originalHours = getOriginalHours(
            employee,
            updatedRow.adjustmentCategory
          );
          updatedRow.rate = getHourlyRate(employee);

          if (!option.needsHours) {
            updatedRow.hours = 0;
          }
        }

        updatedRow.computedAmount = computeAmount(
          updatedRow.adjustmentCategory,
          numberValue(updatedRow.hours),
          numberValue(updatedRow.rate),
          numberValue(updatedRow.amount)
        );

        return updatedRow;
      })
    );
  };

  const removeAdjustmentRow = (id: string) => {
    setAdjustments((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRemoveSavedAdjustment = async () => {
    if (!isEditMode || !editingAdjustmentId) {
      return;
    }

    const confirmed = window.confirm(
      "Warning: This will permanently remove the saved payroll adjustment from the payroll record and recalculate the adjusted net pay. Continue?"
    );

    if (!confirmed) return;

    const draft = await getConfigItem<SavedPayrollAdjustment | null>(
      storageKeys.payrollAdjustmentEditDraft,
      null
    );

    const adjustmentToRemove = draft || adjustments[0];
    const netPayEffectToRemove = numberValue(
      "netPayEffect" in adjustmentToRemove ? adjustmentToRemove.netPayEffect : 0
    );

    const existingBatches = await getDataArray<any>(storageKeys.payrollAdjustments, []);
    const updatedBatches = existingBatches
      .map((batch: any) => ({
        ...batch,
        adjustments: (batch.adjustments || []).filter(
          (adjustment: SavedPayrollAdjustment) => adjustment.id !== editingAdjustmentId
        ),
      }))
      .filter((batch: any) => (batch.adjustments || []).length > 0);

    await setDataArray(storageKeys.payrollAdjustments, updatedBatches);

    const updatedPayrollRecords = payrollRecords.map((record) => {
      const recordAdjustments = record.payrollAdjustments || [];
      const hasAdjustment = recordAdjustments.some(
        (adjustment) => adjustment.id === editingAdjustmentId
      );

      if (!hasAdjustment) return record;

      const removedAdjustment = recordAdjustments.find(
        (adjustment) => adjustment.id === editingAdjustmentId
      );
      const removedNetPayEffect = numberValue(
        removedAdjustment?.netPayEffect ?? netPayEffectToRemove
      );
      const currentAdjustedNetPay = numberValue(record.adjustedNetPay || record.netPay);
      const nextAdjustedNetPay = currentAdjustedNetPay - removedNetPayEffect;

      return {
        ...record,
        payrollAdjustments: recordAdjustments.filter(
          (adjustment) => adjustment.id !== editingAdjustmentId
        ),
        adjustedNetPay: nextAdjustedNetPay,
      };
    });

    setPayrollRecords(updatedPayrollRecords);
    await setCollectionItems(storageKeys.payrollRecords, updatedPayrollRecords.map(r => ({ ...r, id: r.id })));
    await removeConfigItem(storageKeys.payrollAdjustmentEditDraft);
    window.dispatchEvent(new Event("payroll-records-updated"));
    window.dispatchEvent(new Event("payroll-adjustments-updated"));
    logAudit({ action: "ARCHIVED", entityType: "PayrollRun", entityId: editingAdjustmentId || "adjustment", entityName: `Payroll Adjustment – ${selectedPayroll || ""}`, details: "Payroll adjustment removed" });
    alert("Payroll adjustment removed.");
    router.push("/payroll-records");
  };

  const handleSave = async () => {
    if (isEditMode) {
      if (!editingAdjustmentId) {
        alert("No adjustment selected for editing.");
        return;
      }

      const row = adjustments[0];

      if (!selectedPayroll || !row || !(row.employeeIds?.length || row.employeeId) || row.computedAmount <= 0 || !row.reason.trim()) {
        alert("Please complete employee, amount, and reason before saving.");
        return;
      }

      const confirmed = window.confirm(
        "Are you sure you want to update this payroll adjustment? This will update the adjustment attached to the payroll record."
      );

      if (!confirmed) return;

      const option = getAdjustmentOption(row.adjustmentCategory);
      const employee = getEmployeeById(row.employeeId);
      const newNetPayEffect =
        option.type === "Deduction"
          ? row.computedAmount * -1
          : option.type === "Employer Contribution"
          ? 0
          : row.computedAmount;

      const draft = await getConfigItem<SavedPayrollAdjustment | null>(
        storageKeys.payrollAdjustmentEditDraft,
        null
      );
      const oldNetPayEffect = Number(draft?.netPayEffect || 0);
      const createdAt = draft?.createdAt || new Date().toISOString();

      const updatedAdjustment: SavedPayrollAdjustment = {
        id: editingAdjustmentId,
        adjustmentBatchId: row.adjustmentBatchId || draft?.adjustmentBatchId || `ADJ-${Date.now()}`,
        payrollReference: selectedPayroll,
        employeeId: row.employeeId,
        employeeName: employee?.employeeName || draft?.employeeName || "",
        adjustmentCategory: row.adjustmentCategory,
        adjustmentLabel: option.label,
        adjustmentType: option.type,
        hours: row.hours,
        originalHours: row.originalHours,
        rate: row.rate,
        amount: row.amount,
        finalAmount: row.computedAmount,
        netPayEffect: newNetPayEffect,
        reason: row.reason,
        createdAt,
      };

      const existingBatches = await getDataArray<any>(storageKeys.payrollAdjustments, []);
      const updatedBatches = existingBatches.map((batch: any) => ({
        ...batch,
        adjustments: (batch.adjustments || []).map((adjustment: SavedPayrollAdjustment) =>
          adjustment.id === editingAdjustmentId ? updatedAdjustment : adjustment
        ),
      }));

      await setDataArray(storageKeys.payrollAdjustments, updatedBatches);

      const updatedPayrollRecords = payrollRecords.map((record) => {
        const recordAdjustments = record.payrollAdjustments || [];
        const hasAdjustment = recordAdjustments.some((adjustment) => adjustment.id === editingAdjustmentId);

        if (!hasAdjustment) return record;

        const updatedRecordAdjustments = recordAdjustments.map((adjustment) =>
          adjustment.id === editingAdjustmentId ? updatedAdjustment : adjustment
        );

        const currentAdjustedNetPay = numberValue(record.adjustedNetPay || record.netPay);
        const adjustedNetPay = currentAdjustedNetPay - oldNetPayEffect + newNetPayEffect;

        return {
          ...record,
          payrollAdjustments: updatedRecordAdjustments,
          adjustedNetPay,
        };
      });

      setPayrollRecords(updatedPayrollRecords);
      await setCollectionItems(storageKeys.payrollRecords, updatedPayrollRecords.map(r => ({ ...r, id: r.id })));
      await removeConfigItem(storageKeys.payrollAdjustmentEditDraft);
      window.dispatchEvent(new Event("payroll-records-updated"));
      window.dispatchEvent(new Event("payroll-adjustments-updated"));
      logAudit({ action: "EDITED", entityType: "PayrollRun", entityId: editingAdjustmentId || "adjustment", entityName: `Payroll Adjustment – ${selectedPayroll || ""}`, details: `${updatedAdjustment.adjustmentLabel} for ${updatedAdjustment.employeeName}; Amount: ${updatedAdjustment.finalAmount}` });
      alert("Payroll adjustment updated.");
      router.push("/payroll-records");
      return;
    }

    if (!selectedPayroll) {
      alert("Select payroll first.");
      return;
    }

    if (adjustments.length === 0) {
      alert("Add at least one adjustment.");
      return;
    }

    const invalidRow = adjustments.find(
      (row) => !(row.employeeIds?.length || row.employeeId) || row.computedAmount <= 0 || !row.reason.trim()
    );

    if (invalidRow) {
      alert("Please complete employee, amount, and reason for each adjustment.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to save this payroll adjustment? This will be attached to the selected payroll record and should not be edited casually after saving."
    );

    if (!confirmed) {
      return;
    }

    const adjustmentBatchId = `ADJ-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const savedAdjustments: SavedPayrollAdjustment[] = adjustments.flatMap((row) => {
      const option = getAdjustmentOption(row.adjustmentCategory);
      const selectedEmployeeIds = row.employeeIds?.length ? row.employeeIds : [row.employeeId];

      return selectedEmployeeIds.map((employeeId) => {
        const employee = getEmployeeById(employeeId);
        const employeeRate = option.needsHours ? getHourlyRate(employee) : row.rate;
        const employeeOriginalHours = option.needsHours
          ? getOriginalHours(employee, row.adjustmentCategory)
          : row.originalHours;
        const finalAmount = computeAmount(
          row.adjustmentCategory,
          numberValue(row.hours),
          numberValue(employeeRate),
          numberValue(row.amount)
        );
        const netPayEffect =
          option.type === "Deduction"
            ? finalAmount * -1
            : option.type === "Employer Contribution"
            ? 0
            : finalAmount;

        return {
          id: `${adjustmentBatchId}-${row.id}-${employeeId}`,
          adjustmentBatchId,
          payrollReference: selectedPayroll,
          employeeId,
          employeeName: employee?.employeeName || "",
          adjustmentCategory: row.adjustmentCategory,
          adjustmentLabel: option.label,
          adjustmentType: option.type,
          hours: row.hours,
          originalHours: employeeOriginalHours,
          rate: employeeRate,
          amount: row.amount,
          finalAmount,
          netPayEffect,
          reason: row.reason,
          createdAt,
        };
      });
    });

    const payload = {
      id: adjustmentBatchId,
      payrollReference: selectedPayroll,
      createdAt,
      adjustments: savedAdjustments,
    };

    const existing = await getDataArray<any>(storageKeys.payrollAdjustments, []);

    await setDataArray(storageKeys.payrollAdjustments, [...existing, payload]);

    const updatedPayrollRecords = payrollRecords.map((record) => {
      const recordPayrollReference = `${record.monthYear}-${record.payrollPeriod}`;

      if (recordPayrollReference !== selectedPayroll) {
        return record;
      }

      const recordAdjustments = savedAdjustments.filter(
        (adjustment) => adjustment.employeeId === record.id
      );

      if (recordAdjustments.length === 0) {
        return record;
      }

      const totalNetPayEffect = recordAdjustments.reduce(
        (sum, adjustment) => sum + adjustment.netPayEffect,
        0
      );

      const existingRecordAdjustments = record.payrollAdjustments || [];
      const currentAdjustedNetPay = numberValue(
        record.adjustedNetPay || record.netPay
      );

      return {
        ...record,
        payrollAdjustments: [...existingRecordAdjustments, ...recordAdjustments],
        adjustedNetPay: currentAdjustedNetPay + totalNetPayEffect,
      };
    });

    setPayrollRecords(updatedPayrollRecords);
    await setCollectionItems(storageKeys.payrollRecords, updatedPayrollRecords.map(r => ({ ...r, id: r.id })));
    window.dispatchEvent(new Event("payroll-records-updated"));
    window.dispatchEvent(new Event("payroll-adjustments-updated"));
    logAudit({ action: "CREATED", entityType: "PayrollRun", entityId: adjustmentBatchId, entityName: `Payroll Adjustment – ${selectedPayroll}`, details: `${savedAdjustments.length} adjustment(s) applied` });
    alert("Adjustment saved and attached to the payroll record.");
    setAdjustments([]);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            borderRadius: 32,
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 45%, #020617 100%)",
            color: "#ffffff",
            padding: "34px 36px",
            boxShadow: "0 20px 55px rgba(15, 23, 42, 0.18)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.08)",
              right: -70,
              top: -80,
            }}
          />
          <div style={{ position: "relative", maxWidth: 820 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.12)",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Payroll Operations
            </div>
            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1, fontWeight: 900 }}>
              {isEditMode
                ? "Edit Payroll Adjustment"
                : isYearEndTaxMode
                ? "Year-End Tax Payroll Adjustments"
                : "Payroll Run Adjustments"}
            </h1>
            <p style={{ margin: "12px 0 0", color: "#dbeafe", fontSize: 16, lineHeight: 1.7 }}>
              {isEditMode
                ? "Update the selected payroll adjustment and keep the payroll record aligned with the corrected amount."
                : isYearEndTaxMode
                ? "Review the year-end tax adjustments sent from annualization, choose the target payroll cutoff, then save them to update payroll records."
                : "Select a payroll run, choose an employee, and record payroll corrections with a clear audit trail."}
            </p>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 32,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <label style={{ fontWeight: 700 }}>
            Select Payroll Run <span style={requiredAsteriskStyle}>*</span>
          </label>
          <select
            value={selectedPayroll}
            disabled={isEditMode}
            onChange={(e) => {
              setSelectedPayroll(e.target.value);
              setAdjustments([]);
            }}
            style={{
              display: "block",
              width: "100%",
              maxWidth: 320,
              padding: "12px 14px",
              marginTop: 8,
              border: "1px solid #cbd5e1",
              borderRadius: 16,
              background: "#ffffff",
              color: "#0f172a",
              outline: "none",
            }}
          >
            <option value="">Select payroll</option>
            {payrollRunKeys.map((key) => (
              <option key={key} value={key}>
                {formatPayrollRunKey(key)}
              </option>
            ))}
          </select>
        </div>

        {selectedPayroll && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 32,
              padding: 24,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
              Employees in Payroll
            </h3>

            {selectedPayrollRecords.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No employees found.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f3f4f6" }}>
                      <th style={tableHeaderStyle}>Employee</th>
                      <th style={tableHeaderStyle}>Original Net Pay</th>
                      <th style={tableHeaderStyle}>Adjusted Net Pay</th>
                      <th style={tableHeaderStyle}>Saved Adjustments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPayrollRecords.map((emp, index) => (
                      <tr key={`${emp.id}-${index}`}>
                        <td style={tableCellStyle}>{emp.employeeName}</td>
                        <td style={tableCellStyle}>
                          {peso.format(emp.netPay)}
                        </td>
                        <td style={tableCellStyle}>
                          {emp.adjustedNetPay
                            ? peso.format(emp.adjustedNetPay)
                            : "No adjustment yet"}
                        </td>
                        <td style={tableCellStyle}>
                          {emp.payrollAdjustments?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 32,
            padding: 24,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Adjustment Entries</h3>
              <p style={{ color: "#64748b", margin: "6px 0 0", lineHeight: 1.6 }}>
                Add one or more adjustment rows. Hourly rates are used only in
                the background for hour-based corrections.
              </p>
            </div>

            <button
              onClick={addAdjustmentRow}
              disabled={!selectedPayroll || isEditMode}
              style={{
                padding: "11px 16px",
                background: selectedPayroll && !isEditMode ? "#1d4ed8" : "#94a3b8",
                color: "#ffffff",
                border: "1px solid transparent",
                borderRadius: 14,
                cursor: selectedPayroll && !isEditMode ? "pointer" : "not-allowed",
                fontWeight: 900,
                boxShadow: selectedPayroll && !isEditMode ? "0 1px 2px rgba(15, 23, 42, 0.04)" : "none",
              }}
            >
              {isEditMode ? "Editing One Adjustment" : "+ Add Adjustment"}
            </button>
          </div>

          {adjustments.length === 0 && (
            <div
              style={{
                padding: 18,
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: 20,
                color: "#64748b",
              }}
            >
              No adjustment rows yet. Select payroll first, then click Add
              Adjustment.
            </div>
          )}

          {adjustments.map((row) => {
            const option = getAdjustmentOption(row.adjustmentCategory);
            const selectedEmployeeIds = row.employeeIds?.length ? row.employeeIds : row.employeeId ? [row.employeeId] : [];
            const selectedEmployee = getEmployeeById(selectedEmployeeIds[0] || "");
            const signedAmount =
              option.type === "Deduction"
                ? row.computedAmount * -1
                : option.type === "Employer Contribution"
                ? 0
                : row.computedAmount;

            return (
              <div
                key={row.id}
                style={{
                  marginTop: 16,
                  padding: 18,
                  border: "1px solid #e2e8f0",
                  borderRadius: 24,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div style={{ ...fieldLabelStyle, gridColumn: "1 / -1" }}>
                    <span>Employees <span style={requiredAsteriskStyle}>*</span></span>
                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 18,
                        background: "#ffffff",
                        padding: 12,
                        display: "grid",
                        gap: 10,
                        maxHeight: 230,
                        overflowY: "auto",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 14,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontWeight: 900,
                          cursor: isEditMode ? "not-allowed" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={isEditMode}
                          checked={
                            selectedPayrollRecords.length > 0 &&
                            (row.employeeIds?.length || 0) === selectedPayrollRecords.length
                          }
                          onChange={(event) => setAllAdjustmentEmployees(row.id, event.target.checked)}
                        />
                        Select all employees in this payroll run
                      </label>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {selectedPayrollRecords.map((employee, index) => {
                          const selectedEmployeeIds = row.employeeIds?.length
                            ? row.employeeIds
                            : row.employeeId
                            ? [row.employeeId]
                            : [];
                          const isSelected = selectedEmployeeIds.includes(employee.id);

                          return (
                            <label
                              key={`${employee.id}-${employee.employeeName}-${index}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                border: isSelected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
                                borderRadius: 14,
                                background: isSelected ? "#eff6ff" : "#ffffff",
                                color: "#0f172a",
                                cursor: isEditMode ? "not-allowed" : "pointer",
                                fontWeight: 800,
                              }}
                            >
                              <input
                                type="checkbox"
                                disabled={isEditMode}
                                checked={isSelected}
                                onChange={() => toggleAdjustmentEmployee(row.id, employee.id)}
                              />
                              {employee.employeeName}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                      Selected: {(row.employeeIds?.length || (row.employeeId ? 1 : 0)).toLocaleString()} employee(s)
                    </span>
                  </div>

                  <label style={fieldLabelStyle}>
                    <span>Adjustment Field <span style={requiredAsteriskStyle}>*</span></span>
                    <select
                      value={row.adjustmentCategory}
                      onChange={(e) =>
                        updateAdjustment(
                          row.id,
                          "adjustmentCategory",
                          e.target.value as AdjustmentCategory
                        )
                      }
                      style={fieldStyle}
                    >
                      {adjustmentOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={fieldLabelStyle}>
                    Adjustment Type
                    <input
                      value={option.type}
                      readOnly
                      style={readonlyFieldStyle}
                    />
                  </label>

                  {option.needsHours && (
                    <>
                      <label style={fieldLabelStyle}>
                        <span>Original Hours in Payroll <span style={requiredAsteriskStyle}>*</span></span>
                        <input
                          value={row.originalHours}
                          readOnly
                          style={readonlyFieldStyle}
                        />
                      </label>

                      <label style={fieldLabelStyle}>
                        <span>Adjustment Hours <span style={requiredAsteriskStyle}>*</span></span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.hours}
                          onChange={(e) =>
                            updateAdjustment(
                              row.id,
                              "hours",
                              numberValue(e.target.value)
                            )
                          }
                          style={fieldStyle}
                        />
                      </label>
                    </>
                  )}

                  {!option.needsHours && (
                    <label style={fieldLabelStyle}>
                      <span>{option.amountLabel} <span style={requiredAsteriskStyle}>*</span></span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          updateAdjustment(
                            row.id,
                            "amount",
                            numberValue(e.target.value)
                          )
                        }
                        style={fieldStyle}
                      />
                    </label>
                  )}

                  <label style={fieldLabelStyle}>
                    Final Adjustment Amount
                    <input
                      value={peso.format(row.computedAmount)}
                      readOnly
                      style={readonlyFieldStyle}
                    />
                  </label>

                  <label style={fieldLabelStyle}>
                    <span>Reason <span style={requiredAsteriskStyle}>*</span></span>
                    <input
                      placeholder="Example: missed allowance, late correction"
                      value={row.reason}
                      onChange={(e) =>
                        updateAdjustment(row.id, "reason", e.target.value)
                      }
                      style={fieldStyle}
                    />
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 14,
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {selectedEmployeeIds.length > 1
                      ? `${selectedEmployeeIds.length} employees selected`
                      : selectedEmployee?.employeeName || "No employee selected"}{" "}
                    net pay effect per employee:{" "}
                    {option.type === "Employer Contribution"
                      ? "No net pay effect"
                      : `${signedAmount < 0 ? "-" : "+"}${peso.format(
                          Math.abs(signedAmount)
                        )}`}
                  </div>

                  <button
                    onClick={() => {
                      if (isEditMode) {
                        handleRemoveSavedAdjustment();
                        return;
                      }
                      removeAdjustmentRow(row.id);
                    }}
                    style={{
                      padding: "9px 12px",
                      border: "1px solid #fecaca",
                      color: "#be123c",
                      background: "#fff1f2",
                      borderRadius: 14,
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={handleSave}
            style={{
              padding: "12px 22px",
              background: "#1d4ed8",
              color: "#ffffff",
              border: "1px solid #1d4ed8",
              borderRadius: 14,
              cursor: "pointer",
              fontWeight: 900,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
            }}
          >
            {isEditMode ? "Update Adjustment" : "Save Adjustment"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default function PayrollAdjustmentsPage() {
  return (
    <Suspense>
      <PayrollAdjustmentsPageInner />
    </Suspense>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tableCellStyle: React.CSSProperties = {
  padding: "12px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  fontWeight: 800,
  color: "#334155",
  fontSize: 14,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  outline: "none",
};

const readonlyFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  background: "#f8fafc",
  color: "#475569",
};

const requiredAsteriskStyle: React.CSSProperties = {
  color: "#dc2626",
  fontWeight: 900,
};