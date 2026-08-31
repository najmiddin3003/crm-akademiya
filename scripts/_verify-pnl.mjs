// FAQAT O'QISH — P&L sahifasi (/finance-pnl) uchun /api/transactions/summary
// eski KLIENT hisobi bilan mos keladimi?
//
//   node scripts/_verify-pnl.mjs
//
// DIQQAT — REGISTR TUZOG'I ATAYLAB SAQLANGAN. Sahifa
// `t.category === "O'quvchi to'ladi"` deb tekshiradi (katta "O"), bazada
// esa kategoriya kichik harfda saqlanadi. Ya'ni "Dars bo'yicha daromad"
// qatori har doim 0 chiqadi. Bu MAVJUD xulq va uni "tuzatish" katta
// summani ikki ko'rinadigan qator orasida ko'chirib yuboradi — quyidagi
// tekshiruv aynan shu xulq saqlanganini tasdiqlaydi.

import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB || undefined);
const COURSE = "O'quvchi to'ladi";
const tx = await db.collection("transactions").find({}).toArray();
const SIGN = { $cond: [{ $gt: ["$amount", 0] }, "pos", { $cond: [{ $lt: ["$amount", 0] }, "neg", "zero"] }] };

function oldYear(year) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthTx = tx.filter((t) => { const [ty, tm] = t.date.split("-").map(Number); return ty === year && tm === m; });
    return {
      month: m,
      courseIncome: monthTx.filter((t) => t.amount > 0 && t.category === COURSE).reduce((s, t) => s + t.amount, 0),
      otherIncome: monthTx.filter((t) => t.amount > 0 && t.category !== COURSE).reduce((s, t) => s + t.amount, 0),
      otherExpense: monthTx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
    };
  });
}

async function newYear(year) {
  const rows = await db.collection("transactions").aggregate([
    { $match: { date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
    { $group: { _id: { month: { $substrBytes: ["$date", 0, 7] }, category: "$category", sign: SIGN },
                amount: { $sum: { $toDecimal: "$amount" } } } },
  ]).toArray();
  const out = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, courseIncome: 0, otherIncome: 0, otherExpense: 0 }));
  for (const r of rows) {
    const m = Number(r._id.month.slice(5, 7));
    if (!(m >= 1 && m <= 12)) continue;
    const v = Number(r.amount.toString());
    const cell = out[m - 1];
    if (r._id.sign === "pos") {
      if (r._id.category === COURSE) cell.courseIncome += v; else cell.otherIncome += v;
    } else if (r._id.sign === "neg") cell.otherExpense -= v;
  }
  return out;
}

let fail = 0;
console.log("yil   dars daromadi        boshqa daromad          jami xarajat   holat");
console.log("-".repeat(76));
for (const year of [2025, 2026, 2027]) {
  const o = oldYear(year), n = await newYear(year);
  const same = o.every((r, i) => r.courseIncome === n[i].courseIncome
    && r.otherIncome === n[i].otherIncome && r.otherExpense === n[i].otherExpense);
  if (!same) fail++;
  const sum = (k) => o.reduce((s, r) => s + r[k], 0);
  console.log(String(year).padEnd(6),
    sum("courseIncome").toLocaleString("ru-RU").padStart(14),
    sum("otherIncome").toLocaleString("ru-RU").padStart(22),
    sum("otherExpense").toLocaleString("ru-RU").padStart(22),
    "  ", same ? "MOS ✓" : "FARQ ✗");
}
// Registr tuzog'i hali ham o'z kuchidami?
const upper = await db.collection("transactions").countDocuments({ category: COURSE });
const lower = await db.collection("transactions").countDocuments({ category: COURSE.toLowerCase() });
console.log(`\nregistr: katta "O" bilan ${upper} hujjat, kichik bilan ${lower} hujjat`);
console.log(upper === 0
  ? '=> "Dars bo\'yicha daromad" 0 chiqishi KUTILGAN xulq (mavjud holat saqlandi).'
  : "=> DIQQAT: katta harfli hujjatlar paydo bo'libdi, qatorlar endi to'ladi.");
console.log("\n" + (fail === 0 ? "==> HAMMASI MOS." : `==> ${fail} ta FARQ!`));
await c.close();
process.exit(fail ? 1 : 0);
