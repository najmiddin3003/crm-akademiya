// FAQAT O'QIYDI — "bot guruhni ko'rmayapti" holatining sababini aniqlaydi.
//
// getUpdates bo'sh qaytishining bir necha sababi bor va ular tashqaridan
// bir xil ko'rinadi. Shu skript ularni ajratadi:
//   • webhook o'rnatilgan bo'lsa getUpdates HAR DOIM bo'sh qaytaradi;
//   • bot hali guruhga qo'shilmagan bo'lsa hech qanday yangilanish yo'q;
//   • qo'shilgan, lekin qo'shilgandan KEYIN xabar yozilmagan bo'lsa ham
//     bo'sh (bot o'zidan oldingi xabarlarni ko'rmaydi);
//   • yangilanishlar allaqachon "o'qilgan" bo'lsa (offset surilgan) ham
//     bo'sh — masalan bu skript ilgari ishga tushirilgan bo'lsa.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN yo'q");
  process.exit(1);
}
const api = async (method, params) => {
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
  return (await fetch(url)).json();
};

const me = await api("getMe");
console.log(me.ok ? `✅ Bot: @${me.result.username} (id ${me.result.id})` : `❌ getMe: ${me.description}`);
if (!me.ok) process.exit(1);

const hook = await api("getWebhookInfo");
if (hook.ok) {
  const url = hook.result.url || "";
  if (url) {
    console.log(`\n❌ WEBHOOK O'RNATILGAN: ${url}`);
    console.log("   Shu sababli getUpdates HAR DOIM bo'sh qaytadi.");
    console.log("   Yechim: deleteWebhook chaqiring yoki chat_id ni qo'lda toping.");
  } else {
    console.log("✅ Webhook yo'q — getUpdates ishlashi kerak");
  }
  if (hook.result.pending_update_count) {
    console.log(`   Navbatda ${hook.result.pending_update_count} ta yangilanish bor`);
  }
}

// `offset` bermaymiz — surilgan bo'lsa ham Telegram saqlagan hamma
// narsani ko'rsatishga urinamiz. `allowed_updates` bo'sh ro'yxat =
// hamma turdagi yangilanish.
const up = await api("getUpdates", { limit: 100, timeout: 0, allowed_updates: JSON.stringify([]) });
if (!up.ok) {
  console.log(`\n❌ getUpdates: ${up.description}`);
  process.exit(1);
}
console.log(`\nYangilanishlar soni: ${up.result.length}`);

if (up.result.length === 0) {
  console.log("\nBo'sh. Ehtimoliy sabablar, ehtimolligi bo'yicha:");
  console.log("  1. Bot hali guruhga QO'SHILMAGAN.");
  console.log("  2. Qo'shilgan, lekin qo'shilgandan KEYIN hech kim xabar yozmagan.");
  console.log("     (bot o'zi guruhga kirgunga qadar bo'lgan xabarlarni ko'rmaydi)");
  console.log("  3. Topicli guruhda — xabar TOPIC ichiga yozilishi kerak, umumiy oqimga emas.");
  console.log("  4. Bot admin emas va Privacy Mode yoqilgan (BotFather > /setprivacy > Disable).");
  process.exit(0);
}

for (const u of up.result) {
  const keys = Object.keys(u).filter((k) => k !== "update_id");
  const msg = u.message || u.channel_post || u.my_chat_member || u.edited_message;
  const chat = msg?.chat;
  console.log(`\n  update_id=${u.update_id} turi: ${keys.join(", ")}`);
  if (chat) {
    console.log(`    chat: "${chat.title || chat.username || chat.first_name}" id=${chat.id} type=${chat.type}${chat.is_forum ? " FORUM" : ""}`);
    if (msg.message_thread_id) console.log(`    topic: ${msg.message_thread_id}`);
    const name = msg.forum_topic_created?.name || msg.reply_to_message?.forum_topic_created?.name;
    if (name) console.log(`    topic nomi: ${name}`);
    if (msg.text) console.log(`    matn: ${String(msg.text).slice(0, 60)}`);
    if (u.my_chat_member) console.log(`    a'zolik: ${u.my_chat_member.old_chat_member?.status} -> ${u.my_chat_member.new_chat_member?.status}`);
  }
}
