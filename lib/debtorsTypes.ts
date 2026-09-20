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

export interface DebtorGroupPart {
  groupId: number;
  /** "Ingliz tili (1-guruh)" — lib/groups.ts → groupLabel. */
  group: string;
  course: string;
  level: string;
  teacher: string;
  /** Hisob sanasigacha davomat belgilangan darslar soni. */
  lessons: number;
  /** Birinchi belgilangan dars ("YYYY-MM-DD"). */
  firstDate: string;
  /** Oxirgi belgilangan dars ("YYYY-MM-DD"). */
  lastDate: string;
  /** Bitta dars narxi; `null` — kurs/bosqichda shu filial uchun narx yo'q. */
  lessonPrice: number | null;
  /** lessons × lessonPrice (narx yo'q bo'lsa 0). */
  charged: number;
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
  /** Eng birinchi dars (guruhlar ichida eng kichigi). */
  firstDate: string;
  /** Hisoblangan summa (narxi bor guruhlar bo'yicha). */
  charged: number;
  /** Hisob sanasigacha to'langan (qaytarimlar ayrilgan). */
  paid: number;
  /** charged − paid; musbat — qarz, manfiy — oldindan to'lagan. */
  debt: number;
  /** Bironta guruhda narx topilmadi — `charged` to'liq emas. */
  priceMissing: boolean;
}

export interface UnpricedGroup {
  groupId: number;
  group: string;
  course: string;
  level: string;
}

export interface DebtorsReport {
  /** Hisob sanasi ("YYYY-MM-DD"). */
  asOf: string;
  /** Davomati bor har bir o'quvchi (qarzdor bo'lmaganlar ham) — qarz bo'yicha kamayish tartibida. */
  rows: DebtorRow[];
  /** Davomati bor, lekin narxi topilmagan guruhlar — kurs formasida to'ldirish uchun. */
  unpriced: UnpricedGroup[];
}
