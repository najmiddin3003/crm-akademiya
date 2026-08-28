// Telegram yetkazib berishni HAQIQIY yo'l bilan tekshiradi va izini
// o'zidan keyin tozalaydi.
//
// NEGA SHUNDAY: qo'lda yozilgan "sinov" xabarini yuborish faqat tarmoqni
// tekshirardi. Bu skript esa bazadagi HAQIQIY yozuvni navbatga qo'yib,
// ilovaning O'Z `flushPending` mantiqini ishga tushiradi — ya'ni mapper,
// `esc()`, topic yo'naltirish va xato ishlash — hammasi haqiqiy.
//
//   node scripts/_telegram-smoke-test.mjs <dev-server-url>
//
// Bosqichlar:
//   1) har bir oqimdan bittadan yozuv tanlanadi;
//   2) navbatga `sheetDone: true` bilan qo'yiladi — jadvalga tegilmaydi,
//      faqat Telegram qismi bajariladi;
//   3) /api/sync/cron chaqiriladi (navbatni bo'shatadi);
//   4) yuborilgan xabarlar O'CHIRILADI va navbat yozuvlari ham
//      o'chiriladi — guruh ham, baza ham avvalgi holatiga qaytadi.
//
// 4-bosqich MAJBURIY: navbatda `created` yozuvi qolib ketsa, keyinchalik
// o'sha to'lovni bekor qilganda guruhga xabar ketardi (wasAnnounced).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const SECRET = (process.env.CRON_SECRET || "").trim();
const KEEP = process.argv.includes("--keep"); // xabarni o'chirmaslik

const tg = async (method, params) => {
  const u = new URL(`https://api.telegram.org/bot${TOKEN}/${method}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return (await fetch(u)).json();
};

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const te = db.collection("transaction_entries");
const ob = db.collection("sync_outbox");

const PICK = [
  { kind: "payment", filter: { txType: "payIn", status: "" } },
  { kind: "salary", filter: { txType: "payOut", status: "", txName: { $regex: "avans|oylik", $options: "i" } } },
];

const now = new Date().toISOString();
const chosen = [];
for (const p of PICK) {
  const doc = await te.find(p.filter).sort({ id: -1 }).limit(1).next();
  if (!doc) { console.log(`⚠️  ${p.kind}: yozuv topilmadi, o'tkazib yuborildi`); continue; }
  chosen.push({ kind: p.kind, entryId: doc.id, who: doc.studentName, amount: doc.amount, name: doc.txName });
  console.log(`${p.kind.padEnd(8)} #${doc.id}  ${doc.txName}  ${Math.abs(doc.amount).toLocaleString("ru-RU")}  ${doc.studentName || "—"}`);
}
if (chosen.length === 0) { await client.close(); process.exit(1); }

// Navbatda shu yozuv uchun `created` allaqachon bo'lsa TEGMAYMIZ — aks
// holda haqiqiy vazifani buzib qo'yardik.
const fresh = [];
for (const c of chosen) {
  const exists = await ob.findOne({ kind: c.kind, entryId: c.entryId, event: "created" });
  if (exists) { console.log(`⚠️  ${c.kind} #${c.entryId}: navbatda allaqachon bor — tegilmadi`); continue; }
  fresh.push(c);
}
if (fresh.length === 0) { await client.close(); process.exit(1); }

await ob.insertMany(fresh.map((c) => ({
  kind: c.kind, entryId: c.entryId, event: "created",
  notifyTelegram: true, status: "pending",
  sheetDone: true, // jadvalga tegilmaydi — faqat Telegram sinovi
  telegramDone: false, messageId: null, attempts: 0,
  lastError: null, nextAttemptAt: null,
  createdAt: now, updatedAt: now, doneAt: null,
})));
console.log(`\n${fresh.length} ta vazifa navbatga qo'yildi. /api/sync/cron chaqirilyapti…`);

const res = await fetch(`${BASE}/api/sync/cron`, { headers: { "x-cron-secret": SECRET } });
const data = await res.json();
console.log(`javob: ${res.status} · yuborildi ${data.flush?.succeeded ?? "?"} · xato ${data.flush?.failed ?? "?"}`);

let ok = true;
for (const c of fresh) {
  const task = await ob.findOne({ kind: c.kind, entryId: c.entryId, event: "created" });
  const sent = task?.telegramDone && task?.messageId;
  if (!sent) ok = false;
  console.log(`  ${sent ? "✓" : "✗"} ${c.kind}: ${sent ? `xabar #${task.messageId} yuborildi` : `yuborilmadi — ${task?.lastError || "sabab noma'lum"}`}`);
}

// Tozalash: xabarni ham, navbat yozuvini ham olib tashlaymiz.
if (!KEEP) {
  console.log("\nTozalash…");
  for (const c of fresh) {
    const task = await ob.findOne({ kind: c.kind, entryId: c.entryId, event: "created" });
    if (task?.messageId) {
      const chatId = c.kind === "payment" ? process.env.TELEGRAM_CHAT_PAYMENTS : process.env.TELEGRAM_CHAT_SALARIES;
      const del = await tg("deleteMessage", { chat_id: chatId.trim(), message_id: task.messageId });
      console.log(`  ${del.ok ? "✓" : "✗"} ${c.kind}: xabar o'chirildi${del.ok ? "" : ` (${del.description})`}`);
    }
    await ob.deleteOne({ kind: c.kind, entryId: c.entryId, event: "created" });
  }
  console.log(`  ✓ navbat tozalandi (qolgan: ${await ob.countDocuments()})`);
}

console.log(ok ? "\n✓ Telegram ishlayapti." : "\n✗ Yuborilmadi — yuqoridagi sababga qarang.");
await client.close();
process.exit(ok ? 0 : 1);
