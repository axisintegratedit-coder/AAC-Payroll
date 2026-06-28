"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { canAccessAdminPageAsync } from "@/lib/adminAuth";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { getConfigItem, setConfigItem } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";
import { logAudit } from "@/lib/auditTrail";
import {
  type CutoffDefinition,
  type SSSConfig,
  type SSSBracketRow,
  type PhilHealthConfig,
  type PagIBIGConfig,
  type BIRConfig,
  type BIRBracketRow,
  type ContributionBasisToggles,
  type PremiumMultipliersConfig,
  type PremiumMultiplierRow,
  SEED_CUTOFF_DEFINITIONS,
  SEED_SSS_CONFIG,
  SEED_PHILHEALTH_CONFIG,
  SEED_PAGIBIG_CONFIG,
  SEED_BIR_CONFIG,
  SEED_CONTRIBUTION_BASIS_TOGGLES,
  SEED_PREMIUM_MULTIPLIERS,
} from "@/lib/payrollSettingsTypes";
import {
  SEED_STATUTORY_SETTINGS,
  SEED_EFFECTIVE_SSS_CONFIG,
  buildSSSBrackets,
  type StatutorySettings,
} from "@/lib/statutory";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-PH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pct(n: number) {
  return (n * 100).toFixed(2) + "%";
}

function parseNum(s: string): number {
  const v = parseFloat(s.replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}

type ConfirmModalState = {
  title: string;
  message: string;
  actionLabel: string;
  resolve: (confirmed: boolean) => void;
};

type PayrollSettingsUiContextValue = {
  confirmAction: (title: string, message: string, actionLabel?: string) => Promise<boolean>;
  setPageSaving: (saving: boolean) => void;
};

const PayrollSettingsUiContext = createContext<PayrollSettingsUiContextValue | null>(null);

function usePayrollSettingsUi() {
  const value = useContext(PayrollSettingsUiContext);
  if (!value) {
    return {
      confirmAction: async () => true,
      setPageSaving: () => undefined,
    };
  }
  return value;
}

function emitSettingsUpdated(key: string) {
  window.dispatchEvent(new Event(`${key}-updated`));
  window.dispatchEvent(new Event("payroll-settings-rules-updated"));
}

const seedPremiumBucketNames = SEED_PREMIUM_MULTIPLIERS.rows.map((row) => row.bucket).join("|");

function normalizeSavedCutoffDefinitions(items: CutoffDefinition[]) {
  return items.map((item) =>
    item.id === "30th" || item.label === "30th / 31st"
      ? { ...item, id: "30th/31st", label: "30th/31st" }
      : item
  );
}

function hasCurrentPremiumBucketShape(config: PremiumMultipliersConfig) {
  return config.rows.map((row) => row.bucket).join("|") === seedPremiumBucketNames;
}

function hasCurrentSssBracketFloor(config: SSSConfig) {
  return !config.brackets.some((row) => row.msc < config.globalFloor);
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 4px 24px -8px rgba(15,23,42,0.08)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "18px 22px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b", fontWeight: 500 }}>{subtitle}</p>
          )}
        </div>
        {open ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "20px 22px" }}>{children}</div>
      )}
    </div>
  );
}

function DisclaimerBadge({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
      }}
    >
      <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, fontSize: 12, color: "#92400e", fontWeight: 600, lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}

function SaveBar({
  onSave,
  onCancel,
  saving,
}: {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid #f1f5f9",
        justifyContent: "flex-end",
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        <X size={14} /> Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-[var(--theme-accent)] px-5 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-50"
      >
        <Save size={14} /> {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <label style={{ width: 260, fontSize: 13, fontWeight: 600, color: "#334155", flexShrink: 0 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  step = "0.01",
  min,
  style,
}: {
  value: number | string;
  onChange: (v: string) => void;
  step?: string;
  min?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 140,
        padding: "6px 10px",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        color: "#0f172a",
        outline: "none",
        ...style,
      }}
    />
  );
}

// ─── Section 1: Cutoff Definitions ───────────────────────────────────────────

function CutoffSection({ theme }: { theme: AppTheme }) {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [rows, setRows] = useState<CutoffDefinition[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CutoffDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getConfigItem<{ items: CutoffDefinition[] }>(storageKeys.cutoffDefinitions, { items: [] }).then((res) => {
      const savedItems = res.items?.length ? normalizeSavedCutoffDefinitions(res.items) : [];
      const items = savedItems.length ? savedItems : SEED_CUTOFF_DEFINITIONS;
      setRows(items);
      if (!res.items?.length || JSON.stringify(savedItems) !== JSON.stringify(res.items || [])) {
        setConfigItem(storageKeys.cutoffDefinitions, { items });
        emitSettingsUpdated(storageKeys.cutoffDefinitions);
      }
      setLoaded(true);
    });
  }, []);

  function startEdit() {
    setDraft(rows.map((r) => ({ ...r })));
    setEditing(true);
  }

  function cancel() {
    setDraft([]);
    setEditing(false);
  }

  function updateDraft(idx: number, key: keyof CutoffDefinition, val: string) {
    setDraft((d) => d.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  }

  function addRow() {
    setDraft((d) => [
      ...d,
      { id: `cutoff-${Date.now()}`, label: "", coverageStartRule: "", coverageEndRule: "" },
    ]);
  }

  function deleteRow(idx: number) {
    setDraft((d) => d.filter((_, i) => i !== idx));
  }

  async function save() {
    for (const r of draft) {
      if (!r.id.trim() || !r.label.trim() || !r.coverageStartRule.trim() || !r.coverageEndRule.trim()) {
        window.alert("All fields are required for each cutoff row.");
        return;
      }
    }
    const confirmed = await confirmAction(
      "Save cutoff definitions",
      "Payroll runs use these cutoff rules to resolve coverage dates. Save these changes?",
      "Save cutoffs"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.cutoffDefinitions, { items: draft });
      emitSettingsUpdated(storageKeys.cutoffDefinitions);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "cutoffDefinitions", entityName: "Cutoff Definitions" });
      setRows(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  const themeColor = normalizeTheme(theme).accentColor;

  if (!loaded) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  return (
    <div>
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["ID", "Label", "Coverage Start Rule", "Coverage End Rule", editing ? "Actions" : ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "9px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(editing ? draft : rows).map((row, idx) => (
              <tr key={row.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {editing ? (
                  <>
                    <td style={{ padding: "8px 12px" }}>
                      <input
                        value={row.id}
                        onChange={(e) => updateDraft(idx, "id", e.target.value)}
                        style={{ width: 100, padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input
                        value={row.label}
                        onChange={(e) => updateDraft(idx, "label", e.target.value)}
                        style={{ width: 120, padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input
                        value={row.coverageStartRule}
                        onChange={(e) => updateDraft(idx, "coverageStartRule", e.target.value)}
                        style={{ width: 220, padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <input
                        value={row.coverageEndRule}
                        onChange={(e) => updateDraft(idx, "coverageEndRule", e.target.value)}
                        style={{ width: 220, padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: themeColor }}>{row.id}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#0f172a" }}>{row.label}</td>
                    <td style={{ padding: "10px 12px", color: "#334155" }}>{row.coverageStartRule}</td>
                    <td style={{ padding: "10px 12px", color: "#334155" }}>{row.coverageEndRule}</td>
                    <td />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <>
          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:bg-slate-100"
          >
            <Plus size={13} /> Add row
          </button>
          <SaveBar onSave={save} onCancel={cancel} saving={saving} />
        </>
      )}
    </div>
  );
}

// ─── Section 2a: SSS Table ────────────────────────────────────────────────────

function SSSSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<SSSConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SSSConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<SSSConfig>(storageKeys.sssConfig, SEED_SSS_CONFIG).then((res) => {
      const isDefault = !res.brackets?.length || !hasCurrentSssBracketFloor(res);
      const cfg = isDefault ? SEED_SSS_CONFIG : res;
      setConfig(cfg);
      if (isDefault) {
        setConfigItem(storageKeys.sssConfig, SEED_SSS_CONFIG);
        emitSettingsUpdated(storageKeys.sssConfig);
      }
    });
  }, []);

  function startEdit() {
    if (!config) return;
    setDraft({ ...config, brackets: config.brackets.map((b) => ({ ...b })) });
    setEditing(true);
  }

  function cancel() {
    setDraft(null);
    setEditing(false);
  }

  function updateBracket(idx: number, key: keyof SSSBracketRow, val: string) {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      const brackets = d.brackets.map((b, i) =>
        i === idx ? { ...b, [key]: key === "id" || key === "rangeLabel" ? val : parseNum(val) } : b
      );
      return { ...d, brackets };
    });
  }

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save SSS bracket table",
      "The payroll engine will read this Monthly Salary Credit table for SSS, EC, and WISP/MPF values. Save these changes?",
      "Save SSS table"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.sssConfig, draft);
      emitSettingsUpdated(storageKeys.sssConfig);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "sssConfig", entityName: "SSS Contribution Table" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const display = editing && draft ? draft : config;

  return (
    <div>
      <DisclaimerBadge text={config.disclaimer} />

      {/* Global params row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        {[
          { label: "Floor (MSC)", value: `₱${fmt(display.globalFloor, 0)}` },
          { label: "Ceiling (MSC)", value: `₱${fmt(display.globalCeiling, 0)}` },
          { label: "Employee rate", value: pct(display.employeeRate) },
          { label: "Employer rate", value: pct(display.employerRate) },
          { label: "EC threshold", value: `₱${fmt(display.ecThreshold, 0)}` },
          { label: "EC below threshold", value: `₱${fmt(display.ecBelow, 0)}` },
          { label: "EC at/above threshold", value: `₱${fmt(display.ecAtOrAbove, 0)}` },
          { label: "WISP threshold", value: `₱${fmt(display.wispThreshold, 0)}` },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            <p style={{ margin: "2px 0 0", fontWeight: 700, color: "#0f172a" }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit brackets
          </button>
        ) : null}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Range", "MSC (₱)", "Employee (₱)", "Employer (₱)", "EC (₱)", "WISP (₱)", "Total Monthly (₱)"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h === "Range" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.brackets.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {editing ? (
                  <>
                    <td style={{ padding: "5px 8px" }}>
                      <input
                        value={row.rangeLabel}
                        onChange={(e) => updateBracket(idx, "rangeLabel", e.target.value)}
                        style={{ width: 200, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    {(["msc", "employeeContrib", "employerContrib", "ec", "wisp", "totalMonthlyContrib"] as const).map((key) => (
                      <td key={key} style={{ padding: "5px 8px" }}>
                        <input
                          type="number"
                          step="0.01"
                          value={row[key]}
                          onChange={(e) => updateBracket(idx, key, e.target.value)}
                          style={{ width: 90, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right" }}
                        />
                      </td>
                    ))}
                  </>
                ) : (
                  <>
                    <td style={{ padding: "7px 10px", color: "#334155", fontWeight: 500 }}>{row.rangeLabel}</td>
                    {[row.msc, row.employeeContrib, row.employerContrib, row.ec, row.wisp, row.totalMonthlyContrib].map((v, vi) => (
                      <td key={vi} style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                        {fmt(v)}
                      </td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <SaveBar onSave={save} onCancel={cancel} saving={saving} />}
    </div>
  );
}

// ─── Section 2b: PhilHealth ───────────────────────────────────────────────────

function PhilHealthSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<PhilHealthConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PhilHealthConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<PhilHealthConfig>(storageKeys.philhealthConfig, SEED_PHILHEALTH_CONFIG).then((res) => {
      const cfg = res.rate !== undefined ? res : SEED_PHILHEALTH_CONFIG;
      setConfig(cfg);
      if (res.rate === undefined) {
        setConfigItem(storageKeys.philhealthConfig, SEED_PHILHEALTH_CONFIG);
        emitSettingsUpdated(storageKeys.philhealthConfig);
      }
    });
  }, []);

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save PhilHealth configuration",
      "The payroll engine will read this rate, floor, ceiling, and split for PhilHealth computations. Save these changes?",
      "Save PhilHealth"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.philhealthConfig, draft);
      emitSettingsUpdated(storageKeys.philhealthConfig);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "philhealthConfig", entityName: "PhilHealth Configuration" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const d = editing && draft ? draft : config;

  return (
    <div>
      <DisclaimerBadge text={config.disclaimer} />
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => { setDraft({ ...config }); setEditing(true); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      )}
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <FieldRow label="Contribution rate">
          {editing && draft ? (
            <><NumInput value={draft.rate} onChange={(v) => setDraft((d) => d ? { ...d, rate: parseNum(v) } : d)} step="0.001" /><span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>({pct(draft.rate)} of monthly basic)</span></>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.rate)} of monthly basic</span>
          )}
        </FieldRow>
        <FieldRow label="Salary floor (min basis)">
          {editing && draft ? (
            <NumInput value={draft.floor} onChange={(v) => setDraft((d) => d ? { ...d, floor: parseNum(v) } : d)} step="1" />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.floor, 0)}</span>
          )}
        </FieldRow>
        <FieldRow label="Salary ceiling (max basis)">
          {editing && draft ? (
            <NumInput value={draft.ceiling} onChange={(v) => setDraft((d) => d ? { ...d, ceiling: parseNum(v) } : d)} step="1" />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.ceiling, 0)}</span>
          )}
        </FieldRow>
        <FieldRow label="Min monthly contribution">
          {editing && draft ? (
            <NumInput value={draft.minMonthly} onChange={(v) => setDraft((d) => d ? { ...d, minMonthly: parseNum(v) } : d)} step="1" />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.minMonthly, 0)}</span>
          )}
        </FieldRow>
        <FieldRow label="Max monthly contribution">
          {editing && draft ? (
            <NumInput value={draft.maxMonthly} onChange={(v) => setDraft((d) => d ? { ...d, maxMonthly: parseNum(v) } : d)} step="1" />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.maxMonthly, 0)}</span>
          )}
        </FieldRow>
        <FieldRow label="Employee share">
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.employeeSplit)}</span>
        </FieldRow>
        <FieldRow label="Employer share">
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.employerSplit)}</span>
        </FieldRow>
      </div>
      {editing && <SaveBar onSave={save} onCancel={() => { setDraft(null); setEditing(false); }} saving={saving} />}
    </div>
  );
}

// ─── Section 2c: Pag-IBIG ─────────────────────────────────────────────────────

function PagIBIGSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<PagIBIGConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PagIBIGConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<PagIBIGConfig>(storageKeys.pagibigConfig, SEED_PAGIBIG_CONFIG).then((res) => {
      const cfg = res.employeeRate !== undefined ? res : SEED_PAGIBIG_CONFIG;
      setConfig(cfg);
      if (res.employeeRate === undefined) {
        setConfigItem(storageKeys.pagibigConfig, SEED_PAGIBIG_CONFIG);
        emitSettingsUpdated(storageKeys.pagibigConfig);
      }
    });
  }, []);

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save Pag-IBIG configuration",
      "The payroll engine will read these Pag-IBIG / HDMF rates, caps, and low-salary rules. Save these changes?",
      "Save Pag-IBIG"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.pagibigConfig, draft);
      emitSettingsUpdated(storageKeys.pagibigConfig);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "pagibigConfig", entityName: "Pag-IBIG Configuration" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const d = editing && draft ? draft : config;

  function up(key: keyof PagIBIGConfig, val: string) {
    setDraft((prev) => prev ? { ...prev, [key]: parseNum(val) } : prev);
  }

  return (
    <div>
      <DisclaimerBadge text={config.disclaimer} />
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => { setDraft({ ...config }); setEditing(true); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      )}
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <FieldRow label="Employee contribution rate">
          {editing && draft ? <NumInput value={draft.employeeRate} onChange={(v) => up("employeeRate", v)} step="0.001" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.employeeRate)}</span>}
        </FieldRow>
        <FieldRow label="Employer contribution rate">
          {editing && draft ? <NumInput value={draft.employerRate} onChange={(v) => up("employerRate", v)} step="0.001" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.employerRate)}</span>}
        </FieldRow>
        <FieldRow label="Max Fund Salary (basis cap)">
          {editing && draft ? <NumInput value={draft.maxFundSalary} onChange={(v) => up("maxFundSalary", v)} step="1" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.maxFundSalary, 0)}</span>}
        </FieldRow>
        <FieldRow label="Monthly cap — employee">
          {editing && draft ? <NumInput value={draft.monthlyCapEmployee} onChange={(v) => up("monthlyCapEmployee", v)} step="1" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.monthlyCapEmployee, 0)}</span>}
        </FieldRow>
        <FieldRow label="Monthly cap — employer">
          {editing && draft ? <NumInput value={draft.monthlyCapEmployer} onChange={(v) => up("monthlyCapEmployer", v)} step="1" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.monthlyCapEmployer, 0)}</span>}
        </FieldRow>
        <FieldRow label="Semi-monthly cap (per cutoff)">
          {editing && draft ? <NumInput value={draft.semiMonthlyCap} onChange={(v) => up("semiMonthlyCap", v)} step="1" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.semiMonthlyCap, 0)}</span>}
        </FieldRow>
        <FieldRow label="Low-salary ceiling">
          {editing && draft ? <NumInput value={draft.lowSalaryCeiling} onChange={(v) => up("lowSalaryCeiling", v)} step="1" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.lowSalaryCeiling, 0)}</span>}
        </FieldRow>
        <FieldRow label="Employee rate if salary ≤ ceiling">
          {editing && draft ? <NumInput value={draft.lowSalaryEmployeeRate} onChange={(v) => up("lowSalaryEmployeeRate", v)} step="0.001" /> : <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{pct(d.lowSalaryEmployeeRate)}</span>}
        </FieldRow>
      </div>
      {editing && <SaveBar onSave={save} onCancel={() => { setDraft(null); setEditing(false); }} saving={saving} />}
    </div>
  );
}

// ─── Section 2d: BIR ─────────────────────────────────────────────────────────

function BIRSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<BIRConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BIRConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<BIRConfig>(storageKeys.birConfig, SEED_BIR_CONFIG).then((res) => {
      const cfg = res.brackets?.length ? res : SEED_BIR_CONFIG;
      setConfig(cfg);
      if (!res.brackets?.length) {
        setConfigItem(storageKeys.birConfig, SEED_BIR_CONFIG);
        emitSettingsUpdated(storageKeys.birConfig);
      }
    });
  }, []);

  function updateBracket(idx: number, key: keyof BIRBracketRow, val: string) {
    setDraft((d) => {
      if (!d) return d;
      const brackets = d.brackets.map((b, i) => {
        if (i !== idx) return b;
        if (key === "id" || key === "label") return { ...b, [key]: val };
        if (key === "incomeCeiling") {
          return { ...b, incomeCeiling: val === "" || val === "null" ? null : parseNum(val) };
        }
        return { ...b, [key]: parseNum(val) };
      });
      return { ...d, brackets };
    });
  }

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save BIR withholding brackets",
      "The payroll engine will read this semi-monthly TRAIN bracket table for withholding tax. Save these changes?",
      "Save BIR table"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.birConfig, draft);
      emitSettingsUpdated(storageKeys.birConfig);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "birConfig", entityName: "BIR Withholding Tax Brackets" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const display = editing && draft ? draft : config;

  return (
    <div>
      <DisclaimerBadge text={config.disclaimer} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft({ ...config, brackets: config.brackets.map((b) => ({ ...b })) }); setEditing(true); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit brackets
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Bracket", "Income Floor (₱)", "Income Ceiling (₱)", "Base Tax (₱)", "Excess Rate"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h === "Bracket" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.brackets.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {editing ? (
                  <>
                    <td style={{ padding: "5px 8px" }}>
                      <input
                        value={row.label}
                        onChange={(e) => updateBracket(idx, "label", e.target.value)}
                        style={{ width: 240, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" value={row.incomeFloor} onChange={(e) => updateBracket(idx, "incomeFloor", e.target.value)} style={{ width: 110, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input
                        value={row.incomeCeiling === null ? "" : row.incomeCeiling}
                        placeholder="no ceiling"
                        onChange={(e) => updateBracket(idx, "incomeCeiling", e.target.value)}
                        style={{ width: 110, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" step="0.01" value={row.baseTax} onChange={(e) => updateBracket(idx, "baseTax", e.target.value)} style={{ width: 110, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right" }} />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" step="0.01" min="0" max="1" value={row.excessRate} onChange={(e) => updateBracket(idx, "excessRate", e.target.value)} style={{ width: 80, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right" }} />
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "9px 12px", color: "#334155", fontWeight: 500 }}>{row.label}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmt(row.incomeFloor)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{row.incomeCeiling === null ? "—" : fmt(row.incomeCeiling)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmt(row.baseTax)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{pct(row.excessRate)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <SaveBar onSave={save} onCancel={() => { setDraft(null); setEditing(false); }} saving={saving} />}
    </div>
  );
}

// ─── Section 3: Contribution Basis Toggles ────────────────────────────────────

function ContributionBasisSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<ContributionBasisToggles | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContributionBasisToggles | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<ContributionBasisToggles>(storageKeys.contributionBasisToggles, SEED_CONTRIBUTION_BASIS_TOGGLES).then((res) => {
      const cfg = res.hdmfFixedMonthlyAmount !== undefined ? res : SEED_CONTRIBUTION_BASIS_TOGGLES;
      setConfig(cfg);
      if (res.hdmfFixedMonthlyAmount === undefined) {
        setConfigItem(storageKeys.contributionBasisToggles, SEED_CONTRIBUTION_BASIS_TOGGLES);
        emitSettingsUpdated(storageKeys.contributionBasisToggles);
      }
    });
  }, []);

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save contribution basis toggles",
      "These global rules control SSS, PhilHealth, and HDMF contribution bases. Save these changes?",
      "Save basis rules"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.contributionBasisToggles, draft);
      emitSettingsUpdated(storageKeys.contributionBasisToggles);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "contributionBasisToggles", entityName: "Contribution Basis Toggles" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const d = editing && draft ? draft : config;

  function toggle(key: keyof ContributionBasisToggles) {
    setDraft((prev) => prev ? { ...prev, [key]: !prev[key as keyof ContributionBasisToggles] } : prev);
  }

  function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
    return (
      <button
        type="button"
        onClick={editing ? onChange : undefined}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: value ? "var(--theme-accent)" : "#cbd5e1",
          border: "none",
          cursor: editing ? "pointer" : "default",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    );
  }

  return (
    <div>
      {!editing && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => { setDraft({ ...config }); setEditing(true); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit
          </button>
        </div>
      )}
      <div style={{ display: "grid", gap: 14, maxWidth: 600 }}>
        {/* SSS toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <Toggle value={d.sssBasedOnNetBasicPay} onChange={() => toggle("sssBasedOnNetBasicPay")} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>SSS basis: Net Basic Pay</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              {d.sssBasedOnNetBasicPay ? "ON — SSS MSC is derived from net basic pay (after absences/late/undertime)." : "OFF — SSS MSC is derived from gross basic pay."}
            </p>
          </div>
        </div>

        {/* PhilHealth toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <Toggle value={d.philhealthBasedOnGrossBasicPay} onChange={() => toggle("philhealthBasedOnGrossBasicPay")} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>PhilHealth basis: Gross Basic Pay</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              {d.philhealthBasedOnGrossBasicPay ? "ON — PhilHealth premium is computed on gross basic pay before deductions." : "OFF — PhilHealth premium is computed on net basic pay."}
            </p>
          </div>
        </div>

        {/* HDMF fixed toggle + amounts */}
        <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Toggle value={d.hdmfFixed} onChange={() => toggle("hdmfFixed")} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Pag-IBIG / HDMF: Fixed amount</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                {d.hdmfFixed ? "ON — HDMF contribution is a fixed amount (ignores rate table for this employee group)." : "OFF — HDMF uses the standard percentage-rate table."}
              </p>
            </div>
          </div>
          {d.hdmfFixed && (
            <div style={{ marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <FieldRow label="Fixed monthly amount (₱)">
                {editing && draft ? (
                  <NumInput value={draft.hdmfFixedMonthlyAmount} onChange={(v) => setDraft((prev) => prev ? { ...prev, hdmfFixedMonthlyAmount: parseNum(v) } : prev)} step="1" />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.hdmfFixedMonthlyAmount, 0)}</span>
                )}
              </FieldRow>
              <FieldRow label="Fixed per-cutoff amount (₱)">
                {editing && draft ? (
                  <NumInput value={draft.hdmfFixedCutoffAmount} onChange={(v) => setDraft((prev) => prev ? { ...prev, hdmfFixedCutoffAmount: parseNum(v) } : prev)} step="1" />
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₱{fmt(d.hdmfFixedCutoffAmount, 0)}</span>
                )}
              </FieldRow>
            </div>
          )}
        </div>
      </div>
      {editing && <SaveBar onSave={save} onCancel={() => { setDraft(null); setEditing(false); }} saving={saving} />}
    </div>
  );
}

// ─── Section 4: Premium Multipliers ──────────────────────────────────────────

function PremiumMultipliersSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [config, setConfig] = useState<PremiumMultipliersConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PremiumMultipliersConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<PremiumMultipliersConfig>(storageKeys.premiumMultipliers, SEED_PREMIUM_MULTIPLIERS).then((res) => {
      const isDefault = !res.rows?.length || !hasCurrentPremiumBucketShape(res);
      const cfg = isDefault ? SEED_PREMIUM_MULTIPLIERS : res;
      setConfig(cfg);
      if (isDefault) {
        setConfigItem(storageKeys.premiumMultipliers, SEED_PREMIUM_MULTIPLIERS);
        emitSettingsUpdated(storageKeys.premiumMultipliers);
      }
    });
  }, []);

  function recomputeFinal(row: PremiumMultiplierRow, method: "multiplicative" | "additive"): number {
    if (method === "multiplicative") return parseFloat((row.baseMultiplier * row.ndMultiplier).toFixed(4));
    return parseFloat((row.baseMultiplier + (row.ndMultiplier - 1)).toFixed(4));
  }

  function updateRow(idx: number, key: keyof PremiumMultiplierRow, val: string) {
    setDraft((d) => {
      if (!d) return d;
      const rows = d.rows.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [key]: key === "id" || key === "bucket" || key === "notes" ? val : parseNum(val) };
        return { ...updated, finalMultiplier: recomputeFinal(updated, d.ndStackingMethod) };
      });
      return { ...d, rows };
    });
  }

  function setMethod(method: "multiplicative" | "additive") {
    setDraft((d) => {
      if (!d) return d;
      const rows = d.rows.map((r) => ({ ...r, finalMultiplier: recomputeFinal(r, method) }));
      return { ...d, ndStackingMethod: method, rows };
    });
  }

  async function save() {
    if (!draft) return;
    const confirmed = await confirmAction(
      "Save premium multiplier table",
      "The payroll engine will look up imported SproutHR premium bucket names in this table. Save these changes?",
      "Save multipliers"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      await setConfigItem(storageKeys.premiumMultipliers, draft);
      emitSettingsUpdated(storageKeys.premiumMultipliers);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "premiumMultipliers", entityName: "Premium Multiplier Table" });
      setConfig(draft);
      setEditing(false);
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  }

  if (!config) return <p style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>Loading…</p>;

  const display = editing && draft ? draft : config;

  return (
    <div>
      <DisclaimerBadge text={config.disclaimer} />

      {/* ND stacking method */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Night differential stacking:</span>
        {(["multiplicative", "additive"] as const).map((method) => (
          <button
            key={method}
            type="button"
            onClick={editing ? () => setMethod(method) : undefined}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid",
              fontSize: 12,
              fontWeight: 700,
              cursor: editing ? "pointer" : "default",
              borderColor: display.ndStackingMethod === method ? "var(--theme-accent)" : "#cbd5e1",
              background: display.ndStackingMethod === method ? "color-mix(in srgb, var(--theme-accent) 10%, #fff)" : "#f8fafc",
              color: display.ndStackingMethod === method ? "var(--theme-accent)" : "#64748b",
            }}
          >
            {method === "multiplicative" ? "Multiplicative (base × ND mult)" : "Additive (base + (ND mult − 1))"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft({ ...config, rows: config.rows.map((r) => ({ ...r })) }); setEditing(true); }}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil size={13} /> Edit multipliers
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["SproutHR Bucket", "Base Mult.", "ND Mult.", "Final Mult.", "Notes"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: h === "SproutHR Bucket" || h === "Notes" ? "left" : "right",
                    fontWeight: 700,
                    color: "#475569",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    borderBottom: "1px solid #e2e8f0",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.rows.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {editing ? (
                  <>
                    <td style={{ padding: "5px 8px" }}>
                      <input value={row.bucket} onChange={(e) => updateRow(idx, "bucket", e.target.value)} style={{ width: 180, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, color: "#0f172a" }} />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" step="0.01" value={row.baseMultiplier} onChange={(e) => updateRow(idx, "baseMultiplier", e.target.value)} style={{ width: 75, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right", color: "#0f172a" }} />
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" step="0.01" value={row.ndMultiplier} onChange={(e) => updateRow(idx, "ndMultiplier", e.target.value)} style={{ width: 75, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, textAlign: "right", color: "#0f172a" }} />
                    </td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                      {fmt(row.finalMultiplier, 4)}
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input value={row.notes} onChange={(e) => updateRow(idx, "notes", e.target.value)} style={{ width: 240, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, color: "#0f172a" }} />
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#334155" }}>{row.bucket}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{row.baseMultiplier.toFixed(2)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0f172a" }}>{row.ndMultiplier.toFixed(2)}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "var(--theme-accent)" }}>{fmt(row.finalMultiplier, 4)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b", fontSize: 11 }}>{row.notes}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <SaveBar onSave={save} onCancel={() => { setDraft(null); setEditing(false); }} saving={saving} />}
    </div>
  );
}

// ─── Section 6: Boldr Statutory Engine ───────────────────────────────────────

function StatutoryEngineSection() {
  const { confirmAction, setPageSaving } = usePayrollSettingsUi();
  const [settings, setSettings] = useState<StatutorySettings>(SEED_STATUTORY_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfigItem<StatutorySettings>(storageKeys.statutorySettings, SEED_STATUTORY_SETTINGS).then((res) => {
      setSettings(res?.philhealth ? res : SEED_STATUTORY_SETTINGS);
    });
  }, []);

  const update = <K extends keyof StatutorySettings>(key: K, value: StatutorySettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    const confirmed = await confirmAction(
      "Save statutory engine settings",
      "These knobs drive SSS / PhilHealth / Pag-IBIG on every Draft run (recomputed live). Save?",
      "Save settings"
    );
    if (!confirmed) return;
    setSaving(true);
    setPageSaving(true);
    try {
      // Persist the global knobs and ensure the corrected 5% MSC-centered SSS schedule is seeded.
      await setConfigItem(storageKeys.statutorySettings, settings);
      await setConfigItem(storageKeys.sssEffectiveConfig, {
        ...SEED_EFFECTIVE_SSS_CONFIG,
        brackets: buildSSSBrackets(),
      });
      emitSettingsUpdated(storageKeys.statutorySettings);
      emitSettingsUpdated(storageKeys.sssEffectiveConfig);
      await logAudit({ action: "SAVED", entityType: "PayrollSettings", entityId: "statutorySettings", entityName: "Boldr Statutory Engine" });
    } finally {
      setSaving(false);
      setPageSaving(false);
    }
  };

  const toggleRow = (label: string, key: keyof StatutorySettings, help: string) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <input
        type="checkbox"
        checked={Boolean(settings[key])}
        onChange={(e) => update(key, e.target.checked as never)}
        style={{ marginTop: 3 }}
      />
      <span>
        <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>{help}</span>
      </span>
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#92400e" }}>
        ⚠ SSS uses the corrected 5% MSC-centered schedule (replaces the old 4.5% table). Rules taken
        verbatim from Boldr&apos;s spec. Two TODOs remain unconfirmed with Boldr (see toggles).
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {toggleRow(
          "SSS net of absence/late",
          "sssNetOfAbsenceLate",
          "DEFAULT OFF. Boldr payslips D & E showed SSS on the GROSS MSC bracket despite absences. Turn ON only if Boldr confirms absence/late is netted from the SSS base."
        )}
        {toggleRow(
          "SSS net of adjustments",
          "sssNetOfAdjustments",
          "DEFAULT ON. Sample G (-12,800 basic adj) bracketed on net 10,400 → MSC 10,500 → 525."
        )}
        {toggleRow(
          "EOM / final-pay true-up",
          "eomTrueupEnabled",
          "DEFAULT OFF. Full-month PHIC & HDMF in one EOM/final cutoff — contradicts Boldr's stated flat rules. Enable only if confirmed intended."
        )}
      </div>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
        <strong>Fixed formulas (not toggleable):</strong> SSS = 5% of MSC (bracketed from net basic) ·
        PHIC = 2.5% of <em>gross</em> basic · HDMF = ₱100/cutoff (₱200/month) · Zero rule: no attendance
        or no basic ⇒ no contributions, net floors at 0.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--theme-accent)", color: "#fff", fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ─── Section 5: A/B Rule Reference ────────────────────────────────────────────

function ABRuleSection() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          padding: "12px 16px",
        }}
      >
        <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ margin: 0, fontSize: 12, color: "#1e40af", fontWeight: 600, lineHeight: 1.5 }}>
          Read-only reference. The A/B rule governs how absence, late, and undertime deductions are applied to non-exempt employees. It is set at the company / payroll-run level and is not an editable setting here.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {[
          {
            label: "Payroll A",
            color: "#0369a1",
            bg: "#f0f9ff",
            border: "#bae6fd",
            body: "Absences, late arrivals, and undertime are deducted from Basic Salary only. All recurring allowances (rice subsidy, meal, clothing, etc.) remain whole regardless of attendance.",
            formula: "Deduction = (Basic Salary ÷ Working Days Per Month ÷ 8) × Hours Absent/Late/Undertime",
          },
          {
            label: "Payroll B",
            color: "#7c3aed",
            bg: "#faf5ff",
            border: "#ddd6fe",
            body: "Absences, late arrivals, and undertime are deducted from Basic Salary plus all recurring income (allowances included). Every pay component that recurs each period is reduced proportionally.",
            formula: "Deduction = ((Basic Salary + Recurring Allowances) ÷ Working Days Per Month ÷ 8) × Hours Absent/Late/Undertime",
          },
        ].map(({ label, color, bg, border, body, formula }) => (
          <div
            key={label}
            style={{
              background: bg,
              border: `1px solid ${border}`,
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color, letterSpacing: "-0.01em" }}>{label}</p>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "#1e293b", lineHeight: 1.6 }}>{body}</p>
            <div
              style={{
                background: "rgba(255,255,255,0.7)",
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: "8px 14px",
                fontFamily: "monospace",
                fontSize: 12,
                color: color,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              {formula}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "14px 18px",
        }}
      >
        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Scope of A vs. B
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
          The deduction mechanism is identical in both modes — per-day / per-hour reduction off the derived hourly rate. The only difference is the <strong>base</strong> the rate is applied to: A uses Basic Salary only; B uses Basic Salary plus all recurring allowances.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
          <strong>Contribution proration (SSS / PhilHealth / Pag-IBIG) is a separate concern</strong> governed by the Contribution Basis Toggles in Section 3 above (SSS on Net Basic, PhilHealth on Gross Basic, HDMF fixed amount). It is not determined by the A/B setting.
        </p>
      </div>
    </div>
  );
}

// ─── Contribution Rate Tables wrapper (4 sub-panels) ─────────────────────────

function ContributionRatesSection() {
  const [openPanel, setOpenPanel] = useState<string | null>("sss");

  const panels = [
    { id: "sss", label: "SSS", subtitle: "Monthly Salary Credit bracket table" },
    { id: "phic", label: "PhilHealth", subtitle: "Rate, floor, ceiling, split" },
    { id: "hdmf", label: "Pag-IBIG / HDMF", subtitle: "Rates, caps, low-salary rule" },
    { id: "bir", label: "BIR Withholding Tax", subtitle: "Semi-monthly TRAIN bracket table" },
  ];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {panels.map((panel) => (
        <div
          key={panel.id}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setOpenPanel(openPanel === panel.id ? null : panel.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "13px 18px",
              background: openPanel === panel.id ? "#f8fafc" : "#fff",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{panel.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{panel.subtitle}</p>
            </div>
            {openPanel === panel.id ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
          </button>
          {openPanel === panel.id && (
            <div style={{ borderTop: "1px solid #f1f5f9", padding: "18px 18px" }}>
              {panel.id === "sss" && <SSSSection />}
              {panel.id === "phic" && <PhilHealthSection />}
              {panel.id === "hdmf" && <PagIBIGSection />}
              {panel.id === "bir" && <BIRSection />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollSettingsPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [ready, setReady] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>("cutoff");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [pageSaving, setPageSaving] = useState(false);
  const confirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    async function init() {
      const access = await canAccessAdminPageAsync(["Owner", "Super User", "Payroll Admin"]);
      if (!access.allowed) { router.replace(access.redirectTo); return; }
      setReady(true);
    }
    init();
  }, [router]);

  useEffect(() => {
    async function loadTheme() {
      const saved = normalizeTheme(await getConfigItem<Partial<AppTheme>>(storageKeys.appTheme, DEFAULT_APP_THEME));
      setTheme(saved);
      applyAppTheme(saved);
    }
    loadTheme();
    window.addEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
    return () => window.removeEventListener(`${storageKeys.appTheme}-updated`, loadTheme as EventListener);
  }, []);

  const activeTheme = normalizeTheme(theme);
  const bannerOverlayAlpha = activeTheme.bannerOverlayOpacity / 100;

  function confirmAction(title: string, message: string, actionLabel = "Save changes") {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmModal({
        title,
        message,
        actionLabel,
        resolve,
      });
    });
  }

  function closeConfirmModal(confirmed: boolean) {
    const resolver = confirmResolveRef.current || confirmModal?.resolve;
    resolver?.(confirmed);
    confirmResolveRef.current = null;
    setConfirmModal(null);
  }

  if (!ready) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <p style={{ color: "#64748b", fontWeight: 600, fontSize: 14 }}>Loading payroll settings…</p>
      </main>
    );
  }

  const sections = [
    {
      id: "cutoff",
      title: "1. Cutoff Definitions",
      subtitle: "Defines coverage windows for each semi-monthly payroll run.",
      content: <CutoffSection theme={theme} />,
    },
    {
      id: "rates",
      title: "2. Contribution Rate Tables",
      subtitle: "SSS, PhilHealth, Pag-IBIG, and BIR withholding — editable, seeded from current circulars.",
      content: <ContributionRatesSection />,
    },
    {
      id: "basis",
      title: "3. Contribution Basis Toggles",
      subtitle: "Controls which salary base each agency contribution is computed on.",
      content: <ContributionBasisSection />,
    },
    {
      id: "premium",
      title: "4. Premium Multiplier Table",
      subtitle: "DOLE base multipliers per SproutHR bucket, with night differential stacking method.",
      content: <PremiumMultipliersSection />,
    },
    {
      id: "abrule",
      title: "5. A/B Rule Reference",
      subtitle: "Read-only definition of the Payroll A vs. Payroll B deduction basis.",
      content: <ABRuleSection />,
    },
    {
      id: "statutory",
      title: "6. Boldr Statutory Engine",
      subtitle: "SSS (5% of MSC from net basic), PhilHealth (2.5% of gross basic), Pag-IBIG (flat) — Boldr-spec knobs.",
      content: <StatutoryEngineSection />,
    },
  ];

  return (
    <PayrollSettingsUiContext.Provider value={{ confirmAction, setPageSaving }}>
      {pageSaving ? (
        <div className="fixed inset-x-0 top-0 z-[90] h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 shadow-[0_0_18px_rgba(14,165,233,0.45)]" />
      ) : null}
      <main
        className="axis-payroll-settings-page"
        style={{
          "--ps-top-nav": activeTheme.topNavColor,
          "--ps-banner": activeTheme.bannerColor,
          "--ps-accent": activeTheme.accentColor,
          "--ps-banner-text": activeTheme.bannerTextColor,
          minHeight: "100vh",
          padding: "24px 16px",
        } as React.CSSProperties}
      >
      <style>{`
        .axis-payroll-settings-page {
          background: linear-gradient(180deg, var(--ps-top-nav) 0%, var(--ps-banner) 300px, #f4f8fc 300px, #f4f8fc 100%);
        }
        .axis-ps-shell {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }
        .axis-ps-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--ps-accent) 40%, transparent);
          border-radius: 16px;
          color: var(--ps-banner-text);
          box-shadow: 0 28px 80px -38px rgba(14, 165, 233, 0.65);
        }
        .axis-ps-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0.32;
          background-image: linear-gradient(color-mix(in srgb, var(--ps-accent) 22%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--ps-accent) 22%, transparent) 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .axis-ps-hero::after {
          content: "";
          position: absolute;
          right: 0; top: 0;
          width: 110px; height: 110px;
          border-left: 1px solid color-mix(in srgb, var(--ps-accent) 34%, transparent);
          border-bottom: 1px solid color-mix(in srgb, var(--ps-accent) 34%, transparent);
          border-bottom-left-radius: 42px;
          background: color-mix(in srgb, var(--ps-accent) 12%, transparent);
        }
        .axis-ps-hero-inner {
          position: relative;
          z-index: 1;
          padding: 22px 26px;
        }
      `}</style>

        <div className="axis-ps-shell">
          {/* Hero */}
          <div
            className="axis-ps-hero"
            style={{
              background: `linear-gradient(rgba(0,0,0,${bannerOverlayAlpha}), rgba(0,0,0,${bannerOverlayAlpha})), linear-gradient(135deg, ${activeTheme.topNavColor} 0%, ${activeTheme.bannerColor} 100%)`,
            }}
          >
            <div className="axis-ps-hero-inner">
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: `color-mix(in srgb, ${activeTheme.bannerTextColor} 72%, ${activeTheme.accentColor})` }}>
                Settings › Payroll
              </p>
              <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em", color: activeTheme.bannerTextColor, lineHeight: 1.15 }}>
                Payroll Settings
              </h1>
              <p style={{ margin: "8px 0 0", maxWidth: 680, fontSize: 13, fontWeight: 500, lineHeight: 1.55, color: `color-mix(in srgb, ${activeTheme.bannerTextColor} 80%, transparent)` }}>
                Single source of truth for all payroll computation rules. Values are stored in Firestore and read by the payroll engine at run time — no redeploy required. Verify statutory rates against official agency circulars before go-live.
              </p>
            </div>
          </div>

          {/* Sections */}
          {sections.map((sec) => (
            <SectionCard
              key={sec.id}
              title={sec.title}
              subtitle={sec.subtitle}
              open={openSection === sec.id}
              onToggle={() => setOpenSection(openSection === sec.id ? null : sec.id)}
            >
              {sec.content}
            </SectionCard>
          ))}
        </div>
      </main>

      {confirmModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-slate-950">{confirmModal.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => closeConfirmModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeConfirmModal(true)}
                className="rounded-xl bg-[var(--theme-accent)] px-4 py-2 text-sm font-black text-white shadow hover:opacity-90"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PayrollSettingsUiContext.Provider>
  );
}
