// FAQAT O'QIYDI — Telegram sozlamasini GURUHGA XABAR YUBORMASDAN tekshiradi.
// `getMe` (bot tirikmi) va `getChat` (guruh topiladimi, bot a'zomi).
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
if (!token) { console.log("TELEGRAM_BOT_TOKEN yo'q"); process.exit(0); }

const call = async (m, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${m}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return r.json();
};

const me = await call("getMe");
console.log("bot:", me.ok ? `@${me.result.username} (${me.result.first_name})` : JSON.stringify(me));

for (const [label, chatKey, topicKey] of [
  ["To'lovlar", "TELEGRAM_CHAT_PAYMENTS", "TELEGRAM_TOPIC_PAYMENTS"],
  ["Oyliklar", "TELEGRAM_CHAT_SALARIES", "TELEGRAM_TOPIC_SALARIES"],
]) {
  const chatId = (process.env[chatKey] || "").trim();
  const topic = (process.env[topicKey] || "").trim();
  if (!chatId) { console.log(`${label}: ${chatKey} yo'q`); continue; }
  const chat = await call("getChat", { chat_id: chatId });
  if (!chat.ok) { console.log(`${label}: ${chatId} -> XATO ${JSON.stringify(chat).slice(0, 200)}`); continue; }
  const mem = await call("getChatMember", { chat_id: chatId, user_id: me.result?.id });
  console.log(
    `${label}: "${chat.result.title}" (${chat.result.type}${chat.result.is_forum ? ", forum" : ""})` +
    ` topic=${topic || "-"} bot=${mem.ok ? mem.result.status : "?"}`,
  );
}
