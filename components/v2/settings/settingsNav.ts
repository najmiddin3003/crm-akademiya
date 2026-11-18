// YANGI VERSIYA — «SOZLAMALAR» ICHKI MENYUSI (rasm «Sozlamalar · Kurslar», 20.10.2026).
//
// Rasmdagi bo'limlar va bandlar AYNAN shu tartibda. Har band MAVJUD sahifaga olib
// boradi (tab bo'lsa `?tab=` bilan); tizimda hali yo'q bandlar `href` siz — menyuda
// o'chiq turadi («Hali yo'q»). Qaysi band qayerga va nega — design/v2/SAVOLLAR.md 112.
//
// Hozircha ichki menyu Kurslar, Tanga qoidalari va Imtihon fanlari sahifalarida (yangi dizayni borlari,
// 25.10.2026);
// qolgan sahifalar o'z dizayni kelganda shu ramkaga o'tadi. Eski /settings-* sahifalari
// o'z tab menyusi bilan — ularni shu ramkaga solsak ikki yonma-yon menyu bo'lardi.

export interface SettingsNavItem {
  label: string;
  /** Yo'q — tizimda hali bunday sozlama yo'q (o'chiq band). */
  href?: string;
  /** Faqat administratorga (masalan /tasks → «Sozlamalar» tabi faqat direktorda). */
  adminOnly?: boolean;
  /** O'chiq band izohi. */
  note?: string;
}

export interface SettingsNavGroup {
  title: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    title: "Umumiy",
    items: [
      { label: "Markaz ma'lumotlari", href: "/settings-general" },
      { label: "Filiallar", href: "/management-filiallar" },
      { label: "Xonalar", href: "/groups-rooms" },
      { label: "Ish kunlari va bayramlar", href: "/settings-holidays", adminOnly: true },
      { label: "Bildirishnomalar", href: "/settings-notifications", adminOnly: true },
      { label: "Ommaviy oferta", href: "/settings-oferta", adminOnly: true },
    ],
  },
  {
    title: "O'quv",
    items: [
      { label: "Kurslar", href: "/offline-courses" },
      { label: "Kategoriyalar", href: "/edu-category" },
      { label: "Imtihon fanlari", href: "/settings-academic?tab=exam-subjects" },
      // 40-qism: sabablar (Ketdi / Bekor qilindi / Davomat).
      { label: "Sabablar", href: "/settings-reasons", adminOnly: true },
    ],
  },
  {
    title: "Moliya",
    items: [
      { label: "Kassalar", href: "/settings-finance?tab=cashboxes", adminOnly: true },
      { label: "Kirim-chiqim toifalari", href: "/finance-tx-types" },
      { label: "To'lov turlari", href: "/settings-finance?tab=payment-methods" },
      // 39-qism: oylik, bonus/KPI, chegirmalar, hamkorlar — faqat direktor.
      { label: "Oylik va soliq", href: "/settings-payroll", adminOnly: true },
      { label: "Lavozim va stavkalar", href: "/settings-positions", adminOnly: true },
      { label: "Bonus va KPI", href: "/settings-bonus", adminOnly: true },
      { label: "Chegirmalar", href: "/settings-discounts", adminOnly: true },
      { label: "Hamkorlar", href: "/settings-partners", adminOnly: true },
      { label: "Integratsiyalar", href: "/settings-integrations", adminOnly: true },
    ],
  },
  {
    title: "Lidlar",
    items: [
      { label: "Manbalar", href: "/sales-sources" },
      { label: "Lid sozlamalari", href: "/settings-leads", adminOnly: true },
      { label: "So'rovnoma sahifasi", href: "/settings-sales?tab=leads" },
      { label: "Referal dasturi", href: "/settings-referral" },
    ],
  },
  {
    title: "Topshiriqlar",
    items: [{ label: "Jarima va muddatlar", href: "/tasks?tab=settings", adminOnly: true }],
  },
  {
    title: "Gamifikatsiya",
    // 33-qism: «Tanga tizimi» (modul, cheklovlar, darajalar), «Tanga sabablari»; byudjet — eski tab.
    items: [
      { label: "Tanga tizimi", href: "/settings-gamification?tab=general" },
      { label: "Tanga sabablari", href: "/settings-gamification?tab=reasons" },
      { label: "Sovg'a byudjeti", href: "/settings-gamification?tab=branches" },
    ],
  },
  {
    title: "Nazorat",
    items: [{ label: "Nazorat qoidalari", href: "/settings-nazorat", adminOnly: true }],
  },
  {
    title: "Ilovalar",
    // 38-qism: xodim va o'quvchi ilovalari, MohirAI — faqat direktor.
    items: [
      { label: "Xodim ilovasi", href: "/settings-staff-app", adminOnly: true },
      { label: "O'quvchi ilovasi", href: "/settings-student-app", adminOnly: true },
      { label: "MohirAI", href: "/settings-mohirai", adminOnly: true },
    ],
  },
  {
    title: "Tizimli",
    // 37-qism: markaz bo'yicha funksiyalar va Tizimli obunasi — faqat direktor.
    items: [
      { label: "Funksiyalar", href: "/settings-features", adminOnly: true },
      { label: "Obuna va to'lov", href: "/settings-subscription", adminOnly: true },
    ],
  },
];

/** Band yo'li (so'rovsiz) — ruxsat va faol bandni aniqlash uchun. */
export function navPath(href: string): string {
  return href.split("?")[0];
}
