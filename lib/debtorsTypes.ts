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
 * Oyda nechta dars — kursdagi "bitta dars narxi" bilan oylik to'lov
 * o'rtasidagi ko'prik. Hisobda ISHLATILMAYDI (narx allaqachon dars
 * uchun), faqat oylik ekvivalentni ko'rsatish uchun.
 */
export const LESSONS_PER_MONTH = 13;

/**
 * Guruh bo'yicha hisoblab bo'lmaslik sabablari:
 *   price    — kurs/bosqichda shu filial uchun bitta dars narxi yo'q;
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
  /** Bitta dars narxi; `null` — kurs/bosqichda shu filial uchun narx yo'q. */
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

export interface DebtorsReport {
  /** Hisob sanasi ("YYYY-MM-DD"). */
  asOf: string;
  /** A'zoligi bor har bir o'quvchi (qarzdor bo'lmaganlar ham) — qarz bo'yicha kamayish tartibida. */
  rows: DebtorRow[];
  /** Hisoblab bo'lmagan guruhlar — sababi bilan (sahifa tepasidagi ogohlantirish). */
  issues: GroupIssue[];
}
