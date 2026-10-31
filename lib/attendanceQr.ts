import type { Db } from "mongodb";

// XODIMLAR DAVOMATI — «Ishga keldim» SOZLAMASI (28.09.2026; QR'siz — 31.10.2026).
//
// 28.09–31.10.2026 xodim filial ekranidagi har 30 soniyada yangilanadigan QR
// kodni skanerlardi. 31.10.2026 dan QR YO'Q (foydalanuvchi: "qr code kerak emas
// endi ... lokatsiya va face id bo'lsa bo'ldi"): xodimlar botidagi «📷 Ishga
// keldim» Mini App'i (/xodim/keldim) yuzni (Face ID, admin yoqqanda) va
// joylashuvni tekshiradi, filial joylashuvdan aniqlanadi (lib/attendanceCheck.ts
// → locateBranch; koordinatasiz filialda — xodimning o'z filiali).
//
// Bu yerda qolgani: sozlama (`attendance.qr` — kalit nomi tarixiy) va eski QR
// havolalarini TANISH (`parseScanned`) — kimdadir eski kod rasmi qolgan
// bo'lsa, bot uni tugmaga yo'naltiradi (lib/staffBot/router.ts), belgilamaydi.

export type AttendanceKind = "in" | "out";

/**
 * Eski QR havolasi (`https://t.me/<bot>?start=k_…`) yoki `/start` parametri
 * ("k_…" — keldim, "x_…" — ketdim): tur va token. Tanilmasa null.
 * 31.10.2026 dan faqat botdagi yo'naltirish uchun — token TEKSHIRILMAYDI.
 */
export function parseScanned(text: string): { kind: AttendanceKind; token: string } | null {
  const s = String(text ?? "").trim();
  const link = /[?&]start=([A-Za-z0-9_-]{1,64})/.exec(s);
  const m = /^([kx])_([0-9a-z_]{1,60})$/.exec(link ? link[1] : s);
  if (!m) return null;
  return { kind: m[1] === "x" ? "out" : "in", token: m[2] };
}

// ── Sozlama ─────────────────────────────────────────────────────────

export const ATTENDANCE_SETTINGS_KEY = "attendance.qr";

export interface AttendanceSettings {
  /**
   * «Ishdan ketdim». Kodi tayyor, lekin foydalanuvchi qarori bilan hozircha
   * O'CHIQ (28.09.2026: "ketdimni keyin ishlatamiz, keldim ishlashi shart").
   * Admin «Ishga keldim» sahifasidagi tugma bilan yoqadi — deploy shart emas.
   */
  checkoutEnabled: boolean;
  /**
   * FACE ID (30.10.2026, lib/staffFace.ts): «Ishga keldim/ketdim» dan oldin
   * xodim o'z telefonida yuzini tasdiqlaydi. Sukut O'CHIQ — admin «Ishga keldim» sahifasidagi
   * tugma bilan yoqadi.
   */
  faceRequired: boolean;
  /**
   * Yuz izlari orasidagi masofa chegarasi (kichigi — qattiqroq). Interfeysda
   * yo'q: kerak bo'lsa bazada `values.faceThreshold` (0.35–0.6), sukut 0.5.
   */
  faceThreshold: number;
}

export const FACE_THRESHOLD_DEFAULT = 0.5;

export async function loadAttendanceSettings(db: Db): Promise<AttendanceSettings> {
  const doc = await db.collection("settings").findOne({ key: ATTENDANCE_SETTINGS_KEY }, { projection: { _id: 0, values: 1 } });
  const v = (doc?.values ?? {}) as { checkoutEnabled?: unknown; faceRequired?: unknown; faceThreshold?: unknown };
  const th = Number(v.faceThreshold);
  return {
    checkoutEnabled: v.checkoutEnabled === true,
    faceRequired: v.faceRequired === true,
    faceThreshold: Number.isFinite(th) && th >= 0.35 && th <= 0.6 ? th : FACE_THRESHOLD_DEFAULT,
  };
}

/** Faqat berilgan kalitlar yoziladi — biri o'zgarganda boshqasi o'chib ketmasin. */
export async function saveAttendanceSettings(
  db: Db,
  patch: Partial<Pick<AttendanceSettings, "checkoutEnabled" | "faceRequired">>,
): Promise<void> {
  const set: Record<string, unknown> = { key: ATTENDANCE_SETTINGS_KEY };
  if (typeof patch.checkoutEnabled === "boolean") set["values.checkoutEnabled"] = patch.checkoutEnabled;
  if (typeof patch.faceRequired === "boolean") set["values.faceRequired"] = patch.faceRequired;
  await db.collection("settings").updateOne({ key: ATTENDANCE_SETTINGS_KEY }, { $set: set }, { upsert: true });
}
