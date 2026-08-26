// Telegram guruhlarning chat_id sini topish.
//
// Ishga tushirish:  node scripts/sync-get-chat-id.mjs
//
// Oldindan bajarilishi kerak:
//   1) .env.local ga TELEGRAM_BOT_TOKEN yozilgan bo'lsin
//   2) bot ikkala guruhga qo'shilib, ADMIN qilingan bo'lsin
//   3) har bir guruhga bittadan xabar yozilgan bo'lsin (masalan "salom") —
//      bot faqat shundan keyin guruhni "ko'radi"
//
// Skript hech narsani o'zgartirmaydi, faqat o'qiydi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
if (!token) {
  console.error("❌ .env.local da TELEGRAM_BOT_TOKEN yo'q.");
  console.error("   @BotFather dan token oling va shu faylga qo'shing.");
  process.exit(1);
}

const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
if (!me.ok) {
  console.error(`❌ Token ishlamadi: ${me.description || "noma'lum xato"}`);
  process.exit(1);
}
console.log(`✅ Bot: @${me.result.username}\n`);

const updates = await (await fetch(`https://api.telegram.org/bot${token}/getUpdates`)).json();
if (!updates.ok) {
  console.error(`❌ getUpdates xatosi: ${updates.description}`);
  process.exit(1);
}

// Bir guruh bir necha xabar yuborgan bo'lishi mumkin — takrorlamaymiz.
const chats = new Map();
for (const u of updates.result) {
  const msg = u.message || u.channel_post || u.my_chat_member;
  const chat = msg?.chat;
  if (chat && chat.type !== "private") chats.set(chat.id, chat);
}

if (chats.size === 0) {
  console.log("Hech qanday guruh topilmadi. Tekshiring:");
  console.log("  • bot guruhga qo'shilganmi va admin qilinganmi?");
  console.log("  • guruhga xabar yozilganmi? (bot faqat shundan keyin ko'radi)");
  console.log("  • bot allaqachon webhook'ga ulanmaganmi? (getUpdates bo'sh qaytadi)");
  process.exit(0);
}

console.log("Topilgan guruhlar:\n");
for (const chat of chats.values()) {
  console.log(`  ${chat.title}`);
  console.log(`    chat_id: ${chat.id}`);
  console.log(`    turi:    ${chat.type}\n`);
}

console.log("Endi .env.local ga qo'ying (qaysi guruh qaysi oqim ekaniga qarab):");
console.log("  TELEGRAM_CHAT_PAYMENTS=<to'lovlar guruhi id>");
console.log("  TELEGRAM_CHAT_SALARIES=<oyliklar guruhi id>");
