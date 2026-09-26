import { SIDEBAR_ITEMS } from "@/constants/sidebar";

// Boshqaruv → Rollar dagi "Ko'rinadigan bo'limlar" sozlamasining yagona
// manbasi. Rolga biriktirilgan ruxsat = sahifaning PATHNAME'i (masalan
// "/finance-cash"), ya'ni sidebar havolasining aynan o'zi.
//
// Ro'yxat QO'LDA yozilmaydi — constants/sidebar.js dan hosil qilinadi. Shu
// sabab sidebarga yangi sahifa qo'shilishi bilan u ruxsatlar daraxtida ham
// paydo bo'ladi; ikki joyni qo'lda sinxron ushlab turish shart emas.
//
// SEMANTIKA (butun loyihada bir xil):
//   permissions === null  → cheklov YO'Q, hamma bo'lim ochiq
//   permissions === [...] → aynan shu ro'yxatdagi bo'limlar
// `roles` hujjatida maydon umuman bo'lmasa ham null deb qaraladi — shu
// tufayli bu funksiya qo'shilgunga qadar yaratilgan rollar va ularga
// biriktirilgan xodimlar hech narsa yo'qotmaydi.

/** Proxy → (app) layout'ga joriy pathname'ni uzatuvchi sarlavha. */
export const PATHNAME_HEADER = "x-tizimli-pathname";

export interface PermissionItem {
  /** Ruxsat kaliti — bir bo'lakli pathname, masalan "/finance-cash". */
  href: string;
  label: string;
  /** Doim ochiq (galochkasi o'chirib bo'lmaydi) — ALWAYS_ALLOWED_PATHS. */
  always: boolean;
  /** Sahifa hammaga ochiq, galochka rahbar rejimini beradi — SELF_SERVICE_PATHS. */
  selfService: boolean;
}

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionItem[];
}

/**
 * Rol nimani taqiqlashidan qat'i nazar ochiq qoladigan sahifalar.
 *
 * Profil / Xavfsizlik / Qurilmalar — foydalanuvchi o'z parolini almashtira
 * olishi va sessiyalarini ko'ra olishi SHART, aks holda noto'g'ri sozlangan
 * rol odamni o'z hisobidan butunlay ajratib qo'yardi.
 *
 * Tug'ilgan kunlar va Dars jadvali sidebar daraxtida umuman yo'q (ular
 * navbardan ochiladi), ya'ni ularni ruxsatlar oynasidan belgilab ham
 * bo'lmasdi — shu sabab ochiq qoldiriladi.
 */
export const ALWAYS_ALLOWED_PATHS = new Set([
  "/settings-profile",
  "/settings-security",
  "/settings-devices",
  "/birthdays",
  // BOSH SAHIFA. Sidebar daraxtida "/home" bandi yo'q, ya'ni uni hech bir
  // rolda belgilab bo'lmaydi — ochiq qoldirilmasa proxy.ts dagi sahifa
  // qorovuli uni HAMMAGA yopib qo'yardi va hamma yo'naltirish halqaga
  // tushardi (`firstAllowedPath` ham "/home" ni qaytaradi).
  "/home",
  // Eski manzil — endi "/home" ga yo'naltiradi, lekin yo'naltirish ishga
  // tushishi uchun route'ning o'zi ochiq bo'lishi kerak.
  "/dashboard",
  // GAMIFIKATSIYA (TZ v1.4, 26.09.2026). Kim nimani ko'rishi va qila olishi
  // TZ 3-bo'limidagi rollar bo'yicha (direktor / filial admini / ustoz)
  // SERVERDA kesiladi (lib/gamification/*). Rollar oynasida yopilsa, TZ
  // bo'yicha huquqi bor ustoz yoki admin o'z ishini qila olmay qolardi.
  "/gamification-lesson",
  "/gamification-students",
  "/gamification-ranking",
  "/gamification-competition",
]);

/**
 * HAMMAGA OCHIQ, LEKIN RUXSAT KALITI SAQLANADIGAN sahifalar.
 *
 * `ALWAYS_ALLOWED_PATHS` dan FARQI: u yerdagi sahifa rollar oynasida
 * "doim ochiq" bo'lib, kaliti hech narsani anglatmaydi. Bu yerdagisini esa
 * HAR BIR xodim ochadi, kalit esa rollar oynasida belgilanadigan bo'lib
 * qoladi va sahifa ICHIDA boshqa ma'noni beradi.
 *
 * /tasks (23.09.2026 qarori): topshiriq har bir xodimga beriladi, ya'ni
 * o'qituvchi ham o'z topshirig'ini ko'rishi va «Bajardim» bosishi kerak.
 * "/tasks" ruxsati endi RAHBAR rejimi — boshqalarga topshiriq berish,
 * tasdiqlash va filial bo'yicha ko'rish (lib/staffTasksServer.ts).
 *
 * Kalitni "bor-yo'q" deb tekshirish uchun `isPathAllowed` EMAS,
 * `hasSectionPermission` ishlatilsin — birinchisi bu sahifalar uchun HAR
 * DOIM `true`. API qorovuli (proxy.ts) esa allaqachon ro'yxatning o'zini
 * tekshiradi, ya'ni "/tasks" ga bog'langan route'lar rahbarlarga qoladi.
 */
export const SELF_SERVICE_PATHS = new Set(["/tasks"]);

/**
 * Sidebarda o'z havolasi bo'lmagan, ammo boshqa sahifadan ochiladigan
 * route'lar. O'quvchi kartochkasi (/student-edit/:id) o'nlab joydan
 * ochiladi — u "O'quvchilar ro'yxati" ruxsatiga bog'lanadi, aks holda
 * ro'yxatni ko'ra oladigan xodim kartochkani ocholmay qolardi.
 */
const ROUTE_ALIASES: Record<string, string> = {
  "/student-edit": "/students-list",
};

interface RawItem { label: string; href?: string }
interface RawTop {
  key: string;
  label: string;
  href?: string;
  menu?: { items?: RawItem[]; columns?: { items: RawItem[] }[] };
  /** Faqat adminga ochiq bo'lim — ruxsatlar daraxtiga TUSHMAYDI. */
  adminOnly?: boolean;
}

/** "/imtihon?tab=uzbmb" → "/imtihon" */
function stripQuery(href: string): string {
  return href.split("?")[0];
}

export const PERMISSION_GROUPS: PermissionGroup[] = (SIDEBAR_ITEMS as RawTop[])
  // "Faqat admin" bo'limlari daraxtga UMUMAN kirmaydi. Kirsa — ularni
  // moderator roliga belgilab qo'yish mumkin bo'lardi va "faqat admin"
  // degan va'da rollar oynasidan buzilardi. Adminlik boshqa o'lchov
  // (`users.role`), lib/adminOnly.ts ga qarang.
  .filter((top) => !top.adminOnly)
  .map((top) => {
    const flat = top.menu?.items ?? top.menu?.columns?.flatMap((c) => c.items) ?? [];
    // Menyu elementlari BIRINCHI: "Sozlamalar" ning o'z href'i menyudagi
    // "Umumiy sozlamalar" bilan bir xil, va aniqroq yorliq menyudagisi.
    const raw = [...flat, ...(top.href ? [{ href: top.href, label: top.label }] : [])];
    const seen = new Set<string>();
    const items: PermissionItem[] = [];
    for (const r of raw) {
      if (!r.href) continue;
      const href = stripQuery(r.href);
      if (seen.has(href)) continue;
      seen.add(href);
      items.push({ href, label: r.label, always: ALWAYS_ALLOWED_PATHS.has(href), selfService: SELF_SERVICE_PATHS.has(href) });
    }
    return { key: top.key, label: top.label, items };
  })
  .filter((g) => g.items.length > 0);

/**
 * Belgilanishi mumkin bo'lgan barcha ruxsatlar (doim ochiqlari kirmaydi).
 *
 * TAKRORSIZ. Ba'zi sahifalar sidebarda ikki bo'limda turadi (masalan
 * "Kirim chiqim" — Moliya va Hisobotlarda), lekin ular BITTA sahifa.
 * Takrorlar qolsa bu ro'yxatning uzunligi "jami sahifalar soni" sifatida
 * ishlatiladigan hamma joyda yolg'on maxraj berardi va "hammasi
 * belgilandi" tekshiruvi hech qachon to'g'ri chiqmasdi.
 */
export const ALL_PERMISSION_PATHS: string[] = [
  ...new Set(
    PERMISSION_GROUPS
      .flatMap((g) => g.items)
      .filter((i) => !i.always)
      .map((i) => i.href),
  ),
];

const KNOWN = new Set(ALL_PERMISSION_PATHS);

/**
 * Ixtiyoriy URL'ni ruxsat kalitiga keltiradi. Sidebardagi HAR BIR havola
 * bir bo'lakli ("/finance-cash"), shuning uchun birinchi bo'lak yetarli:
 * "/management-xodimlar/12" → "/management-xodimlar",
 * "/finance-payroll/history" → "/finance-payroll".
 */
export function permissionKeyOf(pathname: string): string {
  const clean = stripQuery(pathname);
  const first = `/${clean.split("/")[1] ?? ""}`;
  return ROUTE_ALIASES[first] ?? first;
}

/** Mijozdan kelgan ro'yxatni faqat haqiqiy, takrorlanmagan kalitlarga keltiradi. */
export function sanitizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const key = permissionKeyOf(v);
    if (KNOWN.has(key)) out.add(key);
  }
  return [...out];
}

/** `roles` hujjatidagi maydonni yagona semantikaga keltiradi. */
export function readPermissions(raw: unknown): string[] | null {
  return Array.isArray(raw) ? sanitizePermissions(raw) : null;
}

export function isPathAllowed(pathname: string, permissions: string[] | null): boolean {
  if (permissions === null) return true;
  const key = permissionKeyOf(pathname);
  if (ALWAYS_ALLOWED_PATHS.has(key) || SELF_SERVICE_PATHS.has(key)) return true;
  return permissions.includes(key);
}

/**
 * Bo'lim RUXSATI rostdan bormi — sahifaga kira olishidan qat'i nazar.
 * `SELF_SERVICE_PATHS` dagi sahifalar ichida "rahbarmi, oddiy xodimmi"
 * degan savol shu bilan hal qilinadi.
 */
export function hasSectionPermission(pathname: string, permissions: string[] | null): boolean {
  if (permissions === null) return true;
  return permissions.includes(permissionKeyOf(pathname));
}

/**
 * Taqiqlangan sahifaga kirmoqchi bo'lgan xodim QAYERGA yuboriladi.
 *
 * Bu doim RUXSAT ETILGAN manzil bo'lishi shart — aks holda yo'naltirish
 * o'zini qayta taqiqlab, cheksiz redirect halqasi hosil qilardi.
 *
 * "/home" — bosh sahifa va u ALWAYS_ALLOWED_PATHS ichida, ya'ni ruxsati
 * qanday bo'lishidan qat'i nazar HAR DOIM ochiq. Shuning uchun bu yerda
 * ruxsat ro'yxatini aylanib chiqish kerak emas: ilgari funksiya
 * xodimning BIRINCHI ruxsat etilgan sahifasini qaytarardi va odam
 * taqiqlangan manzildan tasodifiy bir bo'limga tushib qolardi. Endi u
 * har doim bosh sahifaga qaytadi.
 *
 * `permissions` parametri saqlanadi — chaqiruv joylari o'zgarmasin va
 * kelajakda qoida murakkablashsa shu yerda hal qilinsin.
 */
export function firstAllowedPath(_permissions: string[] | null): string {
  return "/home";
}
