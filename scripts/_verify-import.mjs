// FAQAT O'QIYDI — import natijasini ilovaning O'Z mantiqi bilan tekshiradi.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split("\n")) {
  const s = l.trim(); if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("="); if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 }); await client.connect();
const db = client.db(process.env.MONGODB_DB);

console.log("=== KASSALAR ===");
for (const c of await db.collection("cashboxes").find({}).sort({ id: 1 }).toArray()) {
  console.log(`  id=${c.id} "${c.name}" · moderator "${c.moderator}" · balans ${fmt(c.balance)}`);
  for (const [k, v] of Object.entries(c.methodTotals)) if (v !== 0) console.log(`        ${k.padEnd(18)} ${fmt(v).padStart(16)}`);
}

const te = db.collection("transaction_entries");
console.log("\n=== transaction_entries ===");
console.log("  jami:", await te.countDocuments());
for (const g of await te.aggregate([{ $group: { _id: "$txType", n: { $sum: 1 }, s: { $sum: "$amount" } } }, { $sort: { n: -1 } }]).toArray())
  console.log(`  ${String(g._id).padEnd(9)} ${String(g.n).padStart(5)} ta  ${fmt(g.s).padStart(18)}`);
console.log("  bekor qilingan:", await te.countDocuments({ status: "cancelled" }));

// lib/payrollSources.ts -> loadPaidByEmployee bilan BIR XIL so'rov.
console.log("\n=== Xodimlarga chiqarilgan avans/oylik (payrollSources mantiqi) ===");
const paid = await te.find({ txType: "payOut", status: { $ne: "cancelled" }, txName: { $regex: "avans|oylik", $options: "i" } }).toArray();
const byEmp = new Map();
for (const r of paid) {
  const k = String(r.studentName ?? "").trim();
  byEmp.set(k, (byEmp.get(k) ?? 0) + Math.abs(r.amount));
}
console.log(`  ${paid.length} ta yozuv, ${byEmp.size} xodim, jami ${fmt([...byEmp.values()].reduce((a, b) => a + b, 0))}`);
const emps = await db.collection("hr_employees").find({}).toArray();
const empNames = new Set(emps.map((e) => String(e.name).trim().toLowerCase()));
for (const [k, v] of [...byEmp].sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(28)} ${fmt(v).padStart(14)}  ${empNames.has(k.toLowerCase()) ? "✓ xodim topildi" : "✗ XODIM TOPILMADI"}`);

// loadCollectedByTeacher bilan BIR XIL so'rov.
console.log("\n=== O'qituvchi orqali tushgan pul (foizli oylik asosi) ===");
const coll = await te.find({ txType: "payIn", status: { $ne: "cancelled" }, teacherName: { $nin: ["", null] } }).toArray();
const byT = new Map();
for (const r of coll) byT.set(r.teacherName, (byT.get(r.teacherName) ?? 0) + Math.abs(r.amount));
console.log(`  ${coll.length} ta to'lov, ${byT.size} ustoz`);
for (const [k, v] of [...byT].sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(28)} ${fmt(v).padStart(12)}  ${empNames.has(k.toLowerCase()) ? "✓" : "✗ XODIM TOPILMADI"}`);

console.log("\n=== Oylar bo'yicha (kirim/chiqim, ko'chirmasiz) ===");
for (const g of await te.aggregate([
  { $match: { txType: { $ne: "transfer" }, status: { $ne: "cancelled" } } },
  { $group: { _id: { m: { $substr: ["$date", 0, 7] }, t: "$txType" }, n: { $sum: 1 }, s: { $sum: "$amount" } } },
  { $sort: { "_id.m": 1 } },
]).toArray()) console.log(`  ${g._id.m}  ${g._id.t.padEnd(7)} ${String(g.n).padStart(4)} ta ${fmt(g.s).padStart(18)}`);

console.log("\n=== transactions (hisobotlar manbai) ===");
console.log("  jami:", await db.collection("transactions").countDocuments());
for (const g of await db.collection("transactions").aggregate([{ $group: { _id: "$category", n: { $sum: 1 }, s: { $sum: "$amount" } } }, { $sort: { s: 1 } }]).toArray())
  console.log(`    ${String(g._id).padEnd(20)} ${String(g.n).padStart(4)} ta ${fmt(g.s).padStart(18)}`);

console.log("\n=== Yaxlitlik ===");
console.log("  sync_outbox:", await db.collection("sync_outbox").countDocuments(), "(0 bo'lishi shart)");
console.log("  before/after uzilishi:",
  (await te.aggregate([{ $match: { status: { $ne: "cancelled" } } }, { $project: { d: { $subtract: ["$after", { $add: ["$before", "$amount"] }] } } }, { $match: { d: { $ne: 0 } } }, { $count: "n" }]).toArray())[0]?.n ?? 0, "ta");
await client.close();
