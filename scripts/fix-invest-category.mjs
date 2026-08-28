// To'rtta yozuvning kategoriyasini "Boshqa" dan "F - INVEST" ga o'tkazadi.
//
//   node scripts/fix-invest-category.mjs          # quruq yurish
//   node scripts/fix-invest-category.mjs --yes    # qo'llash
//
// Oldin zaxira: node scripts/_backup-db.mjs
//
// ── NEGA ─────────────────────────────────────────────────────────────
// Edutizimda bu to'rtta yozuv "Boshqa" deb kiritilgan, aslida esa
// foyda olib chiqish. Dalillar:
//
//   • Uchtasi 2026-01-03 da 09:07 / 09:08 / 09:09 da, ya'ni ketma-ket
//     uch daqiqada, VA uch xil to'lov turi bo'yicha (Naqd, Plastik,
//     Terminal). Bu xarid emas — kassani to'lov turlari bo'yicha
//     bo'shatish.
//   • To'rtinchisining izohi "SENTABR 2025" — oylik hisob-kitob.
//   • Hammasi kassa 3 dan, moderator Abdulloh Raxmatullayev — haqiqiy
//     "F - INVEST" yozuvlari bilan bir xil naqsh (ular "Abdulloh"
//     izohi bilan yozilgan).
//   • Qolgan 181 ta "Boshqa" (70 mln) aniq xarajat: parta-stol,
//     arenda, banner, flayer, marker — hammasi izohli va mayda.
//
// Buni foydalanuvchi tasdiqladi (2026-08-28).
//
// ── NIMA O'ZGARADI ───────────────────────────────────────────────────
// `transaction_entries.txName` va u bilan JUFT yoziladigan
// `transactions.category`. Ikkalasi ham o'zgarishi shart, aks holda
// CRM ichidagi moliya hisobotlari eski kategoriyani ko'rsatib turardi.
//
// Summa, sana, kassa va balansga TEGILMAYDI — faqat kategoriya nomi.
// Google Sheets keyingi solishtirishda o'zi yangilanadi (4 ta qator).
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
const APPLY = process.argv.includes("--yes");

const IDS = [122, 519, 520, 521];
const FROM = "Boshqa";
const TO = "F - INVEST";

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);
const entries = db.collection("transaction_entries");
const txs = db.collection("transactions");
const fmt = (n) => Math.round(Math.abs(n)).toLocaleString("ru-RU");

const docs = await entries.find({ id: { $in: IDS } }).sort({ id: 1 }).toArray();
if (docs.length !== IDS.length) {
  console.error(`❌ ${IDS.length} ta kutilgandi, ${docs.length} tasi topildi — TO'XTATILDI`);
  await client.close();
  process.exit(1);
}
const wrong = docs.filter((d) => d.txName !== FROM);
if (wrong.length) {
  console.error(`❌ Bu yozuvlarning kategoriyasi "${FROM}" emas — TO'XTATILDI:`);
  for (const d of wrong) console.error(`   id=${d.id} txName="${d.txName}"`);
  await client.close();
  process.exit(1);
}

// Har bir yozuvning `transactions` dagi jufti — sana+vaqt+summa+kassa
// bo'yicha. Importer ular orasida havola qoldirmagan, shuning uchun
// moslik SHU TO'RT maydon bilan topiladi va bitta bo'lishi tekshiriladi.
const pairs = [];
for (const d of docs) {
  const found = await txs.find({ date: d.date, time: d.time, amount: d.amount, cashboxId: d.cashboxId }).toArray();
  if (found.length !== 1) {
    console.error(`❌ id=${d.id} uchun transactions da ${found.length} ta mos yozuv — TO'XTATILDI`);
    await client.close();
    process.exit(1);
  }
  pairs.push({ entry: d, tx: found[0] });
}

console.log(`"${FROM}" -> "${TO}"\n`);
for (const { entry: e, tx } of pairs) {
  console.log(`  entry id=${String(e.id).padStart(4)}  ${e.date} ${e.time}  ${fmt(e.amount).padStart(14)}  ${e.paymentType.padEnd(9)} · transactions id=${tx.id}`);
}
console.log(`\nJami: ${fmt(docs.reduce((s, d) => s + d.amount, 0))}`);

if (!APPLY) {
  console.log("\nQURUQ YURISH — bazaga hech narsa yozilmadi. Qo'llash uchun --yes qo'shing.");
  await client.close();
  process.exit(0);
}

const r1 = await entries.updateMany({ id: { $in: IDS }, txName: FROM }, { $set: { txName: TO } });
const r2 = await txs.updateMany({ id: { $in: pairs.map((p) => p.tx.id) }, category: FROM }, { $set: { category: TO } });
console.log(`\n✓ transaction_entries: ${r1.modifiedCount} ta · transactions: ${r2.modifiedCount} ta`);

console.log("\n— Tekshiruv —");
let ok = true;
const check = (label, good, detail) => { if (!good) ok = false; console.log(`  ${good ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`); };
check("yozuvlar yangilandi", await entries.countDocuments({ id: { $in: IDS }, txName: TO }) === IDS.length);
check("hisobot yozuvlari yangilandi", await txs.countDocuments({ id: { $in: pairs.map((p) => p.tx.id) }, category: TO }) === IDS.length);

// Summalar o'zgarmaganini tasdiqlash — faqat nom almashishi kerak edi.
const after = await entries.find({ id: { $in: IDS } }).sort({ id: 1 }).toArray();
check("summalar o'zgarmadi", after.every((a, i) => a.amount === docs[i].amount && a.date === docs[i].date && a.cashboxId === docs[i].cashboxId));

const grp = async (name) => {
  const r = await entries.aggregate([
    { $match: { txType: "payOut", status: "", txName: name } },
    { $group: { _id: null, n: { $sum: 1 }, s: { $sum: { $abs: "$amount" } } } },
  ]).toArray();
  return r[0] ?? { n: 0, s: 0 };
};
const b = await grp(FROM);
const inv = await grp(TO);
console.log(`\n  "${FROM}"  : ${String(b.n).padStart(4)} ta · ${fmt(b.s)}`);
console.log(`  "${TO}": ${String(inv.n).padStart(4)} ta · ${fmt(inv.s)}`);
console.log(ok ? "\n✓ Tugadi." : "\n✗ Nomuvofiqlik bor.");
await client.close();
