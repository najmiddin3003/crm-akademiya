// FAQAT O'QISH — /api/transactions/summary Pul oqimi sahifasidagi eski
// KLIENT hisobi bilan aynan bir xil natija beradimi?
//
//   node scripts/_verify-cashflow.mjs
//
// Nima solishtiriladi (CashFlowStatementPage.tsx):
//   1) `monthly` — 12 oy x kategoriya x ishora bo'yicha Kirim/Chiqim
//   2) `openingBalance` — yildan oldingi barcha tranzaksiyalar sof yig'indisi
//
// float TUZOG'I: eski klient float'da chapdan o'ngga yig'adi. Oddiy $sum ham
// float'da yig'adi, LEKIN boshqa tartibda — natija ba'zi yillarda farq
// qiladi. $toDecimal aniq hisoblaydi. Quyida UCHALASI ham chiqariladi, ya'ni
// qaysi biri qayerda ajralib turishini o'z ko'zingiz bilan ko'rasiz.

import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB || undefined);

const OTHER_KEY = "__boshqa__";
const tx = await db.collection("transactions").find({}).toArray();
const types = await db.collection("transaction_types").find({}).toArray();
const namesOf = (mt) => [...new Set(types.filter((t) => t.mainType === mt).map((t) => t.name).filter(Boolean))];
const incomeCats = namesOf("kirim");
const expenseCats = namesOf("chiqim");
console.log(`${tx.length} tranzaksiya | ${incomeCats.length} kirim turi | ${expenseCats.length} chiqim turi\n`);

// ---------- ESKI YO'L (CashFlowStatementPage.tsx:95-127) ----------
function oldMonthly(year) {
  const knownIncome = new Set(incomeCats), knownExpense = new Set(expenseCats);
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthTx = tx.filter((t) => { const [ty, tm] = t.date.split("-").map(Number); return ty === year && tm === m; });
    const income = Object.fromEntries(incomeCats.map((k) => [k, 0]));
    const expense = Object.fromEntries(expenseCats.map((k) => [k, 0]));
    for (const t of monthTx) {
      if (t.amount > 0) { const k = knownIncome.has(t.category) ? t.category : OTHER_KEY; income[k] = (income[k] || 0) + t.amount; }
      else { const k = knownExpense.has(t.category) ? t.category : OTHER_KEY; expense[k] = (expense[k] || 0) - t.amount; }
    }
    return { month: m, income, expense };
  });
}
const oldOpening = (year) => tx.filter((t) => t.date < `${year}-01-01`).reduce((s, t) => s + t.amount, 0);

// ---------- YANGI YO'L (endpoint + klientdagi fold) ----------
const SIGN = { $cond: [{ $gt: ["$amount", 0] }, "pos", { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] }] };
async function newMonthly(year, decimal = true) {
  const amount = decimal ? { $sum: { $toDecimal: "$amount" } } : { $sum: "$amount" };
  const rows = await db.collection("transactions").aggregate([
    { $match: { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
    { $group: { _id: { month: { $substrBytes: ["$date", 0, 7] }, category: "$category", sign: SIGN }, amount } },
  ]).toArray();
  const knownIncome = new Set(incomeCats), knownExpense = new Set(expenseCats);
  const out = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: Object.fromEntries(incomeCats.map((k) => [k, 0])),
    expense: Object.fromEntries(expenseCats.map((k) => [k, 0])),
  }));
  for (const r of rows) {
    const m = Number(r._id.month.slice(5, 7));
    const v = Number(r.amount.toString());
    const cell = out[m - 1];
    if (r._id.sign === "pos") { const k = knownIncome.has(r._id.category) ? r._id.category : OTHER_KEY; cell.income[k] = (cell.income[k] || 0) + v; }
    else { const k = knownExpense.has(r._id.category) ? r._id.category : OTHER_KEY; cell.expense[k] = (cell.expense[k] || 0) - v; }
  }
  return out;
}
async function newOpening(year, decimal = true) {
  const amount = decimal ? { $sum: { $toDecimal: "$amount" } } : { $sum: "$amount" };
  const r = await db.collection("transactions").aggregate([
    { $match: { date: { $lt: `${year}-01-01` } } }, { $group: { _id: null, amount } }]).toArray();
  return r[0] ? Number(r[0].amount.toString()) : 0;
}

let fail = 0;
console.log("=== 1) OYLIK KIRIM/CHIQIM (12 oy x kategoriya) ===");
for (const year of [2025, 2026, 2027]) {
  const o = oldMonthly(year), n = await newMonthly(year);
  let diff = 0;
  for (let i = 0; i < 12; i++) {
    for (const k of new Set([...Object.keys(o[i].income), ...Object.keys(n[i].income)])) if ((o[i].income[k] || 0) !== (n[i].income[k] || 0)) diff++;
    for (const k of new Set([...Object.keys(o[i].expense), ...Object.keys(n[i].expense)])) if ((o[i].expense[k] || 0) !== (n[i].expense[k] || 0)) diff++;
  }
  if (diff) fail++;
  const tot = o.reduce((s, m) => s + Object.values(m.income).reduce((a, b) => a + b, 0), 0);
  console.log(` ${year}:`, diff === 0 ? "MOS ✓" : `FARQ ✗ (${diff} katak)`,
              `| yillik kirim ${tot.toLocaleString("ru-RU")}`);
}

console.log("\n=== 2) BOSHLANG'ICH QOLDIQ (float tuzog'i shu yerda) ===");
console.log(" yil    klient (float)        $sum (float)       $toDecimal        holat");
for (const year of [2025, 2026, 2027, 2028]) {
  const o = oldOpening(year), plain = await newOpening(year, false), dec = await newOpening(year, true);
  const ok = o === dec;
  if (!ok) fail++;
  console.log(` ${year}  ${String(o).padStart(18)} ${String(plain).padStart(20)} ${String(dec).padStart(16)}   ${ok ? "MOS ✓" : "FARQ ✗"}${plain !== o ? "   <- oddiy $sum FARQ qilardi" : ""}`);
}

console.log("\n" + (fail === 0 ? "==> HAMMASI MOS." : `==> ${fail} ta FARQ!`));
await c.close();
process.exit(fail ? 1 : 0);
