"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, History, MessageSquare, MoreVertical, UserCheck, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import ParentsFilterModal, { EMPTY_PARENTS_FILTERS, type ParentsFilters } from "@/components/parents/ParentsFilterModal";
import { buildParentRows, fmtBalanceUZS, type ParentRow } from "@/lib/parentsData";
import { useStudents } from "@/hooks/useStudents";

// O'quvchilar → Ota-ona (crm-akademiya #view-parents, sidebar: O'quvchilar >
// Ota-ona, href /parents). Bazadagi o'quvchilardan (students-list bilan bir
// xil manba, /api/pupils) + har bir qatorga ota-ona ma'lumoti biriktiriladi
// (lib/parentsData.ts, manbadagi _prGetParents(index) bilan bir xil g'oya).
// "O'quvchi qo'shish" tugmasi yo'q va Qarzdor/Haqdor satri yo'q — manbada ham
// yo'q. Filtr — haqiqiy modal (ParentsFilterModal), inline panel emas.
// Ism/ID ustiga bosilsa /student-edit/[id] ga o'tadi.

const HEADERS = ["№", "ID", "O'quvchini ismi", "Otasining ismi", "Telefon raqam (ota)", "Onasining ismi", "Telefon raqam (ona)", "Balans"];

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

const checkboxCls = "h-4 w-4 rounded border-border accent-primary cursor-pointer";

function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkboxCls} />;
}

function AppStatusIcon({ yes }: { yes: boolean }) {
  return yes ? (
    <UserCheck className="h-4 w-4 text-emerald-600 inline" />
  ) : (
    <X className="h-4 w-4 text-muted-foreground inline" style={{ opacity: 0.4 }} />
  );
}

export default function ParentsPage() {
  const { students, loading } = useStudents();
  const rows = useMemo(() => buildParentRows(students), [students]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ParentsFilters>(EMPTY_PARENTS_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.father} ${r.mother} ${r.fatherPhone} ${r.motherPhone} ${r.id}`.toLowerCase().includes(q)) return false;
      if (filters.moderator && r.moderator !== filters.moderator) return false;
      return true;
    });
  }, [rows, search, filters]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const pageIds = useMemo(() => slice.map((r) => r.id), [slice]);
  const pageSelectedCount = pageIds.filter((id) => selected.has(id)).length;
  const allPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;

  function toggleRow(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function rowsToExport(): ParentRow[] {
    return selected.size > 0 ? filtered.filter((r) => selected.has(r.id)) : filtered;
  }
  function exportRows() {
    return rowsToExport().map((r, i) => [i + 1, r.id, r.name, r.father, r.fatherPhone, r.mother, r.motherPhone, r.balance]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "ota_ona.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "ota_ona.xls");
    setMoreOpen(false);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Amallar qatori */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" lucideIcon={Filter} onClick={() => setFilterModalOpen(true)}>
          Filtr
        </Button>
        <div className="flex-1" />
        <div className="relative w-64">
          <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            type="text"
            placeholder="Qidirish"
            className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="relative" ref={moreRef}>
          <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title="Amallar">
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-primary">
                  <svg className="icon icon-xs"><use href="#i-file-plus" /></svg>
                </span>
                <span>Import</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "CSV faylini yuklab olish"}</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "EXCEL faylini yuklab olish"}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Umumiy soni */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">Umumiy soni:</span>
          <span className="font-bold tabular-nums">{filtered.length.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
        </div>
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-3 w-10">
                  <HeaderCheckbox checked={allPageSelected} indeterminate={somePageSelected} onChange={toggleAllOnPage} />
                </th>
                <th className="text-left px-3 py-3 whitespace-nowrap w-12">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Otasining ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Onasining ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Otasi ilovani yuklab olish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Onasi ilovani yuklab olish sanasi</th>
                <th className="text-right px-3 py-3 whitespace-nowrap w-20" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const balCls = r.balance < 0 ? "text-rose-600 font-semibold" : r.balance > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground";
                return (
                  <tr key={`row-${start + i}-${r.id}`} className={`border-b border-border/50 transition-colors hover:bg-secondary/30${selected.has(r.id) ? " bg-primary/5" : ""}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={(e) => toggleRow(r.id, e.target.checked)} className={checkboxCls} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">
                      <Link href={`/student-edit/${r.id}`} className="text-foreground hover:text-primary hover:underline">{r.id}</Link>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-medium whitespace-nowrap">
                      <Link href={`/student-edit/${r.id}`} className="hover:text-primary hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-3 py-3 text-[13px]">{r.father}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground">
                      {r.fatherPhone && <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/60 whitespace-nowrap">{r.fatherPhone}</span>}
                    </td>
                    <td className="px-3 py-3 text-[13px]">{r.mother}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground">
                      {r.motherPhone && <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/60 whitespace-nowrap">{r.motherPhone}</span>}
                    </td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls}`}>{fmtBalanceUZS(r.balance)}</td>
                    <td className="px-3 py-3 text-center"><AppStatusIcon yes={r.fatherApp} /></td>
                    <td className="px-3 py-3 text-center"><AppStatusIcon yes={r.motherApp} /></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button title="Tarix" className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground">
                          <History className="h-4 w-4" />
                        </button>
                        <button title="Izoh" className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Yuklanmoqda…" : "O'quvchi topilmadi"}
                  </td>
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
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {filterModalOpen && (
        <ParentsFilterModal
          initialFilters={filters}
          onClose={() => setFilterModalOpen(false)}
          onApply={(f) => { setFilters(f); setFilterModalOpen(false); setPage(1); }}
        />
      )}
    </div>
  );
}
