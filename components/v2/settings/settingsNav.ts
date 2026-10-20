// YANGI VERSIYA — «SOZLAMALAR» ICHKI MENYUSI (rasm «Sozlamalar · Kurslar», 20.10.2026).
//
// Rasmdagi bo'limlar va bandlar AYNAN shu tartibda. Har band MAVJUD sahifaga olib
// boradi (tab bo'lsa `?tab=` bilan); tizimda hali yo'q bandlar `href` siz — menyuda
// o'chiq turadi («Hali yo'q»). Qaysi band qayerga va nega — design/v2/SAVOLLAR.md 112.
//
// Hozircha ichki menyu faqat Kurslar sahifasida (yangi dizayni bor yagona sozlama);
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
      { label: "Bildirishnomalar", note: "Bildirishnoma sozlamalari hali yo'q" },
    ],
  },
  {
    title: "O'quv",
    items: [
      { label: "Kurslar", href: "/offline-courses" },
      { label: "Kategoriyalar", href: "/edu-category" },
      { label: "Imtihon fanlari", note: "Imtihon fanlari kurslardan olinadi — alohida ro'yxat hali yo'q" },
    ],
  },
  {
    title: "Moliya",
    items: [
      { label: "Kassalar", href: "/finance-cash" },
      { label: "Kirim-chiqim toifalari", href: "/finance-tx-types" },
      { label: "To'lov turlari", href: "/settings-finance?tab=payment-methods" },
      { label: "Bonus sabablari", note: "Bonus sabablari ro'yxati hali yo'q" },
    ],
  },
  {
    title: "Lidlar",
    items: [
      { label: "Manbalar", href: "/sales-sources" },
      { label: "So'rovnoma sahifasi", href: "/settings-sales?tab=leads" },
      { label: "Referal dasturi", note: "Referal dasturi sozlamalari hali yo'q" },
    ],
  },
  {
    title: "Topshiriqlar",
    items: [{ label: "Jarima va muddatlar", href: "/tasks?tab=settings", adminOnly: true }],
  },
  {
    title: "Gamifikatsiya",
    items: [{ label: "Tanga qoidalari", href: "/settings-gamification?tab=reasons" }],
  },
  {
    title: "Nazorat",
    items: [{ label: "Nazorat qoidalari", note: "Nazorat qoidalari sozlamasi hali yo'q" }],
  },
];

/** Band yo'li (so'rovsiz) — ruxsat va faol bandni aniqlash uchun. */
export function navPath(href: string): string {
  return href.split("?")[0];
}
