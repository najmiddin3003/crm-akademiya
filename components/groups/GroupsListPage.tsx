"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { CalendarCheck, History, MoreVertical, Pencil, Plus } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { SpinnerBlock } from "@/components/ui/Spinner";
import GroupFormModal from "./GroupFormModal";
import type { Group } from "@/lib/groups";
import { GROUP_STATUS_LABELS } from "@/lib/groupRules";
import { applyGroupFilters, groupStudentCount, memberIdsOf } from "@/lib/groupsList";
import { groupsCsvBlob, groupsXlsBlob } from "@/lib/groupsExport";
import { downloadBlob } from "@/lib/studentsExport";
import PersonLink from "@/components/shared/PersonDirectory";
import TimeField from "@/components/ui/TimeField";
import { useT } from "@/components/shared/Language";
import { useGroupsList, type GroupsListInitial } from "./useGroupsList";

// Guruhlar ro'yxati (crm-akademiya #view-groups). SARIQ qator = bugun davomat
// qilinmagan guruh (g.highlighted). QIZIL "Guruh vaqti" = muddati o'tgan
// (g.periodExpired). Ma'lumot /api/groups dan; guruh nomi ustiga bosilsa
// /groups/[id] (detail) ga o'tadi.
//
// Ranglar Tailwind sinflari bilan, har biri `dark:` jufti bilan: ilgari sariq
// fon qattiq `#fef9c3` (style) edi va tungi rejimda oq matn och sariq ustida
// o'qilmasdi — foydalanuvchi 14.09.2026 da ko'rsatdi.
//
// Ma'lumot, filtr, sanash, import va eksport — yangi versiya bilan BITTA
// manbadan (./useGroupsList.ts, lib/groupsList.ts, lib/groupsExport.ts).

// Bazadagi holat kalitlari va yorliqlari — lib/groupRules.ts (modal va
// server bilan bitta ro'yxat). Ilgari ustunda XOM qiymat ("active")
// chiqardi va holati qanday bo'lishidan qat'i nazar DOIM yashil rangda edi.
const STATUS_LABEL: Record<string, string> = GROUP_STATUS_LABELS;
const STATUS_CLS: Record<string, string> = {
  gathering: "text-sky-600 dark:text-sky-400",
  active: "text-emerald-600 dark:text-emerald-400",
  frozen: "text-amber-600 dark:text-amber-400",
  archive: "text-muted-foreground",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));
const ODD_EVEN_OPTIONS = [
  { value: "Toq", label: "Toq kunlar" },
  { value: "Juft", label: "Juft kunlar" },
];

/** SERVERDA olingan boshlang'ich ro'yxatlar — app/(app)/groups/page.tsx. */
export type GroupsListPageProps = GroupsListInitial;

export default function GroupsListPage({ initialGroups, initialFrozenPupils }: GroupsListPageProps = {}) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess } = useToast();
  const { groups, loading, pupilsLoading, options, frozenIds, upsert, importing, importCsv } = useGroupsList({ initialGroups, initialFrozenPupils });

  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState("");
  const [course, setCourse] = useState("");
  const [room, setRoom] = useState("");
  const [day, setDay] = useState("");
  const [status, setStatus] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [oddEven, setOddEven] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Qatordagi "Tahrirlash" (20.09.2026, foydalanuvchi so'rovi) — guruh
  // tafsilotiga kirmasdan shu jadvalning o'zida tahrirlash. O'sha
  // GroupFormModal, `group` berilsa tahrirlash rejimida ochiladi.
  const [editFor, setEditFor] = useState<Group | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  const { teacher: teacherNames, course: courseNames, room: roomNames, day: dayNames } = options;

  const filtered = useMemo(
    () => applyGroupFilters(groups, search, { teacher, course, room, day, status, oddEven, startTime, endTime, eduType: "" }),
    [groups, search, teacher, course, room, day, status, oddEven, startTime, endTime],
  );

  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Guruhlarga qo'shilgan o'quvchilarning TAKRORLANMAS id'lari (lib/groupsList.ts).
  const memberIds = useMemo(() => memberIdsOf(groups), [groups]);

  // Muzlatilganlar soni — HAQIQIY holat bo'yicha. Ilgari bu yerda qattiq
  // `0` yozilgan edi, ya'ni bir nechta o'quvchi muzlatilgan bo'lsa ham
  // sahifa "0" deb yolg'on aytardi.
  const frozenStudents = useMemo(() => [...memberIds].filter((id) => frozenIds.has(id)).length, [memberIds, frozenIds]);

  // "1 234" ko'rinishida (referensdagidek probel bilan).
  const fmtCount = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ");

  function exportCSV() {
    downloadBlob(groupsCsvBlob(filtered), "guruhlar.csv");
    showSuccess(t("CSV yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }
  function exportExcel() {
    downloadBlob(groupsXlsBlob(filtered), "guruhlar.xls");
    showSuccess(t("Excel yuklab olindi — {filtered} ta", { filtered: filtered.length }));
    setMoreOpen(false);
  }

  return (
    <div className="page-frame container mx-auto max-w-[1600px] p-4 md:p-5 space-y-4">
      {/* i-list sprite (Pagination "qator" ikonkasi uchun) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-list" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></symbol>
        </defs>
      </svg>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
          <Plus className="icon icon-sm" />
          <span>{t("Qo'shish")}</span>
        </button>

        {/* Filtrlar — qo'lda yasalgan ui/Select: bo'sh qiymat "hammasi",
            placeholder esa filtr nomi. Uzun ro'yxatlarda (o'qituvchi, kurs,
            xona) qidiruv o'zi chiqadi. */}
        <Select size="sm" clearable className="w-36" value={teacher} onChange={(v) => { setTeacher(v); setPage(1); }} placeholder={t("O'qituvchi")} searchPlaceholder="O'qituvchini qidirish" options={teacherNames.map((tv) => ({ value: tv, label: tv }))} />

        {/* Vaqt filtrlari — TimeField: placeholder filtr nomi, tozalash X maydonning o'zida. */}
        <TimeField value={startTime} onChange={(v) => { setStartTime(v); setPage(1); }} placeholder={t("Boshlanish vaqti")} className="w-40" />
        <TimeField value={endTime} onChange={(v) => { setEndTime(v); setPage(1); }} placeholder={t("Tugash vaqti")} className="w-36" />

        <Select size="sm" clearable className="w-28" value={day} onChange={(v) => { setDay(v); setPage(1); }} placeholder={t("Kun")} options={dayNames.map((d) => ({ value: d, label: d }))} />
        <Select size="sm" clearable className="w-32" value={course} onChange={(v) => { setCourse(v); setPage(1); }} placeholder={t("Kurs")} searchPlaceholder="Kursni qidirish" options={courseNames.map((c) => ({ value: c, label: c }))} />
        <Select size="sm" clearable className="w-28" value={room} onChange={(v) => { setRoom(v); setPage(1); }} placeholder={t("Xona")} searchPlaceholder="Xonani qidirish" options={roomNames.map((r) => ({ value: r, label: r }))} />
        {/* Bo'sh qiymat "HAMMASI" degani, "aktivlar" emas — ilgari
            yorlig'i "Aktiv guruh" edi va arxivdagi guruh ro'yxatda
            turgani chalkashtirardi. */}
        <Select size="sm" clearable className="w-32" value={status} onChange={(v) => { setStatus(v); setPage(1); }} placeholder={t("Guruh holati")} options={STATUS_OPTIONS} />

        <div className="relative flex-1 min-w-[180px]">
          <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder={t("Qidirish")} className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </div>

        <div className="relative" ref={moreRef}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Bir xil faylni ketma-ket ikki marta tanlash mumkin bo'lsin.
              e.target.value = "";
              if (f) importCsv(f);
            }}
          />
          <button onClick={() => setMoreOpen((o) => !o)} className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary" title={t("Amallar")}>
            <MoreVertical className="icon icon-sm" />
          </button>
          {moreOpen && (
            <div className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1">
              <button
                onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}
                disabled={importing}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 text-[10px] font-bold text-primary">IN</span>
                <span>{importing ? t("Import qilinmoqda…") : t("Import (CSV)")}</span>
              </button>
              <button onClick={exportCSV} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">CSV</span>
                <span>{t("CSV faylini yuklab olish")}</span>
              </button>
              <button onClick={exportExcel} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left">
                <span className="inline-flex items-center justify-center h-6 px-1.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">XLS</span>
                <span>{t("EXCEL faylini yuklab olish")}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toq/Juft on right */}
      <div className="flex items-center justify-end">
        <Select size="sm" clearable className="w-44" value={oddEven} onChange={(v) => { setOddEven(v); setPage(1); }} placeholder={t("Toq/Juft kunlar")} options={ODD_EVEN_OPTIONS} />
      </div>

      {/* Stats — javob kelmaguncha "—": bo'sh ro'yxat ustidan hisoblangan 0
          ham xuddi qattiq yozilgan 0 kabi noto'g'ri da'vo bo'lardi. */}
      <div className="flex items-center gap-4 text-[13px]">
        <span className="text-muted-foreground">{t("Jami o'quvchilar soni:")}{" "}<span className="font-semibold text-foreground tabular-nums">{loading ? "—" : fmtCount(memberIds.size)}</span></span>
        <span className="text-muted-foreground">{t("Muzlatilgan o'quvchilar soni:")}{" "}<span className="font-semibold text-foreground tabular-nums">{loading || pupilsLoading ? "—" : fmtCount(frozenStudents)}</span></span>
        <div className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
          <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
          <span className="font-bold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-frame rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-3 whitespace-nowrap">№</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Guruh nomi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Kurs")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Darajasi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Kun")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Dars vaqti")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Guruh vaqti")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'quvchilar")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("O'qituvchi")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Xona")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Telegram link")}</th>
                <th className="text-left px-3 py-3 whitespace-nowrap">{t("Guruh holati")}</th>
                <th className="text-right px-3 py-3 whitespace-nowrap">{t("Amallar")}</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((g, i) => (
                <tr key={g.id} onClick={() => router.push(`/groups/${g.id}`)} className={`border-b border-border/50 transition-colors cursor-pointer ${g.highlighted ? "bg-yellow-100 hover:bg-yellow-200/70 dark:bg-amber-500/15 dark:hover:bg-amber-500/25" : "hover:bg-secondary/30"}`}>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums text-[13px]">{start + i + 1}</td>
                  <td className="px-3 py-3 tabular-nums font-medium text-[13px]">
                    <span className="text-foreground">{g.name}</span>
                  </td>
                  <td className="px-3 py-3 text-[13px]">{g.course}</td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{g.level || "—"}</td>
                  <td className="px-3 py-3 text-[13px]">{g.day || "—"}</td>
                  <td className="px-3 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{g.time || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {g.period ? (
                      <span className={g.periodExpired ? "inline-flex items-center px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-[12px] font-medium tabular-nums" : "text-muted-foreground tabular-nums text-[13px]"}>{g.period}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[13px] tabular-nums">{groupStudentCount(g)}</td>
                  <td className="px-3 py-3 text-[13px]"><PersonLink name={g.teacher} kind="staff" /></td>
                  <td className="px-3 py-3 text-[13px] text-muted-foreground">{g.room || "—"}</td>
                  <td className="px-3 py-3 text-[12px]">{g.telegram ? <a href={g.telegram} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{g.telegram}</a> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3 text-[12px]">
                    <span className={`font-medium ${STATUS_CLS[g.status] ?? "text-muted-foreground"}`}>
                      {STATUS_LABEL[g.status] ?? g.status}
                    </span>
                  </td>
                  {/* `e.stopPropagation()` MAJBURIY: butun qator bosiladigan
                      (`<tr onClick>`), to'xtatilmasa navigatsiya ikki marta
                      ketadi va `?tab=` parametri yo'qoladi. */}
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/groups/${g.id}?tab=attendance`}
                        onClick={(e) => e.stopPropagation()}
                        title={t("Davomat")}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center text-muted-foreground"
                      >
                        <CalendarCheck className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/groups/${g.id}?tab=history`}
                        onClick={(e) => e.stopPropagation()}
                        title={t("Guruh tarixi")}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center text-muted-foreground"
                      >
                        <History className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditFor(g); }}
                        title={t("Tahrirlash")}
                        className="h-8 w-8 rounded-md hover:bg-primary/10 hover:text-primary inline-flex items-center justify-center text-muted-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-10 text-center text-sm text-muted-foreground">{loading ? <SpinnerBlock size={22} /> : "Guruh topilmadi"}</td>
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
        <GroupFormModal
          groups={groups}
          onClose={() => setAddOpen(false)}
          onSaved={upsert}
        />
      )}

      {editFor && (
        <GroupFormModal
          group={editFor}
          groups={groups}
          onClose={() => setEditFor(null)}
          onSaved={upsert}
        />
      )}
    </div>
  );
}
