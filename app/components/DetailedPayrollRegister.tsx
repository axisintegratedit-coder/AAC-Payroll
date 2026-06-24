"use client";

import { useMemo, type CSSProperties } from "react";
import {
  collectCustomNames,
  detailedSections,
  detailedHeaders,
  computeDetailedRowValues,
  isTextColumn,
  type DetailedRecord,
} from "@/lib/payrollExcel";

function peso(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

// ARGB (e.g. "FFD9E1F2") → CSS hex.
function argbToCss(argb: string) {
  return `#${argb.length === 8 ? argb.slice(2) : argb}`;
}

// Blend an ARGB toward white so data rows read lighter than the header band.
function lightenCss(argb: string, amount = 0.55) {
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix(parseInt(hex.slice(0, 2), 16));
  const g = mix(parseInt(hex.slice(2, 4), 16));
  const b = mix(parseInt(hex.slice(4, 6), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

// On-screen mirror of the exported Excel "Payroll Register — Detailed": identical sections, columns,
// colours and per-row values. Shared by the admin add-payroll view and the client portal detail view.
export default function DetailedPayrollRegister({
  records,
  period,
  payDate,
}: {
  records: DetailedRecord[];
  period: string;
  payDate: string;
}) {
  const cn = useMemo(() => collectCustomNames(records), [records]);
  const sections = useMemo(() => detailedSections(cn), [cn]);
  const headers = useMemo(() => detailedHeaders(cn), [cn]);
  const rows = useMemo(
    () => records.map((r, i) => computeDetailedRowValues(r, cn, i, period, payDate)),
    [records, cn, period, payDate]
  );

  const { headerBg, dataBg } = useMemo(() => {
    const headerBg: string[] = [];
    const dataBg: string[] = [];
    sections.forEach((s) => s.cols.forEach(() => { headerBg.push(argbToCss(s.bg)); dataBg.push(lightenCss(s.bg)); }));
    return { headerBg, dataBg };
  }, [sections]);

  const totals = useMemo(
    () => headers.map((h, c) => (isTextColumn(h) ? null : rows.reduce((sum, row) => sum + (typeof row[c] === "number" ? (row[c] as number) : 0), 0))),
    [headers, rows]
  );

  const cellBase: CSSProperties = { border: "1px solid #d4d4d8", padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap" };

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-34px_rgba(8,47,73,0.75)]">
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr>
            {sections.map((s) => (
              <th
                key={s.label}
                colSpan={s.cols.length}
                style={{ ...cellBase, position: "sticky", top: 0, zIndex: 2, textAlign: "center", fontWeight: 800, color: argbToCss(s.fg), background: argbToCss(s.bg) }}
              >
                {s.label}
              </th>
            ))}
          </tr>
          <tr>
            {headers.map((h, c) => (
              <th
                key={`${h}-${c}`}
                style={{ ...cellBase, position: "sticky", top: 28, zIndex: 1, textAlign: "center", fontWeight: 700, color: "#0f172a", background: headerBg[c], whiteSpace: "normal", minWidth: isTextColumn(h) ? 90 : 96 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((v, c) => {
                const text = isTextColumn(headers[c]);
                const isNet = headers[c] === "Net Pay";
                return (
                  <td
                    key={c}
                    style={{
                      ...cellBase,
                      textAlign: text ? (c === 0 ? "center" : "left") : "right",
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: isNet ? 800 : 400,
                      color: "#0f172a",
                      background: dataBg[c],
                    }}
                  >
                    {text ? String(v ?? "—") : peso(Number(v) || 0)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            {headers.map((h, c) => (
              <td
                key={`t-${c}`}
                style={{ ...cellBase, textAlign: isTextColumn(h) ? "center" : "right", fontWeight: 800, fontVariantNumeric: "tabular-nums", background: "#FFF7DB" }}
              >
                {c === 0 ? `TOTAL — ${records.length}` : totals[c] === null ? "" : peso(totals[c] as number)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
