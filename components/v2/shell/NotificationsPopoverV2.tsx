"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { AlarmClock, ArrowRight, Bell, CirclePlay, ClipboardCheck, Megaphone, UserPlus, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT, type TFn } from "@/components/shared/Language";
import { useNotifications } from "@/components/shared/NotificationsProvider";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { SOURCE_LABELS } from "@/constants/notifications";
import {
  getSeenAnnouncementId,
  markAnnouncementsSeen,
  recentAnnouncements,
  useAnnouncementsUnseen,
  type Announcement,
} from "@/lib/announcementsV2";
import { badgeLabel, overdueUz, relativeUz, type NotifItem, type NotifKind } from "@/lib/notifications";
import { isPathAllowed } from "@/lib/permissions";
import { uzDayKey, uzStamp } from "@/lib/uzTime";
import { usePopover } from "./usePopover";
import { onOpenAnnouncements } from "./v2Events";

// YANGI VERSIYA: BILDIRISHNOMALAR OYNASI (21-qism «Bildirishnomalar» va
// «Bildirishnomalar · E'lonlar» rasmlari) — qo'ng'iroq tugmasi + oyna.
//
// Uch varaq:
//   • Hammasi — «Muhim» (hal bo'lguncha tepada) + Bugun / Kecha / Oldinroq.
//   • Menga   — shaxsan menga tegishlilari (pastdagi `isMine`).
//   • E'lonlar — Tizimli jamoasining yangiliklari (lib/announcementsV2.ts,
//     bazasiz). Yordam menyusidagi «Yangiliklar» shu varaqni ochadi
//     (v2Events → onOpenAnnouncements).
//
// Ma'lumot va qoidalar eski panel bilan BITTA (components/shared/
// NotificationsPanel.tsx): ochilgan lahzadagi o'qilmaganlar ro'yxati,
// ochiqda ro'yxat siljimasligi, ko'rsatilgandan ko'p o'qilmagan manbaga
// alohida banner. Farqi — o'qildi kursori FAQAT bildirishnomalar ko'ringanda
// suriladi: Yordam'dan to'g'ridan-to'g'ri «E'lonlar» ochilsa qo'ng'iroq
// nishoni ko'rilmagan yozuvlarni jimgina yutib yubormaydi.

const ICON_BTN =
  "relative size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text";
const ICON = "size-5";
/** TopbarV2 dagi oyna bilan bir xil (telefonda ekran kengligida). */
const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";
/** Ro'yxat qismi — sarlavha, varaqlar va pastki qator joyida qoladi. */
const BODY = "max-h-[min(28rem,calc(100dvh-13rem))] overflow-y-auto overscroll-contain";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;
type Tab = "all" | "mine" | "announcements";

const KINDS: NotifKind[] = ["payment", "order", "task"];

/** Tur bo'yicha ikonka va rang (notanish tur ham yiqitmaydi — `kindStyle`). */
const KIND_STYLE: Record<NotifKind, { icon: IconType; tone: string }> = {
  payment: { icon: Wallet, tone: "bg-v2-success-bg text-v2-success" },
  order: { icon: UserPlus, tone: "bg-v2-info-bg text-v2-info" },
  task: { icon: ClipboardCheck, tone: "bg-v2-violet-bg text-v2-violet" },
};
const DANGER = "bg-v2-danger-bg text-v2-danger";
const WARNING = "bg-v2-warning-bg text-v2-warning";

function kindStyle(kind: string): { icon: IconType; tone: string } {
  return (KIND_STYLE as Record<string, { icon: IconType; tone: string }>)[kind] ?? {
    icon: Bell,
    tone: "bg-v2-brand-bg text-v2-brand-text",
  };
}

/**
 * Ijrochiga keladigan topshiriq hodisalari — lib/staffTasksServer.ts dagi
 * ASSIGNEE_NOTIF sarlavhalari bilan AYNAN bir xil bo'lsin (u yerda o'zgarsa
 * shu yerda ham). Rahbar sarlavhalari (MANAGER_NOTIF) bu ro'yxatda yo'q:
 * ular faqat topshiriqni O'ZIM bergan bo'lsam «Menga» ga tushadi.
 */
const ASSIGNEE_TITLES = new Set([
  "Sizga yangi topshiriq",
  "Topshiriq qaytarildi",
  "Topshiriq tasdiqlandi",
  "Topshiriq muddati o'tdi",
  "Topshiriq bajarilmadi — jarima",
  "Topshiriq bekor qilindi",
  "Topshiriq tahrirlandi",
  "Jarima bekor qilindi",
]);

/** "stask:12:3" → 12 (xodim topshirig'i hodisasi); boshqa tur — null. */
function taskIdOf(itemId: string): number | null {
  const m = /^stask:(\d+):/.exec(itemId);
  return m ? Number(m[1]) : null;
}

type GroupKey = "today" | "yesterday" | "earlier";
const GROUP_LABEL: Record<GroupKey, string> = { today: "Bugun", yesterday: "Kecha", earlier: "Oldinroq" };

function groupOf(atIso: string, nowMs: number): GroupKey {
  const ms = Date.parse(atIso);
  if (!Number.isFinite(ms)) return "earlier";
  const day = uzDayKey(new Date(ms));
  if (day === uzDayKey(new Date(nowMs))) return "today";
  if (day === uzDayKey(new Date(nowMs - 86_400_000))) return "yesterday";
  return "earlier";
}

/** O'ng tomondagi vaqt: bugun — nisbiy, kecha — soat, oldinroq — kun.oy. */
function timeOf(atIso: string, nowMs: number, group: GroupKey, t: TFn): string {
  const ms = Date.parse(atIso);
  if (!Number.isFinite(ms)) return "";
  const [date, hm] = uzStamp(new Date(ms)).split(" | ");
  if (group === "today") return t(relativeUz(atIso, nowMs));
  if (group === "yesterday") return hm ?? "";
  return date.slice(0, 5);
}

/** «Muhim» qatori — hal bo'lmaguncha turadi (TaskInbox holatidan, tarixdan emas). */
interface PinnedRow {
  key: string;
  /** Xodim topshirig'i id'si — uning hodisalari pastdagi guruhlarda takrorlanmaydi. */
  taskId: number | null;
  icon: IconType;
  tone: string;
  title: string;
  body: string;
  meta: string;
  href: string | null;
  /** Eski «Vazifa» — sahifasi yo'q, Topshiriqlarim oynasi ochiladi. */
  openInbox: boolean;
}

/** «Muhim» da birdan ko'rinadigani; qolgani «Yana N ta» bilan Topshiriqlarim'da. */
const PINNED_MAX = 4;

function CountBadge({ value }: { value: string | number }) {
  return (
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-v2-full bg-v2-danger px-1 text-[10px] font-semibold leading-none tabular-nums text-v2-on-danger ring-2 ring-v2-surface">
      {value}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-v2-body font-medium transition-colors ${
        active ? "border-v2-brand text-v2-text" : "border-transparent text-v2-text-2 hover:text-v2-text"
      }`}
    >
      {children}
    </button>
  );
}

function TabCount({ value, active }: { value: string; active: boolean }) {
  return (
    <span
      className={`min-w-5 rounded-v2-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums ${
        active ? "bg-v2-brand-bg text-v2-brand-text" : "bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {value}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="px-4 pb-1 pt-3 text-v2-caption text-v2-text-3">{children}</div>;
}

/** Bitta qator: rangli ikonka, qalin sarlavha, ikkinchi qator, o'ngda vaqt va «yangi» nuqtasi. */
function Row({
  icon: Icon,
  tone,
  title,
  body,
  meta,
  time,
  isNew,
  href,
  onClick,
  newLabel,
}: {
  icon: IconType;
  tone: string;
  title: string;
  body: string;
  meta?: string;
  time?: string;
  isNew?: boolean;
  href: string | null;
  onClick: () => void;
  newLabel: string;
}) {
  const inner = (
    <>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-v2-md ${tone}`}>
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-v2-body font-semibold text-v2-text">{title}</span>
        {body && <span className="mt-0.5 line-clamp-2 text-v2-small text-v2-text-2">{body}</span>}
        {meta && <span className="mt-0.5 block text-v2-caption text-v2-danger">{meta}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {time && <span className="whitespace-nowrap text-v2-caption text-v2-text-3 tabular-nums">{time}</span>}
        {isNew && <span className="size-2 rounded-v2-full bg-v2-brand" role="img" aria-label={newLabel} />}
      </span>
    </>
  );
  const cls = `flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-v2-hover ${isNew ? "bg-v2-brand-bg/40" : ""}`;
  return (
    <li>
      {href ? (
        <Link href={href} onClick={onClick} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

function SkeletonRows() {
  return (
    <div aria-busy="true" className="motion-safe:animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <span className="size-9 shrink-0 rounded-v2-md bg-v2-skeleton" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-3 w-2/3 rounded-v2-sm bg-v2-skeleton" />
            <span className="block h-3 w-5/12 rounded-v2-sm bg-v2-skeleton" />
          </span>
          <span className="mt-1 h-3 w-10 shrink-0 rounded-v2-sm bg-v2-skeleton" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-text-3">
        <Bell className="size-5" strokeWidth={1.75} />
      </span>
      <div className="text-v2-body font-semibold text-v2-text">{title}</div>
      {sub && <div className="mt-1 text-v2-small text-v2-text-3">{sub}</div>}
    </div>
  );
}

/** Ochiq havola (video) — yangi varaqda; ichki sahifa — oddiy o'tish. */
function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function annDateLabel(date: string, nowMs: number, t: TFn): string {
  const key = Number(date.replace(/-/g, ""));
  if (nowMs > 0) {
    if (key === uzDayKey(new Date(nowMs))) return t("Bugun");
    if (key === uzDayKey(new Date(nowMs - 86_400_000))) return t("Kecha");
  }
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

export interface NotificationsPopoverV2Props {
  /**
   * Foydalanuvchi ruxsatlari (TopbarV2 `permissions`). E'londagi havola
   * faqat ochiladigan sahifaga chiziladi; `null` — admin (hammasi).
   * MAJBURIY, ataylab: unutilsa jimgina «hammasi ochiq» bo'lib qolmasin.
   */
  permissions: string[] | null;
}

export default function NotificationsPopoverV2({ permissions }: NotificationsPopoverV2Props) {
  const { t } = useT();
  const {
    items,
    unread,
    unreadIsFloor,
    sources,
    status,
    everLoaded,
    nowMs,
    reload,
    setPanelOpen,
    markSeen,
    markAllSeen,
  } = useNotifications();
  const inbox = useTaskInbox();
  const annUnseen = useAnnouncementsUnseen();
  const { open, ref, toggle, close } = usePopover();
  const [tab, setTab] = useState<Tab>("all");
  /** «E'lonlar» ochilgan lahzadagi «ko'rilgan» chegarasi — yangilar nuqtasi oyna yopilguncha turadi. */
  const [annSeenAtOpen, setAnnSeenAtOpen] = useState(Number.MAX_SAFE_INTEGER);

  /**
   * Ochilgan LAHZADAGI o'qilmaganlar (eski paneldagi naqsh — render paytida,
   * effektda emas): nishon darhol so'nadi, qaysi qator yangi ekani esa oyna
   * yopilguncha ko'rinib turadi.
   */
  const [snap, setSnap] = useState<{ open: boolean; ids: ReadonlySet<string> }>({ open: false, ids: new Set() });
  if (open !== snap.open) {
    setSnap({ open, ids: open ? new Set(items.filter((it) => it.unread).map((it) => it.id)) : snap.ids });
  }
  const wasNew = snap.ids;

  // Oyna ochiq ekan ro'yxat siljimasin (provayder so'rovni ushlab turadi).
  useEffect(() => {
    if (!open) return;
    setPanelOpen(true);
    return () => setPanelOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // O'qildi kursori — faqat bildirishnomalar KO'RINGANDA. `markSeen` ATAYIN
  // bog'liqlikda emas: u `items` bilan qayta yaratiladi va har so'rovdan
  // keyin kursorni qayta surardi (eski paneldagi izoh).
  const notifVisible = open && tab !== "announcements";
  useEffect(() => {
    if (notifVisible) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifVisible]);

  // «E'lonlar» ko'rindi — Yordam menyusidagi «N ta yangi» ham so'nadi.
  useEffect(() => {
    if (open && tab === "announcements") markAnnouncementsSeen();
  }, [open, tab]);

  // Yordam → «Yangiliklar»: oyna «E'lonlar» varag'i bilan ochiladi.
  useEffect(
    () =>
      onOpenAnnouncements(() => {
        setAnnSeenAtOpen(getSeenAnnouncementId());
        setTab("announcements");
        if (!open) toggle();
      }),
    [open, toggle],
  );

  const onBell = () => {
    if (!open) setTab("all");
    toggle();
  };

  const pickTab = (next: Tab) => {
    if (next === "announcements" && tab !== "announcements") setAnnSeenAtOpen(getSeenAnnouncementId());
    setTab(next);
  };

  // «MUHIM» — hal bo'lguncha tepada. Manba TaskInbox (60 s da yangilanadi):
  // topshiriq yopilsa yoki tasdiqlansa qator o'zi yo'qoladi. Tarix
  // (bildirishnoma) emas, HOZIRGI holat — shuning uchun «o'qildi» uni
  // yashirmaydi.
  const pinned = useMemo<PinnedRow[]>(() => {
    if (!inbox.everLoaded) return [];
    const minutesLate = (dueMs: number) => (nowMs > 0 ? Math.floor((nowMs - dueMs) / 60_000) : 0);
    const late = (dueMs: number) => {
      const m = minutesLate(dueMs);
      return m > 0 ? t(overdueUz(m)) : "";
    };
    const overdueMine = inbox.staffMine
      .filter((x) => x.isLate || x.status === "muddati_otdi")
      .map((x) => ({ x, due: Date.parse(x.deadline) }))
      .sort((a, b) => (a.due || 0) - (b.due || 0))
      .map<PinnedRow>(({ x, due }) => ({
        key: `mine:${x.id}`,
        taskId: x.id,
        icon: AlarmClock,
        tone: DANGER,
        title: t("Topshiriq muddati o'tdi"),
        body: `«${x.title}»`,
        meta: Number.isFinite(due) ? late(due) : "",
        href: `/tasks?open=${x.id}`,
        openInbox: false,
      }));
    const overdueOld = inbox.pending
      .filter((x) => x.dueMs !== null && nowMs > 0 && x.dueMs < nowMs)
      .map<PinnedRow>((x) => ({
        key: `old:${x.id}`,
        taskId: null,
        icon: AlarmClock,
        tone: DANGER,
        title: t("Topshiriq muddati o'tdi"),
        body: [t(x.type), x.student || x.group].filter(Boolean).join(" · "),
        meta: x.dueMs !== null ? late(x.dueMs) : "",
        href: null,
        openInbox: true,
      }));
    const toApprove = inbox.staffGiven
      .filter((x) => x.status === "tasdiq_kutilmoqda")
      .map<PinnedRow>((x) => ({
        key: `given:${x.id}`,
        taskId: x.id,
        icon: ClipboardCheck,
        tone: WARNING,
        title: t("«Bajardim» — tasdiq kutilmoqda"),
        body: x.employeeName ? `«${x.title}» — ${x.employeeName}` : `«${x.title}»`,
        meta: "",
        href: `/tasks?open=${x.id}`,
        openInbox: false,
      }));
    return [...overdueMine, ...overdueOld, ...toApprove];
  }, [inbox.everLoaded, inbox.staffMine, inbox.pending, inbox.staffGiven, nowMs, t]);

  const givenIds = useMemo(() => new Set(inbox.staffGiven.map((x) => x.id)), [inbox.staffGiven]);

  /**
   * «MENGA»: shaxsan menga — ijrochi sifatida kelgan topshiriq hodisalari
   * (ASSIGNEE_TITLES) va O'ZIM bergan topshiriq bo'yicha rahbar hodisalari.
   * To'lov va buyurtma — markaz oqimi, «Menga» emas.
   */
  const isMine = (n: NotifItem): boolean => {
    if (n.kind !== "task") return false;
    if (ASSIGNEE_TITLES.has(n.title)) return true;
    const id = taskIdOf(n.id);
    return id !== null && givenIds.has(id);
  };

  // «Muhim» dagi topshiriqning tarixdagi hodisalari guruhlarda takrorlanmaydi.
  const pinnedTaskIds = new Set(pinned.map((p) => p.taskId).filter((id): id is number => id !== null));
  const listed = items.filter((n) => {
    const id = taskIdOf(n.id);
    return id === null || !pinnedTaskIds.has(id);
  });
  const mineListed = listed.filter(isMine);

  // Varaqdagi son = «Muhim» + ochilgan lahzada yangi bo'lgan qatorlar.
  const allCount = pinned.length + listed.filter((n) => wasNew.has(n.id)).length;
  const mineCount = pinned.length + mineListed.filter((n) => wasNew.has(n.id)).length;
  const countLabel = (n: number) => (n > 99 ? "99+" : String(n));

  const anyUnread = unread > 0 || wasNew.size > 0 || annUnseen > 0;
  const markAllRead = () => {
    markAllSeen();
    markAnnouncementsSeen();
    setSnap((s) => ({ ...s, ids: new Set() }));
    setAnnSeenAtOpen(Number.MAX_SAFE_INTEGER);
  };

  const openInboxModal = () => {
    close();
    inbox.openModal();
  };

  const renderPinned = () => {
    if (pinned.length === 0) return null;
    const shown = pinned.slice(0, PINNED_MAX);
    const rest = pinned.length - shown.length;
    return (
      <section>
        <SectionTitle>
          <span className="font-semibold text-v2-text-2">{t("Muhim")}</span> · {t("hal bo'lguncha tepada turadi")}
        </SectionTitle>
        <ul>
          {shown.map((p) => (
            <Row
              key={p.key}
              icon={p.icon}
              tone={p.tone}
              title={p.title}
              body={p.body}
              meta={p.meta}
              href={p.href}
              onClick={p.openInbox ? openInboxModal : close}
              newLabel={t("Yangi")}
            />
          ))}
        </ul>
        {rest > 0 && (
          <button
            type="button"
            onClick={openInboxModal}
            className="mx-4 mb-1 mt-0.5 text-v2-small font-medium text-v2-brand-text hover:underline"
          >
            {t("Yana {n} ta", { n: rest })}
          </button>
        )}
      </section>
    );
  };

  const renderGroups = (list: NotifItem[]) => {
    const order: GroupKey[] = ["today", "yesterday", "earlier"];
    const by = new Map<GroupKey, NotifItem[]>();
    for (const n of list) {
      const g = groupOf(n.at, nowMs);
      by.set(g, [...(by.get(g) ?? []), n]);
    }
    return order
      .filter((g) => (by.get(g) ?? []).length > 0)
      .map((g) => (
        <section key={g}>
          <SectionTitle>{t(GROUP_LABEL[g])}</SectionTitle>
          <ul>
            {(by.get(g) ?? []).map((n) => {
              const s = kindStyle(n.kind);
              return (
                <Row
                  key={n.id}
                  icon={s.icon}
                  tone={s.tone}
                  title={t(n.title)}
                  body={n.body}
                  meta={n.meta ? t(n.meta) : ""}
                  time={timeOf(n.at, nowMs, g, t)}
                  isNew={wasNew.has(n.id)}
                  href={n.href}
                  onClick={close}
                  newLabel={t("Yangi")}
                />
              );
            })}
          </ul>
        </section>
      ));
  };

  const renderNotifications = () => {
    if (!everLoaded && status === "loading") return <SkeletonRows />;
    if (!everLoaded && status === "error") {
      return (
        <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
          <div className="text-v2-body font-semibold text-v2-text">{t("Bildirishnomalarni yuklab bo'lmadi")}</div>
          <button
            type="button"
            onClick={reload}
            className="mt-3 inline-flex h-8 items-center rounded-v2-md border border-v2-border-strong px-3 text-v2-small font-medium text-v2-text hover:bg-v2-surface-2"
          >
            {t("Qayta urinish")}
          </button>
        </div>
      );
    }

    // Ko'rsatilgandan ko'p o'qilmagani bor manbalar — faqat tugma bilan
    // o'qilgan bo'ladi (eski paneldagi izoh: «eng yangi 8 tasini ko'rdim»
    // degan gapni tamg'a ifodalay olmaydi).
    const hidden = tab === "all" && sources ? KINDS.filter((k) => sources[k].state === "on" && sources[k].unread > sources[k].shown) : [];
    const onKinds = sources ? KINDS.filter((k) => sources[k].state === "on") : [];
    const list = tab === "mine" ? mineListed : listed;

    return (
      <>
        {status === "error" && (
          <div role="alert" className="flex items-center gap-2 border-b border-v2-border bg-v2-danger-bg px-4 py-2 text-v2-caption text-v2-danger">
            <span className="min-w-0 flex-1">{t("Bildirishnomalarni yangilab bo'lmadi")}</span>
            <button type="button" onClick={reload} className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
              {t("Qayta urinish")}
            </button>
          </div>
        )}
        {hidden.map((k) => (
          <div key={k} className="border-b border-v2-border bg-v2-warning-bg px-4 py-2 text-v2-caption text-v2-warning">
            {t("Ko'rilmagan {kind} — {unread}{plus} ta, bu yerda faqat oxirgi {shown} tasi.", {
              kind: t(SOURCE_LABELS[k]),
              unread: sources?.[k].unread ?? 0,
              plus: sources?.[k].capped ? "+" : "",
              shown: sources?.[k].shown ?? 0,
            })}{" "}
            <button type="button" onClick={() => markAllSeen(k)} className="font-semibold underline underline-offset-2 hover:no-underline">
              {t("O'qilgan deb belgilash")}
            </button>
          </div>
        ))}

        {renderPinned()}
        {list.length > 0 && renderGroups(list)}

        {pinned.length === 0 && list.length === 0 &&
          (tab === "mine" ? (
            <EmptyState
              title={t("Sizga tegishli bildirishnoma yo'q")}
              sub={t("Sizga berilgan va siz bergan topshiriqlar shu yerda chiqadi.")}
            />
          ) : onKinds.length === 0 ? (
            <EmptyState title={t("Sizda bildirishnoma manbalari yo'q")} sub={t("To'lov, buyurtma va topshiriq bo'limlariga ruxsatingiz yo'q.")} />
          ) : (
            <EmptyState
              title={t("Hozircha bildirishnoma yo'q")}
              sub={
                <>
                  {t("So'nggi 7 kunda {kinds} yo'q.", { kinds: onKinds.map((k) => t(SOURCE_LABELS[k])).join(", ") })}
                  {sources?.payment.state === "no-cashbox" && <span className="block">{t("Sizga biriktirilgan kassa yo'q.")}</span>}
                </>
              }
            />
          ))}
      </>
    );
  };

  const renderAnnouncements = () => {
    const list = recentAnnouncements(nowMs);
    if (list.length === 0) return <EmptyState title={t("Oxirgi 30 kunda e'lon yo'q")} />;
    return (
      <ul className="divide-y divide-v2-border">
        {list.map((a: Announcement) => {
          const isNew = a.id > annSeenAtOpen;
          const links = (a.links ?? []).filter((l) => isExternal(l.href) || isPathAllowed(l.href, permissions));
          return (
            <li key={a.id} className={`flex items-start gap-3 px-4 py-3 ${isNew ? "bg-v2-brand-bg/40" : ""}`}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
                <Megaphone className="size-[18px]" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-v2-body font-semibold text-v2-text">{t(a.title)}</span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <span className="whitespace-nowrap text-v2-caption text-v2-text-3 tabular-nums">{annDateLabel(a.date, nowMs, t)}</span>
                    {isNew && <span className="size-2 rounded-v2-full bg-v2-brand" role="img" aria-label={t("Yangi")} />}
                  </span>
                </div>
                {/* = ANNOUNCEMENT_SENDER (lib/announcementsV2.ts); literal — i18n skaneri ko'rsin. */}
                <div className="text-v2-caption text-v2-text-3">{t("Tizimli jamoasi")}</div>
                <p className="mt-1 text-v2-small text-v2-text-2">{t(a.body)}</p>
                {(links.length > 0 || a.video) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {links.map((l) =>
                      isExternal(l.href) ? (
                        <a
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-v2-md border border-v2-border-strong px-2.5 text-v2-caption text-v2-text hover:bg-v2-surface-2"
                        >
                          {t(l.label)}
                          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </a>
                      ) : (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={close}
                          className="inline-flex h-7 items-center gap-1 rounded-v2-md border border-v2-border-strong px-2.5 text-v2-caption text-v2-text hover:bg-v2-surface-2"
                        >
                          {t(l.label)}
                          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </Link>
                      ),
                    )}
                    {a.video && (
                      <a
                        href={a.video.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-v2-md bg-v2-brand-bg px-2.5 text-v2-caption text-v2-brand-text hover:brightness-95"
                      >
                        <CirclePlay className="size-3.5" strokeWidth={1.75} aria-hidden />
                        {t(a.video.label)}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onBell}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t("Bildirishnomalar")}
        aria-label={t("Bildirishnomalar")}
        className={`${ICON_BTN} inline-flex ${open ? "bg-v2-surface-2 text-v2-text" : ""}`}
      >
        <Bell className={ICON} strokeWidth={1.75} />
        {everLoaded && unread > 0 && <CountBadge value={badgeLabel(unread, unreadIsFloor)} />}
      </button>

      {open && (
        <div role="dialog" aria-label={t("Bildirishnomalar")} className={`${PANEL} w-[400px]`}>
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <h3 className="text-v2-section text-v2-text">{t("Bildirishnomalar")}</h3>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!anyUnread}
              className="text-v2-small font-medium text-v2-brand-text hover:underline disabled:cursor-default disabled:text-v2-text-3 disabled:no-underline"
            >
              {t("Hammasi o'qildi")}
            </button>
          </div>

          <div role="tablist" aria-label={t("Bildirishnomalar")} className="mt-1 flex gap-1 border-b border-v2-border px-2">
            <TabBtn active={tab === "all"} onClick={() => pickTab("all")}>
              {t("Hammasi")}
              {allCount > 0 && <TabCount value={countLabel(allCount)} active={tab === "all"} />}
            </TabBtn>
            <TabBtn active={tab === "mine"} onClick={() => pickTab("mine")}>
              {t("Menga")}
              {mineCount > 0 && <TabCount value={countLabel(mineCount)} active={tab === "mine"} />}
            </TabBtn>
            <TabBtn active={tab === "announcements"} onClick={() => pickTab("announcements")}>
              {t("E'lonlar")}
              {annUnseen > 0 && <span className="size-1.5 rounded-v2-full bg-v2-danger" role="img" aria-label={t("Yangi")} />}
            </TabBtn>
          </div>

          <div role="tabpanel" className={BODY}>
            {tab === "announcements" ? renderAnnouncements() : renderNotifications()}
          </div>

          <div className="border-t border-v2-border px-4 py-2.5 text-v2-caption text-v2-text-3">
            {tab === "announcements"
              ? `${t("E'lonlarni Tizimli jamoasi yuboradi")} · ${t("Oxirgi 30 kun")}`
              : t("Oxirgi 7 kun")}
          </div>
        </div>
      )}
    </div>
  );
}
