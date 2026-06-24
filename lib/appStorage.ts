/** Storage key constants shared across the app. Used as Firestore document IDs. */
export const storageKeys = {
  // Home
  homeAnnouncements: "homeAnnouncements",
  homeHeroBackground: "homeHeroBackground",
  homeCalendarEvents: "homeCalendarEvents",
  appTheme: "appTheme",

  // Company
  companyInformation: "companyInformation",
  statutoryInfo: "payroll.statutorYInfo",
  payrollSettings: "payroll.payrollSettings",
  signatories: "payroll.signatories",

  // Employees
  employees: "employees",
  departments: "departments",

  // Payroll Runs
  payrollRecords: "payrollRecords",
  payrollAdjustments: "payrollAdjustments",
  payrollRunApprovals: "payrollRunApprovals",
  payrollEditDraft: "payrollEditDraft",
  bulkPayrollEditDraft: "bulkPayrollEditDraft",
  payrollAdjustmentEditDraft: "payrollAdjustmentEditDraft",
  deMinimisBenefits: "payroll.deMinimisBenefits",
  standingAllowances: "payroll.standingAllowances",
  payrollLoans: "payroll.loans",

  // Leave Management
  leavePolicies: "leavePolicies",
  leaveConversions: "leaveConversions",

  // Reports
  saved1601CReports: "saved1601CReports",
  saved1604CReports: "saved1604CReports",
  savedAlphalistReports: "savedAlphalistReports",
  coeHistory: "coeHistory",

  // Other
  qboAutomationSavedRecords: "qbo-automation-saved-records-v2",

  // Audit Trail
  auditLogs: "auditLogs",

  // Client Portal
  clientPortalProfile: "clientPortalProfile",
  clientPortalTheme: "clientPortalTheme",

  // Payroll Settings — statutory rates & rules (single source of truth for engine)
  cutoffDefinitions: "payroll.cutoffDefinitions",
  sssConfig: "payroll.sssTable",
  philhealthConfig: "payroll.philhealthConfig",
  pagibigConfig: "payroll.pagibigConfig",
  birConfig: "payroll.birBrackets",
  contributionBasisToggles: "payroll.contributionBasisToggles",
  premiumMultipliers: "payroll.premiumMultipliers",
} as const;
