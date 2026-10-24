"use client";

import { Check, Minus, X, type LucideIcon } from "lucide-react";
import { lessonDates, parsePeriod, type AttendanceMark, type AttendanceStatus } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";
import { toUz } from "@/lib/uzTime";

// YANGI VERSIYA — GURUH SAHIFASI (10-qism, rasmlar «Guruh · Bugungi dars, davomat»,
// «Guruh · Tanga berish», «Guruh · Davomat jurnali», 24.10.2026): umumiy tiplar va
// sof yordamchilar.

export type DetailTab = "bugun" | "jurnal" | "oquvchilar";
export const DETAIL_TABS: DetailTab[] = ["bugun", "jurnal", "oquvchilar"];

/** GET /api/groups/:id/students — o'quvchi + guruhga qo'shilgan kun (group_memberships). */
export type Member = Pupil & { joinedAt?: string | null; status?: string };

/** Bugungi darsda tanlanadigan uch holat (rasm): keldi / kelmadi / sababli. */
export type DayStatus = "keldi" | "sababsiz" | "sababli";

/** «Keldi» hisoblanadigan holatlar (kechikib kelgan va birinchi darsi ham). */
export const cameStatus = (s: AttendanceStatus | null | undefined): boolean => s === "keldi" || s === "kechikdi" || s === "birinchi";

/** Bazadagi holat → uch tugmadan biri; kechikdi / birinchi dars — «Keldi». */
export function dayStatusOf(s: AttendanceStatus | null | undefined): DayStatus | null {
  if (s == null) return null;
  if (cameStatus(s)) return "keldi";
  return s === "sababli" ? "sababli" : "sababsiz";
}

export const DAY_STATUS_UI: Record<DayStatus, { label: string; icon: LucideIcon; on: string }> = {
  keldi: { label: "Keldi", icon: Check, on: "border-v2-success bg-v2-success-bg text-v2-success" },
  sababsiz: { label: "Kelmadi", icon: X, on: "border-v2-danger bg-v2-danger-bg text-v2-danger" },
  sababli: { label: "Sababli", icon: Minus, on: "border-v2-warning bg-v2-warning-bg text-v2-warning" },
};
export const DAY_STATUSES: DayStatus[] = ["keldi", "sababsiz", "sababli"];

/** O'quvchi ishlamaydigan holat (muzlatilgan / arxiv) — dars ro'yxatiga kirmaydi. */
export const isFrozenPupil = (status: unknown): boolean => {
  const s = String(status ?? "Aktiv");
  return s === "Muzlatilgan" || s === "Arxiv";
};

export const memberName = (p: Pick<Pupil, "firstName" | "lastName">) => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

// ── Gamifikatsiya (GET /api/gamification/lesson) ──────────────────────

export interface GamTx {
  id: number;
  type: string;
  amount: number;
  reasonName: string;
  createdByName: string;
  canUndo: boolean;
}

export interface GamRow {
  pupilId: number;
  name: string;
  balance: number;
  att: "keldi" | "kechikdi" | "kelmadi" | "sababli" | null;
  attAmount: number;
  homework: { value: "done" | "missed"; amount: number; by: string; txId: number; lock: string | null; lockShort: string | null } | null;
  activity: number;
  deducted: number;
  today: number;
  reasonUse: Record<number, number>;
  txs?: GamTx[];
}

export interface GamReason {
  id: number;
  name: string;
  direction: 1 | -1;
  amountMin: number;
  amountMax: number;
  perDayLimit: number;
  noteRequired: boolean;
}

export interface GamView {
  enabled: boolean;
  role: string;
  today: string;
  settings: {
    homeworkDoneCoins: number;
    homeworkMissedPenalty: number;
    activityMaxPerClick: number;
    activityGroupLimitPerLesson: number;
    dailyDeductionLimit: number;
    objectionDays: number;
    /** Modul shu kundan qamraydi; oldingi darslarga cheklov yo'q. */
    startDate?: string | null;
  };
  sys: Record<string, boolean>;
  reasons: GamReason[];
  group: { id: number; label: string; branchName: string; teacher: string } | null;
  canTeach: boolean;
  canExcuse: boolean;
  activityUsed: number;
  rows: GamRow[];
  monthCoins?: Record<string, number>;
}

export interface OpRes {
  txId: number | null;
  amount: number;
  applied: number;
  balance: number;
  levelUp: { name: string } | null;
  badges: { name: string }[];
}

/** Tanga yozuvining qisqa nomi (chip): «Uy vazifasi», «Faol», «Davomat»… */
export function txLabel(tx: Pick<GamTx, "type" | "reasonName">): string {
  switch (tx.type) {
    case "homework_done":
    case "homework_missed":
      return "Uy vazifasi";
    case "activity":
      return "Faol";
    case "attendance":
      return "Davomat";
    case "absence":
      return "Qoldirdi";
    default:
      return tx.reasonName || "Tanga";
  }
}

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

// ── Dars vaqti va sanalari ─────────────────────────────────────────────

/** "16:00 - 18:00" → [960, 1080] (daqiqa); o'qilmasa null. */
export function timeRangeMin(time: string | undefined | null): [number, number] | null {
  const m = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/.exec(time || "");
  if (!m) {
    const one = /(\d{1,2}):(\d{2})/.exec(time || "");
    return one ? [Number(one[1]) * 60 + Number(one[2]), Number(one[1]) * 60 + Number(one[2])] : null;
  }
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}

/** Guruh muddati: startDate/endDate ("YYYY-MM-DD"), bo'lmasa `period` ("DD.MM.YYYY - DD.MM.YYYY"). */
export function groupBounds(g: Pick<Group, "period" | "startDate" | "endDate">): { start: Date | null; end: Date | null } {
  const iso = (s?: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const p = parsePeriod(g.period);
  return { start: iso(g.startDate) ?? p.start, end: iso(g.endDate) ?? p.end };
}

/** Guruh boshlanish kuni "YYYY-MM-DD" (sarlavhadagi «02.03.2026 dan»); yo'q — "". */
export function groupStartIso(g: Pick<Group, "period" | "startDate" | "endDate">): string {
  const s = groupBounds(g).start;
  if (!s) return "";
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Oyning dars kunlari ("YYYY-MM-DD"), guruh muddati ichida. */
export function lessonIsosOf(g: Pick<Group, "day" | "period" | "startDate" | "endDate">, monthKey: string): string[] {
  const [y, m] = monthKey.split("-").map(Number);
  return lessonDates(g.day, y, m, groupBounds(g)).map((l) => l.iso);
}

/** Tanlangan darsdan oldingi / keyingi dars kuni (12 oygacha qidiradi). */
export function neighbourLesson(g: Pick<Group, "day" | "period" | "startDate" | "endDate">, iso: string, dir: 1 | -1): string | null {
  let mk = iso.slice(0, 7);
  for (let i = 0; i < 12; i += 1) {
    const list = lessonIsosOf(g, mk);
    const hit = dir > 0 ? list.find((d) => d > iso) : [...list].reverse().find((d) => d < iso);
    if (hit) return hit;
    mk = shiftMonth(mk, dir);
  }
  return null;
}

/** Ochilganda ko'rsatiladigan dars: bugun dars bo'lsa — bugun, aks holda eng yaqin o'tgan, u ham yo'q — eng yaqin keladigan. */
export function defaultLesson(g: Pick<Group, "day" | "period" | "startDate" | "endDate">, today: string): string | null {
  if (lessonIsosOf(g, today.slice(0, 7)).includes(today)) return today;
  return neighbourLesson(g, today, -1) ?? neighbourLesson(g, today, 1);
}

/**
 * Davomatni o'zgartirish mumkinmi — serverdagi qoida (lib/gamification/attendance.ts →
 * attendanceEditDenial) taqlidi, faqat ko'rsatish uchun: tugma o'chiq va sababi yozilsin.
 * Gamifikatsiya o'chiq bo'lsa cheklov yo'q (kelgusi darsdan tashqari).
 */
export function editDenial(view: GamView | null | undefined, date: string, today: string): string | null {
  if (date > today) return "Bu dars hali bo'lmagan — davomat dars kuni belgilanadi";
  if (!view || !view.enabled || view.role === "director") return null;
  if (view.settings.startDate && date < view.settings.startDate) return null;
  if (view.role === "teacher") {
    if (!view.canTeach) return "Bu guruhning davomatini guruh ustozi, filial admini yoki direktor belgilaydi";
    if (date !== today) return "Ustoz davomatni faqat dars kuni o'zgartiradi — keyin filial admini yoki direktorga murojaat qiling";
    return null;
  }
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  if (days > view.settings.objectionDays) return `E'tiroz muddati (${view.settings.objectionDays} kun) o'tgan — bu darsning davomatini direktor o'zgartiradi`;
  return null;
}

/** Ikki ISO kun orasidagi kalendar kunlar (b − a). */
export function daysBetweenIso(a: string, b: string): number {
  const d = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((d(b) - d(a)) / 86_400_000);
}

/** Toshkent vaqtidagi kun daqiqasi (0..1439). */
export function uzMinuteOfDay(ms: number): number {
  const u = toUz(new Date(ms));
  return u.getHours() * 60 + u.getMinutes();
}

/** Oy belgilari xaritasi: pupilId → belgi (bitta sana uchun). */
export function marksOfDate(marks: AttendanceMark[] | null, date: string): Map<number, AttendanceMark> {
  const m = new Map<number, AttendanceMark>();
  for (const x of marks ?? []) if (x.date === date) m.set(x.pupilId, x);
  return m;
}
