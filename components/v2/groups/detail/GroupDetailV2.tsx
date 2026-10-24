"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  ClipboardList,
  Clock,
  DoorOpen,
  History,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  SquareArrowOutUpRight,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useToast } from "@/components/ui/Toast";
import AddStudentModal from "@/components/groups/AddStudentModal";
import GroupFormModal from "@/components/groups/GroupFormModal";
import GroupPickerModal from "@/components/orders/GroupPickerModal";
import V2Confirm from "@/components/v2/form/V2Confirm";
import { fmtSum, initialsOf } from "@/components/v2/employees/employeeBits";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import StaffName from "@/components/v2/ui/StaffName";
import { secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { FAN_BG, FAN_TEXT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { ToneBadge, useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { invalidateStudents } from "@/hooks/useStudents";
import { groupLabel } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";
import { DETAIL_TABS, defaultLesson, groupStartIso, memberName, type DetailTab, type Member } from "./groupDetailBits";
import { useGroup, useMembers } from "./useGroupDetail";
import GroupStudentsTab from "./GroupStudentsTab";
import JournalTab from "./JournalTab";
import TodayLessonTab from "./TodayLessonTab";

// YANGI VERSIYA — GURUH SAHIFASI (10-qism, rasmlar «Guruh · Bugungi dars, davomat»,
// «Guruh · Tanga berish», «Guruh · Davomat jurnali», yorug'/qorong'i, 24.10.2026):
//
//   «← Guruhlar › Ingliz tili · 2-bosqich»; sarlavha kartochkasi — kurs va bosqich, holat,
//   ustoz · xona · kunlar va vaqt · oylik narx · boshlanish; o'ngda «O'quvchi qo'shish»
//   va «⋯»; pastida tablar Bugungi dars | Davomat jurnali | O'quvchilar N (`?tab=` —
//   manzil server so'rovisiz almashadi, O'quvchi sahifasidagidek).
//
// Eski sahifaning qolgan tablari (Topshiriqlar, Mashg'ulot qo'shish, Guruh tarixi) —
// «⋯» dan eski ko'rinishda (`?classic=1&tab=…`). Oynalar — eski (O'quvchi qo'shish,
// Tahrirlash, guruh tanlash), so'rovlar eski sahifa bilan bir xil.

const CLASSIC_LINKS: { tab: string; label: string; icon: typeof History }[] = [
  { tab: "tasks", label: "Topshiriqlar", icon: ClipboardList },
  { tab: "lesson", label: "Mashg'ulot qo'shish", icon: CalendarPlus },
  { tab: "history", label: "Guruh tarixi", icon: History },
];

export default function GroupDetailV2({ id, initialTab }: { id: number; initialTab?: string }) {
  const { t } = useT();
  const router = useRouter();
  const fmt = useProfileFmt();
  const { showSuccess, showError } = useToast();
  const { state, reload } = useGroup(id);
  const { members, reload: reloadMembers } = useMembers(id);
  const [today] = useState(() => uzDateIso());

  const [tab, setTab] = useState<DetailTab>(() => (DETAIL_TABS.includes(initialTab as DetailTab) ? (initialTab as DetailTab) : "bugun"));
  /** undefined — guruh kunlaridan (bugun yoki eng yaqin dars). */
  const [lessonDate, setLessonDate] = useState<string | undefined>(undefined);
  const [journalMonth, setJournalMonth] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<DetailTab | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [moveFor, setMoveFor] = useState<Member | null>(null);
  const [removeFor, setRemoveFor] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const applyTab = useCallback((next: DetailTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "bugun") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);
  const goTab = (next: DetailTab) => {
    if (next === tab) return;
    if (tab === "bugun" && dirty) {
      setPendingTab(next);
      return;
    }
    applyTab(next);
  };
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  /* ── Yuklanish, topilmadi, xato ── */
  if (state.kind === "loading") return <DetailSkeleton />;
  if (state.kind !== "ok") {
    return (
      <div data-ui="v2" className="flex min-h-full flex-col items-start gap-3 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
        <p className="text-v2-body text-v2-text-2">
          {state.kind === "notfound" ? t("Guruh topilmadi yoki boshqa filialga tegishli.") : t("Ma'lumotni olib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {state.kind === "error" && (
            <button type="button" onClick={reload} className={secondaryBtn}>
              <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />
              {t("Qayta urinish")}
            </button>
          )}
          <Link href="/groups" className={secondaryBtn}>
            {t("Guruhlar")}
          </Link>
        </div>
      </div>
    );
  }

  const g = state.group;
  const title = [g.course.trim(), g.level.trim()].filter(Boolean).join(" · ") || groupLabel(g);
  const tone = GROUP_TONE[g.status] ?? GROUP_TONE.active;
  const fan = fanOf(g.course);
  const startIso = groupStartIso(g);
  const schedule = [g.day.trim(), timeLabel(g.time)].filter(Boolean).join(" · ");
  const lesson = lessonDate ?? defaultLesson(g, today);
  const month = journalMonth ?? (lesson ?? today).slice(0, 7);
  const memberCount = members?.length ?? g.studentIds?.length ?? g.students ?? 0;
  const base = `/groups/${g.id}`;

  const menu: ActionMenuEntry[] = [
    { key: "h", heading: title },
    { key: "edit", label: t("Tahrirlash"), icon: Pencil, onSelect: () => setEditOpen(true) },
    { key: "d1", divider: true },
    ...CLASSIC_LINKS.map((c) => ({ key: c.tab, label: t(c.label), icon: c.icon, href: `${base}?classic=1&tab=${c.tab}` }) as ActionMenuEntry),
    { key: "classic", label: t("Eski ko'rinishda ochish"), icon: SquareArrowOutUpRight, href: `${base}?classic=1` },
    { key: "d2", divider: true },
    {
      key: "archive",
      label: t("Guruhni arxivlash"),
      icon: Archive,
      danger: true,
      disabled: g.status === "archive",
      title: g.status === "archive" ? t("Guruh allaqachon arxivda") : undefined,
      onSelect: () => setArchiveOpen(true),
    },
  ];

  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: "bugun", label: t("Bugungi dars") },
    { key: "jurnal", label: t("Davomat jurnali") },
    { key: "oquvchilar", label: t("O'quvchilar"), count: memberCount },
  ];

  /* ── A'zolik amallari (eski sahifa bilan bir xil so'rovlar) ── */
  async function moveTo(m: Member, target: { id: number; name?: string }) {
    if (busy) return;
    if (target.id === g.id) {
      showError(t("O'quvchi allaqachon shu guruhda"));
      return;
    }
    setBusy(true);
    const add = await fetch(`/api/groups/${target.id}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pupilId: m.id }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!add?.ok) {
      setBusy(false);
      showError(t(add?.error || "Yangi guruhga qo'shib bo'lmadi"));
      return;
    }
    const del = await fetch(`/api/groups/${g.id}/students?pupilId=${m.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(false);
    setMoveFor(null);
    reloadMembers();
    invalidateStudents();
    if (!del?.ok) {
      showError(t("Yangi guruhga qo'shildi, ammo eskisidan chiqarib bo'lmadi"));
      return;
    }
    showSuccess(t("{moveFor} — \"{id}\" guruhiga ko'chirildi", { moveFor: memberName(m), id: target.name || target.id }));
  }

  async function removeMember(m: Member) {
    const res = await fetch(`/api/groups/${g.id}/students?pupilId=${m.id}`, { method: "DELETE" })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      showError(t(res?.error || "Chiqarishda xatolik yuz berdi"));
      return;
    }
    reloadMembers();
    invalidateStudents();
    showSuccess(t("O'quvchi guruhdan chiqarildi"));
  }

  async function archive() {
    setArchiveOpen(false);
    const res = await fetch(`/api/groups/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archive" }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res?.ok) {
      showError(t(res?.error || "Arxivlanmadi"));
      return;
    }
    showSuccess(t("Guruh arxivlandi"));
    router.push("/groups");
  }

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* Yo'l */}
      <nav aria-label={t("Yo'l")} className="flex min-w-0 items-center gap-1.5 text-v2-small">
        <Link href="/groups" className="inline-flex shrink-0 items-center gap-1.5 text-v2-text-2 underline-offset-2 hover:text-v2-text hover:underline">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
          {t("Guruhlar")}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-v2-text-3" strokeWidth={2} aria-hidden />
        <span className="truncate font-medium text-v2-text">{title}</span>
      </nav>

      {/* Sarlavha kartochkasi */}
      <section aria-labelledby="group-title" className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 pb-3 pt-4">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-v2-md ${FAN_BG[fan]} ${FAN_TEXT[fan]}`} aria-hidden>
            <BookOpen className="size-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 id="group-title" className="text-[1.25rem] font-semibold leading-7 text-v2-text">
                {title}
              </h1>
              <ToneBadge tone={tone}>{t(tone.label)}</ToneBadge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-v2-small text-v2-text-2">
              {g.teacher.trim() && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-surface-2 text-[9px] font-semibold text-v2-text-2" aria-hidden>
                    {initialsOf(g.teacher)}
                  </span>
                  <span className="truncate">
                    <StaffName name={g.teacher.trim()} />
                  </span>
                </span>
              )}
              {g.room.trim() && (
                <span className="inline-flex items-center gap-1.5">
                  <DoorOpen className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                  {roomLabel(g.room)}
                </span>
              )}
              {schedule && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                  {schedule}
                </span>
              )}
              {state.monthlyPrice !== null && (
                <span className="inline-flex items-center gap-1.5 tabular-nums" title={t("Oylik narx (Oflayn kurslar)")}>
                  <Wallet className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                  {t("{sum} so'm/oy", { sum: fmtSum(state.monthlyPrice) })}
                </span>
              )}
              {startIso && (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <CalendarDays className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                  {t("{date} dan", { date: fmt.ddmmyyyy(startIso) })}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setAddOpen(true)} className={secondaryBtn}>
              <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
              {t("O'quvchi qo'shish")}
            </button>
            <ActionMenu items={menu} label={t("Guruh amallari")} width={244}>
              {(trigger, open) => (
                <button type="button" {...trigger} title={t("Amallar")} aria-label={t("Guruh amallari")} className={`${secondaryIcon} ${open ? "bg-v2-surface-2" : ""}`}>
                  <MoreHorizontal className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </ActionMenu>
          </div>
        </div>

        <div
          role="tablist"
          aria-label={t("Guruh sahifasi")}
          className="flex gap-1 overflow-x-auto overflow-y-hidden border-t border-v2-border px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((x) => {
            const on = tab === x.key;
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                id={`gtab-${x.key}`}
                aria-selected={on}
                aria-controls={`gpanel-${x.key}`}
                tabIndex={on ? 0 : -1}
                onClick={() => goTab(x.key)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const at = tabs.findIndex((y) => y.key === tab);
                  const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
                  goTab(next.key);
                  requestAnimationFrame(() => document.getElementById(`gtab-${next.key}`)?.focus());
                }}
                className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 px-2 text-v2-body transition-colors min-[40rem]:px-2.5 focus-visible:outline-none focus-visible:shadow-v2-focus ${
                  on ? "font-semibold text-v2-text" : "text-v2-text-2 hover:text-v2-text"
                }`}
              >
                {x.label}
                {x.count !== undefined && <span className="text-v2-caption font-medium tabular-nums text-v2-text-3">{x.count}</span>}
                {on && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-t-full bg-v2-brand" aria-hidden />}
              </button>
            );
          })}
        </div>
      </section>

      <div role="tabpanel" id={`gpanel-${tab}`} aria-labelledby={`gtab-${tab}`} className="@container min-w-0">
        {tab === "bugun" && (
          <TodayLessonTab
            group={g}
            members={members}
            today={today}
            date={lesson}
            onDate={setLessonDate}
            onDirtyChange={onDirtyChange}
            onAddStudent={() => setAddOpen(true)}
            onEditGroup={() => setEditOpen(true)}
          />
        )}
        {tab === "jurnal" && (
          <JournalTab
            group={g}
            members={members}
            today={today}
            month={month}
            onMonth={setJournalMonth}
            onOpenLesson={(iso) => {
              setLessonDate(iso);
              applyTab("bugun");
            }}
          />
        )}
        {tab === "oquvchilar" && (
          <GroupStudentsTab group={g} members={members} today={today} onAdd={() => setAddOpen(true)} onMove={setMoveFor} onRemove={setRemoveFor} />
        )}
      </div>

      {/* ── Oynalar ── */}
      {addOpen && (
        <AddStudentModal
          groupId={g.id}
          existingIds={(members ?? []).map((m) => m.id)}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            reloadMembers();
            invalidateStudents();
          }}
        />
      )}
      {editOpen && (
        <GroupFormModal
          group={g}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            reload();
          }}
        />
      )}
      {moveFor && <GroupPickerModal onClose={() => setMoveFor(null)} onSelect={(target) => void moveTo(moveFor, target)} />}
      {removeFor && (
        <V2Confirm
          title={t("Guruhdan chiqarish")}
          body={t("{name} «{group}» guruhidan chiqariladi. O'tgan darslari hisobda qoladi, o'quvchining o'zi o'chirilmaydi.", { name: memberName(removeFor), group: title })}
          confirmLabel={t("Guruhdan chiqarish")}
          onCancel={() => setRemoveFor(null)}
          onConfirm={() => {
            const m = removeFor;
            setRemoveFor(null);
            void removeMember(m);
          }}
        />
      )}
      {archiveOpen && (
        <V2Confirm
          title={t("Guruhni arxivlash")}
          body={t("«{group}» arxivga o'tadi: Guruhlar ro'yxatida «Arxiv» holatida qoladi, shu kundan keyingi darslar qarzga hisoblanmaydi.", { group: title })}
          confirmLabel={t("Arxivlash")}
          onCancel={() => setArchiveOpen(false)}
          onConfirm={() => void archive()}
        />
      )}
      {pendingTab && (
        <V2Confirm
          title={t("Saqlanmagan o'zgarishlar")}
          body={t("Belgilangan davomat saqlanmagan. Boshqa tabga o'tilsa, o'zgarishlar yo'qoladi.")}
          confirmLabel={t("Saqlamasdan o'tish")}
          onCancel={() => setPendingTab(null)}
          onConfirm={() => {
            const next = pendingTab;
            setPendingTab(null);
            setDirty(false);
            applyTab(next);
          }}
        />
      )}
    </div>
  );
}

/* ── Skelet — sahifa shaklida ─────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 sm:p-5" aria-busy>
      <div className="h-4 w-56 rounded bg-v2-skeleton" />
      <div className="rounded-v2-lg border border-v2-border p-4">
        <div className="flex items-start gap-4">
          <div className="size-11 rounded-v2-md bg-v2-skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-64 rounded bg-v2-skeleton" />
            <div className="h-3 w-full max-w-xl rounded bg-v2-skeleton" />
          </div>
        </div>
        <div className="mt-4 flex gap-4 border-t border-v2-border pt-3">
          <div className="h-4 w-24 rounded bg-v2-skeleton" />
          <div className="h-4 w-28 rounded bg-v2-skeleton" />
          <div className="h-4 w-24 rounded bg-v2-skeleton" />
        </div>
      </div>
      <div className="h-10 w-80 rounded bg-v2-skeleton" />
      <div className="h-80 rounded-v2-lg bg-v2-skeleton" />
    </div>
  );
}
