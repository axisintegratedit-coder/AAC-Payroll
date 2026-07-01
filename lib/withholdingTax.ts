// BIR withholding-tax brackets by payroll frequency (TRAIN law). Extracted so both the payroll
// engine and the settings-driven recompute use the exact same math (no duplication drift).
export function computeWithholdingTaxByFrequency(taxableIncome: number, payrollFrequency: string): number {
  const taxablePay = Math.max(Number(taxableIncome) || 0, 0);
  const normalizedFrequency = String(payrollFrequency || "").toLowerCase();

  if (normalizedFrequency.includes("weekly")) {
    if (taxablePay <= 4808) return 0;
    if (taxablePay <= 7691) return (taxablePay - 4808) * 0.15;
    if (taxablePay <= 15384) return 432.6 + (taxablePay - 7692) * 0.2;
    if (taxablePay <= 38461) return 1971.2 + (taxablePay - 15385) * 0.25;
    if (taxablePay <= 153845) return 7740.45 + (taxablePay - 38462) * 0.3;
    return 42355.65 + (taxablePay - 153846) * 0.35;
  }

  if (normalizedFrequency.includes("semi")) {
    if (taxablePay <= 10417) return 0;
    if (taxablePay <= 16666) return (taxablePay - 10417) * 0.15;
    if (taxablePay <= 33332) return 937.5 + (taxablePay - 16667) * 0.2;
    if (taxablePay <= 83332) return 4270.7 + (taxablePay - 33333) * 0.25;
    if (taxablePay <= 333332) return 16770.7 + (taxablePay - 83333) * 0.3;
    return 91770.7 + (taxablePay - 333333) * 0.35;
  }

  if (taxablePay <= 20833) return 0;
  if (taxablePay <= 33332) return (taxablePay - 20833) * 0.15;
  if (taxablePay <= 66666) return 1875 + (taxablePay - 33333) * 0.2;
  if (taxablePay <= 166666) return 8541.8 + (taxablePay - 66667) * 0.25;
  if (taxablePay <= 666666) return 33541.8 + (taxablePay - 166667) * 0.3;
  return 183541.8 + (taxablePay - 666667) * 0.35;
}
