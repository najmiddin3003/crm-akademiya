import type { PupilStatus } from "@/lib/pupilsData";

// QARZDORLAR HISOBOTI — mijoz va server BO'LISHADIGAN tiplar/konstanta.
//
// NEGA ALOHIDA FAYL: hisobning o'zi lib/debtors.ts da va u serverga
// bog'liq (mongodb, lib/branchScope → lib/auth → next/server `after`).
// Sahifa (components/reports/DebtorsReportPage.tsx, "use client") undan
// faqat tip va LESSONS_PER_MONTH ni oladi — qiymat importi butun server
// zanjirini mijoz to'plamiga tortib, sahifani 500 bilan yiqitardi
// ("after ... only available in Server Components").

/**
 * Haftasiga 3 kun (Toq/Juft kunlar) o'qiydigan guruhda oyda nechta dars —
 * foydalanuvchi qoidasi: "1 oyda 13 ta dars bo'ladi har bitta fanda".
 * Boshqa jadvallar shundan proporsional olinadi (lessonsPerMonthFor).
 */
export const LESSONS_PER_MONTH = 13;

/**
 * Guruh jadvalida haftasiga `weekdayCount` kun dars bo'lsa, oyda nechta
 * dars: 3 kun → 13, 5 kun (Hafta kunlari) → 22, 2 kun → 9, 1 kun → 4.
 *
 * NEGA JADVALGA QARAB (20.09.2026): kurs narxi OYLIK (rasmiy ro'yxat:
 * Sertifikat 400 000/oy). "topik" guruhi har kuni o'qiydi va o'quvchilari
 * 400 000 to'laydi — oylik ÷ 13 qilinsa bir oyda 22 × 30 769 = 677 000
 * hisoblanardi. Eski tizimda ham haftasiga 2 kunlik Arab tili oylik ÷ 9
 * turgan edi — aynan shu formula.
 */
export function lessonsPerMonthFor(weekdayCount: number): number {
  return Math.max(1, Math.round((weekdayCount * LESSONS_PER_MONTH) / 3));
}

/**
 * Guruh bo'yicha hisoblab bo'lmaslik sabablari:
 *   price    — kurs/bosqichda shu filial uchun oylik narx yo'q;
 *   start    — o'quvchining guruhga qo'shilgan sanasi ham, guruhning
 *              boshlanish sanasi ham yo'q (nimadan sanashni bilib bo'lmaydi);
 *   schedule — guruhning dars kunlari (`day`) tanilmadi.
 */
export type DebtIssue = "price" | "start" | "schedule";

export interface DebtorGroupPart {
  groupId: number;
  /** "Ingliz tili (1-guruh)" — lib/groups.ts → groupLabel. */
  group: string;
  course: string;
  level: string;
  teacher: string;
  /** Guruh jadvali bo'yicha boshlangan kundan hisob sanasigacha o'tgan darslar soni. */
  lessons: number;
  /** Hisob boshlangan kun ("YYYY-MM-DD"); `null` — noma'lum (issue "start"). */
  startDate: string | null;
  /** Oxirgi sanalgan dars kuni ("YYYY-MM-DD"); dars bo'lmagan bo'lsa null. */
  lastDate: string | null;
  /** Oylik narx (Oflayn kurslar); `null` — kurs/bosqichda shu filial uchun narx yo'q. */
  monthlyPrice: number | null;
  /** Shu guruh jadvalida oyda nechta dars (lessonsPerMonthFor). */
  lessonsPerMonth: number;
  /** Bitta dars narxi = round(monthlyPrice / lessonsPerMonth); narx yo'q — null. */
  lessonPrice: number | null;
  /** lessons × lessonPrice (narx yo'q bo'lsa 0). */
  charged: number;
  /** Shu guruhda hisob to'liq emasligining sabablari (bo'sh — hammasi joyida). */
  issues: DebtIssue[];
}

export interface DebtorRow {
  /** pupils.id */
  id: number;
  name: string;
  phone: string;
  status: PupilStatus;
  groups: DebtorGroupPart[];
  /** Barcha guruhlar bo'yicha darslar soni. */
  lessons: number;
  /** Eng erta boshlangan kun (guruhlar ichida eng kichigi); hech birida yo'q — null. */
  startDate: string | null;
  /** Hisoblangan summa (hisoblab bo'lgan guruhlar bo'yicha). */
  charged: number;
  /** Hisob sanasigacha to'langan (qaytarimlar ayrilgan). */
  paid: number;
  /** charged − paid; musbat — qarz, manfiy — oldindan to'lagan. */
  debt: number;
  /** Bironta guruhda hisob to'liq emas (issues bo'sh emas). */
  incomplete: boolean;
}

export interface GroupIssue {
  groupId: number;
  group: string;
  course: string;
  level: string;
  issue: DebtIssue;
}

/**
 * Bitta OY bo'yicha jamlanma (foydalanuvchi so'rovi, 20.09.2026: "1 oyda
 * o'quvchilardan qancha pul yig'ilishi kerak — masalan 50 mln kerak,
 * 20 mln tushdi, 30 mln qarz").
 */
export interface MonthlySummary {
  /** "YYYY-MM". */
  month: string;
  /** Shu oyda guruh jadvali bo'yicha o'tadigan (o'tgan) darslar × dars narxi — hamma a'zo bo'yicha. */
  expected: number;
  /** Shu oyda (sana bo'yicha) shu o'quvchilardan tushgan to'lovlar (qaytarimlar ayrilgan). */
  received: number;
  /** expected − received; musbat — hali yig'ilmagan. */
  remaining: number;
  /** Shu oyda darsi bo'lgan o'quvchilar soni. */
  students: number;
  /** Oy bo'yicha darslar soni (hamma a'zo). */
  lessons: number;
}

export interface DebtorsReport {
  /** Hisob sanasi ("YYYY-MM-DD"). */
  asOf: string;
  /** A'zoligi bor har bir o'quvchi (qarzdor bo'lmaganlar ham) — qarz bo'yicha kamayish tartibida. */
  rows: DebtorRow[];
  /** Hisoblab bo'lmagan guruhlar — sababi bilan (sahifa tepasidagi ogohlantirish). */
  issues: GroupIssue[];
  /** So'ralgan oy bo'yicha jamlanma (`?month=YYYY-MM` berilganda). */
  month?: MonthlySummary;
}
