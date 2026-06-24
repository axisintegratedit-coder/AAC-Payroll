
// Modern Blue Corporate Theme Payroll Settings Page
"use client";

import { useEffect, useMemo, useState } from "react";
import { getConfigItem, setConfigItem, removeConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type PayrollSettings = {
  payrollFrequency: "monthly" | "semi-monthly" | "weekly";
  firstCutoffEnd: string;
  secondCutoffEnd: string;
  thirdCutoffEnd: string;
  fourthCutoffEnd: string;
  payoutRule: string;
  defaultWorkdaysPerMonth: string;

  salaryBasis: "monthly" | "daily" | "hourly";
  dailyRateDivisor: string;
  hourlyRateDivisor: string;
  deductLateUndertime: boolean;
  deductAbsences: boolean;

  enableSSS: boolean;
  enablePhilHealth: boolean;
  enablePagIBIG: boolean;
  enableWithholdingTax: boolean;
  useLatestGovernmentTables: boolean;
  deductionTiming: "every-payroll" | "second-cutoff-only";

  track13thMonth: boolean;
  include1601C: boolean;
  include1604CF: boolean;
};


const defaultForm: PayrollSettings = {
  payrollFrequency: "semi-monthly",
  firstCutoffEnd: "15",
  secondCutoffEnd: "30",
  thirdCutoffEnd: "",
  fourthCutoffEnd: "",
  payoutRule: "Pay on the 15th and last day of the month",
  defaultWorkdaysPerMonth: "22",

  salaryBasis: "monthly",
  dailyRateDivisor: "22",
  hourlyRateDivisor: "8",
  deductLateUndertime: true,
  deductAbsences: true,

  enableSSS: true,
  enablePhilHealth: true,
  enablePagIBIG: true,
  enableWithholdingTax: true,
  useLatestGovernmentTables: true,
  deductionTiming: "every-payroll",

  track13thMonth: true,
  include1601C: true,
  include1604CF: true,
};

const payrollFrequencyLabelMap: Record<PayrollSettings["payrollFrequency"], string> = {
  monthly: "Monthly",
  "semi-monthly": "Semi-Monthly",
  weekly: "Weekly",
};

const deductionTimingLabelMap: Record<PayrollSettings["deductionTiming"], string> = {
  "every-payroll": "Every Payroll",
  "second-cutoff-only": "Second Cutoff Only",
};

const salaryBasisLabelMap: Record<PayrollSettings["salaryBasis"], string> = {
  monthly: "Monthly Salary",
  daily: "Daily Rate",
  hourly: "Hourly Rate",
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

function formatDayOfMonth(value: string) {
  const digits = digitsOnly(value).slice(0, 2);
  if (!digits) return "";
  const number = Number(digits);
  if (Number.isNaN(number)) return "";
  if (number < 1) return "1";
  if (number > 31) return "31";
  return String(number);
}

function formatPositiveNumber(value: string, maxLength = 3) {
  return digitsOnly(value).slice(0, maxLength);
}


function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-black text-slate-700">
      {children} {required ? <span className="text-rose-600">*</span> : null}
    </span>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold leading-5 text-slate-500">{children}</span>;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${props.className || ""}`}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${props.className || ""}`}
    />
  );
}


function Section({
  title,
  helper,
  children,
  accent = "blue",
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
  accent?: "blue" | "emerald" | "amber" | "purple";
}) {
  const accents = {
    blue: "from-blue-600 to-blue-800",
    emerald: "from-emerald-600 to-emerald-800",
    amber: "from-amber-500 to-orange-700",
    purple: "from-purple-600 to-indigo-800",
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
        <div className={`mt-1 h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br ${accents[accent]} shadow-sm`} />
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          {helper ? <p className="mt-1 text-sm leading-6 text-slate-600">{helper}</p> : null}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function ReadonlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 min-h-[24px] break-words text-base font-black text-slate-950">{value || "—"}</p>
    </div>
  );
}

function StatusBadge({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
      Ready
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
      Needs Review
    </span>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-2xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
    >
      {children}
    </button>
  );
}


export default function PayrollSettingsPage() {
  const [form, setForm] = useState<PayrollSettings>(defaultForm);
  const [savedSettings, setSavedSettings] = useState<PayrollSettings | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const isMonthlyPayroll = form.payrollFrequency === "monthly";
  const isSemiMonthlyPayroll = form.payrollFrequency === "semi-monthly";
  const isWeeklyPayroll = form.payrollFrequency === "weekly";

  useEffect(() => {
    async function loadPayrollSettings() {
      try {
        const savedPayrollSettings = await getConfigItem<PayrollSettings | null>(
          storageKeys.payrollSettings,
          null
        );

        if (!savedPayrollSettings) return;

        const normalized: PayrollSettings = {
          ...defaultForm,
          ...savedPayrollSettings,
          thirdCutoffEnd: savedPayrollSettings?.thirdCutoffEnd || "",
          fourthCutoffEnd: savedPayrollSettings?.fourthCutoffEnd || "",
        };

        setForm(normalized);
        setSavedSettings(normalized);
        setIsEditing(false);
      } catch {
        removeConfigItem(storageKeys.payrollSettings);
      }
    }

    loadPayrollSettings();
    window.addEventListener(`${storageKeys.payrollSettings}-updated`, loadPayrollSettings as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.payrollSettings}-updated`, loadPayrollSettings as EventListener);
    };
  }, []);

  const summarySettings = isEditing ? form : savedSettings || form;

  const setupStatus = useMemo(() => {
    const requiredFields: string[] = [
      summarySettings.payrollFrequency,
      summarySettings.firstCutoffEnd,
      summarySettings.salaryBasis,
      summarySettings.dailyRateDivisor,
      summarySettings.hourlyRateDivisor,
    ];

    if (summarySettings.payrollFrequency === "semi-monthly" || summarySettings.payrollFrequency === "weekly") {
      requiredFields.push(summarySettings.secondCutoffEnd);
    }

    if (summarySettings.payrollFrequency === "weekly") {
      requiredFields.push(summarySettings.thirdCutoffEnd, summarySettings.fourthCutoffEnd);
    }

    const completed = requiredFields.filter((value) => String(value || "").trim()).length;
    const total = requiredFields.length;

    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
      complete: completed === total,
    };
  }, [summarySettings]);

  function updateField<K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "payrollFrequency") {
        if (value === "monthly") {
          next.firstCutoffEnd = prev.firstCutoffEnd || "30";
          next.secondCutoffEnd = "";
          next.thirdCutoffEnd = "";
          next.fourthCutoffEnd = "";
          next.payoutRule = "Pay once per month based on the selected payroll end date";
        }

        if (value === "semi-monthly") {
          next.firstCutoffEnd = prev.firstCutoffEnd || "15";
          next.secondCutoffEnd = prev.secondCutoffEnd || "30";
          next.thirdCutoffEnd = "";
          next.fourthCutoffEnd = "";
          next.payoutRule = "Pay on the 15th and last day of the month";
        }

        if (value === "weekly") {
          next.firstCutoffEnd = prev.firstCutoffEnd || "7";
          next.secondCutoffEnd = prev.secondCutoffEnd || "14";
          next.thirdCutoffEnd = prev.thirdCutoffEnd || "21";
          next.fourthCutoffEnd = prev.fourthCutoffEnd || "28";
          next.payoutRule = "Pay every week based on configured weekly cutoff dates";
        }
      }

      return next;
    });
  }

  function handleSave() {
    const requiredFields: Array<[string, string]> = [
      ["Payroll Frequency", form.payrollFrequency],
      ["First Cutoff End Date", form.firstCutoffEnd],
      ["Daily Rate Divisor", form.dailyRateDivisor],
      ["Hourly Rate Divisor", form.hourlyRateDivisor],
    ];

    if (isSemiMonthlyPayroll || isWeeklyPayroll) {
      requiredFields.push(["Second Cutoff End Date", form.secondCutoffEnd]);
    }

    if (isWeeklyPayroll) {
      requiredFields.push(["Third Cutoff End Date", form.thirdCutoffEnd]);
      requiredFields.push(["Fourth Cutoff End Date", form.fourthCutoffEnd]);
    }

    const missing = requiredFields.find(([, value]) => !String(value).trim());
    if (missing) {
      window.alert(`${missing[0]} is required.`);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to save these payroll settings changes? This may affect payroll computations, government deductions, payroll runs, payslips, and reports across the system."
    );

    if (!confirmed) return;

    setConfigItem(storageKeys.payrollSettings, form);
    setSavedSettings(form);
    setIsEditing(false);
    window.dispatchEvent(new Event("payroll-settings-updated"));
    window.alert("Payroll settings saved successfully.");
  }

  function handleEdit() {
    const confirmed = window.confirm(
      "Are you sure you want to edit the payroll settings? Changes may affect payroll computations, government deductions, payroll runs, payslips, and reports across the system."
    );

    if (!confirmed) return;

    if (savedSettings) setForm(savedSettings);
    setIsEditing(true);
  }

  function handleCancel() {
    if (savedSettings) {
      setForm(savedSettings);
      setIsEditing(false);
      return;
    }

    setForm(defaultForm);
  }

  return (
    <main className="min-h-screen pg-bg px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 px-8 py-8 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">Company Settings</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">Payroll Settings</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-blue-100">
                  Set the default payroll cycle, cutoff dates, salary basis, and rate conversion rules used when creating payroll runs.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge complete={setupStatus.complete} />
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white">
                  {setupStatus.percent}% completed
                </span>
              </div>
            </div>
          </div>

        </section>

        {isEditing ? (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <Section title="Payroll Cycle" helper="Set how often payroll is processed and when each cutoff ends." accent="blue">
                <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
                  {isMonthlyPayroll
                    ? "Monthly payroll uses one payroll run per month. Only one payroll end date is needed."
                    : isSemiMonthlyPayroll
                    ? "Semi-monthly payroll uses two cutoffs per month. First and second cutoff end dates are required."
                    : "Weekly payroll uses four weekly cutoff dates in this setup. Weeks can still be adjusted later when payroll is processed."}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-2">
                    <FieldLabel required>Payroll Frequency</FieldLabel>
                    <SelectField
                      value={form.payrollFrequency}
                      onChange={(e) => updateField("payrollFrequency", e.target.value as PayrollSettings["payrollFrequency"])}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="semi-monthly">Semi-Monthly</option>
                      <option value="weekly">Weekly</option>
                    </SelectField>
                    <HelperText>Choose how often payroll will be processed by default.</HelperText>
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel required>
                      {isMonthlyPayroll ? "Payroll End Date" : isSemiMonthlyPayroll ? "First Cutoff End Date" : "Week 1 Cutoff End Date"}
                    </FieldLabel>
                    <InputField
                      required
                      value={form.firstCutoffEnd}
                      onChange={(e) => updateField("firstCutoffEnd", formatDayOfMonth(e.target.value))}
                      placeholder={isMonthlyPayroll ? "30" : isSemiMonthlyPayroll ? "15" : "7"}
                      maxLength={2}
                    />
                    <HelperText>Day of the month when the first payroll cutoff ends.</HelperText>
                  </label>

                  {isSemiMonthlyPayroll || isWeeklyPayroll ? (
                    <label className="grid gap-2">
                      <FieldLabel required>{isSemiMonthlyPayroll ? "Second Cutoff End Date" : "Week 2 Cutoff End Date"}</FieldLabel>
                      <InputField
                        required
                        value={form.secondCutoffEnd}
                        onChange={(e) => updateField("secondCutoffEnd", formatDayOfMonth(e.target.value))}
                        placeholder={isSemiMonthlyPayroll ? "30" : "14"}
                        maxLength={2}
                      />
                      <HelperText>Day of the month when the second payroll cutoff ends.</HelperText>
                    </label>
                  ) : null}

                  {isWeeklyPayroll ? (
                    <label className="grid gap-2">
                      <FieldLabel required>Week 3 Cutoff End Date</FieldLabel>
                      <InputField
                        required
                        value={form.thirdCutoffEnd}
                        onChange={(e) => updateField("thirdCutoffEnd", formatDayOfMonth(e.target.value))}
                        placeholder="21"
                        maxLength={2}
                      />
                      <HelperText>Day of the month when the third weekly cutoff ends.</HelperText>
                    </label>
                  ) : null}

                  {isWeeklyPayroll ? (
                    <label className="grid gap-2">
                      <FieldLabel required>Week 4 Cutoff End Date</FieldLabel>
                      <InputField
                        required
                        value={form.fourthCutoffEnd}
                        onChange={(e) => updateField("fourthCutoffEnd", formatDayOfMonth(e.target.value))}
                        placeholder="28"
                        maxLength={2}
                      />
                      <HelperText>Day of the month when the fourth weekly cutoff ends.</HelperText>
                    </label>
                  ) : null}

                  <label className="grid gap-2">
                    <FieldLabel>Default Payout Rule</FieldLabel>
                    <InputField value={form.payoutRule} onChange={(e) => updateField("payoutRule", e.target.value)} placeholder="Example: Pay every 15th and 30th" />
                    <HelperText>This is shown as guidance when creating payroll runs.</HelperText>
                  </label>
                </div>
              </Section>

              <Section title="Salary Computation Basis" helper="Control the default rate conversion and payroll deductions for time-related items." accent="emerald">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label className="grid gap-2">
                    <FieldLabel required>Salary Basis</FieldLabel>
                    <SelectField value={form.salaryBasis} onChange={(e) => updateField("salaryBasis", e.target.value as PayrollSettings["salaryBasis"])}>
                      <option value="monthly">Monthly Salary</option>
                      <option value="daily">Daily Rate</option>
                      <option value="hourly">Hourly Rate</option>
                    </SelectField>
                    <HelperText>Default basis used when computing employee pay.</HelperText>
                  </label>


                  <label className="grid gap-2">
                    <FieldLabel required>Daily Rate Divisor</FieldLabel>
                    <InputField
                      required
                      value={form.dailyRateDivisor}
                      onChange={(e) => updateField("dailyRateDivisor", formatPositiveNumber(e.target.value))}
                      placeholder="22"
                      maxLength={3}
                    />
                    <HelperText>This is used to compute daily rate from monthly salary.</HelperText>
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel required>Hourly Rate Divisor</FieldLabel>
                    <InputField
                      required
                      value={form.hourlyRateDivisor}
                      onChange={(e) => updateField("hourlyRateDivisor", formatPositiveNumber(e.target.value, 2))}
                      placeholder="8"
                      maxLength={2}
                    />
                    <HelperText>Daily rate divided by this number to get hourly rate.</HelperText>
                  </label>
                </div>

              </Section>
            </div>

            <aside className="space-y-6">


              <Section title="Save Changes" helper="Review carefully because changes affect payroll computation." accent="amber">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                    Payroll settings are system-wide. Save only when cutoff dates and computation basis are verified.
                  </div>
                  <div className="flex flex-col gap-3">
                    <PrimaryButton type="button" onClick={handleSave}>Save Payroll Settings</PrimaryButton>
                    <SecondaryButton type="button" onClick={handleCancel}>Cancel</SecondaryButton>
                  </div>
                </div>
              </Section>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            <Section title="Payroll Cycle" helper="Saved payroll schedule and cutoff defaults." accent="blue">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReadonlyBox label="Payroll Frequency" value={payrollFrequencyLabelMap[summarySettings.payrollFrequency]} />
                <ReadonlyBox label={summarySettings.payrollFrequency === "monthly" ? "Payroll End Date" : "First Cutoff End Date"} value={summarySettings.firstCutoffEnd} />
                {(summarySettings.payrollFrequency === "semi-monthly" || summarySettings.payrollFrequency === "weekly") ? (
                  <ReadonlyBox label={summarySettings.payrollFrequency === "weekly" ? "Week 2 Cutoff End Date" : "Second Cutoff End Date"} value={summarySettings.secondCutoffEnd} />
                ) : null}
                {summarySettings.payrollFrequency === "weekly" ? <ReadonlyBox label="Week 3 Cutoff End Date" value={summarySettings.thirdCutoffEnd} /> : null}
                {summarySettings.payrollFrequency === "weekly" ? <ReadonlyBox label="Week 4 Cutoff End Date" value={summarySettings.fourthCutoffEnd} /> : null}
                <ReadonlyBox label="Payout Rule" value={summarySettings.payoutRule} />
              </div>
            </Section>

            <div className="grid gap-6">
              <Section title="Salary Computation Basis" helper="Saved rate conversion and time deduction settings." accent="emerald">
                <div className="grid gap-4 md:grid-cols-2">
                  <ReadonlyBox label="Salary Basis" value={salaryBasisLabelMap[summarySettings.salaryBasis]} />
                  <ReadonlyBox label="Daily Rate Divisor" value={summarySettings.dailyRateDivisor} />
                  <ReadonlyBox label="Hourly Rate Divisor" value={summarySettings.hourlyRateDivisor} />
                </div>
              </Section>
            </div>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Payroll settings are locked for review</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Super users can edit payroll settings when cutoff or computation rules change.
                  </p>
                </div>
                <PrimaryButton type="button" onClick={handleEdit}>Edit Payroll Settings</PrimaryButton>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}