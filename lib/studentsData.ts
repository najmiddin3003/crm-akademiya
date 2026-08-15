// O'quvchilar ro'yxati uchun kengaytirilgan model.
//
// constants/studentsList.js dagi 5909 ta yozuvda faqat shu maydonlar bor:
//   id, name, phone, balance, coin, createdAt, moderator, source, groups
// va `groups` hamma yozuvda "-" — ya'ni bo'sh. Shu sababli referensdagi
// filtrlarning ko'pi (Kurs, O'qituvchi, Kategoriya, Holati, Kun ...) uchun
// ma'lumot yo'q edi.
//
// Bu yerda har bir o'quvchi HAQIQIY guruhga bog'lanadi (constants/groups.js →
// GROUP_SEED, 91 ta guruh) va qolgan maydonlar o'sha guruhdan kelib chiqadi:
// kurs, o'qituvchi, dars kunlari. Bu haqiqiy CRM mantiqiga mos — o'quvchining
// kursi mustaqil maydon emas, u qaysi guruhda o'qishidan kelib chiqadi.
//
// Bog'lash `id` dan DETERMINISTIK hisoblanadi: sahifa har safar ochilganda
// bir xil natija chiqadi va boshqa sahifalar bilan ziddiyat bo'lmaydi.
// (Loyihada bu yondashuv allaqachon ishlatiladi — masalan ActiveStudentsPage
// dagi genBalance/isFrozen.)

import { GROUP_SEED } from "@/constants/groups";
import { CATEGORIES, SUBCOURSES } from "@/lib/ordersData";

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
}

export type StudentStatus = "Aktiv" | "Muzlatilgan" | "Arxiv";
export const STUDENT_STATUSES: StudentStatus[] = ["Aktiv", "Muzlatilgan", "Arxiv"];

export type OddEven = "Toq" | "Juft" | "";

export interface EnrichedStudent extends StudentRow {
  /** Bog'langan guruhlar (GROUP_SEED.id). Bo'sh bo'lishi mumkin. */
  groupIds: number[];
  /** "36, 104" ko'rinishida; guruh yo'q bo'lsa "-". */
  groupNames: string;
  /** Birinchi guruhdan; guruh yo'q bo'lsa "". */
  course: string;
  teacher: string;
  /** Guruhning dars kunlari, masalan "Toq kunlar" yoki "Se,Sh". */
  day: string;
  oddEven: OddEven;
  subcourse: string;
  category: string;
  status: StudentStatus;
}

/** "Toq kunlar" → "Toq", "Juft kunlar" → "Juft", qolganlari → "". */
function toOddEven(day: string): OddEven {
  const d = (day || "").toLowerCase();
  if (d.includes("toq")) return "Toq";
  if (d.includes("juft")) return "Juft";
  return "";
}

/**
 * O'quvchi qaysi guruhlarda o'qiydi. Taqsimot ataylab notekis: bir qism
 * o'quvchilar hali guruhga biriktirilmagan (referensda ham GURUHLAR ustuni
 * ko'p qatorda bo'sh turadi), ba'zilari ikkita guruhda.
 */
function pickGroupIds(id: number): number[] {
  if (id % 5 === 0) return []; // ~20% — guruhga biriktirilmagan
  const first = GROUP_SEED[(id * 31) % GROUP_SEED.length];
  if (id % 7 === 0) {
    const second = GROUP_SEED[(id * 17 + 5) % GROUP_SEED.length];
    if (second.id !== first.id) return [first.id, second.id];
  }
  return [first.id];
}

function pickStatus(id: number): StudentStatus {
  if (id % 13 === 0) return "Muzlatilgan";
  if (id % 17 === 0) return "Arxiv";
  return "Aktiv";
}

const BY_ID = new Map(GROUP_SEED.map((g) => [g.id, g]));

/** Bitta o'quvchini kengaytiradi. */
export function enrichStudent(r: StudentRow): EnrichedStudent {
  const groupIds = pickGroupIds(r.id);
  const first = groupIds.length ? BY_ID.get(groupIds[0]) : undefined;
  return {
    ...r,
    groupIds,
    groupNames: groupIds.length ? groupIds.join(", ") : "-",
    course: first?.course ?? "",
    teacher: first?.teacher ?? "",
    day: first?.day ?? "",
    oddEven: toOddEven(first?.day ?? ""),
    subcourse: SUBCOURSES[r.id % SUBCOURSES.length],
    category: CATEGORIES[r.id % CATEGORIES.length],
    status: pickStatus(r.id),
  };
}

// ---------- Filtrlar ----------

export interface StudentFilters {
  /** Mavjud filtrlar (ilgari ham bor edi). */
  moderator: string;
  source: string;
  coinFrom: string;
  coinTo: string;
  /** Referensdagi qolgan filtrlar. */
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

/** Filtr ro'yxatlarini to'ldirish uchun — faqat haqiqatda uchraydigan qiymatlar. */
export const STUDENT_COURSES = [...new Set(GROUP_SEED.map((g) => g.course))].filter(Boolean).sort();
export const STUDENT_TEACHERS = [...new Set(GROUP_SEED.map((g) => g.teacher))].filter(Boolean).sort();
export const STUDENT_DAYS = [...new Set(GROUP_SEED.map((g) => g.day))].filter(Boolean).sort();
export const STUDENT_GROUP_IDS = GROUP_SEED.map((g) => g.id).sort((a, b) => a - b);
export { CATEGORIES as STUDENT_CATEGORIES, SUBCOURSES as STUDENT_SUBCOURSES };
