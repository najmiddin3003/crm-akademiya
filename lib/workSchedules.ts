// Boshqaruv → Ish jadvali (sidebar: Boshqaruv > Ish jadvali, href
// /management-ish-jadvali). MongoDB `work_schedules` kolleksiyasi.
//
// Xodimlarga biriktiriladigan ish rejimi shabloni: nomi, qisqa kod va
// faol/nofaol holati.
export interface WorkSchedule {
  id: number;
  name: string;
  code: string;
  active: boolean;

  // --- Yangi versiya (31-qism, «Ish jadvallari» rasmi) — hammasi ixtiyoriy, eski yozuvlarda yo'q ---
  /** fixed — belgilangan soat; lessons — dars jadvali bo'yicha (o'qituvchi); shift — navbatchilik. */
  kind?: WorkScheduleKind;
  /** Kimlar uchun (izoh): «Rahbar, menejer, moderator, IT». */
  description?: string;
  /** "HH:MM" — ish boshlanishi / tugashi (fixed, shift). */
  start?: string;
  end?: string;
  /** "HH:MM" — tanaffus (fixed); bo'sh — tanaffussiz. */
  breakStart?: string;
  breakEnd?: string;
  /** Ish kunlari: 1 — dushanba … 7 — yakshanba (fixed). */
  days?: number[];
  /** Navbatchilik: necha sutka ishlaydi / dam oladi (shift). */
  shiftOn?: number;
  shiftOff?: number;
  /** Dars jadvali bo'yicha: birinchi darsdan necha daqiqa oldin keladi (lessons). */
  leadMinutes?: number;
}

export type WorkScheduleKind = "fixed" | "lessons" | "shift";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMin = (hhmm: string | undefined) => (hhmm && HHMM.test(hhmm) ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : null);

/** Kunlik ish daqiqalari (tanaffus ayrilgan); hisoblab bo'lmasa null. */
export function dailyMinutes(s: Pick<WorkSchedule, "start" | "end" | "breakStart" | "breakEnd">): number | null {
  const a = toMin(s.start);
  const b = toMin(s.end);
  if (a === null || b === null) return null;
  const span = b > a ? b - a : b + 1440 - a;
  const ba = toMin(s.breakStart);
  const bb = toMin(s.breakEnd);
  return span - (ba !== null && bb !== null && bb > ba ? bb - ba : 0);
}

/** Haftalik soat: fixed — kunlar × kunlik; shift — 7 kunda o'rtacha; lessons — null (darsga qarab). */
export function weeklyHours(s: WorkSchedule): number | null {
  if ((s.kind ?? "fixed") === "lessons") return null;
  const daily = dailyMinutes(s);
  if (daily === null) return null;
  if (s.kind === "shift") {
    const on = Number(s.shiftOn) || 1;
    const off = Number(s.shiftOff) || 0;
    // Sutkalik navbat: ishlagan kuni — `daily` (08:00→08:00 = 24 soat); tsikl uzunligi on + off.
    return Math.round(((daily * on) / (on + off)) * 7 / 60);
  }
  return Math.round(((s.days?.length ?? 0) * daily) / 60);
}

/**
 * Klient yuborgan yangi maydonlarni tekshiradi (POST va PATCH — bitta qoida). Berilmagani natijada
 * yo'q; noto'g'risi — xato matni.
 */
export function scheduleExtras(body: Record<string, unknown>): { set: Partial<WorkSchedule>; error?: string } {
  const set: Partial<WorkSchedule> = {};
  if (body.kind !== undefined) {
    if (!["fixed", "lessons", "shift"].includes(String(body.kind))) return { set, error: "Noto'g'ri jadval turi" };
    set.kind = body.kind as WorkScheduleKind;
  }
  if (typeof body.description === "string") set.description = body.description.trim().slice(0, 200);
  for (const k of ["start", "end", "breakStart", "breakEnd"] as const) {
    if (body[k] === undefined) continue;
    const v = String(body[k] ?? "").trim();
    if (v && !HHMM.test(v)) return { set, error: "Vaqt SS:DD ko'rinishida bo'lsin" };
    set[k] = v;
  }
  if (body.days !== undefined) {
    if (!Array.isArray(body.days)) return { set, error: "Noto'g'ri ish kunlari" };
    const days = [...new Set((body.days as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
    set.days = days;
  }
  for (const k of ["shiftOn", "shiftOff", "leadMinutes"] as const) {
    if (body[k] === undefined) continue;
    const n = Math.floor(Number(body[k]));
    if (!Number.isFinite(n) || n < 0 || n > 240) return { set, error: "Noto'g'ri son" };
    set[k] = n;
  }
  if (set.breakStart && set.breakEnd && (toMin(set.breakEnd) ?? 0) <= (toMin(set.breakStart) ?? 0)) {
    return { set, error: "Tanaffus tugashi boshlanishidan keyin bo'lsin" };
  }
  return { set };
}

export const WORK_SCHEDULE_STATUS_LABELS = { active: "Faol", inactive: "Nofaol" };
