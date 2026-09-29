import crypto from "node:crypto";
import type { Db } from "mongodb";
import { staffBotUsername } from "@/lib/staffBot/config";

// XODIMLAR DAVOMATI — «Ishga keldim» QR KODI (28.09.2026).
//
// Foydalanuvchi qarori: QR filial qabulxonasidagi EKRANDA turadi va har
// 30 soniyada yangilanadi (Nazorat → Ishga keldim (QR), /nazorat-qr) —
// rasmini olib uydan skanerlab bo'lmasin. Xodim uni botdagi (29.09.2026
// dan @tizimli_akademiya_bot) «📷 Ishga keldim» tugmasi (Telegram ichidagi skaner, /xodim/keldim) yoki
// oddiy telefon kamerasi bilan skanerlaydi: QR ichida bot havolasi
// `t.me/<bot>?start=k_<token>`, ya'ni kamera ham botni ochib, kodni o'zi
// yuboradi (lib/staffBot/router.ts).
//
// TOKEN: `<filial>_<slot36>_<imzo>`. Slot — 30 soniyalik oraliq raqami,
// imzo — HMAC-SHA256 ning 16 hex belgisi. Kalit SESSION_SECRET dan ajratib
// olinadi (alohida muhit o'zgaruvchisi shart emas). Hammasi `/start`
// parametriga sig'adi (faqat [A-Za-z0-9_-], 64 belgigacha).
//
// Joriy va IKKI oldingi slot qabul qilinadi (≤ 90 s): kamera → Telegram →
// /start yo'li bir necha soniya oladi, odam "Start" ni bosishga ham
// ulgurishi kerak. Bir kod bir vaqtda hamma xodimga yaraydi — ekran
// oldidagi navbat uchun shunday bo'lishi kerak.

export const QR_SLOT_SEC = 30;
const GRACE_SLOTS = 2;

export type AttendanceKind = "in" | "out";

/** `/start` parametridagi prefiks: k — keldim, x — ketdim. */
const PREFIX: Record<AttendanceKind, "k" | "x"> = { in: "k", out: "x" };

function secretKey(): Buffer {
  // lib/session.ts dagi bilan bir xil sukut — dev'da ham ishlasin.
  const base = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me";
  return crypto.createHmac("sha256", base).update("attendance-qr/v1").digest();
}

function sign(branchId: number, slot: number): string {
  return crypto.createHmac("sha256", secretKey()).update(`${branchId}.${slot}`).digest("hex").slice(0, 16);
}

export function qrSlot(now = Date.now()): number {
  return Math.floor(now / 1000 / QR_SLOT_SEC);
}

/** Keyingi kodgacha qolgan vaqt (ms) — ekran aynan shu paytda yangisini so'raydi. */
export function msToNextSlot(now = Date.now()): number {
  return (qrSlot(now) + 1) * QR_SLOT_SEC * 1000 - now;
}

export function makeQrToken(branchId: number, slot = qrSlot()): string {
  return `${branchId}_${slot.toString(36)}_${sign(branchId, slot)}`;
}

export type TokenCheck = { ok: true; branchId: number } | { ok: false; error: string };

const UNKNOWN = "QR kod tanilmadi — filial ekranidagi kodni skanerlang";

export function verifyQrToken(token: string, now = Date.now()): TokenCheck {
  const m = /^(\d{1,6})_([0-9a-z]{1,12})_([0-9a-f]{16})$/.exec(token);
  if (!m) return { ok: false, error: UNKNOWN };
  const branchId = Number(m[1]);
  const slot = parseInt(m[2], 36);
  const cur = qrSlot(now);
  // +1 — serverlar soati orasidagi kichik farq uchun.
  if (!Number.isSafeInteger(slot) || slot > cur + 1 || slot < cur - GRACE_SLOTS) {
    return { ok: false, error: "QR kod eskirgan — ekrandagi yangi kodni skanerlang" };
  }
  const a = Buffer.from(sign(branchId, slot), "hex");
  const b = Buffer.from(m[3], "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: UNKNOWN };
  return { ok: true, branchId };
}

/** `/start` parametri: "k_<token>" (keldim) yoki "x_<token>" (ketdim). */
export function startPayload(kind: AttendanceKind, token: string): string {
  return `${PREFIX[kind]}_${token}`;
}

/**
 * Skanerlangan matndan tur va token: QR ichidagi havola
 * (`https://t.me/<bot>?start=k_…`) yoki `/start` parametrining o'zi.
 * Tanilmasa null.
 */
export function parseScanned(text: string): { kind: AttendanceKind; token: string } | null {
  const s = String(text ?? "").trim();
  const link = /[?&]start=([A-Za-z0-9_-]{1,64})/.exec(s);
  const m = /^([kx])_([0-9a-z_]{1,60})$/.exec(link ? link[1] : s);
  if (!m) return null;
  return { kind: m[1] === "x" ? "out" : "in", token: m[2] };
}

/**
 * Xodimlar botining @nomi — QR havolasi uchun. 29.09.2026 dan
 * @tizimli_akademiya_bot (lib/staffBot/config.ts). Eski @akademiya_crm_bot
 * havolasi ham tanilaveradi: `parseScanned` bot nomiga qaramaydi.
 */
export { staffBotUsername };

export function qrLink(kind: AttendanceKind, token: string): string {
  return `https://t.me/${staffBotUsername()}?start=${startPayload(kind, token)}`;
}

// ── Sozlama ─────────────────────────────────────────────────────────

export const ATTENDANCE_SETTINGS_KEY = "attendance.qr";

export interface AttendanceSettings {
  /**
   * «Ishdan ketdim». Kodi tayyor, lekin foydalanuvchi qarori bilan hozircha
   * O'CHIQ (28.09.2026: "ketdimni keyin ishlatamiz, keldim ishlashi shart").
   * Admin QR ekranidagi tugma bilan yoqadi — deploy shart emas.
   */
  checkoutEnabled: boolean;
}

export async function loadAttendanceSettings(db: Db): Promise<AttendanceSettings> {
  const doc = await db.collection("settings").findOne({ key: ATTENDANCE_SETTINGS_KEY }, { projection: { _id: 0, values: 1 } });
  const v = (doc?.values ?? {}) as { checkoutEnabled?: unknown };
  return { checkoutEnabled: v.checkoutEnabled === true };
}

export async function saveAttendanceSettings(db: Db, s: AttendanceSettings): Promise<void> {
  await db.collection("settings").updateOne(
    { key: ATTENDANCE_SETTINGS_KEY },
    { $set: { key: ATTENDANCE_SETTINGS_KEY, values: { checkoutEnabled: s.checkoutEnabled } } },
    { upsert: true },
  );
}
