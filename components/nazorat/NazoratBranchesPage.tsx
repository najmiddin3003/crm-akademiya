"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";
import { BRANCHES_METRICS, BRANCHES_DATA } from "@/constants/branches";
import { branchTotals, fmtBranchVal, type BranchMetric, type BranchRow } from "@/lib/branches";

// Nazorat > Filiallar holati (crm-akademiya #view-nazorat-branches,
// app.js renderBranches()/exportBranches() ~line 28966). Sana filtri
// standart holatda bugungi kunni ko'rsatadi (har mount'da yangilanadi) —
// manbada bu tugma dekorativ edi (funksiyasiz statik matn), bu yerda
// mavjud DatePicker komponenti ulandi. Jadval qatorlari/ustunlari va
// "Jami"/"Umumiy natija" hisob-kitobi manbadan 1:1 portlandi.

const METRICS = BRANCHES_METRICS as BranchMetric[];
const DATA = BRANCHES_DATA as BranchRow[];

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function NazoratBranchesPage() {
  const [date, setDate] = useState<Date>(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const totals = branchTotals();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function exportRows() {
    const headers = ["№", "Filial", ...METRICS.map((m) => m.label)];
    const rows: (string | number)[][] = [headers];
    DATA.forEach((b, i) => rows.push([i + 1, b.name, ...METRICS.map((m) => b.vals[m.id])]));
    rows.push(["", "Jami", ...METRICS.map((m) => totals[m.id])]);
    return rows;
  }
  function exportCSV() {
    const csv = exportRows().map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "filiallar-holati.csv");
    setMenuOpen(false);
  }
  function exportExcel() {
    const rows = exportRows();
    const head = "<tr>" + rows[0].map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const body = rows.slice(1).map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "filiallar-holati.xls");
    setMenuOpen(false);
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Sana + eksport */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DatePicker value={date} onChange={setDate} />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center border border-border bg-card"
            title="Eksport"
          >
            <MoreVertical className="icon icon-sm" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
                  <span className="text-[9px] font-bold text-blue-700">CSV</span>
                </span>
                <span>CSV faylini yuklab olish</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100">
                  <span className="text-[9px] font-bold text-emerald-700">XLS</span>
                </span>
                <span>EXCEL faylini yuklab olish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Asosiy keng jadval.
          Bu sahifada paginatsiya yo'q va pastda yana bitta to'liq jadval
          ("Umumiy natija") turadi — shu sabab boshqa ro'yxat sahifalaridagi
          `page-frame` + `table-frame` zanjiri qo'llanmaydi: ustunli flex'da
          pastdagi blok kontentidan kichrayolmaydi va asosiy jadvalga deyarli
          balandlik qolmasdi. Buning o'rniga scroll qutisiga aniq balandlik
          beriladi — sarlavha shu quti ichida qotib turadi, sahifaning o'zi esa
          odatdagidek scroll bo'laveradi. */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="table-scroll" style={{ maxHeight: "62vh" }}>
          <table className="w-full text-sm min-w-[2400px]">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 text-left w-12 sticky left-0 bg-secondary/20 z-10">№</th>
                <th className="px-3 py-3 text-left sticky left-12 bg-secondary/20 z-10 min-w-[140px]">Filial</th>
                {METRICS.map((m, k) => (
                  <th key={m.id} className={`px-3 py-3 text-right ${k === METRICS.length - 1 ? "pr-5" : ""}`}>{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DATA.map((b, i) => (
                <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums sticky left-0 bg-card z-10">{i + 1}</td>
                  <td className="px-3 py-3 font-medium sticky left-12 bg-card z-10">{b.name}</td>
                  {METRICS.map((m, k) => (
                    <td key={m.id} className={`px-3 py-3 text-right tabular-nums ${k === METRICS.length - 1 ? "pr-5" : ""}`}>
                      {fmtBranchVal(b.vals[m.id], m.decimal)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-primary/5 font-semibold">
                <td className="px-3 py-3 sticky left-0 bg-primary/5 z-10" />
                <td className="px-3 py-3 sticky left-12 bg-primary/5 z-10">Jami</td>
                {METRICS.map((m, k) => (
                  <td key={m.id} className={`px-3 py-3 text-right tabular-nums font-semibold ${k === METRICS.length - 1 ? "pr-5" : ""}`}>
                    {fmtBranchVal(totals[m.id], m.decimal)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Umumiy natija */}
      <div>
        <h3 className="text-[14px] font-semibold mb-2 text-muted-foreground">Umumiy natija</h3>
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/20">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-12">№</th>
                <th className="px-5 py-3 text-left">Filial</th>
                <th className="px-5 py-3 text-right">Aktiv</th>
                <th className="px-5 py-3 text-right pr-5">Jami real bor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DATA.map((b, i) => (
                <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{b.name}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtBranchVal(b.vals.aktiv)}</td>
                  <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtBranchVal(b.vals.jamiReal)}</td>
                </tr>
              ))}
              <tr className="bg-primary/5 font-semibold">
                <td className="px-5 py-3" />
                <td className="px-5 py-3">Jami</td>
                <td className="px-5 py-3 text-right tabular-nums">{fmtBranchVal(totals.aktiv)}</td>
                <td className="px-5 py-3 pr-5 text-right tabular-nums">{fmtBranchVal(totals.jamiReal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
