"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, Filter, MessageSquare, MoreVertical, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import SmsModal from "@/components/orders/SmsModal";
import { useToast } from "@/components/ui/Toast";
import { useStudents } from "@/hooks/useStudents";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";
import type { PupilListItem } from "@/lib/pupilsData";
import {
  applyStudentFilters,
  enrichStudents,
  EMPTY_STUDENT_FILTERS,
  studentRowFromPupil,
  uniqueSorted,
  type EnrichedStudent,
  type StudentFilters,
} from "@/lib/studentsData";

// O'quvchilar → Arxiv o'quvchilar (crm-akademiya #view-archive-students,
// sidebar: O'quvchilar > Arxiv o'quvchilar, href /archive-students).
//
// Ilgari bu sahifa BAZAGA umuman murojaat qilmasdi: qatorlarni lib/ordersData.ts
// dagi 502 ta demo buyurtma generatoridan (createInitialOrders) olib, "arxiv"
// deb buyurtma statusini ("Bekor qilindi"/"Yakunlandi"/"O'tkazildi") sanardi.
// Qolgan hamma ustun lib/archiveStudents.ts dagi archiveExtras() dan kelardi va
// u butunlay O'YLAB TOPILGAN edi: guruh/o'qituvchi GROUP_SEED[(id*31)%n] dan,
// "Oldingi holati" id%13 dan, arxiv sanalari esa id'dan hisoblangan kun
// siljishlaridan. Balans ham genBalance(id) edi. Ya'ni jadvaldagi birorta raqam
// ham haqiqiy emas edi.
//
// Endi manba HAQIQIY: arxiv — pupils hujjatidagi status maydoni
// (lib/pupilsData.ts, PATCH /api/pupils/:id/status uni o'zgartiradi):
//   • o'quvchilar — /api/pupils (hooks/useStudents.ts) + /api/groups
//     (hooks/useGroups.ts), enrichStudents() bilan birlashtiriladi;
//   • "arxiv" — status === "Arxiv";
//   • "Sababi" — pupils.statusReason (arxivlashda majburiy so'raladi);
//   • "Arxivlangan sana" — pupils.statusChangedAt ("YYYY-MM-DD");
//   • balans — /api/students/balances (transaction_entries payIn yig'indisi),
//     chunki pupils.balance maydonini hech bir API yangilamaydi.
//
// Manbasi bo'lmagan ustunlar "—" bo'lib qoladi (har birining tepasida nima
// yetishmayotgani yozilgan) — soxta qiymat yozilmaydi.

interface Row {
  student: EnrichedStudent;
  /** /api/students/balances dan (ism bo'yicha) — haqiqiy to'lovlar yig'indisi. */
  balance: number;
}

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}

// statusChangedAt "YYYY-MM-DD" ko'rinishida saqlanadi (PATCH /api/pupils/:id/
// status), jadvalning qolgan sanalari esa "DD.MM.YYYY" — bir xil bo'lishi
// uchun o'giriladi.
function fmtIsoDate(s: string): string {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
}

// "YYYY-MM-DD" → MAHALLIY Date. `new Date("2026-08-24")` UTC yarim tunini
// beradi va +5 mintaqada sana bir kunga surilib ketardi, shuning uchun
// bo'laklab quriladi.
function parseIsoDate(s: string): Date | null {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** Moliya yozuvlarida o'quvchining id'si emas, ISMI saqlanadi (CashboxKirimDrawer bilan bir xil kalit). */
function balanceKey(name: string): string {
  return name.trim().toLowerCase();
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

const selectCls = "h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
const checkboxCls = "h-4 w-4 rounded border-border accent-primary cursor-pointer";
const HEADERS = ["№", "ID", "O'quvchini ismi", "Telefon raqam", "Balans", "Arxivlangan guruh", "Arxiv o'qituvchisi", "Yaratilgan sanasi", "Moderator", "Pro arxivlangan sana", "Arxivlangan sana", "Sababi", "Oldingi holati", "Shartnoma"];

function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkboxCls} />;
}

/** SERVERDA olingan boshlang'ich ro'yxatlar — app/(app)/archive-students/page.tsx. */
export interface ArchiveStudentsPageProps {
  initialPupils?: PupilListItem[];
  initialGroups?: Group[];
}

export default function ArchiveStudentsPage({ initialPupils, initialGroups }: ArchiveStudentsPageProps = {}) {
  // `status: "Arxiv"` — filtr SERVERDA: 6 732 tadan 2 456 tasi.
  // Pastdagi `.filter(s.status === "Arxiv")` himoya sifatida qoladi.
  //
  // `initial…` berilsa ro'yxatlar sahifa bilan birga kelgan — so'rov yo'q.
  const { pupils, loading: pupilsLoading } = useStudents({ status: "Arxiv", initial: initialPupils });
  const { groups, loading: groupsLoading } = useGroups(initialGroups);
  // Balanslar alohida so'raladi: pupils.balance maydoni bazada yangilanmaydi,
  // haqiqiy summa faqat transaction_entries dan yig'iladi.
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

  const [filters, setFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  // "Sababi" StudentFilters da yo'q (u erkin matn maydoni), shuning uchun
  // alohida holatda saqlanadi va qo'lda solishtiriladi.
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);
  // Qator amallari: xabar oynasi va "Sababi" ustunidagi to'liq matn.
  const [smsFor, setSmsFor] = useState<{ name: string; phone: string } | null>(null);
  const [reasonFor, setReasonFor] = useState<{ name: string; reason: string; date: string } | null>(null);
  const { showSuccess, showError } = useToast();

  const loading = pupilsLoading || groupsLoading || balancesLoading;

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  function setFilter<K extends keyof StudentFilters>(key: K, value: StudentFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const rows = useMemo<Row[]>(
    () =>
      enrichStudents(pupils.map(studentRowFromPupil), groups)
        // "Arxiv o'quvchilar" = holati "Arxiv" bo'lganlar. Boshqa hech qanday
        // shart yo'q (ilgari bu yerda demo buyurtma statusi turardi).
        .filter((s) => s.status === "Arxiv")
        .map((s) => ({ student: s, balance: balances[balanceKey(s.name)] ?? 0 })),
    [pupils, groups, balances],
  );

  // Filtr ro'yxatlari faqat HAQIQATDA uchraydigan qiymatlardan quriladi —
  // ilgari ular ordersData.ts dagi qattiq yozilgan MODERATORS/COURSES
  // konstantalari edi va bazadagi ma'lumot bilan bog'liq emasdi. "Kurs"
  // filtri esa umuman olib tashlandi: kurs o'quvchining guruhidan keladi,
  // arxivlashda esa o'quvchi hamma guruhdan chiqariladi — ya'ni u hech qachon
  // hech nima topa olmaydi.
  const moderatorOptions = useMemo(() => uniqueSorted(rows.map((r) => r.student.moderator)), [rows]);
  const reasonOptions = useMemo(() => uniqueSorted(rows.map((r) => r.student.statusReason)), [rows]);

  const filtered = useMemo(() => {
    const ids = new Set(applyStudentFilters(rows.map((r) => r.student), filters).map((s) => s.id));
    // Oraliq endi ARXIVLANGAN sanaga qo'llanadi (ilgari demo buyurtmaning
    // yaratilgan sanasiga qo'llanardi) — arxiv sahifasida mazmunlisi shu.
    const from = dateRange.start
      ? new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate())
      : null;
    const to = dateRange.end
      ? new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate())
      : null;
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (!ids.has(r.student.id)) return false;
      if (reason && r.student.statusReason !== reason) return false;
      if (from || to) {
        const dt = parseIsoDate(r.student.statusChangedAt);
        if (!dt) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      if (q) {
        const hay = [
          r.student.name, r.student.phone, String(r.student.id), r.student.moderator,
          r.student.statusReason, fmtIsoDate(r.student.statusChangedAt), r.student.createdAt,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters, reason, dateRange, search]);

  // Qarzdor/Haqdor endi HAQIQIY balanslardan yig'iladi. Balans — to'langan
  // pul yig'indisi (tizimda "to'lanishi kerak" summasi yuritilmaydi), shuning
  // uchun manfiy qiymat faqat tuzatuvchi yozuvlar bo'lganda paydo bo'ladi.
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

  const pageIds = useMemo(() => slice.map((r) => r.student.id), [slice]);
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

  function rowsToExport(): Row[] {
    return selected.size > 0 ? filtered.filter((r) => selected.has(r.student.id)) : filtered;
  }
  function exportRows() {
    return rowsToExport().map((r, i) => [
      i + 1,
      r.student.id,
      r.student.name,
      r.student.phone,
      r.balance,
      "", // Arxivlangan guruh — arxivlashda o'quvchi hamma guruhdan chiqariladi, guruh eslab qolinmaydi.
      "", // Arxiv o'qituvchisi — o'qituvchi guruhdan kelardi, guruh esa yo'q.
      r.student.createdAt,
      r.student.moderator,
      "", // Pro arxivlangan sana — bazada bunday oraliq holat ham, sanasi ham yo'q.
      fmtIsoDate(r.student.statusChangedAt),
      r.student.statusReason,
      "", // Oldingi holati — status tarixi saqlanmaydi, faqat joriy status bor.
      "yo'q", // Shartnoma — `contracts` o'quvchiga bog'lanmagan, ya'ni yo'q. Ekranda "x" turadi; bo'sh katak "bilinmadi" degan boshqa ma'no berardi.
    ]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "arxiv-oquvchilar.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "arxiv-oquvchilar.xls");
    setMoreOpen(false);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* Amallar qatori */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-shadow${
            filtersOpen ? " ring-2 ring-blue-300" : ""
          }`}
        >
          <Filter className="icon icon-sm" />
          <span>Filtr</span>
        </button>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-[13px] text-muted-foreground">{selected.size} ta tanlandi</span>
          )}
          <div className="relative">
            <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              type="text"
              placeholder="Qidirish"
              className="w-56 h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title="Amallar">
              <MoreVertical className="icon icon-sm" />
            </button>
            {moreOpen && (
              <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
                <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                  <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "CSV faylini yuklab olish"}</span>
                </button>
                <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                  <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                  <span>{selected.size > 0 ? `Tanlanganlarni (${selected.size}) yuklab olish` : "EXCEL faylini yuklab olish"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtr paneli */}
      {filtersOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            {/* Sababi ro'yxati arxivlangan o'quvchilarning HAQIQIY statusReason
                qiymatlaridan yig'iladi — ilgari u statusdan kelib chiqib
                to'qib chiqarilgan uchta iboradan iborat edi. */}
            <select value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }} className={`${selectCls} w-52`}>
              <option value="">Sababi</option>
              {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <div className="relative">
            <select value={filters.moderator} onChange={(e) => setFilter("moderator", e.target.value)} className={`${selectCls} w-44`}>
              <option value="">Moderator</option>
              {moderatorOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <svg className="icon icon-xs absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"><use href="#i-chevron-down" /></svg>
          </div>
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Arxivlangan sana oralig'i" />
          <button
            onClick={() => { setFilters(EMPTY_STUDENT_FILTERS); setReason(""); setSearch(""); setDateRange({ start: null, end: null }); setPage(1); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
          >
            <X className="icon icon-xs" /> Tozalash
          </button>
        </div>
      )}

      {/* Qarzdor/Haqdor + Umumiy soni */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="text-rose-600 font-medium">Qarzdor {fmtUZS(debt)}</span>
          <span className="text-border">|</span>
          <span className="text-emerald-600 font-medium">Haqdor {fmtUZS(credit)}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary/60 text-xs">
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
                <th className="text-left px-3 py-3 whitespace-nowrap w-14">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchini ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Arxivlangan guruh</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Arxiv o&apos;qituvchisi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Pro arxivlangan sana</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Arxivlangan sana</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Oldingi holati</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Shartnoma</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {!loading && slice.map((r, i) => (
                <tr key={r.student.id} className={`border-b border-border/50 transition-colors hover:bg-secondary/30${selected.has(r.student.id) ? " bg-primary/5" : ""}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.student.id)}
                      onChange={(e) => toggleRow(r.student.id, e.target.checked)}
                      className={checkboxCls}
                    />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground">{r.student.id}</td>
                  <td className="px-3 py-3 text-[13px]">
                    {/* ?src=list — bazadagi o'quvchi id'lari demo buyurtma id'lari bilan
                        kesishadi, bu belgisiz profil sahifasi boshqa odamni ochib yuborishi mumkin. */}
                    <Link href={`/student-edit/${r.student.id}?src=list`} className="font-medium hover:text-primary hover:underline">
                      {r.student.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.student.phone || "—"}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${r.balance < 0 ? "text-rose-600" : r.balance > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{fmtUZS(r.balance)}</td>
                  {/* Arxivlangan guruh — PATCH /api/pupils/:id/status arxivlashda
                      o'quvchini hamma guruhdan chiqaradi va qaysi guruhda bo'lganini
                      hech qayerda yozib qo'ymaydi, ya'ni enrichStudents() ham bo'sh
                      qaytaradi. Qiymat o'ylab topilmaydi. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Arxiv o'qituvchisi — o'qituvchi o'quvchida emas, guruhda saqlanadi
                      (groups.teacher); guruh aloqasi uzilgani uchun manba yo'q. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.student.createdAt || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{r.student.moderator || "—"}</td>
                  {/* Pro arxivlangan sana — "pro arxiv" degan oraliq holat pupils
                      modelida umuman yo'q (PUPIL_STATUSES: Aktiv/Muzlatilgan/Arxiv),
                      demak sanasi ham yo'q. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Arxivlangan sana — haqiqiy pupils.statusChangedAt. */}
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.student.statusChangedAt ? fmtIsoDate(r.student.statusChangedAt) : "—"}</td>
                  {/* Sababi — haqiqiy pupils.statusReason (arxivlashda majburiy).
                      Sabab uzun bo'lishi mumkin, jadval katagi esa uni kesib
                      qo'yadi — shu bois ustiga bosilsa to'liq matn oynada
                      chiqadi. Sababsiz qatorda bosiladigan narsa yo'q. */}
                  <td className="px-3 py-3 text-[13px] max-w-[220px]">
                    {r.student.statusReason ? (
                      <button
                        type="button"
                        onClick={() =>
                          setReasonFor({
                            name: r.student.name,
                            reason: r.student.statusReason || "",
                            date: r.student.statusChangedAt ? fmtIsoDate(r.student.statusChangedAt) : "",
                          })
                        }
                        title="To'liq sababni ko'rish"
                        className="text-left truncate max-w-full hover:text-primary hover:underline"
                      >
                        {r.student.statusReason}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {/* Oldingi holati — status tarixi saqlanmaydi: hujjatda faqat
                      joriy status bor, o'zgarishlar jurnali yo'q. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Shartnoma — `contracts` kolleksiyasi o'quvchiga bog'lanmagan
                      (studentId yo'q), ya'ni birorta o'quvchida shartnoma YO'Q.
                      "—" (bilmayman) emas, aynan "x" (yo'q) — o'quvchilar
                      ro'yxatidagi ustun bilan bir xil ko'rinish. */}
                  <td className="px-3 py-3 text-[13px]"><X className="h-4 w-4 text-rose-500" /></td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-primary">
                      {/* ?src=list — yuqoridagi ism havolasidagi bilan bir xil
                          sabab: id fazolari kesishadi. */}
                      <Link
                        title="To'lovlar"
                        href={`/student-edit/${r.student.id}?src=list&tab=tranzaksiya`}
                        className="p-1.5 rounded-md hover:bg-secondary"
                      >
                        <CreditCard className="h-4 w-4" />
                      </Link>
                      <button
                        title={r.student.phone ? "Xabar" : "Telefon raqam yo'q"}
                        disabled={!r.student.phone}
                        onClick={() => setSmsFor({ name: r.student.name, phone: r.student.phone })}
                        className="p-1.5 rounded-md hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={16} className="px-3">
                    <SpinnerBlock />
                  </td>
                </tr>
              )}
              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={16} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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

      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) showError("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else showSuccess("SMS yuborildi");
            setSmsFor(null);
          }}
          onError={showError}
        />
      )}

      {reasonFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReasonFor(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold flex-1">Arxivlash sababi</h3>
              <button onClick={() => setReasonFor(null)} className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">{reasonFor.name}</span>
                {reasonFor.date && <span className="text-muted-foreground tabular-nums">{reasonFor.date}</span>}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{reasonFor.reason}</p>
            </div>
            <div className="flex justify-end px-5 py-4 border-t border-border">
              <button onClick={() => setReasonFor(null)} className="h-9 px-5 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
