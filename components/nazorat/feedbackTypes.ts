// Nazorat > Fikr-mulohaza — umumiy tiplar va tanlov ro'yxatlari.
// /api/feedback route'i ham, sahifa ham shu fayldan o'qiydi.
//
// NEGA shu yerda: ilgari sahifa `constants/feedback.js` dagi 8 ta QO'LDA
// YOZILGAN yozuvdan o'qirdi va fikr-mulohaza kelib tushadigan hech qanday
// yo'l yo'q edi. Endi ma'lumot MongoDB `feedback` kolleksiyasida, shuning
// uchun tur va tanlovlar bitta joyda bo'lishi kerak.

export const FEEDBACK_TYPES = ["Shikoyat", "Taklif", "Maqtov", "Boshqa"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_FROM_OPTIONS = ["O'quvchi", "Ota-ona", "Xodim", "Boshqa"] as const;
export type FeedbackFrom = (typeof FEEDBACK_FROM_OPTIONS)[number];

export interface FeedbackRecord {
  id: number;
  /** Filial nomi — /api/branches dagi haqiqiy filiallardan tanlanadi. */
  filial: string;
  /** Kimdan kelgani: O'quvchi / Ota-ona / Xodim / Boshqa. */
  from: string;
  name: string;
  phone: string;
  type: FeedbackType;
  izoh: string;
  /** Yaratilgan payt — "YYYY-MM-DDTHH:mm" (mahalliy vaqt, saralash uchun). */
  createdAt: string;
  // ── Yangi versiya (34-qism, «Fikr-mulohaza»): holat va mas'ul. Eski yozuvlarda yo'q — «Yangi». ──
  status?: FeedbackStatus;
  /** Mas'ul xodim ismi (bo'sh — tayinlanmagan). */
  assignee?: string;
  /** Natija izohi («usta chaqirildi», «ustozga yetkazildi»). */
  resolution?: string;
  /** Hal qilingan payt — "YYYY-MM-DDTHH:mm". */
  resolvedAt?: string | null;
  /** Qaysi o'quvchi haqida (ota-ona / o'quvchi fikrida). */
  pupilId?: number | null;
  pupilName?: string;
  /** Qayerdan: «Telegram bot», «Kabinet», «Telefon», «Admin yozdi». */
  source?: string;
  createdBy?: string;
}

export const FEEDBACK_STATUSES = ["yangi", "korib", "hal"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = { yangi: "Yangi", korib: "Ko'rib chiqilmoqda", hal: "Hal qilindi" };
export const statusOf = (f: Pick<FeedbackRecord, "status">): FeedbackStatus => f.status ?? "yangi";

export function isFeedbackType(v: unknown): v is FeedbackType {
  return FEEDBACK_TYPES.includes(v as FeedbackType);
}

/** "2026-08-24T14:23" → "24.08.2026 | 14:23" (loyihadagi umumiy ko'rinish). */
export function formatFeedbackCreatedAt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || "");
  if (!m) return iso || "—";
  const [, y, mo, d, h, mi] = m;
  return `${d}.${mo}.${y} | ${h}:${mi}`;
}
