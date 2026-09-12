// FAQAT O'QIYDI (hech narsa yubormaydi). Telegram guruhidagi topiklarning
// raqamlarini ko'rsatadi — `TELEGRAM_TOPIC_*` o'zgaruvchilari uchun.
//
//   node scripts/_telegram-topics.mjs
//
// QANDAY ISHLAYDI: Bot API da "topiklar ro'yxati" degan metod YO'Q. Lekin
// topik ochilganda guruhga `forum_topic_created` xizmat xabari tushadi va
// o'sha xabarning `message_id` si — aynan topikning raqami. `getUpdates`
// oxirgi ~24 soatlik yangilanishlarni beradi, ya'ni yaqinda ochilgan topik
// shu yerda ko'rinadi. Ko'rinmasa: o'sha topikka bitta xabar yozing va
// skriptni qaytadan yurgizing.
//
// DIQQAT: `getUpdates` webhook o'rnatilgan bo'lsa ishlamaydi (409) —
// skript buni tekshirib, aytadi.
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "");
const token = get("TELEGRAM_BOT_TOKEN");
if (!token) { console.error("TELEGRAM_BOT_TOKEN topilmadi (.env.local)"); process.exit(1); }

const api = async (method, qs = "") => (await fetch(`https://api.telegram.org/bot${token}/${method}${qs}`)).json();

const me = await api("getMe");
console.log("Bot:", me.ok ? "@" + me.result.username : JSON.stringify(me));

const wh = await api("getWebhookInfo");
if (wh.ok && wh.result.url) {
  console.error(`\nWebhook o'rnatilgan (${wh.result.url}) — getUpdates ishlamaydi.`);
  console.error("Topik raqamini qo'lda oling: topikdagi xabarga o'ng tugma > Copy Link ->");
  console.error("  https://t.me/c/<guruh>/<TOPIK>/<xabar>  — o'rtadagi son kerak.");
  process.exit(1);
}

const up = await api("getUpdates", "?limit=100");
if (!up.ok) { console.error("getUpdates:", JSON.stringify(up)); process.exit(1); }

console.log(`Yangilanishlar: ${up.result.length} ta\n`);

const topics = new Map();
for (const u of up.result) {
  const m = u.message || u.channel_post || u.edited_message;
  if (!m) continue;
  if (m.forum_topic_created) topics.set(m.message_id, { name: m.forum_topic_created.name, chat: m.chat.id });
  else if (m.message_thread_id && !topics.has(m.message_thread_id)) {
    topics.set(m.message_thread_id, { name: "(nomi noma'lum — xabardan topildi)", chat: m.chat.id });
  }
}

if (topics.size === 0) {
  console.log("Topik topilmadi. O'sha topikka bitta xabar yozib, qaytadan yurgizing.");
} else {
  console.log("TOPIKLAR:");
  for (const [id, t] of [...topics].sort((a, b) => a[0] - b[0])) {
    console.log(`  id=${String(id).padStart(4)}   chat=${t.chat}   "${t.name}"`);
  }
}

console.log("\nHozirgi sozlama:");
for (const k of ["TELEGRAM_CHAT_PAYMENTS", "TELEGRAM_TOPIC_PAYMENTS", "TELEGRAM_CHAT_SALARIES", "TELEGRAM_TOPIC_SALARIES", "TELEGRAM_CHAT_LEADS", "TELEGRAM_TOPIC_LEADS"]) {
  console.log(`  ${k.padEnd(24)} ${get(k) || "(bo'sh)"}`);
}
console.log("\nFilial lidlari topiklari bazada (branches.leadTopicId): node scripts/telegram-lead-topics.mjs");
