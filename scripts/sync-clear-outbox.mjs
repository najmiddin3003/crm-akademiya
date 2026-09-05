// BIR MARTALIK — sinxronizatsiya NAVBATINI tozalaydi.
//
//   node scripts/sync-clear-outbox.mjs            # quruq yurish
//   node scripts/sync-clear-outbox.mjs --apply    # haqiqatan o'chiradi
//
// ------------------------------------------------------------------
// NIMA VA NEGA (markaz qarori, 2026-09-05)
//
// 02.09 dan beri navbatdagi HAR BIR yozuv "Google Sheets sozlanmagan"
// xatosi bilan yiqilgan (production'da muhit o'zgaruvchilari yo'q).
// Yig'ilib 117 ta bo'ldi, ulardan 64 tasi Telegram'ga hali yuborilmagan
// to'lov.
//
// Sozlamalar to'g'rilangan zahoti navbat bo'shatilsa, guruhga BIRDANIGA
// 64 ta eski xabar yog'ilardi. Markaz: "telegram guruhga bundan keyingi
// yangi to'lovlar tushsin" — ya'ni eskilari kerak emas.
//
// JADVALGA TA'SIR QILMAYDI. Qatorlar navbat orqali emas, SOLISHTIRISH
// orqali ham tushadi (lib/sync/reconcile.ts baza bilan jadvalni tenglaydi
// va u Telegram'ga hech narsa yubormaydi). Ya'ni navbatni tozalash
// jadvaldagi ma'lumotni yo'qotmaydi — faqat "guruhga xabar bering"
// topshirig'ini bekor qiladi.
//
// O'CHIRILADI, "bajarildi" deb BELGILANMAYDI: bekor qilish yo'li
// (transaction-entries/[id]/cancel) yozuv guruhga e'lon qilinganmi-yo'qmi
// degan savolga aynan shu navbatdan javob oladi. "Bajarildi" deb
// qo'yilsa, keyinchalik bekor qilinganda guruhga hech qachon e'lon
// qilinmagan to'lov haqida "bekor qilindi" xabari ketardi.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const col = db.collection("sync_outbox");

const rows = await col.find({}, { projection: { _id: 0 } }).toArray();
console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("navbatdagi yozuvlar:", rows.length);
for (const r of await col.aggregate([
  { $group: { _id: { k: "$kind", s: "$status" }, n: { $sum: 1 } } },
  { $sort: { n: -1 } },
]).toArray()) {
  console.log(`  ${String(r._id.k).padEnd(9)} ${String(r._id.s).padEnd(8)} ${r.n}`);
}

const path = `C:/Users/zovaxx/Desktop/sync-outbox-zaxira-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log("\nzaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
} else {
  const r = await col.deleteMany({});
  console.log(`\no'chirildi: ${r.deletedCount}`);
  console.log("qolgan:", await col.countDocuments());
}

await c.close();
