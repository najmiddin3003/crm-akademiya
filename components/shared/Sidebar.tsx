"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useRouter } from "next/navigation";
import { isLockedRoute, visibleSidebarItems, type SidebarMenu, type SidebarMenuColumn, type SidebarMenuItem } from "@/components/shared/sidebarModel";
import { useLang, useT } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { LANGS } from "@/lib/navbar";
import NotificationsPanel from "@/components/shared/NotificationsPanel";
import { useNotifications } from "@/components/shared/NotificationsProvider";
import { useTaskInbox } from "@/components/shared/TaskInboxProvider";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import { SidebarSprite } from "@/components/shared/ShellSprites";
import { badgeLabel } from "@/lib/notifications";
import type { Lang } from "@/lib/i18n";
import { switchUiVersion } from "@/lib/uiVersion";

// Sidebar (chap navigatsiya) — barcha matn/havolalar constants/sidebar.js dagi
// SIDEBAR_ITEMS massividan keladi (kod ichida qattiq yozilmagan). Hover
// flyout submenular bitta markazlashgan `openKey` holati bilan boshqariladi:
// bir vaqtda faqat bittasi ochiladi, biridan ikkinchisiga o'tganda darhol
// almashadi va .flyout/.flyout-open CSS orqali silliq fade bilan chiqadi.

// Model (turlar, ruxsat filtri, qurilgan sahifalar ro'yxati) —
// components/shared/sidebarModel.ts: yangi versiya menyusi (components/v2/shell)
// ham o'sha qoidadan chiziladi.

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /**
   * Rol ruxsatlari — app/(app)/layout.tsx → AppShell orqali keladi.
   * `null` = cheklov yo'q.
   */
  permissions?: string[] | null;
  /** `users.role === "admin"` — `adminOnly` bo'limlar shu bayroqqa qarab chiziladi. */
  isAdmin?: boolean;
  /** Yoqilgan modullar — `feature` bo'limlar uchun. */
  features?: Record<string, boolean>;
  /**
   * Yangi versiyaga o'tish qatori (mobil menyuda) — faqat almashtirgich
   * yoqilgan serverda (sinov sayti, lokal dev; lib/uiVersionServer.ts).
   */
  canSwitchUi?: boolean;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange, permissions = null, isAdmin = false, features, canSwitchUi = false }: SidebarProps) {
  // Xodim ko'ra oladigan bo'limlar — qoida components/shared/sidebarModel.ts da
  // (yangi versiya menyusi bilan umumiy). Bu FAQAT ko'rinish: haqiqiy to'siq
  // app/(app)/layout.tsx da, server tomonda.
  const gamOn = !!features?.gamification;
  const items = useMemo(
    () => visibleSidebarItems(permissions, isAdmin, { gamification: gamOn }),
    [permissions, isAdmin, gamOn],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Bir menyudan ikkinchisiga o'tishda fade/translate animatsiyasini o'chirish
  // uchun. Aks holda eski panel so'nib turganda yangisi BOSHQA balandlikda
  // paydo bo'ladi — ikki panel bir vaqtda harakatlanib, sichqonchani sidebar
  // bo'ylab yurgizganda "titrash" bo'lib ko'rinadi.
  const [instantSwitch, setInstantSwitch] = useState(false);
  const triggerRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `openKey` ning eng so'nggi qiymati — setState asinxron bo'lgani uchun
  // "hozir biror menyu ochiqmi?" degan savolga darhol javob berish kerak.
  const openKeyRef = useRef<string | null>(null);
  // Sichqoncha shunchaki ustidan o'tib ketayotgan bo'lsa menyu ochilmasligi
  // uchun kichik kechikish (faqat hech narsa ochiq bo'lmaganda qo'llanadi).
  const OPEN_DELAY_MS = 90;

  // Joriy sahifaga mos elementni yorug' ko'rsatish uchun (masalan hozir
  // "Lidlar" > "Buyurtmalar ro'yxati"da bo'lsangiz, ikkalasi ham yorug'
  // ko'rinadi — ilgari bu yerda umuman route-solishtirish yo'q edi, faqat
  // constants/sidebar.js'dagi statik primary/mobileActive bayroqlariga
  // tayanardi, shu sabab boshqa sahifada ham bir xil element yorug' bo'lib
  // qolardi).
  const pathname = usePathname();
  const router = useRouter();
  // Navbar'ning o'ng bloki 768px dan pastda yashirinadi, shuning uchun til /
  // bildirishnoma / mavzu boshqaruvlari mobil chekma menyuda takrorlanadi.
  // Holat umumiy do'konlardan keladi — Navbar bilan doim sinxron.
  const [lang, setLang] = useLang();
  const { t } = useT();
  const [isDark, toggleTheme] = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  // Son Navbar bilan BIR XIL manbadan (NotificationsProvider). Ilgari bu
  // yerda alohida hisob turardi va ikkala sirt bir vaqtda ko'rinadigan
  // mobil kenglikda ikkita raqam bir-biriga zid bo'lishi mumkin edi.
  const { unread, unreadIsFloor, everLoaded } = useNotifications();
  // Yon panel yonidagi sonlar — bazadan (ilgari qattiq yozilgan edi).
  const counts = useSidebarCounts();
  const showBadge = everLoaded && unread > 0;
  // Xodimning shaxsiy topshiriq oynasi — Navbar'dagi ikonka bilan bir manba.
  // Telefonda navbarning o'ng bloki yashirin, shu bois qator shu yerda.
  const inbox = useTaskInbox();
  const inboxPending = inbox.everLoaded ? inbox.pending.length : 0;
  const inboxCount = inboxPending + (inbox.everLoaded ? inbox.reports.length : 0);

  // Navbar'dagi profil menyusi `hidden md:flex` blokida — 768px dan pastda
  // butunlay yashirinadi. Shu sabab telefondan chiqish/qulflash imkoni
  // yo'q edi; mobil chekma menyuning pastiga o'sha amallar qo'yildi.
  // Mantiq Navbar.onProfileAction bilan bir xil.
  const onProfileAction = async (kind: "devices" | "lock" | "logout") => {
    onMobileOpenChange(false);
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
  const isPathActive = useCallback(
    (href?: string) => !!href && (pathname === href || pathname.startsWith(`${href}/`)),
    [pathname],
  );
  const isMenuActive = useCallback(
    (menu?: SidebarMenu) => {
      if (!menu) return false;
      const flat = menu.items ?? menu.columns?.flatMap((c) => c.items) ?? [];
      return flat.some((it) => isPathActive(it.href));
    },
    [isPathActive],
  );

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const applyOpen = useCallback((key: string, instant: boolean) => {
    openKeyRef.current = key;
    setInstantSwitch(instant);
    setOpenKey(key);
  }, []);

  const openMenu = useCallback(
    (key: string) => {
      clearCloseTimer();
      clearOpenTimer();
      if (typeof document !== "undefined" && document.body.classList.contains("sidebar-hidden")) return;
      if (openKeyRef.current !== null) {
        // Allaqachon biror menyu ochiq — kechikmasdan va ANIMATSIYASIZ
        // almashtiramiz. Aynan shu joy ilgari titrashga sabab bo'lardi.
        applyOpen(key, openKeyRef.current !== key);
        return;
      }
      // Hech narsa ochiq emas — qisqa kechikishdan keyin, odatdagi fade bilan.
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        applyOpen(key, false);
      }, OPEN_DELAY_MS);
    },
    [applyOpen, clearCloseTimer, clearOpenTimer],
  );

  const reallyClose = useCallback(() => {
    openKeyRef.current = null;
    setInstantSwitch(false);
    setOpenKey(null);
  }, []);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = setTimeout(reallyClose, 240);
  }, [clearCloseTimer, clearOpenTimer, reallyClose]);

  const closeNow = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    reallyClose();
  }, [clearCloseTimer, clearOpenTimer, reallyClose]);

  // Komponent yo'q qilinganda osilib qolgan taymerlarni tozalash.
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const positionPanel = useCallback((key: string) => {
    const trigger = triggerRefs.current[key];
    const panel = panelRefs.current[key];
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    // Referensda flyout SIDEBAR chetidan 3px narida turadi — element chetidan
    // emas. Element chetini olsak, sidebar padding'i va scrollbar kengligi
    // qo'shilib, panel sidebar ustiga chiqib qolardi.
    const asideRight = document.getElementById("sidebar")?.getBoundingClientRect().right ?? rect.right;
    panel.style.left = asideRight + 3 + "px";
    panel.style.top = rect.top + "px";
    const subHeight = panel.offsetHeight || 140;
    const maxTop = window.innerHeight - subHeight - 8;
    if (rect.top > maxTop) panel.style.top = Math.max(8, maxTop) + "px";
  }, []);

  useLayoutEffect(() => {
    if (openKey) positionPanel(openKey);
  }, [openKey, positionPanel]);

  useEffect(() => {
    if (!openKey) return;
    const onResize = () => positionPanel(openKey);
    const onDocClick = (e: MouseEvent) => {
      const tv = e.target as Node;
      if (panelRefs.current[openKey]?.contains(tv)) return;
      if (triggerRefs.current[openKey]?.contains(tv)) return;
      reallyClose();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
    };
  }, [openKey, positionPanel, reallyClose]);

  const closeMobile = () => onMobileOpenChange(false);

  // ---- flyout item renderers ----
  // Qurilmagan sahifaga ishora qilsa: bosilmaydigan, xiraroq ko'rinadigan
  // element qaytaradi (lekin flyout barribir hover'da chiqaveradi — bu
  // shu li ustida turadi, individual item'ga bog'liq emas).
  // Static CSS'da har bir Tailwind sinfi mavjud bo'lavermaydi (bu loyihada
  // globals.css oldindan tayyorlangan, JIT emas) — shu sabab qulflangan
  // ko'rinish inline style orqali berilib, hech qanday CSS sinfiga bog'liq
  // qolmaydi.
  const LOCKED_STYLE = { opacity: 0.45, cursor: "not-allowed", pointerEvents: "none" } as const;
  // Havolada so'rov qismi bo'lishi mumkin (masalan "/imtihon?tab=uzbmb") —
  // qulf ro'yxati faqat sahifa yo'li bilan solishtiriladi.
  const lockedProps = (href: string) => {
    const locked = isLockedRoute(href);
    return { locked, title: locked ? t("Hali tayyor emas") : undefined };
  };
  const lockIcon = (
    <svg className="icon" style={{ width: 12, height: 12, opacity: 0.7 }} aria-label={t("Qulflangan")}>
      <use href="#i-lock" />
    </svg>
  );

  // Referensda flyout elementlari IKONKASIZ — faqat matn (va bor bo'lsa,
  // o'ngda kichik son). Shu sabab bu yerda `it.icon` umuman chizilmaydi.
  const renderFlyoutItem = (it: SidebarMenuItem, key: string) => {
    const { locked, title } = lockedProps(it.href);
    const active = isPathActive(it.href);
    return (
      <Link
        key={key}
        href={it.href}
        // PREFETCH O'CHIRILGAN. Sidebar'da 88 ta havola bor va bitta
        // flyout ochilganda 17 tagacha havola mount bo'ladi. Har biri
        // fon so'rovini boshlaydi, har bir so'rov esa (app)/layout.tsx ni
        // serverda qayta render qiladi — ya'ni getCurrentUser va uning
        // baza so'rovlari. Bitta hover o'nlab keraksiz so'rov degani edi.
        prefetch={false}
        onClick={locked ? (e) => e.preventDefault() : closeNow}
        title={title}
        className={`flyout-item ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}`}
      >
        <span className={it.truncate ? "flex-1 truncate" : "flex-1"}>{t(it.label)}</span>
        {/* Son 0 bo'lsa ham HALOL ko'rsatiladi — shu bois "!= null",
            "&&" emas: 0 ham haqiqat ("bu sahifada yozuv yo'q"), uni
            yashirish "hali yuklanmadi" bilan chalkashtirardi. Sanoq
            umuman kelmagan bo'lsa hech narsa chizilmaydi. */}
        {locked
          ? lockIcon
          : it.countKey != null && counts[it.countKey] != null && (
              <span className="text-[11px] tabular-nums opacity-50">{counts[it.countKey]}</span>
            )}
      </Link>
    );
  };

  const renderColumn = (col: SidebarMenuColumn, ci: number) => (
    <div key={ci} className="flyout-col">
      {col.title && <div className="flyout-colhead">{t(col.title)}</div>}
      {col.items.map((it, i) => renderFlyoutItem(it, `${ci}-${i}`))}
    </div>
  );

  const renderPanelBody = (menu: SidebarMenu) => {
    if (menu.variant === "list") {
      // Bitta ustunli variantda ustun panelning butun kengligini egallaydi
      // (grid variantidagi qat'iy 204px emas).
      return <div className="flyout-col flyout-col-full">{menu.items?.map((it, i) => renderFlyoutItem(it, String(i)))}</div>;
    }
    return menu.columns?.map((col, ci) => renderColumn(col, ci));
  };

  // Referensda flyout kengligi ustun soniga qarab hisoblanadi: har bir ustun
  // 204px, ustunlar orasi 10px (bitta ustunli "list" varianti esa 220px).
  // constants/sidebar.js dagi `width` maydoni endi ishlatilmaydi — o'sha
  // qiymatlar eski dizayndan qolgan va referensga mos kelmaydi.
  const panelWidth = (menu: SidebarMenu) => {
    if (menu.variant === "list") return 220;
    const cols = menu.variant === "reports" ? 4 : (menu.cols ?? 2);
    return cols * 204 + (cols - 1) * 10;
  };

  return (
    <>
      <SidebarSprite />

      {/* Logo endi bu yerda emas — referensdagidek Navbar ichiga ko'chirildi. */}
      <aside id="sidebar" className="shell-sidebar hidden lg:flex flex-col border-r shrink-0" style={{ borderColor: "var(--shell-line)" }}>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-[2px]">
            {items.map((item) => {
              const hasMenu = !!item.menu;
              const topLocked = !!item.href && isLockedRoute(item.href);
              const itemActive = isPathActive(item.href) || isMenuActive(item.menu);
              // Referensda o'ngda chevron YO'Q — ochiq/yopiqligi faqat fon
              // rangi bilan bildiriladi.
              const rowClass = `side-item ${itemActive ? "is-active" : ""} ${openKey === item.key ? "is-open" : ""} ${topLocked ? "is-locked" : ""}`;
              const inner = (
                <>
                  {/* Badge referensda ikonkaning yuqori-o'ng burchagida turadi */}
                  <span className="side-badge-wrap">
                    <svg className="icon"><use href={`#${item.icon}`} /></svg>
                    {item.badgeKey != null && (counts[item.badgeKey] ?? 0) > 0 && (
                      <span className="side-badge">{counts[item.badgeKey]}</span>
                    )}
                  </span>
                  <span className="flex-1 truncate">{t(item.label)}</span>
                  {topLocked && lockIcon}
                </>
              );
              return (
                <li
                  key={item.key}
                  className="relative"
                  ref={hasMenu ? (el) => { triggerRefs.current[item.key] = el; } : undefined}
                  onMouseEnter={hasMenu ? () => openMenu(item.key) : undefined}
                  onMouseLeave={hasMenu ? scheduleClose : undefined}
                >
                  {item.href && !topLocked ? (
                    <Link href={item.href} prefetch={false} className={rowClass} onClick={closeNow}>{inner}</Link>
                  ) : item.href && topLocked ? (
                    <a href="#" onClick={(e) => e.preventDefault()} title={t("Hali tayyor emas")} className={rowClass} style={LOCKED_STYLE}>
                      {inner}
                    </a>
                  ) : (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        // openKeyRef orqali — setState asinxron bo'lgani uchun
                        // holatni to'g'ridan-to'g'ri o'qiymiz.
                        if (openKeyRef.current === item.key) closeNow();
                        else { clearOpenTimer(); clearCloseTimer(); applyOpen(item.key, openKeyRef.current !== null); }
                      }}
                      className={rowClass}
                    >
                      {inner}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-2">
          <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold" style={{ color: "var(--shell-blue)" }}>
            <svg className="icon" style={{ width: 16, height: 16 }}><use href="#i-life-buoy" /></svg>
            <span>{t("TEXNIK YORDAM")}</span>
          </button>
        </div>
      </aside>

      {/* ============ FLYOUT SUBMENULAR (constants'dan) ============ */}
      {items.filter((item) => item.menu).map((item) => {
        const menu = item.menu!;
        return (
          <div
            key={item.key}
            ref={(el) => { panelRefs.current[item.key] = el; }}
            className={`flyout ${openKey === item.key ? "flyout-open" : ""} ${instantSwitch ? "flyout-instant" : ""} flex gap-[10px]`}
            style={{ width: panelWidth(menu) }}
            onMouseEnter={() => openMenu(item.key)}
            onMouseLeave={scheduleClose}
          >
            {renderPanelBody(menu)}
          </div>
        );
      })}

      {/* ============ MOBILE SIDEBAR ============ */}
      <div id="mobile-sidebar" className={`${mobileOpen ? "" : "hidden"} fixed inset-0 z-50 lg:hidden`}>
        <div className="absolute inset-0 bg-black/50" onClick={() => onMobileOpenChange(false)} />
        <aside className="absolute left-0 top-0 h-full w-64 flex flex-col border-r border-border bg-sidebar">
          <Link href="/tasks" className="flex h-16 items-center gap-2 border-b border-border px-5 w-full hover:bg-secondary transition-colors group" title={t("Asosiy sahifaga qaytish")} onClick={closeMobile}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white group-hover:scale-110 transition-transform">
              <svg className="icon icon-sm"><use href="#i-graduation-cap" /></svg>
            </div>
            <div className="text-[17px] font-bold tracking-tight">Tizimli</div>
          </Link>
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.mobileHref}
                    prefetch={false}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium ${item.mobileActive ? "bg-primary text-white" : "text-foreground/70 hover:bg-secondary"}`}
                  >
                    <svg className={`icon icon-sm ${item.mobileActive ? "" : "text-muted-foreground"}`}><use href={`#${item.icon}`} /></svg>
                    <span className="flex-1">{t(item.label)}</span>
                    {item.badgeKey != null && (counts[item.badgeKey] ?? 0) > 0 && (
                      <span className="ml-auto inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{counts[item.badgeKey]}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Til / bildirishnoma / mavzu — desktopda Navbar'ning o'ng blokida. */}
          <div className="border-t border-border px-3 py-3 space-y-2">
            <div className="flex items-center gap-1">
              {(Object.keys(LANGS) as Lang[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors ${
                    lang === code ? "bg-primary text-white" : "text-foreground/70 hover:bg-secondary"
                  }`}
                >
                  <span className="text-sm leading-none">{LANGS[code].flag}</span>
                  <span>{LANGS[code].short}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => { closeMobile(); inbox.openModal(); }}
              className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-left hover:bg-secondary ${inboxPending > 0 ? "text-red-600 dark:text-red-300" : "text-foreground/70"}`}
            >
              <svg className={`icon icon-sm ${inboxPending > 0 ? "" : "text-muted-foreground"}`}><use href="#i-task-inbox" /></svg>
              <span className="flex-1">{inboxPending > 0 ? t("Topshiriq bajarilishi kutilmoqda") : t("Mening topshiriqlarim")}</span>
              {inboxCount > 0 && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${inboxPending > 0 ? "bg-red-500" : "bg-emerald-600"}`}>
                  {inboxCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-bell" /></svg>
              <span className="flex-1">{t("Bildirishnomalar")}</span>
              {showBadge && (
                <span className="inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {badgeLabel(unread, unreadIsFloor)}
                </span>
              )}
            </button>
            {/* SHART `mobileOpen` NI HAM O'Z ICHIGA OLADI.
                Chekma menyu `hidden` klassi bilan yashiriladi — u DEMOUNT
                BO'LMAYDI. Faqat `notifOpen` ga bog'lansa, foydalanuvchi
                bo'limni ochib, keyin menyuni yopgach ham panel `open` holida
                mount bo'lib qolardi. Natijada provider'dagi "panel ochiq
                ekan ro'yxatni siljitma" qulfi HECH QACHON ochilmasdi: nishon
                o'sib boraverar, ro'yxat esa o'sha lahzadagi holatida
                muzlab qolardi (sahifa qayta yuklanmaguncha). */}
            {notifOpen && mobileOpen && (
              <div className="pb-1">
                <NotificationsPanel
                  variant="drawer"
                  open={notifOpen && mobileOpen}
                  onNavigate={closeMobile}
                />
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href={isDark ? "#i-sun" : "#i-moon"} /></svg>
              <span>{isDark ? t("Yorug' rejim") : t("Tungi rejim")}</span>
            </button>

            {/* Yangi versiya (v2) — navbardagi almashtirgich telefonda
                yashirin, shu bois shu yerda ham (faqat sinov saytida/dev'da). */}
            {canSwitchUi && (
              <button
                onClick={() => switchUiVersion("v2")}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-primary hover:bg-secondary text-left"
              >
                <svg className="icon icon-sm"><use href="#i-zap" /></svg>
                <span>{t("Yangi versiyani ochish")}</span>
              </button>
            )}
          </div>

          {/* Profil amallari — desktopda bular Navbar'ning o'ng blokida turadi,
              u esa mobilda yashirin. */}
          <div className="border-t border-border px-3 py-3 space-y-0.5">
            <button
              onClick={() => void onProfileAction("devices")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-monitor" /></svg>
              <span>{t("Aktiv qurilmalar")}</span>
            </button>
            <button
              onClick={() => void onProfileAction("lock")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-lock" /></svg>
              <span>{t("Qulflash")}</span>
            </button>
            <button
              onClick={() => void onProfileAction("logout")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 text-left"
            >
              <svg className="icon icon-sm"><use href="#i-log-out" /></svg>
              <span>{t("Chiqish")}</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
