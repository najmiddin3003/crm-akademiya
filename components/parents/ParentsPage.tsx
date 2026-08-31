"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, History, MessageSquare, MoreVertical } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import ParentsFilterModal from "@/components/parents/ParentsFilterModal";
import {
  applyParentFilters,
  buildParentRows,
  EMPTY_PARENTS_FILTERS,
  fmtBalanceUZS,
  uniqueSorted,
  type ParentRow,
  type ParentsFilters,
} from "@/lib/parentsData";
import { useStudents } from "@/hooks/useStudents";

// O'quvchilar → Ota-ona (sidebar: O'quvchilar > Ota-ona, href /parents).
//
// ILGARI: sahifa har bir o'quvchiga lib/parentsData.ts dagi seed'langan
// generatordan ota-ona ismi, telefoni va "ilovani yuklab olgan" belgisini
// yopishtirardi — ya'ni butun jadval SOXTA edi. Balans ustuni esa
// pupils.balance maydonidan olinardi, uni esa hech bir API yangilamaydi.
//
// ENDI:
//   • qatorlar — /api/pupils dagi HAQIQIY ota-ona maydonlaridan
//     (fatherName/fatherPhone/fatherWork/motherName/motherPhone/motherWork,
//     o'quvchi profilidagi "Tahrirlash" tabi saqlaydi). Bitta qator =
//     bitta haqiqiy ota yoki ona, farzandiga bog'langan;
//   • balans — /api/students/balances (transaction_entries payIn yig'indisi);
//   • "Ilovani yuklab olgan" ustunining manbasi loyihada YO'Q — u "—".
//
// Ota-onasi kiritilmagan o'quvchi ro'yxatda umuman ko'rinmaydi: bo'sh qator
// ham "ma'lumot bor" degan taassurot qoldiradi.
//
// Qidiruv, filtr, tanlash, CSV/XLS eksport va sahifalash avvalgidek ishlaydi.
// "Import" tugmasi olib tashlandi — u hech qachon hech nima qilmagan
// (ota-ona importi uchun backend yo'q).

const HEADERS = ["№", "O'quvchi ID", "O'quvchini ismi", "Qarindoshligi", "Ota-onaning ismi", "Telefon raqam", "Ish joyi", "Balans", "Ilovani yuklab olgan"];

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

/** Manbasi bo'lmagan katak — 0 yozish faktik da'vo bo'lardi. */
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export default function ParentsPage() {
  // Ota-ona maydonlari standart to'plamda YO'Q (ular 13 ta sahifadan
  // faqat shu ikkitasiga kerak) — ataylab so'raymiz.
  //
  // `hasParent` — SERVER filtri: `buildParentRows` baribir faqat ota yoki
  // ona ismi/telefoni bo'lgan o'quvchidan qator yasaydi. Bugun bunday
  // o'quvchi yo'q, ya'ni sahifa 2.37 MB o'rniga deyarli hech narsa
  // yuklamaydi; ma'lumot kiritila boshlagach ro'yxat o'zi to'ladi.
  const { pupils, loading: pupilsLoading } = useStudents({
    hasParent: true,
    extra: [
      "birthDate",
      "fatherName", "fatherPhone", "fatherWork",
      "motherName", "motherPhone", "motherWork",
    ] as const,
  });
  // Balanslar alohida so'raladi: pupils.balance maydonini hech bir API
  // yangilamaydi, haqiqiy summa faqat transaction_entries dan yig'iladi.
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [balancesLoading, setBalancesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadBalancesCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      // Xato bo'lsa balans ustuni bo'sh qoladi — ilgari ham shunday edi.
      .catch(() => {})
      .finally(() => { if (!cancelled) setBalancesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loading = pupilsLoading || balancesLoading;

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ParentsFilters>(EMPTY_PARENTS_FILTERS);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const rows = useMemo(() => buildParentRows(pupils, balances), [pupils, balances]);

  // Filtr ro'yxati faqat bazada UCHRAYDIGAN kategoriyalardan.
  const categoryOptions = useMemo(() => uniqueSorted(rows.map((r) => r.category)), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applyParentFilters(rows, filters).filter((r) => {
      if (!q) return true;
      return `${r.pupilName} ${r.name} ${r.phone} ${r.work} ${r.kind} ${r.pupilId}`.toLowerCase().includes(q);
    });
  }, [rows, search, filters]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const pageKeys = useMemo(() => slice.map((r) => r.key), [slice]);
  const pageSelectedCount = pageKeys.filter((k) => selected.has(k)).length;
  const allPageSelected = pageKeys.length > 0 && pageSelectedCount === pageKeys.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;

  function toggleRow(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  function toggleAllOnPage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of pageKeys) {
        if (checked) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  function rowsToExport(): ParentRow[] {
    return selected.size > 0 ? filtered.filter((r) => selected.has(r.key)) : filtered;
  }
  function exportRows() {
    // Oxirgi ustun ("Ilovani yuklab olgan") eksportda ham "—": manbasi yo'q.
    return rowsToExport().map((r, i) => [i + 1, r.pupilId, r.pupilName, r.kind, r.name || "—", r.phone || "—", r.work || "—", r.balance, "—"]);
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
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Qarindoshligi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ota-onaning ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ish joyi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ilovani yuklab olgan</th>
                <th className="text-right px-3 py-3 whitespace-nowrap w-20" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => {
                const balCls = r.balance < 0 ? "text-rose-600 font-semibold" : r.balance > 0 ? "text-emerald-600 font-semibold" : "text-muted-foreground";
                return (
                  <tr key={r.key} className={`border-b border-border/50 transition-colors hover:bg-secondary/30${selected.has(r.key) ? " bg-primary/5" : ""}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.has(r.key)} onChange={(e) => toggleRow(r.key, e.target.checked)} className={checkboxCls} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums">
                      <Link href={`/student-edit/${r.pupilId}`} className="text-foreground hover:text-primary hover:underline">{r.pupilId}</Link>
                    </td>
                    <td className="px-3 py-3 text-[13px] font-medium whitespace-nowrap">
                      <Link href={`/student-edit/${r.pupilId}`} className="hover:text-primary hover:underline">{r.pupilName}</Link>
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[12px] ${r.kind === "Ota" ? "bg-sky-500/10 text-sky-600" : "bg-fuchsia-500/10 text-fuchsia-600"}`}>{r.kind}</span>
                    </td>
                    {/* Faqat telefon kiritilgan bo'lsa ism bo'sh bo'lishi mumkin — "—". */}
                    <td className="px-3 py-3 text-[13px]">{r.name || <Dash />}</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground">
                      {r.phone ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/60 whitespace-nowrap">{r.phone}</span> : <Dash />}
                    </td>
                    <td className="px-3 py-3 text-[13px]">{r.work || <Dash />}</td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls}`}>{fmtBalanceUZS(r.balance)}</td>
                    {/* Ilova/qurilma yozuvi loyihada umuman yuritilmaydi (rule b). */}
                    <td className="px-3 py-3 text-[13px] text-center"><Dash /></td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {/* Ikkalasi ham FARZANDNING profilidagi tegishli tabga
                          olib boradi — ota-onaning alohida profili yo'q. */}
                      <div className="inline-flex items-center gap-1">
                        <Link
                          title="Tarix"
                          href={`/student-edit/${r.pupilId}?src=list&tab=harakatlar`}
                          className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        >
                          <History className="h-4 w-4" />
                        </Link>
                        <Link
                          title="Izoh"
                          href={`/student-edit/${r.pupilId}?src=list&tab=tahrirlash`}
                          className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    {/* Javob kelmasdan "topilmadi" deb yozilmaydi. */}
                    {loading
                      ? "Yuklanmoqda…"
                      : rows.length === 0
                        ? "Hech bir o'quvchiga ota-ona ma'lumoti kiritilmagan. Ota-ona ismi va telefonini o'quvchi profilidagi \"Tahrirlash\" tabida saqlang."
                        : "Ota-ona topilmadi"}
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
          categoryOptions={categoryOptions}
          onClose={() => setFilterModalOpen(false)}
          onApply={(f) => { setFilters(f); setFilterModalOpen(false); setPage(1); }}
        />
      )}
    </div>
  );
}
