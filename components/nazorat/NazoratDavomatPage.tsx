"use client";

import { loadBalancesCached } from "@/lib/balancesClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { useRouter } from "next/navigation";
import { Eye, MoreVertical, Archive, ArchiveRestore, MessageSquare } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useStudents } from "@/hooks/useStudents";
import { downloadTableCsv, downloadTableExcel, type Cell } from "@/lib/exportTable";
import { ABSENCE_REASONS, ATTENDANCE_COLOR, ATTENDANCE_OPTIONS, type AttendanceStatus } from "@/lib/attendance";
import { WEEKDAYS_FULL } from "@/lib/i18n";
import DavomatCommentModal from "./DavomatCommentModal";
import { dateToIso, isoToDate, isoToLabel, useNazoratAttendance } from "./useNazoratAttendance";
import PersonLink from "@/components/shared/PersonDirectory";

// Nazorat > Davomat (sidebar: Nazorat > Davomat, /nazorat-davomat).
//
// ILGARI: jadval `constants/davomat.js` dagi 16 ta QO'LDA YOZILGAN qatordan
// to'lardi, "Balans" ustuni o'sha qatorlarning o'ylab topilgan sonlari edi,
// to'qqizta filtrdan yettitasi esa state'ni o'zgartirar-u, hech narsani
// filtrlamas edi.
// HOZIR: har bir qator — bazadagi HAQIQIY davomat belgisi (`attendance`
// kolleksiyasi, /api/groups/:id/attendance). O'quvchi ma'lumotlari
// /api/pupils dan, guruh/o'qituvchi /api/groups dan, balans esa
// /api/students/balances dan keladi (pupils.balance maydoni hech qachon
// yangilanmaydi — uni ko'rsatish mumkin emas).
//
// OLIB TASHLANGAN BOSHQARUVLAR:
//   * "Ranglar bo'yicha" tanlovi — bo'sh edi va o'quvchining "rangi" degan
//     maydon bazada umuman yo'q.
//   * "Import" — davomat belgilarini fayldan yuklaydigan endpoint yo'q edi,
//     import qilingan qatorlar faqat ekranda turardi va haqiqiy hisobotga
//     soxta qatorlar qo'shardi.
//
// ARXIV va SHARH `settings` kolleksiyasida `nazorat.davomat.v2` kaliti ostida
// saqlanadi (kalit — pupils.id). Bu o'quvchining bazadagi umumiy holatini
// (Aktiv/Muzlatilgan/Arxiv) o'zgartirmaydi — faqat shu hisobot ro'yxatidan
// olib qo'yadi, shuning uchun alohida kolleksiya ochilmadi.

// Kalit ATAYLAB "v2": eski "nazorat.davomat" kalitida arxiv/sharhlar
// DAVOMAT_STUDENTS ning o'ylab topilgan id'lari (1..16) bo'yicha saqlangan.
// Endi kalit sifatida HAQIQIY pupils.id ishlatiladi va o'sha raqamlar
// boshqa-boshqa o'quvchilarga tegishli — eski yozuvni o'qish tasodifiy
// o'quvchilarni ro'yxatdan yashirib qo'yardi.
const SETTINGS_KEY = "nazorat.davomat.v2";

const HEADERS = [
  "№", "ID", "O'quvchini ismi", "Telefon raqam", "Balans", "Guruh",
  "O'qituvchi", "Moderator", "Dars sanasi", "Holati", "Sababi", "Sharh",
];

const selectCls = "filter-select h-10 w-full appearance-none rounded-lg border border-border bg-card pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

// WEEKDAYS_FULL.uz dushanbadan boshlanadi, Date.getDay() esa yakshanbadan —
// shuning uchun to'g'ridan-to'g'ri indekslash mumkin emas.
const WEEKDAY_NAMES = WEEKDAYS_FULL.uz;
function weekdayName(d: Date): string {
  return WEEKDAY_NAMES[(d.getDay() + 6) % 7];
}

const STATUS_LABEL: Record<AttendanceStatus, string> = Object.fromEntries(
  ATTENDANCE_OPTIONS.map((o) => [o.key, o.label]),
) as Record<AttendanceStatus, string>;

/** Qoldirilgan dars — sababli ham, sababsiz ham (ikkalasida o'quvchi darsda yo'q). */
const MISSED_STATUSES = new Set<AttendanceStatus>(["sababli", "sababsiz"]);

function SelectWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg className="icon icon-xs pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
    </div>
  );
}

function formatBalance(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}

/** Jadvalning bitta qatori = bitta o'quvchining bitta darsdagi davomat belgisi. */
interface DavomatRow {
  key: string;
  pupilId: number;
  name: string;
  phone: string;
  balance: number;
  groupName: string;
  teacher: string;
  moderator: string;
  date: string;
  status: AttendanceStatus;
  reason: string;
}

export default function NazoratDavomatPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { groupById, marks, loading: attLoading } = useNazoratAttendance();
  const { students, loading: pupilsLoading } = useStudents();

  // Balans YAGONA haqiqiy manbadan — to'langan payIn yozuvlari yig'indisi.
  const [balances, setBalances] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    loadBalancesCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [day, setDay] = useState("");
  const [status, setStatus] = useState("");
  const [moderator, setModerator] = useState("");
  const [teacher, setTeacher] = useState("");
  const [reason, setReason] = useState("");
  const [group, setGroup] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [date, setDate] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [byMostMissed, setByMostMissed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // "⋮" menyusi (CSV / EXCEL eksport).
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Saqlanadigan holat.
  const [archived, setArchived] = useState<Set<number>>(new Set());
  const [comments, setComments] = useState<Record<number, string>>({});
  const [commentFor, setCommentFor] = useState<DavomatRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings?key=${SETTINGS_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return;
        const v = (d.values || {}) as { archived?: unknown; comments?: unknown };
        if (Array.isArray(v.archived)) setArchived(new Set(v.archived.map(Number)));
        if (v.comments && typeof v.comments === "object") setComments(v.comments as Record<number, string>);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const rows = useMemo<DavomatRow[]>(() => {
    const out: DavomatRow[] = [];
    for (const m of marks) {
      const g = groupById.get(m.groupId);
      const s = studentById.get(m.pupilId);
      // O'quvchi yoki guruh o'chirilgan bo'lsa belgi ham ko'rsatilmaydi —
      // ismsiz qator hisobotda faqat chalg'itadi.
      if (!s) continue;
      out.push({
        key: `${m.groupId}-${m.pupilId}-${m.date}`,
        pupilId: m.pupilId,
        name: s.name,
        phone: s.phone,
        balance: balances[s.name.trim().toLowerCase()] ?? 0,
        groupName: g?.name ?? "",
        teacher: g?.teacher ?? "",
        moderator: s.moderator,
        date: m.date,
        status: m.status,
        reason: m.reason ?? "",
      });
    }
    // Eng yangi dars yuqorida.
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)));
  }, [marks, groupById, studentById, balances]);

  // Filtr tanlovlari — hammasi bazadagi ma'lumotdan, qattiq yozilgan ro'yxatdan emas.
  const moderatorOptions = useMemo(
    () => [...new Set(students.map((s) => s.moderator).filter(Boolean))].sort(),
    [students],
  );
  const teacherOptions = useMemo(
    () => [...new Set([...groupById.values()].map((g) => g.teacher).filter(Boolean))].sort(),
    [groupById],
  );
  const groupOptions = useMemo(
    () => [...new Set([...groupById.values()].map((g) => g.name).filter(Boolean))].sort(),
    [groupById],
  );

  /** pupils.id → qoldirilgan darslar soni (haqiqiy belgilar bo'yicha). */
  const missedByPupil = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of marks) {
      if (!MISSED_STATUSES.has(m.status)) continue;
      map.set(m.pupilId, (map.get(m.pupilId) ?? 0) + 1);
    }
    return map;
  }, [marks]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const wantArchived = groupStatus === "Arxiv";
    const rangeStart = dateRange.start ? dateToIso(dateRange.start) : null;
    const rangeEnd = dateRange.end ? dateToIso(dateRange.end) : null;

    const res = rows.filter((r) => {
      if (archived.has(r.pupilId) !== wantArchived) return false;
      if (status && r.status !== status) return false;
      if (day && weekdayName(isoToDate(r.date)) !== day) return false;
      if (moderator && r.moderator !== moderator) return false;
      if (teacher && r.teacher !== teacher) return false;
      if (reason && r.reason !== reason) return false;
      if (group && r.groupName !== group) return false;
      if (date && r.date !== date) return false;
      if (rangeStart && r.date < rangeStart) return false;
      if (rangeEnd && r.date > rangeEnd) return false;
      if (q && !(r.name.toLowerCase().includes(q) || r.phone.includes(q) || String(r.pupilId).includes(q))) return false;
      return true;
    });

    if (!byMostMissed) return res;
    return [...res].sort((a, b) => (missedByPupil.get(b.pupilId) ?? 0) - (missedByPupil.get(a.pupilId) ?? 0));
  }, [rows, archived, groupStatus, status, day, moderator, teacher, reason, group, date, dateRange, search, byMostMissed, missedByPupil]);

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const pageKeys = slice.map((r) => r.key);
  const allPageChecked = pageKeys.length > 0 && pageKeys.every((k) => checked.has(k));

  function toggleAll(v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const k of pageKeys) {
        if (v) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }
  function toggleRow(key: string, v: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (v) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  /* ---------- Saqlash (settings) ---------- */

  async function persist(next: { archived?: number[]; comments?: Record<number, string> }): Promise<boolean> {
    const values = {
      archived: next.archived ?? [...archived],
      comments: next.comments ?? comments,
    };
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SETTINGS_KEY, values }),
    })
      .then((r) => r.json())
      .catch(() => null);
    return Boolean(res?.ok);
  }

  async function toggleArchive(r: DavomatRow) {
    const wasArchived = archived.has(r.pupilId);
    const next = new Set(archived);
    if (wasArchived) next.delete(r.pupilId);
    else next.add(r.pupilId);
    setArchived(next);
    if (await persist({ archived: [...next] })) {
      showSuccess(wasArchived ? `${r.name} arxivdan chiqarildi` : `${r.name} arxivlandi`);
    } else {
      setArchived(archived);
      showError("Saqlashda xatolik yuz berdi");
    }
  }

  async function saveComment(text: string) {
    if (!commentFor) return;
    const t = text.trim();
    const next = { ...comments };
    if (t) next[commentFor.pupilId] = t;
    else delete next[commentFor.pupilId];
    setBusy(true);
    const ok = await persist({ comments: next });
    setBusy(false);
    if (!ok) {
      showError("Saqlashda xatolik yuz berdi");
      return;
    }
    setComments(next);
    showSuccess(t ? "Sharh saqlandi" : "Sharh o'chirildi");
    setCommentFor(null);
  }

  /* ---------- Eksport ---------- */

  function exportRows(): Cell[][] {
    return filtered.map((r, i) => [
      i + 1,
      r.pupilId,
      r.name,
      r.phone,
      formatBalance(r.balance),
      r.groupName || "—",
      r.teacher || "—",
      r.moderator || "—",
      isoToLabel(r.date),
      STATUS_LABEL[r.status],
      r.reason || "—",
      comments[r.pupilId] || "",
    ]);
  }

  function exportCSV() {
    downloadTableCsv(HEADERS, exportRows(), "davomat.csv");
    showSuccess(`CSV yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  function exportExcel() {
    downloadTableExcel(HEADERS, exportRows(), "davomat.xls");
    showSuccess(`Excel yuklab olindi — ${filtered.length} ta`);
    setMoreOpen(false);
  }

  const viewingArchive = groupStatus === "Arxiv";
  const loading = attLoading || pupilsLoading;

  return (
    <div className="page-frame container mx-auto max-w-[1900px] p-4 md:p-5 space-y-4">
      {/* Header qatori */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/nazorat-davomat/viewing"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"
        >
          <Eye className="icon icon-sm" />
          <span>O&apos;quvchilarni davomatini ko&apos;rish</span>
        </Link>

        <div className="relative" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className="h-10 w-10 rounded-lg hover:bg-secondary inline-flex items-center justify-center"
            title="Amallar"
          >
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>CSV faylini yuklab olish</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>EXCEL faylini yuklab olish</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filtrlar 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={day} onChange={(e) => resetPage(setDay)(e.target.value)} className={selectCls}>
            <option value="">Kun</option>
            {WEEKDAY_NAMES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={status} onChange={(e) => resetPage(setStatus)(e.target.value)} className={selectCls}>
            <option value="">Holati — barchasi</option>
            {ATTENDANCE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={moderator} onChange={(e) => resetPage(setModerator)(e.target.value)} className={selectCls}>
            <option value="">Moderator</option>
            {moderatorOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={teacher} onChange={(e) => resetPage(setTeacher)(e.target.value)} className={selectCls}>
            <option value="">O&apos;qituvchi</option>
            {teacherOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={reason} onChange={(e) => resetPage(setReason)(e.target.value)} className={selectCls}>
            <option value="">Sababi</option>
            {ABSENCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </SelectWrap>
      </div>

      {/* Filtrlar 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <SelectWrap>
          <select value={group} onChange={(e) => resetPage(setGroup)(e.target.value)} className={selectCls}>
            <option value="">Guruh</option>
            {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SelectWrap>
        <SelectWrap>
          <select value={groupStatus} onChange={(e) => resetPage(setGroupStatus)(e.target.value)} className={selectCls}>
            <option value="">O&apos;quvchini guruhdagi holati</option>
            <option value="Aktiv">Aktiv</option>
            <option value="Arxiv">Arxiv</option>
          </select>
        </SelectWrap>
        <div className="relative">
          <input
            type="date"
            value={date}
            onChange={(e) => resetPage(setDate)(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <svg className="icon icon-xs pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-calendar" /></svg>
          {date && (
            <button type="button" onClick={() => resetPage(setDate)("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <svg className="icon icon-xs"><use href="#i-x-circle" /></svg>
            </button>
          )}
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={(r) => { setDateRange(r); setPage(1); }}
          placeholder="Oraliqni tanlang"
        />

        {/* Ro'yxatni QOLDIRILGAN DARSLAR soni bo'yicha saralaydi — son
            `attendance` dagi sababli/sababsiz belgilardan hisoblanadi. */}
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={byMostMissed}
            onChange={(e) => { setByMostMissed(e.target.checked); setPage(1); }}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span>Eng ko&apos;p dars qoldirganlar bo&apos;yicha</span>
        </label>
      </div>

      {/* Qidirish */}
      <div className="relative max-w-md">
        <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-search" /></svg>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          type="text"
          placeholder="Qidirish"
          className="h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Jadval */}
      <div className="table-frame rounded-2xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-end px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
            <span>Umumiy soni:</span>
            <span className="tabular-nums">{filtered.length}</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1500px]">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 text-left w-10">
                  <input type="checkbox" checked={allPageChecked} onChange={(e) => toggleAll(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                </th>
                <th className="px-3 py-3 text-left w-12">№</th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-left">O&apos;quvchini ismi</th>
                <th className="px-3 py-3 text-left">Telefon raqam</th>
                <th className="px-3 py-3 text-right">Balans</th>
                <th className="px-3 py-3 text-left">Guruh</th>
                <th className="px-3 py-3 text-left">O&apos;qituvchi</th>
                <th className="px-3 py-3 text-left">Moderator</th>
                <th className="px-3 py-3 text-left">Dars sanasi</th>
                <th className="px-3 py-3 text-left">Holati</th>
                <th className="px-3 py-3 text-left">Sababi</th>
                <th className="px-3 py-3 text-right pr-5">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slice.map((r, i) => (
                <tr
                  key={r.key}
                  // Ism ham uzatiladi — ko'rish sahifasi shu bilan
                  // filtrlaydi va o'zi o'quvchilar ro'yxatini
                  // so'ramaydi (NazoratDavomatViewingPage.tsx).
                  onClick={() => router.push(`/nazorat-davomat/viewing?studentId=${r.pupilId}&student=${encodeURIComponent(r.name)}`)}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(r.key)} onChange={(e) => toggleRow(r.key, e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                  <td className="px-3 py-3 text-[12px] font-mono text-muted-foreground">{r.pupilId}</td>
                  <td className="px-3 py-3 font-medium" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/student-edit/${r.pupilId}`} className="hover:text-primary hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[13px]">{r.phone || "—"}</td>
                  <td className={`px-3 py-3 text-right tabular-nums ${r.balance < 0 ? "text-rose-600" : r.balance > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {formatBalance(r.balance)}
                  </td>
                  <td className="px-3 py-3">{r.groupName || "—"}</td>
                  <td className="px-3 py-3"><PersonLink name={r.teacher} kind="staff" /></td>
                  <td className="px-3 py-3"><PersonLink name={r.moderator} kind="staff" /></td>
                  <td className="px-3 py-3 tabular-nums text-[13px] text-muted-foreground">{isoToLabel(r.date)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ATTENDANCE_COLOR[r.status] }} />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[13px]">
                    <div>{r.reason || "—"}</div>
                    {comments[r.pupilId] && (
                      <div className="mt-0.5 text-[12px] text-muted-foreground">{comments[r.pupilId]}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right pr-5" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleArchive(r)}
                        title={viewingArchive ? "Arxivdan chiqarish" : "Arxivlash"}
                        className="h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-primary"
                      >
                        {viewingArchive ? <ArchiveRestore className="icon icon-xs" /> : <Archive className="icon icon-xs" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCommentFor(r)}
                        title={comments[r.pupilId] ? "Sharhni tahrirlash" : "Sharh qo'shish"}
                        className={`h-8 w-8 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary ${comments[r.pupilId] ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <MessageSquare className="icon icon-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 rounded-2xl bg-secondary/60 flex items-center justify-center mb-4">
                        <svg className="icon" style={{ width: 32, height: 32, opacity: 0.45 }}><use href="#i-archive" /></svg>
                      </div>
                      <h3 className="text-[15px] font-semibold mb-1">
                        {loading ? <Spinner size={22} /> : "Ma'lumotlar topilmadi"}
                      </h3>
                      {!loading && (
                        <p className="text-[13px] text-muted-foreground">
                          {rows.length === 0
                            ? "Hali birorta darsga davomat belgilanmagan."
                            : "Filterni o'zgartirib ko'ring"}
                        </p>
                      )}
                    </div>
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

      {commentFor && (
        <DavomatCommentModal
          studentName={commentFor.name}
          initialValue={comments[commentFor.pupilId] || ""}
          busy={busy}
          onClose={() => setCommentFor(null)}
          onSave={saveComment}
        />
      )}
    </div>
  );
}
