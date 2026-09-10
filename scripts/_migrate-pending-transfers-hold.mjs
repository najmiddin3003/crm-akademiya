// BIR MARTALIK MIGRATSIYA — tasdiq kutayotgan eski ko'chirmalarning
// pulini jo'natuvchi kassaga qaytaradi.
//
//   node scripts/_migrate-pending-transfers-hold.mjs            (quruq yurish)
//   node scripts/_migrate-pending-transfers-hold.mjs --apply    (yozadi)
//
// NEGA KERAK: 10.09.2026 dan ko'chirma qoidasi o'zgardi — pul endi
// jo'natishda emas, TASDIQLANGANDA kassadan chiqadi (app/api/cashboxes/
// [id]/transfer-to/route.ts). Ungacha yozilgan `waiting` qatorlarda pul
// allaqachon yechilgan va "yo'lda" turibdi, ya'ni kassirlarning balansi
// past ko'rinadi.
//
// Skript har bir shunday ko'chirma uchun:
//   1) chiquvchi qatorga `deductedOnSend: false` qo'yadi — endi u YANGI
//      qoidaga bo'ysunadi (pul kassada, tasdiqda yechiladi);
//   2) o'sha summani jo'natuvchi kassaga QAYTARADI.
//
// Tartib ataylab shunday: avval qator "band" qilinadi (shart bilan), keyin
// pul qo'shiladi. Skript qayta ishga tushirilsa `deductedOnSend` allaqachon
// bor qatorlar umuman tanlanmaydi — pul ikki marta qaytmaydi. $inc xato
// bersa bayroq orqaga olinadi.
//
// TEGILMAYDI: jurnal qatorining holati (`waiting` bo'lib qolaveradi),
// summasi, Google Sheets qatori va Telegram. Faqat kassa balansi va
// bitta yangi maydon.
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

const APPLY = process.argv.includes("--apply");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(env.MONGODB_DB || "crm_akademiya");
const entries = db.collection("transaction_entries");
const boxes = db.collection("cashboxes");
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU");

// To'lov turi kaliti yo'q eski qator uchun nom bo'yicha zaxira xarita.
const methods = await db.collection("settings_payment_methods").find({}).toArray();
const keyByName = new Map(methods.map((m) => [m.name, m.key]));

const rows = await entries
  .find({
    txType: "transfer",
    transferRole: "out",
    status: "waiting",
    deductedOnSend: { $exists: false },
  })
  .sort({ id: 1 })
  .toArray();

const namesById = Object.fromEntries((await boxes.find({}).toArray()).map((c) => [c.id, c.name]));

console.log(`${APPLY ? "YOZILMOQDA" : "QURUQ YURISH"} — ${rows.length} ta eski ko'chirma topildi\n`);

const plan = new Map(); // cashboxId -> { key -> sum }
const bad = [];
for (const r of rows) {
  const key = r.paymentMethodKey || keyByName.get(r.paymentType);
  const amount = Math.abs(Number(r.amount) || 0);
  if (!key || amount <= 0) {
    bad.push(`  id=${r.id}: to'lov turi (${r.paymentType}) yoki summa (${r.amount}) noto'g'ri`);
    continue;
  }
  const per = plan.get(r.cashboxId) ?? {};
  per[key] = (per[key] ?? 0) + amount;
  plan.set(r.cashboxId, per);
}
if (bad.length) {
  console.log("O'TKAZIB YUBORILADI (qo'lda ko'rish kerak):");
  for (const b of bad) console.log(b);
  console.log("");
}

for (const [cbId, per] of plan) {
  const cb = await boxes.findOne({ id: cbId });
  const add = Object.values(per).reduce((a, b) => a + b, 0);
  console.log(`Kassa ${cbId} — ${namesById[cbId]}`);
  console.log(`  balans: ${fmt(cb.balance)} -> ${fmt(cb.balance + add)}  (+${fmt(add)})`);
  for (const [k, v] of Object.entries(per)) {
    console.log(`    ${k}: ${fmt(cb.methodTotals?.[k] ?? 0)} -> ${fmt((cb.methodTotals?.[k] ?? 0) + v)}`);
  }
}

if (!APPLY) {
  console.log("\nHech narsa yozilmadi. Yozish uchun: --apply");
  await client.close();
  process.exit(0);
}

let done = 0;
let skipped = 0;
for (const r of rows) {
  const key = r.paymentMethodKey || keyByName.get(r.paymentType);
  const amount = Math.abs(Number(r.amount) || 0);
  if (!key || amount <= 0) { skipped++; continue; }

  // 1) Qatorni "band" qilamiz. Shart — takroriy ishga tushirishdan
  //    himoya: bayrog'i bor qator ikkinchi marta o'tmaydi.
  const claim = await entries.updateOne(
    { id: r.id, status: "waiting", deductedOnSend: { $exists: false } },
    { $set: { deductedOnSend: false } },
  );
  if (claim.modifiedCount !== 1) { skipped++; continue; }

  // 2) Pulni kassaga qaytaramiz.
  const inc = await boxes.updateOne(
    { id: r.cashboxId },
    { $inc: { [`methodTotals.${key}`]: amount, balance: amount } },
  );
  if (inc.matchedCount !== 1) {
    await entries.updateOne({ id: r.id }, { $unset: { deductedOnSend: "" } });
    console.log(`  XATO id=${r.id}: kassa ${r.cashboxId} topilmadi — bayroq qaytarildi`);
    skipped++;
    continue;
  }
  done++;
}

console.log(`\nBajarildi: ${done} ta ko'chirma, o'tkazib yuborildi: ${skipped}`);
for (const [cbId] of plan) {
  const cb = await boxes.findOne({ id: cbId });
  const sum = Object.values(cb.methodTotals || {}).reduce((a, b) => a + (b || 0), 0);
  console.log(
    `Kassa ${cbId} (${namesById[cbId]}): balans ${fmt(cb.balance)}, turlar yig'indisi ${fmt(sum)}` +
      (sum === cb.balance ? "  ✓" : "  !!! MOS EMAS"),
  );
}
await client.close();
