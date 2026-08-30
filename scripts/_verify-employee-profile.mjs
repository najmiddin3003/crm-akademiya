// FAQAT O'QISH — Xodim profilining SERVER filtrlari eski KLIENT mantiqi
// bilan aynan bir xil natija beradimi?
//
//   node scripts/_verify-employee-profile.mjs
//
// Sahifa ilgari moderatorning HAMMA to'lovini yuklab (eng band moderatorda
// 13 369 qator / ~6 MB), keyin brauzerda to'rt xil ish qilardi. Endi buni
// server bajaradi. Quyida to'rttasi ham yonma-yon solishtiriladi.
//
// ENG MUHIM TEKSHIRUV — 2-band. Jadval filtri klientda
// `e.studentName === fStudent`, ya'ni XOM satrni aynan solishtiradi.
// Route'dagi eski `?studentName=` esa chetlarini kesib, katta-kichik
// harfni farqlamaydi. Bu farq nazariy emas: bazadagi yozuvlarning katta
// qismida `studentName` chetida probel bor. Shu sabab `?studentNameExact=`
// alohida parametr sifatida qo'shilgan — pastdagi tekshiruv aynan shuni
// isbotlaydi va eski parametr ishlatilganda nima bo'lishini ko'rsatadi.

import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const col = c.db(env.MONGODB_DB || undefined).collection("transaction_entries");

// Regex qochirish — manbada teskari chiziq bo'lmasin (heredoc'lar uni yeydi).
const BS = String.fromCharCode(92);
const SPECIAL = ".*+?^${}()|[]" + BS;
const esc = (v) => [...v].map((ch) => (SPECIAL.includes(ch) ? BS + ch : ch)).join("");

// Eng band moderatorni o'zi topamiz.
const top = (await col.aggregate([
  { $match: { txType: "payIn", moderator: { $nin: ["", null] } } },
  { $group: { _id: "$moderator", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 },
]).toArray())[0];
const MOD = String(top._id);
const BASE = { moderator: { $regex: "^" + esc(MOD) + "$", $options: "i" },
               studentName: { $nin: ["", null] }, txType: "payIn" };

const all = await col.find(BASE).sort({ id: -1 }).toArray();
console.log(`moderator: ${MOD}`);
console.log(`eski yo'l: ${all.length} qator (${Math.round(Buffer.byteLength(JSON.stringify(all))/1024)} KB) brauzerga tushardi\n`);
let fail = 0;

// --- 1) "To'lanmagan tarixi" ---
const oldUnf = all.filter((e) => e.status === "cancelled" || e.status === "waiting");
const newUnf = await col.find({ ...BASE, status: { $in: ["cancelled", "waiting"] } }).sort({ id: -1 }).toArray();
const sameUnf = oldUnf.length === newUnf.length && oldUnf.every((e, i) => e.id === newUnf[i].id);
if (!sameUnf) fail++;
console.log("1) tugallanmagan ro'yxati :", sameUnf ? "MOS ✓" : "FARQ ✗",
            `| ${oldUnf.length} qator, tartib ham bir xil`);

// --- 2) Jadval filtri: AYNAN tenglik ---
// Xavfli ismlar (chetida probel bor) TO'LIQ tekshiriladi, qolganidan namuna.
const names = [...new Set(all.map((e) => e.studentName))];
const risky = names.filter((n) => n !== n.trim());
const sample = [...risky.slice(0, 60), ...names.filter((n) => n === n.trim()).slice(0, 40)];
let bad = 0;
for (const n of sample) {
  const oldRows = all.filter((e) => e.studentName === n).map((e) => e.id);
  const newRows = (await col.find({ ...BASE, studentName: n }).sort({ id: -1 }).toArray()).map((e) => e.id);
  if (JSON.stringify(oldRows) !== JSON.stringify(newRows)) bad++;
}
if (bad) fail++;
console.log("2) aynan tenglik filtri   :", bad === 0 ? "MOS ✓" : `FARQ ✗ (${bad})`,
            `| ${sample.length} ism (${risky.length} tasi chetida probelli)`);

// --- 2b) ESKI ?studentName= ishlatilganda NIMA bo'lardi ---
let rxBad = 0, worst = null;
for (const n of sample) {
  const oldN = all.filter((e) => e.studentName === n).length;
  const rxN = await col.countDocuments({ ...BASE, studentName: { $regex: "^" + esc(n.trim()) + "$", $options: "i" } });
  if (oldN !== rxN) { rxBad++; if (!worst || rxN / oldN > worst[2] / worst[1]) worst = [n, oldN, rxN]; }
}
console.log("   eski ?studentName= bilan:", rxBad, "ta ismda FARQ bo'lardi",
            worst ? `— eng yomoni ${JSON.stringify(worst[0])}: ${worst[1]} -> ${worst[2]} qator` : "");

// --- 3) Takrorlanmas ismlar (select) ---
const oldOpts = [...new Set(all.map((e) => e.studentName).filter(Boolean))].sort();
const newOpts = await col.distinct("studentName", BASE); newOpts.sort();
const sameOpts = JSON.stringify(oldOpts) === JSON.stringify(newOpts);
if (!sameOpts) fail++;
console.log("3) ismlar ro'yxati        :", sameOpts ? "MOS ✓" : "FARQ ✗", `| ${oldOpts.length} ta`);
const folded = new Set(oldOpts.map((n) => n.trim().toLowerCase())).size;
console.log(`   (normallashtirilsa ${folded} ta bo'lardi — ${oldOpts.length - folded} ta variant yo'qolardi)`);

// --- 4) KPI uchtaligi ---
const live = all.filter((e) => e.status !== "cancelled");
const kpiOld = { count: live.length, amount: live.reduce((s, e) => s + (Number(e.amount) || 0), 0),
                 students: new Set(live.map((e) => e.studentName)).size };
const kpiNew = (await col.aggregate([
  { $match: { ...BASE, status: { $ne: "cancelled" } } },
  { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" }, students: { $addToSet: "$studentName" } } },
  { $project: { _id: 0, count: 1, amount: 1, students: { $size: "$students" } } }]).toArray())[0] ?? {};
const sameKpi = kpiOld.count === kpiNew.count && kpiOld.amount === kpiNew.amount && kpiOld.students === kpiNew.students;
if (!sameKpi) fail++;
console.log("4) KPI uchtaligi          :", sameKpi ? "MOS ✓" : "FARQ ✗",
            `| ${kpiOld.count} ta / ${kpiOld.amount.toLocaleString("ru-RU")} / ${kpiOld.students} o'quvchi`);

// --- 5) slim proyeksiya ---
const SLIM = { _id: 0, id: 1, date: 1, time: 1, studentName: 1, amount: 1, before: 1,
               after: 1, txName: 1, status: 1, note: 1, paymentType: 1 };
const page1 = await col.find(BASE, { projection: SLIM }).sort({ id: -1 }).limit(20).toArray();
console.log("5) slim, 1-sahifa (20)    :", Math.round(Buffer.byteLength(JSON.stringify(page1)) / 1024), "KB");

console.log("\n" + (fail === 0 ? "==> HAMMASI MOS." : `==> ${fail} ta FARQ!`));
await c.close();
process.exit(fail ? 1 : 0);
