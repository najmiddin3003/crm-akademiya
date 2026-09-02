// BAZANI BOSHQA ATLAS KLASTERIGA KO'CHIRADI (Singapur -> Frankfurt).
//
//   set TARGET_MONGODB_URI=mongodb+srv://...
//   node scripts/migrate-cluster.mjs            # quruq yurish
//   node scripts/migrate-cluster.mjs --apply    # haqiqatan ko'chiradi
//
// ------------------------------------------------------------------
// NIMA UCHUN
//
// Kod Vercel'da `sin1` (Singapur), Atlas ham Singapurda edi. Toshkentdan
// o'lchandi (bitta borib-kelish, mediana):
//     Singapur   157 ms
//     Frankfurt  114 ms   <- 43 ms tezroq, har bir so'rovda
//
// Server bilan baza BIR MINTAQADA turishi SHART. Ikkalasi ayri tushsa
// har bir DB so'rovi ~2 ms o'rniga ~157 ms bo'ladi va sayt hozirgidan
// ANCHA sekinlashadi — bitta sahifa o'nlab so'rov qiladi.
//
// ------------------------------------------------------------------
// TARTIB (buzilmasin)
//
//   1. Frankfurt (eu-central-1) da yangi Atlas klasteri yaratiladi.
//   2. Yangi klasterda foydalanuvchi va Network Access (0.0.0.0/0 yoki
//      Vercel IP'lari) sozlanadi.
//   3. SHU SKRIPT ishlatiladi — ma'lumot ko'chiriladi (4 MB, soniyalar).
//   4. Kassaga yozuv kiritish TO'XTATILADI (bir necha daqiqa).
//   5. Skript QAYTA ishlatiladi (--apply --force) — oxirgi o'zgarishlar
//      ham ko'chsin.
//   6. Vercel'da MONGODB_URI yangi klasterga o'zgartiriladi.
//   7. Deploy qilinadi — `vercel.json` dagi "fra1" bilan BIRGA.
//
// 6 va 7 BIRGA bo'lishi kerak: faqat bittasi o'zgarsa server va baza
// ayri mintaqada qolib, sayt sekinlashadi.
//
// Eski klaster DARHOL o'chirilmasin — bir necha kun turib tursin, orqaga
// qaytish kerak bo'lsa ishlatiladi.

import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const SRC = env.MONGODB_URI;
const DST = process.env.TARGET_MONGODB_URI;
const DBNAME = env.MONGODB_DB || undefined;

if (!DST) {
  console.error("TARGET_MONGODB_URI berilmagan.\n");
  console.error("  Windows PowerShell:  $env:TARGET_MONGODB_URI = 'mongodb+srv://...'");
  console.error("  Git Bash:            export TARGET_MONGODB_URI='mongodb+srv://...'");
  process.exit(1);
}
if (SRC === DST) {
  console.error("Manba va manzil bir xil — hech narsa qilinmadi.");
  process.exit(1);
}

const hostOf = (uri) => (uri.match(/@([^/?]+)/) || [])[1] || "?";
console.log(`Manba : ${hostOf(SRC)}`);
console.log(`Manzil: ${hostOf(DST)}`);
console.log(APPLY ? "REJIM: --apply (YOZADI)\n" : "REJIM: quruq yurish (hech narsa yozilmaydi)\n");

const srcClient = new MongoClient(SRC, { maxPoolSize: 5 });
const dstClient = new MongoClient(DST, { maxPoolSize: 5 });
await srcClient.connect();
await dstClient.connect();
const src = srcClient.db(DBNAME);
const dst = dstClient.db(DBNAME);
console.log(`Baza nomi: ${src.databaseName} -> ${dst.databaseName}\n`);

const cols = (await src.listCollections().toArray())
  .filter((c) => c.type !== "view")
  .map((c) => c.name)
  .sort();

// Manzil bo'sh bo'lmasa to'xtaymiz — ustiga yozib, ikki xil ma'lumot
// aralashib ketmasin. Takroriy ko'chirishda --force beriladi va manzil
// kolleksiyasi HAR SAFAR tozalanadi.
const dstCols = (await dst.listCollections().toArray()).map((c) => c.name);
const dstNonEmpty = [];
for (const name of dstCols) {
  const n = await dst.collection(name).estimatedDocumentCount();
  if (n > 0) dstNonEmpty.push(`${name} (${n})`);
}
if (dstNonEmpty.length > 0 && !FORCE) {
  console.error("MANZIL BAZASI BO'SH EMAS:");
  for (const s of dstNonEmpty.slice(0, 10)) console.error("  " + s);
  if (dstNonEmpty.length > 10) console.error(`  ... yana ${dstNonEmpty.length - 10} ta`);
  console.error("\nUstiga yozish uchun --force qo'shing (manzil kolleksiyalari TOZALANADI).");
  await srcClient.close(); await dstClient.close();
  process.exit(1);
}

let totalDocs = 0, totalIdx = 0;
const report = [];

for (const name of cols) {
  const srcCol = src.collection(name);
  const count = await srcCol.estimatedDocumentCount();
  const idx = (await srcCol.indexes()).filter((i) => i.name !== "_id_");
  totalDocs += count;
  totalIdx += idx.length;
  report.push({ name, count, idx: idx.length });

  if (!APPLY) continue;

  const dstCol = dst.collection(name);
  if (FORCE) await dstCol.deleteMany({});

  if (count > 0) {
    // 4 MB baza — bo'laklab o'qishning hojati yo'q, lekin katta
    // kolleksiya bo'lsa ham xotiraga sig'ishi uchun 1000 talab yoziladi.
    const docs = await srcCol.find({}).toArray();
    for (let i = 0; i < docs.length; i += 1000) {
      await dstCol.insertMany(docs.slice(i, i + 1000), { ordered: false });
    }
  }
  // Indekslar HAM ko'chiriladi. Ular bo'lmasa sayt ishlaydi, lekin
  // so'rovlar butun kolleksiyani skanerlaydi — ya'ni "tezlashtiraman"
  // deb ko'chirish sekinlashtirishga aylanardi.
  for (const i of idx) {
    const { key, name: iname, v, ...opts } = i;
    void v;
    try { await dstCol.createIndex(key, { name: iname, ...opts }); }
    catch (e) { console.log(`  ! indeks ${name}.${iname}: ${e.codeName || e.message}`); }
  }
}

console.log("=== KOLLEKSIYALAR ===");
for (const r of report.filter((r) => r.count > 0)) {
  console.log(`  ${r.name.padEnd(28)} ${String(r.count).padStart(6)} hujjat, ${r.idx} indeks`);
}
const empty = report.filter((r) => r.count === 0).length;
console.log(`  (+ ${empty} ta bo'sh kolleksiya)`);
console.log(`\n  JAMI: ${cols.length} kolleksiya, ${totalDocs} hujjat, ${totalIdx} indeks`);

if (!APPLY) {
  console.log("\nQuruq yurish tugadi. Ko'chirish uchun --apply qo'shing.");
  await srcClient.close(); await dstClient.close();
  process.exit(0);
}

// ---- TEKSHIRUV: har bir kolleksiya soni mos keldimi ----
console.log("\n=== TEKSHIRUV ===");
let bad = 0;
for (const r of report) {
  const n = await dst.collection(r.name).countDocuments({});
  const m = await src.collection(r.name).countDocuments({});
  if (n !== m) { console.log(`  XATO ${r.name}: manba ${m}, manzil ${n}`); bad++; }
}
console.log(bad === 0
  ? `  Hamma kolleksiya mos keldi (${cols.length} ta).`
  : `  ${bad} ta kolleksiyada FARQ BOR — ko'chirish TUGALLANMAGAN.`);

await srcClient.close();
await dstClient.close();
process.exit(bad === 0 ? 0 : 1);
