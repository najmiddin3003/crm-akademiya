// LIDLARNI TELEGRAM'GA QAYTA YUBORISH — bazadagi lidlarni "Lidlar" guruhida
// har biri o'z filiali topigiga, hozirgi statusi va tugmalari bilan.
//
//   node scripts/resend-leads-telegram.mjs                 quruq: nima yuborilishini ko'rsatadi, YUBORMAYDI
//   node scripts/resend-leads-telegram.mjs --send          haqiqatan yuboradi
//   node scripts/resend-leads-telegram.mjs --since 01.09.2026   sana chegarasi (sukut 07.09.2026 — lid xabari shu kundan yoqilgan)
//   node scripts/resend-leads-telegram.mjs --all           sanaga qaramay, filiali bor HAMMA lid
//
// NEGA "KO'CHIRISH" EMAS (12.09.2026, markaz so'rovi "eski guruhdagi
// lidlarni yangi guruhga olib o'tsak"): Bot API guruhdagi xabarni o'qiy
// ham, ko'chira ham olmaydi (copyMessage uchun message_id kerak, biz uni
// saqlamaganmiz). Shu bois xabar BAZADAN qayta yig'iladi — matn
// lib/leadNotify.ts dagi leadMessage bilan AYNAN bir xil, ya'ni jonli
// lid bilan farqi yo'q: status qatori, tugmalar, filial, yaratilgan vaqt.
//
// TARTIB: id bo'yicha o'sib (yaratilish tartibi) — topikda eng yangi lid
// pastda turadi, jonli oqim bilan bir xil.
//
// TEZLIK: Telegram bitta guruhga daqiqasiga ~20 xabar ruxsat beradi —
// har xabardan keyin 3.1 s kutiladi (85 lid ≈ 4.5 daqiqa). 429 kelsa
// lib/telegramApi.ts o'zi retry_after qadar kutib qayta uradi.
//
// BAZAGA HECH NARSA YOZMAYDI. Filiali topiksiz lid o'tkazib yuboriladi va
// oxirida ro'yxati chiqadi. Prod uchun SERVERDA (/var/www/crm/current).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
register("./_ts-alias-hooks.mjs", import.meta.url);
const { leadMessage } = await import("@/lib/leadNotify");
const { leadKeyboard } = await import("@/lib/leadStatus");
const { sendHtml } = await import("@/lib/telegramApi");

const envPath = path.join(HERE, "..", ".env.local");
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8").split(/\r?\n/) : []) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const SEND = args.includes("--send");
const ALL = args.includes("--all");
const sinceArg = args[args.indexOf("--since") + 1];
const SINCE = args.includes("--since") && sinceArg ? sinceArg : "07.09.2026";
const GAP_MS = 3100;

const fail = (m) => { console.error(`❌ ${m}`); process.exit(1); };
const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = (process.env.TELEGRAM_CHAT_LEADS || "").trim();
if (!token) fail("TELEGRAM_BOT_TOKEN yo'q");
if (!chatId) fail("TELEGRAM_CHAT_LEADS yo'q — lidlar guruhi sozlanmagan");
if (!process.env.MONGODB_URI) fail("MONGODB_URI yo'q");

// "DD.MM.YYYY | HH:mm" -> "YYYY-MM-DD" (satr solishtirish uchun).
const dayKey = (created) => { const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(created || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const sinceKey = dayKey(SINCE);
if (!ALL && !sinceKey) fail(`--since DD.MM.YYYY shaklida bo'lsin: ${SINCE}`);

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
try {
  const db = client.db((process.env.MONGODB_DB || "").trim() || "crm_akademiya");
  const branches = await db.collection("branches").find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
  const topicOf = new Map(branches.filter((b) => Number.isInteger(b.leadTopicId) && b.leadTopicId > 0).map((b) => [b.id, b]));

  const all = await db.collection("orders").find({ branchId: { $type: "number" } }).sort({ id: 1 }).toArray();
  const picked = all.filter((o) => ALL || dayKey(o.created) >= sinceKey);
  const ready = picked.filter((o) => topicOf.has(o.branchId));
  const skipped = picked.filter((o) => !topicOf.has(o.branchId));

  const perBranch = {};
  for (const o of ready) perBranch[o.branchId] = (perBranch[o.branchId] || 0) + 1;
  console.log(`${SEND ? "YUBORILADI" : "QURUQ REJIM (yuborilmaydi)"} — guruh ${chatId}, ${ALL ? "hamma" : `${SINCE} dan beri`}`);
  console.log(`Filiali bor lidlar: ${all.length}, tanlangan: ${picked.length}, yuboriladi: ${ready.length}, topiksiz: ${skipped.length}`);
  for (const b of branches) {
    console.log(`  ${b.name.padEnd(28)} topik ${b.leadTopicId ?? "YO'Q"}   ${perBranch[b.id] || 0} ta lid`);
  }
  if (ready.length) console.log(`Birinchi: #${ready[0].id} (${ready[0].created}) … oxirgi: #${ready.at(-1).id} (${ready.at(-1).created})`);
  if (skipped.length) console.log(`Topiksiz (o'tkazib yuboriladi): ${skipped.map((o) => o.id).join(", ")}`);
  console.log(`Taxminiy vaqt: ~${Math.ceil((ready.length * GAP_MS) / 60000)} daqiqa\n`);

  if (!SEND) { console.log("Yuborish uchun: --send"); }
  else {
    let ok = 0, bad = 0;
    for (const o of ready) {
      const b = topicOf.get(o.branchId);
      try {
        await sendHtml(token, chatId, leadMessage(o, b.name), { threadId: String(b.leadTopicId), replyMarkup: leadKeyboard(o.id) });
        ok++;
        console.log(`  ✅ #${o.id} ${o.name || ""} → ${b.name} (topik ${b.leadTopicId})`);
      } catch (e) {
        bad++;
        console.log(`  ❌ #${o.id} ${o.name || ""}: ${e instanceof Error ? e.message : e}`);
      }
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    console.log(`\nYuborildi: ${ok}, xato: ${bad}, topiksiz: ${skipped.length}`);
  }
} finally {
  await client.close();
}
