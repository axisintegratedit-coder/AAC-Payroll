"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Pencil,
  Save,
  ShieldCheck,
  Upload,
  UserCheck,
  WalletCards,
  X,
} from "lucide-react";
import { getConfigItem, setConfigItem, removeConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

type Signatories = {
  preparedByName: string;
  preparedByPosition: string;
  checkedByName: string;
  checkedByPosition: string;
  approvedByName: string;
  approvedByPosition: string;
  authorizedRepName: string;
  authorizedRepPosition: string;
  authorizedRepTin: string;
  preparedBySignature: string;
  checkedBySignature: string;
  approvedBySignature: string;
  authorizedRepSignature: string;
};


const defaultForm: Signatories = {
  preparedByName: "",
  preparedByPosition: "",
  checkedByName: "",
  checkedByPosition: "",
  approvedByName: "",
  approvedByPosition: "",
  authorizedRepName: "",
  authorizedRepPosition: "",
  authorizedRepTin: "",
  preparedBySignature: "",
  checkedBySignature: "",
  approvedBySignature: "",
  authorizedRepSignature: "",
};

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0a4f8f] hover:file:bg-cyan-50";
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

function completionProgress(form: Signatories) {
  const requiredFields = Object.values(form);
  const completed = requiredFields.filter((value) => String(value || "").trim()).length;
  const total = requiredFields.length;
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

function HelperText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium leading-5 text-slate-500">{children}</span>;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inputClassName} ${props.className || ""}`}
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

function SignaturePreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_36px_-30px_rgba(8,47,73,0.72)] transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-[#0a4f8f]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Uploaded
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Missing</span>
        )}
      </div>

      <div className="relative flex min-h-[128px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        {value ? (
          <Image src={value} alt={label} width={260} height={112} unoptimized className="h-28 w-full max-w-[260px] object-contain" />
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-500">No signature</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SignatoryCard({
  role,
  name,
  position,
  signature,
  accent = "blue",
}: {
  role: string;
  name: string;
  position: string;
  signature: string;
  accent?: "blue" | "emerald" | "amber" | "purple";
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
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconStyles[accent]}`}>
          <UserCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>
          <p className="mt-1 truncate text-base font-semibold text-slate-950">{name || "Not assigned"}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{position || "Position not set"}</p>
        </div>
      </div>
      <div className="relative mt-4 flex h-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {signature ? (
          <Image src={signature} alt={`${role} signature`} width={220} height={64} unoptimized className="h-16 w-full object-contain" />
        ) : (
          <p className="text-center text-xs font-semibold text-slate-500">No signature</p>
        )}
      </div>
    </div>
  );
}

export default function SignatoriesPage() {
  const [form, setForm] = useState<Signatories>(defaultForm);
  const [savedSignatories, setSavedSignatories] = useState<Signatories | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  const loadSignatories = useCallback(async () => {
    try {
      const savedSignatoryData = await getConfigItem<Signatories | null>(
        storageKeys.signatories,
        null
      );

      if (!savedSignatoryData) {
        setSavedSignatories(null);
        setForm(defaultForm);
        setIsEditing(true);
        return;
      }

      setForm(savedSignatoryData);
      setSavedSignatories(savedSignatoryData);
      setIsEditing(false);
    } catch {
      removeConfigItem(storageKeys.signatories);
      setSavedSignatories(null);
      setForm(defaultForm);
      setIsEditing(true);
    }
  }, []);

  useEffect(() => {
    loadSignatories();
    window.addEventListener(`${storageKeys.signatories}-updated`, loadSignatories as EventListener);

    return () => {
      window.removeEventListener(`${storageKeys.signatories}-updated`, loadSignatories as EventListener);
    };
  }, [loadSignatories]);

  const displaySignatories = isEditing ? form : savedSignatories || form;
  const progress = useMemo(() => completionProgress(displaySignatories), [displaySignatories]);

  function updateField<K extends keyof Signatories>(key: K, value: Signatories[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSignatureUpload<K extends keyof Signatories>(key: K, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      window.alert("Please upload an image file for the signature.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField(key, String(reader.result || "") as Signatories[K]);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    const confirmed = window.confirm(
      "Are you sure you want to save these signatory changes? This may affect payroll records, payslips, reports, and tax-related outputs across the system."
    );

    if (!confirmed) return;

    setConfigItem(storageKeys.signatories, form);
    setSavedSignatories(form);
    setIsEditing(false);
    window.dispatchEvent(new Event("signatories-updated"));
    window.alert("Signatories saved successfully.");
  }

  function handleEdit() {
    const confirmed = window.confirm(
      "Are you sure you want to edit the signatories? Changes may affect payroll records, payslips, reports, and tax-related outputs across the system."
    );

    if (!confirmed) return;

    if (savedSignatories) setForm(savedSignatories);
    setIsEditing(true);
  }

  function handleCancel() {
    if (savedSignatories) {
      setForm(savedSignatories);
      setIsEditing(false);
      return;
    }

    setForm(defaultForm);
  }

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
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Signatories</h1>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <StatusBadge complete={progress.complete} />
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {progress.percent}% ready
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-50">
                  <WalletCards className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                  Payroll approvals
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-white/10 p-4 shadow-[0_30px_70px_-38px_rgba(56,189,248,0.75)] backdrop-blur">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                  <UserCheck className="h-7 w-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-sky-100">Required Items</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{progress.completed}/{progress.total}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-sky-100">
                <span>Approval chain</span>
                <span>{isEditing ? "Editing" : "Saved"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`${subtlePanelClassName} p-5`}>
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">Approval Chain</h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">Prepared, checked, approved, authorized</p>
            </div>
            <StatusBadge complete={progress.complete} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SignatoryCard role="Prepared By" name={displaySignatories.preparedByName} position={displaySignatories.preparedByPosition} signature={displaySignatories.preparedBySignature} accent="blue" />
            <SignatoryCard role="Checked By" name={displaySignatories.checkedByName} position={displaySignatories.checkedByPosition} signature={displaySignatories.checkedBySignature} accent="emerald" />
            <SignatoryCard role="Approved By" name={displaySignatories.approvedByName} position={displaySignatories.approvedByPosition} signature={displaySignatories.approvedBySignature} accent="purple" />
            <SignatoryCard role="Authorized Rep" name={displaySignatories.authorizedRepName} position={displaySignatories.authorizedRepPosition} signature={displaySignatories.authorizedRepSignature} accent="amber" />
          </div>
        </section>

        {isEditing ? (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-6">
              <Section title="Payroll Signatories" helper="Payroll approvals" accent="blue">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel>Prepared By Name</FieldLabel>
                    <InputField value={form.preparedByName} onChange={(e) => updateField("preparedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Prepared By Position</FieldLabel>
                    <InputField value={form.preparedByPosition} onChange={(e) => updateField("preparedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Checked By Name</FieldLabel>
                    <InputField value={form.checkedByName} onChange={(e) => updateField("checkedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Checked By Position</FieldLabel>
                    <InputField value={form.checkedByPosition} onChange={(e) => updateField("checkedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Approved By Name</FieldLabel>
                    <InputField value={form.approvedByName} onChange={(e) => updateField("approvedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Approved By Position</FieldLabel>
                    <InputField value={form.approvedByPosition} onChange={(e) => updateField("approvedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                </div>
              </Section>

              <Section title="BIR / Employer Representative" helper="Authorized representative" accent="amber">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2">
                    <FieldLabel>Authorized Representative Name</FieldLabel>
                    <InputField value={form.authorizedRepName} onChange={(e) => updateField("authorizedRepName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Authorized Representative Position</FieldLabel>
                    <InputField value={form.authorizedRepPosition} onChange={(e) => updateField("authorizedRepPosition", e.target.value)} placeholder="Position" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Authorized Representative TIN</FieldLabel>
                    <InputField value={form.authorizedRepTin} onChange={(e) => updateField("authorizedRepTin", formatTin(e.target.value))} placeholder="000-000-000-00000" maxLength={17} />
                  </label>
                </div>
              </Section>

              <Section title="Signature Uploads" helper="PNG or JPG" accent="purple">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel>Prepared By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("preparedBySignature", e)} />
                    <HelperText>Use a clean image on a white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Checked By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("checkedBySignature", e)} />
                    <HelperText>Use a clean image on a white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Approved By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("approvedBySignature", e)} />
                    <HelperText>Use a clean image on a white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel>Authorized Representative Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("authorizedRepSignature", e)} />
                    <HelperText>Use a clean image on a white or transparent background.</HelperText>
                  </label>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SignaturePreview label="Prepared By" value={form.preparedBySignature} />
                  <SignaturePreview label="Checked By" value={form.checkedBySignature} />
                  <SignaturePreview label="Approved By" value={form.approvedBySignature} />
                  <SignaturePreview label="Authorized Rep" value={form.authorizedRepSignature} />
                </div>
              </Section>
            </div>

            <aside className="space-y-6">
              <Section title="Save Changes" helper="System-wide record" accent="amber">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                    Verify names, positions, TIN, and signatures before saving.
                  </div>
                  <div className="flex flex-col gap-3">
                    <PrimaryButton type="button" onClick={handleSave}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save Signatories
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={handleCancel}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              </Section>

              <Section title="Used In" helper="Payroll outputs" accent="blue">
                <div className="grid gap-3 text-sm font-semibold text-slate-700">
                  {["Payroll records", "Payslips", "Printable reports", "Tax outputs"].map((item) => (
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
              <Section title="Payroll Signatories" helper="Saved approvals" accent="blue">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <ReadonlyBox label="Prepared By Name" value={displaySignatories.preparedByName} />
                  <ReadonlyBox label="Prepared By Position" value={displaySignatories.preparedByPosition} />
                  <ReadonlyBox label="Checked By Name" value={displaySignatories.checkedByName} />
                  <ReadonlyBox label="Checked By Position" value={displaySignatories.checkedByPosition} />
                  <ReadonlyBox label="Approved By Name" value={displaySignatories.approvedByName} />
                  <ReadonlyBox label="Approved By Position" value={displaySignatories.approvedByPosition} />
                </div>
              </Section>

              <Section title="BIR Representative" helper="Saved authorization" accent="amber">
                <div className="grid gap-4">
                  <ReadonlyBox label="Authorized Representative Name" value={displaySignatories.authorizedRepName} />
                  <ReadonlyBox label="Authorized Representative Position" value={displaySignatories.authorizedRepPosition} />
                  <ReadonlyBox label="Authorized Representative TIN" value={displaySignatories.authorizedRepTin} />
                </div>
              </Section>
            </div>

            <Section title="Signature Uploads" helper="Saved previews" accent="purple">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SignaturePreview label="Prepared By" value={displaySignatories.preparedBySignature} />
                <SignaturePreview label="Checked By" value={displaySignatories.checkedBySignature} />
                <SignaturePreview label="Approved By" value={displaySignatories.approvedBySignature} />
                <SignaturePreview label="Authorized Rep" value={displaySignatories.authorizedRepSignature} />
              </div>
            </Section>

            <section className={`${subtlePanelClassName} p-5`}>
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent" />
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 text-[#0a4f8f]">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">Signatories Saved</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Review or update official payroll approvals.</p>
                  </div>
                </div>
                <PrimaryButton type="button" onClick={handleEdit}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit Signatories
                </PrimaryButton>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
