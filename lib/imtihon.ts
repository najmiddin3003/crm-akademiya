// Imtihon bo'limi uchun umumiy tiplar va hisob-kitob. API route'lari ham,
// klient komponentlar ham shu faylni bo'lishadi — shunda ball formulasi
// bitta joyda turadi.
//
// MongoDB kolleksiyalari: `monthly_exams`, `uzbmb_exams` va `group_exams`
// (guruh bo'yicha kiritilgan imtihon — "Natija kiritish" paneli).

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

/* ============================================================
   O'zlashtirish TOIFALARI — rang shkalasi
   ============================================================ */

export type ImTierKey = "past" | "orta" | "yaxshi" | "zor";

export interface ImTier {
  key: ImTierKey;
  label: string;
  /** Yorliq (badge) — fon va matn rangi bir-biriga moslangan. */
  cls: string;
  /** Faqat matn rangi (kartochka raqamlari uchun). */
  text: string;
}

/**
 * To'rt toifa: past (qizil), o'rtacha (sariq), yaxshi (och yashil), zo'r
 * (yashil). Chegaralar — foiz: <50, 50–69, 70–84, ≥85.
 *
 * Guruh imtihoni jadvali va Sarhisob sahifasi shundan foydalanadi; fon va
 * matn rangi juft, shunda tungi rejimda ham o'qiladi.
 */
export const IM_TIERS: Record<ImTierKey, ImTier> = {
  past: {
    key: "past",
    label: "Past",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
  },
  orta: {
    key: "orta",
    label: "O'rtacha",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
  },
  yaxshi: {
    key: "yaxshi",
    label: "Yaxshi",
    cls: "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-300",
    text: "text-lime-700 dark:text-lime-400",
  },
  zor: {
    key: "zor",
    label: "Zo'r",
    cls: "bg-emerald-500 text-white dark:bg-emerald-500/80 dark:text-white",
    text: "text-emerald-600 dark:text-emerald-400",
  },
};

export function imTier(pct: number): ImTier {
  if (pct >= 85) return IM_TIERS.zor;
  if (pct >= 70) return IM_TIERS.yaxshi;
  if (pct >= 50) return IM_TIERS.orta;
  return IM_TIERS.past;
}

/* ============================================================
   GURUH IMTIHONI — "Natija kiritish" paneli (MongoDB `group_exams`)
   ============================================================ */

export interface GroupExamStudent {
  /** `pupils.id`. */
  pupilId: number;
  name: string;
  phone: string;
  correct: number;
  pct: number;
}

/**
 * Bitta guruhning bitta imtihoni — fan, ustoz, guruh, sana va har bir
 * o'quvchining natijasi bitta hujjatda. Sarhisob sahifasi shu ro'yxatni
 * ko'rsatadi.
 *
 * Har bir o'quvchi natijasi `monthly_exams` ga ham ko'chiriladi
 * (app/api/imtihon/group) — shunda "Oylik imtihon" jadvali va statistikasi
 * ham shu natijalarni ko'radi.
 */
export interface GroupExam {
  id: number;
  /** Imtihon O'TKAZILGAN sana ("YYYY-MM-DD") — panelda tanlanadi, yozuv qo'shilgan sana emas. */
  date: string;
  /** Fan yo'nalishi — `offline_courses.name`. */
  course: string;
  teacher: string;
  groupId: number;
  /** Guruh raqami (`groups.name`, odatda "13"). */
  groupName: string;
  /** "Matematika (13-guruh)" — ro'yxatlarda ko'rinadigan nom. */
  groupLabel: string;
  /** Guruh bosqichi — bo'sh bo'lishi mumkin. */
  level: string;
  branchId: number;
  /** Savollar soni. */
  total: number;
  students: GroupExamStudent[];
  studentCount: number;
  /** Guruh o'rtacha bali (foiz, butun). */
  avgPct: number;
  createdAt: string;
  createdBy: string;
}

export function groupAvgPct(students: Pick<GroupExamStudent, "pct">[]): number {
  return students.length ? Math.round(students.reduce((s, r) => s + r.pct, 0) / students.length) : 0;
}

/** Mijozdan keladigan panel yuki — tekshiruvdan o'tgach `GroupExam` ga aylanadi. */
export interface GroupExamInput {
  date: string;
  course: string;
  teacher: string;
  groupId: number;
  total: number;
  students: { pupilId: number; correct: number }[];
}

/**
 * Panel yuborgan yukni tekshiradi. Xato bo'lsa — foydalanuvchiga
 * ko'rsatiladigan MATN (panel ham xuddi shu tartibda tekshiradi, bu
 * serverdagi ikkinchi qorovul).
 */
export function sanitizeGroupExam(raw: unknown): { ok: true; input: GroupExamInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Noto'g'ri so'rov" };
  const r = raw as Record<string, unknown>;
  const date = String(r.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Imtihon sanasini tanlang" };
  const course = String(r.course || "").trim();
  if (!course) return { ok: false, error: "Fan yo'nalishini tanlang" };
  const teacher = String(r.teacher || "").trim();
  if (!teacher) return { ok: false, error: "Ustozni tanlang" };
  const groupId = Number(r.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) return { ok: false, error: "Guruhni tanlang" };
  const total = Math.trunc(Number(r.total) || 0);
  if (total <= 0) return { ok: false, error: "Savollar sonini kiriting" };
  if (!Array.isArray(r.students) || r.students.length === 0) return { ok: false, error: "Kamida bitta o'quvchi tanlang" };

  const students: GroupExamInput["students"] = [];
  const seen = new Set<number>();
  for (const s of r.students as unknown[]) {
    const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const pupilId = Number(o.pupilId);
    if (!Number.isFinite(pupilId) || seen.has(pupilId)) continue;
    const correct = Math.trunc(Number(o.correct) || 0);
    if (correct < 0 || correct > total) {
      return { ok: false, error: `To'g'ri javoblar 0 dan ${total} gacha bo'lishi kerak` };
    }
    seen.add(pupilId);
    students.push({ pupilId, correct });
  }
  if (students.length === 0) return { ok: false, error: "Kamida bitta o'quvchi tanlang" };
  return { ok: true, input: { date, course, teacher, groupId, total, students } };
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
