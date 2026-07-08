import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ensureIndexes } from "./mongodb";
import { sendSms, normalizePhone } from "./eskiz";

export type Purpose = "activate" | "reset";

// Xavfsizlik sozlamalari (spetsifikatsiyaga muvofiq)
export const CODE_TTL_MS = 10 * 60 * 1000; // kod 10 daqiqa amal qiladi
export const MAX_ATTEMPTS = 3; // bitta kodga 3 martadan keyin yangi kod kerak
export const MAX_SENDS_PER_HOUR = 5; // soatiga 5 tadan ko'p kod so'ralmaydi
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // taklif tokeni 72 soat
export const MIN_PASSWORD = 8; // parol kamida 8 belgi

export function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000)); // 6 xonali (100000..999999)
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function compareSecret(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function isValidPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD;
}

// Telefonni tekshirish: normallashtirilgach 998 + 9 xona = 12 xona bo'lishi kerak.
export function isValidPhone(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const n = normalizePhone(input);
  return /^998\d{9}$/.test(n);
}

interface CodeResult {
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
  code?: string; // faqat ichki foydalanish uchun (SMS matniga qo'yiladi)
}

// Yangi tasdiqlash kodini yaratib DB ga yozadi. Rate-limit (5/soat) tekshiradi,
// eski faol kodlarni bekor qiladi. SMS yuborishni CHAQIRUVCHI bajaradi.
export async function issueCode(phone: string, purpose: Purpose): Promise<CodeResult> {
  const db = await ensureIndexes();
  const col = db.collection("verification_codes");
  const now = Date.now();
  const normPhone = normalizePhone(phone);

  const recentSends = await col.countDocuments({
    phone: normPhone,
    purpose,
    createdAt: { $gt: new Date(now - 60 * 60 * 1000) },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: "Juda ko'p urinish. Bir soatdan so'ng qayta urinib ko'ring.", retryAfterSec: 3600 };
  }

  // Oldingi faol kodlarni bekor qilamiz — faqat eng yangisi ishlaydi.
  await col.updateMany({ phone: normPhone, purpose, consumed: false }, { $set: { consumed: true } });

  const code = generateCode();
  const codeHash = await hashSecret(code);
  await col.insertOne({
    phone: normPhone,
    purpose,
    codeHash,
    attempts: 0,
    consumed: false,
    createdAt: new Date(now),
    expiresAt: new Date(now + CODE_TTL_MS),
    purgeAt: new Date(now + 60 * 60 * 1000), // TTL: rate-limit oynasi tugagach o'chadi
  });

  return { ok: true, code };
}

interface VerifyResult {
  ok: boolean;
  error?: string;
}

// Telefon + kod juftligini tekshiradi. To'g'ri bo'lsa kodni "consumed" qiladi.
// Noto'g'ri bo'lsa urinishlar sonini oshiradi (3 dan oshsa kod bekor bo'ladi).
export async function verifyCode(phone: string, code: string, purpose: Purpose): Promise<VerifyResult> {
  const db = await ensureIndexes();
  const col = db.collection("verification_codes");
  const normPhone = normalizePhone(phone);

  const doc = await col.findOne(
    { phone: normPhone, purpose, consumed: false, expiresAt: { $gt: new Date() } },
    { sort: { createdAt: -1 } }
  );

  if (!doc) {
    return { ok: false, error: "Kod eskirgan yoki topilmadi. Yangi kod so'rang." };
  }

  if ((doc.attempts ?? 0) >= MAX_ATTEMPTS) {
    await col.updateOne({ _id: doc._id }, { $set: { consumed: true } });
    return { ok: false, error: "Juda ko'p noto'g'ri urinish. Yangi kod so'rang." };
  }

  const match = await compareSecret(String(code), doc.codeHash);
  if (!match) {
    await col.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    const left = MAX_ATTEMPTS - ((doc.attempts ?? 0) + 1);
    return {
      ok: false,
      error: left > 0 ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi.` : "Kod noto'g'ri. Yangi kod so'rang.",
    };
  }

  await col.updateOne({ _id: doc._id }, { $set: { consumed: true } });
  return { ok: true };
}

// Taklif SMS matni (havola + kod).
export function activationMessage(token: string, code: string): string {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `CRM-Akademiya tizimida hisobingizni faollashtirish uchun havola: ${base}/activate?t=${token} yoki tasdiqlash kodi: ${code}`;
}

export function resetMessage(code: string): string {
  return `CRM-Akademiya tizimida parolni tiklash uchun tasdiqlash kodi: ${code}. Kod 10 daqiqa amal qiladi. Uni hech kimga bermang.`;
}

export { sendSms, normalizePhone };
