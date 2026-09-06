"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNavHistory } from "@/components/shared/NavigationHistory";
import { useLang } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { LANGS as LANGUAGES } from "@/lib/navbar";
import NotificationsPanel from "@/components/shared/NotificationsPanel";
import { useNotifications } from "@/components/shared/NotificationsProvider";
import { badgeLabel } from "@/lib/notifications";
import type { Lang } from "@/lib/i18n";
import { useEscapeClose } from "@/hooks/useEscapeClose";
import { searchAll } from "@/lib/search";
import type { StudentRow } from "@/lib/studentsData";
import { useBranch } from "@/components/shared/BranchContext";
import { selectPlaceholder } from "@/lib/selectPlaceholder";
import { HELP_TOPICS } from "@/constants/helpTopics";
import { formatPhoneDisplay } from "@/components/auth/PhoneField";

const FILIAL_ADD_OPTION = "Filial biriktirish ++++";

// Ported 1:1 from crm-akademiya/index-dev.html (<header> top bar) +
// crm-akademiya/src/app.js (search/lang/theme/news/create/notifications/profile
// logic around lines 1606, 6197, 6226, 6581, 6633-6768, 25419-25536).
// Icons reused from Sidebar.tsx's sprite (i-chevron-down, i-calendar, i-wallet,
// i-settings, i-monitor, i-megaphone, i-file-plus) are assumed mounted alongside
// this component; only icons unique to the header are defined below.

type OpenMenu = "lang" | "news" | "help" | "create" | "notifications" | "profile" | null;

// `short` — navbar tugmasida ko'rinadigan qisqa nom (referensda "O'zb"),
// `name` esa ochilgan ro'yxatdagi to'liq nom. LANGUAGES — constants/navbar.js
// da (mobil chekma menyu ham xuddi shundan foydalanadi).
//
// Bildirishnomalar endi bu yerda EMAS: ro'yxat ham, o'qilmaganlar soni ham
// NotificationsProvider'dan keladi va u bazadagi haqiqiy hodisalarni o'qiydi
// (app/api/notifications). Ilgari bu yerda constants/navbar.js dagi beshta
// o'ylab topilgan qator turardi.

/**
 * Profil menyusida ko'rsatiladigan minimal ma'lumot.
 *
 * Tur AYNAN shu yerda e'lon qilinadi — uni ko'rsatadigan komponent shu.
 * AppShell esa shundan import qiladi (u baribir Navbar'ni chaqiradi, ya'ni
 * yangi bog'liqlik paydo bo'lmaydi).
 */
export interface ShellUser {
  fullName: string;
  phone: string;
}

export interface NavbarProps {
  onOpenMobileMenu: () => void;
  /**
   * Joriy foydalanuvchi — app/(app)/layout.tsx dan AppShell orqali keladi.
   *
   * ILGARI bu yerdagi ism va telefon QATTIQ YOZILGAN edi, ya'ni tizimga
   * kim kirmasin profil menyusida bitta odamning ma'lumoti turardi.
   * Serverdan uzatilgani uchun alohida so'rov kerak emas va noto'g'ri ism
   * bir lahza ko'rinib, keyin almashib ketmaydi.
   */
  user?: ShellUser | null;
}

export default function Navbar({ onOpenMobileMenu, user = null }: NavbarProps) {
  // Bo'sh bo'lsa ham menyu buzilmasin: ism o'rniga chiziqcha, harf "?".
  const displayName = user?.fullName?.trim() || "—";
  const displayPhone = user?.phone ? formatPhoneDisplay(user.phone) : "";
  const initial = displayName.charAt(0).toUpperCase() || "?";
  const { canGoBack, goBack } = useNavHistory();
  const router = useRouter();
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isDark, toggleTheme] = useTheme();
  // Til endi butun ilova bo'ylab umumiy (components/shared/Language.tsx) —
  // sana tanlagichlar ham shu qiymatga qarab oy/kun nomlarini almashtiradi.
  const [lang, setLangCode] = useLang();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  // Filial tanlovi — endi mahalliy holat EMAS, umumiy kontekst.
  //
  // NIMA NOTO'G'RI EDI: tanlangan filial shu komponentning `useState` ida
  // turardi va boshqa hech qayerga yetib bormasdi — ya'ni tanlashning
  // hech qanday oqibati yo'q edi. Endi u cookie'ga yoziladi, server har
  // so'rovda o'shanga qarab ma'lumotni kesadi (lib/branchScope.ts).
  //
  // `loading` — ro'yxat hali /api/branch dan kelayotgan payt. Usiz tanlov
  // bo'sh turardi va bu "filial yo'q" degan taassurot berardi (bu CRM'dagi
  // eng ko'p ko'riladigan tanlov, har sahifada ko'rinadi).
  const { branchId, branches: allowedBranches, isAdmin, select, loading: branchLoading } = useBranch();
  // Ro'yxat qamrovga qarab keladi: xodim faqat o'ziga biriktirilganlarini
  // ko'radi. `useBranches()` (Boshqaruv → Filiallar) esa HAMMASINI beradi
  // va shu bois bu yerda ishlatilmaydi.
  const selectedBranch = String(branchId ?? "");
  const [filialModalOpen, setFilialModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Qidiruv natijalari SERVERDAN keladi (/api/search/students).
  //
  // Ilgari bu yer `useStudents()` orqali butun o'quvchilar ro'yxatini
  // yuklardi — 6 732 hujjat, ~3.6 MB. Navbar `AppShell` ichida bo'lgani
  // uchun bu HAR BIR sahifa ochilishida takrorlanardi va sahifaning eng
  // og'ir so'rovi edi. Endi sahifa ochilishida hech narsa yuklanmaydi.
  const [students, setStudents] = useState<StudentRow[]>([]);
  const query = searchQuery.trim();
  const queryReady = query.length >= 2;
  useEffect(() => {
    if (!queryReady) return;
    // `cancelled` TASHQARIDA: tozalash funksiyasi effektdan qaytishi kerak,
    // `setTimeout` ichidan qaytarilgani hech qachon chaqirilmaydi.
    let cancelled = false;
    // Har bosilgan harfga so'rov ketmasin.
    const timer = setTimeout(() => {
      fetch(`/api/search/students?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d?.ok) setStudents(d.students as StudentRow[]); })
        .catch(() => {});
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, queryReady]);

  // Qidiruv qisqa bo'lsa oldingi natijalar ko'rinib qolmasin — holatni
  // effektda tozalash o'rniga shu yerda kesamiz (ortiqcha render bo'lmaydi).
  const searchResults = useMemo(
    () => searchAll(searchQuery, queryReady ? students : []),
    [searchQuery, queryReady, students],
  );
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

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const setLang = (code: Lang) => {
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

  const onProfileAction = async (kind: "devices" | "lock" | "logout") => {
    setOpenMenu(null);
    if (kind === "devices") {
      router.push("/settings-devices");
      return;
    }
    if (kind === "lock") {
      // Sessiya saqlanadi — faqat ekran qulflanadi. Middleware shundan keyin
      // hamma sahifani /lock ga yo'naltiradi.
      await fetch("/api/auth/lock", { method: "POST" }).catch(() => {});
      router.replace("/lock");
      router.refresh();
      return;
    }
    if (kind === "logout") {
      if (!confirm("Tizimdan chiqishni xohlaysizmi?")) return;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      router.push("/");
      router.refresh();
    }
  };

  // Nishon YUKLANGUNCHA umuman chizilmaydi: noma'lum son nol EMAS, va
  // xato bo'lganda nolni ko'rsatish "bildirishnoma yo'q" degan yolg'on
  // da'vo bo'lardi.
  const { unread, unreadIsFloor, everLoaded } = useNotifications();
  const notifBadge = badgeLabel(unread, unreadIsFloor);
  const showBadge = everLoaded && unread > 0;
  useEscapeClose(filialModalOpen ? () => setFilialModalOpen(false) : () => {});

  return (
    <div ref={rootRef}>
      {/* ============ SVG SPRITE (icons unique to navbar) ============ */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="i-menu" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></symbol>
          <symbol id="i-panel-left" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></symbol>
          {/* Filial tanlagichdagi bino ikonkasi — referensda ham shunday */}
          <symbol id="i-landmark" viewBox="0 0 24 24"><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" /></symbol>
          <symbol id="i-arrow-left" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></symbol>
          <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></symbol>
          <symbol id="i-x-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></symbol>
          <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></symbol>
          <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></symbol>
          <symbol id="i-smile" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></symbol>
          <symbol id="i-frown" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></symbol>
          <symbol id="i-help-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></symbol>
          {/* Referensdagi "Qanday ishlaydi?" — video kamera */}
          <symbol id="i-video" viewBox="0 0 24 24"><path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" /></symbol>
          {/* Referensdagi "Tezkor bo'limlar" — doira ichida plyus */}
          <symbol id="i-circle-plus" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></symbol>
          <symbol id="i-user-plus" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></symbol>
          <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></symbol>
          {/* Kechikkan topshiriq bildirishnomasi. `i-clock` DEB atalmadi: u
              components/tasks/TasksPage.tsx dagi sahifa sprite'ida bor va
              ikkinchi nusxa /tasks ochiq turganda hujjatda takroriy DOM id
              hosil qilardi. */}
          <symbol id="i-clock-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></symbol>
          <symbol id="i-log-out" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></symbol>
        </defs>
      </svg>

      {/* `sticky` ATAYIN ishlatilmagan: globals.css da `header.sticky` qoidasi
          bor va u `hsl(var(--background))` fonini majburlaydi — spesifikligi
          (0,1,1) `.shell-header` (0,1,0) dan yuqori bo'lgani uchun oq fonni
          bosib ketardi. Yangi tuzilishda header allaqachon ustunli flex'ning
          eng tepasida turadi, ya'ni scroll bilan siljimaydi. */}
      <header className="shell-header relative z-30 flex shrink-0 items-center gap-2 pr-1.5">
        {/* Logo — referensda sidebar ichida emas, HEADER ichida turadi va
            kengligi sidebar kengligiga tekislanadi. */}
        <Link href="/tasks" className="shell-logo flex shrink-0 items-center gap-2" title="Asosiy sahifaga qaytish">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: "var(--shell-blue)" }}>
            <svg className="icon" style={{ width: 16, height: 16 }}><use href="#i-graduation-cap" /></svg>
          </span>
          <span className="text-[15px] font-extrabold tracking-tight" style={{ color: "var(--shell-blue)" }}>Tizimli</span>
        </Link>

        <button onClick={onOpenMobileMenu} className="nav-btn shell-only-mobile" title="Menyu">
          <svg className="icon"><use href="#i-menu" /></svg>
        </button>

        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          className="nav-btn shell-from-lg"
          title={sidebarHidden ? "Menyuni ko'rsatish" : "Menyuni yashirish"}
        >
          <svg className="icon"><use href="#i-panel-left" /></svg>
        </button>

        {/* Referensda "Orqaga" — matnsiz, faqat ikonkali 32x32 tugma */}
        <button onClick={goBack} disabled={!canGoBack} title="Orqaga" className="nav-btn nav-btn-back shell-from-sm">
          <svg className="icon"><use href="#i-arrow-left" /></svg>
        </button>

        <div className="nav-field shell-field-sm relative shrink-0" style={{ width: 200 }}>
          {/* Referensdagi kabi chapda bino ikonkasi */}
          <svg
            className="icon icon-sm pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--shell-blue)" }}
          >
            <use href="#i-landmark" />
          </svg>
          <select
            value={selectedBranch}
            onChange={(e) => {
              const v = e.target.value;
              if (v === FILIAL_ADD_OPTION) {
                setFilialModalOpen(true);
                return;
              }
              void select(Number(v));
            }}
            disabled={branchLoading}
            className="h-full w-full appearance-none bg-transparent pl-9 pr-7 text-sm focus:outline-none disabled:opacity-70"
          >
            {(branchLoading || allowedBranches.length === 0) && (
              <option value="">
                {selectPlaceholder(branchLoading, allowedBranches.length, "Filial qo'shilmagan", "Filial…")}
              </option>
            )}
            {allowedBranches.map((b) => (
              <option key={b.id} value={String(b.id)}>{b.name}</option>
            ))}
            {/* "Filial biriktirish ++++" — FAQAT ADMINGA.
                Ro'yxatning o'zi allaqachon xodimga biriktirilgan
                filiallardan iborat (lib/branchScope.ts → scope.allowed),
                ya'ni moderator o'z ish joyini ko'radi. Lekin bu qator
                undan PASTDA hammaga chiqib turardi va u yangi filial
                yaratadigan oynani ochadi — moderatorning ishi emas.
                Bosilganda serverdagi qorovul baribir to'xtatardi, ammo
                mavjud bo'lmagan imkoniyatni ko'rsatib turishning o'zi
                chalg'itadi. */}
            {isAdmin && <option>{FILIAL_ADD_OPTION}</option>}
          </select>
          <svg className="icon icon-xs pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--shell-blue)" }}><use href="#i-chevron-down" /></svg>
        </div>

        <div className="nav-field shell-field-md relative ml-1 w-full" style={{ maxWidth: 340 }} id="global-search-wrapper">
          <svg className="icon icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: "#98a2b3" }}><use href="#i-search" /></svg>
          <input
            id="global-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Qidirish..."
            autoComplete="off"
            className="h-full w-full bg-transparent pl-9 pr-16 text-sm focus:outline-none"
          />
          {searchQuery.length > 0 ? (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-secondary text-muted-foreground" title="Tozalash">
              <svg className="icon icon-xs"><use href="#i-x-circle" /></svg>
            </button>
          ) : (
            <span className="nav-kbd pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">Ctrl K</span>
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

        <div className="hidden md:flex items-center ml-auto">
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("lang"); }} className="dropdown-trigger inline-flex items-center gap-1.5 h-9 px-2 rounded-lg text-sm hover:bg-secondary" style={{ color: "var(--shell-text)" }}>
              <span className="text-base leading-none">{LANGUAGES[lang].flag}</span>
              <span className="text-sm">{LANGUAGES[lang].short}</span>
              <svg className="icon icon-xs" style={{ color: "var(--shell-blue)" }}><use href="#i-chevron-down" /></svg>
            </button>
            <div className={`${openMenu === "lang" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-44 rounded-xl border border-border bg-card shadow-xl overflow-hidden p-1`}>
              {(Object.keys(LANGUAGES) as Array<keyof typeof LANGUAGES>).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code as Lang)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium hover:bg-secondary text-left ${lang === code ? "bg-blue-50 text-primary font-semibold" : ""}`}
                >
                  <span className="text-base leading-none">{LANGUAGES[code].flag}</span><span>{LANGUAGES[code].name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Referensda o'ngdagi ikonka tugmalar 32x32, oralig'i 4px */}
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} className="nav-btn" title={isDark ? "Yorug' rejim" : "Tungi rejim"}>
            <svg className="icon"><use href={isDark ? "#i-sun" : "#i-moon"} /></svg>
          </button>
          <Link href="/birthdays" className="nav-btn shell-from-sm" title="Tug'ilgan kunlar">
            <svg className="icon"><use href="#i-calendar" /></svg>
          </Link>

          {/* News (Yangiliklar) */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("news"); }} title="Yangiliklar" className={`dropdown-trigger nav-btn shell-from-sm ${openMenu === "news" ? "is-open" : ""}`}>
              <svg className="icon"><use href="#i-megaphone" /></svg>
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

          {/* "Qanday ishlaydi?" — video qo'llanmalar ro'yxati (referens) */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMenu("help"); }}
              title="Qanday ishlaydi?"
              className={`dropdown-trigger nav-btn shell-from-sm ${openMenu === "help" ? "is-open" : ""}`}
            >
              <svg className="icon"><use href="#i-video" /></svg>
            </button>
            <div className={`${openMenu === "help" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[380px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">Qanday ishlaydi?</h3>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-1">
                {HELP_TOPICS.map((t, i) => {
                  const inner = (
                    <>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <svg className="icon icon-xs"><use href="#i-video" /></svg>
                      </span>
                      <span className="flex-1 text-[13px] leading-snug">{t.title}</span>
                    </>
                  );
                  // Havola bo'lmasa — bosilmaydigan qator (manzillar hali yo'q).
                  return t.url ? (
                    <a
                      key={i}
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-2.5 w-full px-2.5 py-2 rounded-lg hover:bg-secondary text-left"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div key={i} className="flex items-start gap-2.5 w-full px-2.5 py-2 rounded-lg text-left">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Create action (Buyurtma / Moliya) */}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("create"); }} title="Tezkor bo'limlar" className={`dropdown-trigger nav-btn shell-from-sm ${openMenu === "create" ? "is-open" : ""}`}>
              <svg className="icon"><use href="#i-circle-plus" /></svg>
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
            <button onClick={(e) => { e.stopPropagation(); toggleMenu("notifications"); }} className={`dropdown-trigger nav-btn relative ${openMenu === "notifications" ? "is-open" : ""}`} title="Bildirishnomalar">
              <svg className="icon"><use href="#i-bell" /></svg>
              {showBadge && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-white"
                  style={{ backgroundColor: "#d32f2f" }}
                >
                  {notifBadge}
                </span>
              )}
            </button>
            <div className={`${openMenu === "notifications" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[400px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">Bildirishnomalar</h3>
                {/* Ilgari bu yerda hech qayerga olib bormaydigan tishli g'ildirak
                    turardi. Haqiqiy ma'lumot yonida ishlamaydigan tugma bo'lmasin. */}
                {showBadge && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {notifBadge} yangi
                  </span>
                )}
              </div>
              <NotificationsPanel
                variant="dropdown"
                open={openMenu === "notifications"}
                onNavigate={() => setOpenMenu(null)}
              />
            </div>
          </div>

          {/* Profile */}
          <div className="relative ml-1" onMouseEnter={onProfileHoverEnter} onMouseLeave={onProfileHoverLeave}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleMenu("profile"); }}
              title={displayName}
              className={`dropdown-trigger nav-avatar transition-shadow ${openMenu === "profile" ? "ring-2 ring-blue-300" : ""}`}
            >
              {initial}
            </button>
            <div className={`${openMenu === "profile" ? "" : "hidden"} dropdown-menu absolute top-full right-0 mt-2 z-50 w-[280px] rounded-xl border border-border bg-card shadow-xl overflow-hidden`}>
              <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-base font-bold">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" title={displayName}>{displayName}</div>
                  {displayPhone && (
                    <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">{displayPhone}</div>
                  )}
                </div>
              </div>
              <div className="p-1">
                <button onClick={() => void onProfileAction("devices")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="icon icon-sm"><use href="#i-monitor" /></svg>
                  </span>
                  <span>Aktiv qurilmalar</span>
                </button>
                <button onClick={() => void onProfileAction("lock")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-secondary text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="icon icon-sm"><use href="#i-lock" /></svg>
                  </span>
                  <span>Qulflash</span>
                </button>
                <button onClick={() => void onProfileAction("logout")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 text-left">
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
