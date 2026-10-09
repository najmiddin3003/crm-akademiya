// 1- VA 2-FILIAL NOMI → «Akademiya Chortoq» (10.10.2026).
//
// Foydalanuvchi: «filial nomlarini o'zgartiramiz, filial 1 va filial 2 ni
// bitta yagona Akademiya Chortoq ga o'tkazamiz … kassa shundoq holicha qoladi,
// faqat ko'rinish o'zgarsin». Kod tomoni (navbarda bitta qator, «1-bino /
// 2-bino» belgilari) — lib/branchPools.ts. Bu skript faqat NOMLARNI yozadi:
//
//   • branches 1 va 2 → name «Akademiya Chortoq» (eski nom `nameBefore` ga);
//   • nomning NUSXALARI (ko'rinish bir xil bo'lsin): ish arizalari
//     (`cv_applications.branchName`), kurs narx qatorlari
//     (`offline_courses.branches[].name`, `levels[].branches[].name`).
//
// TEGMAYDI: kassalar (nomi ham — «kassa shundoq qoladi»), har yozuvning
// `branchId` si, Telegram topiklari. Har amal `action_log` ga «Skript» nomidan.
//
//   node --env-file=.env.local scripts/rename-chortoq-branches.mjs           # faqat ko'rsatadi
//   node --env-file=.env.local scripts/rename-chortoq-branches.mjs --apply   # yozadi
//   node --env-file=.env.local scripts/rename-chortoq-branches.mjs --undo    # eski nomlarni qaytaradi
//
// Prod'da (memory: prod-vps-eskiz) — `current/scripts/` ga scp, `crm` nomidan.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { MongoClient } = require("mongodb");

const NEW_NAME = "Akademiya Chortoq";
const IDS = [1, 2];
const apply = process.argv.includes("--apply");
const undo = process.argv.includes("--undo");

if (!process.env.MONGODB_URI) {
  console.log("MONGODB_URI yo'q");
  process.exit(1);
}
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");

const branches = await db.collection("branches").find({ id: { $in: IDS } }, { projection: { _id: 0, id: 1, name: 1, nameBefore: 1 } }).toArray();
console.log("Hozir:", branches.map((b) => `${b.id}: «${b.name}»${b.nameBefore ? ` (oldin «${b.nameBefore}»)` : ""}`).join(" | "));

async function audit(action, details) {
  await db.collection("action_log").insertOne({
    at: new Date(),
    actor: { kind: "system", name: "Skript" },
    source: "cron",
    section: "branches",
    action,
    status: 200,
    details: { script: "scripts/rename-chortoq-branches.mjs", ...details },
  });
}

if (undo) {
  const back = branches.filter((b) => b.nameBefore);
  if (back.length === 0) {
    console.log("Qaytariladigan eski nom yo'q.");
    process.exit(0);
  }
  for (const b of back) {
    await db.collection("branches").updateOne({ id: b.id }, { $set: { name: b.nameBefore }, $unset: { nameBefore: "" } });
    await db.collection("cv_applications").updateMany({ branchId: b.id }, { $set: { branchName: b.nameBefore } });
    await db.collection("offline_courses").updateMany(
      { "branches.id": b.id },
      { $set: { "branches.$[x].name": b.nameBefore } },
      { arrayFilters: [{ "x.id": b.id }] },
    );
    await db.collection("offline_courses").updateMany(
      { "levels.branches.id": b.id },
      { $set: { "levels.$[].branches.$[x].name": b.nameBefore } },
      { arrayFilters: [{ "x.id": b.id }] },
    );
    console.log(`${b.id}: «${b.name}» → «${b.nameBefore}»`);
  }
  await audit("rename_undo", { branches: back.map((b) => ({ id: b.id, from: b.name, to: b.nameBefore })) });
  await client.close();
  process.exit(0);
}

const todo = branches.filter((b) => b.name !== NEW_NAME);
const cvCount = await db.collection("cv_applications").countDocuments({ branchId: { $in: IDS }, branchName: { $ne: NEW_NAME } });
const courseCount = await db.collection("offline_courses").countDocuments({
  $or: [{ branches: { $elemMatch: { id: { $in: IDS }, name: { $ne: NEW_NAME } } } }, { "levels.branches": { $elemMatch: { id: { $in: IDS }, name: { $ne: NEW_NAME } } } }],
});
console.log(`O'zgaradi: filial ${todo.length} ta, ish arizasi ${cvCount} ta, kurs ${courseCount} ta. Kassalar tegilmaydi.`);

if (!apply) {
  console.log("Quruq yurish — yozish uchun --apply.");
  await client.close();
  process.exit(0);
}

for (const b of todo) {
  await db.collection("branches").updateOne({ id: b.id }, { $set: { name: NEW_NAME, nameBefore: b.name } });
}
const cv = await db.collection("cv_applications").updateMany({ branchId: { $in: IDS } }, { $set: { branchName: NEW_NAME } });
const c1 = await db.collection("offline_courses").updateMany(
  { "branches.id": { $in: IDS } },
  { $set: { "branches.$[x].name": NEW_NAME } },
  { arrayFilters: [{ "x.id": { $in: IDS } }] },
);
const c2 = await db.collection("offline_courses").updateMany(
  { "levels.branches.id": { $in: IDS } },
  { $set: { "levels.$[].branches.$[x].name": NEW_NAME } },
  { arrayFilters: [{ "x.id": { $in: IDS } }] },
);
await audit("rename", {
  branches: todo.map((b) => ({ id: b.id, from: b.name, to: NEW_NAME })),
  cvApplications: cv.modifiedCount,
  courses: c1.modifiedCount,
  courseLevels: c2.modifiedCount,
});
const after = await db.collection("branches").find({ id: { $in: IDS } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
console.log("Yozildi:", after.map((b) => `${b.id}: «${b.name}»`).join(" | "), `| CV ${cv.modifiedCount}, kurs ${c1.modifiedCount}+${c2.modifiedCount}`);
await client.close();
