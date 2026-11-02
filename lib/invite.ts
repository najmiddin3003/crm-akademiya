import { CENTER_SHORT } from "@/lib/center";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ensureIndexes } from "./mongodb";
import { sendSms, normalizePhone, eskizConfigured, type SendSmsResult } from "./eskiz";
import { encryptSecret } from "./crypto";

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

// Parol o'rnatilganda ikkalasini ham qaytaradi: login tekshiruvi uchun
// bcrypt hash (asosiy) + admin panelida ko'rsatish uchun shifrlangan nusxa.
export async function setPasswordFields(password: string) {
  return {
    passwordHash: await hashSecret(password),
    passwordEnc: encryptSecret(password),
  };
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

/**
 * SMS'dagi havolaning MANZILI — xodim ochadigan sayt.
 *
 * NEGA `APP_BASE_URL` EMAS. U Vercel'da texnik domenga
 * ("crm-akademiya-777777.vercel.app") sozlangan va SMS'da aynan o'sha
 * ketardi: odam tanimaydigan manzil (ishonchsiz ko'rinadi), ustiga 14
 * belgi uzunroq — SMS uzunligi segment narxiga ta'sir qiladi. Sayt esa
 * `www.tizimli24.uz` da (o'lchandi: `tizimli24.uz` → 308 → `www.` bilan,
 * ya'ni kanonik shakl aynan shu).
 *
 * QATTIQ YOZILGAN, lekin o'zgaruvchi bilan almashtirsa bo'ladi. Ataylab
 * shunday: sozlanmagan holatda ham TO'G'RI manzil chiqsin — SMS matni
 * Vercel oynasidagi qiymatga bog'liq bo'lib qolmasin.
 */
const PUBLIC_SITE_URL = "https://www.tizimli24.uz";

/**
 * SMS matnidagi markaz nomi («CRM-<nom> tizimida ...»).
 *
 * Eskiz faqat moderatsiyadan o'tgan shablonga mos matnni yuboradi, boshqasini
 * 400 bilan qaytaradi. Yangi markazning o'z shabloni tasdiqlanguncha u boshqa
 * markazning tasdiqlangan shabloni bilan yuborsin deb serverga
 * `SMS_CENTER_SHORT` (masalan `Akademiya`) qo'yiladi. Qiymat ish vaqtida
 * o'qiladi — qayta build shart emas; olib tashlansa `CENTER_SHORT` ga qaytadi.
 * (02.11.2026: Temuriylar shabloni moderatsiyada edi.)
 */
function smsCenterShort(): string {
  return (process.env.SMS_CENTER_SHORT || "").trim() || CENTER_SHORT;
}

/**
 * Zaxira Eskiz akkauntidan ketadigan matndagi nom — o'sha akkauntda tasdiqlangan
 * shablondagi nom (`SMS_FALLBACK_CENTER_SHORT`, masalan `Akademiya`); bo'sh — asosiy nom.
 */
function smsFallbackCenterShort(): string {
  return (process.env.SMS_FALLBACK_CENTER_SHORT || "").trim() || smsCenterShort();
}

/** Taklif SMS matni (havola + kod). */
export function activationMessage(token: string, code: string, centerShort: string = smsCenterShort()): string {
  const base = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "") || PUBLIC_SITE_URL;
  return `CRM-${centerShort} tizimida hisobingizni faollashtirish uchun havola: ${base}/activate?t=${token} yoki tasdiqlash kodi: ${code}`;
}

export function resetMessage(code: string, centerShort: string = smsCenterShort()): string {
  return `CRM-${centerShort} tizimida parolni tiklash uchun tasdiqlash kodi: ${code}. Kod 10 daqiqa amal qiladi. Uni hech kimga bermang.`;
}

/**
 * SMS ANIQ ketmagan: Eskiz rad etdi (400 — matn shabloni tasdiqlanmagan, «Этот смс текст еще не
 * прошёл модерацию»; 401/403 — kirish) yoki login o'tmadi. Tarmoq xatosi va 5xx bu yerga KIRMAYDI:
 * SMS ketgan bo'lishi mumkin — ikkinchi akkauntdan qayta yuborib, odamga ikki SMS bormasin.
 */
function rejectedBeforeSending(r: SendSmsResult): boolean {
  if (r.ok) return false;
  if (r.status === 400 || r.status === 401 || r.status === 403) return true;
  return typeof r.error === "string" && r.error.startsWith("Eskiz login xato");
}

/** Jurnal uchun qisqa sabab: Eskiz javobidagi `message` (uzun token/kodga o'xshash qatorlar yashiriladi). */
function rejectReason(r: SendSmsResult): string {
  const raw = r.raw as { message?: unknown } | null | undefined;
  const text = typeof raw?.message === "string" ? raw.message : (r.error ?? "");
  return text.replace(/[A-Za-z0-9_-]{16,}/g, "***").slice(0, 120);
}

/**
 * Markaz nomli SMS (taklif, parol tiklash). Avval asosiy akkauntdan markazning o'z nomi bilan;
 * Eskiz uni rad etsa va zaxira akkaunt sozlangan bo'lsa — zaxira akkauntdan, uning tasdiqlangan
 * shablonidagi nom bilan. Shu bilan markazning o'z shabloni tasdiqlangan ZAHOTI SMS o'z matniga
 * o'tadi — hech narsani qayta sozlash shart emas (02.11.2026, Temuriylar: o'z shabloni egasining
 * akkauntida moderatsiyada edi, oraliqda Akademiya akkauntidagi tasdiqlangan shablon ishlatildi).
 */
async function sendCenterSms(phone: string, build: (centerShort: string) => string): Promise<SendSmsResult> {
  const first = await sendSms(phone, build(smsCenterShort()));
  if (!rejectedBeforeSending(first) || !eskizConfigured("fallback")) return first;
  const second = await sendSms(phone, build(smsFallbackCenterShort()), "fallback");
  if (second.ok) {
    console.log(`[sms] asosiy akkaunt rad etdi (${first.status ?? "-"}: ${rejectReason(first)}) — zaxira akkauntdan ketdi`);
    return { ...second, fallback: true };
  }
  console.error(
    `[sms] asosiy va zaxira akkaunt ham rad etdi: ${first.status ?? "-"} ${rejectReason(first)} | ${second.status ?? "-"} ${rejectReason(second)}`,
  );
  return { ...second, error: `asosiy: ${first.error ?? "-"}; zaxira: ${second.error ?? "-"}` };
}

/** Taklif SMS'ini yuborish (asosiy akkaunt → rad etilsa zaxira). */
export function sendActivationSms(phone: string, token: string, code: string): Promise<SendSmsResult> {
  return sendCenterSms(phone, (centerShort) => activationMessage(token, code, centerShort));
}

/** Parol tiklash SMS'ini yuborish (asosiy akkaunt → rad etilsa zaxira). */
export function sendResetSms(phone: string, code: string): Promise<SendSmsResult> {
  return sendCenterSms(phone, (centerShort) => resetMessage(code, centerShort));
}

export { sendSms, normalizePhone };
