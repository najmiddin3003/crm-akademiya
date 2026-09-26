// FAQAT O'QIYDI. O'qituvchining FOIZLI oyligi to'g'ri hisoblanyaptimi:
// xulosadagi "hisoblangan" ni jurnaldan mustaqil qayta hisoblab
// solishtiradi.
//
// Qoida (lib/payrollSources.ts): o'qituvchining oyi bo'yicha kirimlar
// yig'indisi × uning foizi. Kirim `teacherName` bo'yicha biriktiriladi,
// oy esa `periodMonth` bo'yicha (to'lov SANASI emas — sentabrda kelgan
// pul avgust darslari uchun bo'lishi mumkin).
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);

const MONTH = "2026-09";

const teachers = await db.collection("hr_employees")
  .find({ turi: /o'qituvchi|oqituvchi|teacher/i }, { projection: { _id: 0, id: 1, name: 1, percent: 1, turi: 1 } })
  .toArray();
const pct = new Map(teachers.map((t) => [String(t.name ?? "").trim(), t.percent]));

// Oy bo'yicha kirimlar (bekor qilinganlar chiqariladi).
const rows = await db.collection("transaction_entries").aggregate([
  { $match: { txType: "payIn", status: { $ne: "cancelled" }, periodMonth: MONTH, teacherName: { $nin: ["", null] } } },
  // Ustoz foizi TO'LIQ narxdan: tanga evaziga chegirma (`discountSom`) ham
  // bazaga kiradi — lib/payrollSources.ts → loadCollectedByTeacher bilan bir xil.
  { $group: { _id: "$teacherName", baza: { $sum: { $add: ["$amount", { $ifNull: ["$discountSom", 0] }] } }, n: { $sum: 1 } } },
  { $sort: { baza: -1 } },
]).toArray();

console.log(`oy: ${MONTH}\n`);
console.log("o'qituvchi                 foiz   kirimlar bazasi   hisoblangan (baza x foiz)   yozuv");
let total = 0;
for (const r of rows) {
  const name = String(r._id).trim();
  const p = pct.get(name);
  const pNum = Number(String(p ?? "").replace(/[^\d]/g, "")) || 0;
  const calc = Math.round(r.baza * pNum / 100);
  total += calc;
  console.log(
    `${name.padEnd(26)} ${String(pNum + "%").padStart(4)}   ${String(r.baza).padStart(15)}   ` +
    `${String(calc).padStart(25)}   ${String(r.n).padStart(5)}${p === undefined ? "   <- hr_employees da foiz YO'Q" : ""}`,
  );
}
console.log(`\njami hisoblangan foiz: ${total.toLocaleString("ru-RU")}`);

// `periodMonth` yo'q yozuvlar bormi — ular hech kimning oyiga tushmaydi.
const noMonth = await db.collection("transaction_entries").countDocuments({
  txType: "payIn", status: { $ne: "cancelled" }, teacherName: { $nin: ["", null] },
  $or: [{ periodMonth: { $exists: false } }, { periodMonth: "" }, { periodMonth: null }],
});
console.log(`\n"Qaysi oy uchun" belgilanmagan kirimlar (o'qituvchili): ${noMonth}`);

// O'qituvchisiz kirimlar — ular hech qaysi foizga kirmaydi.
const noTeacher = await db.collection("transaction_entries").aggregate([
  { $match: { txType: "payIn", status: { $ne: "cancelled" }, $or: [{ teacherName: "" }, { teacherName: null }, { teacherName: { $exists: false } }] } },
  { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: "$amount" } } },
]).toArray();
console.log(`O'qituvchi belgilanmagan kirimlar: ${noTeacher[0]?.n ?? 0} ta, ${(noTeacher[0]?.sum ?? 0).toLocaleString("ru-RU")} so'm`);
console.log("  (bular hech bir o'qituvchining foiziga kirmaydi)");

await c.close();
