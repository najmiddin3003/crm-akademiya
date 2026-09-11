"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { Filter, MoreVertical, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useStudents } from "@/hooks/useStudents";
import { useGroups } from "@/hooks/useGroups";
import type { Group } from "@/lib/groups";
import type { Pupil, PupilListItem } from "@/lib/pupilsData";
import {
  applyStudentFilters,
  enrichStudents,
  EMPTY_STUDENT_FILTERS,
  studentRowFromPupil,
  uniqueSorted,
  type EnrichedStudent,
  type StudentFilters,
} from "@/lib/studentsData";
import Select from "@/components/ui/Select";

// O'quvchilar → Aktiv o'quvchilar (crm-akademiya #view-active-students,
// sidebar: O'quvchilar > Aktiv o'quvchilar, href /active-students).
//
// Ilgari bu sahifa BAZAGA umuman murojaat qilmasdi: qatorlarni lib/ordersData.ts
// dagi 502 ta demo buyurtma generatoridan (createInitialOrders) olardi va kim
// "aktiv" ekanini INDEKS ARIFMETIKASI bilan hisoblardi — `i % 13` muzlatilgan,
// `i % 5 === 1` yangi. Balans ham genBalance(seed) funksiyasi bilan o'ylab
// topilardi. Ya'ni ro'yxatdagi hech bir raqam haqiqiy emas edi.
//
// Endi hamma narsa haqiqiy manbadan:
//   • o'quvchilar — /api/pupils (hooks/useStudents.ts) + /api/groups
//     (hooks/useGroups.ts), enrichStudents() bilan birlashtiriladi: kurs va
//     guruh o'quvchining o'zida emas, u a'zo bo'lgan GURUHda saqlanadi;
//   • "aktiv" — endi HAQIQIY maydon: pupils.status === "Aktiv"
//     (lib/pupilsData.ts, PATCH /api/pupils/:id/status o'zgartiradi);
//   • balans — /api/students/balances (transaction_entries payIn yig'indisi),
//     chunki pupils.balance maydonini hech bir API yangilamaydi.
//
// Modelda manbasi bo'lmagan ustunlar ("Taklif qilganlari", "Ilovani yuklab
// olish sanasi", "Shartnoma") "—" bo'lib qoladi — soxta qiymat yozilmaydi.
// Ism ustiga bosilsa /student-edit/[id] ga o'tadi. Qator checkboxlari
// CSV/Excel eksportni tanlangan qatorlar bilan cheklaydi (hech narsa
// tanlanmasa — hammasi).

interface Row {
  student: EnrichedStudent;
  /** /api/students/balances dan (ism bo'yicha) — haqiqiy to'lovlar yig'indisi. */
  balance: number;
  /** pupils.paymentDate ("YYYY-MM-DD") — profil formasidagi haqiqiy maydon. */
  paymentDate: string;
}

function fmtUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}

// pupils.createdAt "DD.MM.YYYY | HH:mm" ko'rinishida saqlanadi
// (lib/pupilsData.ts → buildPupilFromValues). `new Date(...)` bu formatni
// tushunmaydi, shuning uchun sana oralig'i filtri uni o'zi ajratadi.
function parseCreated(s: string): Date | null {
  const m = (s || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

// DateField "YYYY-MM-DD" saqlaydi, jadvalning qolgan sanalari esa
// "DD.MM.YYYY" ko'rinishida — bir xil bo'lishi uchun o'giriladi.
function fmtIsoDate(s: string): string {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
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

const checkboxCls = "h-4 w-4 rounded border-border accent-primary cursor-pointer";
const HEADERS = ["№", "O'quvchi ismi", "Telefon raqam", "Balans", "To'lov sanasi", "Yaratilgan sanasi", "Moderator", "Taklif qilganlari", "Ilovani yuklab olish sanasi", "Sababi", "Shartnoma"];

function HeaderCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={checkboxCls} />;
}

/** SERVERDA olingan boshlang'ich ro'yxatlar — app/(app)/active-students/page.tsx. */
export interface ActiveStudentsPageProps {
  initialPupils?: (PupilListItem & Pick<Pupil, "paymentDate">)[];
  initialGroups?: Group[];
}

export default function ActiveStudentsPage({ initialPupils, initialGroups }: ActiveStudentsPageProps = {}) {
  // `status: "Aktiv"` — filtr SERVERDA. Ilgari 6 732 o'quvchi tortilib,
  // brauzerda 4 276 tasi qoldirilardi (pastdagi `.filter(s.status === "Aktiv")`
  // himoya sifatida joyida qoladi). `paymentDate` — "To'lov sanasi" ustuni.
  //
  // `initial…` berilsa ikkala ro'yxat ham sahifa bilan birga kelgan —
  // birinchi renderdayoq jadval to'la, so'rov yuborilmaydi.
  const { pupils, loading: pupilsLoading } = useStudents({
    extra: ["paymentDate"] as const,
    status: "Aktiv",
    initial: initialPupils,
  });
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
  // Toolbardagi qidiruv StudentFilters.name dan ALOHIDA: `name` faqat ism
  // bo'yicha tekshiradi, bu maydon esa (ilgarigi applyOrdersFilters kabi)
  // ko'rinadigan hamma ustun bo'yicha qidiradi.
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const moreRef = useRef<HTMLDivElement>(null);

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

  const rows = useMemo<Row[]>(() => {
    // "To'lov sanasi" StudentRow'da yo'q, lekin pupils hujjatida bor —
    // shuning uchun xom o'quvchi yozuvidan id bo'yicha olinadi.
    const paymentDateById = new Map(pupils.map((p) => [p.id, p.paymentDate ?? ""]));
    return enrichStudents(pupils.map(studentRowFromPupil), groups)
      // "Aktiv o'quvchilar" = holati "Aktiv" bo'lganlar. Boshqa hech qanday
      // shart yo'q (ilgari bu yerda indeks arifmetikasi turardi).
      .filter((s) => s.status === "Aktiv")
      .map((s) => ({
        student: s,
        balance: balances[balanceKey(s.name)] ?? 0,
        paymentDate: paymentDateById.get(s.id) ?? "",
      }));
  }, [pupils, groups, balances]);

  // Filtr ro'yxatlari faqat HAQIQATDA uchraydigan qiymatlardan quriladi —
  // ilgari ular ordersData.ts dagi qattiq yozilgan MODERATORS/COURSES
  // konstantalari edi va bazadagi ma'lumot bilan bog'liq emasdi.
  const moderatorOptions = useMemo(() => uniqueSorted(rows.map((r) => r.student.moderator)), [rows]);
  const courseOptions = useMemo(() => uniqueSorted(rows.map((r) => r.student.course)), [rows]);

  const filtered = useMemo(() => {
    const ids = new Set(applyStudentFilters(rows.map((r) => r.student), filters).map((s) => s.id));
    // Oraliq chegaralari MAHALLIY vaqtda quriladi: ilgari sana
    // toISOString().slice(0,10) bilan UTC'ga o'girilar va +5 mintaqada
    // chegaradagi kun bir kunga surilib ketardi.
    const from = dateRange.start
      ? new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate())
      : null;
    const to = dateRange.end
      ? new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate(), 23, 59, 59)
      : null;
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (!ids.has(r.student.id)) return false;
      if (from || to) {
        const dt = parseCreated(r.student.createdAt);
        if (!dt) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      if (q) {
        const hay = [
          r.student.name, r.student.phone, String(r.student.id), r.student.moderator,
          r.student.course, r.student.groupNames, r.student.category, r.student.source,
          r.student.createdAt, fmtIsoDate(r.paymentDate),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters, dateRange, search]);

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
      r.student.name,
      r.student.phone,
      r.balance,
      fmtIsoDate(r.paymentDate),
      r.student.createdAt,
      r.student.moderator,
      "", // Taklif qilganlari — pupils modelida referral maydoni yo'q.
      "", // Ilovani yuklab olish sanasi — bunday maydon ham hech qayerda yozilmaydi.
      r.student.statusReason,
      "", // Shartnoma — `contracts` kolleksiyasi o'quvchiga bog'lanmagan.
    ]);
  }
  function exportCSV() {
    const csv = [HEADERS, ...exportRows()].map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "aktiv-oquvchilar.csv");
    setMoreOpen(false);
  }
  function exportExcel() {
    const head = "<tr>" + HEADERS.map((h) => `<th style="background:#dbeafe;color:#1e3a8a;font-weight:bold;border:1px solid #94a3b8;padding:8px 10px;text-align:left;">${h}</th>`).join("") + "</tr>";
    const bodyRows = exportRows().map((r) => "<tr>" + r.map((v) => `<td style="border:1px solid #cbd5e1;padding:6px 10px;">${v}</td>`).join("") + "</tr>").join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;}table{border-collapse:collapse;}</style></head><body><table><thead>${head}</thead><tbody>${bodyRows}</tbody></table></body></html>`;
    downloadBlob(new Blob(["﻿" + html], { type: "application/vnd.ms-excel;charset=utf-8" }), "aktiv-oquvchilar.xls");
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
          <Select value={filters.moderator} onChange={(v) => setFilter("moderator", v)} options={moderatorOptions.map((m) => ({ value: m, label: m }))} placeholder="Moderator" clearable size="sm" className="w-44" />
          <Select value={filters.course} onChange={(v) => setFilter("course", v)} options={courseOptions.map((c) => ({ value: c, label: c }))} placeholder="Kurs" clearable size="sm" className="w-36" />
          <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} placeholder="Oraliqni tanlang" />
          <button
            onClick={() => { setFilters(EMPTY_STUDENT_FILTERS); setSearch(""); setDateRange({ start: null, end: null }); setPage(1); }}
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
                <th className="text-left px-3 py-3 whitespace-nowrap">O&apos;quvchi ismi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Telefon raqam</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Balans</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">To&apos;lov sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Yaratilgan sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Moderator</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Taklif qilganlari</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Ilovani yuklab olish sanasi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Sababi</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">Shartnoma</th>
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
                  <td className="px-3 py-3 text-[13px]">
                    {/* ?src=list — bazadagi o'quvchi id'lari demo buyurtma id'lari bilan
                        kesishadi, bu belgisiz profil sahifasi boshqa odamni ochib yuborishi mumkin. */}
                    <Link href={`/student-edit/${r.student.id}?src=list`} className="font-medium hover:text-primary hover:underline">
                      {r.student.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums whitespace-nowrap">{r.student.phone || "—"}</td>
                  <td className={`px-3 py-3 text-[13px] tabular-nums whitespace-nowrap ${r.balance < 0 ? "text-rose-600" : r.balance > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{fmtUZS(r.balance)}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.paymentDate ? fmtIsoDate(r.paymentDate) : "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{r.student.createdAt || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{r.student.moderator || "—"}</td>
                  {/* Taklif qilganlari — pupils modelida taklif/referral maydoni yo'q. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Ilovani yuklab olish sanasi — mobil ilova hodisalari bazada yozilmaydi. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                  {/* Sababi — pupils.statusReason haqiqiy maydon, lekin "Aktiv" ga
                      o'tkazilganda status API uni bo'shatadi, shuning uchun bu
                      sahifada deyarli doim "—" bo'ladi. */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.student.statusReason || "—"}</td>
                  {/* Shartnoma — `contracts` kolleksiyasi o'quvchiga bog'lanmagan (studentId yo'q). */}
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={12} className="px-3">
                    <SpinnerBlock />
                  </td>
                </tr>
              )}
              {!loading && slice.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center text-sm text-muted-foreground">O&apos;quvchi topilmadi</td>
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
    </div>
  );
}
