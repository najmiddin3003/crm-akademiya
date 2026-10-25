// «HISOBOTLAR» KATALOGI (yangi versiya, 15-qism — rasm «Hisobotlar katalogi», 25.10.2026).
//
// To'qqizta hisobot, to'rt guruhda. Har biri `/reports/<slug>` da ochiladi va
// Excel hamda PDF'ga yuklanadi. Mijoz ham, server ham shu ro'yxatdan o'qiydi.
//
// RUXSAT: `/reports` sidebar daraxtida YO'Q (lib/permissions.ts → ALWAYS_ALLOWED_PATHS,
// Bosh sahifa bilan bir xil sabab), shuning uchun har hisobot O'Z ESKI SAHIFASINING
// ruxsati bilan ochiladi (`perms` — ulardan BITTASI bo'lsa yetarli). Rollar oynasida
// yangi galochka paydo bo'lmaydi: Qarzdorlarni ko'ra oladigan xodim yangi Qarzdorlar
// hisobotini ham ko'radi, boshqasini — yo'q. Ma'lumot API'lari ham o'sha ruxsatlarga
// bog'langan (lib/apiPermissions.generated.ts).

import { isPathAllowed } from "@/lib/permissions";

export type ReportGroupKey = "finance" | "flow" | "attendance" | "staff";

export interface ReportGroup {
  key: ReportGroupKey;
  label: string;
}

export const REPORT_GROUPS: readonly ReportGroup[] = [
  { key: "finance", label: "Moliya" },
  { key: "flow", label: "O'quvchilar oqimi" },
  { key: "attendance", label: "Davomat" },
  { key: "staff", label: "Xodimlar va oylik" },
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
  | "bonus-jarima";

export interface ReportDef {
  slug: ReportSlug;
  group: ReportGroupKey;
  title: string;
  /** Kartadagi izoh (rasmdagi matn). */
  about: string;
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
    about: "Qatnashish foizi va qoldirilgan darslar",
    subtitle: "guruhlarning qatnashish foizi",
    perms: ["/nazorat-davomat-analytics"],
  },
  {
    slug: "davomat-oqituvchilar",
    group: "attendance",
    title: "O'qituvchilar bo'yicha",
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
];

export const REPORT_BY_SLUG: Readonly<Record<string, ReportDef>> = Object.fromEntries(REPORTS.map((r) => [r.slug, r]));

export function reportGroupOf(r: ReportDef): ReportGroup {
  return REPORT_GROUPS.find((g) => g.key === r.group) ?? REPORT_GROUPS[0];
}

/** Xodim shu hisobotni ochishi mumkinmi (eski sahifa ruxsatlaridan bittasi). */
export function canOpenReport(r: ReportDef, permissions: string[] | null): boolean {
  return r.perms.some((p) => isPathAllowed(p, permissions));
}
