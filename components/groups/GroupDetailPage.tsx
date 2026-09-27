"use client";

import { loadBalancesByIdCached } from "@/lib/balancesClient";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive, BookOpen, Calendar, CalendarCheck, CalendarPlus, Clock, ClipboardList, GraduationCap,
  History, Inbox, LayoutGrid, List, MapPin, MessageSquare, MoreVertical, PanelLeft, PanelLeftClose,
  Pencil, Plus, Timer, Trash2, User, UserMinus, UserPlus, Users,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import { SpinnerBlock } from "@/components/ui/Spinner";
import AddStudentModal from "./AddStudentModal";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import AddLessonModal, { type GroupLesson } from "./AddLessonModal";
import AddTaskModal from "./AddTaskModal";
import AttendanceTab from "./AttendanceTab";
import GroupFormModal from "./GroupFormModal";
import {
  ATTENDANCE_OPTIONS,
  toIsoDate,
  type AttendanceHistoryEntry,
  type AttendanceStatus,
} from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import type { GroupTask } from "@/lib/groupTasks";
import PersonLink from "@/components/shared/PersonDirectory";
import Modal from "@/components/ui/Modal";
import { useT } from "@/components/shared/Language";

// Guruh tafsiloti (skrinshot 1-5). Chap "Guruh ma'lumotlari" kartasi guruh
// maydonlaridan. O'ngda 5 tab:
//  - O'quvchilar: guruhga qo'shilgan HAQIQIY o'quvchilar (/api/groups/:id/students,
//    pupils bilan join). "O'quvchi qo'shish" → serverdagi o'quvchini tanlab qo'shish.
//  - Davomat: shu a'zolar + davomat ustunlari.
//  - Topshiriqlar: /api/groups/:id/tasks.
//  - Mashg'ulot qo'shish: /api/groups/:id/lessons (avval bu tab faqat ustun
//    sarlavhalarini chizardi — na so'rov, na qo'shish tugmasi bor edi).
//  - Guruh tarixi: davomat o'zgarishlari tarixi
//    (/api/groups/:id/attendance/history). Avval "Umumiy soni: 0" qattiq
//    yozilgan edi va sana filtri hech narsani filtrlamasdi.
const TABS = [
  { key: "students", label: "O'quvchilar", icon: Users },
  { key: "tasks", label: "Topshiriqlar", icon: ClipboardList },
  { key: "lesson", label: "Mashg'ulot qo'shish", icon: CalendarPlus },
  { key: "history", label: "Guruh tarixi ma'lumotlari", icon: History },
  { key: "attendance", label: "Davomat", icon: CalendarCheck },
];

function nf(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " UZS";
}
function pupilName(p: Pupil): string {
  return `${p.firstName} ${p.lastName || ""}`.trim();
}

// "DD.MM.YYYY | HH:mm" (yoki "DD.MM.YYYY") → Date (faqat kun).
function parseUzDate(s: string): Date | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

// ===== "Guruh tarixi ma'lumotlari" tabi uchun yordamchilar =====

/** "2026-08-03" → "03.08.2026" — jadvaldagi boshqa sanalar bilan bir xil ko'rinish. */
function isoToUz(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** Tarix yozuvining "Turi" ustuni. `status: null` — belgi olib tashlangan. */
function historyTypeLabel(status: AttendanceStatus | null): string {
  if (status === null) return "Bekor qilindi";
  return ATTENDANCE_OPTIONS.find((o) => o.key === status)?.label ?? status;
}

function EmptyState({ withIcon = true }: { withIcon?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {withIcon && (
        <span className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-3 text-muted-foreground">
          <Inbox className="w-6 h-6" />
        </span>
      )}
      <div className="text-[14px] font-semibold">{t("Ma'lumotlar topilmadi")}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{t("Ma'lumotlar topilmadi. Filterni o'zgartirib ko'ring.")}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="inline-flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon className="w-4 h-4 text-primary" />
        {label}
      </span>
      <span className="text-[13px] font-medium text-right">{children}</span>
    </div>
  );
}

const thCls = "text-left px-4 py-3 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

export default function GroupDetailPage({ id }: { id: number }) {
  const { t } = useT();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // `joinedAt` — GET /api/groups/:id/students qo'shib beradi (a'zolik
  // tarixi, lib/groupMembership.ts): darslar shu kundan sanaladi. Yo'q
  // bo'lsa (sanasi noma'lum eski a'zolik) o'quvchi kartasi sanasi chiqadi.
  const [members, setMembers] = useState<(Pupil & { joinedAt?: string })[]>([]);
  // Qator amallari: boshqa guruhga koʻchirish / guruhdan chiqarish.
  const [moveFor, setMoveFor] = useState<Pupil | null>(null);
  const [removeFor, setRemoveFor] = useState<Pupil | null>(null);
  const [rowBusy, setRowBusy] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  // Tab holati MANZILDA: /groups/12?tab=attendance.
  //
  // Ilgari u `useState("students")` edi, ya'ni sahifaga qanday havola
  // qilinmasin foydalanuvchi doim "O'quvchilar" tabiga tushardi. Guruhlar
  // ro'yxatidagi "Davomat" va "Guruh tarixi" ikonkalari aynan shu
  // parametrga tayanadi. Naqsh components/imtihon/ImtihonPage.tsx dan.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qsTab = searchParams.get("tab") ?? "";
  const activeTab = TABS.some((tv) => tv.key === qsTab) ? qsTab : "students";
  const setActiveTab = useCallback(
    (tv: string) => {
      router.replace(tv === "students" ? pathname : `${pathname}?tab=${tv}`, { scroll: false });
    },
    [router, pathname],
  );
  // Chap "Guruh ma'lumotlari" kartasi yig'ilganmi. Yig'ilganda u tor ikonka
  // ustuniga aylanadi va o'ngdagi jadval bo'shagan joyni egallaydi — davomat
  // jadvali keng bo'lgani uchun bu ayniqsa foydali.
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [taskLayout, setTaskLayout] = useState<"list" | "grid">("list");
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  // Guruh tarixi tabining O'Z oralig'i. Ilgari u Topshiriqlar tabi bilan
  // bitta state'ni bo'lishardi: tarixda oraliqni toraytirish jimgina
  // topshiriqlar ro'yxatini ham qirqib tashlardi.
  const [historyRange, setHistoryRange] = useState<DateRange>({ start: null, end: null });
  // O'quvchilarning HAQIQIY balansi — ism bo'yicha kalitlangan
  // (/api/students/balances, `transaction_entries` dan hisoblanadi).
  // `pupils.balance` maydoni hech qaysi API tomonidan yangilanmaydi.
  const [balances, setBalances] = useState<Record<number, number>>({});

  // ===== "Mashg'ulot qo'shish" tabi =====
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonDeleteFor, setLessonDeleteFor] = useState<GroupLesson | null>(null);
  const [lessonBusy, setLessonBusy] = useState(false);

  // ===== "Guruh tarixi ma'lumotlari" tabi =====
  // Yuklangan yozuvlar `key` bilan birga saqlanadi: key — o'sha paytdagi
  // (guruh + a'zolar + sana oralig'i) kombinatsiyasi. Shu tufayli "yuklanmoqda"
  // holatini effekt tanasida setState qilmasdan aniqlash mumkin (effekt
  // tanasidagi sinxron setState "cascading render" ga olib keladi).
  const [historyData, setHistoryData] = useState<{ key: string; entries: AttendanceHistoryEntry[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setGroup(d.group); })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetch(`/api/groups/${id}/students`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setMembers(d.students); })
      .finally(() => { if (!cancelled) setMembersLoading(false); });
    fetch(`/api/groups/${id}/tasks`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setTasks(d.tasks); });
    loadBalancesByIdCached()
      .then((b) => { if (!cancelled) setBalances(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id]);

  // Balans ID bo'yicha — guruhda ismdosh ikki o'quvchi bo'lsa ularning
  // puli bitta kalitga qo'shilib ketardi (lib/pupilEntries.ts).
  const balanceOf = (p: Pupil) => balances[p.id] ?? 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? members.filter((m) => pupilName(m).toLowerCase().includes(q) || m.phone.includes(q)) : members;
  }, [members, search]);
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Topshiriqlarni sana oralig'i bo'yicha filtrlash (yaratilgan sana bo'yicha).
  const visibleTasks = useMemo(() => {
    const { start: rs, end: re } = dateRange;
    if (!rs || !re) return tasks;
    const s = new Date(rs.getFullYear(), rs.getMonth(), rs.getDate()).getTime();
    const e = new Date(re.getFullYear(), re.getMonth(), re.getDate(), 23, 59, 59).getTime();
    return tasks.filter((tv) => {
      const d = parseUzDate(tv.createdAt);
      return d ? d.getTime() >= s && d.getTime() <= e : true;
    });
  }, [tasks, dateRange]);

  // ---- Mashg'ulotlar ----
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${id}/lessons`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) setLessons(d.lessons as GroupLesson[]); })
      .finally(() => { if (!cancelled) setLessonsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // ---- Guruh tarixi ----
  // BITTA so'rov: /api/groups/:id/attendance/history?from&to butun guruh
  // bo'yicha qaytaradi. Ilgari bu yerda a'zolar × dars kunlari bo'yicha
  // har bir katakchaga alohida so'rov yuborilardi (yuzlab so'rov), va
  // katakchalar soni chegaradan oshsa tab umuman hech narsa
  // ko'rsatmasdi — ya'ni katta guruhda tarix hech qachon ochilmasdi.
  const historyKey = useMemo(() => {
    const from = historyRange.start ? toIsoDate(historyRange.start) : "";
    const to = historyRange.end ? toIsoDate(historyRange.end) : "";
    return `${id}|${from}|${to}`;
  }, [id, historyRange]);
  // Kalit mos kelmasa — bu boshqa filtrdan qolgan eski natija, ko'rsatmaymiz.
  const historyEntries = historyData?.key === historyKey ? historyData.entries : [];
  const historyLoading = activeTab === "history" && historyData?.key !== historyKey;

  useEffect(() => {
    // Faqat tab ochilganda yuklaymiz.
    if (activeTab !== "history") return;
    let cancelled = false;
    const q = new URLSearchParams();
    if (historyRange.start) q.set("from", toIsoDate(historyRange.start));
    if (historyRange.end) q.set("to", toIsoDate(historyRange.end));
    fetch(`/api/groups/${id}/attendance/history?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setHistoryData({
          key: historyKey,
          entries: d?.ok ? (d.entries as AttendanceHistoryEntry[]) : [],
        });
      })
      .catch(() => { if (!cancelled) setHistoryData({ key: historyKey, entries: [] }); });
    return () => { cancelled = true; };
  }, [activeTab, historyKey, historyRange, id]);

  /** Tarix qatoridagi o'quvchi ismi — a'zolar ro'yxatidan (id bo'yicha). */
  const historyPupilName = (pupilId: number): string => {
    const p = members.find((m) => m.id === pupilId);
    // Guruhdan chiqarilgan o'quvchining tarixi qolishi mumkin — ism o'rniga
    // id ko'rsatamiz, ism to'qib chiqarmaymiz.
    return p ? pupilName(p) : `#${pupilId}`;
  };

  async function deleteLesson(lesson: GroupLesson) {
    setLessonBusy(true);
    try {
      const res = await fetch(`/api/groups/${id}/lessons?lessonId=${lesson.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Mashg'ulot o'chirilmadi"));
        return;
      }
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
      showSuccess(t("Mashg'ulot o'chirildi"));
      setLessonDeleteFor(null);
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
    } finally {
      setLessonBusy(false);
    }
  }

  if (loading) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5 text-sm text-muted-foreground"><SpinnerBlock /></div>;
  }
  if (!group) {
    return (
      <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">{t("Guruh topilmadi.")}</p>
        <Link href="/groups" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">{t("Orqaga")}</Link>
      </div>
    );
  }

  const [periodStart, periodEnd] = (group.period || " - ").split(" - ");
  const days = group.day && !group.day.includes("kunlar") ? group.day.split(",") : group.day ? [group.day] : [];
  const existingIds = members.map((m) => m.id);

  async function confirmArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archive" }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(t(data.error || "Arxivlanmadi"));
        setArchiving(false);
        return;
      }
      showSuccess(t("Guruh arxivlandi"));
      router.push("/groups");
    } catch {
      showError(t("Serverga ulanib bo'lmadi"));
      setArchiving(false);
    }
  }

  const studentsToolbar = (
    <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border">
      <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
        <Plus className="icon icon-sm" />{t("O'quvchi qo'shish")}
      </button>
      <div className="flex-1" />
      <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        {t("Arxiv o'quvchilar")}
        <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" />
      </label>
      <div className="relative w-56">
        <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder={t("Qidirish")} className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
    </div>
  );

  return (
    <div className="page-frame-lg container mx-auto max-w-[1900px] p-4 md:p-5">
      {/* i-search sprite global (Navbar) — bor. Desktopda sahifa ekran
          balandligida qotadi (globals.css .group-detail-grid ramkasi): chap
          karta o'zi aylanadi, o'ngda jadval thead'i va paginatsiya qotadi. */}
      <div className={`group-detail-grid ${infoCollapsed ? "is-collapsed" : ""}`}>
        {/* LEFT: Guruh ma'lumotlari — yig'ilganda tor ikonka ustuni bo'ladi */}
        {infoCollapsed ? (
          <aside
            className="gd-aside hidden lg:flex w-12 flex-col items-center gap-1 rounded-2xl border border-border bg-card py-3"
            style={{ alignSelf: "start" }}
          >
            <button
              onClick={() => setInfoCollapsed(false)}
              title={t("Guruh ma'lumotlarini ochish")}
              className="h-8 w-8 rounded-lg text-primary hover:bg-secondary inline-flex items-center justify-center"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="my-1 h-px w-6 bg-border" />
            {[
              { icon: LayoutGrid, label: t("Guruh ma'lumotlari") },
              { icon: Calendar, label: t("Dars jadvali") },
              { icon: BookOpen, label: t("Akademik ma'lumot") },
              { icon: History, label: t("Guruh faoliyat muddati") },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                onClick={() => setInfoCollapsed(false)}
                title={label}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary inline-flex items-center justify-center"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
            <div className="flex-1" />
            <div className="my-1 h-px w-6 bg-border" />
            <button
              onClick={() => setArchiveConfirm(true)}
              title={t("Guruhni arxivlash")}
              className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-500/10 inline-flex items-center justify-center"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditOpen(true)}
              title={t("Tahrirlash")}
              className="h-8 w-8 rounded-lg text-primary hover:bg-secondary inline-flex items-center justify-center"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </aside>
        ) : (
        <aside className="gd-aside rounded-2xl bg-card border border-border p-5" style={{ alignSelf: "start" }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-[15px] font-bold tracking-tight">{t("Guruh ma'lumotlari")}</h2>
            <div className="flex-1" />
            <button
              onClick={() => setInfoCollapsed(true)}
              title={t("Yig'ish")}
              className="hidden lg:inline-flex h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary items-center justify-center"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Users} label={t("Guruh nomi")}>{group.name}</InfoRow>
            <InfoRow icon={GraduationCap} label={t("Daraja")}>{group.level || "—"}</InfoRow>
            <InfoRow icon={BookOpen} label={t("Ta'lim turi")}><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[12px] font-medium">{group.eduType || "offline"}</span></InfoRow>
            <InfoRow icon={MapPin} label={t("Xona / Platforma")}>{group.room || "—"}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">{t("Dars jadvali")}</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Clock} label={t("Dars vaqti")}>{group.time ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium tabular-nums">{group.time}</span> : "—"}</InfoRow>
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="inline-flex items-center gap-2.5 text-[13px] text-muted-foreground"><Calendar className="w-4 h-4 text-primary" />{t("Dars kunlari")}</span>
              <span className="flex flex-wrap justify-end gap-1">
                {days.length ? days.map((d) => <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{d.trim()}</span>) : "—"}
              </span>
            </div>
            <InfoRow icon={Timer} label={t("Dars davomiyligi")}>{t("2 soat")}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">{t("Akademik ma'lumot")}</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={BookOpen} label={t("Kurs / Fan")}>{group.course || "—"}</InfoRow>
            <InfoRow icon={User} label={t("O'qituvchi")}><PersonLink name={group.teacher} kind="staff" /></InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <History className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">{t("Guruh faoliyat muddati")}</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Calendar} label={t("Boshlanish sanasi")}>{periodStart || "—"}</InfoRow>
            <InfoRow icon={Calendar} label={t("Tugash kuni")}>{periodEnd || "—"}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button onClick={() => setArchiveConfirm(true)} className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-rose-600 text-white text-[13px] font-medium hover:bg-rose-700">{t("Guruhni arxivlash")}</button>
            <button onClick={() => setEditOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-primary text-white text-[13px] font-medium hover:opacity-90"><Pencil className="w-3.5 h-3.5" />{t("Tahrirlash")}</button>
          </div>
        </aside>
        )}

        {/* RIGHT */}
        <div className="gd-right space-y-4">
          <div className="rounded-2xl bg-card border border-border p-2 flex flex-wrap items-center gap-1.5">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-white shadow-sm" : "bg-secondary/50 text-foreground/80 hover:bg-secondary"}`}>
                <tab.icon className="w-4 h-4" />
                {t(tab.label)}
              </button>
            ))}
          </div>

          <div className="gd-content rounded-2xl bg-card border border-border overflow-hidden">
            {/* ===== O'QUVCHILAR ===== */}
            {activeTab === "students" && (
              <>
                {studentsToolbar}
                <div className="flex items-center justify-end px-4 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
                    <span className="text-muted-foreground">{t("Umumiy soni:")}</span>
                    <span className="font-bold tabular-nums">{filtered.length}</span>
                  </div>
                </div>
                <div className="table-box">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className={`${thCls} w-10`}>№</th>
                        <th className={thCls}>{t("O'quvchini ismi")}</th>
                        <th className={thCls}>{t("Qo'shilgan sana")}</th>
                        <th className={thCls}>{t("Telefon raqam")}</th>
                        <th className={thCls}>{t("Balans")}</th>
                        <th className={thCls}>{t("Narxi")}</th>
                        <th className={thCls}>{t("Coin")}</th>
                        <th className={thCls}>{t("Oxirgi izoh")}</th>
                        <th className={`${thCls} text-right`}>{t("Amallar")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slice.map((m, i) => (
                        <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                          <td className="px-4 py-3 text-[13px] font-medium">{pupilName(m)}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{m.joinedAt ? m.joinedAt.split("-").reverse().join(".") : m.createdAt}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{m.phone}</td>
                          <td className={`px-4 py-3 text-[13px] tabular-nums whitespace-nowrap ${balanceOf(m) < 0 ? "text-rose-600" : ""}`}>{nf(balanceOf(m))}</td>
                          {/* Narxi: guruh/kurs narxi sxemada yo'q — qattiq
                              yozilgan 270 000 o'rniga "—" (soxta son emas). */}
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums">{m.coin ?? 0}</td>
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {/* "Ko'chirish" — boshqa guruhga o'tkazadi (shu
                                guruhdan chiqarib, tanlanganiga qo'shadi).
                                "Izoh" o'quvchi profilini ochadi. Sertifikat
                                uchun tizimda hali manba yo'q. */}
                            <div className="inline-flex items-center gap-1 text-muted-foreground">
                              <button
                                onClick={() => setMoveFor(m)}
                                className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary"
                                title={t("Boshqa guruhga ko'chirish")}
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>
                              <Link
                                href={`/student-edit/${m.id}?src=list`}
                                className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary"
                                title={t("O'quvchi profili")}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => setRemoveFor(m)}
                                className="h-7 w-7 rounded-md hover:bg-rose-500/10 inline-flex items-center justify-center hover:text-rose-600"
                                title={t("Guruhdan chiqarish")}
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {slice.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">{membersLoading ? <SpinnerBlock size={22} /> : "Guruhga o'quvchi qo'shilmagan"}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination totalItems={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
              </>
            )}

            {/* ===== TOPSHIRIQLAR ===== */}
            {activeTab === "tasks" && (
              <>
                <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border">
                  <button onClick={() => setTaskModalOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"><Plus className="icon icon-sm" />{t("Topshiriq qo'shish")}</button>
                  <DateRangePicker value={dateRange} onChange={setDateRange} />
                  <div className="flex-1" />
                  <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card p-0.5 gap-0.5">
                    <button onClick={() => setTaskLayout("list")} className={`h-8 px-2.5 rounded-md ${taskLayout === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}><List className="w-4 h-4" /></button>
                    <button onClick={() => setTaskLayout("grid")} className={`h-8 px-2.5 rounded-md ${taskLayout === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}><LayoutGrid className="w-4 h-4" /></button>
                  </div>
                  <button className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary"><MoreVertical className="icon icon-sm" /></button>
                </div>
                <div className="flex items-center justify-end px-4 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs"><span className="text-muted-foreground">{t("Umumiy soni:")}</span><span className="font-bold tabular-nums">{visibleTasks.length}</span></div>
                </div>
                <div className="table-box">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>{["№", "Turi", "Nomi", "Topshirish muddati", "O'qituvchi", "Guruh", "Maksimal ball", "Izoh", "Yaratilgan sanasi"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    {visibleTasks.length > 0 && (
                      <tbody className="divide-y divide-border">
                        {visibleTasks.map((tv, i) => (
                          <tr key={tv.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{t(tv.type)}</span></td>
                            <td className="px-4 py-3 text-[13px] font-medium">{tv.name}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{tv.deadline || "—"}</td>
                            <td className="px-4 py-3 text-[13px]"><PersonLink name={tv.teacher} kind="staff" /></td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{tv.groupName}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{tv.maxScore}</td>
                            <td className="px-4 py-3 text-[13px] text-muted-foreground truncate" style={{ maxWidth: 200 }}>{tv.note || "—"}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{tv.createdAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
                {visibleTasks.length === 0 && <EmptyState />}
              </>
            )}

            {/* ===== MASHG'ULOT QO'SHISH ===== */}
            {activeTab === "lesson" && (
              <>
                <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border">
                  <button onClick={() => setLessonModalOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
                    <Plus className="icon icon-sm" />{t("Mashg'ulot qo'shish")}
                  </button>
                </div>
                <div className="flex items-center justify-end px-4 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs"><span className="text-muted-foreground">{t("Umumiy soni:")}</span><span className="font-bold tabular-nums">{lessons.length}</span></div>
                </div>
                <div className="table-box">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      {/* "Amallar" — referens ustunlariga qo'shimcha: qatorni
                          o'chirish tugmasi shu yerda turadi. */}
                      <tr>{["№", "Mashg'ulot nomi", "Yordamchi o'qituvchilar", "Amallar"].map((h) => <th key={h} className={`${thCls} text-center`}>{h}</th>)}</tr>
                    </thead>
                    {lessons.length > 0 && (
                      <tbody className="divide-y divide-border">
                        {lessons.map((l, i) => (
                          <tr key={l.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 text-center text-[13px] font-medium">{l.name}</td>
                            <td className="px-4 py-3 text-center text-[13px]">
                              {l.assistants.length > 0 ? (
                                <span className="flex flex-wrap justify-center gap-1">
                                  {l.assistants.map((a) => <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{a}</span>)}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setLessonDeleteFor(l)}
                                title={t("O'chirish")}
                                className="h-7 w-7 rounded-md hover:bg-rose-500/10 inline-flex items-center justify-center text-muted-foreground hover:text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
                {lessons.length === 0 && (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {lessonsLoading ? <SpinnerBlock size={22} /> : "Ma'lumotlar topilmadi"}
                  </div>
                )}
              </>
            )}

            {/* ===== GURUH TARIXI MA'LUMOTLARI ===== */}
            {activeTab === "history" && (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <DateRangePicker value={historyRange} onChange={setHistoryRange} />
                  {!(historyRange.start && historyRange.end) && (
                    <span className="text-[12px] text-muted-foreground">{t("Oraliq tanlanmagan — barcha tarix")}</span>
                  )}
                  <div className="flex-1" />
                  {/* Yuklanayotganda son HALI NOMA'LUM — "0" yozib qo'ysak
                      bu yolg'on bo'lardi, shuning uchun "—". */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs"><span className="text-muted-foreground">{t("Umumiy soni:")}</span><span className="font-bold tabular-nums">{historyLoading ? "—" : historyEntries.length}</span></div>
                </div>
                <div className="table-box">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>{["№", "O'quvchilar", "Moderator", "Eski o'qituvchi", "O'qituvchi", "Dars sanasi", "Turi"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    {historyEntries.length > 0 && (
                      <tbody className="divide-y divide-border">
                        {historyEntries.map((e, i) => (
                          <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3 text-[13px] font-medium">{historyPupilName(e.pupilId)}</td>
                            {/* Moderator — o'zgarishni kiritgan xodim
                                (attendance_history.author, users.fullName dan). */}
                            <td className="px-4 py-3 text-[13px]">{e.author || "—"}</td>
                            {/* "Eski o'qituvchi" / "O'qituvchi": attendance_history
                                da o'qituvchi saqlanmaydi va guruhda o'qituvchi
                                almashuvi tarixi umuman yozilmaydi. Guruhning
                                HOZIRGI o'qituvchisini bu yerga qo'ysak — o'sha
                                paytdagi o'qituvchi deb yolg'on ko'rsatilardi,
                                shuning uchun "—". */}
                            <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                            <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{isoToUz(e.date)}</td>
                            <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{historyTypeLabel(e.status)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
                {historyLoading && <div className="py-16 text-center"><SpinnerBlock size={22} /></div>}
                {!historyLoading && historyEntries.length === 0 && <EmptyState />}
              </>
            )}

            {/* ===== DAVOMAT ===== */}
            {activeTab === "attendance" && (
              <AttendanceTab group={group} members={members} membersLoading={membersLoading} balanceOf={balanceOf} />
            )}
          </div>
        </div>
      </div>

      {addOpen && (
        <AddStudentModal
          groupId={id}
          existingIds={existingIds}
          onClose={() => setAddOpen(false)}
          onAdded={(pupil) => setMembers((prev) => [...prev, pupil])}
        />
      )}

      {/* Boshqa guruhga ko'chirish: yangisiga qo'shib, shu guruhdan chiqaramiz. */}
      {moveFor && (
        <GroupPickerModal
          onClose={() => setMoveFor(null)}
          onSelect={async (target) => {
            if (target.id === id) {
              showError(t("O'quvchi allaqachon shu guruhda"));
              return;
            }
            setRowBusy(true);
            const add = await fetch(`/api/groups/${target.id}/students`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pupilId: moveFor.id }),
            }).then((r) => r.json()).catch(() => null);
            if (!add?.ok) {
              setRowBusy(false);
              showError(t(add?.error || "Yangi guruhga qo'shib bo'lmadi"));
              return;
            }
            const del = await fetch(`/api/groups/${id}/students?pupilId=${moveFor.id}`, { method: "DELETE" })
              .then((r) => r.json()).catch(() => null);
            setRowBusy(false);
            if (!del?.ok) {
              showError(t("Yangi guruhga qo'shildi, ammo eskisidan chiqarib bo'lmadi"));
              return;
            }
            setMembers((prev) => prev.filter((p) => p.id !== moveFor.id));
            showSuccess(t("{moveFor} — \"{id}\" guruhiga ko'chirildi", { moveFor: pupilName(moveFor), id: target.name || target.id }));
            setMoveFor(null);
          }}
        />
      )}

      {removeFor && (
        <Modal onClose={() => setRemoveFor(null)} bare size="sm" zIndex={300} panelClassName="p-5 space-y-4">{(modal) => (<>
            <h3 className="text-lg font-semibold">{t("Guruhdan chiqarish")}</h3>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{pupilName(removeFor)}</strong>
              {" "}shu guruhdan chiqariladi. O&apos;quvchining o&apos;zi o&apos;chirilmaydi.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={modal.close} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
                {t("Bekor qilish")}
              </button>
              <button
                type="button"
                disabled={rowBusy}
                onClick={async () => {
                  setRowBusy(true);
                  const res = await fetch(`/api/groups/${id}/students?pupilId=${removeFor.id}`, { method: "DELETE" })
                    .then((r) => r.json()).catch(() => null);
                  setRowBusy(false);
                  if (!res?.ok) {
                    showError(t(res?.error || "Chiqarishda xatolik yuz berdi"));
                    return;
                  }
                  setMembers((prev) => prev.filter((p) => p.id !== removeFor.id));
                  showSuccess(t("O'quvchi guruhdan chiqarildi"));
                  setRemoveFor(null);
                }}
                className="h-9 rounded-lg bg-rose-500 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {rowBusy ? t("Chiqarilmoqda...") : t("Chiqarish")}
              </button>
            </div>
          </>)}</Modal>
      )}

      {taskModalOpen && (
        <AddTaskModal
          groupId={id}
          onClose={() => setTaskModalOpen(false)}
          onAdded={(task) => setTasks((prev) => [task, ...prev])}
        />
      )}

      {/* Yangi mashg'ulot oxiriga qo'shiladi — GET id bo'yicha o'sish tomon
          saralaydi, ya'ni ro'yxatdagi tartib serverdagi bilan bir xil qoladi. */}
      {lessonModalOpen && (
        <AddLessonModal
          groupId={id}
          onClose={() => setLessonModalOpen(false)}
          onAdded={(lesson) => setLessons((prev) => [...prev, lesson])}
        />
      )}

      {lessonDeleteFor && (
        <Modal onClose={() => setLessonDeleteFor(null)} locked={lessonBusy} bare size="sm" zIndex={300} panelClassName="p-5 space-y-4">{(modal) => (<>
            <h3 className="text-lg font-semibold">{t("Mashg'ulotni o'chirish")}</h3>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{lessonDeleteFor.name}</strong>
              {" "}o&apos;chiriladi. Bu amalni ortga qaytarib bo&apos;lmaydi.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={modal.close} disabled={lessonBusy} className="h-9 rounded-lg border border-border bg-card px-4 text-sm hover:bg-secondary">
                {t("Bekor qilish")}
              </button>
              <button
                type="button"
                disabled={lessonBusy}
                onClick={() => void deleteLesson(lessonDeleteFor)}
                className="h-9 rounded-lg bg-rose-500 px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {lessonBusy ? t("O'chirilmoqda...") : t("O'chirish")}
              </button>
            </div>
          </>)}</Modal>
      )}

      {editOpen && (
        <GroupFormModal
          group={group}
          onClose={() => setEditOpen(false)}
          onSaved={(g) => setGroup(g)}
        />
      )}

      {archiveConfirm && (
        <Modal onClose={() => setArchiveConfirm(false)} locked={archiving} bare size="sm" zIndex={110} panelClassName="p-6">{(modal) => (<>
            <p className="text-center text-[15px] font-semibold">{t("Haqiqatdan ham arxivga qo'shmoqchimisiz?")}</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={modal.close} disabled={archiving} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">{t("Yo'q")}</button>
              <button onClick={confirmArchive} disabled={archiving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{archiving ? "..." : "Ha"}</button>
            </div>
          </>)}</Modal>
      )}
    </div>
  );
}
