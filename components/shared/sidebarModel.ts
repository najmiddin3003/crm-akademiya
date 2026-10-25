import { SIDEBAR_ITEMS } from "@/constants/sidebar";
import { isPathAllowed } from "@/lib/permissions";

// YON MENYU MODELI — eski (components/shared/Sidebar.tsx) va yangi
// (components/v2/shell/SidebarV2.tsx) menyu BITTA qoidadan chiziladi:
// qaysi bo'lim kimga ko'rinadi, qaysi sahifa hali qurilmagan. 17.10.2026 da
// Sidebar.tsx dan ko'chirildi (mazmuni o'zgarmagan) — ikki menyuda ikki xil
// ruxsat filtri bo'lsa, vaqt o'tib biri ikkinchisidan ajralib qolardi.

export interface SidebarMenuItem {
  label: string;
  href: string;
  icon?: string;
  iconClass?: string;
  bold?: boolean;
  medium?: boolean;
  semibold?: boolean;
  primary?: boolean;
  /** Sanoq kaliti — son /api/sidebar-counts dan keladi (constants/sidebar.js). */
  countKey?: string;
  type?: "highlight" | "action" | "text";
  truncate?: boolean;
}
export interface SidebarMenuColumn {
  title?: string;
  items: SidebarMenuItem[];
}
export interface SidebarMenu {
  variant: "list" | "grid" | "reports";
  width: number;
  cols?: number;
  items?: SidebarMenuItem[];
  columns?: SidebarMenuColumn[];
}
export interface SidebarItem {
  key: string;
  icon: string;
  label: string;
  href?: string;
  mobileHref: string;
  /** Qizil belgi uchun sanoq kaliti. Bitta kalit desktop va mobil menyuga ham xizmat qiladi. */
  badgeKey?: string;
  mobileActive?: boolean;
  menu?: SidebarMenu;
  /** Vaqtincha olib turilgan bo'lim — constants/sidebar.js dagi izohga qarang. */
  hidden?: boolean;
  /**
   * Faqat admin ko'radigan bo'lim (`users.role === "admin"`).
   *
   * Ruxsatlar daraxti bilan ifodalab bo'lmaydi: u yerda "cheklov yo'q"
   * (`permissions === null`) HAMMA narsa ochiq degani, ya'ni ro'yxati
   * sozlanmagan rol bunday bo'limni ham ko'raverardi. lib/adminOnly.ts.
   */
  adminOnly?: boolean;
  /**
   * Modulga bog'langan bo'lim (masalan "gamification"): modul yoqilganda
   * hammaga, o'chiq paytda faqat adminga ko'rinadi — admin uni yoqishdan
   * oldin ko'rib chiqa olsin. Holat layout'dan keladi (`features`).
   */
  feature?: string;
}

// `hidden` shu YAGONA joyda kesiladi — kompyuter menyusi ham, mobil menyu
// ham quyidagi bitta `items` dan chiziladi. Ruxsatlar daraxti
// (lib/permissions.ts) esa SIDEBAR_ITEMS ni to'g'ridan-to'g'ri o'qiydi va
// bu filtrga tegmaydi: yashirilgan bo'lim ruxsat sifatida saqlanib
// qoladi, ya'ni qaytarilganda rollarni qaytadan sozlash kerak bo'lmaydi.
export const ITEMS = (SIDEBAR_ITEMS as SidebarItem[]).filter((i) => !i.hidden);

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
export function filterByPermissions(items: SidebarItem[], permissions: string[] | null): SidebarItem[] {
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

/**
 * Xodim ko'ra oladigan bo'limlar. Bu FAQAT ko'rinish: haqiqiy to'siq
 * app/(app)/layout.tsx da (va `adminOnly` bo'limlar uchun sahifaning
 * o'zida), server tomonda.
 *
 * `adminOnly` ruxsat filtridan ALOHIDA kesiladi: u ruxsatlar daraxtida
 * yo'q (lib/permissions.ts uni ataylab tushirmaydi), ya'ni cheklovsiz
 * rol uchun `filterByPermissions` uni o'tkazib yuborardi.
 */
export function visibleSidebarItems(
  permissions: string[] | null,
  isAdmin: boolean,
  features: Record<string, boolean> | undefined,
): SidebarItem[] {
  const gamOn = !!features?.gamification;
  return filterByPermissions(
    ITEMS.filter((i) => (!i.adminOnly || isAdmin) && (!i.feature || isAdmin || (i.feature === "gamification" && gamOn))),
    permissions,
  );
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
export const IMPLEMENTED_ROUTES = new Set([
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
  "/nazorat-davomat", "/nazorat-davomat-analytics", "/nazorat-qr", "/nazorat-feedback", "/nazorat-staff-rating",
  "/nazorat-missed-groups", "/nazorat-branches", "/nazorat-turnstile", "/nazorat-turnstile-io", "/nazorat-support-analytics",
  "/nazorat-sms-analytics",
  // Boshqaruv
  "/management-xodimlar", "/management-cv", "/management-rollar", "/management-filiallar", "/management-ish-jadvali",
  // Sotuv va marketing
  "/sales-marketing", "/sales-sources", "/sales-plan", "/sales-news", "/sales-stories", "/sales-sms", "/sales-messages",
  // Hisobotlar (finance-*/nazorat-* takrorlari yuqorida bor)
  "/reports-funnel", "/reports-balance", "/reports-unpaid", "/reports-diff-payments", "/reports-cancelled", "/reports-discounts",
  "/reports-teachers-perf", "/reports-admins-perf", "/reports-leave-reasons", "/reports-rooms", "/reports-served", "/reports-cancelled-attend",
  // Hisobotlar katalogi (yangi versiya, 25.10.2026) — menyuda faqat yangi versiyada
  // (components/v2/shell/sidebarSections.ts → V2_EXTRA_ITEMS).
  "/reports",
  // Sozlamalar
  "/settings-general", "/settings-finance", "/settings-academic", "/settings-sales",
  "/settings-management", "/settings-integrations", "/settings-app", "/settings-gamification",
  "/settings-profile", "/settings-security",
  // Gamifikatsiya (TZ v1.4, 26.09.2026 dan bosqichma-bosqich)
  "/gamification-lesson", "/gamification-students", "/gamification-ranking", "/gamification-competition", "/gamification-shop",
  // Vaqtinchalik tugma (faqat admin)
  "/vaqtinchalik",
  // Amallar jurnali (faqat admin, 10.10.2026) — ro'yxatga qo'shilmay qolgani
  // uchun sidebar'da «Hali tayyor emas» qulfi bilan turardi (12.10.2026).
  "/amallar-jurnali",
]);

/**
 * Havola hali qurilmagan sahifaga qaraydimi. Havolada so'rov qismi bo'lishi
 * mumkin (masalan "/imtihon?tab=uzbmb") — ro'yxat faqat sahifa yo'li bilan
 * solishtiriladi.
 */
export function isLockedRoute(href: string): boolean {
  return !IMPLEMENTED_ROUTES.has(href.split("?")[0]);
}
