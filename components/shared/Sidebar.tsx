"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { SIDEBAR_ITEMS } from "@/constants/sidebar";

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
}

const ITEMS = SIDEBAR_ITEMS as SidebarItem[];

// Faqat shu sahifalar hali kod bilan qurilgan (tegishli app/(app)/<href>/page.tsx
// mavjud). Qolgan barcha havolalar hozircha "qurilmagan" — qulflanadi: hover
// bo'lganda flyout menyu baribir chiqaveradi, lekin bosilganda hech qayerga
// o'tmaydi va xiraroq ko'rinadi.
const IMPLEMENTED_ROUTES = new Set(["/tasks", "/orders-list", "/first-lessons", "/management-xodimlar"]);

export interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const triggerRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openMenu = useCallback(
    (key: string) => {
      clearCloseTimer();
      if (typeof document !== "undefined" && document.body.classList.contains("sidebar-hidden")) return;
      setOpenKey(key);
    },
    [clearCloseTimer],
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenKey(null), 240);
  }, [clearCloseTimer]);

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setOpenKey(null);
  }, [clearCloseTimer]);

  const positionPanel = useCallback((key: string) => {
    const trigger = triggerRefs.current[key];
    const panel = panelRefs.current[key];
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    panel.style.left = rect.right + 8 + "px";
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
      setOpenKey(null);
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
    };
  }, [openKey, positionPanel]);

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
  const lockedProps = (href: string) =>
    !IMPLEMENTED_ROUTES.has(href)
      ? { locked: true, title: "Hali tayyor emas", style: LOCKED_STYLE }
      : { locked: false, title: undefined, style: undefined };
  const lockIcon = (
    <svg className="icon" style={{ width: 12, height: 12, opacity: 0.7 }} aria-label="Qulflangan">
      <use href="#i-lock" />
    </svg>
  );

  const renderListItem = (it: SidebarMenuItem, i: number) => {
    const { locked, title, style } = lockedProps(it.href);
    return it.icon ? (
      <Link
        key={i}
        href={it.href}
        onClick={locked ? (e) => e.preventDefault() : closeNow}
        title={title}
        style={style}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors ${it.medium ? "font-medium" : ""}`}
      >
        <svg className={`icon icon-sm ${it.iconClass ?? "text-muted-foreground"} flex-shrink-0`}><use href={`#${it.icon}`} /></svg>
        <span className="flex-1" style={it.bold ? { fontWeight: 600 } : undefined}>{it.label}</span>
        {locked ? lockIcon : it.count && <span className="text-[11px] text-muted-foreground tabular-nums font-medium">{it.count}</span>}
      </Link>
    ) : (
      <Link
        key={i}
        href={it.href}
        onClick={locked ? (e) => e.preventDefault() : closeNow}
        title={title}
        style={style}
        className={`w-full text-left px-3 py-2 rounded-md text-[13px] flex items-center gap-2 ${it.semibold ? "font-semibold" : ""} ${it.medium ? "font-medium" : ""} ${it.primary ? "text-primary bg-primary/10 hover:bg-primary/15" : "hover:bg-secondary"}`}
      >
        <span className="flex-1">{it.label}</span>
        {locked && lockIcon}
      </Link>
    );
  };

  const renderGridItem = (it: SidebarMenuItem, i: number) => {
    const { locked, title, style } = lockedProps(it.href);
    return it.icon ? (
      <Link
        key={i}
        href={it.href}
        onClick={locked ? (e) => e.preventDefault() : closeNow}
        title={title}
        style={style}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-secondary text-sm text-left transition-colors"
      >
        <svg className={`icon icon-sm ${it.iconClass ?? "text-muted-foreground"} flex-shrink-0`}><use href={`#${it.icon}`} /></svg>
        <span className="flex-1" style={it.bold ? { fontWeight: 600 } : undefined}>{it.label}</span>
        {locked && lockIcon}
      </Link>
    ) : (
      <Link
        key={i}
        href={it.href}
        onClick={locked ? (e) => e.preventDefault() : closeNow}
        title={title}
        style={style}
        className={`w-full text-left px-2 py-2 rounded-md hover:bg-secondary text-sm flex items-center gap-2 ${it.medium ? "font-medium" : ""} ${it.primary ? "text-primary" : ""}`}
      >
        <span className="flex-1">{it.label}</span>
        {locked && lockIcon}
      </Link>
    );
  };

  const renderReportsColumn = (col: SidebarMenuColumn, ci: number) => {
    const actions = col.items.filter((it) => it.type === "action");
    const rest = col.items.filter((it) => it.type !== "action");
    return (
      <div key={ci}>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-2">{col.title}</div>
        {actions.map((it, i) => {
          const { locked, title, style } = lockedProps(it.href);
          return (
            <Link
              key={`a${i}`}
              href={it.href}
              onClick={locked ? (e) => e.preventDefault() : closeNow}
              title={title}
              className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-secondary transition-colors"
              style={{ marginBottom: 6, ...style }}
            >
              {it.icon && <svg className={`icon icon-sm ${it.iconClass ?? "text-primary"}`}><use href={`#${it.icon}`} /></svg>}
              <span className="flex-1">{it.label}</span>
              {locked && lockIcon}
            </Link>
          );
        })}
        <div className="space-y-0.5">
          {rest.map((it, i) => {
            const { locked, title, style } = lockedProps(it.href);
            return it.type === "highlight" ? (
              <Link
                key={`h${i}`}
                href={it.href}
                onClick={locked ? (e) => e.preventDefault() : closeNow}
                title={title}
                style={style}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary text-[13px] text-left font-medium text-primary bg-primary/10"
              >
                <span className="flex-1">{it.label}</span>
                {locked && lockIcon}
              </Link>
            ) : (
              <Link
                key={`t${i}`}
                href={it.href}
                onClick={locked ? (e) => e.preventDefault() : closeNow}
                title={title}
                style={style}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-[13px] flex items-center gap-2 ${it.truncate ? "truncate" : ""}`}
              >
                <span className={it.truncate ? "flex-1 truncate" : "flex-1"}>{it.label}</span>
                {locked && lockIcon}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPanelBody = (menu: SidebarMenu) => {
    if (menu.variant === "list") {
      return menu.items?.map((it, i) => renderListItem(it, i));
    }
    if (menu.variant === "grid") {
      return menu.columns?.map((col, ci) => (
        <div key={ci}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 mb-1 border-b border-border">{col.title}</div>
          {col.items.map((it, i) => renderGridItem(it, i))}
        </div>
      ));
    }
    // reports
    return (
      <div className="grid grid-cols-4 gap-5">
        {menu.columns?.map((col, ci) => renderReportsColumn(col, ci))}
      </div>
    );
  };

  const panelClass = (menu: SidebarMenu) => {
    if (menu.variant === "list") return "p-1";
    if (menu.variant === "grid") return `p-4 grid gap-x-6 gap-y-1 ${menu.cols === 3 ? "grid-cols-3" : "grid-cols-2"}`;
    return "p-4";
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
          <symbol id="i-file-text" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
        </defs>
      </svg>

      <aside id="sidebar" className="hidden lg:flex w-[200px] flex-col border-r border-border bg-sidebar shrink-0">
        <Link href="/tasks" className="flex h-16 items-center gap-2 border-b border-border px-5 w-full hover:bg-secondary transition-colors group" title="Asosiy sahifaga qaytish">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white group-hover:scale-110 transition-transform">
            <svg className="icon icon-sm"><use href="#i-graduation-cap" /></svg>
          </div>
          <div className="text-[17px] font-bold tracking-tight">Tizimli</div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {ITEMS.map((item) => {
              const hasMenu = !!item.menu;
              const showChevron = hasMenu && !item.href;
              const topLocked = !!item.href && !IMPLEMENTED_ROUTES.has(item.href);
              const rowClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-secondary";
              const inner = (
                <>
                  <svg className="icon icon-sm text-muted-foreground"><use href={`#${item.icon}`} /></svg>
                  <span className="flex-1">{item.label}</span>
                  {topLocked && lockIcon}
                  {item.badge && (
                    <span className="inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>
                  )}
                  {showChevron && (
                    <svg className="icon" style={{ width: 10, height: 10, opacity: 0.5 }}><use href="#i-chevron-down" /></svg>
                  )}
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
                    <Link href={item.href} className={rowClass} onClick={closeNow}>{inner}</Link>
                  ) : item.href && topLocked ? (
                    <a href="#" onClick={(e) => e.preventDefault()} title="Hali tayyor emas" className={rowClass} style={LOCKED_STYLE}>
                      {inner}
                    </a>
                  ) : (
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setOpenKey((prev) => (prev === item.key ? null : item.key)); }}
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

        <div className="border-t border-border p-3">
          <button className="flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] font-medium text-blue-600 hover:bg-blue-100">
            <svg className="icon icon-sm"><use href="#i-life-buoy" /></svg><span>TEXNIK YORDAM</span>
          </button>
        </div>
      </aside>

      {/* ============ FLYOUT SUBMENULAR (constants'dan) ============ */}
      {ITEMS.filter((item) => item.menu).map((item) => {
        const menu = item.menu!;
        return (
          <div
            key={item.key}
            ref={(el) => { panelRefs.current[item.key] = el; }}
            className={`flyout ${openKey === item.key ? "flyout-open" : ""} ${panelClass(menu)}`}
            style={{ width: menu.width }}
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
              {ITEMS.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.mobileHref}
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
        </aside>
      </div>
    </>
  );
}
