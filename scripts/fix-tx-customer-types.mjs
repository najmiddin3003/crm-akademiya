// BIR MARTALIK MA'LUMOT KO'CHIRISHI — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/fix-tx-customer-types.mjs            # quruq yurish
//   node scripts/fix-tx-customer-types.mjs --apply    # haqiqatan yozadi
//
// ------------------------------------------------------------------
// NIMA VA NEGA
//
// "Mijoz" (`transaction_types.customerType`) endi KO'P TANLOVLI —
// formada katakchalar, bazada RO'YXAT (lib/txTarget.ts izohiga qarang).
// Kod ikkala shaklni ham o'qiydi, ya'ni bu skript MAJBURIY EMAS... bitta
// holatdan tashqari:
//
//   #1 "Kurs to'lovi (oylik)" — customerType: "O'quvchilar".
//
// Yangi qoida bo'yicha bu "faqat o'quvchi tanlovi" degani, ya'ni Kirim
// oynasidan O'QITUVCHI tanlovi YO'QOLADI. Pul kassaga baribir kiradi,
// lekin yozuvda `teacherName` bo'sh qoladi va o'qituvchining FOIZLI
// OYLIGI aynan shu maydon bo'yicha hisoblanadi (lib/payrollSources.ts).
// Ya'ni buzilish JIMGINA bo'lardi va faqat oy oxirida ma'lum bo'lardi —
// holbuki bu tur jurnaldagi eng ko'p ishlatilgani (50 yozuv).
//
// Shu bois #1 ga "Xodim" ham qo'shiladi: oyna BUGUNGIDEK ikkala tanlovni
// ko'rsatadi. Keraksiz bo'lsa, admin katakchani formadan bir bosishda
// o'chiradi.
//
// TEGILMAYDIGANLAR (ataylab):
//   #3  "Imtihon to'lovi"  -> ["O'quvchilar"]  — markaz aynan shuni so'radi
//                             (o'qituvchi tanlovi chiqmasin).
//   #13 "Boshqa kirim"     -> ["Boshqa"]       — "hech kim" degani; bu
//                             turda hozircha bitta ham yozuv yo'q.
//   #43 "Yangi o'quvchi jalb qilgani uchun" (chiqim, "Boshqa") — ilgari
//                             NOMIDAGI "o'quvchi" so'zi tufayli o'quvchi
//                             tanlovi chiqardi, endi chiqmaydi. Yozuv yo'q.
//
// QAYTARISH: skript eski qiymatlarni zaxira faylga yozadi; qaytarish uchun
// har bir hujjatga o'sha satrni `$set` qilish kifoya.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(env.MONGODB_DB);
const col = db.collection("transaction_types");

const rows = await col
  .find({}, { projection: { _id: 0, id: 1, name: 1, mainType: 1, customerType: 1 } })
  .sort({ id: 1 })
  .toArray();

/** Faqat shu turga qo'shimcha katakcha qo'yiladi (yuqoridagi izohga qarang). */
const ADD_EMPLOYEE_TO = new Set([1]);

const plan = [];
for (const r of rows) {
  const before = r.customerType;
  const list = Array.isArray(before) ? [...before] : (before ? [String(before)] : []);
  if (ADD_EMPLOYEE_TO.has(r.id) && !list.includes("Xodim")) list.push("Xodim");
  // Tartib formadagi bilan bir xil bo'lsin.
  const order = ["Boshqa", "O'quvchilar", "Xodim", "Uchinchi shaxs"];
  const after = order.filter((o) => list.includes(o));
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  plan.push({ id: r.id, name: r.name, mainType: r.mainType, before, after, changed });
}

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log(`baza: ${db.databaseName}   turlar: ${rows.length}\n`);
for (const p of plan) {
  const mark = p.changed ? "->" : "  ";
  console.log(
    `  #${String(p.id).padStart(3)} ${String(p.mainType).padEnd(7)} ${String(p.name).slice(0, 38).padEnd(40)} ` +
    `${JSON.stringify(p.before).padEnd(20)} ${mark} ${JSON.stringify(p.after)}`,
  );
}
const changed = plan.filter((p) => p.changed);
console.log(`\no'zgaradigan hujjat: ${changed.length}`);

const backupPath = "C:/Users/zovaxx/Desktop/tx-customer-types-zaxira.json";
fs.writeFileSync(backupPath, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
console.log("zaxira:", backupPath);

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
} else {
  let n = 0;
  for (const p of changed) {
    const r = await col.updateOne({ id: p.id }, { $set: { customerType: p.after } });
    n += r.modifiedCount;
  }
  console.log(`\nyangilandi: ${n}`);
  console.log("\n=== TEKSHIRUV ===");
  const after = await col
    .find({}, { projection: { _id: 0, id: 1, name: 1, customerType: 1 } })
    .sort({ id: 1 })
    .toArray();
  for (const r of after) {
    console.log(`  #${String(r.id).padStart(3)} ${JSON.stringify(r.customerType).padEnd(34)} ${r.name}`);
  }
}

await client.close();
