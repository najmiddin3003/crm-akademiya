// O'QUVCHI PROFILI (yangi versiya) — mijoz va server BO'LISHADIGAN tiplar va sof
// yordamchilar. Bu fayl `mongodb` va server modullarini import QILMAYDI (sahifa
// "use client" — server zanjiri mijoz to'plamiga tortilsa sahifa yiqiladi,
// lib/debtorsTypes.ts izohidagi tuzoq).
//
// Manba — GET /api/pupils/:id/profile (app/api/pupils/[id]/profile/route.ts).

import type { AttendanceStatus } from "./attendance";
import type { DebtIssue } from "./debtorsTypes";
import type { PupilStatus } from "./pupilsData";

/** Guruhning bitta oyi — o'quvchining shu guruhdagi a'zoligi bo'yicha. */
export interface ProfileMonth {
  /** "YYYY-MM". */
  month: string;
  /** Shu oyda a'zolik ichidagi dars kunlari (guruh jadvali bo'yicha). */
  lessons: number;
  /** Oyning hamma dars kunlari (to'liq oy). */
  fullLessons: number;
  /**
   * Shu oy uchun to'lanadigan summa: to'liq oy — OYLIK NARX, qisman oy (oy o'rtasida
   * qo'shilgan/chiqqan) — darslar ulushi (oylik × lessons / fullLessons). Narx
   * noma'lum — null.
   */
  expected: number | null;
}

export interface ProfileGroup {
  id: number;
  name: string;
  course: string;
  level: string;
  teacher: string;
  room: string;
  day: string;
  time: string;
  /** gathering | active | frozen | archive. */
  status: string;
  /** "Ingliz tili (13-guruh)" — lib/groups.ts → groupLabel. */
  label: string;
  /** Oflayn kurslardagi OYLIK narx (lib/debtors.ts → monthlyPriceFor); yo'q — null. */
  monthlyPrice: number | null;
  /** O'quvchi hozir shu guruhda (groups.studentIds). */
  current: boolean;
  /** Eng birinchi qo'shilgan kun ("YYYY-MM-DD"); noma'lum — null. */
  joinedAt: string | null;
  /** Guruhdan chiqqan kun (hozir guruhda bo'lmasa); null — chiqmagan yoki noma'lum. */
  leftAt: string | null;
  /** Hisob boshlanadigan kun (a'zolik va guruh boshi); null — noma'lum. */
  startIso: string | null;
  /** Hisob tugaydigan chegara (chiqqan/guruh tugagan/arxiv/muzlatilgan); null — ochiq. */
  boundIso: string | null;
  /** Hisoblab bo'lmaslik sabablari (lib/debtorsTypes.ts → DebtIssue). */
  issues: DebtIssue[];
  /** Hisob boshlangan oydan KEYINGI oygacha (kelgusi oy — reja). Yig'ilayotgan guruhda bo'sh. */
  months: ProfileMonth[];
}

/** To'lov yoki o'quvchiga qaytarim (transaction_entries). */
export interface ProfileEntry {
  id: number;
  date: string;
  time: string;
  /** Kassaga tushgan summa (ishorali; qaytarim manfiy). */
  amount: number;
  /** O'quvchiga hisoblanadigan summa — naqd + tanga evaziga chegirma (entryPaidAmount). */
  paid: number;
  txType: string;
  txName: string;
  paymentType: string;
  paymentMethodKey: string;
  /** "YYYY-MM" — qaysi oy uchun (yo'q bo'lsa sananing oyi). */
  periodMonth: string;
  teacherName: string;
  cashboxId: number;
  cashboxName: string;
  /** "" | "waiting" | "cancelled". */
  status: string;
  studentRefund: boolean;
  note: string;
}

/** Davomat belgisi (attendance) + kim belgilagani (attendance_history). */
export interface ProfileMark {
  groupId: number;
  date: string;
  status: AttendanceStatus;
  reason: string;
  note: string;
  author: string;
  /** Belgilangan payt — tarixdagi oxirgi yozuv ("DD.MM.YYYY | HH:MM"); yo'q — "". */
  markedAt: string;
}

export interface PupilProfilePayload {
  ok: true;
  /** Toshkent bugungi kuni ("YYYY-MM-DD") va soati ("HH:MM"). */
  asOf: string;
  nowHm: string;
  pupil: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    extraPhone: string;
    birthDate: string;
    category: string;
    source: string;
    moderator: string;
    createdAt: string;
    status: PupilStatus;
    statusChangedAt: string;
    statusReason: string;
    branchId: number | null;
    fatherName: string;
    fatherPhone: string;
    motherName: string;
    motherPhone: string;
  };
  /** Tanga (gamifikatsiya hamyoni); hamyon yo'q — 0. */
  coins: number;
  groups: ProfileGroup[];
  entries: ProfileEntry[];
  /** Eski tizim (edutizim) arxividagi to'lovlar soni — eski ko'rinishda ochiladi. */
  legacyCount: number;
  marks: ProfileMark[];
}

/** "2026-10" + delta oy → "YYYY-MM". */
export function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → 1-kun va oxirgi kun ("YYYY-MM-DD"). */
export function monthBoundsOf(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Davomat belgisi «keldi» hisoblanadimi (kechikib kelgan va birinchi darsi ham). */
export function markCame(s: AttendanceStatus): boolean {
  return s === "keldi" || s === "kechikdi" || s === "birinchi";
}
