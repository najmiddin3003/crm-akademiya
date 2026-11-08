"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  Inbox,
  Loader2,
  MoreHorizontal,
  Phone,
  PhoneOff,
  Plus,
  RotateCcw,
  Search,
  SquareArrowOutUpRight,
  UserMinus,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useToast } from "@/components/ui/Toast";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT } from "@/components/shared/Language";
import { useOrders } from "@/components/orders/OrdersContext";
import { postHolat } from "@/components/leads/LeadHolatModals";
import { api } from "@/components/staff-tasks/api";
import StudentPaymentModalV2 from "@/components/v2/finance/StudentPaymentModalV2";
import LeadGroupModalV2, { type GroupJoined } from "@/components/v2/leads/LeadGroupModalV2";
import { addDaysIso, initialsOf, phoneParts, shortName, startTimeOf, undoState, useLeadV2Fmt } from "@/components/v2/leads/leadUtils";
import { useCanOpen } from "@/components/v2/shell/ShellContext";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import FloatingPanel from "@/components/v2/ui/FloatingPanel";
import V2Select, { type V2SelectOption } from "@/components/v2/ui/V2Select";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { FAN_DOT, fanOf } from "@/components/v2/ui/fan";
import { roomLabel } from "@/components/v2/ui/groupStatus";
import { ROW_BAR, ROW_TINT } from "@/components/v2/ui/table";
import { loadPupilsCached } from "@/hooks/useStudents";
import { enrollOrderInGroup } from "@/lib/enrollStudent";
import type { Group } from "@/lib/groups";
import { MONTHS } from "@/lib/i18n";
import type { FirstLessonReminder, Order } from "@/lib/ordersData";
import type { PupilListItem } from "@/lib/pupilsData";
import { uzDateOf, uzTimeOf } from "@/lib/staffTasks";
import { studentRowFromPupil, type StudentRow } from "@/lib/studentsData";
import BookModalV2 from "./BookModalV2";
import MissedModalV2, { useDueText, type MissedStep } from "./MissedModalV2";
import { buildFlRows, byLesson, groupTitle, lessonStarted, remindOf, seatsOf, type FlRow, type FlSection, type GroupInfo } from "./firstLessonUtils";

// YANGI VERSIYA — «BIRINCHI DARSGA YOZILGANLAR» (22-qism, rasmlar «Birinchi
// darsga yozilganlar · namuna ma'lumot», «Keldi → guruhga qo'shildi»,
// «Kelmadi → keyingi qadam», «Birinchi darsga yozish», yorug'/qorong'i):
//
//   1. sarlavha: filial · «N kishi natija kutmoqda», «+ Birinchi darsga yozish»;
//   2. bo'limlar: Hammasi · Bugun · O'tgan, natija yo'q · Kelgusi (natija
//      kutayotganlar soni), filtrlar — Guruh, O'qituvchi, ism/telefon;
//   3. «Guruhlar bo'yicha» kartalari — qaysi guruhga necha kishi keladi va bo'sh
//      o'rin (xona sig'imidan, GET /api/first-lessons/groups-info); bosilsa filtr;
//   4. «Bugun» — natija ustuni: dars tugagach «Keldi / Kelmadi»; «Keldi» →
//      o'quvchi guruhga yoziladi (lib/enrollStudent.ts) va lid holati «Guruhga
//      qo'shildi» (POST /holat), so'ng oynacha: oylik narx va «To'lov qabul qilish»;
//      «Kelmadi» → «Keyingi qadam» oynasi (./MissedModalV2.tsx);
//   5. «O'tgan kunlar — natija yo'q» — hal bo'lguncha turadi;
//   6. «Kelgusi darslar» — kunlar bo'yicha, ESLATISH ustuni: dars kunidan bir kun
//      oldin operator qo'ng'iroq qiladi va natijani belgilaydi (firstLessonReminder).
//
// Ma'lumot — lidlar (`orders`, OrdersProvider); holat o'tishlari Lidlar sahifasi
// bilan BITTA (postHolat). O'qituvchi davomatidagi «Birinchi dars» bo'limi va
// operator topshirig'i hozircha yo'q — SAVOLLAR 248–253.

type Tab = "all" | FlSection;

const SUCCESS_TINT = "bg-v2-success-bg shadow-[inset_0_0_0_9999px_var(--v2-success-bg)]";
const JUST_NOW_MS = 2 * 60_000;
/** «O'tgan kunlar» bo'limida bir martada ko'rsatiladigan qatorlar. */
const PAST_PAGE = 20;
/** «Guruhlar bo'yicha» — yig'iq holatda nechta karta (ikki qator). */
const CARD_LIMIT = 8;

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

/** Lid qaysi o'qituvchiga (guruhniki, bo'lmasa yozishdagi). */
const teacherOf = (r: FlRow) => (r.group?.teacher || r.o.teacher || "").trim();

export default function FirstLessonsV2({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useT();
  const [lang] = useLang();
  const f = useLeadV2Fmt();
  const dueText = useDueText();
  const router = useRouter();
  const branch = useBranch();
  const { showToast } = useToast();
  const { orders, loading, patchOrder, replaceOrder, reload, addMessage } = useOrders();
  const canPay = useCanOpen("/finance-cash");
  const canLeads = useCanOpen("/orders-list");
  const canGroups = useCanOpen("/groups");
  const canStudents = useCanOpen("/students-list");

  /* ---- Guruhlar, o'rinlar, soat ---- */
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [info, setInfo] = useState<Record<number, GroupInfo>>({});
  const loadGroups = useCallback(() => {
    void api<{ groups: Group[] }>("/api/groups").then((r) => setGroups((prev) => (r.ok ? r.groups : (prev ?? []))));
  }, []);
  useEffect(() => {
    loadGroups();
    void api<{ info: Record<number, GroupInfo> }>("/api/first-lessons/groups-info").then((r) => {
      if (r.ok) setInfo(r.info);
    });
  }, [loadGroups]);
  const groupList = useMemo<Group[]>(() => groups ?? [], [groups]);

  const [nowMs, setClock] = useState(() => Date.now());
  // Soat har 30 soniyada («Dars boshlandi», bekor qilish muddati), ro'yxat har
  // daqiqada — faqat sahifa ko'rinib turganda (Lidlar sahifasi qoidasi).
  useEffect(() => {
    const tick = window.setInterval(() => setClock(Date.now()), 30_000);
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, [reload]);
  const today = uzDateOf(nowMs);

  /* ---- Qatorlar va filtrlar ---- */
  const rows = useMemo(() => buildFlRows(orders, groupList, nowMs).sort(byLesson), [orders, groupList, nowMs]);
  const [tab, setTab] = useState<Tab>("all");
  const [groupF, setGroupF] = useState("");
  const [teacherF, setTeacherF] = useState("");
  const [search, setSearch] = useState("");
  // «O'tgan kunlar» — yangisi tepada, bo'laklab (eski, hal qilinmagan lidlar yuzlab bo'lishi mumkin).
  const [pastShown, setPastShown] = useState(PAST_PAGE);

  // Guruh filtridan tashqari (kartalar shu ro'yxatdan sanaladi).
  const pre = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows.filter((r) => {
      if (teacherF && teacherOf(r) !== teacherF) return false;
      if (q) {
        const byName = (r.o.name || "").toLowerCase().includes(q);
        const byPhone = qDigits.length >= 3 && (r.o.phone || "").replace(/\D/g, "").includes(qDigits);
        if (!byName && !byPhone) return false;
      }
      return true;
    });
  }, [rows, teacherF, search]);
  const filtered = useMemo(
    () => (groupF ? pre.filter((r) => (groupF === "none" ? !r.group : String(r.group?.id ?? "") === groupF)) : pre),
    [pre, groupF],
  );
  const waiting = filtered.filter((r) => r.waiting);
  const counts = {
    all: waiting.length,
    today: waiting.filter((r) => r.section === "today").length,
    past: waiting.filter((r) => r.section === "past").length,
    upcoming: waiting.filter((r) => r.section === "upcoming").length,
  };
  const bySection = (s: FlSection) => {
    const list = filtered.filter((r) => r.section === s);
    return s === "past" ? list.reverse() : list;
  };
  const totalWaiting = rows.filter((r) => r.waiting).length;

  // Guruh → natija kutayotganlar (yozish oynasidagi «N kishi yozilgan» ham shundan).
  const waitingByGroup = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows) if (r.waiting && r.group) m.set(r.group.id, (m.get(r.group.id) ?? 0) + 1);
    return m;
  }, [rows]);

  const groupCards = useMemo(() => {
    const m = new Map<number, { g: Group; n: number; first: string }>();
    for (const r of pre) {
      if (!r.waiting || !r.group) continue;
      const c = m.get(r.group.id);
      if (c) c.n++;
      else m.set(r.group.id, { g: r.group, n: 1, first: r.sana });
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.first.localeCompare(b.first));
  }, [pre]);
  const cardGroups = groupCards.map((c) => c.g);
  const [allCards, setAllCards] = useState(false);
  // Yig'iq holatda ham tanlangan guruh kartasi ko'rinib tursin.
  const shownCards = allCards ? groupCards : groupCards.filter((c, i) => i < CARD_LIMIT || String(c.g.id) === groupF);

  const groupOptions = useMemo<V2SelectOption[]>(() => {
    const m = new Map<number, Group>();
    let none = 0;
    for (const r of rows) {
      if (r.group) m.set(r.group.id, r.group);
      else none++;
    }
    const list = [...m.values()];
    const opts: V2SelectOption[] = list
      .map((g) => ({ value: String(g.id), label: groupTitle(g, list), hint: g.teacher ? shortName(g.teacher) : undefined }))
      .sort((a, b) => a.label.localeCompare(b.label, "uz", { numeric: true }));
    if (none) opts.push({ value: "none", label: t("Guruh tanlanmagan"), hint: String(none) });
    return opts;
  }, [rows, t]);
  const teacherOptions = useMemo<V2SelectOption[]>(() => {
    const names = [...new Set(rows.map(teacherOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz"));
    return names.map((n) => ({ value: n, label: n }));
  }, [rows]);

  /* ---- Oynalar ---- */
  const [book, setBook] = useState<{ order?: Order } | null>(null);
  const [missed, setMissed] = useState<{ id: number; step?: MissedStep } | null>(null);
  const [groupFor, setGroupFor] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pop, setPop] = useState<{ id: number; pupil?: PupilListItem; group: Group } | null>(null);
  const popAnchor = useRef<HTMLElement | null>(null);
  const [payFor, setPayFor] = useState<{ student: StudentRow | null; groups: Group[]; groupId: number | null; amount?: number; month?: string } | null>(null);

  const rowById = (id: number | null | undefined) => (id == null ? null : (rows.find((r) => r.o.id === id) ?? null));
  const missedRow = rowById(missed?.id);
  const groupRow = rowById(groupFor);
  const popRow = rowById(pop?.id);
  const branchTitle = branch.branches.find((b) => b.id === branch.branchId)?.name ?? "";
  const onConflict = () => void reload();

  async function undo(id: number, detail?: string) {
    setBusyId(id);
    const r = await postHolat(id, { action: "undo" });
    setBusyId(null);
    if (!r.ok) {
      showToast({ tone: "error", title: t("Bekor qilib bo'lmadi"), detail: t(r.error) });
      if (/o'zgargan/.test(r.error)) onConflict();
      return;
    }
    replaceOrder(r.order);
    setClock(Date.now());
    showToast({ tone: "success", title: t("Oldingi holatga qaytarildi"), detail: detail ? [r.order.name, detail] : r.order.name });
  }

  /** «Keldi»: o'quvchi guruhga (birinchi dars kunidan), lid → «Guruhga qo'shildi», oynacha. */
  async function keldi(r: FlRow, cell: HTMLElement | null) {
    const g = r.group;
    if (!g) return setGroupFor(r.o.id);
    if (busyId !== null) return;
    setBusyId(r.o.id);
    const enrolled = await enrollOrderInGroup(r.o, g.id, undefined, { joinedAt: r.sana });
    if (!enrolled.ok) {
      setBusyId(null);
      showToast({ tone: "error", title: t("Guruhga qo'shib bo'lmadi"), detail: t(enrolled.error || "Guruhga qo'shishda xatolik yuz berdi") });
      return;
    }
    const res = await postHolat(r.o.id, {
      to: "guruh",
      guruh: { id: g.id, nom: String(g.name || g.id), kun: g.day || "", vaqt: g.time || "", boshlash: r.sana },
      pupilId: enrolled.pupil?.id,
    });
    setBusyId(null);
    if (!res.ok) {
      // O'quvchi guruhda — faqat lid holati yozilmadi; qayta bosish xavfsiz ($addToSet).
      showToast({ tone: "error", title: t("O'quvchi guruhga qo'shildi, lekin lid holati saqlanmadi: {error}", { error: t(res.error) }) });
      if (/o'zgargan/.test(res.error)) onConflict();
      return;
    }
    replaceOrder(res.order);
    setClock(Date.now());
    loadGroups();
    popAnchor.current = cell;
    setPop({ id: r.o.id, pupil: enrolled.pupil, group: g });
  }

  /** To'lov oynasi — o'quvchi shu guruh bilan (guruh tanlangan holda). */
  async function openPay(o: Order, group: Group | null, known?: PupilListItem) {
    let pupil = known;
    if (!pupil && o.pupilId) {
      try {
        pupil = (await loadPupilsCached(true)).find((p) => p.id === o.pupilId);
      } catch {
        pupil = undefined;
      }
    }
    const g = group ?? groupList.find((x) => x.id === o.groupId) ?? null;
    const withPupil = pupil && g ? groupList.map((x) => (x.id === g.id ? { ...x, studentIds: [...new Set([...(x.studentIds ?? []), (pupil as PupilListItem).id])] } : x)) : groupList;
    const sana = o.guruh?.boshlash || today;
    setPayFor({
      student: pupil ? studentRowFromPupil(pupil) : null,
      groups: withPupil,
      groupId: g?.id ?? null,
      amount: g ? (info[g.id]?.price ?? undefined) : undefined,
      month: /^\d{4}-\d{2}/.test(sana) ? sana.slice(0, 7) : undefined,
    });
  }

  function joined(order: Order, j: GroupJoined) {
    replaceOrder(order);
    setClock(Date.now());
    loadGroups();
    showToast({
      tone: "success",
      title: t("Guruhga qo'shildi — o'quvchi O'quvchilar bo'limiga o'tdi"),
      detail: [order.name, [j.group.course || j.group.name, j.group.teacher].filter(Boolean).join(" · ")].filter(Boolean),
      action: j.pupil && canStudents ? { label: t("Profilni ochish"), onClick: () => router.push(`/student-edit/${j.pupil?.id}`) } : undefined,
    });
    if (j.openPay) void openPay(order, j.group, j.pupil);
  }

  async function remind(r: FlRow, result: NonNullable<FirstLessonReminder["result"]>) {
    const updated = await patchOrder(r.o.id, {
      firstLessonReminder: { result },
      ...(result === "javob_yoq" ? {} : { firstLessonStatus: "ESLATILDI" }),
    });
    if (!updated) return showToast({ tone: "error", title: t("Saqlab bo'lmadi. Qaytadan urinib ko'ring") });
    const label = result === "tasdiqladi" ? t("Tasdiqladi") : result === "eslatildi" ? t("Eslatildi") : t("Javob bermadi");
    showToast({ tone: "success", title: t("Eslatish belgilandi: {result}", { result: label }), detail: updated.name });
  }

  const call = (o: Order) => {
    const tel = phoneParts(o.phone)?.tel;
    if (tel) window.location.href = `tel:${tel}`;
  };

  /* ---- Yozuvlar ---- */
  /** Lahza → «bugun 12:05» / «kecha 18:40» / «11-oktyabr». */
  const whenText = (ms: number): string => {
    if (!Number.isFinite(ms)) return "";
    const d = uzDateOf(ms);
    if (d === today) return `${t("bugun")} ${uzTimeOf(ms)}`;
    if (d === addDaysIso(today, -1)) return `${t("kecha")} ${uzTimeOf(ms)}`;
    return f.day(d);
  };
  const dash = <span className="text-v2-text-3">—</span>;

  function leadCell(r: FlRow): ReactNode {
    const o = r.o;
    const phone = phoneParts(o.phone);
    return (
      <div className="flex min-w-[190px] items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full border border-v2-border bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2" aria-hidden>
          {initialsOf(o.name || "?")}
        </span>
        <div className="min-w-0">
          {canLeads ? (
            <Link href={`/orders-list/${o.id}`} className="block truncate font-semibold text-v2-text underline-offset-2 hover:text-v2-brand-text hover:underline">
              {o.name || "—"}
            </Link>
          ) : (
            <span className="block truncate font-semibold text-v2-text">{o.name || "—"}</span>
          )}
          <span className="block truncate text-v2-small tabular-nums text-v2-text-3">{[phone?.show ?? o.phone, o.source ? t(o.source) : ""].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      </div>
    );
  }

  function groupCell(r: FlRow): ReactNode {
    const g = r.group;
    const teacher = teacherOf(r);
    return (
      <div className="min-w-[170px]">
        <span className="flex items-center gap-2">
          <span className={`size-2 shrink-0 rounded-[3px] ${FAN_DOT[fanOf(g?.course || r.o.course)]}`} aria-hidden />
          <span className="truncate text-v2-text">{g ? groupTitle(g, groupList) : r.o.course ? t(r.o.course) : "—"}</span>
        </span>
        <span className="block truncate pl-4 text-v2-small text-v2-text-2">
          {[teacher ? shortName(teacher) : "", g ? roomLabel(g.room) : t("guruh tanlanmagan")].filter(Boolean).join(" · ")}
        </span>
      </div>
    );
  }

  const timeText = (r: FlRow) => (r.vaqt ? (r.tugash ? `${r.vaqt}–${r.tugash}` : r.vaqt) : "");

  function remindMenu(r: FlRow): ActionMenuEntry[] {
    const phone = phoneParts(r.o.phone);
    return [
      { key: "h", heading: t("Eslatish natijasi") },
      { key: "ok", label: t("Tasdiqladi — keladi"), icon: Check, onSelect: () => void remind(r, "tasdiqladi") },
      { key: "es", label: t("Eslatildi"), icon: Bell, onSelect: () => void remind(r, "eslatildi") },
      { key: "no", label: t("Javob bermadi"), icon: PhoneOff, onSelect: () => void remind(r, "javob_yoq") },
      ...(phone ? [{ key: "d", divider: true as const }, { key: "call", label: t("Qo'ng'iroq qilish"), hint: phone.show, icon: Phone, onSelect: () => call(r.o) }] : []),
    ];
  }

  function remindButton(r: FlRow, label: string) {
    return (
      <ActionMenu items={remindMenu(r)} label={t("{name} — eslatish", { name: r.o.name || "" })} width={250}>
        {(trigger, open) => (
          <button type="button" {...trigger} className={`${secondaryBtn} h-8 px-2.5 text-v2-small ${open ? "bg-v2-surface-2" : ""}`}>
            <Phone className="size-3.5" strokeWidth={1.75} aria-hidden />
            {label}
          </button>
        )}
      </ActionMenu>
    );
  }

  function remindCell(r: FlRow): ReactNode {
    const s = remindOf(r, nowMs);
    switch (s.kind) {
      case "off":
        return <span className="whitespace-nowrap text-v2-small text-v2-text-3">{t("Eslatish o'chirilgan")}</span>;
      case "done":
        if (s.result === "javob_yoq")
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap text-v2-small font-medium text-v2-warning">
                {t("Javob bermadi")} · {whenText(s.at)}
              </span>
              {r.waiting && r.section === "upcoming" && remindButton(r, t("Qayta"))}
            </div>
          );
        return (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-v2-small">
            <Check className="size-3.5 text-v2-success" strokeWidth={2.25} aria-hidden />
            <span className="font-medium text-v2-success">{s.result === "tasdiqladi" ? t("Tasdiqladi") : t("Eslatildi")}</span>
            <span className="text-v2-text-2">· {whenText(s.at)}</span>
          </span>
        );
      case "written":
        return (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-v2-small">
            <Check className="size-3.5 text-v2-success" strokeWidth={2.25} aria-hidden />
            <span className="font-medium text-v2-text">{t("Yozildi")}</span>
            <span className="text-v2-text-2">· {whenText(s.at)}</span>
          </span>
        );
      case "due":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 whitespace-nowrap text-v2-small font-medium ${s.when === "overdue" ? "text-v2-danger" : "text-v2-warning"}`}>
              <Phone className="size-3.5" strokeWidth={1.75} aria-hidden />
              {s.when === "overdue" ? t("Eslatish kechikdi") : s.when === "today" ? t("Eslatish: bugun") : t("Eslatish: ertaga")}
            </span>
            {remindButton(r, t("Eslatish"))}
          </div>
        );
      case "later":
        return <span className="whitespace-nowrap text-v2-small text-v2-text-3">{t("Eslatish: {day}", { day: f.day(s.day) })}</span>;
      case "none":
        return dash;
    }
  }

  function markButtons(r: FlRow) {
    const busy = busyId === r.o.id;
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={busyId !== null}
          onClick={(e) => void keldi(r, e.currentTarget.closest("td"))}
          className="inline-flex h-8 items-center gap-1.5 rounded-v2-md border border-v2-success bg-v2-surface px-2.5 text-v2-small font-semibold text-v2-success transition-colors hover:bg-v2-success-bg focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
          {t("Keldi")}
        </button>
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => setMissed({ id: r.o.id })}
          className="inline-flex h-8 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2.5 text-v2-small font-semibold text-v2-danger transition-colors hover:bg-v2-danger-bg focus-visible:shadow-v2-focus focus-visible:outline-none disabled:opacity-60"
        >
          <X className="size-3.5" strokeWidth={2.25} aria-hidden />
          {t("Kelmadi")}
        </button>
      </div>
    );
  }

  function resultCell(r: FlRow): ReactNode {
    const o = r.o;
    if (missed?.id === o.id)
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5 text-v2-small">
          <span className="inline-flex items-center gap-1 rounded-v2-sm bg-v2-danger-bg px-1.5 py-0.5 font-semibold text-v2-danger">
            <X className="size-3" strokeWidth={2.5} aria-hidden />
            {t("Kelmadi")}
          </span>
          <span className="text-v2-text-2">· {t("keyingi qadam tanlanmoqda...")}</span>
        </span>
      );
    switch (r.result.kind) {
      case "keldi": {
        if (!r.result.joined)
          return (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-success">
                <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                {t("Keldi")}
              </span>
              <button type="button" onClick={() => setGroupFor(o.id)} className={`${secondaryBtn} h-8 px-2.5 text-v2-small`}>
                <UserPlus className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("Guruhga qo'shish")}
              </button>
            </div>
          );
        const at = Date.parse(o.holatAt ?? "");
        const when = Number.isFinite(at) && nowMs - at < JUST_NOW_MS ? t("hozirgina") : Number.isFinite(at) ? uzTimeOf(at) : "";
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 text-v2-small font-semibold text-v2-success">
                <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
                {t("Keldi")}
              </span>
              <span className="block whitespace-nowrap text-v2-caption text-v2-text-2">
                {[when, o.holatBy ? shortName(o.holatBy) : "", t("guruhga qo'shildi")].filter(Boolean).join(" · ")}
              </span>
            </div>
            {canPay && (
              <button type="button" onClick={() => void openPay(o, groupList.find((g) => g.id === o.groupId) ?? r.group)} className={`${secondaryBtn} h-8 px-2.5 text-v2-small`}>
                <Wallet className="size-3.5" strokeWidth={1.75} aria-hidden />
                {t("To'lov qabul qilish")}
              </button>
            )}
          </div>
        );
      }
      case "ketdi":
        return (
          <div>
            <span className="inline-flex items-center rounded-v2-sm bg-v2-surface-2 px-1.5 py-0.5 text-v2-small font-semibold text-v2-text-2">{t("Ketdi")}</span>
            {r.result.reason && <span className="mt-0.5 block max-w-[260px] truncate text-v2-caption text-v2-text-2" title={t(r.result.reason)}>{t(r.result.reason)}</span>}
          </div>
        );
      case "kelmadi": {
        const fu = o.firstLessonFollowUp;
        const late = !!fu && fu.due < `${today} ${uzTimeOf(nowMs)}`;
        return (
          <div>
            <span className="inline-flex items-center gap-1 rounded-v2-sm bg-v2-danger-bg px-1.5 py-0.5 text-v2-small font-semibold text-v2-danger">
              <X className="size-3" strokeWidth={2.5} aria-hidden />
              {t("Kelmadi")}
            </span>
            {fu ? (
              <span className={`mt-0.5 block whitespace-nowrap text-v2-caption ${late ? "font-medium text-v2-warning" : "text-v2-text-2"}`} title={fu.note || undefined}>
                {[late ? t("Qo'ng'iroq kechikdi: {due}", { due: dueText(fu.due, nowMs) }) : t("Qo'ng'iroq: {due} gacha", { due: dueText(fu.due, nowMs) }), shortName(fu.assignee)].filter(Boolean).join(" · ")}
              </span>
            ) : (
              <button type="button" onClick={() => setMissed({ id: o.id })} className="mt-0.5 block rounded-v2-sm text-v2-caption font-medium text-v2-brand-text underline-offset-2 hover:underline">
                {t("Keyingi qadamni tanlash")}
              </button>
            )}
          </div>
        );
      }
      case "none":
        if (r.section === "today" && !lessonStarted(r, nowMs))
          return <span className="whitespace-nowrap text-v2-small text-v2-text-3">{r.vaqt ? t("Dars {time} da", { time: r.vaqt }) : t("Dars hali boshlanmagan")}</span>;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="whitespace-nowrap text-v2-small text-v2-text-3">{t("Natija belgilanmagan")}</span>
            {markButtons(r)}
          </div>
        );
    }
  }

  function rowMenu(r: FlRow): ActionMenuEntry[] {
    const o = r.o;
    const phone = phoneParts(o.phone);
    const u = undoState(o, nowMs, isAdmin);
    const started = lessonStarted(r, nowMs);
    const items: ActionMenuEntry[] = [{ key: "h", heading: o.name || `#${o.id}` }];
    if (canLeads) items.push({ key: "card", label: t("Lid kartasi"), icon: SquareArrowOutUpRight, href: `/orders-list/${o.id}` });
    if (phone) items.push({ key: "call", label: t("Qo'ng'iroq qilish"), hint: phone.show, icon: Phone, onSelect: () => call(o) });
    if (r.waiting) {
      items.push({ key: "d1", divider: true });
      items.push({ key: "move", label: t("Boshqa kunga ko'chirish"), icon: CalendarClock, onSelect: () => setBook({ order: o }) });
      if (r.section !== "upcoming" && started && r.result.kind === "none") {
        items.push({ key: "keldi", label: t("Keldi"), icon: Check, onSelect: () => void keldi(r, document.querySelector<HTMLElement>(`[data-fl-result="${o.id}"]`)) });
        items.push({ key: "kelmadi", label: t("Kelmadi"), icon: X, onSelect: () => setMissed({ id: o.id }) });
      }
      if (r.result.kind === "kelmadi") items.push({ key: "next", label: t("Keyingi qadam"), icon: ArrowRight, onSelect: () => setMissed({ id: o.id }) });
      items.push({ key: "ketdi", label: t("Ketdi"), icon: UserMinus, danger: true, onSelect: () => setMissed({ id: o.id, step: "ketdi" }) });
    } else if (u.has) {
      items.push({ key: "d2", divider: true });
      items.push({
        key: "undo",
        label: t("Bekor qilish"),
        icon: RotateCcw,
        disabled: !u.can,
        title: u.can ? undefined : t("10 daqiqa o'tdi — faqat direktor bekor qila oladi"),
        onSelect: () => void undo(o.id, r.result.kind === "keldi" ? t("O'quvchi guruhda qoldi — kerak bo'lsa guruhdan chiqaring") : undefined),
      });
    }
    return items;
  }

  function menuCell(r: FlRow) {
    return (
      <ActionMenu items={rowMenu(r)} label={t("{name} — amallar", { name: r.o.name || "" })} width={240}>
        {(trigger, open) => (
          <button
            type="button"
            {...trigger}
            title={t("Amallar")}
            aria-label={t("{name} — amallar", { name: r.o.name || "" })}
            className={`inline-flex size-8 items-center justify-center rounded-v2-md text-v2-text-2 transition-[opacity,background-color] hover:bg-v2-surface-2 hover:text-v2-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-v2-focus [@media(hover:none)]:opacity-100 ${
              open ? "bg-v2-surface-2 opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </ActionMenu>
    );
  }

  /* ---- Bo'limlar ---- */
  const th = "whitespace-nowrap bg-v2-surface-2 py-2.5 text-left text-v2-small font-medium text-v2-text-2 shadow-[inset_0_-1px_0_var(--v2-border)]";
  const td = "px-2.5 py-3 align-middle";

  function rowCls(r: FlRow): { tr: string; bar: string } {
    if (pop?.id === r.o.id) return { tr: SUCCESS_TINT, bar: "" };
    if (missed?.id === r.o.id) return { tr: ROW_TINT.warning, bar: ROW_BAR.warning };
    return { tr: ROW_TINT.hover, bar: "" };
  }

  function table(list: FlRow[], kind: FlSection) {
    const cols = kind === "today" ? [t("Lid"), t("Guruh"), t("Vaqt"), t("Eslatish"), t("Natija")] : kind === "past" ? [t("Lid"), t("Guruh"), t("Sana"), t("Natija")] : [t("Lid"), t("Guruh"), t("Vaqt"), t("Eslatish")];
    const span = cols.length + 1;
    const days: { iso: string; rows: FlRow[] }[] = [];
    if (kind === "upcoming") for (const r of list) (days[days.length - 1]?.iso === r.sana ? days[days.length - 1] : (days[days.length] = { iso: r.sana, rows: [] })).rows.push(r);
    const line = (r: FlRow) => {
      const c = rowCls(r);
      return (
        <tr key={r.o.id} className={`group border-b border-v2-border transition-colors last:border-b-0 ${c.tr}`}>
          <td className={`${td} pl-4 ${c.bar}`}>{leadCell(r)}</td>
          <td className={td}>{groupCell(r)}</td>
          {kind === "past" ? (
            <td className={`${td} whitespace-nowrap`}>
              <span className="block font-semibold tabular-nums text-v2-text">{f.day(r.sana)}</span>
              <span className="block text-v2-small tabular-nums text-v2-text-2">{[f.weekday(r.sana).toLowerCase(), r.vaqt].filter(Boolean).join(" · ")}</span>
            </td>
          ) : (
            <td className={`${td} whitespace-nowrap tabular-nums text-v2-text`}>{timeText(r) || dash}</td>
          )}
          {kind !== "past" && <td className={td}>{remindCell(r)}</td>}
          {kind !== "upcoming" && (
            <td className={td} data-fl-result={r.o.id}>
              {resultCell(r)}
            </td>
          )}
          <td className={`${td} w-11 pl-1 pr-3 text-right`}>{menuCell(r)}</td>
        </tr>
      );
    };
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-v2-body">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th key={c} className={`${th} ${i === 0 ? "pl-4 pr-2.5" : "px-2.5"}`}>
                  {c}
                </th>
              ))}
              <th className={`${th} w-11 pl-1 pr-3`}>
                <span className="sr-only">{t("Amallar")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {kind === "upcoming"
              ? days.map((d) => [
                  <tr key={`d-${d.iso}`} className="border-b border-v2-border bg-v2-surface-2/60">
                    <td colSpan={span} className="px-4 py-2 text-v2-small">
                      <span className="font-semibold text-v2-text">{`${f.weekday(d.iso)}, ${f.day(d.iso)}`}</span>
                      <span className="text-v2-text-2"> · {t("{n} kishi", { n: d.rows.length })}</span>
                    </td>
                  </tr>,
                  ...d.rows.map(line),
                ])
              : (kind === "past" ? list.slice(0, pastShown) : list).map(line)}
            {kind === "past" && list.length > pastShown && (
              <tr>
                <td colSpan={span} className="px-4 py-2.5">
                  <button type="button" onClick={() => setPastShown((n) => n + PAST_PAGE * 5)} className="rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
                    {t("Yana ko'rsatish — {n} ta eskiroq", { n: list.length - pastShown })}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function sectionCard(kind: FlSection, list: FlRow[]) {
    const n = list.filter((r) => r.waiting).length;
    let title: ReactNode;
    let aside: ReactNode;
    if (kind === "today") {
      const came = list.filter((r) => r.result.kind === "keldi").length;
      const starts = list.map((r) => r.vaqt).filter(Boolean).sort();
      const ends = list.map((r) => r.tugash || r.vaqt).filter(Boolean).sort();
      const lastEnd = ends[ends.length - 1];
      const allDone = !!lastEnd && list.every((r) => lessonStarted({ sana: r.sana, vaqt: r.tugash || r.vaqt }, nowMs));
      const anyStarted = list.some((r) => lessonStarted(r, nowMs));
      title = (
        <>
          {t("Bugun")} · {f.dayWithWeekday(today)}
          <span className="font-normal text-v2-text-2">
            {" "}
            — {t("{n} kishi", { n: list.length })}
            {came > 0 && ` · ${t("{n} tasi keldi", { n: came })}`}
          </span>
        </>
      );
      aside = starts.length ? (
        <>
          {t("darslar {from}–{to}", { from: starts[0], to: lastEnd })} · {allDone ? t("hammasi tugadi") : anyStarted ? t("davom etmoqda") : t("hali boshlanmagan")}
        </>
      ) : null;
    } else if (kind === "past") {
      title = (
        <>
          {t("O'tgan kunlar — natija yo'q")}
          <span className="ml-2 inline-flex items-center rounded-v2-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("{n} kishi", { n })}</span>
        </>
      );
      aside = t("hal bo'lguncha ro'yxatda turadi");
    } else {
      const first = list[0]?.sana;
      const last = list[list.length - 1]?.sana;
      const range = !first ? "" : first === last ? f.day(first) : first.slice(0, 7) === last?.slice(0, 7) ? `${Number(first.slice(8))}–${f.day(last)}` : `${f.day(first)} – ${f.day(last ?? first)}`;
      title = (
        <>
          {t("Kelgusi darslar")}
          <span className="font-normal text-v2-text-2">
            {" "}
            · {t("{n} kishi", { n })}
            {range && ` · ${range}`}
          </span>
        </>
      );
      aside = t("eslatish qo'ng'irog'i — dars kunidan bir kun oldin");
    }
    return (
      <section key={kind} className={`overflow-hidden rounded-v2-lg border bg-v2-surface shadow-v2-sm ${kind === "past" ? "border-v2-warning" : "border-v2-border"}`}>
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
          <h2 className="text-v2-section font-semibold text-v2-text">{title}</h2>
          {aside && <span className="text-v2-small text-v2-text-3">{aside}</span>}
        </header>
        {table(list, kind)}
      </section>
    );
  }

  const loadingList = loading && orders.length === 0;
  const sections: FlSection[] = tab === "all" ? ["today", "past", "upcoming"] : [tab];
  const shown = sections.map((s) => ({ s, list: bySection(s) })).filter((x) => x.list.length > 0);
  const anyFilter = !!(groupF || teacherF || search.trim());
  const tabs: { key: Tab; label: string; n: number; warn?: boolean }[] = [
    { key: "all", label: t("Hammasi"), n: counts.all },
    { key: "today", label: t("Bugun"), n: counts.today },
    { key: "past", label: t("O'tgan, natija yo'q"), n: counts.past, warn: counts.past > 0 },
    { key: "upcoming", label: t("Kelgusi"), n: counts.upcoming },
  ];

  /* ---- Keldi oynachasi ---- */
  const popMonth = popRow ? (popRow.o.guruh?.boshlash || popRow.sana || today) : today;
  const popPrice = pop ? (info[pop.group.id]?.price ?? null) : null;
  const popFirst = (popRow?.o.name || "").trim().split(/\s+/)[0] || t("O'quvchi");

  return (
    <div data-ui="v2" className="relative flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      {/* 1. Sarlavha */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label={t("Bo'lim yo'li")} className="mb-1 flex items-center gap-1 text-v2-small text-v2-text-3">
            {canLeads ? (
              <Link href="/orders-list" className="rounded-v2-sm hover:text-v2-text hover:underline">
                {t("Lidlar")}
              </Link>
            ) : (
              <span>{t("Lidlar")}</span>
            )}
            <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden />
            <span className="text-v2-text-2">{t("Birinchi darsga yozilganlar")}</span>
          </nav>
          <h1 className="text-v2-page text-v2-text">{t("Birinchi darsga yozilganlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {[branchTitle, loadingList ? t("Yuklanmoqda…") : t("{n} kishi natija kutmoqda", { n: fmtNum(totalWaiting) }), t("natija dars kuni shu yerda belgilanadi")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={() => setBook({})} className={primaryBtn}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t("Birinchi darsga yozish")}
        </button>
      </div>

      {/* 2. Bo'limlar va filtrlar */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("Bo'lim")} className="flex max-w-full overflow-x-auto rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((x) => {
            const on = tab === x.key;
            return (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(x.key)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-v2-small transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                  on ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"
                }`}
              >
                {x.label}
                <span className={`tabular-nums ${x.warn ? "rounded-v2-full bg-v2-warning-bg px-1.5 font-semibold text-v2-warning" : on ? "text-v2-text-2" : "text-v2-text-3"}`}>{loadingList ? "—" : x.n}</span>
              </button>
            );
          })}
        </div>
        <V2Select variant="chip" label={t("Guruh")} value={groupF} onChange={setGroupF} options={groupOptions} />
        <V2Select variant="chip" label={t("O'qituvchi")} value={teacherF} onChange={setTeacherF} options={teacherOptions} />
        <div className="relative w-full sm:ml-auto sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder={t("Ism yoki telefon")}
            aria-label={t("Ism yoki telefon")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Guruhlar bo'yicha */}
      {groupCards.length > 0 && (
        <section aria-label={t("Guruhlar bo'yicha")}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-v2-small font-semibold text-v2-text">
              {t("Guruhlar bo'yicha")} <span className="font-normal text-v2-text-2">— {t("kim qaysi guruhga keladi")}</span>
            </h2>
            {canGroups && (
              <Link href="/groups" className="inline-flex items-center gap-1 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
                {t("Bo'sh o'rinlar")}
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
              </Link>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {shownCards.map(({ g, n }) => {
              const on = groupF === String(g.id);
              const s = seatsOf(g, info[g.id]);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGroupF(on ? "" : String(g.id))}
                  className={`rounded-v2-lg border px-3.5 py-2.5 text-left transition-colors focus-visible:shadow-v2-focus focus-visible:outline-none ${
                    on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface shadow-v2-sm hover:bg-v2-hover"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${FAN_DOT[fanOf(g.course)]}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-v2-body font-semibold text-v2-text">{groupTitle(g, cardGroups)}</span>
                    <span className="shrink-0 text-v2-small font-semibold tabular-nums text-v2-text">{t("{n} kishi", { n })}</span>
                  </span>
                  <span className="mt-0.5 block truncate pl-4 text-v2-caption text-v2-text-2">
                    {s.capacity !== null ? (
                      <>
                        <span className={s.free === 0 ? "font-medium text-v2-warning" : ""}>{t("bo'sh o'rin {n}", { n: s.free ?? 0 })}</span>
                        {` · ${t("{a} / {b} band", { a: s.students, b: s.capacity })}`}
                      </>
                    ) : (
                      t("{n} o'quvchi", { n: s.students })
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {groupCards.length > CARD_LIMIT && (
            <button type="button" onClick={() => setAllCards((v) => !v)} className="mt-2 rounded-v2-sm text-v2-small font-medium text-v2-brand-text underline-offset-2 hover:underline">
              {allCards ? t("Kamroq ko'rsatish") : t("Yana {n} ta guruh", { n: groupCards.length - shownCards.length })}
            </button>
          )}
        </section>
      )}

      {/* 4–6. Bo'limlar */}
      {loadingList ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-40 rounded-v2-lg bg-v2-skeleton" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-v2-lg border border-v2-border bg-v2-surface-2 px-6 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-v2-md bg-v2-surface text-v2-text-3 shadow-v2-sm">
            <Inbox className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          {anyFilter ? (
            <>
              <div className="text-v2-section text-v2-text">{t("Mos lid topilmadi")}</div>
              <p className="text-v2-small text-v2-text-2">{t("Qidiruv yoki filtrlarni o'zgartirib ko'ring.")}</p>
              <button
                type="button"
                onClick={() => {
                  setGroupF("");
                  setTeacherF("");
                  setSearch("");
                }}
                className={`${secondaryBtn} mt-2`}
              >
                {t("Filtrlarni tozalash")}
              </button>
            </>
          ) : (
            <>
              <div className="text-v2-section text-v2-text">
                {tab === "today" ? t("Bugun birinchi dars yo'q") : tab === "past" ? t("Natijasi belgilanmagan dars yo'q") : tab === "upcoming" ? t("Kelgusi birinchi darslar yo'q") : t("Birinchi darsga yozilgan lid yo'q")}
              </div>
              <p className="max-w-md text-v2-small text-v2-text-2">{t("Lidni guruhning birinchi darsiga yozing — u shu yerda chiqadi.")}</p>
              <button type="button" onClick={() => setBook({})} className={`${primaryBtn} mt-2`}>
                <Plus className="size-4" strokeWidth={2} aria-hidden />
                {t("Birinchi darsga yozish")}
              </button>
            </>
          )}
        </div>
      ) : (
        shown.map((x) => sectionCard(x.s, x.list))
      )}

      {/* Izoh */}
      {!loadingList && (
        <div className="space-y-1 text-v2-caption text-v2-text-3">
          <p>
            <b className="font-semibold text-v2-text-2">«{t("Keldi")}»</b> — {t("lid guruhga «Yangi o'quvchi» bo'lib qo'shiladi va to'lov taklif qilinadi.")}
          </p>
          <p>
            <b className="font-semibold text-v2-text-2">«{t("Kelmadi")}»</b> — {t("keyingi qadam tanlanadi: operator qo'ng'irog'i, yangi sana yoki «ketdi».")}
          </p>
        </div>
      )}

      {/* «Keldi» → guruhga qo'shildi */}
      <FloatingPanel open={!!pop && !!popRow} anchorRef={popAnchor} onClose={() => setPop(null)} align="end" width={340} maxHeight={420} role="dialog" ariaLabel={t("Guruhga qo'shildi")}>
        {pop && popRow && (
          <div className="p-4">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-success text-v2-on-color">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-v2-body font-semibold text-v2-text">{t("{group} guruhiga qo'shildi", { group: groupTitle(pop.group, groupList) })}</div>
              <button type="button" onClick={() => setPop(null)} aria-label={t("Yopish")} className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 hover:bg-v2-surface-2 hover:text-v2-text">
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="mt-1.5 text-v2-small text-v2-text-2">
              {t("{name} endi «Yangi o'quvchi».", { name: popFirst })} {canPay && t("Birinchi to'lovni hozir qabul qilasizmi?")}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-v2-md bg-v2-surface-2 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-v2-small font-semibold text-v2-text">{t("{month} uchun", { month: MONTHS[lang][Number(popMonth.slice(5, 7)) - 1] ?? "" })}</div>
                <div className="truncate text-v2-caption text-v2-text-2">{[pop.group.teacher ? shortName(pop.group.teacher) : "", [pop.group.day, startTimeOf(pop.group.time)].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="shrink-0 text-right text-v2-body font-semibold tabular-nums text-v2-text">{popPrice !== null ? `${fmtNum(popPrice)} ${t("so'm")}` : <span className="text-v2-small font-normal text-v2-text-3">{t("narx kiritilmagan")}</span>}</div>
            </div>
            <div className="mt-3 flex gap-2">
              {canPay && (
                <button
                  type="button"
                  onClick={() => {
                    const p = pop;
                    setPop(null);
                    void openPay(popRow.o, p.group, p.pupil);
                  }}
                  className={`${primaryBtn} h-9 flex-1 justify-center`}
                >
                  <Wallet className="size-4" strokeWidth={1.75} aria-hidden />
                  {t("To'lov qabul qilish")}
                </button>
              )}
              <button type="button" onClick={() => setPop(null)} className={`${secondaryBtn} h-9 justify-center ${canPay ? "" : "flex-1"}`}>
                {t("Keyinroq")}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-v2-border pt-2.5 text-v2-caption">
              <span className="text-v2-text-3">{t("Qarz bo'lib yoziladi, to'lov keyin ham olinadi")}</span>
              <button
                type="button"
                onClick={() => {
                  const id = pop.id;
                  setPop(null);
                  void undo(id, t("O'quvchi guruhda qoldi — kerak bo'lsa guruhdan chiqaring"));
                }}
                className="shrink-0 rounded-v2-sm font-medium text-v2-danger underline-offset-2 hover:underline"
              >
                {t("Bekor qilish")}
              </button>
            </div>
          </div>
        )}
      </FloatingPanel>

      {/* Oynalar */}
      {book && (
        <BookModalV2
          order={book.order}
          orders={orders}
          groups={groups}
          info={info}
          waitingByGroup={waitingByGroup}
          nowMs={nowMs}
          onClose={() => setBook(null)}
          onDone={(order, message) => {
            replaceOrder(order);
            setClock(Date.now());
            showToast({ tone: "success", title: message, detail: order.name, action: { label: t("Bekor qilish"), onClick: () => void undo(order.id) } });
          }}
          onConflict={onConflict}
        />
      )}
      {missed && missedRow && (
        <MissedModalV2
          row={missedRow}
          nowMs={nowMs}
          initialStep={missed.step}
          patchOrder={patchOrder}
          addMessage={addMessage}
          onClose={() => setMissed(null)}
          onDone={(order, message, holatChanged) => {
            replaceOrder(order);
            setClock(Date.now());
            showToast({
              tone: "success",
              title: message,
              detail: order.name,
              action: holatChanged ? { label: t("Bekor qilish"), onClick: () => void undo(order.id) } : undefined,
            });
          }}
          onConflict={onConflict}
        />
      )}
      {groupFor !== null && groupRow && (
        <LeadGroupModalV2
          order={groupRow.o}
          branchName={branchTitle}
          nowMs={nowMs}
          groups={groups}
          canPay={canPay}
          onClose={() => setGroupFor(null)}
          onDone={joined}
          onConflict={onConflict}
        />
      )}
      {payFor && (
        <StudentPaymentModalV2
          student={payFor.student}
          groups={payFor.groups}
          initialGroupId={payFor.groupId}
          initialAmount={payFor.amount}
          initialMonth={payFor.month}
          onClose={() => setPayFor(null)}
        />
      )}
    </div>
  );
}
