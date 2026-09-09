// Telegram webhook'ini ro'yxatdan o'tkazadi — lid xabari tagidagi status
// tugmalari SHUSIZ ishlamaydi (bosilganda hech narsa bo'lmaydi).
//
// Bir marta ishga tushiriladi:
//   node scripts/set-telegram-webhook.mjs            — o'rnatadi va holatni ko'rsatadi
//   node scripts/set-telegram-webhook.mjs --info     — faqat holatni ko'rsatadi
//   node scripts/set-telegram-webhook.mjs --delete   — webhook'ni olib tashlaydi
//
// KERAKLI SOZLAMALAR (.env.local va Vercel > Environment Variables):
//   TELEGRAM_BOT_TOKEN       — bot kaliti (allaqachon bor)
//   APP_BASE_URL             — saytning TASHQI manzili, masalan https://tizimli24.uz
//   TELEGRAM_WEBHOOK_SECRET  — o'zingiz o'ylab topadigan uzun satr; Telegram uni
//                              har bir so'rovda sarlavhada qaytaradi va route
//                              aynan shuni tekshiradi (app/api/telegram/webhook).
//
// DIQQAT: manzil HTTPS bo'lishi shart va tashqaridan ochilishi kerak —
// `localhost` ga webhook o'rnatib bo'lmaydi. Lokal sinov uchun tunnel
// (ngrok va h.k.) kerak bo'ladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(HERE, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
  }
}

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const base = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();

const call = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};

const show = async () => {
  const info = await call("getWebhookInfo");
  if (!info.ok) return console.log("getWebhookInfo:", JSON.stringify(info));
  const r = info.result;
  console.log("  manzil:              ", r.url || "(o'rnatilmagan)");
  console.log("  maxfiy sarlavha:     ", r.has_custom_certificate ? "-" : (r.url ? "ha (Telegram ko'rsatmaydi)" : "-"));
  console.log("  navbatdagi yangilik: ", r.pending_update_count ?? 0);
  if (r.last_error_message) {
    console.log("  OXIRGI XATO:         ", r.last_error_message);
  }
  if (Array.isArray(r.allowed_updates)) {
    console.log("  qabul qilinadi:      ", r.allowed_updates.join(", "));
  }
};

if (!token) {
  console.log("TELEGRAM_BOT_TOKEN yo'q — .env.local ni tekshiring");
  process.exit(1);
}

const arg = process.argv[2] || "";

if (arg === "--info") {
  console.log("Webhook holati:");
  await show();
  process.exit(0);
}

if (arg === "--delete") {
  const res = await call("deleteWebhook", { drop_pending_updates: false });
  console.log(res.ok ? "Webhook olib tashlandi." : `Xato: ${JSON.stringify(res)}`);
  process.exit(res.ok ? 0 : 1);
}

const missing = [];
if (!base) missing.push("APP_BASE_URL");
if (!secret) missing.push("TELEGRAM_WEBHOOK_SECRET");
if (missing.length > 0) {
  console.log(`Sozlanmagan: ${missing.join(", ")}`);
  console.log("TELEGRAM_WEBHOOK_SECRET uchun tasodifiy satr yarating, masalan:");
  console.log("  node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"");
  process.exit(1);
}
if (!base.startsWith("https://")) {
  console.log(`APP_BASE_URL HTTPS bo'lishi kerak (hozir: ${base}) — Telegram boshqasini qabul qilmaydi`);
  process.exit(1);
}

const url = `${base}/api/telegram/webhook`;
// Faqat tugma bosilishlari kerak — guruhdagi HAR BIR xabar serverga
// yuborilsa, bu bekorga trafik va bekorga funksiya chaqiruvi bo'lardi.
const res = await call("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["callback_query"],
  max_connections: 10,
});

if (!res.ok) {
  console.log(`setWebhook xatosi: ${res.description || JSON.stringify(res)}`);
  process.exit(1);
}

console.log(`Webhook o'rnatildi: ${url}`);
console.log("Holat:");
await show();
