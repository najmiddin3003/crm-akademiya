// BIR MARTALIK MA'LUMOT KO'CHIRISHI — bazaga YOZADI.
// (`_` bilan boshlanmaydi: `scripts/_*.mjs` faqat o'lchov degani.)
//
//   node --import ./scripts/_ts-alias.mjs scripts/backfill-student-refund.mjs           # quruq yurish
//   node --import ./scripts/_ts-alias.mjs scripts/backfill-student-refund.mjs --apply   # haqiqatan yozadi
//
// `--import ./scripts/_ts-alias.mjs` SHART: qoida loyihaning TS
// modullaridan olinadi (lib/txTarget.ts, lib/studentRefund.ts), ya'ni
// skript bilan server bir xil qaror qiladi — nusxa ko'chirilgan mantiq yo'q.
//
// ------------------------------------------------------------------
// NIMA VA NEGA
//
// 18.09.2026 dan "O'quvchiga pul qaytarildi" turidagi chiqim yozuviga
// server `studentRefund: true` bayrog'ini va o'quvchining ustozini
// (`teacherName`) yozadi (app/api/cashboxes/[id]/adjust). Balans
// (/api/students/balances), ustoz tushumi (lib/payrollSources.ts) va
// "Ishlab berilgan" hisoboti aynan shu bayroq bo'yicha ayiradi —
// nomdagi "qaytar" so'ziga QARALMAYDI (lib/transactionEntries.ts izohi).
//
// Bu o'zgarishdan OLDIN yozilgan qaytarim yozuvlarida bayroq yo'q — ular
// balansdan ham, ustoz tushumidan ham ayrilmay turibdi. Skript ularni
// topib belgilaydi:
//
//   • QAYSI YOZUVLAR: `txType: "payOut"`, bayroqsiz, `txName` i "Mijoz"
//     bo'yicha O'QUVCHIGA qaratilgan chiqim turi (txTarget === "student",
//     server bilan bir xil qoida — tur topilmasa nomga qaraladi).
//   • USTOZ: `teacherName` bo'sh bo'lsa lib/studentRefund.ts →
//     refundTeacherOf: o'quvchining oxirgi to'lovidagi ustoz, bo'lmasa
//     guruh ustozi. Topilmasa bo'sh qoladi — taxmin qilinmaydi.
//
// IDEMPOTENT: bayroqli yozuvlar qayta ko'rilmaydi. Bekor qilingan yozuvlar
// ham belgilanadi (bayroq yozuv MA'NOSI, holati emas; yig'indilar
// `status` bo'yicha o'zlari tashlab ketadi).
//
// QAYTARISH: skript o'zgaradigan hujjatlarning eski holatini zaxira
// faylga yozadi; qaytarish uchun har biriga `$unset: { studentRefund }`
// va eski `teacherName` ni `$set` qilish kifoya.
import fs from "fs";
import { MongoClient } from "mongodb";
import { txTarget } from "@/lib/txTarget";
import { refundTeacherOf } from "@/lib/studentRefund";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(env.MONGODB_DB);
const entries = db.collection("transaction_entries");

// Chiqim turlari — nom bo'yicha; server ham nom bilan topadi
// (lib/studentRefund.ts → isStudentRefundCategory).
const types = await db
  .collection("transaction_types")
  .find({ mainType: "chiqim" }, { projection: { _id: 0, name: 1, customerType: 1 } })
  .toArray();
const typeByName = new Map(types.map((t) => [String(t.name ?? "").trim(), t]));
const isRefundName = (txName) => {
  const name = String(txName ?? "").trim();
  if (!name) return false;
  return txTarget(typeByName.get(name) ?? { name }) === "student";
};

const candidates = await entries
  .find(
    { txType: "payOut", studentRefund: { $exists: false }, studentName: { $nin: ["", null] } },
    { projection: { _id: 0, id: 1, date: 1, studentName: 1, teacherName: 1, txName: 1, amount: 1, status: 1 } },
  )
  .sort({ id: 1 })
  .toArray();

const plan = [];
for (const e of candidates) {
  if (!isRefundName(e.txName)) continue;
  const hadTeacher = String(e.teacherName ?? "").trim();
  const teacher = hadTeacher || (await refundTeacherOf(db, e.studentName)) || "";
  plan.push({ before: e, teacher, teacherFrom: hadTeacher ? "yozuvda" : teacher ? "topildi" : "YO'Q" });
}

console.log(APPLY ? "=== QO'LLANMOQDA ===" : "=== QURUQ YURISH (--apply yo'q) ===");
console.log(`baza: ${db.databaseName}   chiqim turlari: ${types.length}   bayroqsiz chiqim: ${candidates.length}\n`);
console.log("O'quvchiga qaratilgan chiqim turlari:",
  types.filter((t) => txTarget(t) === "student").map((t) => `"${t.name}"`).join(", ") || "(yo'q)");
console.log("");
for (const p of plan) {
  const e = p.before;
  console.log(
    `  #${String(e.id).padStart(5)} ${e.date}  ${String(e.studentName).padEnd(28)} ${String(e.amount).padStart(10)}` +
    `  ${String(e.status || "faol").padEnd(9)}  ustoz: ${p.teacher || "—"} (${p.teacherFrom})`,
  );
}
console.log(`\nbelgilanadigan yozuv: ${plan.length}`);

if (plan.length > 0) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `scripts/data/backfill-student-refund-${stamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify({ at: new Date().toISOString(), rows: plan.map((p) => p.before) }, null, 2));
  console.log("zaxira:", backupPath);
}

if (!APPLY) {
  console.log("\nHech narsa o'zgartirilmadi. Qo'llash uchun: --apply");
} else {
  let n = 0;
  for (const p of plan) {
    const set = { studentRefund: true };
    if (p.teacherFrom === "topildi") set.teacherName = p.teacher;
    const r = await entries.updateOne({ id: p.before.id, studentRefund: { $exists: false } }, { $set: set });
    n += r.modifiedCount;
  }
  console.log(`\nyangilandi: ${n}`);
  console.log("\n=== TEKSHIRUV ===");
  const after = await entries
    .find({ studentRefund: true }, { projection: { _id: 0, id: 1, studentName: 1, teacherName: 1, amount: 1, status: 1 } })
    .sort({ id: 1 })
    .toArray();
  for (const e of after) {
    console.log(`  #${String(e.id).padStart(5)} ${String(e.studentName).padEnd(28)} ${String(e.amount).padStart(10)}  ustoz: ${e.teacherName || "—"}`);
  }
}

await client.close();
