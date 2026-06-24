"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllAudits, auditActionLabel, formatAuditTimestamp, resolveAuditUser, updateAuditDetails, type AuditEntry, type AuditAction } from "@/lib/auditTrail";

const ENTITY_LABELS: Record<string, string> = {
  Employee: "Employee",
  PayrollRun: "Payroll Run",
  Report_1601C: "1601-C Report",
  Report_1604C: "1604-C Report",
  Report_Alphalist: "Alphalist",
  Report_Payslip: "Payslip",
  Report_COE: "Certificate of Employment",
};

const ACTION_COLOR: Record<AuditAction, string> = {
  CREATED: "#16a34a",
  EDITED: "#2563eb",
  ARCHIVED: "#9333ea",
  DELETED: "#dc2626",
  UNARCHIVED: "#0891b2",
  EXPORTED: "#d97706",
  PRINTED: "#d97706",
  SAVED: "#2563eb",
  RESTORED: "#0891b2",
  SUBMITTED: "#7c3aed",
  CHECKED: "#1d4ed8",
  APPROVED: "#16a34a",
  RETURNED: "#dc2626",
  DOWNLOADED: "#d97706",
};

const ACTION_BG: Record<AuditAction, string> = {
  CREATED: "#f0fdf4",
  EDITED: "#eff6ff",
  ARCHIVED: "#faf5ff",
  DELETED: "#fef2f2",
  UNARCHIVED: "#ecfeff",
  EXPORTED: "#fffbeb",
  PRINTED: "#fffbeb",
  SAVED: "#eff6ff",
  RESTORED: "#ecfeff",
  SUBMITTED: "#f5f3ff",
  CHECKED: "#dbeafe",
  APPROVED: "#f0fdf4",
  RETURNED: "#fef2f2",
  DOWNLOADED: "#fffbeb",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    getAllAudits().then(setEntries);
  }, []);

  function startEditDetails(entry: AuditEntry) {
    setEditingId(entry.id);
    setEditingText(entry.details || "");
  }

  async function saveEditDetails() {
    if (!editingId) return;
    await updateAuditDetails(editingId, editingText);
    setEntries(await getAllAudits());
    setEditingId(null);
    setEditingText("");
  }

  function cancelEditDetails() {
    setEditingId(null);
    setEditingText("");
  }

  const entityTypes = useMemo(() => {
    const types = new Set(entries.map((e) => e.entityType));
    return ["All", ...Array.from(types).sort()];
  }, [entries]);

  const actions = useMemo(() => {
    const acts = new Set(entries.map((e) => e.action));
    return ["All", ...Array.from(acts).sort()];
  }, [entries]);

  const resolvedUserMap = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((e) => { if (!map.has(e.performedBy)) map.set(e.performedBy, resolveAuditUser(e.performedBy)); });
    return map;
  }, [entries]);

  const users = useMemo(() => {
    const us = new Set(entries.map((e) => e.performedBy));
    return ["All", ...Array.from(us).sort()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return entries.filter((e) => {
      if (entityFilter !== "All" && e.entityType !== entityFilter) return false;
      if (actionFilter !== "All" && e.action !== actionFilter) return false;
      if (userFilter !== "All" && e.performedBy !== userFilter) return false;
      if (from && new Date(e.timestamp).getTime() < from) return false;
      if (to && new Date(e.timestamp).getTime() > to) return false;
      if (q && !e.entityName.toLowerCase().includes(q) && !e.entityId.toLowerCase().includes(q) && !e.performedBy.toLowerCase().includes(q) && !(e.details || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, entityFilter, actionFilter, userFilter, dateFrom, dateTo, search]);

  function clearFilters() {
    setEntityFilter("All");
    setActionFilter("All");
    setUserFilter("All");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  const hasFilters = entityFilter !== "All" || actionFilter !== "All" || userFilter !== "All" || dateFrom || dateTo || search;

  const inp: React.CSSProperties = {
    border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px",
    fontSize: 13, outline: "none", background: "#fff", color: "#1e293b",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "#0b2742", padding: "28px 32px 24px", borderBottom: "1px solid #1e3a5f" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
            Administration
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: 0 }}>Audit Log</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}{entries.length !== filtered.length ? ` of ${entries.length} total` : " recorded"}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {/* Filters */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px", minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, user, details…" style={{ ...inp }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Entity Type</label>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ ...inp }}>
              {entityTypes.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : ENTITY_LABELS[t] || t}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ ...inp }}>
              {actions.map((a) => <option key={a} value={a}>{a === "All" ? "All Actions" : auditActionLabel(a as AuditAction)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>User</label>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ ...inp }}>
              {users.map((u) => <option key={u} value={u}>{u === "All" ? "All Users" : (resolvedUserMap.get(u) || u)}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 1 140px", minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inp }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 1 140px", minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inp }} />
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} style={{ alignSelf: "flex-end", padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" }}>
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "48px 32px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {entries.length === 0 ? "No audit events recorded yet. Actions will appear here once users interact with the system." : "No events match the current filters."}
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    {["Timestamp", "Action", "Entity Type", "Name / ID", "Performed By", "Details", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => {
                    const actionColor = ACTION_COLOR[e.action as AuditAction] || "#64748b";
                    const actionBg = ACTION_BG[e.action as AuditAction] || "#f8fafc";
                    return (
                      <tr key={e.id} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #f1f5f9" : "none", background: idx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                        <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap", fontSize: 12 }}>{formatAuditTimestamp(e.timestamp)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: actionColor, background: actionBg, border: `1px solid ${actionColor}33`, whiteSpace: "nowrap" }}>
                            {auditActionLabel(e.action as AuditAction)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>{ENTITY_LABELS[e.entityType] || e.entityType}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>{e.entityName}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{e.entityId}</div>
                        </td>
                        <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>{resolvedUserMap.get(e.performedBy) || e.performedBy}</td>
                        <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, minWidth: 160 }}>
                          {editingId === e.id ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                autoFocus
                                value={editingText}
                                onChange={(ev) => setEditingText(ev.target.value)}
                                onKeyDown={(ev) => { if (ev.key === "Enter") saveEditDetails(); if (ev.key === "Escape") cancelEditDetails(); }}
                                placeholder="Describe what changed…"
                                style={{ flex: 1, border: "1px solid #3b82f6", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", color: "#1e293b" }}
                              />
                            </div>
                          ) : (
                            e.details || <span style={{ color: "#cbd5e1", fontStyle: "italic" }}>No details</span>
                          )}
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          {editingId === e.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={saveEditDetails} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                              <button type="button" onClick={cancelEditDetails} style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 12, cursor: "pointer" }}>✕</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEditDetails(e)} title="Edit details" style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                              ✎ Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>
              Showing {filtered.length} of {entries.length} events · newest first
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
