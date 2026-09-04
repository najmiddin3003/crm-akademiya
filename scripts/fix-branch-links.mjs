// BIR MARTALIK MA'LUMOT TUZATISHI — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node scripts/fix-branch-links.mjs            # quruq yurish
//   node scripts/fix-branch-links.mjs --apply    # haqiqatan yozadi
//
// ------------------------------------------------------------------
// NIMA VA NEGA (markaz qarori, 2026-09-04)
//
// Kassa, moliya va lidlar filial bo'yicha AJRATILADI; o'quvchilar
// ro'yxati esa UMUMIY (kod tomoni allaqachon shunga keltirilgan —
// app/api/pupils/route.ts izohiga qarang).
//
//   1) Kassa #5 "Akademiya 2 Chortoq (Dilmurod)"  branchId 1 -> 2
//      Kassa #4 "Akademiya 1 Chortoq (Nilufar)"   branchId 1 (o'zgarmaydi)
//      Kassa #3 "Raxbar kassa"                    branchId 1 (o'zgarmaydi)
//   2) Dilmurod Komilov (hr_employees #58) branchIds -> [2]
//
// Xodimga filial qamrovi kassalar ro'yxatiga TA'SIR QILMAYDI (u
// `moderator` bo'yicha kesiladi, ya'ni Dilmurod baribir o'z kassasini
// ko'radi). Filial qamrovi unga lidlar va boshqa filialga bog'liq
// ma'lumotlar uchun kerak.
//
// ESLATMA: bu skript o'quvchilarga TEGMAYDI. Ular umumiy.
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
const db = c.db(env.MONGODB_DB || "crm_akademiya");

const boxes = await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1, moderator: 1, branchId: 1 } }).sort({ id: 1 }).toArray();
const emp = await db.collection("hr_employees").findOne({ id: 58 }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1 } });

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log("\nHozirgi kassalar:");
for (const b of boxes) console.log(`  #${b.id} ${String(b.name).padEnd(32)} branchId=${b.branchId}`);
console.log(`\nHozirgi ${emp?.name}: branchIds=${JSON.stringify(emp?.branchIds)}`);
console.log("\nO'zgarishlar:");
console.log("  kassa #5 -> branchId 2");
console.log("  hr_employees #58 -> branchIds [2]");

const backup = { at: new Date().toISOString(), cashboxes: boxes, employee: emp };
const path = "C:/Users/zovaxx/Desktop/branch-links-zaxira.json";
fs.writeFileSync(path, JSON.stringify(backup, null, 2));
console.log("\nZaxira:", path);

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
} else {
  const r1 = await db.collection("cashboxes").updateOne({ id: 5 }, { $set: { branchId: 2 } });
  const r2 = await db.collection("cashboxes").updateOne({ id: 4 }, { $set: { branchId: 1 } });
  const r3 = await db.collection("hr_employees").updateOne({ id: 58 }, { $set: { branchIds: [2] } });
  console.log(`\nkassa #5 : ${r1.modifiedCount} yangilandi`);
  console.log(`kassa #4 : ${r2.modifiedCount} yangilandi (allaqachon 1 bo'lsa 0)`);
  console.log(`xodim #58: ${r3.modifiedCount} yangilandi`);
  console.log("\n=== TEKSHIRUV ===");
  for (const b of await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1, branchId: 1 } }).sort({ id: 1 }).toArray())
    console.log(`  #${b.id} ${String(b.name).padEnd(32)} branchId=${b.branchId}`);
  const e2 = await db.collection("hr_employees").findOne({ id: 58 }, { projection: { _id: 0, name: 1, branchIds: 1 } });
  console.log(`  ${e2?.name}: ${JSON.stringify(e2?.branchIds)}`);
  const p = await db.collection("pupils").countDocuments();
  console.log(`\n  o'quvchilar (umumiy, kesilmaydi): ${p} ta — hammaga ko'rinadi`);
}
await c.close();
