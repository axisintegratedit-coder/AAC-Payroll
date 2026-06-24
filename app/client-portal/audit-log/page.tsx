"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientPortalSessionAsync } from "../lib/auth";
import { getAllAudits, auditActionLabel, formatAuditTimestamp, resolveAuditUser, type AuditEntry, type AuditAction } from "@/lib/auditTrail";
import { applyAppTheme, DEFAULT_APP_THEME, normalizeTheme, type AppTheme } from "@/lib/appTheme";
import { getConfigItem, getAllAudits as fetchAudits } from "@/lib/firestore";
import { storageKeys } from "@/lib/appStorage";

const ENTITY_LABELS: Record<string, string> = {
  Employee: "Employee",
  PayrollRun: "Payroll Run",
  Report_1601C: "1601-C Report",
  Report_1604C: "1604-C Report",
  Report_Alphalist: "Alphalist",
  Report_Payslip: "Payslip",
  Report_COE: "Certificate of Employment",
};

const ACTION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  CREATED:   { text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  EDITED:    { text: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200" },
  ARCHIVED:  { text: "text-purple-700",  bg: "bg-purple-50",   border: "border-purple-200" },
  DELETED:   { text: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200" },
  UNARCHIVED:{ text: "text-cyan-700",    bg: "bg-cyan-50",     border: "border-cyan-200" },
  EXPORTED:  { text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
  PRINTED:   { text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
  SAVED:     { text: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200" },
  RESTORED:  { text: "text-cyan-700",    bg: "bg-cyan-50",     border: "border-cyan-200" },
  SUBMITTED: { text: "text-violet-700",  bg: "bg-violet-50",   border: "border-violet-200" },
  CHECKED:   { text: "text-blue-800",    bg: "bg-blue-100",    border: "border-blue-300" },
  APPROVED:  { text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  RETURNED:  { text: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200" },
  DOWNLOADED:{ text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
};

export default function ClientPortalAuditLogPage() {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_APP_THEME);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [entityFilter, setEntityFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [userFilter, setUserFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const session = await getClientPortalSessionAsync();
      if (!session) { router.replace("/client-portal/login"); return; }

      const [raw, entries] = await Promise.all([
        getConfigItem<Partial<AppTheme>>(storageKeys.clientPortalTheme, DEFAULT_APP_THEME),
        fetchAudits(),
      ]);
      const t = normalizeTheme(raw);
      setTheme(t);
      applyAppTheme(t);
      setEntries(entries);
    }
    load();
  }, [router]);

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

  return (
    <div className="min-h-screen pg-bg text-[#0b2742]">
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b px-6 py-5 shadow-[0_22px_60px_-42px_rgba(14,165,233,0.75)]"
        style={{ backgroundColor: theme.bannerColor, borderColor: `${theme.accentColor}33` }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 82% 20%, ${theme.accentColor}33, transparent 30%), linear-gradient(135deg, ${theme.accentColor}22, transparent 45%)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.12) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#3abeff] to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold" style={{ color: theme.bannerTextColor }}>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--theme-accent)]" />Audit Log
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: theme.bannerTextColor }}>Activity History</h1>
          <p className="mt-1 text-sm opacity-85" style={{ color: theme.bannerTextColor }}>
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}{entries.length !== filtered.length ? ` of ${entries.length} total` : " recorded"}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Filters */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-1 flex-col gap-1" style={{ minWidth: 160 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Search</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, user, details…"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#0a4f8f] focus:ring-2 focus:ring-[#0a4f8f22]" />
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: 140 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Entity Type</label>
              <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]">
                {entityTypes.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : ENTITY_LABELS[t] || t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: 140 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Action</label>
              <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]">
                {actions.map((a) => <option key={a} value={a}>{a === "All" ? "All Actions" : auditActionLabel(a as AuditAction)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: 140 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">User</label>
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]">
                {users.map((u) => <option key={u} value={u}>{u === "All" ? "All Users" : (resolvedUserMap.get(u) || u)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]" />
            </div>
            <div className="flex flex-col gap-1" style={{ minWidth: 130 }}>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0a4f8f]" />
            </div>
            {hasFilters && (
              <button type="button" onClick={clearFilters}
                className="self-end rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-8 py-16 text-center text-sm text-slate-400 shadow-sm">
            {entries.length === 0
              ? "No activity recorded yet. Events will appear here as you interact with the portal."
              : "No events match the current filters."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    {["Timestamp", "Action", "Entity Type", "Name / ID", "Performed By", "Details"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, idx) => {
                    const colors = ACTION_COLORS[e.action] || { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
                    return (
                      <tr key={e.id} className={`border-b border-slate-100 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatAuditTimestamp(e.timestamp)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${colors.text} ${colors.bg} ${colors.border}`}>
                            {auditActionLabel(e.action as AuditAction)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{ENTITY_LABELS[e.entityType] || e.entityType}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{e.entityName}</div>
                          <div className="text-xs text-slate-400">{e.entityId}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{resolvedUserMap.get(e.performedBy) || e.performedBy}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{e.details || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
              Showing {filtered.length} of {entries.length} events · newest first
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
