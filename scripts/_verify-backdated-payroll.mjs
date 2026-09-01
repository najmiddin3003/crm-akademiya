// FAQAT O'QISH — o'tgan oyga sana qo'yib kiritilgan KIRIMlar oylik
// hisobidan tushib qolyaptimi?
//
//   node scripts/_verify-backdated-payroll.mjs
//
// Muammo: kassir Kirim oynasida sanani o'tgan oyga qo'yadi. Yozuvning
// `date` maydoni o'sha o'tgan oyni ko'rsatadi (to'g'ri), lekin oylik
// hisobi (lib/payrollSources.ts -> buildPayrollRows) DOIM joriy oyni
// oladi va o'tgan oyni ko'rsatadigan ekran umuman yo'q. Ya'ni pul
// bazada bor, hisobda esa hech qayerda ko'rinmaydi.
//
// Quyida shu yozuvlar sanab chiqiladi: `createdAt` (haqiqiy yozilgan on)
// va `date` (kassir qo'ygan sana) turli oyga tushganlari.

import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await c.connect();
const db = c.db(env.MONGODB_DB || undefined);
const col = db.collection("transaction_entries");

const money = (n) => Math.round(n).toLocaleString("ru-RU");

// ---- 1. Orqaga sanalangan kirimlar --------------------------------
// `createdAt` — ISO vaqt tamg'asi (yozuv bazaga tushgan on).
// `date`      — "YYYY-MM-DD", kassir tanlagan sana.
const rows = await col
  .find({
    txType: "payIn",
    status: { $ne: "cancelled" },
    createdAt: { $exists: true },
    date: { $exists: true },
  })
  .project({ date: 1, createdAt: 1, amount: 1, teacherName: 1, studentName: 1, _id: 0 })
  .toArray();

const backdated = rows.filter((r) => {
  const entered = String(r.createdAt).slice(0, 7);   // yozilgan oy
  const dated = String(r.date).slice(0, 7);          // qo'yilgan oy
  return entered && dated && dated < entered;
});

console.log(`Jami kirim yozuvlari (createdAt bor): ${rows.length}`);
console.log(`Orqaga sanalanganlari: ${backdated.length}`);

if (backdated.length === 0) {
  console.log("\nOrqaga sanalangan kirim topilmadi — muammo hozircha faqat nazariy.");
} else {
  // ---- 2. Qaysi oy va qaysi o'qituvchi zarar ko'rgan ---------------
  const byMonth = new Map();
  for (const r of backdated) {
    const m = String(r.date).slice(0, 7);
    const cur = byMonth.get(m) ?? { n: 0, sum: 0, teachers: new Map() };
    cur.n += 1;
    cur.sum += Math.abs(Number(r.amount) || 0);
    const t = String(r.teacherName ?? "").trim();
    if (t) cur.teachers.set(t, (cur.teachers.get(t) ?? 0) + Math.abs(Number(r.amount) || 0));
    byMonth.set(m, cur);
  }

  console.log("\nQaysi oyga yozilgan (o'sha oy oyligiga kirishi kerak edi):");
  for (const [m, v] of [...byMonth].sort()) {
    console.log(`  ${m}: ${v.n} ta yozuv, ${money(v.sum)} so'm`);
    for (const [t, s] of [...v.teachers].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`      ustoz "${t}" -> ${money(s)} so'm`);
    }
    const noTeacher = v.sum - [...v.teachers.values()].reduce((s, x) => s + x, 0);
    if (noTeacher > 0) console.log(`      (ustozsiz: ${money(noTeacher)} so'm — bu baribir hech kimning oyligiga kirmaydi)`);
  }

  // ---- 3. O'sha oy allaqachon yopilganmi? --------------------------
  const runs = await db.collection("salary_runs").find({}).project({ month: 1, id: 1, createdAt: 1, _id: 0 }).toArray();
  const closed = new Set(runs.map((r) => String(r.month ?? "")).filter(Boolean));
  console.log("\nOylik chiqarilgan oylar:", closed.size ? [...closed].sort().join(", ") : "(hech biri)");
  for (const m of [...byMonth.keys()].sort()) {
    console.log(`  ${m}: ${closed.has(m) ? "YOPILGAN — qayta hisoblash kerak" : "ochiq — oy tanlagich bo'lsa ko'rinardi"}`);
  }
}

// ---- 4. Joriy oy hisobi nimani ko'radi ------------------------------
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

for (const m of [prevMonth, thisMonth]) {
  const agg = await col.aggregate([
    { $match: { txType: "payIn", status: { $ne: "cancelled" }, date: { $regex: `^${m}-` }, teacherName: { $nin: ["", null] } } },
    { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: { $abs: "$amount" } } } },
  ]).toArray();
  const v = agg[0] ?? { n: 0, sum: 0 };
  console.log(`\n${m} oyidagi ustozli kirim: ${v.n} ta, ${money(v.sum)} so'm` +
    (m === thisMonth ? "  <- buildPayrollRows() FAQAT shuni ko'radi" : "  <- buni ko'rsatadigan ekran yo'q"));
}

await c.close();
