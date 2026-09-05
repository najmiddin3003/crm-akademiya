// FAQAT O'QIYDI. Edutizim arxivi PUL HISOBIGA tegmasligini tekshiradi.
//
// Markaz talabi: "hech qanday o'qituvchilar oyligiga ta'sir qilmasin,
// hech qanday boshqa yerlarga pul qo'shilib yoki kamayib ketmasin".
// Kafolat TUZILMAVIY: arxiv alohida kolleksiyada va uni birorta hisobot
// so'ramaydi. Shu skript o'sha da'voni har safar qayta tekshiradi.
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

const legacy = await db.collection("legacy_entries").countDocuments();
const live = await db.collection("transaction_entries").countDocuments();
console.log(`arxiv (legacy_entries):        ${legacy}`);
console.log(`jonli (transaction_entries):   ${live}`);

// 1) Arxiv yozuvida `cashboxId` BO'LMASLIGI kerak — kelajakda kimdir
//    kassa bo'yicha qidirsa, bu yozuvlar unga tushmasin.
const withBox = await db.collection("legacy_entries").countDocuments({ cashboxId: { $exists: true } });
console.log(`\narxivda cashboxId bor yozuv:   ${withBox}  (0 bo'lishi shart)`);

// 2) Jonli tarixda faqat 09.2026 turishi kerak — arxiv u yerga oqib
//    tushmaganini shu ko'rsatadi.
const liveMonths = await db.collection("transaction_entries").aggregate([
  { $group: { _id: { $substrCP: [{ $toString: "$date" }, 0, 7] }, n: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]).toArray();
console.log("jonli tarix oylari:", JSON.stringify(liveMonths.map((r) => `${r._id}:${r.n}`)));

// 3) Kassa balanslari — arxivdan keyin ham o'z holida.
console.log("\nkassalar:");
for (const b of await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1, balance: 1 } }).sort({ id: 1 }).toArray()) {
  console.log(`  #${b.id} ${String(b.name).padEnd(32)} ${Number(b.balance).toLocaleString("ru-RU")}`);
}

// 4) Navbat bo'sh — arxiv Sheets/Telegram'ga chiqmaydi.
console.log("\nsync_outbox:", await db.collection("sync_outbox").countDocuments(), "(arxiv navbatga qo'yilmagan)");

// 5) Arxivning o'zi haqida qisqacha.
const [agg] = await db.collection("legacy_entries").aggregate([
  { $group: { _id: null, sum: { $sum: "$amount" }, min: { $min: "$date" }, max: { $max: "$date" } } },
]).toArray();
console.log(`\narxiv oralig'i: ${agg?.min} … ${agg?.max}`);
console.log("arxiv bog'lanmagan yozuvlari:", await db.collection("legacy_entries").countDocuments({ pupilId: null }));

await c.close();
