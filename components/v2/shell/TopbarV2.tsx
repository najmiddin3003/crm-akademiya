"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Cake,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  LogOut,
  Lock,
  Menu,
  Monitor,
  Moon,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import AssistantPanel from "@/components/ai/AssistantPanel";
import type { Box } from "@/components/ai/genie";
import { useAiAlerts } from "@/components/ai/useAiAlerts";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";
import { useLang, useT } from "@/components/shared/Language";
import { QUICK_LINKS } from "@/components/shared/Navbar";
import NotificationsPanel from "@/components/shared/NotificationsPanel";
import { useNotifications } from "@/components/shared/NotificationsProvider";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { useTheme } from "@/components/shared/Theme";
import { HELP_TOPICS } from "@/constants/helpTopics";
import { ASSISTANT_NAME } from "@/lib/ai/brand";
import { LANGS as LANG_CODES } from "@/lib/i18n";
import { LANGS as LANGUAGES } from "@/lib/navbar";
import { badgeLabel } from "@/lib/notifications";
import { isPathAllowed } from "@/lib/permissions";
import { searchAll } from "@/lib/search";
import type { StudentRow } from "@/lib/studentsData";
import { switchUiVersion } from "@/lib/uiVersion";
import { usePopover } from "./usePopover";

// YANGI VERSIYA YUQORI PANELI (design/v2/DESIGN.md → «Navigatsiya — yuqori panel»).
//
// Chapda global qidiruv; o'ngda «+ Yangi», MohirAI, tug'ilgan kunlar,
// topshiriqlarim, bildirishnomalar, yordam va profil. Eski paneldan farqi:
// filial tanlovi yon menyuga ko'chgan, «Orqaga» yo'q, til va kun/tun rejimi
// profil menyusida, MohirAI suzuvchi robot o'rniga shu yerdagi tugmadan
// ochiladi (design/v2/SAVOLLAR.md 18–21). Ma'lumot manbalari eski panel
// bilan bir xil (provayderlar AppShellV2 da).

/** Yuqori panelga kerak foydalanuvchi ma'lumoti (app/(app)/layout.tsx dan). */
export interface ShellUserV2 {
  fullName: string;
  phone: string;
  /** Lavozim — ism ostida (lib/uiVersionServer.ts → shellRoleLabel). */
  roleLabel: string;
}

export interface TopbarV2Props {
  user: ShellUserV2 | null;
  permissions: string[] | null;
  isAdmin: boolean;
  /** Kompyuterda yon menyu yig'ilganmi — unda shu yerda ochish tugmasi chiqadi. */
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  /** Telefonda chekma menyuni ochish. */
  onOpenMenu: () => void;
}

const ICON_BTN =
  "relative size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text";
const ICON = "size-5";
/** Ochiladigan panel. Telefonda ekran kengligida (tugma chetga yaqin bo'lmasa chapdan chiqib ketardi). */
const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";
const MENU_ITEM =
  "flex w-full items-center gap-3 rounded-v2-md px-2.5 py-2 text-left text-v2-body text-v2-text transition-colors hover:bg-v2-hover";

const QUICK_ICONS: Record<string, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/orders-list": UserPlus,
  "/finance-cash": Wallet,
};

/** Ism-familiyaning bosh harflari: «Asadbek Karimov» → «AK». */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
  return letters || "?";
}

function CountBadge({ value, tone }: { value: string | number; tone: "danger" | "success" }) {
  return (
    <span
      className={`pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-v2-full px-1 text-[10px] font-semibold leading-none tabular-nums ring-2 ring-v2-surface ${
        tone === "danger" ? "bg-v2-danger text-v2-on-danger" : "bg-v2-success text-v2-on-color"
      }`}
    >
      {value}
    </span>
  );
}

export default function TopbarV2({ user, permissions, isAdmin, sidebarCollapsed, onExpandSidebar, onOpenMenu }: TopbarV2Props) {
  const { t } = useT();
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();

  const { open: createOpen, ref: createWrapRef, toggle: toggleCreate, close: closeCreate } = usePopover();
  const { open: notifOpen, ref: notifWrapRef, toggle: toggleNotif, close: closeNotif } = usePopover();
  const { open: helpOpen, ref: helpWrapRef, toggle: toggleHelp, close: closeHelp } = usePopover();
  const { open: profileOpen, ref: profileWrapRef, toggle: toggleProfile, close: closeProfile } = usePopover();

  const quickLinks = QUICK_LINKS.filter((l) => isPathAllowed(l.href, permissions));

  const displayName = user?.fullName?.trim() || "—";
  const displayPhone = user?.phone ? formatPhoneDisplay(user.phone) : "";
  const initials = initialsOf(user?.fullName ?? "");

  // Bildirishnomalar va topshiriqlar — eski panel bilan BIR manba. Nishon
  // yuklanguncha chizilmaydi: noma'lum son nol emas.
  const { unread, unreadIsFloor, everLoaded } = useNotifications();
  const inbox = useTaskInbox();
  const inboxPending = inbox.everLoaded ? inbox.pending.length : 0;
  const inboxReports = inbox.everLoaded ? inbox.reports.length : 0;
  const inboxCount = inboxPending + inboxReports;
  const inboxTitle =
    inboxPending > 0
      ? t("Topshiriq bajarilishi kutilmoqda")
      : inboxReports > 0
        ? t("Topshiriq bo'yicha hisobot keldi")
        : t("Mening topshiriqlarim");

  // MohirAI — suzuvchi robot o'rniga (eski versiyada components/tezlik/SpeedFab.tsx).
  // Oyna shu tugmadan «genie» bo'lib chiqadi va yopilganda unga qaytadi.
  const alerts = useAiAlerts(isAdmin);
  const aiBtnRef = useRef<HTMLButtonElement>(null);
  const [ai, setAi] = useState<{ origin: Box | null } | null>(null);
  const openAi = () => {
    const r = aiBtnRef.current?.getBoundingClientRect();
    setAi({ origin: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null });
  };

  // Profil amallari — eski Navbar'dagi bilan bir xil.
  const onProfileAction = async (kind: "devices" | "lock" | "logout") => {
    closeProfile();
    if (kind === "devices") {
      router.push("/settings-devices");
      return;
    }
    if (kind === "lock") {
      await fetch("/api/auth/lock", { method: "POST" }).catch(() => {});
      router.replace("/lock");
      router.refresh();
      return;
    }
    if (!confirm(t("Tizimdan chiqishni xohlaysizmi?"))) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  return (
    <header
      data-ui="v2"
      // `non-fullscreen` — dars jadvalining to'liq ekran rejimida yashirinadi (globals.css).
      className="non-fullscreen relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-v2-border bg-v2-surface px-3 font-v2 text-v2-text sm:gap-3 sm:px-4 lg:px-6"
    >
      <button type="button" onClick={onOpenMenu} title={t("Menyu")} aria-label={t("Menyu")} className={`${ICON_BTN} inline-flex lg:hidden`}>
        <Menu className={ICON} strokeWidth={1.75} />
      </button>
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={onExpandSidebar}
          title={t("Menyuni ochish")}
          aria-label={t("Menyuni ochish")}
          className={`${ICON_BTN} hidden lg:inline-flex`}
        >
          <PanelLeftOpen className={ICON} strokeWidth={1.75} />
        </button>
      )}

      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* «+ Yangi» — tezkor yaratish (eski paneldagi «Tezkor amallar»). */}
        {quickLinks.length > 0 && (
          <div ref={createWrapRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={toggleCreate}
              aria-haspopup="menu"
              aria-expanded={createOpen}
              title={t("Yangi")}
              className="inline-flex h-9 items-center gap-1.5 rounded-v2-md border border-v2-border-strong bg-v2-surface px-2.5 text-v2-body font-medium text-v2-text transition-colors hover:bg-v2-surface-2 xl:px-3"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              <span className="hidden xl:inline">{t("Yangi")}</span>
              <ChevronDown className="hidden size-4 text-v2-text-3 xl:block" strokeWidth={1.75} aria-hidden />
            </button>
            {createOpen && (
              <div role="menu" className={`${PANEL} w-64 p-1`}>
                {quickLinks.map((l) => {
                  const Icon = QUICK_ICONS[l.href.split("?")[0]] ?? Plus;
                  return (
                    <Link key={l.href} href={l.href} role="menuitem" onClick={closeCreate} className={MENU_ITEM}>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-brand-text">
                        <Icon className="size-4" strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">{t(l.label)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MohirAI — «yumshoq» brend tugma. */}
        <button
          ref={aiBtnRef}
          type="button"
          onClick={openAi}
          title={t("{name} — AI yordamchi", { name: ASSISTANT_NAME })}
          aria-label={t("{name} — AI yordamchi", { name: ASSISTANT_NAME })}
          className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-md bg-v2-brand-bg px-2.5 text-v2-body font-medium text-v2-brand-text transition-colors hover:brightness-95 xl:px-3"
        >
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="hidden xl:inline">{ASSISTANT_NAME}</span>
          {isAdmin && alerts.unseen > 0 && <CountBadge value={alerts.unseen > 9 ? "9+" : alerts.unseen} tone="danger" />}
        </button>

        <span className="mx-0.5 hidden h-6 w-px bg-v2-border md:block" aria-hidden />

        <Link href="/birthdays" title={t("Tug'ilgan kunlar")} aria-label={t("Tug'ilgan kunlar")} className={`${ICON_BTN} hidden md:inline-flex`}>
          <Cake className={ICON} strokeWidth={1.75} />
        </Link>

        {/* Mening topshiriqlarim — modal (components/shared/TaskInboxModal.tsx). */}
        <button type="button" onClick={inbox.openModal} title={inboxTitle} aria-label={inboxTitle} className={`${ICON_BTN} inline-flex`}>
          <ClipboardCheck className={ICON} strokeWidth={1.75} />
          {inboxCount > 0 && <CountBadge value={inboxCount > 99 ? "99+" : inboxCount} tone={inboxPending > 0 ? "danger" : "success"} />}
        </button>

        {/* Bildirishnomalar */}
        <div ref={notifWrapRef} className="relative">
          <button
            type="button"
            onClick={toggleNotif}
            aria-expanded={notifOpen}
            title={t("Bildirishnomalar")}
            aria-label={t("Bildirishnomalar")}
            className={`${ICON_BTN} inline-flex ${notifOpen ? "bg-v2-surface-2 text-v2-text" : ""}`}
          >
            <Bell className={ICON} strokeWidth={1.75} />
            {everLoaded && unread > 0 && <CountBadge value={badgeLabel(unread, unreadIsFloor)} tone="danger" />}
          </button>
          {notifOpen && (
            <div className={`${PANEL} w-[400px]`}>
              <div className="flex items-center justify-between border-b border-v2-border px-4 py-3">
                <h3 className="text-v2-section text-v2-text">{t("Bildirishnomalar")}</h3>
              </div>
              <NotificationsPanel variant="dropdown" open={notifOpen} onNavigate={closeNotif} />
            </div>
          )}
        </div>

        {/* Yordam — video qo'llanmalar ro'yxati (eski «Qanday ishlaydi?»). */}
        <div ref={helpWrapRef} className="relative hidden md:block">
          <button
            type="button"
            onClick={toggleHelp}
            aria-expanded={helpOpen}
            title={t("Qanday ishlaydi?")}
            aria-label={t("Qanday ishlaydi?")}
            className={`${ICON_BTN} inline-flex ${helpOpen ? "bg-v2-surface-2 text-v2-text" : ""}`}
          >
            <CircleHelp className={ICON} strokeWidth={1.75} />
          </button>
          {helpOpen && (
            <div className={`${PANEL} w-[380px]`}>
              <div className="border-b border-v2-border px-4 py-3">
                <h3 className="text-v2-section text-v2-text">{t("Qanday ishlaydi?")}</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-1">
                {HELP_TOPICS.map((topic, i) =>
                  topic.url ? (
                    <a key={i} href={topic.url} target="_blank" rel="noopener noreferrer" onClick={closeHelp} className={`${MENU_ITEM} items-start`}>
                      {t(topic.title)}
                    </a>
                  ) : (
                    // Havola hali yo'q — bosilmaydigan qator (eski paneldagi kabi).
                    <div key={i} className="px-2.5 py-2 text-v2-body text-v2-text-2">
                      {t(topic.title)}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        {/* Foydalanuvchi: avatar + ism + lavozim → profil menyusi */}
        <div ref={profileWrapRef} className="relative">
          <button
            type="button"
            onClick={toggleProfile}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            title={displayName}
            className={`flex h-10 items-center gap-2.5 rounded-v2-md pl-1 pr-1 transition-colors hover:bg-v2-surface-2 xl:pr-2 ${profileOpen ? "bg-v2-surface-2" : ""}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-caption font-semibold text-v2-on-brand">
              {initials}
            </span>
            <span className="hidden min-w-0 text-left xl:block">
              <span className="block max-w-[160px] truncate text-v2-body font-semibold text-v2-text">{displayName}</span>
              {user?.roleLabel && <span className="block max-w-[160px] truncate text-v2-caption text-v2-text-3">{t(user.roleLabel)}</span>}
            </span>
            <ChevronDown className="hidden size-4 shrink-0 text-v2-text-3 xl:block" strokeWidth={1.75} aria-hidden />
          </button>

          {profileOpen && (
            <div role="menu" className={`${PANEL} w-72`}>
              <div className="flex items-center gap-3 border-b border-v2-border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-body font-semibold text-v2-on-brand">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-body font-semibold text-v2-text" title={displayName}>{displayName}</span>
                  <span className="block truncate text-v2-caption text-v2-text-3">
                    {[user?.roleLabel ? t(user.roleLabel) : "", displayPhone].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </div>

              <div className="space-y-2 border-b border-v2-border p-3">
                <div>
                  <div className="mb-1.5 text-v2-caption text-v2-text-3">{t("Til")}</div>
                  <div className="grid grid-cols-3 gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
                    {LANG_CODES.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLang(code)}
                        aria-pressed={lang === code}
                        title={LANGUAGES[code].name}
                        className={`h-7 rounded-[6px] text-v2-caption transition-colors ${
                          lang === code ? "bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "text-v2-text-2 hover:text-v2-text"
                        }`}
                      >
                        {LANGUAGES[code].code}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={toggleTheme} className={MENU_ITEM}>
                  {isDark ? <Sun className="size-4 text-v2-text-2" strokeWidth={1.75} /> : <Moon className="size-4 text-v2-text-2" strokeWidth={1.75} />}
                  {isDark ? t("Yorug' rejim") : t("Tungi rejim")}
                </button>
              </div>

              <div className="p-1">
                <button type="button" role="menuitem" onClick={() => switchUiVersion("v1")} className={MENU_ITEM}>
                  <RotateCcw className="size-4 text-v2-text-2" strokeWidth={1.75} />
                  {t("Eski versiyaga qaytish")}
                </button>
                <button type="button" role="menuitem" onClick={() => void onProfileAction("devices")} className={MENU_ITEM}>
                  <Monitor className="size-4 text-v2-text-2" strokeWidth={1.75} />
                  {t("Aktiv qurilmalar")}
                </button>
                <button type="button" role="menuitem" onClick={() => void onProfileAction("lock")} className={MENU_ITEM}>
                  <Lock className="size-4 text-v2-text-2" strokeWidth={1.75} />
                  {t("Qulflash")}
                </button>
                <div className="my-1 h-px bg-v2-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void onProfileAction("logout")}
                  className={`${MENU_ITEM} text-v2-danger hover:bg-v2-danger-bg`}
                >
                  <LogOut className="size-4" strokeWidth={1.75} />
                  {t("Chiqish")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {ai && <AssistantPanel origin={ai.origin} onClose={() => setAi(null)} alerts={isAdmin ? alerts : undefined} />}
    </header>
  );
}

/**
 * Global qidiruv — eski paneldagi bilan bir manba (/api/search/students +
 * lib/search.ts). Ctrl+K (yoki ⌘K) maydonga o'tkazadi; klaviatura tili
 * kirill bo'lsa ham ishlaydi (`code`, `key` emas).
 *
 * FARQ: eski qidiruv natijalariga lib/search.ts dagi demo «Buyurtma»
 * yozuvlari (createInitialOrders) ham qo'shilardi — ular haqiqiy emas, shu
 * bois bu yerda faqat o'quvchilar ko'rsatiladi.
 */
function GlobalSearch() {
  const { t } = useT();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Sahifa almashganda qidiruv tozalanadi (eski paneldagi qoida) — holat
  // qaysi sahifada yozilganini eslaydi, effekt kerak emas.
  const [entry, setEntry] = useState({ q: "", path: pathname });
  const q = entry.path === pathname ? entry.q : "";
  const [open, setOpen] = useState(false);
  const setQ = (v: string) => {
    setEntry({ q: v, path: pathname });
    setOpen(true);
  };

  const query = q.trim();
  const ready = query.length >= 2;
  const [found, setFound] = useState<{ q: string; rows: StudentRow[] }>({ q: "", rows: [] });

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Har bosilgan harfga so'rov ketmasin.
    const timer = setTimeout(() => {
      fetch(`/api/search/students?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setFound({ q: query, rows: d?.ok ? (d.students as StudentRow[]) : [] });
        })
        // Xato bo'lsa skelet abadiy aylanib turmasin — «Natija topilmadi».
        .catch(() => {
          if (!cancelled) setFound({ q: query, rows: [] });
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, ready]);

  const results = useMemo(
    () => (ready ? searchAll(query, found.rows).filter((r) => r.id.startsWith("student-")) : []),
    [query, ready, found.rows],
  );
  const loading = ready && found.q !== query && results.length === 0;

  // Ctrl+K / ⌘K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Tashqariga bosilsa natijalar yopiladi (yozilgan matn qoladi).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const clear = () => {
    setEntry({ q: "", path: pathname });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative min-w-0 max-w-[480px] flex-1">
      <div className="flex h-9 items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 transition-colors focus-within:border-v2-brand focus-within:bg-v2-surface focus-within:shadow-v2-focus">
        <Search className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (q) clear();
              else inputRef.current?.blur();
            }
          }}
          placeholder={t("O'quvchini qidiring: ism, telefon yoki ID")}
          aria-label={t("Qidirish")}
          autoComplete="off"
          // `!` — eski globals.css dagi `input:focus { background: … !important }` ni bosadi.
          className="h-full min-w-0 flex-1 bg-transparent! text-v2-body text-v2-text outline-none placeholder:text-v2-text-3"
        />
        {q ? (
          <button
            type="button"
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            title={t("Tozalash")}
            aria-label={t("Tozalash")}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-v2-full text-v2-text-3 hover:bg-v2-hover hover:text-v2-text"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        ) : (
          <kbd className="pointer-events-none hidden shrink-0 rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-0.5 font-v2 text-[11px] leading-none text-v2-text-3 sm:inline">
            Ctrl K
          </kbd>
        )}
      </div>

      {open && ready && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] min-w-[280px] overflow-y-auto rounded-v2-lg border border-v2-border bg-v2-surface p-1 shadow-v2-md">
          {loading ? (
            // Yuklanish — skelet (dizayn qoidasi: «Yuklanmoqda...» matni o'rniga).
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
          ) : results.length > 0 ? (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} onClick={clear} className="flex items-center gap-3 rounded-v2-md px-2.5 py-2 transition-colors hover:bg-v2-hover">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-surface-2 text-v2-caption font-semibold text-v2-text-2">
                      {initialsOf(r.title)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-v2-body font-semibold text-v2-text">{r.title}</span>
                      <span className="block truncate text-v2-caption text-v2-text-3">{t(r.subtitle)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-v2-body text-v2-text-2">{t("Natija topilmadi")}</div>
          )}
        </div>
      )}
    </div>
  );
}
