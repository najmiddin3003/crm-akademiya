import { createInitialOrders } from "./ordersData";
import { EMPLOYEES_DATA } from "@/constants/employees";

// Navbardagi "Tug'ilgan kunlar" (referens: /hr/birthdays).
//
// Referens sahifa o'quvchilar va xodimlarni BIRGA ko'rsatadi, `Hammasi /
// O'quvchilar / Xodimlar` filtri bilan. Bizda ikkala demo to'plamda ham
// tug'ilgan sana maydoni yo'q (`EMPLOYEES_DATA` da ham, buyurtmalarda ham),
// shuning uchun sana `id` dan DETERMINISTIK hisoblanadi — loyihadagi odat.
// Haqiqiy maydon paydo bo'lgach faqat `birthOf()` almashtiriladi.

export type PersonKind = "student" | "employee";

export interface BirthdayPerson {
  id: number;
  name: string;
  phone: string;
  kind: PersonKind;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  year: number;
}

interface EmployeeRow {
  id: number;
  name: string;
  phone?: string;
}

// Har bir oyning kun soni — 29-fevral chetlab o'tiladi (har yili takrorlanadigan
// sana kerak, kabisa yiliga bog'lanib qolmasin).
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function birthOf(id: number, kind: PersonKind): { month: number; day: number; year: number } {
  // Turli to'plamlar bir xil `id` ga ega bo'lishi mumkin — aralashib
  // ketmasligi uchun xodimlar boshqa siljish bilan hisoblanadi.
  const seed = kind === "employee" ? id * 7919 + 13 : id * 2654435761;
  const h = Math.abs(seed % 1_000_003);
  const month = (h % 12) + 1;
  const day = ((h >>> 3) % DAYS_IN_MONTH[month - 1]) + 1;
  // O'quvchilar asosan yosh, xodimlar kattaroq — ro'yxat ishonarli ko'rinsin.
  const year = kind === "employee" ? 1975 + ((h >>> 5) % 25) : 2000 + ((h >>> 5) % 18);
  return { month, day, year };
}

let cache: BirthdayPerson[] | null = null;

/** O'quvchilar + xodimlar, tug'ilgan sanasi bilan. Natija keshlanadi. */
export function allBirthdays(): BirthdayPerson[] {
  if (cache) return cache;

  const students: BirthdayPerson[] = createInitialOrders()
    .filter((o) => o.name)
    .map((o) => ({ id: o.id, name: o.name, phone: o.phone || "", kind: "student" as const, ...birthOf(o.id, "student") }));

  const employees: BirthdayPerson[] = (EMPLOYEES_DATA as EmployeeRow[])
    .filter((e) => e.name)
    .map((e) => ({ id: e.id, name: e.name, phone: e.phone || "", kind: "employee" as const, ...birthOf(e.id, "employee") }));

  cache = [...students, ...employees];
  return cache;
}

export function filterByKind(rows: BirthdayPerson[], kind: PersonKind | "all"): BirthdayPerson[] {
  return kind === "all" ? rows : rows.filter((r) => r.kind === kind);
}

/** Berilgan oyning har bir kuni uchun ro'yxat (kalit — kun raqami). */
export function byDay(rows: BirthdayPerson[], month: number): Map<number, BirthdayPerson[]> {
  const out = new Map<number, BirthdayPerson[]>();
  for (const r of rows) {
    if (r.month !== month) continue;
    const list = out.get(r.day);
    if (list) list.push(r);
    else out.set(r.day, [r]);
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Yillik ko'rinish uchun: har bir oyga tegishli odamlar. */
export function byMonth(rows: BirthdayPerson[]): BirthdayPerson[][] {
  const out: BirthdayPerson[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) out[r.month - 1].push(r);
  for (const list of out) list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  return out;
}

/**
 * Oyning 1-kuni haftaning nechanchi kuniga to'g'ri kelishi — DUSHANBADAN
 * boshlab (0 = dushanba). Kalendar to'rida oldingi bo'sh kataklar shundan.
 */
export function firstWeekdayOffset(year: number, month: number): number {
  const js = new Date(year, month - 1, 1).getDay(); // 0 = yakshanba
  return (js + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
