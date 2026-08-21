// Imtihon bo'limi uchun umumiy tiplar va hisob-kitob. API route'lari ham,
// klient komponentlar ham shu faylni bo'lishadi — shunda ball formulasi
// bitta joyda turadi.
//
// MongoDB kolleksiyalari: `monthly_exams` va `uzbmb_exams`.

import { MONTHLY_SEED_ROWS, UZBMB_SEED_ROWS, UZBMB_CERT_SEED } from "@/constants/imtihon";

export interface MonthlyExam {
  id: number;
  student: string;
  subject: string;
  /** Bosqich — bo'sh bo'lishi mumkin. */
  level: string;
  /** "YYYY-MM". */
  month: string;
  total: number;
  correct: number;
  /** O'zlashtirish foizi — `total`/`correct` dan avtomatik. */
  pct: number;
}

export interface UzbmbExam {
  id: number;
  student: string;
  /** "YYYY-MM". */
  month: string;
  /** 1-blok (asosiy) fani — ×3.1, maksimal 93 ball. */
  b1s: string;
  /** To'g'ri javoblar (0–30). Sertifikat bo'lsa `null`. */
  b1c: number | null;
  /** Milliy sertifikat bo'lsa ball qo'lda kiritiladi. */
  b1cert?: boolean;
  b1m?: number;
  /** 2-blok (asosiy) fani — ×2.1, maksimal 63 ball. */
  b2s: string;
  b2c: number | null;
  b2cert?: boolean;
  b2m?: number;
  /** Majburiy fanlar — Ona tili, Matematika, O'zb. tarixi (10 tadan). */
  m1: number;
  m2: number;
  m3: number;
  /** Hisoblangan ballar. */
  b1: number;
  b2: number;
  maj: number;
  total: number;
}

/** UzBMB ball tizimi — 1-blok 30×3.1, 2-blok 30×2.1, majburiy 30×1.1. */
export const UB_CFG = { b1k: 3.1, b2k: 2.1, mk: 1.1, b1max: 30, b2max: 30, mmax: 10, MAX: 189 } as const;

/** 1-blok va 2-blokning maksimal ballari (sertifikat qo'lda kiritilganda chegara). */
export const UB_B1_MAX_BALL = 93;
export const UB_B2_MAX_BALL = 63;

export function imPct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Yanvar", "02": "Fevral", "03": "Mart", "04": "Aprel",
  "05": "May", "06": "Iyun", "07": "Iyul", "08": "Avgust",
  "09": "Sentabr", "10": "Oktabr", "11": "Noyabr", "12": "Dekabr",
};

/** "2026-08" → "Avgust 2026". */
export function imMonthLabel(m: string): string {
  const [y, mm] = String(m).split("-");
  return (MONTH_NAMES[mm] || m) + " " + y;
}

/** Bir kasrgacha yaxlitlash — UzBMB ballari 3.1/2.1/1.1 koeffitsientlarida. */
export function ubR1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Ballni ko'rsatish: butun bo'lsa kasrsiz, aks holda bitta kasr bilan. */
export function ubFmt(v: number): string {
  const r = ubR1(v);
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

export interface UbCalcInput {
  b1cert?: boolean;
  b1m?: number | null;
  b1c?: number | null;
  b2cert?: boolean;
  b2m?: number | null;
  b2c?: number | null;
  m1?: number | null;
  m2?: number | null;
  m3?: number | null;
}

export function ubCalc(r: UbCalcInput): { b1: number; b2: number; maj: number; total: number } {
  const b1 = r.b1cert
    ? Math.min(UB_B1_MAX_BALL, ubR1(Number(r.b1m) || 0))
    : ubR1((r.b1c || 0) * UB_CFG.b1k);
  const b2 = r.b2cert
    ? Math.min(UB_B2_MAX_BALL, ubR1(Number(r.b2m) || 0))
    : ubR1((r.b2c || 0) * UB_CFG.b2k);
  const maj = ubR1(((r.m1 || 0) + (r.m2 || 0) + (r.m3 || 0)) * UB_CFG.mk);
  return { b1, b2, maj, total: ubR1(b1 + b2 + maj) };
}

/** Import qilingan "oy" ustunini "YYYY-MM" ga keltiradi (bo'lmasa — joriy oy). */
export function normalizeMonth(raw: string, now: Date = new Date()): string {
  let month = String(raw || "").trim();
  const m = month.match(/(\d{4})[.\/-](\d{1,2})/) || month.match(/(\d{1,2})[.\/-](\d{4})/);
  if (m) {
    month = m[1].length === 4
      ? `${m[1]}-${String(m[2]).padStart(2, "0")}`
      : `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return month;
}

/* ============================================================
   Demo urug'lari — kolleksiya bo'sh bo'lganda bir marta yoziladi
   ============================================================ */

export function buildMonthlySeed(): MonthlyExam[] {
  const out: MonthlyExam[] = [];
  let id = 1;
  for (const [student, subject, level, months] of MONTHLY_SEED_ROWS as [
    string, string, string, [string, number, number][],
  ][]) {
    for (const [month, total, correct] of months) {
      out.push({ id: id++, student, subject, level, month, total, correct, pct: imPct(correct, total) });
    }
  }
  return out;
}

export function buildUzbmbSeed(): UzbmbExam[] {
  let id = 1;
  const arr: UzbmbExam[] = (UZBMB_SEED_ROWS as [
    string, string, number, string, number, number, number, number, string,
  ][]).map(([student, b1s, b1c, b2s, b2c, m1, m2, m3, month]) => {
    const base = { id: id++, student, b1s, b1c, b2s, b2c, m1, m2, m3, month };
    return { ...base, ...ubCalc(base) };
  });
  const cert = { id: id++, ...(UZBMB_CERT_SEED as unknown as Omit<UzbmbExam, "id" | "b1" | "b2" | "maj" | "total">) };
  arr.push({ ...cert, ...ubCalc(cert) });
  return arr;
}

/* ============================================================
   Mijozdan kelgan yozuvlarni tozalash (kiritish modali va import)
   ============================================================ */

type MonthlyInput = Omit<MonthlyExam, "id">;
type UzbmbInput = Omit<UzbmbExam, "id">;

function num(v: unknown, max?: number): number {
  const n = Math.max(0, Number(v) || 0);
  return max === undefined ? Math.trunc(n) : Math.min(max, Math.trunc(n));
}

export function sanitizeMonthly(raw: unknown): MonthlyInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const student = String(r.student || "").trim();
  const subject = String(r.subject || "").trim();
  if (!student || !subject) return null;
  const total = num(r.total);
  const correct = num(r.correct);
  if (total <= 0 || correct > total) return null;
  return {
    student,
    subject,
    level: String(r.level || "").trim(),
    month: normalizeMonth(String(r.month || "")),
    total,
    correct,
    pct: imPct(correct, total),
  };
}

export function sanitizeUzbmb(raw: unknown): UzbmbInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const student = String(r.student || "").trim();
  const b1s = String(r.b1s || "").trim();
  const b2s = String(r.b2s || "").trim();
  if (!student || !b1s || !b2s) return null;
  const b1cert = Boolean(r.b1cert);
  const b2cert = Boolean(r.b2cert);
  const base = {
    student,
    month: normalizeMonth(String(r.month || "")),
    b1s,
    b1cert,
    b1m: b1cert ? Math.min(UB_B1_MAX_BALL, Math.max(0, Number(r.b1m) || 0)) : 0,
    b1c: b1cert ? null : num(r.b1c, UB_CFG.b1max),
    b2s,
    b2cert,
    b2m: b2cert ? Math.min(UB_B2_MAX_BALL, Math.max(0, Number(r.b2m) || 0)) : 0,
    b2c: b2cert ? null : num(r.b2c, UB_CFG.b2max),
    m1: num(r.m1, UB_CFG.mmax),
    m2: num(r.m2, UB_CFG.mmax),
    m3: num(r.m3, UB_CFG.mmax),
  };
  return { ...base, ...ubCalc(base) };
}
