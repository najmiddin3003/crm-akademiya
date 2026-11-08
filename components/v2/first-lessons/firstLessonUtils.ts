"use client";

import { addDaysIso, startTimeOf, trialGroupOf, weekdayOfIso } from "@/components/v2/leads/leadUtils";
import { groupWeekdays } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { groupStudentCount } from "@/lib/groupsList";
import { holatOf, sinovOf, type LeadHolat } from "@/lib/leadHolat";
import type { FirstLessonReminder, Order } from "@/lib/ordersData";
import { uzDateOf, uzWallToMs } from "@/lib/staffTasks";

// YANGI VERSIYA — «BIRINCHI DARSGA YOZILGANLAR» (22-qism) uchun hisoblar:
// qaysi lid qaysi bo'limda (Bugun / O'tgan kunlar — natija yo'q / Kelgusi),
// natija, eslatish holati, guruhning keyingi darslari va bo'sh o'rinlar.
// Ma'lumot — lidlarning o'zi (`orders`): birinchi dars `firstLesson`/`teacher`,
// guruh `firstLessonGroupId` (bo'lmasa topiladi — trialGroupOf), holat
// lib/leadHolat.ts dan.

export type FlSection = "today" | "past" | "upcoming";

/** Natija: belgilanmagan / keldi (guruhga qo'shilgan yoki yo'q) / kelmadi / ketdi (rad). */
export type FlResult =
  | { kind: "none" }
  | { kind: "keldi"; joined: boolean }
  | { kind: "kelmadi" }
  | { kind: "ketdi"; reason: string };

export interface FlRow {
  o: Order;
  holat: LeadHolat;
  /** Birinchi dars — "YYYY-MM-DD" va "HH:MM" (vaqt bo'lmasa guruh jadvalidan). */
  sana: string;
  vaqt: string;
  /** Darsning tugash vaqti — guruh jadvalidan ("16:00"), topilmasa "". */
  tugash: string;
  group: Group | null;
  section: FlSection;
  /** Natija kutmoqda (holati «Birinchi dars»). Bugun hal bo'lganlar ham ko'rinadi, lekin sanalmaydi. */
  waiting: boolean;
  result: FlResult;
}

/** "14:00 - 16:00" → "16:00". */
export function endTimeOf(time: string | undefined): string {
  const all = [...String(time ?? "").matchAll(/(\d{1,2}):(\d{2})/g)];
  const m = all[1];
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

function resultOf(o: Order, holat: LeadHolat): FlResult {
  if (holat === "guruh") return { kind: "keldi", joined: true };
  if (holat === "rad") return { kind: "ketdi", reason: o.radSabab || "" };
  if (o.firstLessonStatus === "KELDI") return { kind: "keldi", joined: false };
  if (o.firstLessonStatus === "KELMADI") return { kind: "kelmadi" };
  return { kind: "none" };
}

/**
 * Sahifa qatorlari: holati «Birinchi dars» bo'lgan har bir lid (sanasi bilan) va
 * BUGUN hal bo'lganlar (keldi → guruhga qo'shildi, ketdi) — natijasi kun oxirigacha
 * o'z qatorida ko'rinib tursin. Kelgusi darsdan oldin «ketdi» bo'lganlar ko'rinmaydi.
 */
export function buildFlRows(orders: Order[], groups: Group[], nowMs: number): FlRow[] {
  const today = uzDateOf(nowMs);
  const out: FlRow[] = [];
  for (const o of orders) {
    const s = sinovOf(o);
    if (!s) continue;
    const holat = holatOf(o);
    const waiting = holat === "sinov";
    const section: FlSection = s.sana === today ? "today" : s.sana < today ? "past" : "upcoming";
    if (!waiting) {
      if (holat !== "guruh" && holat !== "rad") continue;
      const at = Date.parse(o.holatAt ?? "");
      if (!Number.isFinite(at) || uzDateOf(at) !== today || section === "upcoming") continue;
    }
    const group = trialGroupOf(o, groups);
    const vaqt = s.vaqt || startTimeOf(group?.time);
    const tugash = group && startTimeOf(group.time) === vaqt ? endTimeOf(group.time) : "";
    out.push({ o, holat, sana: s.sana, vaqt, tugash, group, section, waiting, result: resultOf(o, holat) });
  }
  return out;
}

/** Saralash: sana, vaqt, ism. */
export function byLesson(a: FlRow, b: FlRow): number {
  return a.sana.localeCompare(b.sana) || a.vaqt.localeCompare(b.vaqt) || (a.o.name || "").localeCompare(b.o.name || "", "uz");
}

/** Dars boshlandimi (bugungi qatorda «Keldi/Kelmadi» tugmalari shundan keyin). */
export function lessonStarted(r: Pick<FlRow, "sana" | "vaqt">, nowMs: number): boolean {
  const at = uzWallToMs(r.sana, r.vaqt || "00:00");
  return !Number.isFinite(at) || at <= nowMs;
}

/* ───────────────────────── Eslatish ───────────────────────── */

export type FlRemind =
  /** Yozishda «eslatish» belgisi olib tashlangan. */
  | { kind: "off" }
  /** Operator qo'ng'iroq qilib natijani belgilagan. */
  | { kind: "done"; result: NonNullable<FirstLessonReminder["result"]>; at: number }
  /** Bugun yozilgan — operator hozirgina gaplashgan. */
  | { kind: "written"; at: number }
  /** Eslatish vaqti keldi (ertaga, bugun yoki o'tib ketdi) — «Eslatish» tugmasi. */
  | { kind: "due"; day: string; when: "overdue" | "today" | "tomorrow" }
  /** Eslatish keyinroq — dars kunidan bir kun oldin. */
  | { kind: "later"; day: string }
  /** Bugungi/o'tgan dars — eslatilmagan. */
  | { kind: "none" };

export function remindOf(r: FlRow, nowMs: number): FlRemind {
  const rem = r.o.firstLessonReminder;
  if (rem?.off) return { kind: "off" };
  if (rem?.result) return { kind: "done", result: rem.result, at: Date.parse(rem.at ?? "") };
  const today = uzDateOf(nowMs);
  const holatAt = Date.parse(r.o.holatAt ?? "");
  if (r.waiting && Number.isFinite(holatAt) && uzDateOf(holatAt) === today && r.section === "upcoming") return { kind: "written", at: holatAt };
  if (r.section !== "upcoming") return { kind: "none" };
  const day = addDaysIso(r.sana, -1);
  const tomorrow = addDaysIso(today, 1);
  if (day < today) return { kind: "due", day, when: "overdue" };
  if (day === today) return { kind: "due", day, when: "today" };
  if (day === tomorrow) return { kind: "due", day, when: "tomorrow" };
  return { kind: "later", day };
}

/* ───────────────────────── Guruh jadvali va o'rinlar ───────────────────────── */

/**
 * Guruhning keyingi `count` ta darsi ("YYYY-MM-DD") — dars kunlari jadvalidan;
 * bugungi dars boshlangan bo'lsa olinmaydi. Guruh hali boshlanmagan bo'lsa —
 * boshlanish sanasidan, tugash sanasidan keyingisi olinmaydi (8 hafta ichida).
 */
export function lessonDatesOf(g: Pick<Group, "day" | "time" | "startDate" | "endDate">, nowMs: number, count: number): string[] {
  const days = groupWeekdays(g.day);
  if (!days.length) return [];
  const today = uzDateOf(nowMs);
  const start = startTimeOf(g.time);
  const isIso = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const from = isIso(g.startDate) && (g.startDate as string) > today ? (g.startDate as string) : today;
  const out: string[] = [];
  for (let i = 0; i < 56 && out.length < count; i++) {
    const iso = addDaysIso(from, i);
    if (isIso(g.endDate) && iso > (g.endDate as string)) break;
    if (!days.includes(weekdayOfIso(iso))) continue;
    if (iso === today && start) {
      const at = uzWallToMs(iso, start);
      if (Number.isFinite(at) && at <= nowMs) continue;
    }
    out.push(iso);
  }
  return out;
}

/** Sana guruhning dars kuniga to'g'ri keladimi (jadval o'qilmasa — ha). */
export function isLessonDay(g: Pick<Group, "day">, iso: string): boolean {
  const days = groupWeekdays(g.day);
  return !days.length || days.includes(weekdayOfIso(iso));
}

export interface Seats {
  students: number;
  /** Xona sig'imi — xona topilmasa yoki sig'imi kiritilmagan bo'lsa null. */
  capacity: number | null;
  free: number | null;
}

/** Guruh xona sig'imi va oylik narxi — GET /api/first-lessons/groups-info. */
export interface GroupInfo {
  capacity: number | null;
  price: number | null;
}

/**
 * Guruhdagi o'rinlar: o'quvchilar soni (guruh ro'yxatidan — qo'shilgandan keyin
 * darrov yangilanadi) va XONA SIG'IMI (Guruh → Xonalar; serverdan).
 */
export function seatsOf(g: Group, info: GroupInfo | undefined): Seats {
  const students = groupStudentCount(g);
  const capacity = info?.capacity ?? null;
  return { students, capacity, free: capacity === null ? null : Math.max(0, capacity - students) };
}

/** Guruh nomi kartochkada: kurs (bo'lmasa nomi); bir xil kursli guruhlar — vaqti bilan. */
export function groupTitle(g: Group, all: Group[]): string {
  const base = g.course || g.name || `#${g.id}`;
  const twins = all.filter((x) => x.id !== g.id && (x.course || x.name) === (g.course || g.name));
  if (!twins.length) return base;
  const start = startTimeOf(g.time);
  return start ? `${base} · ${start}` : `${base} · ${g.name || `#${g.id}`}`;
}
