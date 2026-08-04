"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, Filter, MoreVertical, Plus, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import AddEmployeeModal from "./AddEmployeeModal";
import type { HrEmployee } from "@/lib/hrEmployees";
import {
  EMP_COLUMNS,
  EMP_COURSES,
  EMP_LEAVE_REASONS,
  EMP_ROLES,
  EMP_STATES,
  GENDER_LABELS,
  ROLE_LABELS,
} from "@/constants/employees";

// Boshqaruv → Xodimlar ro'yxati (crm-akademiya #view-management-xodimlar).
// Toolbar ikonkalari (Sozlash / Filtr / 3-nuqta) Lidlar → Buyurtmalar ro'yxati
// sahifasidagi kabi lucide + Button (variant="outline") bilan. Ma'lumot
// HAQIQIY — /api/hr-employees (MongoDB `hr_employees`, bo'sh bo'lsa 49 ta
// demo yozuvdan seed qilinadi). Ism ustiga bosilsa xodim profiliga o'tadi.

const inputCls = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const selectCls = "h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
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

const EXPORT_HEADERS = ["№", "To'liq nomi", "Jinsi", "Aktiv o'quvchilar", "Guruhlar", "Turi", "Filiallar", "Telefon raqam", "Kurs", "Yaratilgan sana"];

export default function EmployeesListPage() {
  const { showSuccess } = useToast();

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [rows, setRows] = useState<HrEmployee[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  const settingsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Xodimlar ro'yxatini backend'dan yuklaymiz (/api/hr-employees).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hr-employees")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok) setRows(data.employees);
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen && !moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [settingsOpen, moreOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q) && !e.phone.includes(q) && !(e.kurs && e.kurs.toLowerCase().includes(q))) return false;
      if (roleFilter && e.turi !== roleFilter) return false;
      if (courseFilter && e.kurs !== courseFilter) return false;
      return true;
    });
  }, [rows, search, roleFilter, courseFilter]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const visibleCols = EMP_COLUMNS.filter((c) => !hiddenCols.has(c.id));

  function toggleCol(id: string) {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRows() {
    return filtered.map((e, i) => [i + 1, e.name, GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS], e.aktivOq, e.groups, ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi, e.filial, e.phone, e.kurs, e.created]);
  }
  function exportCSV() {
    const csv = [EXPORT_HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "xodimlar.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + EXPORT_HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const body = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${body}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "xodimlar.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta yozuv`);
    setMoreOpen(false);
  }

  function renderCell(e: HrEmployee, colId: string, i: number) {
    switch (colId) {
      case "num": return <span className="text-muted-foreground tabular-nums">{start + i + 1}</span>;
      case "name": return (
        <Link href={`/management-xodimlar/${e.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
          {e.name}
        </Link>
      );
      case "gender": return <span className="text-[13px] text-muted-foreground">{GENDER_LABELS[e.gender as keyof typeof GENDER_LABELS]}</span>;
      case "aktivOq": return <span className="tabular-nums">{e.aktivOq}</span>;
      case "groups": return <span className="tabular-nums">{e.groups}</span>;
      case "turi": return <span className="text-[13px]">{ROLE_LABELS[e.turi as keyof typeof ROLE_LABELS] ?? e.turi}</span>;
      case "filial": return e.filial;
      case "phone": return <span className="tabular-nums text-[13px]">{e.phone}</span>;
      case "kurs": return <span className="text-[13px]">{e.kurs || "-"}</span>;
      case "created": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.created}</span>;
      case "lastActive": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.lastActive || "-"}</span>;
      case "archReason": return <span className="text-muted-foreground">{e.archReason || "-"}</span>;
      case "archDate": return <span className="tabular-nums text-[12px] text-muted-foreground">{e.archDate || "-"}</span>;
      default: return null;
    }
  }

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* i-list sprite Pagination "qator" ikonkasi uchun (global sprite'da yo'q) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
        </defs>
      </svg>

      {/* Top action row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="primary" lucideIcon={Plus} onClick={() => setAddOpen(true)}>
          Xodim qo&apos;shish
        </Button>
        <div className="flex items-center gap-2">
          <div className="relative" ref={settingsRef}>
            <Button variant="outline" lucideIcon={Settings} title="Sozlash" onClick={() => { setSettingsOpen((o) => !o); setMoreOpen(false); }} />
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-xl p-3 z-30">
                <div className="text-[13px] font-semibold mb-2">Ustunlar</div>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {EMP_COLUMNS.filter((c) => c.id !== "num").map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary cursor-pointer">
                      <input type="checkbox" checked={!hiddenCols.has(c.id)} onChange={() => toggleCol(c.id)} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-[13px]">{c.label}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => { setHiddenCols(new Set()); setSettingsOpen(false); }} className="w-full mt-2 h-9 px-3 rounded-md hover:bg-secondary text-[13px] text-primary font-medium">
                  Standartga qaytarish
                </button>
              </div>
            )}
          </div>
          <Button variant="outline" lucideIcon={Filter} title="Filtrlar" onClick={() => setFiltersOpen((o) => !o)} />
          <div className="relative" ref={moreRef}>
            <Button variant="outline" lucideIcon={MoreVertical} title="Ko'proq" onClick={() => { setMoreOpen((o) => !o); setSettingsOpen(false); }} />
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-card shadow-xl p-1 z-30">
                <button onClick={() => { showSuccess("Import funksiyasi (demo)"); setMoreOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                  <span>Import</span>
                </button>
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-[9px] font-bold text-blue-700">CSV</span>
                  <span>CSV faylini yuklab olish</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-[9px] font-bold text-emerald-700">XLS</span>
                  <span>EXCEL faylini yuklab olish</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter grid */}
      {filtersOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder="Qidiruv" className={inputCls} />
          <div className="relative">
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={selectCls}>
              <option value="">Holat</option>
              {EMP_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <input type="text" placeholder="Faollik sanasi" className={inputCls} />
          <input type="text" placeholder="Ketish sanasi" className={inputCls} />
          <div className="relative">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Rol</option>
              {EMP_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">Kurs</option>
              {EMP_COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className={selectCls}>
              <option value="">Ketish sababi</option>
              {EMP_LEAVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1700px]">
            <thead className="bg-secondary/20">
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                {visibleCols.map((c) => (
                  <th key={c.id} className="px-3 py-3 text-left whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable && <ArrowDown className="h-3 w-3" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((e, i) => (
                <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                  {visibleCols.map((c) => (
                    <td key={c.id} className="px-3 py-3 whitespace-nowrap">{renderCell(e, c.id, i)}</td>
                  ))}
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length} className="px-3 py-10 text-center text-sm text-muted-foreground">{loadingRows ? "Yuklanmoqda…" : "Xodim topilmadi"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>

      {addOpen && (
        <AddEmployeeModal
          onClose={() => setAddOpen(false)}
          onCreated={(emp) => setRows((prev) => [emp, ...prev])}
        />
      )}
    </div>
  );
}
