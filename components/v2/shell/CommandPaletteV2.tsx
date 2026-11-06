"use client";

import { useEffect, useId, useMemo, useState, type ComponentType, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Banknote,
  CornerDownLeft,
  FileText,
  ListChecks,
  Megaphone,
  MessageSquareText,
  Moon,
  Receipt,
  Search,
  Sun,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Link from "@/components/ui/Link";
import { useT, type TFn } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { useBranch } from "@/components/shared/BranchContext";
import { isLockedRoute, visibleSidebarItems, type SidebarItem } from "@/components/shared/sidebarModel";
import { openReceipt } from "@/components/v2/finance/ReceiptHost";
import { prefetchCashboxes } from "@/components/v2/finance/cashboxesCache";
import { FAN_BG, FAN_TEXT, fanOf } from "@/components/v2/ui/fan";
import { GROUP_TONE, roomLabel, timeLabel } from "@/components/v2/ui/groupStatus";
import { sameBranchPool } from "@/lib/branchPools";
import { hasSectionPermission, isPathAllowed } from "@/lib/permissions";
import { REPORT_BY_SLUG, canOpenReport } from "@/lib/reportsCatalog";
import {
  SEARCH_MIN,
  dmy,
  groupDigits,
  highlightRanges,
  initialsOf,
  joinList,
  matchScore,
  rankTop,
  splitByRanges,
  waitingParts,
  type GlobalSearchResponse,
  type GroupHit,
  type LeadHit,
  type PaymentHit,
  type Range,
  type SearchKind,
  type StaffHit,
  type StudentHit,
} from "@/lib/globalSearch";
import { useCreate } from "./CreateContext";
import { HOME_KEY, V2_EXTRA_ITEMS, V2_ICONS, V2_ITEM_LABELS, V2_LABELS } from "./sidebarSections";

// «CTRL K QIDIRUV» OYNASI (21-qism · Yuqori panel, rasmlar «Ctrl K qidiruv · Yorug'/Qorong'i»
// va «Qidiruv natijasi «madina»», 02.11.2026).
//
// Faqat oyna: ochiq holat, Ctrl K / ⌘K va yuqori paneldagi soxta qidiruv maydoni —
// TopbarV2 da. Ma'lumot — GET /api/search/global (o'quvchi, lid, guruh, xodim, to'lov;
// har manba o'z sahifasining ruxsati va filial qamrovi bilan, serverda). Sahifalar —
// yon menyu modelidan (components/shared/sidebarModel.ts), ruxsat bo'yicha kesilgan.
// Qidiruv qoidasi (apostrof, kirill/lotin, klaviatura tartibi, bo'yash) — lib/globalSearch.ts.
//
// Bo'sh so'rovda: «Oxirgi qidiruvlar» (shu brauzerda ochilgan yozuvlar, localStorage) va
// «Tezkor amallar». Klaviatura: ↑/↓ — tanlash, Enter — ochish, Tab/Shift+Tab — bo'lim
// (chip), Esc — yopish (ui/Modal).

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

export interface CommandPaletteV2Props {
  open: boolean;
  onClose: () => void;
  /** Rol ruxsatlari — `null` = cheklovsiz (AppShellV2 → TopbarV2 dagi qiymat). */
  permissions: string[] | null;
  isAdmin: boolean;
  /** Modul bayroqlari (AppShellV2 `features`) — gamifikatsiya sahifalari yon menyudagidek. */
  features?: Record<string, boolean>;
  /**
   * «Oxirgi qidiruvlar»ni hisobga ajratish kaliti (masalan foydalanuvchi telefoni — saqlashda
   * xeshlanadi). Berilmasa — shu brauzer uchun bitta ro'yxat.
   */
  recentsKey?: string;
}

/** Oyna yopiq bo'lsa hech narsa chizilmaydi; har ochilishda holat yangidan boshlanadi. */
export default function CommandPaletteV2(props: CommandPaletteV2Props) {
  if (!props.open) return null;
  return <Palette {...props} />;
}

// ── Bo'limlar (chip) ─────────────────────────────────────────────────────────

type ChipKey = "all" | SearchKind | "pages";

const CHIPS: readonly { key: ChipKey; label: string; one: string }[] = [
  { key: "all", label: "Hammasi", one: "" },
  { key: "students", label: "O'quvchilar", one: "o'quvchi" },
  { key: "leads", label: "Lidlar", one: "lid" },
  { key: "groups", label: "Guruhlar", one: "guruh" },
  { key: "staff", label: "Xodimlar", one: "xodim" },
  { key: "payments", label: "To'lovlar", one: "to'lov" },
  { key: "pages", label: "Sahifalar", one: "sahifa" },
];

/** SMS yuborish API'si ochiq bo'limlar — app/(app)/reports/[slug]/page.tsx → SMS_PATHS bilan bir xil. */
const SMS_PATHS = ["/students-list", "/archive-students", "/first-lessons", "/orders-list", "/sales-messages"];

// ── Oxirgi qidiruvlar (localStorage) ─────────────────────────────────────────

const RECENTS_KEY = "v2:cmdk-recents";
const RECENTS_MAX = 6;

type RecentKind = "student" | "lead" | "group" | "staff" | "payment" | "page";
const RECENT_KINDS: ReadonlySet<string> = new Set(["student", "lead", "group", "staff", "payment", "page"]);
const KIND_CHIP: Record<RecentKind, ChipKey> = {
  student: "students",
  lead: "leads",
  group: "groups",
  staff: "staff",
  payment: "payments",
  page: "pages",
};
const KIND_LABEL: Record<RecentKind, string> = {
  student: "O'quvchi",
  lead: "Lid",
  group: "Guruh",
  staff: "Xodim",
  payment: "To'lov",
  page: "Sahifa",
};
/** Yozuvni ochish ruxsati — o'sha sahifaniki (serverdagi manba ruxsati bilan bir xil). */
const KIND_PATH: Record<"student" | "lead" | "group" | "staff", string> = {
  student: "/students-list",
  lead: "/orders-list",
  group: "/groups",
  staff: "/management-xodimlar",
};

interface ReceiptRef {
  entryId: number;
  cashboxId: number;
  cashboxName: string;
  pupilId: number | null;
  own: boolean;
}

interface RecentEntry {
  kind: RecentKind;
  /** Yozuv ID si yoki sahifa manzili. */
  id: string;
  title: string;
  sub: string;
  href?: string;
  receipt?: ReceiptRef;
  /** Guruh ikonkasining fan rangi uchun. */
  course?: string;
  /** Sahifa ikonkasi (yon menyu bo'limi kaliti). */
  iconKey?: string;
  /** Ochilgan paytdagi filial — boshqa filialga o'tilganda yozuv ko'rinmaydi (u yerda ochilmaydi). */
  branchId?: number | null;
  at: number;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isReceipt(v: unknown): v is ReceiptRef {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return isNum(r.entryId) && isNum(r.cashboxId) && typeof r.cashboxName === "string" && (r.pupilId === null || isNum(r.pupilId));
}

function isRecent(v: unknown): v is RecentEntry {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (!RECENT_KINDS.has(String(r.kind)) || typeof r.id !== "string" || typeof r.title !== "string" || typeof r.sub !== "string") return false;
  // Faqat sayt ichidagi manzil — `//host` yoki `https:` emas.
  if (r.href !== undefined && (typeof r.href !== "string" || !r.href.startsWith("/") || r.href.startsWith("//"))) return false;
  if (r.receipt !== undefined && !isReceipt(r.receipt)) return false;
  return true;
}

/** FNV-1a — kalitda xom telefon raqami turmasin. */
function hashKey(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// Har murojaat try/catch ichida: maxfiy oyna, o'chirilgan sayt ma'lumotlari yoki
// cheklangan brauzerda localStorage xato otadi — oyna baribir ishlashi kerak.
function readRecents(key: string): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(key);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isRecent).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

/** Yozuv ro'yxat boshiga (takrori olib tashlanadi), ko'pi bilan RECENTS_MAX ta. */
function withRecent(list: readonly RecentEntry[], entry: Omit<RecentEntry, "at">): RecentEntry[] {
  const rest = list.filter((r) => !(r.kind === entry.kind && r.id === entry.id));
  return [{ ...entry, at: Date.now() }, ...rest].slice(0, RECENTS_MAX);
}

function writeRecents(key: string, list: RecentEntry[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* saqlanmasa ham oyna ishlayveradi */
  }
}

// ── Sahifalar (yon menyu modeli) ─────────────────────────────────────────────

interface PageEntry {
  href: string;
  title: string;
  /** Yon menyudagi bo'lim («Moliya»); bosh sahifada — bo'sh. */
  parent: string;
  iconKey: string;
}

/** Dizayn qoidasi — interfeysda emoji yo'q (SidebarV2 dagi bilan bir xil). */
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").trim();

/** SidebarV2 dagi nomlar bilan: `V2_LABELS`, `V2_ITEM_LABELS`, `V2_EXTRA_ITEMS`; qurilmagan sahifa — yo'q. */
function buildPages(items: SidebarItem[], t: TFn): PageEntry[] {
  const out: PageEntry[] = [];
  const seen = new Set<string>();
  const push = (href: string | undefined, title: string, parent: string, iconKey: string) => {
    if (!href || seen.has(href) || isLockedRoute(href)) return;
    seen.add(href);
    out.push({ href, title, parent, iconKey });
  };
  push("/home", t("Bosh sahifa"), "", HOME_KEY);
  for (const item of items) {
    const parent = noEmoji(t(V2_LABELS[item.key] ?? item.label));
    const subs = item.menu?.items ?? item.menu?.columns?.flatMap((c) => c.items) ?? [];
    const all = subs.length > 0 ? [...(V2_EXTRA_ITEMS[item.key] ?? []), ...subs] : [];
    if (all.length === 0) push(item.href, parent, "", item.key);
    for (const it of all) push(it.href, noEmoji(t(V2_ITEM_LABELS[it.href] ?? it.label)), parent, item.key);
  }
  return out;
}

// ── Qator ko'rinishi ─────────────────────────────────────────────────────────

interface Badge {
  text: string;
  cls: string;
}

interface Row {
  key: string;
  title: string;
  titleRanges?: Range[];
  sub?: string;
  subRanges?: Range[];
  icon: ReactNode;
  badges?: Badge[];
  /** Sahifaga o'tish (Link — sichqonchaning o'rta tugmasi yangi varaqda ochadi). */
  href?: string;
  /** Joyida amal (forma, chek oynasi, tema). */
  run?: () => void;
  /** Ochilganda «Oxirgi qidiruvlar»ga yoziladi. */
  recent?: Omit<RecentEntry, "at">;
  /** Tezkor amal — ikki ustunli katak. */
  tile?: boolean;
  onHover?: () => void;
}

interface Section {
  key: string;
  title: string;
  count?: string;
  rows: Row[];
  /** «Tozalash» tugmasi (oxirgi qidiruvlar). */
  clearable?: boolean;
  grid?: boolean;
}

const BADGE = {
  danger: "bg-v2-danger-bg text-v2-danger",
  warning: "bg-v2-warning-bg text-v2-warning",
  neutral: "bg-v2-surface-2 text-v2-text-2",
  branch: "border border-v2-border text-v2-text-2",
};

/** Lid holati ranglari (design/v2/tokens.css → --color-v2-holat-*). */
const HOLAT_CLS: Record<string, string> = {
  yangi: "bg-v2-holat-yangi-bg text-v2-holat-yangi",
  bog: "bg-v2-holat-bog-bg text-v2-holat-bog",
  sinov: "bg-v2-holat-sinov-bg text-v2-holat-sinov",
  guruh: "bg-v2-holat-guruh-bg text-v2-holat-guruh",
  rad: "bg-v2-holat-rad-bg text-v2-holat-rad",
};

const NEUTRAL_ICON = "bg-v2-surface-2 text-v2-text-2";
const ACTION_ICON = "bg-v2-brand-bg text-v2-brand-text";

function Avatar({ name, brand = false }: { name: string; brand?: boolean }) {
  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-v2-full text-v2-caption font-semibold ${
        brand ? "bg-v2-brand text-v2-on-brand" : "bg-v2-surface-2 text-v2-text-2"
      }`}
    >
      {initialsOf(name)}
    </span>
  );
}

function IconBox({ icon: Icon, cls, small = false }: { icon: IconType; cls: string; small?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-v2-md ${small ? "size-7" : "size-8"} ${cls}`}>
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
}

/** Topilgan qism — `bg-v2-warning-bg` (rasm «Qidiruv natijasi «madina»»). */
function Hl({ text, ranges }: { text: string; ranges?: Range[] }) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  return (
    <>
      {splitByRanges(text, ranges).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[3px] bg-v2-warning-bg text-v2-text">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1 font-v2 text-[10px] font-medium leading-none text-v2-text-2">
      {children}
    </kbd>
  );
}

const join = (parts: (string | false | null | undefined)[]) => parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");

// ── Oyna ─────────────────────────────────────────────────────────────────────

interface Found {
  q: string;
  data: GlobalSearchResponse | null;
  failed: boolean;
}

function Palette({ onClose, permissions, isAdmin, features, recentsKey }: CommandPaletteV2Props) {
  const { t } = useT();
  const router = useRouter();
  const create = useCreate();
  const [isDark, toggleTheme] = useTheme();
  const { branchId } = useBranch();
  const modal = useModalClose(onClose, "center");
  const uid = useId();
  const rowId = (i: number) => `${uid}-row-${i}`;
  const listId = `${uid}-list`;

  const [q, setQ] = useState("");
  const [chip, setChip] = useState<ChipKey>("all");
  const query = q.trim();
  const searching = query.length >= SEARCH_MIN;

  // ── Server: 200 ms kutib, eskirgan javob e'tiborsiz ──
  const [found, setFound] = useState<Found>({ q: "", data: null, failed: false });
  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search/global?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: unknown) => {
          if (cancelled) return;
          const ok = !!d && typeof d === "object" && (d as { ok?: unknown }).ok === true;
          setFound({ q: query, data: ok ? (d as GlobalSearchResponse) : null, failed: !ok });
        })
        .catch(() => {
          if (!cancelled) setFound({ q: query, data: null, failed: true });
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, searching]);

  const fresh = searching && found.q === query;
  // Yangi javob kelguncha oldingisi xiralashib turadi (ro'yxat sakramasin).
  const data = searching ? found.data : null;
  const loading = searching && !fresh;

  // ── Ruxsatlar (serverdagi manba ruxsatlari bilan bir xil) ──
  const can = {
    students: isPathAllowed(KIND_PATH.student, permissions),
    leads: isPathAllowed(KIND_PATH.lead, permissions),
    groups: isPathAllowed(KIND_PATH.group, permissions),
    staff: isPathAllowed(KIND_PATH.staff, permissions),
    payments: isAdmin || isPathAllowed("/finance-transactions", permissions) || isPathAllowed("/finance-cash", permissions),
  };
  const sourceOn = (k: SearchKind) => {
    if (!can[k]) return false;
    const st = data?.results[k].state;
    return st !== "off" && st !== "no-cashbox";
  };
  const chips = CHIPS.filter((c) => c.key === "all" || c.key === "pages" || sourceOn(c.key));
  const activeChip: ChipKey = chips.some((c) => c.key === chip) ? chip : "all";

  // ── Sahifalar ──
  const pages = useMemo(() => buildPages(visibleSidebarItems(permissions, isAdmin, features), t), [permissions, isAdmin, features, t]);
  const pageHits = searching
    ? rankTop(
        pages
          .map((p) => ({ p, s: Math.max(matchScore(p.title, query), matchScore(`${p.parent} ${p.title}`, query) - 10) }))
          .filter((x) => x.s > 0),
        (x) => x.s,
      )
    : { items: [], more: false };

  // ── Oxirgi qidiruvlar ──
  const storageKey = recentsKey ? `${RECENTS_KEY}:${hashKey(recentsKey)}` : RECENTS_KEY;
  const [recents, setRecents] = useState<RecentEntry[]>(() => readRecents(storageKey));
  const pushRecent = (entry: Omit<RecentEntry, "at">) => {
    const next = withRecent(recents, entry);
    writeRecents(storageKey, next);
    setRecents(next);
  };
  const clearRecents = () => {
    writeRecents(storageKey, []);
    setRecents([]);
  };
  const visibleRecents = recents.filter((r) => {
    if (r.kind === "page") return pages.some((p) => p.href === r.href);
    if (r.kind === "payment") return can.payments;
    if (!isPathAllowed(KIND_PATH[r.kind], permissions)) return false;
    return r.branchId == null || branchId == null || sameBranchPool(r.branchId, branchId);
  });

  // ── Amallar ──
  const openPayment = (r: ReceiptRef) => {
    // O'quvchi kesimida — kassa egasi bo'lmagan xodimga ham ochiladi (o'quvchi profilidagidek);
    // aks holda faqat admin yoki kassa egasiga (GET /api/transaction-entries?cashboxId=).
    if (r.pupilId) openReceipt({ entryId: r.entryId, cashboxId: r.cashboxId, cashboxName: r.cashboxName, pupilId: r.pupilId });
    else if (r.own) openReceipt({ entryId: r.entryId, cashboxId: r.cashboxId, cashboxName: r.cashboxName });
    else router.push("/finance-transactions");
  };

  const qarzdorlar = REPORT_BY_SLUG.qarzdorlar;
  const canDebtorSms = !!qarzdorlar && canOpenReport(qarzdorlar, permissions) && SMS_PATHS.some((p) => isPathAllowed(p, permissions));
  const canCash = isPathAllowed("/finance-cash", permissions);

  const quick: Row[] = [];
  if (canCash) {
    quick.push({
      key: "q-payment",
      title: t("To'lov qabul qilish"),
      icon: <IconBox icon={Wallet} cls={ACTION_ICON} small />,
      run: () => create.open("payment"),
      onHover: prefetchCashboxes,
      tile: true,
    });
  }
  if (isPathAllowed("/orders-list", permissions)) {
    quick.push({ key: "q-lead", title: t("Lid qo'shish"), icon: <IconBox icon={UserPlus} cls={ACTION_ICON} small />, href: "/orders-list?add=1", tile: true });
  }
  if (canCash) {
    quick.push({
      key: "q-cash",
      title: t("Kassa amali"),
      icon: <IconBox icon={ArrowLeftRight} cls={ACTION_ICON} small />,
      run: () => create.open("cash"),
      onHover: prefetchCashboxes,
      tile: true,
    });
  }
  // Topshiriq BERISH — bo'lim ruxsatining o'zi (rahbar rejimi), sahifaga kirish emas (TopbarV2 → `manage`).
  if (hasSectionPermission("/tasks", permissions)) {
    quick.push({ key: "q-task", title: t("Topshiriq berish"), icon: <IconBox icon={ListChecks} cls={ACTION_ICON} small />, href: "/tasks?new=1", tile: true });
  }
  if (canDebtorSms) {
    quick.push({
      key: "q-sms",
      title: t("Qarzdorlarga SMS"),
      icon: <IconBox icon={MessageSquareText} cls={ACTION_ICON} small />,
      href: "/reports/qarzdorlar",
      tile: true,
    });
  }
  quick.push({
    key: "q-theme",
    title: isDark ? t("Yorug' temaga o'tish") : t("Qorong'i temaga o'tish"),
    icon: <IconBox icon={isDark ? Sun : Moon} cls={ACTION_ICON} small />,
    run: toggleTheme,
    tile: true,
  });

  // ── Qatorlar ──
  const digitQuery = /^[\d\s()+\-#№]+$/.test(query);
  const hl = (text: string) => (searching ? highlightRanges(text, query) : undefined);
  const hlSub = (text: string) => (searching && digitQuery ? highlightRanges(text, query) : undefined);

  const studentRow = (h: StudentHit): Row => {
    const href = `/student-edit/${h.id}?src=list`;
    const sub = join([h.category, h.phone]);
    const badges: Badge[] = [];
    if (h.debt > 0) badges.push({ text: t("Qarz {sum}", { sum: groupDigits(h.debt) }), cls: BADGE.danger });
    if (h.status && h.status !== "Aktiv") badges.push({ text: t(h.status), cls: BADGE.neutral });
    if (h.branch) badges.push({ text: h.branch, cls: BADGE.branch });
    return {
      key: `s-${h.id}`,
      title: h.name,
      titleRanges: hl(h.name),
      sub,
      subRanges: hlSub(sub),
      icon: <Avatar name={h.name} />,
      badges,
      href,
      recent: { kind: "student", id: String(h.id), title: h.name, sub, href, branchId },
    };
  };

  const leadRow = (h: LeadHit): Row => {
    const href = `/orders-list/${h.id}`;
    const sub = join([h.course, h.source, h.phone]);
    const badges: Badge[] = [];
    if (h.waitingMinutes !== null) {
      const w = waitingParts(h.waitingMinutes);
      const text =
        w.unit === "min"
          ? t("{n} daqiqa kutmoqda", { n: w.n })
          : w.unit === "hour"
            ? t("{n} soat kutmoqda", { n: w.n })
            : t("{n} kun kutmoqda", { n: w.n });
      badges.push({ text, cls: BADGE.warning });
    }
    if (h.branch) badges.push({ text: h.branch, cls: BADGE.branch });
    return {
      key: `l-${h.id}`,
      title: h.name,
      titleRanges: hl(h.name),
      sub,
      subRanges: hlSub(sub),
      icon: <IconBox icon={Megaphone} cls={HOLAT_CLS[h.holat] ?? HOLAT_CLS.yangi} />,
      badges,
      href,
      recent: { kind: "lead", id: String(h.id), title: h.name, sub, href, branchId },
    };
  };

  const groupIcon = (course: string) => {
    const fan = fanOf(course);
    return <IconBox icon={Users} cls={`${FAN_BG[fan]} ${FAN_TEXT[fan]}`} />;
  };

  const groupRow = (h: GroupHit): Row => {
    const href = `/groups/${h.id}`;
    const start = timeLabel(h.time).split("–")[0];
    const sub = join([h.teacher, start, roomLabel(h.room), t("{n} o'quvchi", { n: h.students })]);
    const badges: Badge[] = [];
    const tone = h.status !== "active" ? GROUP_TONE[h.status] : undefined;
    if (tone) badges.push({ text: t(tone.label), cls: tone.badge });
    if (h.branch) badges.push({ text: h.branch, cls: BADGE.branch });
    return {
      key: `g-${h.id}`,
      title: h.label,
      titleRanges: hl(h.label),
      sub,
      subRanges: hlSub(sub),
      icon: groupIcon(h.course),
      badges,
      href,
      recent: { kind: "group", id: String(h.id), title: h.label, sub, href, course: h.course, branchId },
    };
  };

  const staffRow = (h: StaffHit): Row => {
    const href = `/management-xodimlar/${h.id}`;
    // Lavozim — «O'qituvchi» kabi yorliq (o'giriladi) yoki Rollar'dagi nom (lug'atda yo'q — o'zgarmaydi).
    const sub = join([t(h.position), h.groups > 0 && t("{n} guruh", { n: h.groups }), h.branches.join(", ")]);
    return {
      key: `x-${h.id}`,
      title: h.name,
      titleRanges: hl(h.name),
      sub,
      icon: <Avatar name={h.name} brand />,
      badges: h.archived ? [{ text: t("Arxiv"), cls: BADGE.neutral }] : [],
      href,
      recent: { kind: "staff", id: String(h.id), title: h.name, sub, href, branchId },
    };
  };

  const paymentRow = (h: PaymentHit): Row => {
    const receipt: ReceiptRef = { entryId: h.id, cashboxId: h.cashboxId, cashboxName: h.cashboxName, pupilId: h.pupilId, own: h.own };
    const title = h.payer || t("Chek №{id}", { id: h.id });
    const sub = join([t("Chek №{id}", { id: h.id }), `${groupDigits(h.amount)} ${t("so'm")}`, dmy(h.date), h.cashboxName]);
    return {
      key: `p-${h.id}`,
      title,
      titleRanges: hl(title),
      sub,
      subRanges: hlSub(sub),
      icon: <IconBox icon={Receipt} cls="bg-v2-success-bg text-v2-success" />,
      badges: h.cancelled ? [{ text: t("Bekor qilingan"), cls: BADGE.danger }] : [],
      run: () => openPayment(receipt),
      recent: { kind: "payment", id: String(h.id), title, sub, receipt },
    };
  };

  const pageRow = (p: PageEntry): Row => ({
    key: `pg-${p.href}`,
    title: p.title,
    titleRanges: hl(p.title),
    sub: p.parent,
    icon: <IconBox icon={V2_ICONS[p.iconKey] ?? FileText} cls={NEUTRAL_ICON} />,
    href: p.href,
    recent: { kind: "page", id: p.href, title: p.title, sub: p.parent, href: p.href, iconKey: p.iconKey },
  });

  const recentRow = (r: RecentEntry): Row => {
    const sub = join([t(KIND_LABEL[r.kind]), r.sub]);
    let icon: ReactNode;
    if (r.kind === "student") icon = <Avatar name={r.title} />;
    else if (r.kind === "staff") icon = <Avatar name={r.title} brand />;
    else if (r.kind === "group") icon = groupIcon(r.course ?? "");
    else if (r.kind === "lead") icon = <IconBox icon={Megaphone} cls={HOLAT_CLS.yangi} />;
    else if (r.kind === "payment") icon = <IconBox icon={Receipt} cls="bg-v2-success-bg text-v2-success" />;
    else icon = <IconBox icon={V2_ICONS[r.iconKey ?? ""] ?? FileText} cls={NEUTRAL_ICON} />;
    const receipt = r.receipt;
    return {
      key: `r-${r.kind}-${r.id}`,
      title: r.title,
      sub,
      icon,
      href: receipt ? undefined : r.href,
      run: receipt ? () => openPayment(receipt) : undefined,
      recent: {
        kind: r.kind,
        id: r.id,
        title: r.title,
        sub: r.sub,
        href: r.href,
        receipt,
        course: r.course,
        iconKey: r.iconKey,
        branchId: r.branchId,
      },
    };
  };

  // ── Ko'rinish: bo'limlar, sanoqlar, «… topilmadi» ──
  const sections: Section[] = [];
  const counts: Partial<Record<ChipKey, string>> = {};
  let total = 0;
  let anyMore = false;
  const missing: string[] = [];

  if (!searching) {
    if (activeChip === "pages") {
      sections.push({ key: "pages", title: t("Sahifalar"), count: String(pages.length), rows: pages.map(pageRow) });
    } else {
      const list = visibleRecents.filter((r) => activeChip === "all" || KIND_CHIP[r.kind] === activeChip);
      if (list.length > 0) sections.push({ key: "recent", title: t("Oxirgi qidiruvlar"), rows: list.map(recentRow), clearable: true });
      if (activeChip === "all" && quick.length > 0) sections.push({ key: "quick", title: t("Tezkor amallar"), rows: quick, grid: true });
    }
  } else {
    const res = data?.results;
    const entity: { key: SearchKind; title: string; rows: Row[]; more: boolean }[] = res
      ? [
          { key: "students", title: t("O'quvchilar"), rows: res.students.items.map(studentRow), more: res.students.more },
          { key: "leads", title: t("Lidlar"), rows: res.leads.items.map(leadRow), more: res.leads.more },
          { key: "groups", title: t("Guruhlar"), rows: res.groups.items.map(groupRow), more: res.groups.more },
          { key: "staff", title: t("Xodimlar"), rows: res.staff.items.map(staffRow), more: res.staff.more },
          { key: "payments", title: t("To'lovlar"), rows: res.payments.items.map(paymentRow), more: res.payments.more },
        ]
      : [];
    const pageRows = pageHits.items.map((x) => pageRow(x.p));

    for (const s of entity) {
      if (!sourceOn(s.key)) continue;
      counts[s.key] = `${s.rows.length}${s.more ? "+" : ""}`;
      total += s.rows.length;
      anyMore ||= s.more;
      if (s.rows.length === 0 && data?.results[s.key].state === "on") missing.push(t(CHIPS.find((c) => c.key === s.key)?.one ?? ""));
    }
    counts.pages = `${pageRows.length}${pageHits.more ? "+" : ""}`;
    total += pageRows.length;
    anyMore ||= pageHits.more;
    if (pageRows.length === 0) missing.push(t("sahifa"));
    counts.all = `${total}${anyMore ? "+" : ""}`;

    // Amallar — topilgan birinchi xodimdan va so'rovga mos tezkor amallardan.
    const actions: Row[] = [];
    const topStaff = res?.staff.items[0];
    if (topStaff && fresh) {
      if (isPathAllowed("/finance-payroll", permissions)) {
        const title = t("{name} — oylik va avans", { name: topStaff.name });
        actions.push({ key: "a-salary", title, titleRanges: hl(title), icon: <IconBox icon={Banknote} cls={ACTION_ICON} />, href: "/finance-payroll" });
      }
      if (!topStaff.archived && hasSectionPermission("/tasks", permissions)) {
        const title = t("{name}ga topshiriq berish", { name: topStaff.name });
        actions.push({
          key: "a-task",
          title,
          titleRanges: hl(title),
          icon: <IconBox icon={ListChecks} cls={ACTION_ICON} />,
          href: `/tasks?new=1&employee=${topStaff.id}`,
        });
      }
    }
    for (const a of quick) {
      if (matchScore(a.title, query) >= 60) actions.push({ ...a, key: `a-${a.key}`, tile: false, titleRanges: hl(a.title), icon: a.icon });
    }

    const show = (key: ChipKey) => activeChip === "all" || activeChip === key;
    for (const s of entity) {
      if (s.rows.length > 0 && show(s.key)) sections.push({ key: s.key, title: s.title, count: counts[s.key], rows: s.rows });
    }
    if (pageRows.length > 0 && show("pages")) sections.push({ key: "pages", title: t("Sahifalar"), count: counts.pages, rows: pageRows });
    if (actions.length > 0 && activeChip === "all") sections.push({ key: "actions", title: t("Amallar"), count: String(actions.length), rows: actions });
  }

  const flat = sections.flatMap((s) => s.rows);
  const firstIndex = new Map<string, number>();
  {
    let i = 0;
    for (const s of sections) {
      firstIndex.set(s.key, i);
      i += s.rows.length;
    }
  }

  // Tanlangan qator — ko'rinish (so'rov, chip, javob) almashsa birinchisiga qaytadi.
  const viewKey = `${query}\u0000${activeChip}\u0000${fresh ? "1" : "0"}\u0000${flat.length}`;
  const [act, setAct] = useState<{ key: string; i: number }>({ key: "", i: 0 });
  const activeIndex = flat.length === 0 ? -1 : act.key === viewKey ? Math.min(act.i, flat.length - 1) : 0;
  const setActive = (i: number) => setAct({ key: viewKey, i });

  const scrollToRow = (i: number) => {
    window.requestAnimationFrame(() => document.getElementById(rowId(i))?.scrollIntoView({ block: "nearest" }));
  };

  const activate = (row: Row) => {
    if (row.recent) pushRecent(row.recent);
    if (row.run) {
      // Oyna DARHOL yopiladi: ui/Modal yopilganda fokusni avvalgi joyga qaytaradi — keyin
      // ochiladigan forma (To'lov, Kassa amali) fokusini tortib olmasin.
      const run = row.run;
      onClose();
      window.setTimeout(run, 0);
      return;
    }
    if (row.href) router.push(row.href);
    modal.close();
  };

  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>, row: Row) => {
    // Ctrl/⌘/Shift bilan — yangi varaq: oyna ochiq qoladi.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (row.recent) pushRecent(row.recent);
    modal.close();
  };

  /** Qidiruvda natijasi 0 bo'lgan bo'lim — chipi yashirin, Tab ham o'tkazib yuboradi. */
  const emptyChip = (key: ChipKey) => key !== "all" && fresh && counts[key] === "0";

  const cycleChip = (dir: 1 | -1) => {
    const keys = chips.filter((c) => !emptyChip(c.key)).map((c) => c.key);
    const at = keys.indexOf(activeChip);
    setChip(keys[(at + dir + keys.length) % keys.length]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      const next = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + flat.length) % flat.length;
      setActive(next);
      scrollToRow(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = activeIndex >= 0 ? flat[activeIndex] : undefined;
      if (row) activate(row);
    } else if (e.key === "Tab") {
      e.preventDefault();
      cycleChip(e.shiftKey ? -1 : 1);
    }
  };

  // ── Pastki satr va sarlavha matnlari ──
  const scopeName = data?.scope.branchName || t("joriy filial");
  const footerRight = !searching
    ? t("Telefon yoki chek raqami bilan ham topiladi")
    : fresh
      ? t("{n} ta natija · {scope}", { n: `${total}${anyMore ? "+" : ""}`, scope: scopeName })
      : t("Qidirilmoqda…");
  const nothing = searching && fresh && !found.failed && total === 0;
  const missingList = joinList(missing, t("va"));
  // «Lid, to'lov va sahifa topilmadi» — faqat nimadir topilganda (hech narsa bo'lmasa — o'rtadagi matn).
  const missingText =
    searching && fresh && !found.failed && total > 0 && missing.length > 0
      ? t("{list} topilmadi", { list: missingList.charAt(0).toUpperCase() + missingList.slice(1) })
      : "";

  const renderRow = (row: Row, index: number) => {
    const active = index === activeIndex;
    const common = {
      id: rowId(index),
      role: "option" as const,
      "aria-selected": active,
      // Fokus qidiruv maydonida qoladi — klaviatura bilan davom etish mumkin.
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
      onMouseMove: () => {
        if (!active) setActive(index);
      },
      onPointerEnter: row.onHover,
    };
    if (row.tile) {
      return (
        <button
          key={row.key}
          type="button"
          {...common}
          onClick={() => activate(row)}
          className={`flex h-11 min-w-0 items-center gap-2.5 rounded-v2-md border px-2.5 text-left text-v2-body transition-colors ${
            active ? "border-v2-border-strong bg-v2-hover" : "border-v2-border hover:bg-v2-hover"
          }`}
        >
          {row.icon}
          <span className="min-w-0 flex-1 truncate font-medium text-v2-text">{row.title}</span>
        </button>
      );
    }
    const inner = (
      <>
        {row.icon}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-v2-body font-medium text-v2-text">
              <Hl text={row.title} ranges={row.titleRanges} />
            </span>
            {row.badges?.map((b) => (
              <span key={b.text} className={`shrink-0 rounded-v2-full px-1.5 py-px text-[11px] font-medium leading-4 ${b.cls}`}>
                {b.text}
              </span>
            ))}
          </span>
          {row.sub && (
            <span className="block truncate text-v2-caption text-v2-text-3">
              <Hl text={row.sub} ranges={row.subRanges} />
            </span>
          )}
        </span>
        {active && (
          <span className="hidden shrink-0 items-center gap-1 text-v2-caption text-v2-text-3 sm:inline-flex">
            {t("ochish")}
            <CornerDownLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
          </span>
        )}
      </>
    );
    const cls = `flex w-full min-w-0 items-center gap-3 rounded-v2-md px-2.5 py-2 text-left transition-colors ${active ? "bg-v2-hover" : ""}`;
    if (row.href && !row.run) {
      return (
        <Link key={row.key} href={row.href} {...common} onClick={(e) => onLinkClick(e, row)} className={cls}>
          {inner}
        </Link>
      );
    }
    return (
      <button key={row.key} type="button" {...common} onClick={() => activate(row)} className={cls}>
        {inner}
      </button>
    );
  };

  return (
    <Modal
      onClose={onClose}
      controller={modal}
      bare
      variant="center"
      size="2xl"
      zIndex={130}
      // Tepada (Ctrl K oynalari odatiy joyi); telefonda — ekran eni, yuqoridan.
      containerClassName="items-start! pt-[12vh]! max-sm:px-2! max-sm:pt-2!"
      panelStyle={{ maxWidth: 640 }}
      panelClassName="bg-transparent! border-0! shadow-none! rounded-none! overflow-hidden! max-sm:max-w-none!"
    >
      <div
        data-ui="v2"
        className="flex max-h-[min(640px,76vh)] min-h-0 flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface font-v2 text-v2-text shadow-v2-md max-sm:max-h-[85dvh]"
      >
        {/* Qidiruv maydoni */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-v2-border px-4">
          <Search className="size-5 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            type="text"
            autoFocus
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("Ism, telefon, guruh yoki amal...")}
            aria-label={t("Qidirish")}
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
            autoComplete="off"
            spellCheck={false}
            // `!` — eski globals.css dagi `input:focus { background: … !important }` ni bosadi.
            className="h-full min-w-0 flex-1 bg-transparent! text-[15px] text-v2-text outline-none placeholder:text-v2-text-3"
          />
          {q && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setQ("")}
              title={t("Tozalash")}
              aria-label={t("Tozalash")}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-v2-full text-v2-text-3 hover:bg-v2-hover hover:text-v2-text"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          )}
          <span className="hidden shrink-0 sm:inline-flex">
            <Kbd>Esc</Kbd>
          </span>
          <button
            type="button"
            onClick={modal.close}
            className="shrink-0 text-v2-body font-medium text-v2-brand-text sm:hidden"
          >
            {t("Yopish")}
          </button>
        </div>

        {/* Bo'limlar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-v2-border px-3 py-2">
          {/* O'ngdagi so'nish — sig'magan chip qirqilgandek emas, «davomi bor» bo'lib ko'rinsin. */}
          <div
            role="tablist"
            aria-label={t("Bo'limlar")}
            className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none]"
          >
            {chips.map((c) => {
              const on = c.key === activeChip;
              const count = searching && fresh ? counts[c.key] : undefined;
              // Qidiruvda hech narsa topmagan bo'lim chipi yashiriladi — u o'ngdagi «… topilmadi» da aytilgan.
              if (!on && emptyChip(c.key)) return null;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setChip(c.key)}
                  className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-v2-full border px-2.5 text-v2-caption font-medium transition-colors ${
                    on ? "border-transparent bg-v2-brand text-v2-on-brand" : "border-v2-border text-v2-text-2 hover:bg-v2-hover hover:text-v2-text"
                  }`}
                >
                  {t(c.label)}
                  {count !== undefined && <span className={`tabular-nums ${on ? "opacity-80" : "text-v2-text-3"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
          {missingText && <span className="hidden max-w-[45%] shrink truncate text-v2-caption text-v2-text-3 md:block">{missingText}</span>}
        </div>

        {/* Natijalar */}
        <div id={listId} role="listbox" aria-label={t("Natijalar")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {searching && loading && !data && (
            // Birinchi javob kelguncha — skelet (dizayn qoidasi: «Yuklanmoqda...» matni o'rniga).
            <div className="space-y-1 p-1" aria-label={t("Yuklanmoqda")}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-1.5 py-1.5">
                  <span className="size-8 shrink-0 rounded-v2-full bg-v2-skeleton" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-3 w-2/5 rounded-v2-sm bg-v2-skeleton" />
                    <span className="block h-2.5 w-1/4 rounded-v2-sm bg-v2-skeleton" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {searching && fresh && found.failed && (
            <div className="px-3 py-3 text-v2-body text-v2-danger">{t("Qidiruvda xato. Qayta urinib ko'ring.")}</div>
          )}

          {nothing ? (
            <div className="px-4 py-10 text-center">
              <div className="text-v2-body font-medium text-v2-text">{t("«{q}» bo'yicha hech narsa topilmadi", { q: query })}</div>
              <div className="mt-1 text-v2-caption text-v2-text-3">{t("Ism, telefon, guruh raqami yoki chek raqamini yozing")}</div>
            </div>
          ) : searching && fresh && !found.failed && flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-v2-body text-v2-text-2">{t("Natija topilmadi")}</div>
          ) : (
            <div className={loading && data ? "opacity-60 transition-opacity" : undefined}>
              {sections.map((s) => {
                const start = firstIndex.get(s.key) ?? 0;
                return (
                  <div key={s.key} role="group" aria-label={s.title} className="pb-1">
                    <div className="flex items-center justify-between px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-v2-text-3">
                      <span>{s.title}</span>
                      {s.clearable ? (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={clearRecents}
                          className="rounded-v2-sm px-1 text-[11px] font-medium normal-case tracking-normal text-v2-brand-text hover:underline"
                        >
                          {t("Tozalash")}
                        </button>
                      ) : (
                        s.count !== undefined && <span className="tabular-nums">{s.count}</span>
                      )}
                    </div>
                    {s.grid ? (
                      <div className="grid grid-cols-1 gap-1.5 px-0.5 pb-1 sm:grid-cols-2">{s.rows.map((r, i) => renderRow(r, start + i))}</div>
                    ) : (
                      <div className="space-y-px">{s.rows.map((r, i) => renderRow(r, start + i))}</div>
                    )}
                  </div>
                );
              })}
              {!searching && sections.length === 0 && (
                <div className="px-4 py-8 text-center text-v2-body text-v2-text-2">{t("Ism, telefon, guruh raqami yoki chek raqamini yozing")}</div>
              )}
            </div>
          )}
        </div>

        {/* Pastki satr */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-v2-border px-4 py-2 text-v2-caption text-v2-text-3">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Kbd>↑↓</Kbd> {t("tanlash")}
            <span aria-hidden>·</span>
            <Kbd>↵</Kbd> {t("ochish")}
            <span aria-hidden>·</span>
            <Kbd>Tab</Kbd> {t("bo'lim")}
          </span>
          <span className="min-w-0 truncate sm:text-right">{footerRight}</span>
        </div>
      </div>
    </Modal>
  );
}
