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
// Forum-guruhda har bir TOPIC ham alohida yig'iladi: bitta guruhni ikki
// oqimga bo'lish uchun chat_id emas, topic raqami kerak bo'ladi.
const chats = new Map();
/** chat_id -> Map(thread_id -> topic nomi) */
const topics = new Map();

for (const u of updates.result) {
  const msg = u.message || u.channel_post || u.my_chat_member;
  const chat = msg?.chat;
  if (!chat || chat.type === "private") continue;
  chats.set(chat.id, chat);

  const threadId = msg.message_thread_id;
  if (!threadId) continue; // umumiy ("General") oqim — raqami yo'q
  if (!topics.has(chat.id)) topics.set(chat.id, new Map());
  // Topic nomi ikki joyda uchraydi: topic ochilgan paytdagi xizmat
  // xabarida va o'sha topicdagi xabarning `reply_to_message` ida.
  const name =
    msg.forum_topic_created?.name ||
    msg.reply_to_message?.forum_topic_created?.name ||
    "";
  const known = topics.get(chat.id).get(threadId);
  if (!known) topics.get(chat.id).set(threadId, name);
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
  console.log(`    turi:    ${chat.type}${chat.is_forum ? " (Topics yoqilgan)" : ""}`);
  const t = topics.get(chat.id);
  if (t && t.size > 0) {
    console.log("    topiclar:");
    for (const [id, name] of t) console.log(`      ${String(id).padStart(6)}  ${name || "(nomi ko'rinmadi)"}`);
  } else if (chat.is_forum) {
    console.log("    topiclar: topilmadi — HAR BIR topicga bittadan xabar yozing");
  }
  console.log("");
}

console.log("Endi .env.local ga qo'ying.\n");
console.log("Bitta guruh + ikkita topic bo'lsa (chat_id ikkalasida BIR XIL):");
console.log("  TELEGRAM_CHAT_PAYMENTS=<guruh id>");
console.log("  TELEGRAM_TOPIC_PAYMENTS=<to'lovlar topic raqami>");
console.log("  TELEGRAM_CHAT_SALARIES=<xuddi o'sha guruh id>");
console.log("  TELEGRAM_TOPIC_SALARIES=<oyliklar topic raqami>\n");
console.log("Ikkita alohida guruh bo'lsa — TOPIC qatorlarini bo'sh qoldiring.");
