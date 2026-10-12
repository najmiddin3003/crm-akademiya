// TIZIMLI24 QOROVULI — sayt o'chsa Telegram xabari (Cloudflare Worker, 12.10.2026).
//
// 12.10 da Eskiz'da elektr uzilishi — VPS ikki marta to'satdan o'chdi. Server o'zi
// haqida xabar yubora olmaydi — shuning uchun qorovul TASHQARIDA: Cloudflare
// Workers (bepul), cron har daqiqa. Xabar @tizimli_akademiya_bot orqali
// TELEGRAM_CHAT_IDS ga boradi.
//
// Eskiz SMS ham bor edi — 12.10 da OLIB TASHLANDI (foydalanuvchi: «Eskiz SMS ni
// qilmaymiz»): har bir matn Eskiz moderatsiyasidan o'tishi kerak edi.
//
// QOIDA:
//   • har daqiqada TARGET_URL (sukut: /api/health/db — ilova + baza) tekshiriladi;
//     javob kelmasa 15 s dan keyin yana bir marta (bir martalik tarmoq shovqini
//     xabar bo'lmasin);
//   • FAILS_TO_ALERT (sukut 2) daqiqa ketma-ket ishlamasa — 🔴 «ishlamayapti»;
//     Telegram uni qabul qilmasa — keyingi daqiqalarda qayta (yagona kanal);
//   • qayta ishlasa — 🟢 «qayta ishlayapti, uzilish N daqiqa»;
//   • holat KV'da (`STATE`): yozuv faqat o'zgarganda (bepul limit 1000/kun).
//
// SOZLAMALAR (wrangler.toml):
//   TELEGRAM_BOT_TOKEN — SECRET (@tizimli_akademiya_bot, serverda
//                        TELEGRAM_STUDENT_BOT_TOKEN);
//   TELEGRAM_CHAT_IDS  — vergul bilan; har biri botda Start bosgan bo'lishi
//                        shart (aks holda Telegram 403);
//   TARGET_URL, FAILS_TO_ALERT — ixtiyoriy.

const DEFAULT_URL = "https://www.tizimli24.uz/api/health/db";
const TIMEOUT_MS = 10_000;
const RETRY_MS = 15_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toshkent vaqti "DD.MM HH:MM". */
export function tashkent(ms) {
  const d = new Date(ms + 5 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}.${d.slice(5, 7)} ${d.slice(11, 16)}`;
}

export function downText(sinceMs, status) {
  const why = status ? `HTTP ${status}` : "ulanib bo'lmadi";
  return `🔴 tizimli24.uz ishlamayapti
${tashkent(sinceMs)} dan beri server javob bermayapti (${why}).
Sabab Eskiz VPS bo'lishi mumkin.`;
}

export function upText(sinceMs, nowMs) {
  const min = Math.max(1, Math.round((nowMs - sinceMs) / 60_000));
  return `🟢 tizimli24.uz qayta ishlayapti (${tashkent(nowMs)}).
Uzilish ${min} daqiqa davom etdi.`;
}

/**
 * Hamma TELEGRAM_CHAT_IDS ga. Qaytaradi: { sent — yetib borganlar soni, error — oxirgi
 * xato (KV holatiga yoziladi: `kv key get state` bilan sababni ko'rish uchun) }.
 */
export async function sendTelegram(env, text, fetchFn = fetch) {
  const ids = String(env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^-?\d+$/.test(x));
  if (ids.length === 0) return { sent: 0, error: "TELEGRAM_CHAT_IDS bo'sh" };
  const token = String(env.TELEGRAM_BOT_TOKEN ?? "");
  if (!token) return { sent: 0, error: "TELEGRAM_BOT_TOKEN yo'q" };
  let sent = 0;
  let error = null;
  for (const chatId of ids) {
    let why = null;
    try {
      const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) sent++;
      // Manzilda token bor — faqat holat va Telegram tavsifi.
      else why = `${res.status} ${json?.description ?? ""}`.trim();
    } catch (e) {
      why = String(e?.message || e).replaceAll(token, "***");
    }
    if (why) {
      error = `${chatId}: ${why}`;
      console.log(`Telegram yuborilmadi ${error}`);
    }
  }
  return { sent, error };
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
      const { sent, error } = await sendTelegram(env, upText(since, t), fetchFn);
      const downMin = Math.max(1, Math.round((t - since) / 60_000));
      await env.STATE.put("state", JSON.stringify({ down: false, fails: 0, firstFailAt: null, since: null, lastUp: t, lastDownMin: downMin, lastAlert: { kind: "up", at: t, sent, error } }));
      return { event: "up", sent, error, downMin, since: tashkent(since) };
    }
    if (prev.fails > 0) await env.STATE.put("state", JSON.stringify({ ...prev, fails: 0, firstFailAt: null }));
    return { event: "ok", ms: r.ms };
  }

  const fails = (prev.fails || 0) + 1;
  const firstFailAt = prev.firstFailAt ?? t;
  // `pending` — 🔴 hali yetib bormagan (Telegram javob bermadi): har daqiqa qayta.
  if ((!prev.down && fails >= need) || (prev.down && prev.pending)) {
    const since = prev.since ?? firstFailAt;
    const { sent, error } = await sendTelegram(env, downText(since, r.status), fetchFn);
    await env.STATE.put("state", JSON.stringify({ down: true, fails, firstFailAt, since, pending: sent === 0, lastAlert: { kind: "down", at: t, sent, error } }));
    return { event: prev.down ? "down-retry" : "down", sent, error, status: r.status };
  }
  await env.STATE.put("state", JSON.stringify({ ...prev, fails, firstFailAt }));
  return { event: prev.down ? "still-down" : "fail", fails, status: r.status };
}

const worker = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runCheck(env).then((r) => console.log(JSON.stringify(r))));
  },
  async fetch(req, env) {
    // workers_dev = false — ochiq manzil yo'q; bu faqat kelajakda marshrut ulansa.
    const url = new URL(req.url);
    if (url.pathname === "/status") {
      const st = (await env.STATE.get("state", "json")) || { down: false, fails: 0 };
      const chats = String(env.TELEGRAM_CHAT_IDS ?? "").split(",").filter((x) => x.trim()).length;
      return Response.json({ target: env.TARGET_URL || DEFAULT_URL, chats, ...st });
    }
    return new Response("tizimli24 qorovuli", { status: 200 });
  },
};

export default worker;
