"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { CirclePlus, Filter, History, ListChecks, MessageSquare, MoreVertical, Plus, Share2, UserCog, Users, X } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import AddStudentModal from "@/components/orders/AddStudentModal";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import SmsModal from "@/components/orders/SmsModal";
import StudentStatusModal from "@/components/students/StudentStatusModal";
import { useToast } from "@/components/ui/Toast";
import { usePupils } from "@/components/orders/PupilsContext";
import { useEduCategoryNames } from "@/hooks/useEduCategories";
import {
  applyStudentFilters,
  enrichStudents,
  EMPTY_STUDENT_FILTERS,
  STUDENT_STATUSES,
  studentRowFromPupil,
  uniqueSorted,
  type StudentFilters,
  type StudentRow,
} from "@/lib/studentsData";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import PersonLink from "@/components/shared/PersonDirectory";
import Select from "@/components/ui/Select";

// O'quvchilar → O'quvchilar ro'yxati (sidebar: O'quvchilar > O'quvchilar
// ro'yxati, href /students-list). Yangi/Aktiv/Arxiv o'quvchilar
// sahifalaridan farqli o'laroq (ular umumiy Orders havzasidan hosil bo'ladi),
// bu — BAZADAGI barcha o'quvchilarning yagona ro'yxati: MongoDB `pupils` →
// /api/pupils, sahifaga PupilsContext orqali keladi. Ilgari bu yerda
// constants/studentsList.js dagi generator bilan yasalgan 5909 ta demo yozuv
// ko'rinardi — u olib tashlandi.
//
// "O'quvchi qo'shish" — orders-list'dagi bilan bir xil AddStudentModal +
// PupilsContext (haqiqiy /api/pupils'ga saqlanadi, layout.tsx orqali
// ulanadi); qo'shilgan o'quvchi darhol ro'yxat boshida paydo bo'ladi.
//
// "To'lov sanasi" / "Taklif qilganlari" / "Ilovani yuklab olish sanasi" /
// "Kelmagan davri" / "Shartnoma" ustunlari uchun o'quvchi modelida maydon
// yo'q — referensdagidek bo'sh turadi.

// StudentRow / StudentFilters endi lib/studentsData.ts da — filtrlash mantiqi
// bilan birga, chunki ular bir-biriga bog'liq.

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

/**
 * Bironta filtr to'ldirilganmi. "Tozalash" tugmasi faqat shunda ko'rinadi —
 * hammasi bo'sh turganda u shunchaki shovqin.
 */
function hasActiveFilters(f: StudentFilters): boolean {
  return (Object.keys(EMPTY_STUDENT_FILTERS) as (keyof StudentFilters)[])
    .some((k) => f[k] !== EMPTY_STUDENT_FILTERS[k]);
}

/**
 * Filtr tanlovi: oddiy satr yoki "qiymat boshqa, ko'rinadigan matn boshqa"
 * juftligi. Ikkinchisi Guruh filtri uchun kerak — filtr guruh ID'si bo'yicha
 * ishlaydi (lib/studentsData.ts), lekin ro'yxatda ID emas, nomi va o'qituvchisi
 * ko'rinishi kerak.
 */
type FilterOption = string | { value: string; label: string };

/** Filtr paneli uchun yorliqli select — 13 marta takrorlanmasligi uchun. */
function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly FilterOption[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-muted-foreground">{label}</label>
      <Select value={value} onChange={(v) => onChange(v)} options={options.map((o) => { const v = typeof o === "string" ? o : o.value; const l = typeof o === "string" ? o : o.label; return { value: v, label: l }; })} placeholder="Hammasi" clearable size="sm" />
    </div>
  );
}

export default function StudentsListPage() {
  // O'quvchilar — bazadan (PupilsProvider, app/(app)/students-list/layout.tsx).
  // Guruhlar ham bazadan: o'quvchining kursi/o'qituvchisi/dars kunlari u a'zo
  // bo'lgan guruhdan kelib chiqadi (lib/studentsData.ts → enrichStudents).
  const { pupils, loading } = usePupils();
  const [groups, setGroups] = useState<Group[]>([]);
  // Balans /api/students/balances dan (transaction_entries bo'yicha
  // hisoblangan HAQIQIY to'lovlar). `pupils.balance` maydonini hech bir API
  // yangilamaydi — u faqat seed skriptidagi qiymatlarni saqlaydi, ya'ni
  // ustunda ham, Qarzdor/Haqdor jamida ham, eksportda ham soxta son
  // ko'rinardi (Kassa Kirim oynasi bilan bir xil manba endi).
  const [balances, setBalances] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroups(d.groups); });
    loadBalancesCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // Holat o'zgarishlarining mahalliy ustma-usti. PupilsContext faqat
  // `createPupil` ni biladi — bazadagi o'quvchini YANGILASH usuli unda yo'q,
  // shuning uchun PATCH .../status dan qaytgan hujjatni shu yerda ustiga
  // qo'yamiz. Aks holda holat bazada o'zgargani bilan jadval sahifa qayta
  // yuklanmaguncha eski holatni ko'rsatib turardi.
  const [statusPatch, setStatusPatch] = useState<
    Record<number, Pick<Pupil, "status" | "statusReason" | "statusChangedAt">>
  >({});
  const rows = useMemo(
    () =>
      enrichStudents(
        pupils.map((p) => {
          const row = studentRowFromPupil(statusPatch[p.id] ? { ...p, ...statusPatch[p.id] } : p);
          return { ...row, balance: balances[row.name.trim().toLowerCase()] ?? 0 };
        }),
        groups,
      ),
    // `statusPatch` ham bog'liqlikda: u o'zgarganda qatorlar (va ular ustidan
    // ishlaydigan "Holati" filtri) qayta hisoblanishi kerak.
    [pupils, groups, statusPatch, balances],
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_STUDENT_FILTERS);
  // O'quvchi kategoriyalari — O'quv bo'limi → Kategoriya (`edu_categories`).
  // Filtrda ham tanlangan qiymat ro'yxatdan tushib qolmasin (hook izohi).
  const { names: categoryNames } = useEduCategoryNames(filters.category);
  // Filtrlar sahifaning YUQORISIDA, jadval ustida turadi (referensdagidek)
  // va odatda ochiq. Ilgari bu o'ng tomondan chiqadigan panel edi: jadval
  // filtr bilan bir vaqtda ko'rinmasdi, ya'ni har o'zgarishdan keyin
  // panelni yopib-ochish kerak bo'lardi. "Filtr" tugmasi endi shu setkani
  // yig'ib qo'yadi — ustunlar ko'p bo'lgani uchun joy kerak bo'lsa.
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  // Qator ikonkalari: guruhga qoʻshish, SMS oynasi va holatni o'zgartirish.
  const [groupFor, setGroupFor] = useState<{ id: number; name: string } | null>(null);
  const [smsFor, setSmsFor] = useState<{ id: number; name: string; phone: string } | null>(null);
  // Xabar ikonkasi endi darhol oyna ochmaydi, avval kichik menyu chiqaradi.
  // Menyu `position: fixed` — jadval `overflow-x: auto` ichida bo'lgani
  // uchun oddiy `absolute` menyu oxirgi ustunda kesilib qolardi.
  const [smsMenu, setSmsMenu] = useState<
    { id: number; name: string; phone: string; top: number; left: number } | null
  >(null);
  const smsMenuRef = useRef<HTMLDivElement>(null);
  const [statusFor, setStatusFor] = useState<{ id: number; name: string; status: string; statusReason?: string } | null>(null);
  const { showSuccess: toastOk, showError: toastErr } = useToast();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  // Xabar menyusi: tashqariga bosilsa yopiladi. Menyu sahifaga nisbatan
  // qotirilgani uchun jadval yoki sahifa aylantirilsa ham yopiladi —
  // aks holda u tugmadan ajralib, havoda osilib qolardi.
  useEffect(() => {
    if (!smsMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && smsMenuRef.current?.contains(t)) return;
      setSmsMenu(null);
    };
    const close = () => setSmsMenu(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [smsMenu]);

  // Filtr tanlovlari — faqat ma'lumotda HAQIQATDA uchraydigan qiymatlar.
  const moderatorOptions = useMemo(() => uniqueSorted(rows.map((r) => r.moderator)), [rows]);
  const sourceOptions = useMemo(() => uniqueSorted(rows.map((r) => r.source)), [rows]);
  const courseOptions = useMemo(() => uniqueSorted(groups.map((g) => g.course)), [groups]);
  const teacherOptions = useMemo(() => uniqueSorted(groups.map((g) => g.teacher)), [groups]);
  const dayOptions = useMemo(() => uniqueSorted(groups.map((g) => g.day)), [groups]);
  const subcourseOptions = useMemo(() => uniqueSorted(groups.map((g) => g.level)), [groups]);
  // Guruh filtri: qiymat — guruh ID'si (applyStudentFilters shu bilan
  // solishtiradi), ko'rinadigan matn esa "(nom, o'qituvchi) raqam". Quruq
  // raqamdan qaysi guruh ekanini bilib bo'lmasdi. `name` ko'pincha id'ning
  // o'zi, shuning uchun u takrorlansa qavs ichida faqat o'qituvchi qoladi.
  const groupIdOptions = useMemo(
    () =>
      groups.map((g) => {
        const nom = (g.name || "").trim();
        const ustoz = (g.teacher || "").trim() || "o'qituvchisiz";
        const ichi = nom && nom !== String(g.id) ? `${nom}, ${ustoz}` : ustoz;
        return { value: String(g.id), label: `(${ichi}) ${g.id}` };
      }),
    [groups],
  );

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

  // Yangi o'quvchini ro'yxatga qo'shish kerak emas: PupilsContext uni
  // /api/pupils javobidan darhol o'z holatiga qo'shadi va `rows` shundan
  // hisoblanadi.
  function handlePupilSaved() {
    setAddOpen(false);
    setPage(1);
  }

  /** PATCH /api/pupils/:id/status muvaffaqiyatli tugagach jadvalni yangilash. */
  function handleStatusSaved(pupil: Pupil) {
    setStatusPatch((prev) => ({
      ...prev,
      [pupil.id]: {
        status: pupil.status,
        statusReason: pupil.statusReason,
        statusChangedAt: pupil.statusChangedAt,
      },
    }));
    // Arxivlashda API o'quvchini `groups.studentIds` dan ham chiqaradi.
    // Mahalliy `groups` nusxasi bir marta yuklanadi va o'z-o'zidan
    // yangilanmaydi, shuning uchun uni ham qo'lda tozalaymiz — aks holda
    // "Guruhlar" ustuni hamda "Guruh"/"Guruhlar soni"/"Kurs" filtrlari
    // allaqachon uzilgan a'zolikni ko'rsatib turardi.
    if (pupil.status === "Arxiv") {
      setGroups((prev) =>
        prev.map((g) =>
          g.studentIds?.includes(pupil.id)
            ? { ...g, studentIds: g.studentIds.filter((sid) => sid !== pupil.id) }
            : g,
        ),
      );
    }
    setStatusFor(null);
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
          onClick={() => setFiltersOpen((o) => !o)}
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

      {/* Filtrlar — jadval USTIDA, doim ko'rinadigan setka (referensdagidek).
          Ilgari bu o'ng tomondan chiqadigan panel edi va jadvalni to'sib
          qo'yardi: natijani ko'rish uchun har safar panelni yopish kerak
          bo'lardi. Endi filtr ham, natija ham bir ekranda.

          Tanlov DARHOL qo'llanadi — "Saqlash" tugmasi yo'q. Panel yopiq
          bo'lganda kutish mantiqiy edi, ochiq setkada esa ortiqcha qadam.

          Faqat ma'lumoti bor filtrlar chizilgan; qolganlari (Teglar,
          Bloklanganlar, Oferta, Ilova holati, Ranglar, Referal, Shartnoma)
          uchun o'quvchi modelida maydon yo'q, shuning uchun ataylab
          qo'shilmagan — ishlamaydigan tugma qo'yishdan ko'ra yo'qligi
          ma'qul. */}
      {filtersOpen && (() => {
        const setF = <K extends keyof StudentFilters>(k: K, v: StudentFilters[K]) => {
          setFilters((f) => ({ ...f, [k]: v }));
          setPage(1);
        };
        const inputCls = "h-9 w-full min-w-0 rounded-lg border border-border bg-card px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
        return (
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <div>
                <label className="mb-1 block text-[12px] text-muted-foreground">O&apos;quvchi</label>
                <input
                  value={filters.name}
                  onChange={(e) => setF("name", e.target.value)}
                  placeholder="Ism bo'yicha"
                  className={inputCls}
                />
              </div>
              <FilterSelect label="Kurs" value={filters.course} onChange={(v) => setF("course", v)} options={courseOptions} />
              <FilterSelect label="Guruh" value={filters.group} onChange={(v) => setF("group", v)} options={groupIdOptions} />
              <FilterSelect label="Subkurs" value={filters.subcourse} onChange={(v) => setF("subcourse", v)} options={subcourseOptions} />
              <FilterSelect label="Manba" value={filters.source} onChange={(v) => setF("source", v)} options={sourceOptions} />

              <FilterSelect label="Moderator" value={filters.moderator} onChange={(v) => setF("moderator", v)} options={moderatorOptions} />
              <FilterSelect label="O'qituvchi" value={filters.teacher} onChange={(v) => setF("teacher", v)} options={teacherOptions} />
              <FilterSelect label="Kategoriya" value={filters.category} onChange={(v) => setF("category", v)} options={categoryNames} />
              <FilterSelect label="Guruhlar soni" value={filters.groupCount} onChange={(v) => setF("groupCount", v)} options={["0", "1", "2"]} />
              <FilterSelect label="Kun" value={filters.day} onChange={(v) => setF("day", v)} options={dayOptions} />

              <FilterSelect label="Toq/Juft kunlar" value={filters.oddEven} onChange={(v) => setF("oddEven", v)} options={["Toq", "Juft"]} />
              {/* "Holati" — applyStudentFilters `r.status` bilan solishtiradi,
                  u esa pupilStatusOf() orqali BAZADAGI holatdan keladi (ilgari
                  enrichStudents hammaga "Aktiv" yozib qo'yardi). Qator ikonkasi
                  orqali holat o'zgargach `statusPatch` qatorni yangilaydi, shu
                  sababli filtr darhol yangi holatga qarab ishlaydi. */}
              <FilterSelect label="Holati" value={filters.status} onChange={(v) => setF("status", v)} options={STUDENT_STATUSES} />

              <div>
                <label className="mb-1 block text-[12px] text-muted-foreground">Balans oralig&apos;i</label>
                <div className="flex items-center gap-1.5">
                  <input value={filters.balanceFrom} onChange={(e) => setF("balanceFrom", e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" placeholder="dan" className={inputCls} />
                  <span className="text-muted-foreground">—</span>
                  <input value={filters.balanceTo} onChange={(e) => setF("balanceTo", e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" placeholder="gacha" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-muted-foreground">Coin oralig&apos;i</label>
                <div className="flex items-center gap-1.5">
                  <input value={filters.coinFrom} onChange={(e) => setF("coinFrom", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="dan" className={inputCls} />
                  <span className="text-muted-foreground">—</span>
                  <input value={filters.coinTo} onChange={(e) => setF("coinTo", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="gacha" className={inputCls} />
                </div>
              </div>
            </div>

            {/* "Tozalash" faqat tozalanadigan narsa bo'lganda ko'rinadi —
                bo'sh setkada u shunchaki shovqin. */}
            {hasActiveFilters(filters) && (
              <div className="mt-3 flex justify-end border-t border-border pt-3">
                <button
                  onClick={() => { setFilters(EMPTY_STUDENT_FILTERS); setPage(1); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-[13px] font-medium hover:bg-secondary"
                >
                  <X className="icon icon-xs" /> Tozalash
                </button>
              </div>
            )}
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
                      {/* Referensda alohida "Holati" ustuni yo'q, shuning uchun
                          jadval tuzilishini o'zgartirmaymiz. Lekin holat faqat
                          filtrda ko'rinsa, uni o'zgartirgan foydalanuvchi
                          natijani umuman ko'rmasdi — nishon shu bo'shliqni
                          to'ldiradi. "Aktiv" — odatiy holat, shovqin
                          qilmasligi uchun nishonsiz qoladi. */}
                      {r.status !== "Aktiv" && (
                        <span
                          title={r.statusReason ? `Sabab: ${r.statusReason}` : undefined}
                          // Ranglar loyihadagi mavjud konvensiya bilan bir xil:
                          // Muzlatilgan — moviy (GroupStudentsPage va Dars
                          // jadvalidagi "Muzlatilgan" kartasi), Arxiv — betaraf.
                          className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-medium ${r.status === "Muzlatilgan" ? "bg-cyan-100 text-cyan-700" : "bg-secondary text-muted-foreground"}`}
                        >
                          {r.status}
                        </span>
                      )}
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
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap"><PersonLink name={r.moderator} kind="staff" /></td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">{r.groupNames}</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">—</td>
                    <td className="px-3 py-3 text-[13px]"><X className="h-4 w-4 text-rose-500" /></td>
                    <td className="px-3 py-3 text-[13px] text-muted-foreground">-</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {/* Ilgari beshtasi ham hech nima qilmasdi. Uchtasi
                          o'quvchi profilining kerakli tabini ochadi, biri
                          guruhga qo'shadi, biri SMS oynasini chiqaradi,
                          oxirgisi esa holatni o'zgartiradi. */}
                      <div className="flex items-center gap-1 text-primary">
                        <button
                          title="Guruhga qo'shish"
                          onClick={() => setGroupFor({ id: r.id, name: r.name })}
                          className="p-1.5 rounded-md hover:bg-secondary"
                        >
                          <CirclePlus className="h-4 w-4" />
                        </button>
                        <Link title="Vazifalar" href={`/student-edit/${r.id}?src=list&tab=vazifa`} className="p-1.5 rounded-md hover:bg-secondary">
                          <ListChecks className="h-4 w-4" />
                        </Link>
                        <Link title="Tarix" href={`/student-edit/${r.id}?src=list&tab=harakatlar`} className="p-1.5 rounded-md hover:bg-secondary">
                          <History className="h-4 w-4" />
                        </Link>
                        <button
                          title="Xabar"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setSmsMenu((cur) =>
                              cur?.id === r.id
                                ? null
                                : { id: r.id, name: r.name, phone: r.phone, top: rect.bottom + 4, left: rect.left },
                            );
                          }}
                          className={`p-1.5 rounded-md hover:bg-secondary${smsMenu?.id === r.id ? " bg-secondary" : ""}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <Link title="Guruhlar" href={`/student-edit/${r.id}?src=list&tab=guruh`} className="p-1.5 rounded-md hover:bg-secondary">
                          <Users className="h-4 w-4" />
                        </Link>
                        {/* Holatni o'zgartirishning YAGONA joyi: PATCH
                            /api/pupils/:id/status ni boshqa hech qaysi UI
                            chaqirmaydi, shu sababli har bir o'quvchi abadiy
                            "Aktiv" bo'lib qolar edi. */}
                        <button
                          title="Holatni o'zgartirish"
                          onClick={() => setStatusFor({ id: r.id, name: r.name, status: r.status, statusReason: r.statusReason })}
                          className="p-1.5 rounded-md hover:bg-secondary"
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-3 py-10 text-center text-sm text-muted-foreground">
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

      {addOpen && <AddStudentModal onClose={() => setAddOpen(false)} onSave={handlePupilSaved} />}

      {groupFor && (
        <GroupPickerModal
          onClose={() => setGroupFor(null)}
          onSelect={async (group) => {
            const res = await fetch(`/api/groups/${group.id}/students`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pupilId: groupFor.id }),
            }).then((r) => r.json()).catch(() => null);
            if (!res?.ok) {
              toastErr(res?.error || "Guruhga qo'shishda xatolik yuz berdi");
              return;
            }
            toastOk(`${groupFor.name} — "${group.name || group.id}" guruhiga qo'shildi`);
            setGroupFor(null);
          }}
        />
      )}

      {smsMenu && (
        <div
          ref={smsMenuRef}
          style={{ position: "fixed", top: smsMenu.top, left: Math.min(smsMenu.left, (typeof window === "undefined" ? 0 : window.innerWidth) - 188), zIndex: 60 }}
          className="w-44 rounded-lg border border-border bg-card shadow-xl py-1 text-sm"
        >
          <div className="px-3 py-1.5 text-[12px] text-muted-foreground truncate">{smsMenu.name}</div>
          <button
            onClick={() => {
              setSmsFor({ id: smsMenu.id, name: smsMenu.name, phone: smsMenu.phone });
              setSmsMenu(null);
            }}
            disabled={!smsMenu.phone}
            title={smsMenu.phone ? undefined : "Telefon raqam yo'q"}
            className="w-full text-left px-3 py-2 hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent"
          >
            SMS yuborish
          </button>
          {/* SMS tarixi — profilning SMS tabi, `sms_messages` jurnalini o'qiydi.
              Telegram bandi ataylab yo'q: bitta o'quvchiga yozish uchun uning
              `chatId` si kerak, u esa hech qayerda saqlanmaydi. */}
          <Link
            href={`/student-edit/${smsMenu.id}?src=list&tab=sms`}
            onClick={() => setSmsMenu(null)}
            className="block px-3 py-2 hover:bg-secondary"
          >
            SMS tarixi
          </Link>
        </div>
      )}

      {smsFor && (
        <SmsModal
          studentName={smsFor.name}
          phone={smsFor.phone}
          onClose={() => setSmsFor(null)}
          onSent={({ simulated }) => {
            if (simulated) toastErr("SMS jo'natilmadi: Eskiz sozlanmagan (jurnalga yozildi)");
            else toastOk("SMS yuborildi");
            setSmsFor(null);
          }}
          onError={toastErr}
        />
      )}

      {statusFor && (
        <StudentStatusModal
          student={statusFor}
          onClose={() => setStatusFor(null)}
          onSaved={handleStatusSaved}
        />
      )}
    </div>
  );
}
