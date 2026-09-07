// Faol o'qituvchilarni 2-filialga ham biriktiradi (ko'rinish uchun).
//
//   node scripts/_assign-teachers-branch2.mjs           -> quruq yurish
//   node scripts/_assign-teachers-branch2.mjs --apply   -> yozadi
//   node scripts/_assign-teachers-branch2.mjs --undo    -> qaytarib oladi
//
// NIMA UCHUN: o'qituvchilar 07.09.2026 dan filial bo'yicha kesiladi
// (/api/teachers -> scopedEmployeeFilter). 35 ta faol o'qituvchining
// hammasi faqat 1-filialga biriktirilgan edi, natijada 2-filial moderatori
// "Yangi buyurtma" oynasida ustoz tanlay olmadi — ro'yxat bo'sh chiqdi.
// Amalda esa ular ikkala filialda ham dars beradi (2-filial buyurtmalarida
// ularning ismi turibdi).
//
// IKKALA MAYDON HAM YANGILANADI — bu SHART:
//   `branchIds`         — ko'rinish (lib/employeeBranches.ts)
//   `branchAssignments` — xodim kartochkasidagi filial galochkalari
// AddEmployeeModal `branchIds` ni AYNAN `branchAssignments` dan qayta
// hisoblaydi (`branchAssignments.map(a => a.branchId)`). Faqat `branchIds`
// yozilsa, o'sha xodim keyingi safar saqlanganda 2-filial jimgina
// yo'qolardi va muammo qaytib kelardi.
//
// `payrollBranchId` GA TEGILMAYDI — u PUL tomoni: xodim qaysi filialning
// oylik ro'yxatida turishini belgilaydi va ikki marta to'lashni to'sadi
// (lib/employeeBranches.ts). Ko'rinish va pul ataylab har xil maydon.
// Qo'shiladigan biriktiruvda `salary: 0` — 2-filialda alohida oylik
// sozlanmagan, ya'ni pul oqimi o'zgarmaydi.
import fs from "node:fs";
import { MongoClient } from "mongodb";

const RECEIPT = "scripts/_teachers-branch2-receipt.json";
const TARGET_BRANCH = 2;

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));
const col = db.collection("hr_employees");

if (process.argv.includes("--undo")) {
  if (!fs.existsSync(RECEIPT)) { console.log("Kvitansiya yo'q."); await client.close(); process.exit(0); }
  const r = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  let n = 0;
  for (const e of r.changed) {
    await col.updateOne({ id: e.id }, { $set: { branchIds: e.beforeBranchIds, branchAssignments: e.beforeAssignments } });
    n++;
  }
  fs.unlinkSync(RECEIPT);
  console.log(`${n} ta xodim eski holatiga qaytarildi.`);
  await client.close();
  process.exit(0);
}

const APPLY = process.argv.includes("--apply");

// FAQAT FAOL o'qituvchilar: arxivdagilar tanlov ro'yxatida baribir
// chiqmaydi (lib/teachersData.ts -> isActiveTeacher: turi === "teacher" &&
// !archReason), ya'ni ularga tegish bekor o'zgarish bo'lardi.
const teachers = await col
  .find({ turi: "teacher", $or: [{ archReason: "" }, { archReason: null }, { archReason: { $exists: false } }] })
  .project({ _id: 0, id: 1, name: 1, branchIds: 1, branchAssignments: 1, payrollBranchId: 1 })
  .sort({ id: 1 })
  .toArray();

const todo = teachers.filter((t) => !(t.branchIds ?? []).includes(TARGET_BRANCH));
const already = teachers.length - todo.length;

console.log(`${APPLY ? "YOZILADI" : "QURUQ YURISH (bazaga tegilmaydi)"}\n`);
console.log(`  faol o'qituvchi: ${teachers.length} ta`);
console.log(`  ${TARGET_BRANCH}-filialga qo'shiladi: ${todo.length} ta`);
console.log(`  allaqachon bor: ${already} ta`);
console.log(`\n  namuna (birinchi 5 ta):`);
for (const t of todo.slice(0, 5)) {
  console.log(`    ${String(t.id).padStart(3)} ${String(t.name).padEnd(28)} branchIds ${JSON.stringify(t.branchIds ?? [])} -> ${JSON.stringify([...(t.branchIds ?? []), TARGET_BRANCH])}   payrollBranchId ${t.payrollBranchId ?? "-"} (o'zgarmaydi)`);
}

if (!APPLY) {
  console.log(`\nYozish uchun: node scripts/_assign-teachers-branch2.mjs --apply`);
  await client.close();
  process.exit(0);
}

const receipt = { branch: TARGET_BRANCH, changed: [] };
for (const t of todo) {
  const beforeBranchIds = t.branchIds ?? [];
  const beforeAssignments = t.branchAssignments ?? [];
  const nextBranchIds = [...new Set([...beforeBranchIds, TARGET_BRANCH])].sort((a, b) => a - b);
  const nextAssignments = beforeAssignments.some((a) => a.branchId === TARGET_BRANCH)
    ? beforeAssignments
    : [...beforeAssignments, { branchId: TARGET_BRANCH, roleId: null, scheduleId: null, salary: 0 }];

  await col.updateOne({ id: t.id }, { $set: { branchIds: nextBranchIds, branchAssignments: nextAssignments } });
  receipt.changed.push({ id: t.id, name: t.name, beforeBranchIds, beforeAssignments });
}

fs.writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2), "utf8");
console.log(`\n${receipt.changed.length} ta o'qituvchi ${TARGET_BRANCH}-filialga biriktirildi.`);
console.log(`Kvitansiya: ${RECEIPT}`);
console.log(`Qaytarib olish: node scripts/_assign-teachers-branch2.mjs --undo`);

await client.close();
