"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Menu, PanelLeftOpen, Search, Sparkles } from "lucide-react";
import AssistantPanel from "@/components/ai/AssistantPanel";
import type { Box } from "@/components/ai/genie";
import { useAiAlerts } from "@/components/ai/useAiAlerts";
import { useT } from "@/components/shared/Language";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { ASSISTANT_NAME } from "@/lib/ai/brand";
import BirthdaysPopoverV2 from "./BirthdaysPopoverV2";
import CommandPaletteV2 from "./CommandPaletteV2";
import CreateMenuV2 from "./CreateMenuV2";
import HelpMenuV2 from "./HelpMenuV2";
import NotificationsPopoverV2 from "./NotificationsPopoverV2";
import ProfileMenuV2 from "./ProfileMenuV2";

// YANGI VERSIYA YUQORI PANELI (design/v2/DESIGN.md → «Navigatsiya — yuqori panel»;
// 21-qism · Yuqori panel, 02.11.2026).
//
// Chapda qidiruv (Ctrl K — buyruqlar oynasi, ./CommandPaletteV2.tsx); o'ngda
// «+ Yangi» (./CreateMenuV2.tsx), MohirAI, tug'ilgan kunlar
// (./BirthdaysPopoverV2.tsx), topshiriqlarim, bildirishnomalar
// (./NotificationsPopoverV2.tsx), yordam (./HelpMenuV2.tsx) va profil
// (./ProfileMenuV2.tsx). Har bir menyu o'z faylida — o'z holati va
// klaviaturasi bilan. Filial tanlovi yon menyuda, til va kun/tun rejimi
// profil menyusida, MohirAI shu yerdagi tugmadan ochiladi
// (design/v2/SAVOLLAR.md 18–21). Ma'lumot manbalari eski panel bilan bir xil
// (provayderlar AppShellV2 da).

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
  /** Yoqilgan modullar — Ctrl K oynasidagi sahifalar ro'yxati yon menyudagidek bo'lsin. */
  features?: Record<string, boolean>;
  /** Kompyuterda yon menyu yig'ilganmi — unda shu yerda ochish tugmasi chiqadi. */
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  /** Telefonda chekma menyuni ochish. */
  onOpenMenu: () => void;
}

const ICON_BTN =
  "relative size-9 shrink-0 items-center justify-center rounded-v2-md text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text";
const ICON = "size-5";

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

export default function TopbarV2({ user, permissions, isAdmin, features, sidebarCollapsed, onExpandSidebar, onOpenMenu }: TopbarV2Props) {
  const { t } = useT();

  // Ctrl K / ⌘K — buyruqlar oynasi. Klaviatura kirillda bo'lsa ham ishlaydi
  // (`code`, `key` emas); oyna ochiq bo'lsa shu tugma uni yopadi.
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyK") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mening topshiriqlarim — eski panel bilan BIR manba. Nishon yuklanguncha
  // chizilmaydi: noma'lum son nol emas.
  const inbox = useTaskInbox();
  const inboxPending = inbox.everLoaded ? inbox.actionPending : 0;
  const inboxReports = inbox.everLoaded ? inbox.actionReports : 0;
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

      {/* Qidiruv — maydon ko'rinishidagi tugma: buyruqlar oynasini ochadi. */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={paletteOpen}
        aria-keyshortcuts="Control+K Meta+K"
        aria-label={t("Qidirish")}
        className="flex h-9 min-w-0 max-w-[480px] flex-1 items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface-2 px-3 text-left transition-colors hover:border-v2-border-strong hover:bg-v2-surface"
      >
        <Search className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-v2-body text-v2-text-3">{t("O'quvchi, guruh yoki xodimni qidiring")}</span>
        <kbd className="pointer-events-none hidden shrink-0 rounded-v2-sm border border-v2-border bg-v2-surface px-1.5 py-0.5 font-v2 text-[11px] leading-none text-v2-text-3 sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <CreateMenuV2 permissions={permissions} isAdmin={isAdmin} roleLabel={user?.roleLabel} />

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

        <BirthdaysPopoverV2 permissions={permissions} />

        {/* Mening topshiriqlarim — modal (components/shared/TaskInboxModal.tsx). */}
        <button type="button" onClick={inbox.openModal} title={inboxTitle} aria-label={inboxTitle} className={`${ICON_BTN} inline-flex`}>
          <ClipboardCheck className={ICON} strokeWidth={1.75} />
          {inboxCount > 0 && <CountBadge value={inboxCount > 99 ? "99+" : inboxCount} tone={inboxPending > 0 ? "danger" : "success"} />}
        </button>

        <NotificationsPopoverV2 permissions={permissions} />
        <HelpMenuV2 />
        <ProfileMenuV2 user={user} />
      </div>

      {/* `recentsKey` — «Oxirgi qidiruvlar» har foydalanuvchiga alohida (bitta kompyuterda bir necha xodim). */}
      {paletteOpen && (
        <CommandPaletteV2
          open
          onClose={() => setPaletteOpen(false)}
          permissions={permissions}
          isAdmin={isAdmin}
          features={features}
          recentsKey={user?.phone}
        />
      )}
      {ai && <AssistantPanel origin={ai.origin} onClose={() => setAi(null)} alerts={isAdmin ? alerts : undefined} />}
    </header>
  );
}
