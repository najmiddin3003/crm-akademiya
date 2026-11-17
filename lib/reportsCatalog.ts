// «HISOBOTLAR» KATALOGI (yangi versiya, 15-qism — rasm «Hisobotlar katalogi», 25.10.2026).
//
// To'qqizta hisobot, to'rt guruhda (35-qismdan — 16 ta, olti guruhda + boshqa bo'limlarga havolalar). Har biri `/reports/<slug>` da ochiladi va
// Excel hamda PDF'ga yuklanadi. Mijoz ham, server ham shu ro'yxatdan o'qiydi.
//
// RUXSAT: `/reports` sidebar daraxtida YO'Q (lib/permissions.ts → ALWAYS_ALLOWED_PATHS,
// Bosh sahifa bilan bir xil sabab), shuning uchun har hisobot O'Z ESKI SAHIFASINING
// ruxsati bilan ochiladi (`perms` — ulardan BITTASI bo'lsa yetarli). Rollar oynasida
// yangi galochka paydo bo'lmaydi: Qarzdorlarni ko'ra oladigan xodim yangi Qarzdorlar
// hisobotini ham ko'radi, boshqasini — yo'q. Ma'lumot API'lari ham o'sha ruxsatlarga
// bog'langan (lib/apiPermissions.generated.ts).

import { isPathAllowed } from "@/lib/permissions";

export type ReportGroupKey = "finance" | "flow" | "staff" | "sales" | "attendance" | "resources";

export interface ReportGroup {
  key: ReportGroupKey;
  label: string;
}

// 35-qism (17.11.2026): «Davomat» guruhi «O'quv sifati» bo'ldi (samaradorlik hisobotlari qo'shildi), yangi
// guruhlar — «Sotuv» va «Resurslar». Tartib — katalog ustunlari tartibi.
export const REPORT_GROUPS: readonly ReportGroup[] = [
  { key: "finance", label: "Moliya" },
  { key: "flow", label: "O'quvchilar oqimi" },
  { key: "staff", label: "Xodimlar va oylik" },
  { key: "sales", label: "Sotuv" },
  { key: "attendance", label: "O'quv sifati" },
  { key: "resources", label: "Resurslar" },
];

export type ReportSlug =
  | "kirim-chiqim"
  | "qarzdorlar"
  | "tolov-turlari"
  | "kelgan-ketgan"
  | "faol-oquvchilar"
  | "davomat-guruhlar"
  | "davomat-oqituvchilar"
  | "oylik-avans"
  | "bonus-jarima"
  | "chegirmalar"
  | "ketish-sabablari"
  | "ustozlar-tushumi"
  | "sotuv-voronkasi"
  | "oqituvchilar-samaradorligi"
  | "adminlar-samaradorligi"
  | "xonalar";

export interface ReportDef {
  slug: ReportSlug;
  group: ReportGroupKey;
  title: string;
  /** Kartadagi izoh (rasmdagi matn). */
  about: string;
  /** Sahifa sarlavhasi (h1), karta nomidan farq qilsa — masalan «Davomat — guruhlar bo'yicha».
   *  Berilsa, izoh oldiga guruh nomi qo'shilmaydi (u sarlavhada bor). */
  heading?: string;
  /** Sahifa sarlavhasi ostidagi izoh: «guruh · …». */
  subtitle: string;
  /** Eski sahifa ruxsatlari — bittasi yetarli. */
  perms: readonly string[];
}

export const REPORTS: readonly ReportDef[] = [
  {
    slug: "kirim-chiqim",
    group: "finance",
    title: "Kirim va chiqim",
    about: "Oylar va kassalar bo'yicha, xarajat toifalari bilan",
    subtitle: "oyma-oy tushum va xarajat",
    perms: ["/finance-cashflow"],
  },
  {
    slug: "qarzdorlar",
    group: "finance",
    title: "Qarzdorlar",
    about: "Kim, qancha va necha oydan beri qarz",
    subtitle: "qarzi bor o'quvchilar, eng kattasi tepada",
    perms: ["/reports-unpaid"],
  },
  {
    slug: "tolov-turlari",
    group: "finance",
    title: "To'lov turlari",
    about: "Naqd, plastik, terminal, inkassa ulushi",
    subtitle: "tushum qaysi to'lov turida kelgani",
    perms: ["/finance-cashflow"],
  },
  {
    slug: "kelgan-ketgan",
    group: "flow",
    title: "Kelgan va ketgan",
    about: "Oyma-oy, filial va kurs kesimida",
    subtitle: "guruhga kelgan va guruhdan ketgan o'quvchilar",
    perms: ["/sales-sources"],
  },
  {
    slug: "faol-oquvchilar",
    group: "flow",
    title: "Faol o'quvchilar",
    about: "Kurs, guruh va o'qituvchi bo'yicha",
    subtitle: "hozir guruhda o'qiyotganlar",
    perms: ["/active-students", "/groups"],
  },
  {
    slug: "davomat-guruhlar",
    group: "attendance",
    title: "Guruhlar bo'yicha",
    heading: "Davomat — guruhlar bo'yicha",
    about: "Qatnashish foizi va qoldirilgan darslar",
    subtitle: "guruhlarning qatnashish foizi",
    perms: ["/nazorat-davomat-analytics"],
  },
  {
    slug: "davomat-oqituvchilar",
    group: "attendance",
    title: "O'qituvchilar bo'yicha",
    heading: "Davomat — o'qituvchilar bo'yicha",
    about: "Belgilangan darslar va dars jurnali",
    subtitle: "o'qituvchilar davomatni belgilagani",
    perms: ["/nazorat-missed-groups", "/nazorat-davomat-analytics"],
  },
  {
    slug: "oylik-avans",
    group: "staff",
    title: "Oylik va avans",
    about: "Jami oylik / Jami avans / Qolgan oylik",
    subtitle: "Oylik chiqarish sahifasi bilan bir xil raqamlar",
    perms: ["/finance-payroll"],
  },
  {
    slug: "bonus-jarima",
    group: "staff",
    title: "Bonus va jarimalar",
    about: "Bonuslar, topshiriq va kechikish jarimalari",
    subtitle: "xodimlarga yozilgan bonus va jarimalar",
    perms: ["/finance-bonus", "/finance-penalty"],
  },
  {
    slug: "chegirmalar",
    group: "finance",
    title: "Chegirma va istisnolar",
    about: "Chegirma, alohida narx, kechirilgan qarz",
    subtitle: "kurs narxidan kam olingan har bir so'm — chegirma, alohida narx, kechirilgan qarz va bekor qilingan dars haqi",
    perms: ["/reports-discounts"],
  },
  {
    slug: "ketish-sabablari",
    group: "flow",
    title: "Ketish sabablari",
    about: "Kim, qachon va nega ketdi",
    subtitle: "guruhdan chiqarilgan o'quvchilar — kim, qachon va nega ketdi",
    perms: ["/reports-leave-reasons"],
  },
  {
    slug: "ustozlar-tushumi",
    group: "staff",
    title: "Ustozlar tushumi",
    about: "Tushum, oylik ulushi va markazga qolgani",
    subtitle: "har bir ustoz guruhlaridan tushgan to'lov, unga hisoblangan oylik va markazga qolgan qism",
    perms: ["/finance-payroll", "/reports-served"],
  },
  {
    slug: "sotuv-voronkasi",
    group: "sales",
    title: "Sotuv voronkasi",
    about: "Liddan birinchi to'lovgacha, yopilish sabablari",
    subtitle: "lid yozilganidan birinchi to'lovgacha — har bosqichda qancha qoldi va nega ketdi",
    perms: ["/reports-funnel"],
  },
  {
    slug: "oqituvchilar-samaradorligi",
    group: "attendance",
    title: "O'qituvchilar samaradorligi",
    about: "O'quvchilarni saqlab qolish",
    subtitle: "har bir ustozda o'quvchilar qanchalik qolmoqda — davr boshi, o'zgarishlar va davr oxiri",
    perms: ["/reports-teachers-perf"],
  },
  {
    slug: "adminlar-samaradorligi",
    group: "attendance",
    title: "Administratorlar samaradorligi",
    about: "Liddan o'quvchiga va birinchi javob tezligi",
    subtitle: "lidni o'quvchiga aylantirish va birinchi javob tezligi",
    perms: ["/reports-admins-perf"],
  },
  {
    slug: "xonalar",
    group: "resources",
    title: "Xonalar bandligi",
    about: "Qaysi xona qachon bo'sh",
    subtitle: "qaysi xona qachon band — yangi guruh uchun bo'sh vaqtni toping",
    perms: ["/reports-rooms"],
  },
];

/** Katalogdagi boshqa bo'limlarga havolalar (hisobot emas — o'z sahifasi bor). */
export interface ReportLink {
  key: string;
  group: ReportGroupKey | "nazorat";
  title: string;
  about: string;
  href: string;
  perms: readonly string[];
}
export const REPORT_LINKS: readonly ReportLink[] = [
  { key: "tushum-rejasi", group: "finance", title: "Tushum rejasi", about: "Yig'ilishi kerak, tushdi va qoldi", href: "/finance-revenue-plan", perms: ["/finance-revenue-plan"] },
  { key: "ustozlar-reytingi", group: "attendance", title: "Ustozlar reytingi", about: "O'quvchilar bahosi — Nazorat bo'limida", href: "/nazorat-staff-rating", perms: ["/nazorat-staff-rating"] },
  { key: "davomat-nazorati", group: "nazorat", title: "Davomat nazorati", about: "", href: "/nazorat-davomat", perms: ["/nazorat-davomat"] },
  { key: "xodimlar-davomati", group: "nazorat", title: "Xodimlar davomati", about: "", href: "/nazorat-qr", perms: ["/nazorat-qr"] },
  { key: "xabarlar", group: "nazorat", title: "Xabarlar yetkazilishi", about: "", href: "/nazorat-sms-analytics", perms: ["/nazorat-sms-analytics"] },
];

export const REPORT_BY_SLUG: Readonly<Record<string, ReportDef>> = Object.fromEntries(REPORTS.map((r) => [r.slug, r]));

export function reportGroupOf(r: ReportDef): ReportGroup {
  return REPORT_GROUPS.find((g) => g.key === r.group) ?? REPORT_GROUPS[0];
}

/** Xodim shu hisobotni ochishi mumkinmi (eski sahifa ruxsatlaridan bittasi). */
export function canOpenReport(r: ReportDef, permissions: string[] | null): boolean {
  return r.perms.some((p) => isPathAllowed(p, permissions));
}
