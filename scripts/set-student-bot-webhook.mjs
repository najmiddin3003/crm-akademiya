// O'QUVCHILAR botining webhook'ini ro'yxatdan o'tkazadi. Shusiz bot
// umuman javob bermaydi — /start bosilganda hech narsa bo'lmaydi.
//
// Bir marta ishga tushiriladi:
//   node scripts/set-student-bot-webhook.mjs            — o'rnatadi va holatni ko'rsatadi
//   node scripts/set-student-bot-webhook.mjs --info     — faqat holatni ko'rsatadi
//   node scripts/set-student-bot-webhook.mjs --delete   — webhook'ni olib tashlaydi
//   node scripts/set-student-bot-webhook.mjs --commands — menyudagi buyruqlar ro'yxatini yozadi
//
// KERAKLI SOZLAMALAR (.env.local va Vercel > Environment Variables):
//   TELEGRAM_STUDENT_BOT_TOKEN       — @BotFather dan olingan YANGI bot kaliti
//   APP_BASE_URL                     — saytning TASHQI manzili, https://...
//   TELEGRAM_STUDENT_WEBHOOK_SECRET  — uzun tasodifiy satr; Telegram uni har
//                                      so'rovda sarlavhada qaytaradi va route
//                                      aynan shuni tekshiradi
//                                      (app/api/telegram/student).
//
// 29.09.2026 dan bu bot (@tizimli_akademiya_bot) XODIMLAR boti ham —
// o'quvchi va xodim bitta webhook'da, lib/botDispatch.ts ajratadi.
// GURUH boti (@akademiya_crm_bot) alohida skript bilan sozlanadi
// (scripts/set-telegram-webhook.mjs). Ikkalasini adashtirmang: bu yerdagi
// token bilan guruh botining webhook'ini yozib yuborsangiz, guruhdagi lid
// tugmalari ishlamay qoladi.
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

const token = (process.env.TELEGRAM_STUDENT_BOT_TOKEN || "").trim();
const base = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
const secret = (process.env.TELEGRAM_STUDENT_WEBHOOK_SECRET || "").trim();

const call = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};

const show = async () => {
  const me = await call("getMe");
  console.log("  bot:                 ", me.ok ? `@${me.result.username}` : `XATO — ${me.description}`);
  const info = await call("getWebhookInfo");
  if (!info.ok) return console.log("getWebhookInfo:", JSON.stringify(info));
  const r = info.result;
  console.log("  manzil:              ", r.url || "(o'rnatilmagan)");
  console.log("  navbatdagi yangilik: ", r.pending_update_count ?? 0);
  if (r.last_error_message) {
    console.log("  OXIRGI XATO:         ", r.last_error_message);
  }
  if (Array.isArray(r.allowed_updates)) {
    console.log("  qabul qilinadi:      ", r.allowed_updates.join(", "));
  }
};

if (!token) {
  console.log("TELEGRAM_STUDENT_BOT_TOKEN yo'q — .env.local ni tekshiring.");
  console.log("Yangi bot yaratish: Telegramda @BotFather -> /newbot");
  process.exit(1);
}

const arg = process.argv[2] || "";

if (arg === "--info") {
  console.log("O'quvchilar boti — holat:");
  await show();
  process.exit(0);
}

if (arg === "--delete") {
  const res = await call("deleteWebhook", { drop_pending_updates: false });
  console.log(res.ok ? "Webhook olib tashlandi." : `Xato: ${JSON.stringify(res)}`);
  process.exit(res.ok ? 0 : 1);
}

// Telegram menyusidagi buyruqlar ro'yxati ("/" bosilganda chiqadi).
// Bot bitta buyruq bilan ishlaydi — qolgani tugmalar orqali. 29.09.2026 dan
// xodimlar ham shu botda (lib/botDispatch.ts): /xodim — xodimlar bo'limi
// (raqamini o'quvchi sifatida bog'lagan xodim ham shu bilan o'tadi).
if (arg === "--commands") {
  const res = await call("setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash / asosiy menyu" },
      { command: "menu", description: "Asosiy menyu" },
      { command: "xodim", description: "Xodimlar bo'limi (profil, Ishga keldim, kassa)" },
    ],
  });
  console.log(res.ok ? "Buyruqlar ro'yxati yozildi." : `Xato: ${JSON.stringify(res)}`);
  process.exit(res.ok ? 0 : 1);
}

const missing = [];
if (!base) missing.push("APP_BASE_URL");
if (!secret) missing.push("TELEGRAM_STUDENT_WEBHOOK_SECRET");
if (missing.length > 0) {
  console.log(`Sozlanmagan: ${missing.join(", ")}`);
  console.log("TELEGRAM_STUDENT_WEBHOOK_SECRET uchun tasodifiy satr yarating, masalan:");
  console.log("  node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"");
  process.exit(1);
}
if (!base.startsWith("https://")) {
  console.log(`APP_BASE_URL HTTPS bo'lishi kerak (hozir: ${base}) — Telegram boshqasini qabul qilmaydi`);
  process.exit(1);
}

const url = `${base}/api/telegram/student`;
// `message` KERAK — o'quvchi telefon raqamini (kontakt) shu orqali
// yuboradi. Xodimlar botida esa faqat `callback_query` bor va shunday
// qolishi kerak.
const res = await call("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  max_connections: 20,
});

if (!res.ok) {
  console.log(`setWebhook xatosi: ${res.description || JSON.stringify(res)}`);
  process.exit(1);
}

console.log(`Webhook o'rnatildi: ${url}`);
console.log("Holat:");
await show();
console.log("");
console.log("Keyingi qadam: node scripts/set-student-bot-webhook.mjs --commands");
