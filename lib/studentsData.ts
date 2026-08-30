// O'quvchilar ro'yxati uchun kengaytirilgan model.
//
// Manba — MongoDB `pupils` (lib/pupilsData.ts). Yozuvda faqat shu maydonlar
// bor: id, ism/familiya, telefon, kategoriya, tug'ilgan sana, balans, coin,
// moderator, manba. Kurs / o'qituvchi / dars kunlari o'quvchining o'zida
// saqlanmaydi — ular u o'qiyotgan GURUHdan kelib chiqadi (MongoDB `groups`,
// `studentIds` maydoni orqali bog'langan). Bu haqiqiy CRM mantiqiga mos:
// o'quvchining kursi mustaqil maydon emas.
//
// Ilgari bu yerda o'quvchi id'sidan DETERMINISTIK ravishda "o'ylab topilgan"
// guruh biriktiriladi (pickGroupIds/GROUP_SEED) va statuslar id'ning
// qoldig'idan hisoblanardi — statik constants/studentsList.js demo ro'yxati
// bilan birga u ham olib tashlandi. Endi guruhi bo'lmagan o'quvchida bu
// maydonlar BO'SH turadi (soxta qiymat yozilmaydi).

import type { Group } from "@/lib/groups";
import type { PupilListItem, PupilStatus } from "@/lib/pupilsData";
import { pupilFullName, pupilStatusOf, PUPIL_STATUSES } from "@/lib/pupilsData";

export interface StudentRow {
  id: number;
  name: string;
  phone: string;
  balance: number;
  coin: number;
  createdAt: string;
  moderator: string;
  source: string;
  groups: string;
  /** O'quvchi kartasidagi kategoriya (Kichik / O'rta / Katta). */
  category: string;
  /** Bazadagi holat (yozuvda yo'q bo'lsa "Aktiv"). */
  status: StudentStatus;
  /** Muzlatish/arxivlash sababi — bo'sh bo'lishi mumkin. */
  statusReason: string;
  /** Holat o'zgargan sana ("YYYY-MM-DD") — bo'sh bo'lishi mumkin. */
  statusChangedAt: string;
}

export type StudentStatus = PupilStatus;
export const STUDENT_STATUSES: StudentStatus[] = [...PUPIL_STATUSES];

export type OddEven = "Toq" | "Juft" | "";

export interface EnrichedStudent extends StudentRow {
  /** Bog'langan guruhlar (groups.id). Bo'sh bo'lishi mumkin. */
  groupIds: number[];
  /** "36, 104" ko'rinishida; guruh yo'q bo'lsa "-". */
  groupNames: string;
  /** Birinchi guruhdan; guruh yo'q bo'lsa "". */
  course: string;
  teacher: string;
  /** Guruhning dars kunlari, masalan "Toq kunlar" yoki "Se,Sh". */
  day: string;
  oddEven: OddEven;
  /** Guruh darajasi ("Kurs darajasi" ustuni/filtri). */
  subcourse: string;
  status: StudentStatus;
}

/** MongoDB'dagi o'quvchi hujjatidan jadval qatori. */
export function studentRowFromPupil(p: PupilListItem): StudentRow {
  return {
    id: p.id,
    name: pupilFullName(p),
    phone: p.phone ?? "",
    balance: Number(p.balance) || 0,
    coin: Number(p.coin) || 0,
    createdAt: p.createdAt ?? "",
    moderator: p.moderator ?? "",
    source: p.source ?? "",
    groups: "-",
    category: p.category ?? "",
    status: pupilStatusOf(p),
    statusReason: p.statusReason ?? "",
    statusChangedAt: p.statusChangedAt ?? "",
  };
}

/** "Toq kunlar" → "Toq", "Juft kunlar" → "Juft", qolganlari → "". */
function toOddEven(day: string): OddEven {
  const d = (day || "").toLowerCase();
  if (d.includes("toq")) return "Toq";
  if (d.includes("juft")) return "Juft";
  return "";
}

/** pupils.id → o'sha o'quvchi a'zo bo'lgan guruhlar. */
function groupsByStudent(groups: Group[]): Map<number, Group[]> {
  const map = new Map<number, Group[]>();
  for (const g of groups) {
    for (const sid of g.studentIds ?? []) {
      const list = map.get(sid);
      if (list) list.push(g);
      else map.set(sid, [g]);
    }
  }
  return map;
}

/**
 * O'quvchilarni HAQIQIY guruh a'zoligi bilan kengaytiradi. Guruhga
 * biriktirilmagan o'quvchida kurs/o'qituvchi/kun bo'sh qoladi.
 */
export function enrichStudents(rows: StudentRow[], groups: Group[]): EnrichedStudent[] {
  const byStudent = groupsByStudent(groups);
  return rows.map((r) => {
    const mine = byStudent.get(r.id) ?? [];
    const first = mine[0];
    return {
      ...r,
      groupIds: mine.map((g) => g.id),
      groupNames: mine.length ? mine.map((g) => g.name || String(g.id)).join(", ") : "-",
      course: first?.course ?? "",
      teacher: first?.teacher ?? "",
      day: first?.day ?? "",
      oddEven: toOddEven(first?.day ?? ""),
      subcourse: first?.level ?? "",
    };
  });
}

// ---------- Filtrlar ----------

export interface StudentFilters {
  moderator: string;
  source: string;
  coinFrom: string;
  coinTo: string;
  balanceFrom: string;
  balanceTo: string;
  course: string;
  subcourse: string;
  group: string;
  groupCount: string;
  teacher: string;
  category: string;
  status: string;
  day: string;
  oddEven: string;
  name: string;
}

export const EMPTY_STUDENT_FILTERS: StudentFilters = {
  moderator: "", source: "", coinFrom: "", coinTo: "",
  balanceFrom: "", balanceTo: "", course: "", subcourse: "", group: "",
  groupCount: "", teacher: "", category: "", status: "", day: "", oddEven: "",
  name: "",
};

export function applyStudentFilters(rows: EnrichedStudent[], f: StudentFilters): EnrichedStudent[] {
  return rows.filter((r) => {
    if (f.moderator && r.moderator !== f.moderator) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.coinFrom && r.coin < Number(f.coinFrom)) return false;
    if (f.coinTo && r.coin > Number(f.coinTo)) return false;

    if (f.balanceFrom && r.balance < Number(f.balanceFrom)) return false;
    if (f.balanceTo && r.balance > Number(f.balanceTo)) return false;

    if (f.course && r.course !== f.course) return false;
    if (f.subcourse && r.subcourse !== f.subcourse) return false;
    if (f.teacher && r.teacher !== f.teacher) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.day && r.day !== f.day) return false;
    if (f.oddEven && r.oddEven !== f.oddEven) return false;
    if (f.group && !r.groupIds.includes(Number(f.group))) return false;
    if (f.groupCount && r.groupIds.length !== Number(f.groupCount)) return false;
    if (f.name && !r.name.toLowerCase().includes(f.name.trim().toLowerCase())) return false;
    return true;
  });
}

/** Filtr ro'yxatlarini faqat HAQIQATDA uchraydigan qiymatlar bilan to'ldirish. */
export function uniqueSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}
