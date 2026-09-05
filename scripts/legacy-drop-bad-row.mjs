// BIR MARTALIK — arxivdagi (`legacy_entries`) YAROQSIZ qatorni o'chiradi.
//
//   node scripts/legacy-drop-bad-row.mjs            # quruq yurish
//   node scripts/legacy-drop-bad-row.mjs --apply    # o'chiradi
//
// ══════════════════════════════════════════════════════════════════
// NIMA VA NEGA (markaz qarori, 2026-09-05)
//
// 22.12.2025 da edutizimda 27 000 000 000 so'mlik XATO kirim yozilgan
// (Abdulaxat Abdullayev, pupilId 14161). O'sha kuni u "Xato kirim" nomli
// CHIQIM bilan qaytarilgan — lekin o'sha chiqimda o'quvchi ismi yo'q,
// ya'ni u arxivga umuman tushmagan (arxiv faqat o'quvchi ismi bor
// kirimlarni oladi). Natijada o'quvchi profilida 27 mlrd yolg'iz turib
// qolgan: qaytarilgani ko'rinmaydi, ya'ni jadval YOLG'ON gapiradi.
//
// Markaz shu bitta qatorni o'chirishni so'radi.
//
// SUMMA BO'YICHA EMAS, `sourceId` BO'YICHA o'chiriladi. Summa —
// tasodifiy belgi: ertaga xuddi shuncha summali boshqa (haqiqiy) yozuv
// paydo bo'lsa, summaga bog'langan skript uni ham olib tashlardi.
// `sourceId` esa edutizimdagi yozuvning o'zgarmas `_id` si.
//
// PUL HISOBIGA TA'SIRI YO'Q: arxivni birorta hisobot o'qimaydi
// (lib/legacyEntries.ts). Bu — faqat ko'rsatiladigan qatorni olib
// tashlash.
import fs from "fs";
import { MongoClient } from "mongodb";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

/** Edutizimdagi xato kirim yozuvining `_id` si. */
const DROP_SOURCE_IDS = ["6949297eed325e86243703f0"];

const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const col = db.collection("legacy_entries");

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("arxivdagi yozuvlar:", await col.countDocuments(), "\n");

const rows = await col.find({ sourceId: { $in: DROP_SOURCE_IDS } }, { projection: { _id: 0 } }).toArray();
if (rows.length === 0) {
  console.log("Bunday yozuv topilmadi — allaqachon o'chirilgan bo'lishi mumkin.");
  await c.close();
  process.exit(0);
}
for (const r of rows) {
  console.log(`  ${r.date} ${r.time}  ${r.amount.toLocaleString("ru-RU")}  ${r.studentName} (pupilId ${r.pupilId})`);
}

const path = `C:/Users/zovaxx/Desktop/legacy-ochirilgan-qator-${new Date().toISOString().slice(0, 10)}.json`;
fs.writeFileSync(path, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log("\nzaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'chirilmadi. Qo'llash uchun: --apply");
} else {
  const r = await col.deleteMany({ sourceId: { $in: DROP_SOURCE_IDS } });
  console.log(`\no'chirildi: ${r.deletedCount}`);
  console.log("arxivda qoldi:", await col.countDocuments());
  const [agg] = await col.aggregate([{ $group: { _id: null, max: { $max: "$amount" } } }]).toArray();
  console.log("arxivdagi eng katta summa endi:", Number(agg?.max ?? 0).toLocaleString("ru-RU"));
}

await c.close();
