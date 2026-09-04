// BIR MARTALIK MA'LUMOT TUZATISHI — bazaga YOZADI.
// (Shu bois nomi `_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov.)
//
//   node scripts/fix-dilmurod-branch.mjs            # quruq yurish
//   node scripts/fix-dilmurod-branch.mjs --apply    # haqiqatan yozadi
//
// ------------------------------------------------------------------
// MUAMMO
//
// Dilmurod Komilov (hr_employees id 58) yagona xodim bo'lib, unga
// `branchIds: [2]` biriktirilgan — qolgan 53 xodimda `[1]`. Filial
// qamrovi (lib/branchScope.ts) tufayli u Kassa "Kirim" oynasida
// o'quvchilarning atigi 10 tasini ko'radi, qolganlar esa 6 782 tasini.
//
// Ma'lumot esa buning teskarisini aytadi: UCHALA kassa ham (jumladan
// uning o'z kassasi "Akademiya 2 Chortoq (Dilmurod)") `branchId: 1`,
// o'quvchilarning 99.85% i `branchId: 1`. Ya'ni 2-filial amalda
// mavjud emas — `[2]` xato biriktirish.
//
// Yon ta'sir: o'sha 10 o'quvchini Dilmurodning O'ZI yaratgan (noto'g'ri
// qamrovda turib) va ular boshqa HECH KIMGA ko'rinmaydi — adminga ham.
//
// ------------------------------------------------------------------
// NIMA QILADI
//   1) pupils: `branchId: 2` -> `1`  (o'sha 10 o'quvchi hammaga ko'rinsin)
//   2) hr_employees #58: `branchIds: [2]` -> `[1]`
//
// Zaxira (qaytarish uchun) ishga tushganda o'zi yoziladi:
//   C:\Users\zovaxx\Desktop\branch-fix-zaxira.json
//
// AGAR 2-FILIAL HAQIQIY bo'lsa — bu skriptni ISHLATMANG. U holda
// 6 775 o'quvchini filiallar bo'yicha qayta taqsimlash kerak, va qaysi
// o'quvchi qayerda o'qishini faqat markaz ayta oladi.
import fs from "fs";
import { MongoClient } from "mongodb";
const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 2, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB || "crm_akademiya");

const pupils = await db.collection("pupils").find({ branchId: 2 }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1 } }).toArray();
const emp = await db.collection("hr_employees").findOne({ id: 58 }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1 } });

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log(`\n1) pupils: branchId 2 -> 1  (${pupils.length} ta)`);
for (const p of pupils) console.log(`     #${p.id} ${p.firstName} ${p.lastName}`);
console.log(`\n2) hr_employees #58 ${emp?.name}: branchIds ${JSON.stringify(emp?.branchIds)} -> [1]`);

// ZAXIRA — qaytarish uchun
const backup = { at: new Date().toISOString(), pupilIds: pupils.map((p) => p.id), employee: emp };
const path = "C:/Users/zovaxx/Desktop/branch-fix-zaxira.json";
fs.writeFileSync(path, JSON.stringify(backup, null, 2));
console.log("\nZaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
} else {
  const r1 = await db.collection("pupils").updateMany({ branchId: 2 }, { $set: { branchId: 1 } });
  const r2 = await db.collection("hr_employees").updateOne({ id: 58 }, { $set: { branchIds: [1] } });
  console.log(`\npupils yangilandi : ${r1.modifiedCount}`);
  console.log(`xodim yangilandi  : ${r2.modifiedCount}`);
  const withBranch = { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] };
  console.log(`\nTEKSHIRUV — filial 1 endi: ${await db.collection("pupils").countDocuments(withBranch)} ta o'quvchi`);
  console.log(`             filial 2 endi: ${await db.collection("pupils").countDocuments({ branchId: 2 })} ta`);
  console.log(`             Dilmurod: ${JSON.stringify((await db.collection("hr_employees").findOne({ id: 58 }, { projection: { branchIds: 1 } }))?.branchIds)}`);
}
await c.close();
