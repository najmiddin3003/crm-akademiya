// FAQAT O'QISH — "Kirim chiqim" sahifasi (/finance-cashflow) uchun
// /api/transactions/summary eski KLIENT hisobi bilan mos keladimi?
//
//   node scripts/_verify-finance-analytics.mjs
//
// Eski kod (FinanceAnalyticsPage.tsx): butun `transactions` kolleksiyasini
// yuklab, sana/kassa/to'lov usuli bo'yicha filtrlab, keyin har bir
// kategoriya uchun `Math.abs(amount)` yig'indisini olardi.
//
// Ishora sharti QAT'IY: "kirim" tabi `amount <= 0` ni tashlaydi, "chiqim"
// esa `amount >= 0` ni — ya'ni NOL summali yozuv IKKALA tabga ham
// tushmaydi. Server uch qiymatli kalit (pos|neg|zero) qaytargani uchun
// "zero" o'z-o'zidan chetda qoladi.

import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB || undefined);

const tx = await db.collection("transactions").find({}).toArray();
const types = await db.collection("transaction_types").find({}).toArray();
const namesOf = (mt) => [...new Set(types.filter((t) => t.mainType === mt).map((t) => t.name).filter(Boolean))];
const incomeCats = namesOf("kirim"), expenseCats = namesOf("chiqim");
const cashboxIds = [...new Set(tx.map((t) => t.cashboxId).filter((v) => v != null))];
const methods = [...new Set(tx.map((t) => t.method).filter(Boolean))];
console.log(`${tx.length} tranzaksiya | kassalar: ${cashboxIds.join(",")} | usullar: ${methods.length} ta\n`);

const SIGN = { $cond: [{ $gt: ["$amount", 0] }, "pos", { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] }] };

function oldRows(tab, { from, to, cashboxId, method }) {
  const cats = tab === "kirim" ? incomeCats : expenseCats;
  const inWindow = tx.filter((t) => {
    if (tab === "kirim" ? t.amount <= 0 : t.amount >= 0) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    if (cashboxId != null && t.cashboxId !== cashboxId) return false;
    if (method && t.method !== method) return false;
    return true;
  });
  return cats.map((k) => ({ label: k,
    value: inWindow.filter((t) => t.category === k).reduce((s, t) => s + Math.abs(t.amount), 0) }));
}

async function newRows(tab, { from, to, cashboxId, method }) {
  const match = {};
  if (from || to) { match.date = {}; if (from) match.date.$gte = from; if (to) match.date.$lte = to; }
  if (cashboxId != null) match.cashboxId = cashboxId;
  if (method) match.method = method;
  const rows = await db.collection("transactions").aggregate([
    { $match: match },
    { $group: { _id: { category: "$category", sign: SIGN }, amount: { $sum: { $toDecimal: "$amount" } } } },
  ]).toArray();
  const want = tab === "kirim" ? "pos" : "neg";
  const byCat = new Map();
  for (const r of rows) {
    if (r._id.sign !== want) continue;
    byCat.set(r._id.category, (byCat.get(r._id.category) ?? 0) + Math.abs(Number(r.amount.toString())));
  }
  const cats = tab === "kirim" ? incomeCats : expenseCats;
  return cats.map((k) => ({ label: k, value: byCat.get(k) ?? 0 }));
}

const CASES = [
  ["oraliqsiz",            {}],
  ["joriy oy",             { from: "2026-08-01", to: "2026-08-31" }],
  ["bir yil",              { from: "2026-01-01", to: "2026-12-31" }],
  ["bitta kassa",          { cashboxId: cashboxIds[0] }],
  ["kassa + oraliq",       { from: "2026-01-01", to: "2026-12-31", cashboxId: cashboxIds[0] }],
  ["to'lov usuli",         { method: methods[0] }],
];

let fail = 0;
console.log("holat".padEnd(20), "tab".padEnd(8), "jami".padStart(18), "  natija");
console.log("-".repeat(62));
for (const [label, filt] of CASES) {
  for (const tab of ["kirim", "chiqim"]) {
    const o = oldRows(tab, filt), n = await newRows(tab, filt);
    const same = o.length === n.length && o.every((r, i) => r.label === n[i].label && r.value === n[i].value);
    if (!same) fail++;
    const tot = o.reduce((s, r) => s + r.value, 0);
    console.log(label.padEnd(20), tab.padEnd(8), tot.toLocaleString("ru-RU").padStart(18), "  ", same ? "MOS ✓" : "FARQ ✗");
  }
}
console.log("\n" + (fail === 0 ? "==> HAMMASI MOS." : `==> ${fail} ta FARQ!`));
await c.close();
process.exit(fail ? 1 : 0);
