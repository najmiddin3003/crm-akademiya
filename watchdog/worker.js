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
//   TEST_KEY     — ixtiyoriy SECRET: GET /test-sms?key=… sinov SMS yuboradi.
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

export function downText(sinceMs) {
  return `DIQQAT: tizimli24.uz ishlamayapti - ${tashkent(sinceMs)} dan beri server javob bermayapti. Sabab Eskiz VPS bo'lishi mumkin.`;
}

export function upText(sinceMs, nowMs) {
  const min = Math.max(1, Math.round((nowMs - sinceMs) / 60_000));
  return `tizimli24.uz qayta ishlayapti (${tashkent(nowMs)}). Uzilish ${min} daqiqa davom etdi.`;
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
      const sent = await sendSms(env, upText(prev.since ?? prev.firstFailAt ?? t, t), fetchFn);
      await env.STATE.put("state", JSON.stringify({ down: false, fails: 0, firstFailAt: null, since: null, lastUp: t, lastSms: { kind: "up", at: t, sent } }));
      return { event: "up", sent };
    }
    if (prev.fails > 0) await env.STATE.put("state", JSON.stringify({ ...prev, fails: 0, firstFailAt: null }));
    return { event: "ok", ms: r.ms };
  }

  const fails = (prev.fails || 0) + 1;
  const firstFailAt = prev.firstFailAt ?? t;
  if (!prev.down && fails >= need) {
    const sent = await sendSms(env, downText(firstFailAt), fetchFn);
    await env.STATE.put("state", JSON.stringify({ down: true, fails, firstFailAt, since: firstFailAt, lastSms: { kind: "down", at: t, sent } }));
    return { event: "down", sent, status: r.status };
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
      const sent = await sendSms(env, `tizimli24.uz qorovuli: sinov SMS (${tashkent(Date.now())}). Sayt o'chsa shu raqamga xabar keladi.`);
      return Response.json({ sent });
    }
    return new Response("tizimli24 qorovuli", { status: 200 });
  },
};

export default worker;
