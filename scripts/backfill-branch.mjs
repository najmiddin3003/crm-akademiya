// Filial kalitini mavjud ma'lumotga qo'yadi (bir martalik migratsiya).
//
// Foydalanuvchi bilan kelishilgan: bazadagi BUTUN mavjud ma'lumot
// 1-filialga ("Akademiya 1 Chortoq") tegishli.
//
// Ishga tushirish:
//   node scripts/backfill-branch.mjs            # faqat sanaydi (dry-run)
//   node scripts/backfill-branch.mjs --apply    # yozadi
//   node scripts/backfill-branch.mjs --verify   # qolgan-qutgani bormi
//
// XAVFSIZLIK:
//   • `--apply` bo'lmasa HECH NARSA yozilmaydi;
//   • idempotent — har bir yangilash `{maydon: {$exists: false}}` filtri
//     bilan ketadi, ya'ni ikki marta ishlatilsa ham mavjud qiymat ustiga
//     yozilmaydi;
//   • qaytarish: har bir kolleksiyada `updateMany({}, {$unset: {branchId: ""}})`
//     — hech qanday mavjud ma'lumot yo'qolmaydi, chunki skript faqat YANGI
//     maydon qo'shadi.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const BRANCH_ID = 1;

/** `branchId` (bitta son) qo'yiladigan kolleksiyalar. */
const SINGLE = ["pupils", "groups", "rooms", "cashboxes", "orders", "uzbmb_exams"];
/** `branchIds` (ro'yxat) qo'yiladigan — xodim bir nechta filialda ishlashi mumkin. */
const MULTI = ["hr_employees"];

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);
console.log("Baza:", db.databaseName);
console.log(APPLY ? "REJIM: YOZISH (--apply)" : VERIFY ? "REJIM: TEKSHIRUV" : "REJIM: faqat sanash (--apply berilmadi)");
console.log();

let jami = 0;
const qator = (nom, bor, yoq) =>
  console.log("  " + nom.padEnd(18) + "jami " + String(bor + yoq).padStart(6) + "   filialsiz " + String(yoq).padStart(6));

console.log("=== branchId ===");
for (const nom of SINGLE) {
  const col = db.collection(nom);
  const yoq = await col.countDocuments({ branchId: { $exists: false } });
  const bor = await col.countDocuments({ branchId: { $exists: true } });
  qator(nom, bor, yoq);
  jami += yoq;
  if (APPLY && yoq > 0) {
    const r = await col.updateMany({ branchId: { $exists: false } }, { $set: { branchId: BRANCH_ID } });
    console.log("      -> yozildi: " + r.modifiedCount);
  }
}

console.log("\n=== branchIds ===");
for (const nom of MULTI) {
  const col = db.collection(nom);
  const yoq = await col.countDocuments({ branchIds: { $exists: false } });
  const bor = await col.countDocuments({ branchIds: { $exists: true } });
  qator(nom, bor, yoq);
  jami += yoq;
  if (APPLY && yoq > 0) {
    const r = await col.updateMany({ branchIds: { $exists: false } }, { $set: { branchIds: [BRANCH_ID] } });
    console.log("      -> yozildi: " + r.modifiedCount);
  }
}

console.log("\nJAMI tegiladigan hujjat: " + jami);

if (APPLY || VERIFY) {
  console.log("\n=== TEKSHIRUV: filialsiz qolgani ===");
  let qoldi = 0;
  for (const nom of SINGLE) {
    const k = await db.collection(nom).countDocuments({ branchId: { $exists: false } });
    qoldi += k;
    console.log("  " + nom.padEnd(18) + k);
  }
  for (const nom of MULTI) {
    const k = await db.collection(nom).countDocuments({ branchIds: { $exists: false } });
    qoldi += k;
    console.log("  " + nom.padEnd(18) + k);
  }
  console.log(qoldi === 0 ? "\nNATIJA: hammasi filialga bog'landi." : "\nNATIJA: " + qoldi + " ta hujjat filialsiz qoldi!");

  console.log("\n=== TAQSIMOT ===");
  for (const nom of SINGLE) {
    const d = await db.collection(nom).aggregate([{ $group: { _id: "$branchId", k: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray();
    console.log("  " + nom.padEnd(18) + d.map((x) => x._id + ": " + x.k).join("  "));
  }
}

if (!APPLY && !VERIFY) {
  console.log("\nYozish uchun: node scripts/backfill-branch.mjs --apply");
}

await client.close();
