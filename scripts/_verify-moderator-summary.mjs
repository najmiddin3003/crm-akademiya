// FAQAT O'QISH — moderator-summary KpiTab bilan bir xil son beradimi?
import fs from "fs";
import { MongoClient } from "mongodb";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/)
 .filter(l=>l.trim()&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c=new MongoClient(env.MONGODB_URI,{maxPoolSize:5}); await c.connect();
const col=c.db(env.MONGODB_DB||undefined).collection("transaction_entries");
const rx=(m)=>({ $regex: "^" + m + "$", $options: "i" });

// Har bir moderator + chetlari bo'shliqli va boshqa registrdagi variantlar
const mods = await col.distinct("moderator", { moderator: { $nin: ["", null] } });
const cases = [...mods, "  Nilufar Sharipova  ", "NILUFAR SHARIPOVA", "yo'q-bunday-odam"];

let fail = 0;
console.log("moderator".padEnd(28), "soni".padStart(7), "summa".padStart(17), "o'quvchi".padStart(9), "  holat");
console.log("-".repeat(76));
for (const name of cases) {
  const base = { moderator: rx(name.trim()), studentName: { $nin: ["", null] }, txType: "payIn" };

  // ESKI YO'L: hammasini olib, KpiTab dagidek brauzerda hisoblash
  const payments = await col.find(base).toArray();
  const live = payments.filter((e) => e.status !== "cancelled");
  const oldN = live.length;
  const oldSum = live.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const oldUniq = new Set(live.map((e) => e.studentName)).size;

  // YANGI YO'L: aggregation (route bilan bir xil)
  const r = (await col.aggregate([
    { $match: { ...base, status: { $ne: "cancelled" } } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" }, students: { $addToSet: "$studentName" } } },
    { $project: { _id: 0, count: 1, amount: 1, students: { $size: "$students" } } },
  ]).toArray())[0] ?? {};
  const newN = Number(r.count ?? 0), newSum = Number(r.amount ?? 0), newUniq = Number(r.students ?? 0);

  const ok = oldN === newN && oldSum === newSum && oldUniq === newUniq;
  if (!ok) fail++;
  console.log(JSON.stringify(name).slice(0,27).padEnd(28), String(oldN).padStart(7),
              oldSum.toLocaleString("ru-RU").padStart(17), String(oldUniq).padStart(9),
              "  ", ok ? "MOS ✓" : `FARQ ✗ (${newN}/${newSum}/${newUniq})`);
}
console.log(fail===0 ? "\n==> HAMMASI MOS." : `\n==> ${fail} ta FARQ!`);
await c.close(); process.exit(fail?1:0);
