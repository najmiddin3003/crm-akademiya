"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CirclePlus, Filter, History, ListChecks, MessageSquare, MoreVertical, Plus, Share2, Users, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import AddStudentModal from "@/components/orders/AddStudentModal";
import { STUDENTS_LIST } from "@/constants/studentsList";
import {
  applyStudentFilters,
  enrichStudent,
  EMPTY_STUDENT_FILTERS,
  STUDENT_CATEGORIES,
  STUDENT_COURSES,
  STUDENT_DAYS,
  STUDENT_GROUP_IDS,
  STUDENT_STATUSES,
  STUDENT_SUBCOURSES,
  STUDENT_TEACHERS,
  type EnrichedStudent,
  type StudentFilters,
  type StudentRow,
} from "@/lib/studentsData";
import type { Pupil } from "@/lib/pupilsData";

// O'quvchilar → O'quvchilar ro'yxati (crm-akademiya #view-students-list,
// sidebar: O'quvchilar > O'quvchilar ro'yxati, href /students-list). Yangi/
// Aktiv/Arxiv o'quvchilar sahifalaridan farqli o'laroq (ular umumiy Orders
// havzasidan hosil bo'ladi), bu — BARCHA o'quvchilarning yagona ro'yxati,
// manbadagi kabi o'zining alohida STUDENTS_LIST massividan (constants/
// studentsList.js, ~5909 yozuv, coin/manba maydonlari bilan). "O'quvchi
// qo'shish" — orders-list'dagi bilan bir xil AddStudentModal+PupilsContext
// (haqiqiy /api/pupils backend'iga saqlanadi, layout.tsx orqali ulanadi);
// qo'shilgan o'quvchi ro'yxat boshiga qo'shiladi. "To'lov sanasi"/"Taklif
// qilganlari"/"Ilovani yuklab olish sanasi"/"Kelmagan davri"/"Shartnoma" —
// manbada ham har doim bo'sh/statik (haqiqiy hisoblanmaydi), shu holicha
// ko'chirildi.

// StudentRow / StudentFilters endi lib/studentsData.ts da — filtrlash mantiqi
// bilan birga, chunki ular bir-biriga bog'liq.

const MODERATORS = ["Dilmurod Komilov", "Nilufar Sharipova"];
const SOURCES = ["Instagram", "Telegram", "Tavsiya", "Facebook"];
const HEADERS = ["№", "ID", "Ism", "Coin", "Telefon raqam", "Balans", "Yaratilgan sanasi", "Manba", "Moderator"];

function fmtNum(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")}`;
}
function fmtUZS(n: number): string {
  return `${fmtNum(n)} UZS`;
}
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

/** Filtr paneli uchun yorliqli select — 13 marta takrorlanmasligi uchun. */
function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-muted-foreground">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">Hammasi</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
      </div>
    </div>
  );
}

export default function StudentsListPage() {
  // Yozuvlar kengaytiriladi: har bir o'quvchi haqiqiy guruhga bog'lanadi va
  // kurs/o'qituvchi/dars kunlari o'sha guruhdan kelib chiqadi (lib/studentsData.ts).
  const [rows, setRows] = useState<EnrichedStudent[]>(() =>
    (STUDENTS_LIST as StudentRow[]).map(enrichStudent),
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Drawer o'z QORALAMASI bilan ishlaydi: maydonlar o'zgarganda jadval darhol
  // qayta filtrlanmaydi. "Saqlash" bosilgandagina qo'llanadi, "Orqaga" esa
  // o'zgarishlarni tashlab yuboradi — referensdagi bilan bir xil xatti-harakat.
  const [draft, setDraft] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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
    const byQuery = q
      ? rows.filter((r) => `${r.name} ${r.phone} ${r.id}`.toLowerCase().includes(q))
      : rows;
    return applyStudentFilters(byQuery, filters);
  }, [rows, search, filters]);

  const { debt, credit } = useMemo(() => {
    let debt = 0;
    let credit = 0;
    for (const r of filtered) {
      if (r.balance < 0) debt += r.balance;
      else credit += r.balance;
    }
    return { debt, credit };
  }, [filtered]);

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

  function rowsToExport(source?: StudentRow[]) {
    const base = source ?? filtered;
    return selected.size > 0 ? base.filter((r) => selected.has(r.id)) : base;
  }
  function exportRows(source?: StudentRow[]) {
    return rowsToExport(source).map((r, i) => [i + 1, r.id, r.name, r.coin || "", r.phone, r.balance, r.createdAt, r.source, r.moderator]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "oquvchilar-royxati.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "oquvchilar-royxati.xls");
    setMoreOpen(false);
  }
  function exportReferrals() {
    const referrals = rows.filter((r) => r.source === "Tavsiya");
    const csv = [HEADERS, ...exportRows(referrals)].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "referrals.csv");
    setMoreOpen(false);
  }

  function handlePupilSaved(pupil: Pupil) {
    const newRow: StudentRow = {
      id: pupil.id,
      name: `${pupil.firstName} ${pupil.lastName}`.trim(),
      phone: pupil.phone,
      balance: 0,
      coin: 0,
      createdAt: pupil.createdAt,
      moderator: "",
      source: "",
      groups: "-",
    };
    // Yangi o'quvchi ham kengaytiriladi — aks holda filtrlar uni ko'rmaydi.
    setRows((prev) => [enrichStudent(newRow), ...prev]);
    setAddOpen(false);
    setPage(1);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Amallar qatori */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="primary" lucideIcon={Plus} onClick={() => setAddOpen(true)}>
          O&apos;quvchi qo&apos;shish
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
        <Button
          variant="primary"
          lucideIcon={Filter}
          onClick={() => { setDraft(filters); setFiltersOpen(true); }}
          className={filtersOpen ? "ring-2 ring-blue-300" : ""}
        >
          Filtr
        </Button>
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
              <button onClick={exportReferrals} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-violet-100 text-violet-700">
                  <Share2 className="icon icon-xs" />
                </span>
                <span>Referrals export</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtr paneli — referensdagi maydonlar. Faqat ma'lumoti bor filtrlar
          chizilgan; qolganlari (Teglar, Bloklanganlar, Oferta, Ilova holati,
          Ranglar, Referal, Shartnoma) uchun o'quvchi modelida maydon yo'q,
          shuning uchun ataylab qo'shilmagan — ishlamaydigan tugma qo'yishdan
          ko'ra yo'qligi ma'qul. */}
      {filtersOpen && (() => {
        const setD = <K extends keyof StudentFilters>(k: K, v: StudentFilters[K]) =>
          setDraft((d) => ({ ...d, [k]: v }));
        const numInput = "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
        return (
          <div className="fixed inset-0 z-[200]" onClick={() => setFiltersOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <aside
              className="absolute right-0 top-0 flex h-full w-full max-w-[400px] flex-col border-l border-border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h3 className="text-[15px] font-semibold">Filter</h3>
                <button
                  onClick={() => setDraft(EMPTY_STUDENT_FILTERS)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-secondary"
                >
                  <X className="icon icon-xs" /> Tozalash
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">Balans oralig&apos;i</label>
                  <div className="flex items-center gap-2">
                    <input value={draft.balanceFrom} onChange={(e) => setD("balanceFrom", e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" placeholder="dan" className={numInput} />
                    <span className="text-muted-foreground">—</span>
                    <input value={draft.balanceTo} onChange={(e) => setD("balanceTo", e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" placeholder="gacha" className={numInput} />
                  </div>
                </div>

                <FilterSelect label="Kurs" value={draft.course} onChange={(v) => setD("course", v)} options={STUDENT_COURSES} />
                <FilterSelect label="Guruh" value={draft.group} onChange={(v) => setD("group", v)} options={STUDENT_GROUP_IDS.map(String)} />
                <FilterSelect label="Subkurs" value={draft.subcourse} onChange={(v) => setD("subcourse", v)} options={STUDENT_SUBCOURSES} />
                <FilterSelect label="Manba" value={draft.source} onChange={(v) => setD("source", v)} options={SOURCES} />
                <FilterSelect label="Moderator" value={draft.moderator} onChange={(v) => setD("moderator", v)} options={MODERATORS} />
                <FilterSelect label="O'qituvchi" value={draft.teacher} onChange={(v) => setD("teacher", v)} options={STUDENT_TEACHERS} />

                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">O&apos;quvchi</label>
                  <input value={draft.name} onChange={(e) => setD("name", e.target.value)} placeholder="Ism bo'yicha" className={numInput} />
                </div>

                <FilterSelect label="Kategoriya" value={draft.category} onChange={(v) => setD("category", v)} options={STUDENT_CATEGORIES} />
                <FilterSelect label="Guruhlar soni" value={draft.groupCount} onChange={(v) => setD("groupCount", v)} options={["0", "1", "2"]} />
                <FilterSelect label="Kun" value={draft.day} onChange={(v) => setD("day", v)} options={STUDENT_DAYS} />
                <FilterSelect label="Toq/Juft kunlar" value={draft.oddEven} onChange={(v) => setD("oddEven", v)} options={["Toq", "Juft"]} />
                <FilterSelect label="Holati" value={draft.status} onChange={(v) => setD("status", v)} options={STUDENT_STATUSES} />

                <div>
                  <label className="mb-1 block text-[12px] text-muted-foreground">Coin oralig&apos;i</label>
                  <div className="flex items-center gap-2">
                    <input value={draft.coinFrom} onChange={(e) => setD("coinFrom", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="dan" className={numInput} />
                    <span className="text-muted-foreground">—</span>
                    <input value={draft.coinTo} onChange={(e) => setD("coinTo", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="gacha" className={numInput} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border p-3">
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="h-10 flex-1 rounded-lg border border-border bg-card text-sm font-medium hover:bg-secondary"
                >
                  Orqaga
                </button>
                <button
                  onClick={() => { setFilters(draft); setPage(1); setFiltersOpen(false); }}
                  className="h-10 flex-1 rounded-lg bg-primary text-sm font-medium text-white hover:opacity-90"
                >
                  Saqlash
                </button>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* Qarzdor/Haqdor + Umumiy soni */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-[13px]">
          <span className="text-rose-600 font-medium">
            Qarzdor<span className="text-rose-700 font-bold tabular-nums ml-1">{fmtUZS(debt)}</span>
          </span>
          <span className="text-emerald-600 font-medium border-l border-border pl-4">
            Haqdor<span className="text-emerald-700 font-bold tabular-nums ml-1">{fmtUZS(credit)}</span>
          </span>
        </div>
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
                <th className="text-left px-3 py-3 whitespace-nowrap">Ism</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Coin</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lov sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Manba</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Guruhlar</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Taklif qilganlari</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ilovani yuklab olish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Shartnoma</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Kelmagan davri</th>
                <th className="px-3 py-3 w-32" />
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
                    <td className="px-3 py-3 text-[13px]">
                      {r.coin > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[11px] font-bold">{r.coin}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/60 whitespace-nowrap">{r.phone || "—"}</span>
                    </td>
                    <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${balCls}`}>{r.balance === 0 ? "0" : fmtNum(r.balance)}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.createdAt}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.source || "—"}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">{r.moderator || "—"}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.groupNames}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-[13px]"><X className="h-4 w-4 text-rose-500" /></td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">-</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-primary">
                        <button title="Qo'shish" className="p-1.5 rounded-md hover:bg-secondary"><CirclePlus className="h-4 w-4" /></button>
                        <button title="Vazifalar" className="p-1.5 rounded-md hover:bg-secondary"><ListChecks className="h-4 w-4" /></button>
                        <button title="Tarix" className="p-1.5 rounded-md hover:bg-secondary"><History className="h-4 w-4" /></button>
                        <button title="Xabar" className="p-1.5 rounded-md hover:bg-secondary"><MessageSquare className="h-4 w-4" /></button>
                        <button title="Guruhlar" className="p-1.5 rounded-md hover:bg-secondary"><Users className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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

      {addOpen && <AddStudentModal onClose={() => setAddOpen(false)} onSave={handlePupilSaved} />}
    </div>
  );
}
