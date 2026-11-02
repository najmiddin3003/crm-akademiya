// Eskiz.uz SMS shlyuzi bilan ishlash.
// Hujjat: https://documenter.getpostman.com/view/663428/RzfmES4z
// 1) POST /api/auth/login (email, password) -> Bearer token (token ~30 kun amal qiladi)
// 2) POST /api/message/sms/send (mobile_phone, message, from)
//
// Token xotirada keshlanadi; 401 kelsa qayta login qilamiz.
//
// Ikki akkaunt (02.11.2026): asosiy — ESKIZ_EMAIL / ESKIZ_PASSWORD / ESKIZ_FROM; ixtiyoriy
// zaxira — ESKIZ_FALLBACK_EMAIL / ESKIZ_FALLBACK_PASSWORD / ESKIZ_FALLBACK_FROM. Zaxiraga faqat
// markaz nomli SMS'lar o'tadi (lib/invite.ts → sendCenterSms), asosiy akkaunt rad etganda.
//
// SINOV SAYTI QOROVULI (02.11.2026): Vercel'da (`VERCEL=1`) SMS KETMAYDI — kalitlar turgan
// bo'lsa ham sendSms taqlid qiladi (`simulated`). Qaytarish: SMS_SEND=on. Qoida lib/outboundGuard.ts.

import { outboundMuted } from "@/lib/outboundGuard";

const BASE = "https://notify.eskiz.uz/api";

/** Qaysi Eskiz akkaunti. */
export type EskizAccount = "main" | "fallback";

const TOKEN_TTL = 25 * 24 * 60 * 60 * 1000; // ~25 kun
// Har akkauntning tokeni alohida: biriniki ikkinchisiga yaramaydi.
const tokens: Record<EskizAccount, { token: string | null; at: number }> = {
  main: { token: null, at: 0 },
  fallback: { token: null, at: 0 },
};

function creds(account: EskizAccount) {
  if (account === "fallback") {
    return {
      email: process.env.ESKIZ_FALLBACK_EMAIL,
      password: process.env.ESKIZ_FALLBACK_PASSWORD,
      from: process.env.ESKIZ_FALLBACK_FROM,
    };
  }
  return { email: process.env.ESKIZ_EMAIL, password: process.env.ESKIZ_PASSWORD, from: process.env.ESKIZ_FROM };
}

export function eskizConfigured(account: EskizAccount = "main"): boolean {
  const { email, password } = creds(account);
  return Boolean(email && password);
}

async function login(account: EskizAccount): Promise<string> {
  const { email, password } = creds(account);
  if (!email || !password) throw new Error("ESKIZ_EMAIL / ESKIZ_PASSWORD o'rnatilmagan");

  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.token;
  if (!res.ok || !token) {
    throw new Error(`Eskiz login xato: ${res.status} ${JSON.stringify(json)}`);
  }
  tokens[account] = { token, at: Date.now() };
  return token;
}

async function getToken(account: EskizAccount): Promise<string> {
  const c = tokens[account];
  if (c.token && Date.now() - c.at < TOKEN_TTL) return c.token;
  return login(account);
}

// O'zbek raqamini Eskiz kutgan formatga keltiramiz: 998901234567 (12 xona).
export function normalizePhone(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length === 9) return "998" + d; // 901234567
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 13 && d.startsWith("998")) return d.slice(0, 12);
  return d;
}

export interface SendSmsResult {
  ok: boolean;
  simulated?: boolean;
  status?: number;
  raw?: unknown;
  error?: string;
  /** Asosiy akkaunt rad etib, SMS zaxira akkauntdan ketgan (lib/invite.ts sendCenterSms). */
  fallback?: boolean;
}

// SMS yuborish. Credential yo'q bo'lsa dev rejimida real yubormay, matnni
// konsolga chiqaramiz (simulated=true) — oqim baribir ishlaydi.
// `account` — qaysi akkauntdan (sukut: asosiy); zaxira faqat sendCenterSms'dan chaqiriladi.
export async function sendSms(phone: string, message: string, account: EskizAccount = "main"): Promise<SendSmsResult> {
  const to = normalizePhone(phone);

  // Sinov sayti: haqiqiy telefonlar Atlas nusxasida turibdi — tarmoqqa (login ham) chiqilmaydi.
  // Zaxira akkaunt ham shu yerdan o'tadi, shuning uchun u ham jim (sendCenterSms birinchi
  // javobni `ok` deb oladi va zaxiraga o'tmaydi).
  if (outboundMuted("sms")) {
    console.warn(`\n[eskiz:SINOV] -> +${to} (SMS_SEND o'chiq, yuborilmadi)\n${message}\n`);
    return { ok: true, simulated: true };
  }

  if (!eskizConfigured(account)) {
    if (account === "fallback") return { ok: false, error: "Zaxira Eskiz akkaunti sozlanmagan" };
    console.warn(`\n[eskiz:SIMULATED] -> +${to}\n${message}\n`);
    return { ok: true, simulated: true };
  }

  const from = creds(account).from || "4546";
  const send = async (token: string) => {
    const body = new URLSearchParams({ mobile_phone: to, message, from });
    return fetch(`${BASE}/message/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body,
    });
  };

  try {
    let token = await getToken(account);
    let res = await send(token);
    if (res.status === 401) {
      // Token eskirgan — qayta login qilib bir marta urinib ko'ramiz.
      tokens[account].token = null;
      token = await login(account);
      res = await send(token);
    }
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, raw, error: `Eskiz xato: ${res.status}` };
    }
    return { ok: true, status: res.status, raw };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
