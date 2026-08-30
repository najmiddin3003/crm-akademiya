// Tushum rejasi raqamlari o'zgarmaganini TEKSHIRADI.
// Eski usul: butun jadvalni o'qib, JS'da filtrlash va yig'ish.
// Yangi usul: Mongo aggregation.
// Ikkalasi bir xil chiqishi SHART — bular moliyaviy ko'rsatkichlar.
import fs from "fs";
import { MongoClient } from "mongodb";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 }); await c.connect();
const col = c.db(env.MONGODB_DB).collection("transaction_entries");

// ── ESKI USUL: hammasini yuklab, klientdagidek hisoblash ──────────────
const all = await col.find({}).toArray();
const old = (from, to) => {
  const inMonth = all.filter((e) => e.txType === "payIn" && e.studentName && e.date >= from && e.date <= to);
  const before  = all.filter((e) => e.txType === "payIn" && e.studentName && e.date < from);
  return {
    paidAmount: inMonth.reduce((s, e) => s + e.amount, 0),
    paidStudents: new Set(inMonth.map((e) => e.studentName)).size,
    paidBeforeAmount: before.reduce((s, e) => s + e.amount, 0),
    paidBeforeStudents: new Set(before.map((e) => e.studentName)).size,
  };
};

// ── YANGI USUL: aggregation (route bilan bir xil) ─────────────────────
const BASE = { txType: "payIn", studentName: { $nin: ["", null] } };
const ST = [{ $group: { _id: null, amount: { $sum: "$amount" }, students: { $addToSet: "$studentName" } } },
            { $project: { _id: 0, amount: 1, students: { $size: "$students" } } }];
const agg = async (from, to) => {
  const [a, b] = await Promise.all([
    col.aggregate([{ $match: { ...BASE, date: { $gte: from, $lte: to } } }, ...ST]).toArray(),
    col.aggregate([{ $match: { ...BASE, date: { $lt: from } } }, ...ST]).toArray(),
  ]);
  return {
    paidAmount: Number(a[0]?.amount ?? 0), paidStudents: Number(a[0]?.students ?? 0),
    paidBeforeAmount: Number(b[0]?.amount ?? 0), paidBeforeStudents: Number(b[0]?.students ?? 0),
  };
};

const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
const months = ["2026-08","2026-07","2026-06","2026-05","2026-01","2025-12"];
let ok = true;
for (const ym of months) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`, to = lastDay(y, m);
  const A = old(from, to), B = await agg(from, to);
  const same = JSON.stringify(A) === JSON.stringify(B);
  if (!same) ok = false;
  console.log(`${ym}  ${same ? "MOS ✓" : "FARQ ✗"}`);
  console.log(`   eski:  ${JSON.stringify(A)}`);
  console.log(`   yangi: ${JSON.stringify(B)}`);
}
console.log(`\nNATIJA: ${ok ? "hamma oyda raqamlar AYNAN bir xil" : "FARQ BOR — tegmang!"}`);
await c.close();
process.exit(ok ? 0 : 1);
