"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNavHistory } from "@/components/shared/NavigationHistory";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { searchAll } from "@/lib/search";
import { useBranches } from "@/hooks/useBranches";

const FILIAL_ADD_OPTION = "Filial biriktirish ++++";

// Ported 1:1 from crm-akademiya/index-dev.html (<header> top bar) +
// crm-akademiya/src/app.js (search/lang/theme/news/create/notifications/profile
// logic around lines 1606, 6197, 6226, 6581, 6633-6768, 25419-25536).
// Icons reused from Sidebar.tsx's sprite (i-chevron-down, i-calendar, i-wallet,
// i-settings, i-monitor, i-megaphone, i-file-plus) are assumed mounted alongside
// this component; only icons unique to the header are defined below.

type OpenMenu = "lang" | "news" | "create" | "notifications" | "profile" | null;

const LANGUAGES: Record<string, { flag: string; name: string }> = {
  uz: { flag: "🇺🇿", name: "O'zbekcha" },
  en: { flag: "🇺🇸", name: "English" },
  ru: { flag: "🇷🇺", name: "Русский" },
};

interface NotificationItem {
  title: string;
  body: string;
  time: string;
  type: string;
  unread?: boolean;
}

const NOTIFICATIONS: NotificationItem[] = [
  { title: "Yangi to'lov qabul qilindi", body: "Dilnavoz Zokirjonova — 850 000 UZS (Click)", time: "5 daqiqa oldin", type: "payment", unread: true },
  { title: "Yangi lid", body: "Bekzod Karimov telefon orqali murojaat qildi (+998 90 123 45 67)", time: "23 daqiqa oldin", type: "lead", unread: true },
  { title: "Eslatma", body: "Bugun 5 ta o'quvchining obunasi muddati tugaydi", time: "1 soat oldin", type: "reminder", unread: true },
  { title: "Yangi o'quvchi qabul qilindi", body: "Sardor To'xtayev — General English guruhiga qo'shildi", time: "2 soat oldin", type: "student" },
  { title: "Tizim yangilanishi", body: "Tug'ilgan kunlar kalendari yangi versiyasi joriy etildi", time: "Kecha", type: "system" },
];

const NOTIF_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  payment: { bg: "bg-emerald-100", text: "text-emerald-600", icon: "i-credit-card" },
  lead: { bg: "bg-blue-100", text: "text-blue-600", icon: "i-megaphone" },
  student: { bg: "bg-purple-100", text: "text-purple-600", icon: "i-user-plus" },
  reminder: { bg: "bg-amber-100", text: "text-amber-600", icon: "i-bell" },
  system: { bg: "bg-slate-100", text: "text-slate-600", icon: "i-settings" },
};

export interface NavbarProps {
  onOpenMobileMenu: () => void;
}

export default function Navbar({ onOpenMobileMenu }: NavbarProps) {
  const { canGoBack, goBack } = useNavHistory();
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [lang, setLangCode] = useState<"uz" | "en" | "ru">("uz");
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  // Filial ro'yxati Boshqaruv → Filiallar sahifasi bilan BIR XIL manbadan.
  const { branches } = useBranches();
  // `branch` — foydalanuvchi aniq tanlagani. Ko'rsatiladigan qiymat render
  // vaqtida hisoblanadi: tanlangani ro'yxatda bo'lmasa (hali yuklanmagan yoki
  // filial o'chirilgan) birinchisiga tushadi, shunda select hech qachon
  // ro'yxatda yo'q qiymatda "osilib" qolmaydi (effekt/sinxronizatsiya shart emas).
  const [branch, setBranch] = useState("");
  const selectedBranch =
    branch && branches.some((b) => b.name === branch) ? branch : (branches[0]?.name ?? "");
  const [filialModalOpen, setFilialModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useMemo(() => searchAll(searchQuery), [searchQuery]);
  const rootRef = useRef<HTMLDivElement>(null);
  const profileHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".dropdown-trigger") || target.closest(".dropdown-menu")) return;
      setOpenMenu(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openMenu]);

  const toggleSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    document.body.classList.toggle("sidebar-hidden", next);
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const setLang = (code: "uz" | "en" | "ru") => {
    setLangCode(code);
    setOpenMenu(null);
  };

  const onProfileHoverEnter = () => {
    if (profileHoverTimer.current) {
      clearTimeout(profileHoverTimer.current);
      profileHoverTimer.current = null;
    }
    setOpenMenu("profile");
  };

  const onProfileHoverLeave = () => {
    profileHoverTimer.current = setTimeout(() => {
      setOpenMenu((prev) => (prev === "profile" ? null : prev));
      profileHoverTimer.current = null;
    }, 220);
  };

  const onProfileAction = (kind: "devices" | "lock" | "logout") => {
    setOpenMenu(null);
    if (kind === "devices") {
      alert("Aktiv qurilmalar ro'yxati ochilishi kerak.\n\n(Haqiqiy loyihada bu yerda foydalanuvchining barcha qurilmalari ro'yxati va sessiyalarni boshqarish dialogi ochiladi.)");
    } else if (kind === "lock") {
      alert("Tizim qulflandi.\n\n(Haqiqiy loyihada login ekraniga qaytaradi, ammo sessiyani saqlab qoladi.)");
    } else if (kind === "logout") {
      if (confirm("Tizimdan chiqishni xohlaysizmi?")) {
        fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          router.push("/");
          router.refresh();
        });
      }
    }
  };

  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;
  useEscapeClose(filialModalOpen ? () => setFilialModalOpen(false) : () => {});

  return (
    <div ref={rootRef}>
      {/* ============ SVG SPRITE (icons unique to navbar) ============ */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-menu" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></symbol>
          <symbol id="i-panel-left" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></symbol>
          <symbol id="i-arrow-left" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></symbol>
          <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></symbol>
          <symbol id="i-x-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></symbol>
          <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></symbol>
          <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></symbol>
          <symbol id="i-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></symbol>
          <symbol id="i-frown" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></symbol>
          <symbol id="i-help-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
          <symbol id="i-user-plus" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></symbol>
          <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></symbol>
          <symbol id="i-log-out" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></symbol>
        </defs>
      </svg>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-5">
        <button onClick={onOpenMobileMenu} className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary">
          <svg className="icon icon-sm"><use href="#i-menu" /></svg>
        </button>

        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          className="hidden lg:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors"
          title={sidebarHidden ? "Menyuni ko'rsatish" : "Menyuni yashirish"}
        >
          <svg className="icon icon-sm"><use href="#i-panel-left" /></svg>
        </button>

        <button onClick={goBack} disabled={!canGoBack} className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity disabled:bg-primary/40 disabled:cursor-not-allowed">
          <svg className="icon icon-sm text-white"><use href="#i-arrow-left" /></svg> <span>Orqaga</span>
        </button>

        <div className="relative">
          <select
            value={selectedBranch}
            onChange={(e) => {
              if (e.target.value === FILIAL_ADD_OPTION) {
                setFilialModalOpen(true);
                return;
              }
              setBranch(e.target.value);
            }}
            className="h-9 w-36 appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {branches.length === 0 && <option value="">Filial…</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
            <option>{FILIAL_ADD_OPTION}</option>
          </select>
          <svg className="icon icon-sm pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </div>

        <div className="relative ml-2 max-w-md flex-1" id="global-search-wrapper">
          <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10"><use href="#i-search" /></svg>
          <input
            id="global-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Qidirish ..."
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery.length > 0 && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground" title="Tozalash">
              <svg className="icon icon-xs"><use href="#i-x-circle" /></svg>
            </button>
          )}
          {searchQuery.trim().length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-2 z-[150] rounded-xl border border-border shadow-2xl max-h-[70vh] overflow-y-auto"
              style={{ backgroundColor: "hsl(var(--card))", backdropFilter: "blur(24px) saturate(180%)" }}
            >
              {searchResults.length > 0 ? (
                <ul className="p-1.5">
                  <li className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Natijalar ({searchResults.length})
                  </li>
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={r.href}
                        onClick={() => setSearchQuery("")}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                          <svg className="icon icon-sm"><use href="#i-search" /></svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {r.category}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                  <svg className="w-8 h-8 mx-auto text-muted-foreground mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><use href="#i-frown" /></svg>
                  <div className="text-sm text-muted-foreground">Natija topilmadi</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1 ml-auto">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("lang"); }} className="dropdown-trigger inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-sm hover:bg-secondary">
              <span className="text-base leading-none">{LANGUAGES[lang].flag}</span>
              <span className="text-sm">{LANGUAGES[lang].name}</span>
              <svg className="icon icon-xs text-muted-foreground"><use href="#i-chevron-down" /></svg>
            </button>
            <div className={`${openMenu === "lang" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-44 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1`}>
              {(Object.keys(LANGUAGES) as Array<keyof typeof LANGUAGES>).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code as "uz" | "en" | "ru")}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary text-left ${lang === code ? "bg-blue-50 text-primary font-semibold" : ""}`}
                >
                  <span className="text-base leading-none">{LANGUAGES[code].flag}</span><span>{LANGUAGES[code].name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={toggleTheme} className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary">
            <svg className="icon icon-sm"><use href={isDark ? "#i-sun" : "#i-moon"} /></svg>
          </button>
          <Link href="/birthdays" className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors">
            <svg className="icon icon-sm"><use href="#i-calendar" /></svg>
          </Link>

          {/* News (Yangiliklar) */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("news"); }} className={`dropdown-trigger hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors ${openMenu === "news" ? "bg-secondary text-primary" : ""}`}>
              <svg className="icon icon-sm"><use href="#i-smile" /></svg>
            </button>
            <div className={`${openMenu === "news" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[340px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">Yangiliklar</h3>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="text-muted-foreground mb-2"><svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><use href="#i-frown" /></svg></div>
                  <div className="text-base font-medium">Yangilik yo&apos;q</div>
                </div>
              </div>
            </div>
          </div>

          <button className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary"><svg className="icon icon-sm"><use href="#i-help-circle" /></svg></button>

          {/* Create action (Buyurtma / Moliya) */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("create"); }} className={`dropdown-trigger hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors ${openMenu === "create" ? "bg-secondary text-primary" : ""}`}>
              <svg className="icon icon-sm"><use href="#i-file-plus" /></svg>
            </button>
            <div className={`${openMenu === "create" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-52 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1`}>
              <Link href="/orders-new" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left" onClick={() => setOpenMenu(null)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <svg className="icon icon-sm"><use href="#i-user-plus" /></svg>
                </span>
                <span>Buyurtma yaratish</span>
              </Link>
              <Link href="/finance-payment-new" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left" onClick={() => setOpenMenu(null)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <svg className="icon icon-sm"><use href="#i-wallet" /></svg>
                </span>
                <span>Moliya bo&apos;limi</span>
              </Link>
            </div>
          </div>

          {/* Notifications */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("notifications"); }} className={`dropdown-trigger relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-secondary transition-colors ${openMenu === "notifications" ? "bg-secondary text-primary" : ""}`}>
              <svg className="icon icon-sm"><use href="#i-bell" /></svg>
              {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
            </button>
            <div className={`${openMenu === "notifications" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[400px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">Notifications</h3>
                <button className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-secondary text-muted-foreground" title="Sozlamalar">
                  <svg className="icon icon-sm"><use href="#i-settings" /></svg>
                </button>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                <ul className="divide-y divide-border">
                  {NOTIFICATIONS.map((n, i) => {
                    const s = NOTIF_STYLES[n.type];
                    return (
                      <li key={i} className={`px-4 py-3 hover:bg-secondary cursor-pointer ${n.unread ? "bg-blue-50/40" : ""}`}>
                        <div className="flex items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.bg} ${s.text}`}>
                            <svg className="icon icon-sm"><use href={`#${s.icon}`} /></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium truncate">{n.title}</div>
                              {n.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">{n.time}</div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="relative ml-1" onMouseEnter={onProfileHoverEnter} onMouseLeave={onProfileHoverLeave}>
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("profile"); }} className={`dropdown-trigger flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold hover:ring-2 hover:ring-blue-200 transition-shadow ${openMenu === "profile" ? "ring-2 ring-blue-300" : ""}`}>
              A
            </button>
            <div className={`${openMenu === "profile" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[280px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-base font-bold">A</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">Abdulloh Raxmatullayev</div>
                  <div className="text-xs text-muted-foreground mt-0.5">+998 94 155 88 55</div>
                </div>
              </div>
              <div className="p-1">
                <button onClick={() => onProfileAction("devices")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="icon icon-sm"><use href="#i-monitor" /></svg>
                  </span>
                  <span>Aktiv qurilmalar</span>
                </button>
                <button onClick={() => onProfileAction("lock")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="icon icon-sm"><use href="#i-lock" /></svg>
                  </span>
                  <span>Qulflash</span>
                </button>
                <button onClick={() => onProfileAction("logout")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <svg className="icon icon-sm"><use href="#i-log-out" /></svg>
                  </span>
                  <span>Chiqish</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {filialModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={() => setFilialModalOpen(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-5 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Filial biriktirish</h3>
            <p className="text-sm text-muted-foreground">
              Filiallar Boshqaruv &rarr; Filiallar sahifasida boshqariladi. U yerda qo&apos;shilgan
              filial shu ro&apos;yxatda ham paydo bo&apos;ladi.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setFilialModalOpen(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border bg-card hover:bg-secondary text-sm font-medium"
              >
                Yopish
              </button>
              <Link
                href="/management-filiallar"
                onClick={() => setFilialModalOpen(false)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90"
              >
                Filiallar sahifasi
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
