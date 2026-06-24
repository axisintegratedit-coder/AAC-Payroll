"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  Pencil,
  Save,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { getConfigItem, setConfigItem, removeConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type StatutoryInfo = {
  companyTin: string;
  rdoCode: string;
  birContactEmail: string;

  sssEmployerNo: string;
  sssDateOfCoverage: string;
  sssContactPerson: string;
  sssContactEmail: string;

  philhealthEmployerNo: string;
  philhealthContactNumber: string;
  philhealthEmail: string;
  philhealthPostalCode: string;

  pagibigEmployerNo: string;
  pagibigBranchCode: string;
  pagibigContactPerson: string;
  pagibigContactEmail: string;

  include1601C: boolean;
  include1604CF: boolean;
};


const defaultForm: StatutoryInfo = {
  companyTin: "",
  rdoCode: "",
  birContactEmail: "",

  sssEmployerNo: "",
  sssDateOfCoverage: "",
  sssContactPerson: "",
  sssContactEmail: "",

  philhealthEmployerNo: "",
  philhealthContactNumber: "",
  philhealthEmail: "",
  philhealthPostalCode: "",

  pagibigEmployerNo: "",
  pagibigBranchCode: "",
  pagibigContactPerson: "",
  pagibigContactEmail: "",

  include1601C: true,
  include1604CF: true,
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0a4f8f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] transition hover:-translate-y-0.5 hover:bg-[#073c6d] focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const subtlePanelClassName =
  "relative overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_24px_70px_-44px_rgba(8,47,73,0.75)] ring-1 ring-slate-900/[0.04] backdrop-blur";
const techGridStyle = {
  backgroundImage:
    "linear-gradient(rgba(56, 189, 248, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.16) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

function formatTin(value: string) {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatRdoCode(value: string) {
  return digitsOnly(value).slice(0, 3);
}

function formatEmployerNumber(value: string) {
  return digitsOnly(value).slice(0, 12);
}

function formatPostalCode(value: string) {
  return digitsOnly(value).slice(0, 4);
}

function formatBranchCode(value: string) {
  return digitsOnly(value).slice(0, 4);
}

function formatPhoneNumber(value: string) {
  return value.replace(/[^\d+\-()\s]/g, "").slice(0, 20);
}

function agencyProgress(values: string[]) {
  const completed = values.filter((value) => value.trim().length > 0).length;
  const total = values.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    complete: completed === total,
  };
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-slate-700">
      {children} {required ? <span className="text-rose-600">*</span> : null}
    </span>
  );
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputClassName} ${props.className || ""}`}
    />
  );
}

function CheckboxCard({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_36px_-30px_rgba(8,47,73,0.72)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 accent-[#0a4f8f]"
      />
      <span>
        <span className="block text-sm font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{helper}</span>
      </span>
    </label>
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
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    emerald: "border-cyan-100 bg-cyan-50 text-cyan-700",
    amber: "border-sky-100 bg-sky-50 text-[#0a4f8f]",
    purple: "border-blue-100 bg-blue-50 text-blue-700",
  };

  return (
    <section className={`${subtlePanelClassName} p-5`}>
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
      <div className="mb-4 flex items-start gap-3 border-b border-slate-200 pb-4">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accents[accent]}`}>
          <FileText className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          {helper ? <p className="mt-1 max-w-2xl text-xs font-medium uppercase tracking-wide text-slate-500">{helper}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ReadonlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_16px_36px_-30px_rgba(8,47,73,0.72)] transition hover:-translate-y-0.5 hover:border-sky-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 min-h-6 break-words text-sm font-semibold text-slate-950">{value || "—"}</p>
    </div>
  );
}

function StatusBadge({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-[#0a4f8f]">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      Complete
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
      Needs Review
    </span>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${primaryButtonClassName} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${secondaryButtonClassName} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gradient-to-r from-[#0a4f8f] to-cyan-400 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function AgencyCard({
  title,
  helper,
  progress,
  accent,
}: {
  title: string;
  helper: string;
  progress: ReturnType<typeof agencyProgress>;
  accent: "blue" | "emerald" | "amber" | "purple";
}) {
  const styles = {
    blue: "border-sky-100 bg-white text-[#0b2742]",
    emerald: "border-cyan-100 bg-white text-[#0b2742]",
    amber: "border-sky-100 bg-white text-[#0b2742]",
    purple: "border-blue-100 bg-white text-[#0b2742]",
  };
  const iconStyles = {
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    emerald: "border-cyan-100 bg-cyan-50 text-cyan-700",
    amber: "border-sky-100 bg-sky-50 text-[#0a4f8f]",
    purple: "border-blue-100 bg-blue-50 text-blue-700",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_18px_44px_-34px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-200 ${styles[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconStyles[accent]}`}>
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-950">{title}</p>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{helper}</p>
          </div>
        </div>
        <StatusBadge complete={progress.complete} />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{progress.completed}/{progress.total} fields</span>
        <span>{progress.percent}%</span>
      </div>
      <div className="mt-3">
        <ProgressBar value={progress.percent} />
      </div>
    </div>
  );
}

export default function StatutoryInformationPage() {
  const [form, setForm] = useState<StatutoryInfo>(defaultForm);
  const [savedInfo, setSavedInfo] = useState<StatutoryInfo | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const loadStatutoryInfo = useCallback(async () => {
    try {
      const savedStatutoryInfo = await getConfigItem<StatutoryInfo | null>(
        storageKeys.statutoryInfo,
        null
      );

      if (!savedStatutoryInfo) {
        setSavedInfo(null);
        setForm(defaultForm);
        setIsEditing(true);
        return;
      }

      setForm(savedStatutoryInfo);
      setSavedInfo(savedStatutoryInfo);
      setIsEditing(false);
    } catch {
      removeConfigItem(storageKeys.statutoryInfo);
      setSavedInfo(null);
      setForm(defaultForm);
      setIsEditing(true);
    }
  }, []);

  useEffect(() => {
    loadStatutoryInfo();
    window.addEventListener(`${storageKeys.statutoryInfo}-updated`, loadStatutoryInfo as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.statutoryInfo}-updated`, loadStatutoryInfo as EventListener);
    };
  }, [loadStatutoryInfo]);

  const agencyStats = useMemo(() => {
    const bir = agencyProgress([form.companyTin, form.rdoCode, form.birContactEmail]);
    const sss = agencyProgress([form.sssEmployerNo, form.sssDateOfCoverage, form.sssContactPerson, form.sssContactEmail]);
    const philhealth = agencyProgress([form.philhealthEmployerNo, form.philhealthContactNumber, form.philhealthEmail, form.philhealthPostalCode]);
    const pagibig = agencyProgress([form.pagibigEmployerNo, form.pagibigContactPerson, form.pagibigContactEmail]);
    const totalCompleted = bir.completed + sss.completed + philhealth.completed + pagibig.completed;
    const totalFields = bir.total + sss.total + philhealth.total + pagibig.total;

    return {
      bir,
      sss,
      philhealth,
      pagibig,
      totalCompleted,
      totalFields,
      totalPercent: totalFields === 0 ? 0 : Math.round((totalCompleted / totalFields) * 100),
      isComplete: totalCompleted === totalFields,
    };
  }, [form]);

  function updateField<K extends keyof StatutoryInfo>(key: K, value: StatutoryInfo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    const confirmed = window.confirm(
      "Are you sure you want to save these statutory information changes? This may affect government contribution reports, payroll records, payslips, and statutory information shown across the system."
    );

    if (!confirmed) return;

    setConfigItem(storageKeys.statutoryInfo, form);
    setSavedInfo(form);
    setIsEditing(false);
    window.dispatchEvent(new Event("statutory-information-updated"));
    window.alert("Statutory information saved successfully.");
  }

  function handleEdit() {
    const confirmed = window.confirm(
      "Are you sure you want to edit the statutory information? Changes may affect government contribution reports, payroll records, payslips, and statutory information shown across the system."
    );

    if (!confirmed) return;

    setIsEditing(true);
  }

  function handleCancel() {
    if (savedInfo) {
      setForm(savedInfo);
      setIsEditing(false);
      return;
    }

    setForm(defaultForm);
  }

  const displayInfo = isEditing ? form : savedInfo || form;

  return (
    <main
      className="min-h-screen px-4 py-6 text-[#0b2742] sm:px-6 lg:px-8"
      style={{
        background:
          "linear-gradient(180deg, #06182d 0%, #0b2742 330px, #f4f8fc 330px, #f4f8fc 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-[#071a2f] text-white shadow-[0_28px_80px_-38px_rgba(14,165,233,0.7)]">
          <div className="absolute inset-0 opacity-35" style={techGridStyle} />
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#06182d] via-[#1d75bd] to-[#28b8d8]" />

          <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-40 shrink-0 overflow-hidden rounded-2xl border border-cyan-200/30 bg-white/95 p-3 shadow-[0_22px_45px_-22px_rgba(56,189,248,0.75)]">
                  <Image
                    src="/axis-logo.png"
                    alt="AXIS Integrated IT Solutions logo"
                    fill
                    sizes="160px"
                    className="object-contain p-2"
                    priority
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Company Settings</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Statutory Information</h1>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <StatusBadge complete={agencyStats.isComplete} />
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {agencyStats.totalPercent}% ready
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-50">
                  <WalletCards className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                  Payroll compliance
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-white/10 p-4 shadow-[0_30px_70px_-38px_rgba(56,189,248,0.75)] backdrop-blur">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                  <ShieldCheck className="h-7 w-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-sky-100">Required Fields</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{agencyStats.totalCompleted}/{agencyStats.totalFields}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${agencyStats.totalPercent}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-sky-100">
                <span>Agency setup</span>
                <span>{isEditing ? "Editing" : "Saved"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`${subtlePanelClassName} p-5`}>
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">Agency Readiness</h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">BIR, SSS, PhilHealth, Pag-IBIG</p>
            </div>
            <StatusBadge complete={agencyStats.isComplete} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AgencyCard title="BIR" helper="Tax registration" progress={agencyStats.bir} accent="blue" />
            <AgencyCard title="SSS" helper="Coverage details" progress={agencyStats.sss} accent="emerald" />
            <AgencyCard title="PhilHealth" helper="Health coverage" progress={agencyStats.philhealth} accent="purple" />
            <AgencyCard title="Pag-IBIG" helper="HDMF employer data" progress={agencyStats.pagibig} accent="amber" />
          </div>
        </section>

        {isEditing ? (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <Section title="BIR / Tax Information" helper="Tax setup" accent="blue">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2">
                    <FieldLabel>Company TIN</FieldLabel>
                    <InputField
                      value={form.companyTin}
                      onChange={(e) => updateField("companyTin", formatTin(e.target.value))}
                      placeholder="000-000-000-00000"
                      maxLength={17}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>RDO Code</FieldLabel>
                    <InputField
                      value={form.rdoCode}
                      onChange={(e) => updateField("rdoCode", formatRdoCode(e.target.value))}
                      placeholder="000"
                      maxLength={3}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>BIR Contact Email</FieldLabel>
                    <InputField
                      type="email"
                      value={form.birContactEmail}
                      onChange={(e) => updateField("birContactEmail", e.target.value)}
                      placeholder="bir@example.com"
                    />
                  </label>
                </div>
              </Section>

              <Section title="SSS Information" helper="Employer coverage" accent="emerald">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel>SSS Employer Number</FieldLabel>
                    <InputField
                      value={form.sssEmployerNo}
                      onChange={(e) => updateField("sssEmployerNo", formatEmployerNumber(e.target.value))}
                      placeholder="Digits only"
                      maxLength={12}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Date of Coverage</FieldLabel>
                    <InputField
                      type="date"
                      value={form.sssDateOfCoverage}
                      onChange={(e) => updateField("sssDateOfCoverage", e.target.value)}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>SSS Contact Person</FieldLabel>
                    <InputField
                      value={form.sssContactPerson}
                      onChange={(e) => updateField("sssContactPerson", e.target.value)}
                      placeholder="Contact person"
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>SSS Contact Email</FieldLabel>
                    <InputField
                      type="email"
                      value={form.sssContactEmail}
                      onChange={(e) => updateField("sssContactEmail", e.target.value)}
                      placeholder="sss@example.com"
                    />
                  </label>
                </div>
              </Section>

              <Section title="PhilHealth Information" helper="Health coverage" accent="purple">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel>PhilHealth Employer Number</FieldLabel>
                    <InputField
                      value={form.philhealthEmployerNo}
                      onChange={(e) => updateField("philhealthEmployerNo", formatEmployerNumber(e.target.value))}
                      placeholder="Digits only"
                      maxLength={12}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Contact Number</FieldLabel>
                    <InputField
                      value={form.philhealthContactNumber}
                      onChange={(e) => updateField("philhealthContactNumber", formatPhoneNumber(e.target.value))}
                      placeholder="+63"
                      maxLength={20}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Email Address</FieldLabel>
                    <InputField
                      type="email"
                      value={form.philhealthEmail}
                      onChange={(e) => updateField("philhealthEmail", e.target.value)}
                      placeholder="philhealth@example.com"
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Postal Code</FieldLabel>
                    <InputField
                      value={form.philhealthPostalCode}
                      onChange={(e) => updateField("philhealthPostalCode", formatPostalCode(e.target.value))}
                      placeholder="0000"
                      maxLength={4}
                    />
                  </label>
                </div>
              </Section>

              <Section title="Pag-IBIG Information" helper="HDMF profile" accent="amber">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel>Pag-IBIG Employer Number</FieldLabel>
                    <InputField
                      value={form.pagibigEmployerNo}
                      onChange={(e) => updateField("pagibigEmployerNo", formatEmployerNumber(e.target.value))}
                      placeholder="Digits only"
                      maxLength={12}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Branch Code</FieldLabel>
                    <InputField
                      value={form.pagibigBranchCode}
                      onChange={(e) => updateField("pagibigBranchCode", formatBranchCode(e.target.value))}
                      placeholder="0000"
                      maxLength={4}
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Pag-IBIG Contact Person</FieldLabel>
                    <InputField
                      value={form.pagibigContactPerson}
                      onChange={(e) => updateField("pagibigContactPerson", e.target.value)}
                      placeholder="Contact person"
                    />
                  </label>

                  <label className="grid gap-2">
                    <FieldLabel>Pag-IBIG Contact Email</FieldLabel>
                    <InputField
                      type="email"
                      value={form.pagibigContactEmail}
                      onChange={(e) => updateField("pagibigContactEmail", e.target.value)}
                      placeholder="pagibig@example.com"
                    />
                  </label>
                </div>
              </Section>
            </div>

            <aside className="space-y-6">
              <Section title="Reporting Defaults" helper="Tax forms" accent="blue">
                <div className="grid gap-3">
                  <CheckboxCard
                    label="Include in 1601-C"
                    helper="Monthly withholding tax"
                    checked={form.include1601C}
                    onChange={(checked) => updateField("include1601C", checked)}
                  />
                  <CheckboxCard
                    label="Include in 1604-CF"
                    helper="Annual information return"
                    checked={form.include1604CF}
                    onChange={(checked) => updateField("include1604CF", checked)}
                  />
                </div>
              </Section>

              <Section title="Save Changes" helper="System-wide record" accent="amber">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                    Verify employer registration details before saving.
                  </div>
                  <div className="flex flex-col gap-3">
                    <PrimaryButton type="button" onClick={handleSave}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save Statutory Information
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={handleCancel}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              </Section>

              <Section title="Used In" helper="Payroll outputs" accent="purple">
                <div className="grid gap-3 text-sm font-semibold text-slate-700">
                  {["Government reports", "Payroll records", "Payslips", "1601-C / 1604-CF"].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_36px_-30px_rgba(8,47,73,0.72)]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0a4f8f]" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Section title="BIR / Tax Information" helper="Saved tax setup" accent="blue">
                <div className="grid gap-4 md:grid-cols-3">
                  <ReadonlyBox label="Company TIN" value={displayInfo.companyTin} />
                  <ReadonlyBox label="RDO Code" value={displayInfo.rdoCode} />
                  <ReadonlyBox label="BIR Contact Email" value={displayInfo.birContactEmail} />
                </div>
              </Section>

              <Section title="Reporting Defaults" helper="Saved form usage" accent="blue">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <ReadonlyBox label="1601-C" value={displayInfo.include1601C ? "Enabled" : "Disabled"} />
                  <ReadonlyBox label="1604-CF" value={displayInfo.include1604CF ? "Enabled" : "Disabled"} />
                </div>
              </Section>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Section title="SSS Information" helper="Saved coverage" accent="emerald">
                <div className="grid gap-4">
                  <ReadonlyBox label="SSS Employer Number" value={displayInfo.sssEmployerNo} />
                  <ReadonlyBox label="Date of Coverage" value={displayInfo.sssDateOfCoverage} />
                  <ReadonlyBox label="SSS Contact Person" value={displayInfo.sssContactPerson} />
                  <ReadonlyBox label="SSS Contact Email" value={displayInfo.sssContactEmail} />
                </div>
              </Section>

              <Section title="PhilHealth Information" helper="Saved health coverage" accent="purple">
                <div className="grid gap-4">
                  <ReadonlyBox label="PhilHealth Employer Number" value={displayInfo.philhealthEmployerNo} />
                  <ReadonlyBox label="Contact Number" value={displayInfo.philhealthContactNumber} />
                  <ReadonlyBox label="Email Address" value={displayInfo.philhealthEmail} />
                  <ReadonlyBox label="Postal Code" value={displayInfo.philhealthPostalCode} />
                </div>
              </Section>

              <Section title="Pag-IBIG Information" helper="Saved HDMF profile" accent="amber">
                <div className="grid gap-4">
                  <ReadonlyBox label="Pag-IBIG Employer Number" value={displayInfo.pagibigEmployerNo} />
                  <ReadonlyBox label="Branch Code" value={displayInfo.pagibigBranchCode} />
                  <ReadonlyBox label="Contact Person" value={displayInfo.pagibigContactPerson} />
                  <ReadonlyBox label="Contact Email" value={displayInfo.pagibigContactEmail} />
                </div>
              </Section>
            </div>

            <section className={`${subtlePanelClassName} p-5`}>
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-[#0a4f8f]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">Statutory Information Saved</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Review or update employer compliance details.</p>
                  </div>
                </div>
                <PrimaryButton type="button" onClick={handleEdit}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit Statutory Information
                </PrimaryButton>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
