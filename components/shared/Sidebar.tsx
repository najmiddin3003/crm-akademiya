"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SIDEBAR_ITEMS } from "@/constants/sidebar";
import { useLang } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { LANGS } from "@/lib/navbar";
import NotificationsPanel from "@/components/shared/NotificationsPanel";
import { useNotifications } from "@/components/shared/NotificationsProvider";
import { badgeLabel } from "@/lib/notifications";
import { isPathAllowed } from "@/lib/permissions";
import type { Lang } from "@/lib/i18n";

// Sidebar (chap navigatsiya) — barcha matn/havolalar constants/sidebar.js dagi
// SIDEBAR_ITEMS massividan keladi (kod ichida qattiq yozilmagan). Hover
// flyout submenular bitta markazlashgan `openKey` holati bilan boshqariladi:
// bir vaqtda faqat bittasi ochiladi, biridan ikkinchisiga o'tganda darhol
// almashadi va .flyout/.flyout-open CSS orqali silliq fade bilan chiqadi.

interface SidebarMenuItem {
  label: string;
  href: string;
  icon?: string;
  iconClass?: string;
  bold?: boolean;
  medium?: boolean;
  semibold?: boolean;
  primary?: boolean;
  count?: string;
  type?: "highlight" | "action" | "text";
  truncate?: boolean;
}
interface SidebarMenuColumn {
  title?: string;
  items: SidebarMenuItem[];
}
interface SidebarMenu {
  variant: "list" | "grid" | "reports";
  width: number;
  cols?: number;
  items?: SidebarMenuItem[];
  columns?: SidebarMenuColumn[];
}
interface SidebarItem {
  key: string;
  icon: string;
  label: string;
  href?: string;
  mobileHref: string;
  badge?: string;
  mobileBadge?: string;
  mobileActive?: boolean;
  menu?: SidebarMenu;
  /** Vaqtincha olib turilgan bo'lim — constants/sidebar.js dagi izohga qarang. */
  hidden?: boolean;
}

// `hidden` shu YAGONA joyda kesiladi — kompyuter menyusi ham, mobil menyu
// ham quyidagi bitta `items` dan chiziladi. Ruxsatlar daraxti
// (lib/permissions.ts) esa SIDEBAR_ITEMS ni to'g'ridan-to'g'ri o'qiydi va
// bu filtrga tegmaydi: yashirilgan bo'lim ruxsat sifatida saqlanib
// qoladi, ya'ni qaytarilganda rollarni qaytadan sozlash kerak bo'lmaydi.
const ITEMS = (SIDEBAR_ITEMS as SidebarItem[]).filter((i) => !i.hidden);

/**
 * Sidebar daraxtini rol ruxsatlariga qarab qirqadi (lib/permissions.ts).
 * `null` — cheklov yo'q, daraxt tegilmaydi.
 *
 * Faqat YASHIRISH emas, yo'nalishlarni TUZATISH ham shu yerda: bo'limning
 * o'z havolasi (`href`) yoki mobil havolasi (`mobileHref`) taqiqlangan
 * sahifaga qaragan bo'lsa, u ochiq qolgan birinchi ichki sahifaga
 * almashtiriladi. Aks holda ko'rinib turgan bo'limni bosgan xodim darhol
 * orqaga qaytarib yuborilardi (layout tekshiruvi).
 */
function filterByPermissions(items: SidebarItem[], permissions: string[] | null): SidebarItem[] {
  if (permissions === null) return items;
  const ok = (href?: string) => !!href && isPathAllowed(href, permissions);

  const out: SidebarItem[] = [];
  for (const item of items) {
    let nextMenu: SidebarMenu | undefined;
    let firstHref: string | undefined;

    if (item.menu) {
      const menuItems = item.menu.items?.filter((i) => ok(i.href));
      const columns = item.menu.columns
        ?.map((c) => ({ ...c, items: c.items.filter((i) => ok(i.href)) }))
        .filter((c) => c.items.length > 0);
      const flat = menuItems ?? columns?.flatMap((c) => c.items) ?? [];

      if (flat.length === 0) {
        // Ichida bitta ham ochiq sahifa qolmadi. Bo'lim faqat o'z havolasi
        // ochiq bo'lsa qoladi — va bo'sh flyout ochilmasligi uchun menyusiz.
        if (!ok(item.href)) continue;
        nextMenu = undefined;
      } else {
        firstHref = flat[0].href;
        nextMenu = { ...item.menu };
        if (menuItems) nextMenu.items = menuItems;
        if (columns) nextMenu.columns = columns;
      }
    } else if (!ok(item.href)) {
      continue;
    }

    out.push({
      ...item,
      menu: nextMenu,
      href: item.href && !ok(item.href) ? firstHref : item.href,
      mobileHref: ok(item.mobileHref) ? item.mobileHref : (firstHref ?? item.href ?? item.mobileHref),
    });
  }
  return out;
}

// Faqat shu sahifalar hali kod bilan qurilgan (tegishli app/(app)/<href>/page.tsx
// mavjud). Qolgan barcha havolalar hozircha "qurilmagan" — qulflanadi: hover
// bo'lganda flyout menyu baribir chiqaveradi, lekin bosilganda hech qayerga
// o'tmaydi va xiraroq ko'rinadi.
//
// Ro'yxat constants/sidebar.js dagi har bir href'ni app/(app)/ papkasi bilan
// solishtirib chiqarilgan — shu sabab bo'lim tartibida guruhlangan. Yangi
// sahifa qo'shilganda shu yerga ham qo'shilishi kerak (aks holda sidebar'da
// qulflangan ko'rinadi, garchi sahifa ishlasa ham).
//
// 2026-08-16: referensda mavjud bo'lmagan 35 ta o'ylab topilgan havola
// constants/sidebar.js dan olib tashlandi (bo'lim dashboardlari, qo'shimcha
// analitika sahifalari va h.k.) — ular hech qachon qurilmagan va sidebarda
// faqat qulf bo'lib turardi. Endi har bir havolaning sahifasi bor.
const IMPLEMENTED_ROUTES = new Set([
  // Topshiriqlar
  "/tasks",
  // Lidlar
  "/orders-list", "/first-lessons",
  // Guruh
  "/groups", "/groups-tasks", "/groups-schedule", "/groups-rooms", "/groups-equipments", "/groups-students",
  // O'quvchilar
  "/new-students", "/active-students", "/archive-students", "/students-list", "/parents", "/expiring-subs", "/student-addresses",
  // O'quv bo'limi
  "/offline-courses", "/online-courses", "/edu-category", "/seasonal-assessment", "/contract",
  // Blok test
  "/blok-test-turlari", "/blok-testlar",
  // Imtihon (Oylik imtihon | UzBMB — ikkalasi ham /imtihon, tab `?tab=` da)
  "/imtihon",
  // Moliya
  "/finance-cash", "/finance-bonus", "/finance-penalty", "/finance-payroll",
  "/finance-cashflow", "/finance-revenue-plan", "/finance-analytics", "/finance-reports", "/finance-pnl", "/finance-flow",
  "/finance-tx-types", "/finance-transactions", "/finance-planned", "/finance-fin-contract",
  "/finance-sync",
  // Nazorat
  "/nazorat-davomat", "/nazorat-davomat-analytics", "/nazorat-feedback", "/nazorat-staff-rating",
  "/nazorat-missed-groups", "/nazorat-branches", "/nazorat-turnstile", "/nazorat-turnstile-io", "/nazorat-support-analytics",
  "/nazorat-sms-analytics",
  // Boshqaruv
  "/management-xodimlar", "/management-cv", "/management-rollar", "/management-filiallar", "/management-ish-jadvali",
  // Sotuv va marketing
  "/sales-marketing", "/sales-sources", "/sales-plan", "/sales-news", "/sales-stories", "/sales-sms", "/sales-messages",
  // Hisobotlar (finance-*/nazorat-* takrorlari yuqorida bor)
  "/reports-funnel", "/reports-balance", "/reports-unpaid", "/reports-diff-payments", "/reports-cancelled", "/reports-discounts",
  "/reports-teachers-perf", "/reports-admins-perf", "/reports-leave-reasons", "/reports-rooms", "/reports-served", "/reports-cancelled-attend",
  // Sozlamalar
  "/settings-general", "/settings-finance", "/settings-academic", "/settings-sales",
  "/settings-management", "/settings-integrations", "/settings-app", "/settings-gamification",
  "/settings-profile", "/settings-security",
]);

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /**
   * Rol ruxsatlari — app/(app)/layout.tsx → AppShell orqali keladi.
   * `null` = cheklov yo'q.
   */
  permissions?: string[] | null;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange, permissions = null }: SidebarProps) {
  // Xodim ko'ra oladigan bo'limlar. Bu FAQAT ko'rinish: haqiqiy to'siq
  // app/(app)/layout.tsx da, server tomonda.
  const items = useMemo(() => filterByPermissions(ITEMS, permissions), [permissions]);
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
  const [isDark, toggleTheme] = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  // Son Navbar bilan BIR XIL manbadan (NotificationsProvider). Ilgari bu
  // yerda alohida hisob turardi va ikkala sirt bir vaqtda ko'rinadigan
  // mobil kenglikda ikkita raqam bir-biriga zid bo'lishi mumkin edi.
  const { unread, unreadIsFloor, everLoaded } = useNotifications();
  const showBadge = everLoaded && unread > 0;

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
    if (!confirm("Tizimdan chiqishni xohlaysizmi?")) return;
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
      const t = e.target as Node;
      if (panelRefs.current[openKey]?.contains(t)) return;
      if (triggerRefs.current[openKey]?.contains(t)) return;
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
    const locked = !IMPLEMENTED_ROUTES.has(href.split("?")[0]);
    return { locked, title: locked ? "Hali tayyor emas" : undefined };
  };
  const lockIcon = (
    <svg className="icon" style={{ width: 12, height: 12, opacity: 0.7 }} aria-label="Qulflangan">
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
        <span className={it.truncate ? "flex-1 truncate" : "flex-1"}>{it.label}</span>
        {locked ? lockIcon : it.count && <span className="text-[11px] tabular-nums opacity-50">{it.count}</span>}
      </Link>
    );
  };

  const renderColumn = (col: SidebarMenuColumn, ci: number) => (
    <div key={ci} className="flyout-col">
      {col.title && <div className="flyout-colhead">{col.title}</div>}
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
      {/* ============ SVG SPRITE (icons used by navbar) ============ */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-graduation-cap" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></symbol>
          <symbol id="i-list-todo" viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" y1="6" x2="21" y2="6"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="13" y1="18" x2="21" y2="18"/></symbol>
          <symbol id="i-megaphone" viewBox="0 0 24 24"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></symbol>
          <symbol id="i-users-group" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></symbol>
          <symbol id="i-user" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
          <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></symbol>
          <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></symbol>
          <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></symbol>
          <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
          <symbol id="i-trending-up" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></symbol>
          <symbol id="i-bar-chart" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></symbol>
          <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></symbol>
          <symbol id="i-life-buoy" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></symbol>
          <symbol id="i-chevron-down" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>
          <symbol id="i-flag" viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></symbol>
          <symbol id="i-zap" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>
          <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></symbol>
          <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></symbol>
          <symbol id="i-monitor" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></symbol>
          <symbol id="i-file-plus" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></symbol>
          <symbol id="i-archive" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></symbol>
          <symbol id="i-edit" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></symbol>
          <symbol id="i-star" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></symbol>
          <symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></symbol>
          <symbol id="i-file-text" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
        </defs>
      </svg>

      {/* Logo endi bu yerda emas — referensdagidek Navbar ichiga ko'chirildi. */}
      <aside id="sidebar" className="shell-sidebar hidden lg:flex flex-col border-r shrink-0" style={{ borderColor: "var(--shell-line)" }}>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden">
          <ul className="space-y-[2px]">
            {items.map((item) => {
              const hasMenu = !!item.menu;
              const topLocked = !!item.href && !IMPLEMENTED_ROUTES.has(item.href.split("?")[0]);
              const itemActive = isPathActive(item.href) || isMenuActive(item.menu);
              // Referensda o'ngda chevron YO'Q — ochiq/yopiqligi faqat fon
              // rangi bilan bildiriladi.
              const rowClass = `side-item ${itemActive ? "is-active" : ""} ${openKey === item.key ? "is-open" : ""} ${topLocked ? "is-locked" : ""}`;
              const inner = (
                <>
                  {/* Badge referensda ikonkaning yuqori-o'ng burchagida turadi */}
                  <span className="side-badge-wrap">
                    <svg className="icon"><use href={`#${item.icon}`} /></svg>
                    {item.badge && <span className="side-badge">{item.badge}</span>}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
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
                    <a href="#" onClick={(e) => e.preventDefault()} title="Hali tayyor emas" className={rowClass} style={LOCKED_STYLE}>
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
            <span>TEXNIK YORDAM</span>
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
          <Link href="/tasks" className="flex h-16 items-center gap-2 border-b border-border px-5 w-full hover:bg-secondary transition-colors group" title="Asosiy sahifaga qaytish" onClick={closeMobile}>
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
                    <span className="flex-1">{item.label}</span>
                    {item.mobileBadge && (
                      <span className="ml-auto inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.mobileBadge}</span>
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
              onClick={() => setNotifOpen((v) => !v)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-bell" /></svg>
              <span className="flex-1">Bildirishnomalar</span>
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
              <span>{isDark ? "Yorug' rejim" : "Tungi rejim"}</span>
            </button>
          </div>

          {/* Profil amallari — desktopda bular Navbar'ning o'ng blokida turadi,
              u esa mobilda yashirin. */}
          <div className="border-t border-border px-3 py-3 space-y-0.5">
            <button
              onClick={() => void onProfileAction("devices")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-monitor" /></svg>
              <span>Aktiv qurilmalar</span>
            </button>
            <button
              onClick={() => void onProfileAction("lock")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary text-left"
            >
              <svg className="icon icon-sm text-muted-foreground"><use href="#i-lock" /></svg>
              <span>Qulflash</span>
            </button>
            <button
              onClick={() => void onProfileAction("logout")}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 text-left"
            >
              <svg className="icon icon-sm"><use href="#i-log-out" /></svg>
              <span>Chiqish</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
