/**
 * Types and seeded defaults for the Payroll Settings page.
 * All values are stored in Firestore and read by the payroll engine at run time.
 * NEVER hardcode these elsewhere — the engine must always read from Firestore.
 */

// ─── Cutoff Definitions ───────────────────────────────────────────────────────

export type CutoffDefinition = {
  id: string;
  label: string;
  coverageStartRule: string;
  coverageEndRule: string;
};

export const SEED_CUTOFF_DEFINITIONS: CutoffDefinition[] = [
  {
    id: "15th",
    label: "15th",
    coverageStartRule: "21st of prior month",
    coverageEndRule: "5th of current month",
  },
  {
    id: "30th/31st",
    label: "30th/31st",
    coverageStartRule: "6th of current month",
    coverageEndRule: "20th of current month",
  },
];

// ─── SSS ─────────────────────────────────────────────────────────────────────

export type SSSBracketRow = {
  id: string;
  rangeLabel: string;
  msc: number;
  employeeContrib: number;
  employerContrib: number;
  ec: number;
  wisp: number;
  totalMonthlyContrib: number;
};

export type SSSConfig = {
  globalFloor: number;
  globalCeiling: number;
  employeeRate: number;
  employerRate: number;
  ecThreshold: number;
  ecBelow: number;
  ecAtOrAbove: number;
  wispThreshold: number;
  brackets: SSSBracketRow[];
  disclaimer: string;
};

// Full 2024 SSS MSC bracket table (exact lookup, no interpolation).
// Source: SSS Circular No. 2023-010 (effective Jan 2024).
// ⚠ Verify against the current official SSS table before go-live.
export const SEED_SSS_CONFIG: SSSConfig = {
  globalFloor: 5000,
  globalCeiling: 35000,
  employeeRate: 0.05,
  employerRate: 0.10,
  ecThreshold: 15000,
  ecBelow: 10,
  ecAtOrAbove: 30,
  wispThreshold: 20000,
  disclaimer: "⚠ Verify against the current official SSS circular before go-live.",
  brackets: [
    // id = msc value as string for Firestore doc stability
    { id: "5250",  rangeLabel: "5,000 – 5,499.99",       msc: 5250,  employeeContrib: 247.50,  employerContrib: 495.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 752.50  },
    { id: "5750",  rangeLabel: "5,500 – 5,999.99",       msc: 5750,  employeeContrib: 270.00,  employerContrib: 540.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 820.00  },
    { id: "6250",  rangeLabel: "6,000 – 6,499.99",       msc: 6250,  employeeContrib: 292.50,  employerContrib: 585.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 887.50  },
    { id: "6750",  rangeLabel: "6,500 – 6,999.99",       msc: 6750,  employeeContrib: 315.00,  employerContrib: 630.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 955.00  },
    { id: "7250",  rangeLabel: "7,000 – 7,499.99",       msc: 7250,  employeeContrib: 337.50,  employerContrib: 675.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1022.50 },
    { id: "7750",  rangeLabel: "7,500 – 7,999.99",       msc: 7750,  employeeContrib: 360.00,  employerContrib: 720.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1090.00 },
    { id: "8250",  rangeLabel: "8,000 – 8,499.99",       msc: 8250,  employeeContrib: 382.50,  employerContrib: 765.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1157.50 },
    { id: "8750",  rangeLabel: "8,500 – 8,999.99",       msc: 8750,  employeeContrib: 405.00,  employerContrib: 810.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1225.00 },
    { id: "9250",  rangeLabel: "9,000 – 9,499.99",       msc: 9250,  employeeContrib: 427.50,  employerContrib: 855.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1292.50 },
    { id: "9750",  rangeLabel: "9,500 – 9,999.99",       msc: 9750,  employeeContrib: 450.00,  employerContrib: 900.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1360.00 },
    { id: "10250", rangeLabel: "10,000 – 10,499.99",     msc: 10250, employeeContrib: 472.50,  employerContrib: 945.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1427.50 },
    { id: "10750", rangeLabel: "10,500 – 10,999.99",     msc: 10750, employeeContrib: 495.00,  employerContrib: 990.00,  ec: 10, wisp: 0,      totalMonthlyContrib: 1495.00 },
    { id: "11250", rangeLabel: "11,000 – 11,499.99",     msc: 11250, employeeContrib: 517.50,  employerContrib: 1035.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1562.50 },
    { id: "11750", rangeLabel: "11,500 – 11,999.99",     msc: 11750, employeeContrib: 540.00,  employerContrib: 1080.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1630.00 },
    { id: "12250", rangeLabel: "12,000 – 12,499.99",     msc: 12250, employeeContrib: 562.50,  employerContrib: 1125.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1697.50 },
    { id: "12750", rangeLabel: "12,500 – 12,999.99",     msc: 12750, employeeContrib: 585.00,  employerContrib: 1170.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1765.00 },
    { id: "13250", rangeLabel: "13,000 – 13,499.99",     msc: 13250, employeeContrib: 607.50,  employerContrib: 1215.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1832.50 },
    { id: "13750", rangeLabel: "13,500 – 13,999.99",     msc: 13750, employeeContrib: 630.00,  employerContrib: 1260.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1900.00 },
    { id: "14250", rangeLabel: "14,000 – 14,499.99",     msc: 14250, employeeContrib: 652.50,  employerContrib: 1305.00, ec: 10, wisp: 0,      totalMonthlyContrib: 1967.50 },
    { id: "14750", rangeLabel: "14,500 – 14,999.99",     msc: 14750, employeeContrib: 675.00,  employerContrib: 1350.00, ec: 10, wisp: 0,      totalMonthlyContrib: 2035.00 },
    { id: "15250", rangeLabel: "15,000 – 15,499.99",     msc: 15250, employeeContrib: 697.50,  employerContrib: 1395.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2122.50 },
    { id: "15750", rangeLabel: "15,500 – 15,999.99",     msc: 15750, employeeContrib: 720.00,  employerContrib: 1440.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2190.00 },
    { id: "16250", rangeLabel: "16,000 – 16,499.99",     msc: 16250, employeeContrib: 742.50,  employerContrib: 1485.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2257.50 },
    { id: "16750", rangeLabel: "16,500 – 16,999.99",     msc: 16750, employeeContrib: 765.00,  employerContrib: 1530.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2325.00 },
    { id: "17250", rangeLabel: "17,000 – 17,499.99",     msc: 17250, employeeContrib: 787.50,  employerContrib: 1575.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2392.50 },
    { id: "17750", rangeLabel: "17,500 – 17,999.99",     msc: 17750, employeeContrib: 810.00,  employerContrib: 1620.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2460.00 },
    { id: "18250", rangeLabel: "18,000 – 18,499.99",     msc: 18250, employeeContrib: 832.50,  employerContrib: 1665.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2527.50 },
    { id: "18750", rangeLabel: "18,500 – 18,999.99",     msc: 18750, employeeContrib: 855.00,  employerContrib: 1710.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2595.00 },
    { id: "19250", rangeLabel: "19,000 – 19,499.99",     msc: 19250, employeeContrib: 877.50,  employerContrib: 1755.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2662.50 },
    { id: "19750", rangeLabel: "19,500 – 19,999.99",     msc: 19750, employeeContrib: 900.00,  employerContrib: 1800.00, ec: 30, wisp: 0,      totalMonthlyContrib: 2730.00 },
    { id: "20250", rangeLabel: "20,000 – 20,499.99",     msc: 20250, employeeContrib: 922.50,  employerContrib: 1845.00, ec: 30, wisp: 22.50,  totalMonthlyContrib: 2820.00 },
    { id: "20750", rangeLabel: "20,500 – 20,999.99",     msc: 20750, employeeContrib: 945.00,  employerContrib: 1890.00, ec: 30, wisp: 45.00,  totalMonthlyContrib: 2910.00 },
    { id: "21250", rangeLabel: "21,000 – 21,499.99",     msc: 21250, employeeContrib: 967.50,  employerContrib: 1935.00, ec: 30, wisp: 67.50,  totalMonthlyContrib: 3000.00 },
    { id: "21750", rangeLabel: "21,500 – 21,999.99",     msc: 21750, employeeContrib: 990.00,  employerContrib: 1980.00, ec: 30, wisp: 90.00,  totalMonthlyContrib: 3090.00 },
    { id: "22250", rangeLabel: "22,000 – 22,499.99",     msc: 22250, employeeContrib: 1012.50, employerContrib: 2025.00, ec: 30, wisp: 112.50, totalMonthlyContrib: 3180.00 },
    { id: "22750", rangeLabel: "22,500 – 22,999.99",     msc: 22750, employeeContrib: 1035.00, employerContrib: 2070.00, ec: 30, wisp: 135.00, totalMonthlyContrib: 3270.00 },
    { id: "23250", rangeLabel: "23,000 – 23,499.99",     msc: 23250, employeeContrib: 1057.50, employerContrib: 2115.00, ec: 30, wisp: 157.50, totalMonthlyContrib: 3360.00 },
    { id: "23750", rangeLabel: "23,500 – 23,999.99",     msc: 23750, employeeContrib: 1080.00, employerContrib: 2160.00, ec: 30, wisp: 180.00, totalMonthlyContrib: 3450.00 },
    { id: "24250", rangeLabel: "24,000 – 24,499.99",     msc: 24250, employeeContrib: 1102.50, employerContrib: 2205.00, ec: 30, wisp: 202.50, totalMonthlyContrib: 3540.00 },
    { id: "24750", rangeLabel: "24,500 – 24,999.99",     msc: 24750, employeeContrib: 1125.00, employerContrib: 2250.00, ec: 30, wisp: 225.00, totalMonthlyContrib: 3630.00 },
    { id: "25250", rangeLabel: "25,000 – 25,499.99",     msc: 25250, employeeContrib: 1147.50, employerContrib: 2295.00, ec: 30, wisp: 247.50, totalMonthlyContrib: 3720.00 },
    { id: "25750", rangeLabel: "25,500 – 25,999.99",     msc: 25750, employeeContrib: 1170.00, employerContrib: 2340.00, ec: 30, wisp: 270.00, totalMonthlyContrib: 3810.00 },
    { id: "26250", rangeLabel: "26,000 – 26,499.99",     msc: 26250, employeeContrib: 1192.50, employerContrib: 2385.00, ec: 30, wisp: 292.50, totalMonthlyContrib: 3900.00 },
    { id: "26750", rangeLabel: "26,500 – 26,999.99",     msc: 26750, employeeContrib: 1215.00, employerContrib: 2430.00, ec: 30, wisp: 315.00, totalMonthlyContrib: 3990.00 },
    { id: "27250", rangeLabel: "27,000 – 27,499.99",     msc: 27250, employeeContrib: 1237.50, employerContrib: 2475.00, ec: 30, wisp: 337.50, totalMonthlyContrib: 4080.00 },
    { id: "27750", rangeLabel: "27,500 – 27,999.99",     msc: 27750, employeeContrib: 1260.00, employerContrib: 2520.00, ec: 30, wisp: 360.00, totalMonthlyContrib: 4170.00 },
    { id: "28250", rangeLabel: "28,000 – 28,499.99",     msc: 28250, employeeContrib: 1282.50, employerContrib: 2565.00, ec: 30, wisp: 382.50, totalMonthlyContrib: 4260.00 },
    { id: "28750", rangeLabel: "28,500 – 28,999.99",     msc: 28750, employeeContrib: 1305.00, employerContrib: 2610.00, ec: 30, wisp: 405.00, totalMonthlyContrib: 4350.00 },
    { id: "29250", rangeLabel: "29,000 – 29,499.99",     msc: 29250, employeeContrib: 1327.50, employerContrib: 2655.00, ec: 30, wisp: 427.50, totalMonthlyContrib: 4440.00 },
    { id: "29750", rangeLabel: "29,500 – 29,999.99",     msc: 29750, employeeContrib: 1350.00, employerContrib: 2700.00, ec: 30, wisp: 450.00, totalMonthlyContrib: 4530.00 },
    { id: "30250", rangeLabel: "30,000 – 30,499.99",     msc: 30250, employeeContrib: 1372.50, employerContrib: 2745.00, ec: 30, wisp: 472.50, totalMonthlyContrib: 4620.00 },
    { id: "30750", rangeLabel: "30,500 – 30,999.99",     msc: 30750, employeeContrib: 1395.00, employerContrib: 2790.00, ec: 30, wisp: 495.00, totalMonthlyContrib: 4710.00 },
    { id: "31250", rangeLabel: "31,000 – 31,499.99",     msc: 31250, employeeContrib: 1417.50, employerContrib: 2835.00, ec: 30, wisp: 517.50, totalMonthlyContrib: 4800.00 },
    { id: "31750", rangeLabel: "31,500 – 31,999.99",     msc: 31750, employeeContrib: 1440.00, employerContrib: 2880.00, ec: 30, wisp: 540.00, totalMonthlyContrib: 4890.00 },
    { id: "32250", rangeLabel: "32,000 – 32,499.99",     msc: 32250, employeeContrib: 1462.50, employerContrib: 2925.00, ec: 30, wisp: 562.50, totalMonthlyContrib: 4980.00 },
    { id: "32750", rangeLabel: "32,500 – 32,999.99",     msc: 32750, employeeContrib: 1485.00, employerContrib: 2970.00, ec: 30, wisp: 585.00, totalMonthlyContrib: 5070.00 },
    { id: "33250", rangeLabel: "33,000 – 33,499.99",     msc: 33250, employeeContrib: 1507.50, employerContrib: 3015.00, ec: 30, wisp: 607.50, totalMonthlyContrib: 5160.00 },
    { id: "33750", rangeLabel: "33,500 – 33,999.99",     msc: 33750, employeeContrib: 1530.00, employerContrib: 3060.00, ec: 30, wisp: 630.00, totalMonthlyContrib: 5250.00 },
    { id: "34250", rangeLabel: "34,000 – 34,499.99",     msc: 34250, employeeContrib: 1552.50, employerContrib: 3105.00, ec: 30, wisp: 652.50, totalMonthlyContrib: 5340.00 },
    { id: "34750", rangeLabel: "34,500 – 34,999.99",     msc: 34750, employeeContrib: 1575.00, employerContrib: 3150.00, ec: 30, wisp: 675.00, totalMonthlyContrib: 5430.00 },
    { id: "35000", rangeLabel: "35,000 and above",       msc: 35000, employeeContrib: 1597.50, employerContrib: 3195.00, ec: 30, wisp: 697.50, totalMonthlyContrib: 5520.00 },
  ],
};

// ─── PhilHealth ───────────────────────────────────────────────────────────────

export type PhilHealthConfig = {
  rate: number;
  floor: number;
  ceiling: number;
  minMonthly: number;
  maxMonthly: number;
  employeeSplit: number;
  employerSplit: number;
  disclaimer: string;
};

export const SEED_PHILHEALTH_CONFIG: PhilHealthConfig = {
  rate: 0.05,
  floor: 10000,
  ceiling: 100000,
  minMonthly: 500,
  maxMonthly: 5000,
  employeeSplit: 0.5,
  employerSplit: 0.5,
  disclaimer: "⚠ Verify against the current PhilHealth circular before go-live.",
};

// ─── Pag-IBIG / HDMF ─────────────────────────────────────────────────────────

export type PagIBIGConfig = {
  employeeRate: number;
  employerRate: number;
  maxFundSalary: number;
  monthlyCapEmployee: number;
  monthlyCapEmployer: number;
  semiMonthlyCap: number;
  lowSalaryCeiling: number;
  lowSalaryEmployeeRate: number;
  disclaimer: string;
};

export const SEED_PAGIBIG_CONFIG: PagIBIGConfig = {
  employeeRate: 0.02,
  employerRate: 0.02,
  maxFundSalary: 10000,
  monthlyCapEmployee: 200,
  monthlyCapEmployer: 200,
  semiMonthlyCap: 100,
  lowSalaryCeiling: 1500,
  lowSalaryEmployeeRate: 0.01,
  disclaimer: "⚠ Verify against the current Pag-IBIG circular before go-live.",
};

// ─── BIR Withholding Tax ─────────────────────────────────────────────────────

export type BIRBracketRow = {
  id: string;
  label: string;
  incomeFloor: number;
  incomeCeiling: number | null;
  baseTax: number;
  excessRate: number;
};

export type BIRConfig = {
  frequency: "semi-monthly";
  brackets: BIRBracketRow[];
  disclaimer: string;
};

// TRAIN Law Revised Withholding Tax — semi-monthly schedule (effective 2023+).
// ⚠ Verify against the current BIR RWT table before go-live.
export const SEED_BIR_CONFIG: BIRConfig = {
  frequency: "semi-monthly",
  disclaimer: "⚠ Verify against the current BIR Revised Withholding Tax table before go-live.",
  brackets: [
    {
      id: "bir-1",
      label: "Up to ₱10,417",
      incomeFloor: 0,
      incomeCeiling: 10417,
      baseTax: 0,
      excessRate: 0,
    },
    {
      id: "bir-2",
      label: "Over ₱10,417 up to ₱16,667",
      incomeFloor: 10417,
      incomeCeiling: 16667,
      baseTax: 0,
      excessRate: 0.15,
    },
    {
      id: "bir-3",
      label: "Over ₱16,667 up to ₱33,333",
      incomeFloor: 16667,
      incomeCeiling: 33333,
      baseTax: 937.50,
      excessRate: 0.20,
    },
    {
      id: "bir-4",
      label: "Over ₱33,333 up to ₱83,333",
      incomeFloor: 33333,
      incomeCeiling: 83333,
      baseTax: 4270.83,
      excessRate: 0.25,
    },
    {
      id: "bir-5",
      label: "Over ₱83,333 up to ₱333,333",
      incomeFloor: 83333,
      incomeCeiling: 333333,
      baseTax: 16770.83,
      excessRate: 0.30,
    },
    {
      id: "bir-6",
      label: "Over ₱333,333",
      incomeFloor: 333333,
      incomeCeiling: null,
      baseTax: 91770.83,
      excessRate: 0.35,
    },
  ],
};

// ─── Contribution Basis Toggles ───────────────────────────────────────────────

export type ContributionBasisToggles = {
  sssBasedOnNetBasicPay: boolean;
  philhealthBasedOnGrossBasicPay: boolean;
  hdmfFixed: boolean;
  hdmfFixedMonthlyAmount: number;
  hdmfFixedCutoffAmount: number;
};

export const SEED_CONTRIBUTION_BASIS_TOGGLES: ContributionBasisToggles = {
  sssBasedOnNetBasicPay: true,
  philhealthBasedOnGrossBasicPay: true,
  hdmfFixed: true,
  hdmfFixedMonthlyAmount: 200,
  hdmfFixedCutoffAmount: 100,
};

// ─── Premium Multipliers ──────────────────────────────────────────────────────

export type PremiumMultiplierRow = {
  id: string;
  bucket: string;
  baseMultiplier: number;
  ndMultiplier: number;
  finalMultiplier: number;
  notes: string;
};

export type PremiumMultipliersConfig = {
  ndStackingMethod: "multiplicative" | "additive";
  rows: PremiumMultiplierRow[];
  disclaimer: string;
};

const ND_MULTIPLIER = 1.1;

function premiumRow(bucket: string, baseMultiplier: number, hasNightDifferential: boolean, notes: string): PremiumMultiplierRow {
  const ndMultiplier = hasNightDifferential ? ND_MULTIPLIER : 1;
  return {
    id: bucket,
    bucket,
    baseMultiplier,
    ndMultiplier,
    finalMultiplier: Number((baseMultiplier * ndMultiplier).toFixed(4)),
    notes,
  };
}

// DOLE base multipliers per Labor Code + ND x1.10.
// finalMultiplier = baseMultiplier × ndMultiplier (multiplicative method default).
// ⚠ Verify against the client's contractual rates before go-live.
export const SEED_PREMIUM_MULTIPLIERS: PremiumMultipliersConfig = {
  ndStackingMethod: "multiplicative",
  disclaimer: "⚠ Verify against the client's contractual rates and DOLE regulations before go-live.",
  rows: [
    premiumRow("Ord-OT", 1.25, false, "Ordinary overtime"),
    premiumRow("Ord-ND", 1.00, true, "Ordinary night differential"),
    premiumRow("Ord-ND-OT", 1.25, true, "Ordinary overtime + night differential"),
    premiumRow("RD", 1.30, false, "Rest day"),
    premiumRow("RD-OT", 1.69, false, "Rest day overtime"),
    premiumRow("RD-ND", 1.30, true, "Rest day + night differential"),
    premiumRow("RD-ND-OT", 1.69, true, "Rest day overtime + night differential"),
    premiumRow("SH", 1.30, false, "Special holiday"),
    premiumRow("SH-OT", 1.69, false, "Special holiday overtime"),
    premiumRow("SH-ND", 1.30, true, "Special holiday + night differential"),
    premiumRow("SH-ND-OT", 1.69, true, "Special holiday overtime + night differential"),
    premiumRow("LH", 2.00, false, "Legal holiday"),
    premiumRow("LH-OT", 2.60, false, "Legal holiday overtime"),
    premiumRow("LH-ND", 2.00, true, "Legal holiday + night differential"),
    premiumRow("LH-ND-OT", 2.60, true, "Legal holiday overtime + night differential"),
    premiumRow("SH-RD", 1.50, false, "Special holiday on rest day"),
    premiumRow("SH-RD-OT", 1.95, false, "Special holiday on rest day overtime"),
    premiumRow("SH-RD-ND", 1.50, true, "Special holiday on rest day + night differential"),
    premiumRow("SH-RD-ND-OT", 1.95, true, "Special holiday on rest day overtime + night differential"),
    premiumRow("LH-RD", 2.60, false, "Legal holiday on rest day"),
    premiumRow("LH-RD-OT", 3.38, false, "Legal holiday on rest day overtime"),
    premiumRow("LH-RD-ND", 2.60, true, "Legal holiday on rest day + night differential"),
    premiumRow("LH-RD-ND-OT", 3.38, true, "Legal holiday on rest day overtime + night differential"),
    premiumRow("DH", 3.00, false, "Double holiday"),
    premiumRow("DH-ND", 3.00, true, "Double holiday + night differential"),
    premiumRow("DH-RD", 3.90, false, "Double holiday on rest day"),
    premiumRow("DH-RD-ND", 3.90, true, "Double holiday on rest day + night differential"),
    premiumRow("DH-OT", 3.90, false, "Double holiday overtime"),
    premiumRow("DH-ND-OT", 3.90, true, "Double holiday overtime + night differential"),
    premiumRow("DH-RD-OT", 5.07, false, "Double holiday on rest day overtime"),
    premiumRow("DH-RD-ND-OT", 5.07, true, "Double holiday on rest day overtime + night differential"),
  ],
};
