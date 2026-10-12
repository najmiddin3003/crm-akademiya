// TIZIMLI24 QOROVULI — sayt o'chsa SMS (Cloudflare Worker, 12.10.2026).
//
// Foydalanuvchi: «Eskiz server o'chganda 33 626 30 06 raqamiga Eskiz SMS shlyuzi
// orqali SMS xabarnoma borsin» (12.10 da Eskiz'da elektr uzilishi — VPS ikki marta
// to'satdan o'chdi). Server o'zi haqida SMS yubora olmaydi — shuning uchun
// qorovul TASHQARIDA: Cloudflare Workers (bepul), cron har daqiqa.
//
// QOIDA:
//   • har daqiqada TARGET_URL (sukut: /api/health/db — ilova + baza) tekshiriladi;
//     javob kelmasa 15 s dan keyin yana bir marta (bir martalik tarmoq shovqini
//     SMS bo'lmasin);
//   • FAILS_TO_ALERT (sukut 2) daqiqa ketma-ket ishlamasa — «ishlamayapti» SMS;
//   • qayta ishlasa — «qayta ishlayapti, uzilish N daqiqa» SMS;
//   • holat KV'da (`STATE`): yozuv faqat o'zgarganda (bepul limit 1000/kun).
//
// SOZLAMALAR (Cloudflare → Worker → Settings → Variables and Secrets):
//   ESKIZ_EMAIL, ESKIZ_PASSWORD — SECRET (CRM'dagi Eskiz hisobi);
//   ALERT_PHONES — vergul bilan, masalan "998336263006";
//   ESKIZ_FROM   — ixtiyoriy (sukut "4546", CRM'dagi bilan bir xil);
//   TARGET_URL   — ixtiyoriy; FAILS_TO_ALERT — ixtiyoriy;
//   TEST_KEY     — ixtiyoriy SECRET: GET /test-sms?key=… sinov SMS yuboradi;
//   TELEGRAM_BOT_TOKEN — SECRET (@tizimli_akademiya_bot, serverda
//                  TELEGRAM_STUDENT_BOT_TOKEN); TELEGRAM_CHAT_IDS — vergul bilan.
// Telegram (12.10.2026, foydalanuvchi: «SMS tasdiqlanguncha ancha vaqt o'tarkan,
// Telegram botga xabar borsin»): moderatsiya yo'q — vaqt va davomiylik bilan.
// Holatni ko'rish: GET /status (sirlar chiqmaydi).

const DEFAULT_URL = "https://www.tizimli24.uz/api/health/db";
const ESKIZ = "https://notify.eskiz.uz/api";
const TIMEOUT_MS = 10_000;
const RETRY_MS = 15_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toshkent vaqti "DD.MM HH:MM". */
export function tashkent(ms) {
  const d = new Date(ms + 5 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

// SMS MATNLARI O'ZGARMAS (12.10.2026): Eskiz faqat moderatsiyadan o'tgan matnni
// yuboradi («Этот смс текст еще не прошёл модерацию…», 400) — kabinetdagi
// my.eskiz.uz → SMS → «Mening matnlarim» bilan HARFMA-HARF bir xil bo'lishi
// shart. Shuning uchun vaqt/davomiylik yo'q (SMS kelgan vaqtning o'zi ko'rsatadi)
// va tutuq belgisi yo'q (ʻ/’/' adashmasin). Vaqtlar logda va KV holatida.
export const DOWN_TEXT = "DIQQAT: tizimli24.uz sayti ishlamayapti, server javob bermayapti. Eskiz VPS tekshirilsin.";
export const UP_TEXT = "tizimli24.uz sayti qayta ishlayapti. Uzilish tugadi.";

export function downText() {
  return DOWN_TEXT;
}

export function upText() {
  return UP_TEXT;
}

/** Telegram xabari — batafsil (moderatsiya yo'q). */
export function tgDownText(sinceMs, status) {
  const why = status ? `HTTP ${status}` : "ulanib bo'lmadi";
  return `🔴 tizimli24.uz ishlamayapti
${tashkent(sinceMs)} dan beri server javob bermayapti (${why}).
Sabab Eskiz VPS bo'lishi mumkin.`;
}

export function tgUpText(sinceMs, nowMs) {
  const min = Math.max(1, Math.round((nowMs - sinceMs) / 60_000));
  return `🟢 tizimli24.uz qayta ishlayapti (${tashkent(nowMs)}).
Uzilish ${min} daqiqa davom etdi.`;
}

/** Telegram — hamma TELEGRAM_CHAT_IDS ga. Qaytaradi: yuborilganlar soni. */
export async function sendTelegram(env, text, fetchFn = fetch) {
  const ids = String(env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^-?\d+$/.test(x));
  if (ids.length === 0 || !env.TELEGRAM_BOT_TOKEN) return 0;
  let sent = 0;
  for (const chatId of ids) {
    try {
      const res = await fetchFn(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) sent++;
      // Manzilda token bor — logga faqat holat va tavsif.
      else console.log(`Telegram yuborilmadi ${chatId}: ${res.status} ${json?.description ?? ""}`);
    } catch (e) {
      console.log(`Telegram yuborilmadi ${chatId}: ${String(e?.name || e)}`);
    }
  }
  return sent;
}

/** Ikkala kanal: SMS (o'zgarmas matn) va Telegram (batafsil). */
async function notify(env, kind, info, fetchFn) {
  const smsText = kind === "down" ? downText() : upText();
  const tgText = kind === "down" ? tgDownText(info.since, info.status) : tgUpText(info.since, info.now);
  const [sms, tg] = await Promise.all([
    sendSms(env, smsText, fetchFn).catch((e) => {
      console.log(`SMS xato: ${String(e?.message || e)}`);
      return 0;
    }),
    sendTelegram(env, tgText, fetchFn),
  ]);
  return { sms, tg };
}

/** Bir marta tekshirish: { ok, status, ms }. `ok` — HTTP 2xx va javobda `ok: true`. */
export async function probe(url, fetchFn = fetch) {
  const t0 = Date.now();
  try {
    const res = await fetchFn(url, {
      headers: { "user-agent": "tizimli24-qorovul/1.0", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok && body?.ok === true, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.name || e), ms: Date.now() - t0 };
  }
}

// ── Eskiz SMS (lib/eskiz.ts bilan bir xil: form-urlencoded, Bearer token) ──

async function eskizLogin(env, fetchFn) {
  const res = await fetchFn(`${ESKIZ}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: env.ESKIZ_EMAIL ?? "", password: env.ESKIZ_PASSWORD ?? "" }),
  });
  const json = await res.json().catch(() => ({}));
  const token = json?.data?.token;
  if (!res.ok || !token) throw new Error(`Eskiz login: ${res.status}`);
  // Token ~30 kun amal qiladi — 20 kun saqlanadi.
  await env.STATE.put("eskiz_token", token, { expirationTtl: 20 * 86_400 });
  return token;
}

/** SMS — hamma ALERT_PHONES ga. Qaytaradi: yuborilganlar soni. */
export async function sendSms(env, message, fetchFn = fetch) {
  const phones = String(env.ALERT_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/\D/g, ""))
    .map((p) => (p.length === 9 ? `998${p}` : p))
    .filter((p) => /^998\d{9}$/.test(p));
  if (phones.length === 0 || !env.ESKIZ_EMAIL || !env.ESKIZ_PASSWORD) return 0;
  let token = (await env.STATE.get("eskiz_token")) || (await eskizLogin(env, fetchFn));
  let sent = 0;
  for (const phone of phones) {
    const send = (t) =>
      fetchFn(`${ESKIZ}/message/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Bearer ${t}` },
        body: new URLSearchParams({ mobile_phone: phone, message, from: env.ESKIZ_FROM || "4546" }),
      });
    let res = await send(token);
    if (res.status === 401) {
      token = await eskizLogin(env, fetchFn);
      res = await send(token);
    }
    if (res.ok) sent++;
    else console.log(`SMS yuborilmadi ${phone}: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return sent;
}

/** Bitta aylanish (cron). `deps` — sinov uchun (fetch, sleep, now). */
export async function runCheck(env, deps = {}) {
  const fetchFn = deps.fetch ?? fetch;
  const wait = deps.sleep ?? sleep;
  const now = deps.now ?? Date.now;
  const url = env.TARGET_URL || DEFAULT_URL;
  const need = Math.max(1, Number(env.FAILS_TO_ALERT) || 2);

  const prev = (await env.STATE.get("state", "json")) || { down: false, fails: 0, firstFailAt: null, since: null };
  let r = await probe(url, fetchFn);
  if (!r.ok) {
    await wait(RETRY_MS);
    r = await probe(url, fetchFn);
  }
  const t = now();

  if (r.ok) {
    if (prev.down) {
      const since = prev.since ?? prev.firstFailAt ?? t;
      const sent = await notify(env, "up", { since, now: t }, fetchFn);
      const downMin = Math.max(1, Math.round((t - since) / 60_000));
      await env.STATE.put("state", JSON.stringify({ down: false, fails: 0, firstFailAt: null, since: null, lastUp: t, lastDownMin: downMin, lastAlert: { kind: "up", at: t, ...sent } }));
      return { event: "up", ...sent, downMin, since: tashkent(since) };
    }
    if (prev.fails > 0) await env.STATE.put("state", JSON.stringify({ ...prev, fails: 0, firstFailAt: null }));
    return { event: "ok", ms: r.ms };
  }

  const fails = (prev.fails || 0) + 1;
  const firstFailAt = prev.firstFailAt ?? t;
  if (!prev.down && fails >= need) {
    const sent = await notify(env, "down", { since: firstFailAt, status: r.status }, fetchFn);
    await env.STATE.put("state", JSON.stringify({ down: true, fails, firstFailAt, since: firstFailAt, lastAlert: { kind: "down", at: t, ...sent } }));
    return { event: "down", ...sent, status: r.status };
  }
  await env.STATE.put("state", JSON.stringify({ ...prev, fails, firstFailAt }));
  return { event: prev.down ? "still-down" : "fail", fails, status: r.status };
}

const worker = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCheck(env).then((r) => console.log(JSON.stringify(r))));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/status") {
      const st = (await env.STATE.get("state", "json")) || { down: false, fails: 0 };
      return Response.json({ target: env.TARGET_URL || DEFAULT_URL, phones: String(env.ALERT_PHONES ?? "").split(",").filter(Boolean).length, ...st });
    }
    if (url.pathname === "/test-sms") {
      if (!env.TEST_KEY || url.searchParams.get("key") !== env.TEST_KEY) return new Response("Forbidden", { status: 403 });
      // Sinov — tasdiqlangan «ishlamayapti» matni bilan (alohida matn moderatsiyadan o'tmagan).
      const sent = await sendSms(env, DOWN_TEXT);
      return Response.json({ sent });
    }
    return new Response("tizimli24 qorovuli", { status: 200 });
  },
};

export default worker;
