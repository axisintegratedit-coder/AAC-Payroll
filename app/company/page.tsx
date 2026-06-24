"use client";

import Image from "next/image";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Landmark,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  WalletCards,
  X,
} from "lucide-react";
import { getConfigItem, setConfigItem, removeConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { logAudit } from "@/lib/auditTrail";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CompanyInformation = {
  companyName: string;
  tradeName: string;
  address: string;
  contactNumber: string;
  emailAddress: string;
  tin: string;
  sssEmployerNo: string;
  philhealthEmployerNo: string;
  pagibigEmployerNo: string;
  authorizedSignatory: string;
  authorizedSignatoryPosition: string;
  payrollOfficer: string;
  logoDataUrl: string;
  departments: string[];
};

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

// ─── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_COMPANY: CompanyInformation = {
  companyName: "",
  tradeName: "",
  address: "",
  contactNumber: "",
  emailAddress: "",
  tin: "",
  sssEmployerNo: "",
  philhealthEmployerNo: "",
  pagibigEmployerNo: "",
  authorizedSignatory: "",
  authorizedSignatoryPosition: "",
  payrollOfficer: "",
  logoDataUrl: "",
  departments: [],
};

const DEFAULT_STATUTORY: StatutoryInfo = {
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

const DEFAULT_SIGNATORIES: Signatories = {
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

const SUGGESTED_DEPARTMENTS = [
  "Accounting", "Admin", "Customer Service", "Executive", "Finance",
  "Human Resource", "IT", "Marketing", "Operations", "Payroll", "Sales",
];

// ─── Style constants ───────────────────────────────────────────────────────────

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_24px_-22px_rgba(8,47,73,0.65)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0a4f8f] hover:file:bg-cyan-50";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0a4f8f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-20px_rgba(14,116,144,0.8)] transition hover:-translate-y-0.5 hover:bg-[#073c6d] focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_14px_28px_-22px_rgba(8,47,73,0.75)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50";
const accordionActionClassName =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50";

// ─── Format helpers ────────────────────────────────────────────────────────────

const digitsOnly = (v: string) => v.replace(/\D/g, "");
function formatTin(v: string) {
  const d = digitsOnly(v).slice(0, 14);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatRdoCode(v: string) { return digitsOnly(v).slice(0, 3); }
function formatEmployerNumber(v: string) { return digitsOnly(v).slice(0, 12); }
function formatPostalCode(v: string) { return digitsOnly(v).slice(0, 4); }
function formatBranchCode(v: string) { return digitsOnly(v).slice(0, 4); }
function formatPhoneNumber(v: string) { return v.replace(/[^\d+\-()\s]/g, "").slice(0, 20); }

function agencyProgress(values: string[]) {
  const completed = values.filter((v) => v.trim().length > 0).length;
  const total = values.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100), complete: completed === total };
}

function completionProgress(form: Signatories) {
  const fields = Object.values(form);
  const completed = fields.filter((v) => String(v || "").trim()).length;
  const total = fields.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100), complete: completed === total };
}

function logoInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CO";
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-semibold text-slate-700">
      {children}{required ? <span className="text-rose-600"> *</span> : null}
    </span>
  );
}
function HelperText({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium leading-5 text-slate-500">{children}</span>;
}
function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClassName} ${props.className || ""}`} />;
}
function TextAreaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClassName} min-h-[112px] ${props.className || ""}`} />;
}
function Section({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {helper ? <p className="mt-0.5 text-xs font-medium text-slate-400">{helper}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function ReadonlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 min-h-5 break-words text-sm font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}
function StatusBadge({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-[#0a4f8f]">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Complete
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Needs Review
    </span>
  );
}
function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${primaryButtonClassName} ${props.className || ""}`}>{children}</button>;
}
function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`${secondaryButtonClassName} ${props.className || ""}`}>{children}</button>;
}
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gradient-to-r from-[#0a4f8f] to-cyan-400 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}
function AgencyCard({ title, helper, progress }: { title: string; helper: string; progress: ReturnType<typeof agencyProgress> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
            <Landmark className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">{helper}</p>
          </div>
        </div>
        <StatusBadge complete={progress.complete} />
      </div>
      <div className="mt-3 flex justify-between text-xs font-semibold text-slate-500">
        <span>{progress.completed}/{progress.total} fields</span>
        <span>{progress.percent}%</span>
      </div>
      <div className="mt-2"><ProgressBar value={progress.percent} /></div>
    </div>
  );
}
// Person card: shows signatory assignment details, no signature.
function PersonCard({
  role,
  name,
  position,
  detailLabel,
  detailValue,
}: {
  role: string;
  name: string;
  position: string;
  detailLabel?: string;
  detailValue?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>
      </div>
      <p className="text-sm font-semibold text-slate-800">{name || "Not assigned"}</p>
      <p className="mt-0.5 text-xs text-slate-500">{position || "Position not set"}</p>
      {detailLabel ? (
        <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <span className="text-slate-400">{detailLabel}</span>
          <span className="ml-2 text-slate-700">{detailValue || "—"}</span>
        </p>
      ) : null}
    </div>
  );
}

// Signature gallery item: shows signature image with role + name label below
function SignatureGalleryItem({ role, name, value }: { role: string; name: string; value: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
        {value ? (
          <Image src={value} alt={`${role} signature`} width={220} height={88} unoptimized className="h-20 w-full object-contain" />
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-5 w-5 text-slate-300" aria-hidden="true" />
            <p className="mt-1.5 text-xs font-medium text-slate-400">No signature</p>
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">{name || "—"}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{role}</p>
        {value ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-[#0a4f8f]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />Uploaded
          </span>
        ) : (
          <span className="mt-1.5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Missing</span>
        )}
      </div>
    </div>
  );
}

// Signature preview for edit form (compact, with upload badge)
function SignaturePreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {value ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-[#0a4f8f]">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />Uploaded
          </span>
        ) : (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Missing</span>
        )}
      </div>
      <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50">
        {value ? (
          <Image src={value} alt={label} width={200} height={72} unoptimized className="h-16 w-full object-contain" />
        ) : (
          <Upload className="h-4 w-4 text-slate-300" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

// Accordion section wrapper
function AccordionSection({
  id, title, helper, badge, action, isOpen, onToggle, children,
}: {
  id: string; title: string; helper?: string; badge?: React.ReactNode;
  action?: React.ReactNode; isOpen: boolean; onToggle: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white bg-white/95 shadow-[0_4px_24px_-8px_rgba(8,47,73,0.12)] ring-1 ring-slate-900/[0.04] backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="min-w-0 text-left transition"
          aria-expanded={isOpen}
        >
          <p className="text-base font-semibold text-slate-800">{title}</p>
          {helper ? <p className="mt-0.5 text-xs font-medium text-slate-400">{helper}</p> : null}
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {badge}
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 text-slate-400 transition hover:border-sky-200 hover:bg-sky-50 hover:text-[#0a4f8f]"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {action}
        </div>
      </div>
      {isOpen ? <div className="border-t border-slate-100 px-5 pb-6 pt-5">{children}</div> : null}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  // Company state
  const [form, setForm] = useState<CompanyInformation>(EMPTY_COMPANY);
  const [savedCompany, setSavedCompany] = useState<CompanyInformation | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");

  // Statutory state
  const [statutoryForm, setStatutoryForm] = useState<StatutoryInfo>(DEFAULT_STATUTORY);
  const [savedStatutory, setSavedStatutory] = useState<StatutoryInfo | null>(null);
  const [isEditingStatutory, setIsEditingStatutory] = useState(false);

  // Signatories state
  const [signatoryForm, setSignatoryForm] = useState<Signatories>(DEFAULT_SIGNATORIES);
  const [savedSignatories, setSavedSignatories] = useState<Signatories | null>(null);
  const [isEditingSignatories, setIsEditingSignatories] = useState(false);

  // Accordion open state — company-info open by default
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["company-info"]));

  const toggleSection = (id: string) => {
    // Prevent collapsing a section currently being edited
    if (id === "company-info" && isEditing) return;
    if (id === "statutory" && isEditingStatutory) return;
    if (["signatories", "signatures"].includes(id) && isEditingSignatories) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadCompanyInformation = useCallback(async () => {
    try {
      const saved = await getConfigItem<CompanyInformation | null>(storageKeys.companyInformation, null);
      if (!saved) { setSavedCompany(null); setForm(EMPTY_COMPANY); setIsEditing(true); setOpenSections((p) => new Set([...p, "company-info"])); return; }
      const normalized = { ...EMPTY_COMPANY, ...saved, departments: Array.isArray(saved.departments) ? saved.departments : [] };
      setSavedCompany(normalized); setForm(normalized); setIsEditing(false);
    } catch (err) {
      console.error("Failed to load company information", err);
      setSavedCompany(null); setForm(EMPTY_COMPANY); setIsEditing(true);
    }
  }, []);

  useEffect(() => {
    loadCompanyInformation();
    window.addEventListener(`${storageKeys.companyInformation}-updated`, loadCompanyInformation as EventListener);
    return () => { window.removeEventListener(`${storageKeys.companyInformation}-updated`, loadCompanyInformation as EventListener); };
  }, [loadCompanyInformation]);

  const loadStatutoryInfo = useCallback(async () => {
    try {
      const saved = await getConfigItem<StatutoryInfo | null>(storageKeys.statutoryInfo, null);
      if (!saved) { setSavedStatutory(null); setStatutoryForm(DEFAULT_STATUTORY); setIsEditingStatutory(true); setOpenSections((p) => new Set([...p, "statutory"])); return; }
      setStatutoryForm(saved); setSavedStatutory(saved); setIsEditingStatutory(false);
    } catch { removeConfigItem(storageKeys.statutoryInfo); setSavedStatutory(null); setStatutoryForm(DEFAULT_STATUTORY); setIsEditingStatutory(true); }
  }, []);

  useEffect(() => {
    loadStatutoryInfo();
    window.addEventListener(`${storageKeys.statutoryInfo}-updated`, loadStatutoryInfo as EventListener);
    return () => { window.removeEventListener(`${storageKeys.statutoryInfo}-updated`, loadStatutoryInfo as EventListener); };
  }, [loadStatutoryInfo]);

  const loadSignatories = useCallback(async () => {
    try {
      const saved = await getConfigItem<Signatories | null>(storageKeys.signatories, null);
      if (!saved) { setSavedSignatories(null); setSignatoryForm(DEFAULT_SIGNATORIES); setIsEditingSignatories(true); setOpenSections((p) => new Set([...p, "signatories", "signatures"])); return; }
      setSignatoryForm(saved); setSavedSignatories(saved); setIsEditingSignatories(false);
    } catch { removeConfigItem(storageKeys.signatories); setSavedSignatories(null); setSignatoryForm(DEFAULT_SIGNATORIES); setIsEditingSignatories(true); }
  }, []);

  useEffect(() => {
    loadSignatories();
    window.addEventListener(`${storageKeys.signatories}-updated`, loadSignatories as EventListener);
    return () => { window.removeEventListener(`${storageKeys.signatories}-updated`, loadSignatories as EventListener); };
  }, [loadSignatories]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const displayCompany = isEditing ? form : savedCompany || form;
  const displayStatutory = isEditingStatutory ? statutoryForm : savedStatutory || statutoryForm;
  const displaySig = isEditingSignatories ? signatoryForm : savedSignatories || signatoryForm;

  const completion = useMemo(() => {
    const req: Array<keyof CompanyInformation> = ["companyName", "address", "contactNumber", "emailAddress"];
    const completed = req.filter((f) => String(form[f] || "").trim()).length;
    return { completed, total: req.length, percent: Math.round((completed / req.length) * 100), isComplete: completed === req.length };
  }, [form]);

  const agencyStats = useMemo(() => {
    const bir = agencyProgress([statutoryForm.companyTin, statutoryForm.rdoCode, statutoryForm.birContactEmail]);
    const sss = agencyProgress([statutoryForm.sssEmployerNo, statutoryForm.sssDateOfCoverage, statutoryForm.sssContactPerson, statutoryForm.sssContactEmail]);
    const ph = agencyProgress([statutoryForm.philhealthEmployerNo, statutoryForm.philhealthContactNumber, statutoryForm.philhealthEmail, statutoryForm.philhealthPostalCode]);
    const pig = agencyProgress([statutoryForm.pagibigEmployerNo, statutoryForm.pagibigContactPerson, statutoryForm.pagibigContactEmail]);
    const tc = bir.completed + sss.completed + ph.completed + pig.completed;
    const tt = bir.total + sss.total + ph.total + pig.total;
    return { bir, sss, philhealth: ph, pagibig: pig, totalCompleted: tc, totalFields: tt, totalPercent: tt === 0 ? 0 : Math.round((tc / tt) * 100), isComplete: tc === tt };
  }, [statutoryForm]);

  const signatoryProgress = useMemo(() => completionProgress(displaySig), [displaySig]);

  // ── Company handlers ──────────────────────────────────────────────────────────

  const updateField = (key: keyof CompanyInformation, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const addDepartment = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setForm((p) => {
      const ex = Array.isArray(p.departments) ? p.departments : [];
      if (ex.some((d) => d.trim().toLowerCase() === clean.toLowerCase())) return p;
      return { ...p, departments: [...ex, clean].sort((a, b) => a.localeCompare(b)) };
    });
    setNewDepartment("");
  };

  const removeDepartment = (name: string) => setForm((p) => ({ ...p, departments: (p.departments || []).filter((d) => d !== name) }));

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { window.alert("Please upload an image file."); e.target.value = ""; return; }
    const reader = new FileReader();
    reader.onloadend = () => updateField("logoDataUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.companyName.trim()) { window.alert("Please enter the company name."); return; }
    if (!window.confirm("Save company profile changes? This affects payslips, reports, and company information across the system.")) return;
    setConfigItem(storageKeys.companyInformation, form);
    setSavedCompany(form); setIsEditing(false);
    window.dispatchEvent(new Event("company-information-updated"));
    logAudit({ action: "SAVED", entityType: "Settings", entityId: "company-information", entityName: form.companyName || "Company Information", details: "Company profile updated" });
    window.alert("Company information saved successfully.");
  };

  const handleEdit = () => {
    if (!window.confirm("Edit company profile? Changes affect payslips, reports, and company information.")) return;
    if (savedCompany) setForm(savedCompany);
    setIsEditing(true);
    setOpenSections((p) => new Set([...p, "company-info"]));
  };

  const handleCancel = () => {
    if (savedCompany) { setForm(savedCompany); setIsEditing(false); } else setForm(EMPTY_COMPANY);
  };

  // ── Statutory handlers ────────────────────────────────────────────────────────

  function updateStatutoryField<K extends keyof StatutoryInfo>(key: K, value: StatutoryInfo[K]) {
    setStatutoryForm((p) => ({ ...p, [key]: value }));
  }

  function handleSaveStatutory() {
    const req: Array<[string, string]> = [
      ["Company TIN", statutoryForm.companyTin], ["RDO Code", statutoryForm.rdoCode], ["BIR Contact Email", statutoryForm.birContactEmail],
      ["SSS Employer Number", statutoryForm.sssEmployerNo], ["Date of Coverage", statutoryForm.sssDateOfCoverage],
      ["SSS Contact Person", statutoryForm.sssContactPerson], ["SSS Contact Email", statutoryForm.sssContactEmail],
      ["PhilHealth Employer Number", statutoryForm.philhealthEmployerNo], ["PhilHealth Contact Number", statutoryForm.philhealthContactNumber],
      ["PhilHealth Email", statutoryForm.philhealthEmail], ["PhilHealth Postal Code", statutoryForm.philhealthPostalCode],
      ["Pag-IBIG Employer Number", statutoryForm.pagibigEmployerNo], ["Pag-IBIG Contact Person", statutoryForm.pagibigContactPerson],
      ["Pag-IBIG Contact Email", statutoryForm.pagibigContactEmail],
    ];
    const missing = req.find(([, v]) => !v.trim());
    if (missing) { window.alert(`${missing[0]} is required.`); return; }
    if (!window.confirm("Save statutory information? This affects government reports, payroll records, and payslips.")) return;
    setConfigItem(storageKeys.statutoryInfo, statutoryForm);
    setSavedStatutory(statutoryForm); setIsEditingStatutory(false);
    window.dispatchEvent(new Event("statutory-information-updated"));
    logAudit({ action: "SAVED", entityType: "Settings", entityId: "statutory-information", entityName: "Statutory Information", details: `TIN: ${statutoryForm.companyTin}; RDO: ${statutoryForm.rdoCode}` });
    window.alert("Statutory information saved successfully.");
  }

  function handleEditStatutory() {
    if (!window.confirm("Edit statutory information? Changes affect government reports, payroll records, and payslips.")) return;
    setIsEditingStatutory(true);
    setOpenSections((p) => new Set([...p, "statutory"]));
  }

  function handleCancelStatutory() {
    if (savedStatutory) { setStatutoryForm(savedStatutory); setIsEditingStatutory(false); return; }
    setStatutoryForm(DEFAULT_STATUTORY);
  }

  // ── Signatories handlers ──────────────────────────────────────────────────────

  function updateSignatoryField<K extends keyof Signatories>(key: K, value: Signatories[K]) {
    setSignatoryForm((p) => ({ ...p, [key]: value }));
  }

  function handleSignatureUpload<K extends keyof Signatories>(key: K, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { window.alert("Please upload an image file."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => updateSignatoryField(key, String(reader.result || "") as Signatories[K]);
    reader.readAsDataURL(file);
  }

  function handleSaveSignatories() {
    const req: Array<[string, string]> = [
      ["Prepared By Name", signatoryForm.preparedByName], ["Prepared By Position", signatoryForm.preparedByPosition],
      ["Checked By Name", signatoryForm.checkedByName], ["Checked By Position", signatoryForm.checkedByPosition],
      ["Approved By Name", signatoryForm.approvedByName], ["Approved By Position", signatoryForm.approvedByPosition],
      ["Authorized Representative Name", signatoryForm.authorizedRepName], ["Authorized Representative Position", signatoryForm.authorizedRepPosition],
      ["Authorized Representative TIN", signatoryForm.authorizedRepTin],
      ["Prepared By Signature", signatoryForm.preparedBySignature], ["Checked By Signature", signatoryForm.checkedBySignature],
      ["Approved By Signature", signatoryForm.approvedBySignature], ["Authorized Representative Signature", signatoryForm.authorizedRepSignature],
    ];
    const missing = req.find(([, v]) => !v.trim());
    if (missing) { window.alert(`${missing[0]} is required.`); return; }
    if (!window.confirm("Save signatory changes? This affects payroll records, payslips, reports, and tax outputs.")) return;
    setConfigItem(storageKeys.signatories, signatoryForm);
    setSavedSignatories(signatoryForm); setIsEditingSignatories(false);
    window.dispatchEvent(new Event("signatories-updated"));
    logAudit({ action: "SAVED", entityType: "Settings", entityId: "signatories", entityName: "Signatories", details: `Prepared by: ${signatoryForm.preparedByName}; Approved by: ${signatoryForm.approvedByName}` });
    window.alert("Signatories saved successfully.");
  }

  function handleEditSignatories() {
    if (!window.confirm("Edit signatories? Changes affect payroll records, payslips, reports, and tax outputs.")) return;
    if (savedSignatories) setSignatoryForm(savedSignatories);
    setIsEditingSignatories(true);
    setOpenSections((p) => new Set([...p, "signatories", "signatures"]));
  }

  function handleCancelSignatories() {
    if (savedSignatories) { setSignatoryForm(savedSignatories); setIsEditingSignatories(false); return; }
    setSignatoryForm(DEFAULT_SIGNATORIES);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen pg-bg text-[#0b2742]">
      <div className="min-w-0 flex-1">

        {/* ── BANNER ── */}
        <section
          className="relative overflow-hidden border-b border-[#3abeff33] px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
          style={{ backgroundColor: "#071a2f", color: "#ffffff" }}
        >
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 82% 20%, #3abeff33, transparent 30%), linear-gradient(135deg, #3abeff22, transparent 45%)" }} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
          <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[42px] border-b border-l border-cyan-300/20 bg-cyan-300/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">Company Settings</h1>
              <p className="mt-1 text-sm opacity-85">
                {displayCompany.companyName || "No company name set"} · {completion.percent}% complete · {(displayCompany.departments || []).length} department{(displayCompany.departments || []).length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="shrink-0 lg:min-w-[420px]">
              <div className="flex items-center gap-3 rounded bg-white/10 px-4 py-3 backdrop-blur">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white">
                  {displayCompany.logoDataUrl ? (
                    <Image src={displayCompany.logoDataUrl} alt="Company Logo" fill sizes="48px" unoptimized className="object-contain p-2" />
                  ) : (
                    <span className="text-base font-bold text-[#0a4f8f]">{logoInitials(displayCompany.companyName)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{displayCompany.companyName || "Company Name"}</p>
                  <p className="mt-0.5 truncate text-xs text-sky-200">{displayCompany.tradeName || "Trade name or branch"}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-[#3abeff]" style={{ width: `${completion.percent}%` }} />
                  </div>
                </div>
                <StatusBadge complete={completion.isComplete} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {isEditing ? (
                  <>
                    <button type="button" onClick={handleSave} className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-3.5 text-[13px] font-medium text-white transition hover:border-cyan-200/50 hover:bg-white/[0.12]">
                      <Save className="h-3.5 w-3.5" />Save changes
                    </button>
                    <button type="button" onClick={handleCancel} className="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-3.5 text-[13px] font-medium text-white transition hover:border-cyan-200/50 hover:bg-white/[0.12]">
                      <X className="h-3.5 w-3.5" />Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={handleEdit} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded border border-white/20 bg-white/[0.06] px-3.5 text-[13px] font-medium text-white transition hover:border-cyan-200/50 hover:bg-white/[0.12]">
                    <Pencil className="h-3.5 w-3.5" />Edit Company Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <div className="flex divide-x divide-slate-200 border-b border-slate-200 bg-white">
          <div className="flex-1 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Departments</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{(displayCompany.departments || []).length}</p>
            {(displayCompany.departments || []).length > 0 ? (
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                {(displayCompany.departments || []).slice(0, 3).join(", ")}{(displayCompany.departments || []).length > 3 ? " …" : ""}
              </p>
            ) : <p className="mt-0.5 text-xs text-slate-400">None yet</p>}
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Statutory</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{agencyStats.totalPercent}%</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{agencyStats.totalCompleted}/{agencyStats.totalFields} fields</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0a4f8f] to-cyan-400 transition-all" style={{ width: `${agencyStats.totalPercent}%` }} />
            </div>
          </div>
          <div className="flex-[1.35] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signatories</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{signatoryProgress.percent}%</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{signatoryProgress.completed}/{signatoryProgress.total} complete</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0a4f8f] to-cyan-400 transition-all" style={{ width: `${signatoryProgress.percent}%` }} />
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="p-6 lg:p-8">
          <div className="mx-auto max-w-5xl space-y-4">

          {/* ── 1. Company Information ── */}
          <AccordionSection
            id="company-info"
            title="Company Information"
            helper="Official details, departments, and payroll setup"
            badge={<StatusBadge complete={completion.isComplete} />}
            action={!isEditing ? (
              <button type="button" onClick={handleEdit} className={accordionActionClassName}>
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
            ) : null}
            isOpen={openSections.has("company-info")}
            onToggle={toggleSection}
          >
            {isEditing ? (
              <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-5">
                  <Section title="Company Identity" helper="Official details">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <FieldLabel required>Company Name</FieldLabel>
                        <InputField value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="Enter company name" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Trade Name / Branch Name</FieldLabel>
                        <InputField value={form.tradeName} onChange={(e) => updateField("tradeName", e.target.value)} placeholder="Enter trade name or branch name" />
                      </label>
                      <label className="grid gap-2 md:col-span-2">
                        <FieldLabel required>Company Address</FieldLabel>
                        <TextAreaField value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Enter complete company address" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Contact Number</FieldLabel>
                        <InputField value={form.contactNumber} onChange={(e) => updateField("contactNumber", e.target.value)} placeholder="Enter contact number" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Email Address</FieldLabel>
                        <InputField type="email" value={form.emailAddress} onChange={(e) => updateField("emailAddress", e.target.value)} placeholder="Enter email address" />
                      </label>
                    </div>
                  </Section>

                  <Section title="Branding" helper="Logo">
                    <div className="grid gap-5 md:grid-cols-[0.7fr_1.3fr] md:items-center">
                      <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                        {form.logoDataUrl ? (
                          <Image src={form.logoDataUrl} alt="Company Logo" fill sizes="280px" unoptimized className="object-contain p-4" />
                        ) : (
                          <div className="text-center">
                            <p className="text-3xl font-semibold text-[#0a4f8f]">{logoInitials(form.companyName)}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Logo preview</p>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-3">
                        <label className="grid gap-2">
                          <FieldLabel>Company Logo</FieldLabel>
                          <InputField type="file" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                        <p className="text-sm leading-6 text-slate-600">Use a clean PNG or JPG. Stored in browser storage.</p>
                        {form.logoDataUrl ? (
                          <SecondaryButton type="button" onClick={() => updateField("logoDataUrl", "")}>
                            <X className="h-4 w-4" aria-hidden="true" />Remove Logo
                          </SecondaryButton>
                        ) : null}
                      </div>
                    </div>
                  </Section>

                  <Section title="Departments" helper="Org groups">
                    <div className="grid gap-5">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Suggested Departments</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {SUGGESTED_DEPARTMENTS.map((dept) => {
                            const isAdded = (form.departments || []).some((d) => d.trim().toLowerCase() === dept.toLowerCase());
                            return (
                              <button key={dept} type="button" onClick={() => addDepartment(dept)} disabled={isAdded}
                                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${isAdded ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-sky-200 bg-sky-50 text-[#0a4f8f] hover:-translate-y-0.5 hover:bg-sky-100"}`}>
                                {isAdded ? `Added • ${dept}` : `Add ${dept}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <label className="grid gap-2">
                          <FieldLabel>Add Custom Department</FieldLabel>
                          <InputField value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} placeholder="Example: Logistics, Production, Legal" />
                        </label>
                        <PrimaryButton type="button" onClick={() => addDepartment(newDepartment)}>
                          <Plus className="h-4 w-4" aria-hidden="true" />Add
                        </PrimaryButton>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">Current Departments</p>
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{(form.departments || []).length} added</span>
                        </div>
                        {(form.departments || []).length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(form.departments || []).map((dept) => (
                              <span key={dept} className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                                {dept}
                                <button type="button" onClick={() => removeDepartment(dept)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 transition hover:bg-rose-100">
                                  <Trash2 className="h-3 w-3" aria-hidden="true" />Remove
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-500">No departments added yet.</p>
                        )}
                      </div>
                    </div>
                  </Section>

                  <Section title="Payroll Setup" helper="Frequency">
                    <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-[#0b2742]">
                      Payroll is processed on a bi-monthly basis. The actual cutoff period and payroll date will depend on each payroll recording.
                    </div>
                  </Section>
                </div>

                <aside className="space-y-5">
                  <Section title="Save Changes" helper="System-wide">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                        Company profile changes are system-wide. Save only when the details are verified.
                      </div>
                      <div className="flex flex-col gap-3">
                        <PrimaryButton type="button" onClick={handleSave}>
                          <Save className="h-4 w-4" aria-hidden="true" />Save Company Profile
                        </PrimaryButton>
                        <SecondaryButton type="button" onClick={handleCancel}>
                          <X className="h-4 w-4" aria-hidden="true" />Cancel
                        </SecondaryButton>
                      </div>
                    </div>
                  </Section>
                  <Section title="Used In" helper="Outputs">
                    <div className="space-y-2 text-sm font-semibold text-slate-700">
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><FileText className="h-4 w-4 text-sky-600" />Payslip headers</div>
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><WalletCards className="h-4 w-4 text-sky-600" />Payroll records</div>
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Building2 className="h-4 w-4 text-sky-600" />Reports and forms</div>
                    </div>
                  </Section>
                </aside>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Fields — company name shown only in banner, so we start with trade name */}
                <div className="grid gap-3 md:grid-cols-2">
                  <ReadonlyBox label="Trade Name / Branch" value={displayCompany.tradeName} />
                  <ReadonlyBox label="Contact Number" value={displayCompany.contactNumber} />
                  <ReadonlyBox label="Email Address" value={displayCompany.emailAddress} />
                  <div className="md:col-span-2"><ReadonlyBox label="Company Address" value={displayCompany.address} /></div>
                </div>
                {/* Departments */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Departments</p>
                  {(displayCompany.departments || []).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(displayCompany.departments || []).map((d) => (
                        <span key={d} className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0a4f8f]">{d}</span>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-400">No departments added yet.</p>}
                </div>
                {/* Payroll setup note */}
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-[#0b2742]">
                  Bi-monthly payroll schedule. Cutoff and payroll dates are finalized per payroll record.
                </div>
              </div>
            )}
          </AccordionSection>

          {/* ── 2. Statutory Information ── */}
          <AccordionSection
            id="statutory"
            title="Statutory Information"
            helper="BIR · SSS · PhilHealth · Pag-IBIG"
            badge={<StatusBadge complete={agencyStats.isComplete} />}
            action={!isEditingStatutory ? (
              <button type="button" onClick={handleEditStatutory} className={accordionActionClassName}>
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
            ) : null}
            isOpen={openSections.has("statutory")}
            onToggle={toggleSection}
          >
            {isEditingStatutory ? (
              <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-5">
                  <Section title="BIR / Tax Information" helper="Tax setup">
                    <div className="grid gap-4 md:grid-cols-3">
                      <label className="grid gap-2">
                        <FieldLabel required>Company TIN</FieldLabel>
                        <InputField required value={statutoryForm.companyTin} onChange={(e) => updateStatutoryField("companyTin", formatTin(e.target.value))} placeholder="000-000-000-00000" maxLength={17} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>RDO Code</FieldLabel>
                        <InputField required value={statutoryForm.rdoCode} onChange={(e) => updateStatutoryField("rdoCode", formatRdoCode(e.target.value))} placeholder="000" maxLength={3} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>BIR Contact Email</FieldLabel>
                        <InputField type="email" required value={statutoryForm.birContactEmail} onChange={(e) => updateStatutoryField("birContactEmail", e.target.value)} placeholder="bir@example.com" />
                      </label>
                    </div>
                  </Section>
                  <Section title="SSS Information" helper="Employer coverage">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <FieldLabel required>SSS Employer Number</FieldLabel>
                        <InputField required value={statutoryForm.sssEmployerNo} onChange={(e) => updateStatutoryField("sssEmployerNo", formatEmployerNumber(e.target.value))} placeholder="Digits only" maxLength={12} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Date of Coverage</FieldLabel>
                        <InputField type="date" required value={statutoryForm.sssDateOfCoverage} onChange={(e) => updateStatutoryField("sssDateOfCoverage", e.target.value)} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>SSS Contact Person</FieldLabel>
                        <InputField required value={statutoryForm.sssContactPerson} onChange={(e) => updateStatutoryField("sssContactPerson", e.target.value)} placeholder="Contact person" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>SSS Contact Email</FieldLabel>
                        <InputField type="email" required value={statutoryForm.sssContactEmail} onChange={(e) => updateStatutoryField("sssContactEmail", e.target.value)} placeholder="sss@example.com" />
                      </label>
                    </div>
                  </Section>
                  <Section title="PhilHealth Information" helper="Health coverage">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <FieldLabel required>PhilHealth Employer Number</FieldLabel>
                        <InputField required value={statutoryForm.philhealthEmployerNo} onChange={(e) => updateStatutoryField("philhealthEmployerNo", formatEmployerNumber(e.target.value))} placeholder="Digits only" maxLength={12} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Contact Number</FieldLabel>
                        <InputField required value={statutoryForm.philhealthContactNumber} onChange={(e) => updateStatutoryField("philhealthContactNumber", formatPhoneNumber(e.target.value))} placeholder="+63" maxLength={20} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Email Address</FieldLabel>
                        <InputField type="email" required value={statutoryForm.philhealthEmail} onChange={(e) => updateStatutoryField("philhealthEmail", e.target.value)} placeholder="philhealth@example.com" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Postal Code</FieldLabel>
                        <InputField required value={statutoryForm.philhealthPostalCode} onChange={(e) => updateStatutoryField("philhealthPostalCode", formatPostalCode(e.target.value))} placeholder="0000" maxLength={4} />
                      </label>
                    </div>
                  </Section>
                  <Section title="Pag-IBIG Information" helper="HDMF profile">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <FieldLabel required>Pag-IBIG Employer Number</FieldLabel>
                        <InputField required value={statutoryForm.pagibigEmployerNo} onChange={(e) => updateStatutoryField("pagibigEmployerNo", formatEmployerNumber(e.target.value))} placeholder="Digits only" maxLength={12} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Branch Code</FieldLabel>
                        <InputField value={statutoryForm.pagibigBranchCode} onChange={(e) => updateStatutoryField("pagibigBranchCode", formatBranchCode(e.target.value))} placeholder="0000" maxLength={4} />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Pag-IBIG Contact Person</FieldLabel>
                        <InputField required value={statutoryForm.pagibigContactPerson} onChange={(e) => updateStatutoryField("pagibigContactPerson", e.target.value)} placeholder="Contact person" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel required>Pag-IBIG Contact Email</FieldLabel>
                        <InputField type="email" required value={statutoryForm.pagibigContactEmail} onChange={(e) => updateStatutoryField("pagibigContactEmail", e.target.value)} placeholder="pagibig@example.com" />
                      </label>
                    </div>
                  </Section>
                </div>
                <aside className="space-y-5">
                  <Section title="Save Changes" helper="System-wide record">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-800">
                        Verify employer registration details before saving.
                      </div>
                      <div className="flex flex-col gap-3">
                        <PrimaryButton type="button" onClick={handleSaveStatutory}>
                          <Save className="h-4 w-4" aria-hidden="true" />Save Statutory Information
                        </PrimaryButton>
                        <SecondaryButton type="button" onClick={handleCancelStatutory}>
                          <X className="h-4 w-4" aria-hidden="true" />Cancel
                        </SecondaryButton>
                      </div>
                    </div>
                  </Section>
                </aside>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Agency progress cards */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <AgencyCard title="BIR" helper="Tax registration" progress={agencyStats.bir} />
                  <AgencyCard title="SSS" helper="Coverage details" progress={agencyStats.sss} />
                  <AgencyCard title="PhilHealth" helper="Health coverage" progress={agencyStats.philhealth} />
                  <AgencyCard title="Pag-IBIG" helper="HDMF employer data" progress={agencyStats.pagibig} />
                </div>
                {/* BIR */}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">BIR / Tax Information</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <ReadonlyBox label="Company TIN" value={displayStatutory.companyTin} />
                    <ReadonlyBox label="RDO Code" value={displayStatutory.rdoCode} />
                    <ReadonlyBox label="BIR Contact Email" value={displayStatutory.birContactEmail} />
                  </div>
                </div>
                {/* SSS / PhilHealth / Pag-IBIG side-by-side */}
                <div className="grid gap-5 xl:grid-cols-3">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">SSS</p>
                    <div className="grid gap-2">
                      <ReadonlyBox label="SSS Employer Number" value={displayStatutory.sssEmployerNo} />
                      <ReadonlyBox label="Date of Coverage" value={displayStatutory.sssDateOfCoverage} />
                      <ReadonlyBox label="Contact Person" value={displayStatutory.sssContactPerson} />
                      <ReadonlyBox label="Contact Email" value={displayStatutory.sssContactEmail} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">PhilHealth</p>
                    <div className="grid gap-2">
                      <ReadonlyBox label="PhilHealth Employer Number" value={displayStatutory.philhealthEmployerNo} />
                      <ReadonlyBox label="Contact Number" value={displayStatutory.philhealthContactNumber} />
                      <ReadonlyBox label="Email Address" value={displayStatutory.philhealthEmail} />
                      <ReadonlyBox label="Postal Code" value={displayStatutory.philhealthPostalCode} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pag-IBIG</p>
                    <div className="grid gap-2">
                      <ReadonlyBox label="Pag-IBIG Employer Number" value={displayStatutory.pagibigEmployerNo} />
                      <ReadonlyBox label="Branch Code" value={displayStatutory.pagibigBranchCode} />
                      <ReadonlyBox label="Contact Person" value={displayStatutory.pagibigContactPerson} />
                      <ReadonlyBox label="Contact Email" value={displayStatutory.pagibigContactEmail} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* ── 3. Payroll Signatories ── */}
          <AccordionSection
            id="signatories"
            title="Payroll Signatories"
            helper="Prepared · Checked · Approved · BIR Representative"
            badge={
              isEditingSignatories
                ? <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-[#0a4f8f]">Editing</span>
                : <StatusBadge complete={signatoryProgress.complete} />
            }
            action={!isEditingSignatories ? (
              <button type="button" onClick={handleEditSignatories} className={accordionActionClassName}>
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
            ) : null}
            isOpen={openSections.has("signatories")}
            onToggle={toggleSection}
          >
            {isEditingSignatories ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel required>Prepared By Name</FieldLabel>
                    <InputField required value={signatoryForm.preparedByName} onChange={(e) => updateSignatoryField("preparedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Prepared By Position</FieldLabel>
                    <InputField required value={signatoryForm.preparedByPosition} onChange={(e) => updateSignatoryField("preparedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Checked By Name</FieldLabel>
                    <InputField required value={signatoryForm.checkedByName} onChange={(e) => updateSignatoryField("checkedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Checked By Position</FieldLabel>
                    <InputField required value={signatoryForm.checkedByPosition} onChange={(e) => updateSignatoryField("checkedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Approved By Name</FieldLabel>
                    <InputField required value={signatoryForm.approvedByName} onChange={(e) => updateSignatoryField("approvedByName", e.target.value)} placeholder="Name" />
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Approved By Position</FieldLabel>
                    <InputField required value={signatoryForm.approvedByPosition} onChange={(e) => updateSignatoryField("approvedByPosition", e.target.value)} placeholder="Position" />
                  </label>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">BIR Representative</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-2">
                      <FieldLabel required>Authorized Representative Name</FieldLabel>
                      <InputField required value={signatoryForm.authorizedRepName} onChange={(e) => updateSignatoryField("authorizedRepName", e.target.value)} placeholder="Name" />
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel required>Authorized Representative Position</FieldLabel>
                      <InputField required value={signatoryForm.authorizedRepPosition} onChange={(e) => updateSignatoryField("authorizedRepPosition", e.target.value)} placeholder="Position" />
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel required>Authorized Representative TIN</FieldLabel>
                      <InputField required value={signatoryForm.authorizedRepTin} onChange={(e) => updateSignatoryField("authorizedRepTin", formatTin(e.target.value))} placeholder="000-000-000-00000" maxLength={17} />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <PersonCard role="Prepared By" name={displaySig.preparedByName} position={displaySig.preparedByPosition} />
                <PersonCard role="Checked By" name={displaySig.checkedByName} position={displaySig.checkedByPosition} />
                <PersonCard role="Approved By" name={displaySig.approvedByName} position={displaySig.approvedByPosition} />
                <PersonCard role="BIR Representative" name={displaySig.authorizedRepName} position={displaySig.authorizedRepPosition} detailLabel="TIN" detailValue={displaySig.authorizedRepTin} />
              </div>
            )}
          </AccordionSection>

          {/* ── 4. Signature Uploads ── */}
          <AccordionSection
            id="signatures"
            title="Signature Uploads"
            helper="Approval chain — Prepared, Checked, Approved, Authorized"
            badge={
              !isEditingSignatories ? (
                (() => {
                  const uploaded = [displaySig.preparedBySignature, displaySig.checkedBySignature, displaySig.approvedBySignature, displaySig.authorizedRepSignature].filter(Boolean).length;
                  return uploaded === 4
                    ? <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-[#0a4f8f]"><CheckCircle2 className="h-3.5 w-3.5" />All uploaded</span>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"><ShieldCheck className="h-3.5 w-3.5" />{uploaded}/4 uploaded</span>;
                })()
              ) : null
            }
            action={!isEditingSignatories ? (
              <button type="button" onClick={handleEditSignatories} className={accordionActionClassName}>
                <Pencil className="h-3.5 w-3.5" />Edit
              </button>
            ) : null}
            isOpen={openSections.has("signatures")}
            onToggle={toggleSection}
          >
            {isEditingSignatories ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <FieldLabel required>Prepared By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("preparedBySignature", e)} />
                    <HelperText>Clean image on white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Checked By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("checkedBySignature", e)} />
                    <HelperText>Clean image on white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Approved By Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("approvedBySignature", e)} />
                    <HelperText>Clean image on white or transparent background.</HelperText>
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel required>Authorized Representative Signature</FieldLabel>
                    <InputField type="file" accept="image/*" onChange={(e) => handleSignatureUpload("authorizedRepSignature", e)} />
                    <HelperText>Clean image on white or transparent background.</HelperText>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SignaturePreview label="Prepared By" value={signatoryForm.preparedBySignature} />
                  <SignaturePreview label="Checked By" value={signatoryForm.checkedBySignature} />
                  <SignaturePreview label="Approved By" value={signatoryForm.approvedBySignature} />
                  <SignaturePreview label="Authorized Rep" value={signatoryForm.authorizedRepSignature} />
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <SignatureGalleryItem role="Prepared By" name={displaySig.preparedByName} value={displaySig.preparedBySignature} />
                <SignatureGalleryItem role="Checked By" name={displaySig.checkedByName} value={displaySig.checkedBySignature} />
                <SignatureGalleryItem role="Approved By" name={displaySig.approvedByName} value={displaySig.approvedBySignature} />
                <SignatureGalleryItem role="Authorized Rep" name={displaySig.authorizedRepName} value={displaySig.authorizedRepSignature} />
              </div>
            )}
          </AccordionSection>

          {/* Signatories save bar — appears below accordion when editing signatories */}
          {isEditingSignatories && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 shadow-[0_2px_12px_-4px_rgba(8,47,73,0.08)] ring-1 ring-amber-100/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-700">
                  <ShieldCheck className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                  Verify all fields and signatures before saving.
                </p>
                <div className="flex gap-3">
                  <PrimaryButton type="button" onClick={handleSaveSignatories}>
                    <Save className="h-4 w-4" aria-hidden="true" />Save Signatories
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={handleCancelSignatories}>
                    <X className="h-4 w-4" aria-hidden="true" />Cancel
                  </SecondaryButton>
                </div>
              </div>
            </div>
          )}

          </div>{/* /max-w-5xl */}
        </div>{/* /p-6 */}

      </div>
    </div>
  );
}
