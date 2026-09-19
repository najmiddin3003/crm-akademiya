import { LANGUAGES } from "@/constants/navbar";

// `constants/navbar.js` — sof ma'lumot (loyihadagi odat: konstantalar .js da).
// Tiplar shu yerda beriladi, Navbar ham mobil chekma menyu ham shundan oladi.
//
// BILDIRISHNOMALAR BU YERDA EMAS. Ular haqiqiy hodisalardan yig'iladi —
// tiplar lib/notifications.ts da, ma'lumot esa app/api/notifications dan.

export interface LanguageInfo {
  flag: string;
  name: string;
  short: string;
  /** Navbar ro'yxatidagi ikki harfli belgi: UZ / ЎЗ / EN. */
  code: string;
}

export const LANGS = LANGUAGES as Record<string, LanguageInfo>;
