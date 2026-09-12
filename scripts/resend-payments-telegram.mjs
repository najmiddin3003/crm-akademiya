// TO'LOVLARNI TELEGRAM'GA QAYTA YUBORISH — umumiy "To'lovlar" topigidagi
// eski xabarlarni har filialning o'z topigiga (branches.paymentTopicId)
// bazadan qayta yig'ib yuboradi. Kassa → filial → topik (lib/sync/lookups.ts).
//
//   node scripts/resend-payments-telegram.mjs              quruq: nima yuborilishini ko'rsatadi, YUBORMAYDI
//   node scripts/resend-payments-telegram.mjs --send       haqiqatan yuboradi
//   node scripts/resend-payments-telegram.mjs --all        sync_outbox iziga qaramay, ilova orqali kiritilgan HAMMA to'lov
//   node scripts/resend-payments-telegram.mjs --since 2026-09-01   sana chegarasi (entry.date shakli)
//
// TANLOV (sukut): `sync_outbox` da Telegram'ga ketgani qayd etilgan
// (`telegramDone` + `messageId`) to'lovlar — ya'ni AYNAN umumiy topikda
// turganlar. `--all` — `createdAt` li barcha payIn (eski navbat tozalangan
// bo'lsa iz yo'qolgan bo'lishi mumkin).
//
// MATN jonli oqim bilan BIR XIL: lib/sync/mappers.ts dagi paymentMessage;
// bekor qilingan yozuv uchun cancelMessage (asl to'lov EMAS — topikda
// yozuvning HOZIRGI holati tursin). Yuborish lib/sync/telegram.ts orqali
// (429 / 5xx da qayta urinish). sync_outbox GA TEGILMAYDI — bu tarixiy
// nusxa, sinxron holati emas.
//
// TEZLIK: bitta guruhga daqiqasiga ~20 xabar — har xabardan keyin 3,1 s.
// Filialsiz kassa (test kassa) o'tkazib yuboriladi va ro'yxati chiqadi.
// BAZAGA YOZMAYDI. Prod uchun SERVERDA (/var/www/crm/current).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register("./_ts-alias-hooks.mjs", import.meta.url);

const envPath = path.join(HERE, "..", ".env.local");
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : []) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

// Env yuklangandan KEYIN import — loadSyncConfig process.env ni o'qiydi.
const { loadSyncConfig } = await import("@/lib/sync/config");
const { SyncContext } = await import("@/lib/sync/lookups");
const { toPaymentRow, paymentMessage, cancelMessage } = await import("@/lib/sync/mappers");
const { sendMessage } = await import("@/lib/sync/telegram");

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const ALL = args.includes("--all");
const SINCE = args.includes("--since") ? args[args.indexOf("--since") + 1] || "" : "";
const GAP_MS = 3100;

const fail = (m) => { console.error(`❌ ${m}`); process.exit(1); };
if (!process.env.MONGODB_URI) fail("MONGODB_URI yo'q");
const cfg = loadSyncConfig();
const chatId = cfg.targets.payment.chatId;
if (!cfg.telegramToken) fail("TELEGRAM_BOT_TOKEN yo'q");
if (!chatId) fail("TELEGRAM_CHAT_PAYMENTS yo'q");
if (SINCE && !/^\d{4}-\d{2}-\d{2}$/.test(SINCE)) fail(`--since YYYY-MM-DD shaklida bo'lsin: ${SINCE}`);

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db((process.env.MONGODB_DB || "").trim() || "crm_akademiya");
  const ctx = new SyncContext(db);

  let ids = null;
  if (!ALL) {
    const ob = await db.collection("sync_outbox")
      .find({ kind: "payment", telegramDone: true, messageId: { $ne: null } }, { projection: { _id: 0, entryId: 1 } })
      .toArray();
    ids = [...new Set(ob.map((t) => Number(t.entryId)))];
  }
  const filter = { txType: "payIn", createdAt: { $exists: true }, ...(ids ? { id: { $in: ids } } : {}), ...(SINCE ? { date: { $gte: SINCE } } : {}) };
  const entries = await db.collection("transaction_entries").find(filter).sort({ id: 1 }).toArray();

  const plan = [];
  const skipped = [];
  for (const entry of entries) {
    const topic = await ctx.paymentTopicOf(entry.cashboxId);
    if (!topic) { skipped.push(entry.id); continue; }
    plan.push({ entry, topic });
  }

  const perTopic = {};
  for (const p of plan) {
    const k = `${await ctx.cashboxName(p.entry.cashboxId)} → topik ${p.topic}`;
    perTopic[k] = perTopic[k] || { n: 0, cancelled: 0 };
    perTopic[k].n++;
    if (String(p.entry.status) === "cancelled") perTopic[k].cancelled++;
  }
  console.log(`${SEND ? "YUBORILADI" : "QURUQ REJIM (yuborilmaydi)"} — guruh ${chatId}, ${ALL ? "hamma (createdAt)" : "sync_outbox izi bo'yicha"}${SINCE ? `, ${SINCE} dan` : ""}`);
  console.log(`Tanlangan: ${entries.length}, yuboriladi: ${plan.length}, filialsiz kassa (o'tkazib yuboriladi): ${skipped.length}`);
  for (const [k, v] of Object.entries(perTopic)) console.log(`  ${k.padEnd(50)} ${v.n} ta${v.cancelled ? ` (${v.cancelled} bekor qilingan)` : ""}`);
  if (plan.length) console.log(`Birinchi: #${plan[0].entry.id} (${plan[0].entry.date}) … oxirgi: #${plan.at(-1).entry.id} (${plan.at(-1).entry.date})`);
  if (skipped.length) console.log(`O'tkazib yuboriladi: ${skipped.join(", ")}`);
  console.log(`Taxminiy vaqt: ~${Math.ceil((plan.length * GAP_MS) / 60000)} daqiqa\n`);

  if (!SEND) { console.log("Yuborish uchun: --send"); }
  else {
    let ok = 0, bad = 0;
    for (const { entry, topic } of plan) {
      try {
        const row = await toPaymentRow(entry, ctx);
        const text = String(entry.status) === "cancelled" ? cancelMessage("payment", row) : paymentMessage(row);
        await sendMessage(cfg, chatId, text, String(topic));
        ok++;
        console.log(`  ✅ #${entry.id} ${row.studentName} ${row.amount} → topik ${topic}${String(entry.status) === "cancelled" ? " (bekor)" : ""}`);
      } catch (e) {
        bad++;
        console.log(`  ❌ #${entry.id}: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    console.log(`\nYuborildi: ${ok}, xato: ${bad}, o'tkazib yuborildi: ${skipped.length}`);
  }
} finally {
  await client.close();
}
