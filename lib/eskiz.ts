// Eskiz.uz SMS shlyuzi bilan ishlash.
// Hujjat: https://documenter.getpostman.com/view/663428/RzfmES4z
// 1) POST /api/auth/login (email, password) -> Bearer token (token ~30 kun amal qiladi)
// 2) POST /api/message/sms/send (mobile_phone, message, from)
//
// Token xotirada keshlanadi; 401 kelsa qayta login qilamiz.

const BASE = "https://notify.eskiz.uz/api";

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL = 25 * 24 * 60 * 60 * 1000; // ~25 kun

function creds() {
  const email = process.env.ESKIZ_EMAIL;
  const password = process.env.ESKIZ_PASSWORD;
  return { email, password };
}

export function eskizConfigured(): boolean {
  const { email, password } = creds();
  return Boolean(email && password);
}

async function login(): Promise<string> {
  const { email, password } = creds();
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
  cachedToken = token;
  cachedAt = Date.now();
  return token;
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL) return cachedToken;
  return login();
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
}

// SMS yuborish. Credential yo'q bo'lsa dev rejimida real yubormay, matnni
// konsolga chiqaramiz (simulated=true) — oqim baribir ishlaydi.
export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const to = normalizePhone(phone);

  if (!eskizConfigured()) {
    console.warn(`\n[eskiz:SIMULATED] -> +${to}\n${message}\n`);
    return { ok: true, simulated: true };
  }

  const from = process.env.ESKIZ_FROM || "4546";
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
    let token = await getToken();
    let res = await send(token);
    if (res.status === 401) {
      // Token eskirgan — qayta login qilib bir marta urinib ko'ramiz.
      cachedToken = null;
      token = await login();
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
