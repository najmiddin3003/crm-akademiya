// Kassa jurnalidan yozuvni BUTUNLAY o'chiradi (barcha izlari bilan).
//
//   node scripts/delete-entries.mjs 27 28            # quruq yurish
//   node scripts/delete-entries.mjs 27 28 --apply    # o'chiradi
//
// ══════════════════════════════════════════════════════════════════
// BITTA TO'LOV BESHTA JOYDA IZ QOLDIRADI
//
//   1) transaction_entries        jurnal yozuvi
//   2) transactions               juft hujjat (ko'chirmalarda YO'Q)
//   3) sync_outbox                navbat qatori
//   4) sms_messages               to'lov SMS jurnali (bo'lsa)
//   5) Google jadval              alohida: scripts/sheets-drop-orphans.mjs
//
// 3-BAND — TUZOQ. `sync_outbox` da `{kind, entryId, event}` unikal
// indeksi bor, `logEntry` esa yangi id ni `max(id)+1` bilan beradi.
// Jurnal yozuvi o'chirilib navbat qatori qolsa, o'sha id qayta
// ishlatilganda YANGI yozuvning sinxroni JIMGINA bloklanadi. Bu
// 2026-09-03 dagi hodisadan olingan saboq.
//
// BALANSGA TEGILMAYDI — ATAYLAB.
//
// Skript pulni o'zi "to'g'rilamaydi": bekor qilingan yozuv balansga
// allaqachon ta'sir qilmaydi (bekor qilish paytida qaytarilgan), ya'ni
// uni o'chirish balans uchun BEFARQ. Bekor qilinMAGAN yozuv esa boshqa
// masala — uni o'chirish balansni buzadi, shuning uchun skript ogohlantirib
// TO'XTAYDI (`--force` bilan davom ettirsa bo'ladi, lekin keyin balansni
// qo'lda tiklash kerak).
//
// Oxirida har bir tegilgan kassa uchun INVARIANT tekshiriladi:
//     balance === methodTotals yig'indisi === jurnal yig'indisi
import fs from "fs";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
if (ids.length === 0) {
  console.error("Foydalanish: node scripts/delete-entries.mjs <id> [<id>…] [--apply] [--force]");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);

const entries = await db.collection("transaction_entries")
  .find({ id: { $in: ids } }, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
const missing = ids.filter((i) => !entries.some((e) => e.id === i));

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
if (missing.length) console.log("topilmadi (allaqachon o'chirilgan?):", missing.join(", "));
if (entries.length === 0) { await c.close(); process.exit(0); }

const plan = [];
for (const e of entries) {
  const tx = await db.collection("transactions").findOne(
    { cashboxId: e.cashboxId, date: e.date, time: e.time, amount: e.amount },
    { projection: { _id: 0 } },
  );
  const outbox = await db.collection("sync_outbox").find({ entryId: e.id }, { projection: { _id: 0 } }).toArray();
  const sms = e.studentName
    ? await db.collection("sms_messages").find(
        { purpose: "payment", date: e.date, recipientName: e.studentName },
        { projection: { _id: 0 } },
      ).toArray()
    : [];
  plan.push({ e, tx, outbox, sms });
  console.log(
    `\n#${e.id} kassa${e.cashboxId} ${e.date} ${e.time} ${e.txType} ${e.amount} ` +
    `[${e.status || "faol"}] ${e.txName}${e.studentName ? " — " + e.studentName : ""}`,
  );
  console.log(`   juft: ${tx ? "#" + tx.id : "yo'q"} | navbat: ${outbox.length} | SMS: ${sms.length}`);
}

const live = plan.filter((p) => p.e.status !== "cancelled");
if (live.length > 0) {
  console.log(`\nDIQQAT: ${live.length} ta yozuv BEKOR QILINMAGAN (#${live.map((p) => p.e.id).join(", #")}).`);
  console.log("Ularni o'chirish kassa balansini buzadi — avval CRM'dan bekor qiling");
  console.log("yoki --force bilan davom eting va balansni qo'lda tiklang.");
  if (!FORCE) { await c.close(); process.exit(1); }
}

const path = `C:/Users/zovaxx/Desktop/ochirilgan-yozuvlar-${ids.join("-")}-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), plan }, null, 1));
console.log("\nzaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
  await c.close();
  process.exit(0);
}

let nE = 0, nT = 0, nO = 0, nS = 0;
for (const p of plan) {
  nE += (await db.collection("transaction_entries").deleteOne({ id: p.e.id })).deletedCount;
  if (p.tx) nT += (await db.collection("transactions").deleteOne({ id: p.tx.id })).deletedCount;
  nO += (await db.collection("sync_outbox").deleteMany({ entryId: p.e.id })).deletedCount;
  for (const s of p.sms) nS += (await db.collection("sms_messages").deleteOne({ id: s.id })).deletedCount;
}
console.log(`\no'chirildi: jurnal ${nE}, juft ${nT}, navbat ${nO}, SMS ${nS}`);

console.log("\n=== INVARIANT TEKSHIRUVI (tegilgan kassalar) ===");
let bad = 0;
for (const boxId of [...new Set(plan.map((p) => p.e.cashboxId))]) {
  const b = await db.collection("cashboxes").findOne({ id: boxId }, { projection: { _id: 0, id: 1, name: 1, balance: 1, methodTotals: 1 } });
  const totals = Object.values(b?.methodTotals ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const rows = await db.collection("transaction_entries")
    .find({ cashboxId: boxId, status: { $ne: "cancelled" } }, { projection: { _id: 0, amount: 1, status: 1 } }).toArray();
  const journal = rows.filter((r) => !(r.status === "waiting" && Number(r.amount) > 0))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ok = b.balance === totals && b.balance === journal;
  if (!ok) bad++;
  console.log(`  #${b.id} ${String(b.name).padEnd(30)} balance=${b.balance} turlar=${totals} jurnal=${journal}  ${ok ? "MOS" : "!!! FARQ"}`);
}
console.log(bad === 0 ? "\nBalanslar joyida." : `\n${bad} ta kassada farq bor — qo'lda ko'ring.`);
console.log("\nENDI JADVALDAN: node scripts/sheets-drop-orphans.mjs --apply");

await c.close();
