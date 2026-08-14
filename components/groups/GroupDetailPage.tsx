"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive, BookOpen, Calendar, CalendarCheck, CalendarPlus, Clock, ClipboardList, GraduationCap,
  History, Inbox, LayoutGrid, List, MapPin, MessageSquare, MoreVertical, PanelLeft, PanelLeftClose,
  Pencil, Plus, Timer, Upload, User, UserPlus, Users,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import DateRangePicker, { type DateRange } from "@/components/ui/DateRangePicker";
import AddStudentModal from "./AddStudentModal";
import AddTaskModal from "./AddTaskModal";
import AttendanceTab from "./AttendanceTab";
import EditGroupModal from "./EditGroupModal";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import type { GroupTask } from "@/lib/groupTasks";

// Guruh tafsiloti (skrinshot 1-5). Chap "Guruh ma'lumotlari" kartasi guruh
// maydonlaridan. O'ngda 5 tab:
//  - O'quvchilar: guruhga qo'shilgan HAQIQIY o'quvchilar (/api/groups/:id/students,
//    pupils bilan join). "O'quvchi qo'shish" → serverdagi o'quvchini tanlab qo'shish.
//  - Davomat: shu a'zolar + davomat ustunlari.
//  - Topshiriqlar / Mashg'ulot qo'shish / Guruh tarixi: hozircha bo'sh (to'g'ri
//    ustunlar + "Ma'lumotlar topilmadi").
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
// Balans Pupil'da yo'q — demo (id'dan deterministik).
function demoBalance(p: Pupil): number {
  return ((p.id * 137) % 6000) * 1000;
}

// "DD.MM.YYYY | HH:mm" (yoki "DD.MM.YYYY") → Date (faqat kun).
function parseUzDate(s: string): Date | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function EmptyState({ withIcon = true }: { withIcon?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {withIcon && (
        <span className="w-12 h-12 rounded-xl bg-secondary/60 inline-flex items-center justify-center mb-3 text-muted-foreground">
          <Inbox className="w-6 h-6" />
        </span>
      )}
      <div className="text-[14px] font-semibold">Ma&apos;lumotlar topilmadi</div>
      <div className="text-[12px] text-muted-foreground mt-1">Ma&apos;lumotlar topilmadi. Filterni o&apos;zgartirib ko&apos;ring.</div>
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
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [members, setMembers] = useState<Pupil[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("students");
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
    return () => { cancelled = true; };
  }, [id]);

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
    return tasks.filter((t) => {
      const d = parseUzDate(t.createdAt);
      return d ? d.getTime() >= s && d.getTime() <= e : true;
    });
  }, [tasks, dateRange]);

  if (loading) {
    return <div className="container mx-auto max-w-[1900px] p-4 md:p-5 text-sm text-muted-foreground">Yuklanmoqda…</div>;
  }
  if (!group) {
    return (
      <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
        <p className="text-sm text-muted-foreground">Guruh topilmadi.</p>
        <Link href="/groups" className="mt-3 inline-flex h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm items-center">Orqaga</Link>
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
        showError(data.error || "Arxivlanmadi");
        setArchiving(false);
        return;
      }
      showSuccess("Guruh arxivlandi");
      router.push("/groups");
    } catch {
      showError("Serverga ulanib bo'lmadi");
      setArchiving(false);
    }
  }

  const studentsToolbar = (
    <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-border">
      <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm">
        <Plus className="icon icon-sm" />O&apos;quvchi qo&apos;shish
      </button>
      <div className="flex-1" />
      <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
        Arxiv o&apos;quvchilar
        <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" />
      </label>
      <div className="relative w-56">
        <svg className="icon icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"><use href="#i-search" /></svg>
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} type="text" placeholder="Qidirish" className="w-full h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto max-w-[1900px] p-4 md:p-5">
      {/* i-search sprite global (Navbar) — bor. */}
      <div className={`group-detail-grid ${infoCollapsed ? "is-collapsed" : ""}`}>
        {/* LEFT: Guruh ma'lumotlari — yig'ilganda tor ikonka ustuni bo'ladi */}
        {infoCollapsed ? (
          <aside
            className="hidden lg:flex w-12 flex-col items-center gap-1 rounded-2xl border border-border bg-card py-3"
            style={{ alignSelf: "start" }}
          >
            <button
              onClick={() => setInfoCollapsed(false)}
              title="Guruh ma'lumotlarini ochish"
              className="h-8 w-8 rounded-lg text-primary hover:bg-secondary inline-flex items-center justify-center"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <div className="my-1 h-px w-6 bg-border" />
            {[
              { icon: LayoutGrid, label: "Guruh ma'lumotlari" },
              { icon: Calendar, label: "Dars jadvali" },
              { icon: BookOpen, label: "Akademik ma'lumot" },
              { icon: History, label: "Guruh faoliyat muddati" },
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
              title="Guruhni arxivlash"
              className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-500/10 inline-flex items-center justify-center"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => setEditOpen(true)}
              title="Tahrirlash"
              className="h-8 w-8 rounded-lg text-primary hover:bg-secondary inline-flex items-center justify-center"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </aside>
        ) : (
        <aside className="rounded-2xl bg-card border border-border p-5" style={{ alignSelf: "start" }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-[15px] font-bold tracking-tight">Guruh ma&apos;lumotlari</h2>
            <div className="flex-1" />
            <button
              onClick={() => setInfoCollapsed(true)}
              title="Yig'ish"
              className="hidden lg:inline-flex h-7 w-7 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary items-center justify-center"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Users} label="Guruh nomi">{group.name}</InfoRow>
            <InfoRow icon={GraduationCap} label="Daraja">{group.level || "—"}</InfoRow>
            <InfoRow icon={BookOpen} label="Ta'lim turi"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[12px] font-medium">{group.eduType || "offline"}</span></InfoRow>
            <InfoRow icon={MapPin} label="Xona / Platforma">{group.room || "—"}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">Dars jadvali</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Clock} label="Dars vaqti">{group.time ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium tabular-nums">{group.time}</span> : "—"}</InfoRow>
            <div className="flex items-center justify-between gap-3 py-3">
              <span className="inline-flex items-center gap-2.5 text-[13px] text-muted-foreground"><Calendar className="w-4 h-4 text-primary" />Dars kunlari</span>
              <span className="flex flex-wrap justify-end gap-1">
                {days.length ? days.map((d) => <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{d.trim()}</span>) : "—"}
              </span>
            </div>
            <InfoRow icon={Timer} label="Dars davomiyligi">2 soat</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">Akademik ma&apos;lumot</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={BookOpen} label="Kurs / Fan">{group.course || "—"}</InfoRow>
            <InfoRow icon={User} label="O'qituvchi">{group.teacher || "—"}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-4 mb-1">
            <History className="w-4 h-4 text-primary" />
            <h3 className="text-[13px] font-bold">Guruh faoliyat muddati</h3>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Calendar} label="Boshlanish sanasi">{periodStart || "—"}</InfoRow>
            <InfoRow icon={Calendar} label="Tugash kuni">{periodEnd || "—"}</InfoRow>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button onClick={() => setArchiveConfirm(true)} className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-rose-600 text-white text-[13px] font-medium hover:bg-rose-700">Guruhni arxivlash</button>
            <button onClick={() => setEditOpen(true)} className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-lg bg-primary text-white text-[13px] font-medium hover:opacity-90"><Pencil className="w-3.5 h-3.5" />Tahrirlash</button>
          </div>
        </aside>
        )}

        {/* RIGHT */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-2 flex flex-wrap items-center gap-1.5">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-medium transition-colors ${activeTab === tab.key ? "bg-primary text-white shadow-sm" : "bg-secondary/50 text-foreground/80 hover:bg-secondary"}`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            {/* ===== O'QUVCHILAR ===== */}
            {activeTab === "students" && (
              <>
                {studentsToolbar}
                <div className="flex items-center justify-end px-4 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs">
                    <span className="text-muted-foreground">Umumiy soni:</span>
                    <span className="font-bold tabular-nums">{filtered.length}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>
                        <th className={`${thCls} w-10`}>№</th>
                        <th className={thCls}>O&apos;quvchini ismi</th>
                        <th className={thCls}>Qo&apos;shilgan sana</th>
                        <th className={thCls}>Telefon raqam</th>
                        <th className={thCls}>Balans</th>
                        <th className={thCls}>Narxi</th>
                        <th className={thCls}>Coin</th>
                        <th className={thCls}>Oxirgi izoh</th>
                        <th className={`${thCls} text-right`}>Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slice.map((m, i) => (
                        <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground tabular-nums">{start + i + 1}</td>
                          <td className="px-4 py-3 text-[13px] font-medium">{pupilName(m)}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{m.createdAt}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{m.phone}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{nf(demoBalance(m))}</td>
                          <td className="px-4 py-3 text-[13px] tabular-nums whitespace-nowrap">{nf(270000)}</td>
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                          <td className="px-4 py-3 text-[13px] text-muted-foreground">—</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 text-muted-foreground">
                              <button className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary" title="Sertifikat"><Upload className="w-4 h-4" /></button>
                              <button className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary" title="Ko'chirish"><UserPlus className="w-4 h-4" /></button>
                              <button className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary" title="Izoh"><MessageSquare className="w-4 h-4" /></button>
                              <button className="h-7 w-7 rounded-md hover:bg-secondary inline-flex items-center justify-center hover:text-primary" title="Ko'proq"><MoreVertical className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {slice.length === 0 && (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">{membersLoading ? "Yuklanmoqda…" : "Guruhga o'quvchi qo'shilmagan"}</td></tr>
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
                  <button onClick={() => setTaskModalOpen(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 shadow-sm"><Plus className="icon icon-sm" />Topshiriq qo&apos;shish</button>
                  <DateRangePicker value={dateRange} onChange={setDateRange} />
                  <div className="flex-1" />
                  <div className="inline-flex items-center h-9 rounded-lg border border-border bg-card p-0.5 gap-0.5">
                    <button onClick={() => setTaskLayout("list")} className={`h-8 px-2.5 rounded-md ${taskLayout === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}><List className="w-4 h-4" /></button>
                    <button onClick={() => setTaskLayout("grid")} className={`h-8 px-2.5 rounded-md ${taskLayout === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}><LayoutGrid className="w-4 h-4" /></button>
                  </div>
                  <button className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card hover:bg-secondary"><MoreVertical className="icon icon-sm" /></button>
                </div>
                <div className="flex items-center justify-end px-4 py-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs"><span className="text-muted-foreground">Umumiy soni:</span><span className="font-bold tabular-nums">{visibleTasks.length}</span></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>{["№", "Turi", "Nomi", "Topshirish muddati", "O'qituvchi", "Guruh", "Maksimal ball", "Izoh", "Yaratilgan sanasi"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                    {visibleTasks.length > 0 && (
                      <tbody className="divide-y divide-border">
                        {visibleTasks.map((t, i) => (
                          <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[12px] font-medium">{t.type}</span></td>
                            <td className="px-4 py-3 text-[13px] font-medium">{t.name}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{t.deadline || "—"}</td>
                            <td className="px-4 py-3 text-[13px]">{t.teacher || "—"}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{t.groupName}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums">{t.maxScore}</td>
                            <td className="px-4 py-3 text-[13px] text-muted-foreground truncate" style={{ maxWidth: 200 }}>{t.note || "—"}</td>
                            <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground whitespace-nowrap">{t.createdAt}</td>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>{["№", "Mashg'ulot nomi", "Yordamchi o'qituvchilar"].map((h) => <th key={h} className={`${thCls} text-center`}>{h}</th>)}</tr>
                    </thead>
                  </table>
                </div>
                <div className="py-16 text-center text-sm text-muted-foreground">Ma&apos;lumotlar topilmadi</div>
              </>
            )}

            {/* ===== GURUH TARIXI MA'LUMOTLARI ===== */}
            {activeTab === "history" && (
              <>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                  <DateRangePicker value={dateRange} onChange={setDateRange} />
                  <div className="flex-1" />
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary/60 text-xs"><span className="text-muted-foreground">Umumiy soni:</span><span className="font-bold tabular-nums">0</span></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b border-border">
                      <tr>{["№", "O'quvchilar", "Moderator", "Eski o'qituvchi", "O'qituvchi", "Dars sanasi", "Turi"].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr>
                    </thead>
                  </table>
                </div>
                <EmptyState />
              </>
            )}

            {/* ===== DAVOMAT ===== */}
            {activeTab === "attendance" && (
              <AttendanceTab group={group} members={members} membersLoading={membersLoading} />
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

      {taskModalOpen && (
        <AddTaskModal
          groupId={id}
          onClose={() => setTaskModalOpen(false)}
          onAdded={(task) => setTasks((prev) => [task, ...prev])}
        />
      )}

      {editOpen && (
        <EditGroupModal
          group={group}
          onClose={() => setEditOpen(false)}
          onSaved={(g) => setGroup(g)}
        />
      )}

      {archiveConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !archiving && setArchiveConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
            <p className="text-center text-[15px] font-semibold">Haqiqatdan ham arxivga qo&apos;shmoqchimisiz?</p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setArchiveConfirm(false)} disabled={archiving} className="h-9 px-6 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium">Yo&apos;q</button>
              <button onClick={confirmArchive} disabled={archiving} className="h-9 px-6 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60">{archiving ? "..." : "Ha"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
