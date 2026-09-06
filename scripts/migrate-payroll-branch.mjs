import { MongoClient } from "mongodb";
import fs from "node:fs";

// XODIM FILIALI — AUDIT VA BACKFILL.
//
// Ikki ish qiladi:
//   1. AUDIT (doim) — filial invariantlarini sanaydi va buzilganini
//      ko'rsatadi. Yozmaydi.
//   2. BACKFILL (`--yes` bilan) — `payrollBranchId` ni to'ldiradi
//      (= `branchIds[0]`) va `salary_runs.branchId` ni tiklaydi.
//
// TARTIB (buzilmasin):
//   a) YOZISH qoidalari deploy qilinadi — POST/PATCH/import/CV endi
//      har bir yangi xodimga `branchIds` va `payrollBranchId` yozadi;
//   b) SHU SKRIPT `--yes` bilan yurgiziladi;
//   c) audit hamma invariantda 0 chiqargach O'QISH filtri yoqiladi.
//
// Teskari tartibda ekranlar bo'shab qoladi: o'qish filtri
// `{ branchIds: <filial> }` shaklida va maydonsiz hujjat HECH BIR
// filialga tushmaydi (yumshatish ATAYLAB qo'yilmagan — filialsiz xodim
// bug bo'lib ko'rinishi kerak).
//
// FOYDALANISH:
//   node scripts/migrate-payroll-branch.mjs         # faqat audit
//   node scripts/migrate-payroll-branch.mjs --yes   # backfill + audit

const APPLY = process.argv.includes("--yes");

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const db = client.db("crm-akademiya-nextjs");
const empCol = db.collection("hr_employees");

const branches = await db.collection("branches").find({}).sort({ id: 1 }).toArray();
const validIds = new Set(branches.map((b) => Number(b.id)));
const nameOf = new Map(branches.map((b) => [Number(b.id), String(b.name)]));

console.log("═══ XODIM FILIALI — AUDIT ═══\n");
console.log(`Filiallar: ${branches.map((b) => `${b.id}=${b.name}`).join(" · ")}\n`);

// ─────────────────────── BACKFILL ───────────────────────
if (APPLY) {
  // `payrollBranchId` = `branchIds[0]`. Bugun deyarli hamma xodim bitta
  // filialda, ya'ni bu tanlov hech kimning oyligini ko'chirmaydi. Ko'p
  // filialli xodimda esa buni KEYIN qo'lda to'g'rilash kerak — qaysi
  // filial to'laydi degan savol biznes qarori, kod uni hal qila olmaydi.
  const needing = await empCol.find({ payrollBranchId: { $exists: false } }).toArray();
  let filled = 0;
  const ops = [];
  for (const e of needing) {
    const ids = (Array.isArray(e.branchIds) ? e.branchIds : []).map(Number).filter((n) => validIds.has(n));
    if (ids.length === 0) continue; // filialsiz xodim — quyida XATO bo'lib chiqadi
    ops.push({ updateOne: { filter: { id: e.id }, update: { $set: { payrollBranchId: ids[0] } } } });
    filled++;
  }
  if (ops.length > 0) await empCol.bulkWrite(ops);
  console.log(`✓ payrollBranchId to'ldirildi: ${filled} ta xodim`);

  // Eski chiqarishlarga filial. Usiz o'chirish qorovuli ularni
  // "boshqa filialniki" deb hisoblardi — hozir bu bepul, keyin emas.
  const runs = await db.collection("salary_runs").updateMany(
    { branchId: { $exists: false } },
    { $set: { branchId: branches[0]?.id ?? 1 } },
  );
  console.log(`✓ salary_runs.branchId to'ldirildi: ${runs.modifiedCount} ta chiqarish\n`);
}

// ─────────────────────── AUDIT ───────────────────────
const all = await empCol.find({}).sort({ id: 1 }).toArray();
const active = all.filter((e) => !e.archReason);

const checks = [];
const bad = { noBranch: [], unknown: [], noPayroll: [], payrollOutside: [], assignOutside: [] };

for (const e of all) {
  const ids = Array.isArray(e.branchIds) ? e.branchIds.map(Number) : [];
  if (ids.length === 0) bad.noBranch.push(e);
  else if (ids.some((n) => !validIds.has(n))) bad.unknown.push(e);

  if (e.payrollBranchId === undefined || e.payrollBranchId === null) bad.noPayroll.push(e);
  else if (!ids.includes(Number(e.payrollBranchId))) bad.payrollOutside.push(e);

  for (const a of e.branchAssignments ?? []) {
    if (!ids.includes(Number(a.branchId))) { bad.assignOutside.push({ e, a }); break; }
  }
}

checks.push(["I1  filialsiz xodim", bad.noBranch.length]);
checks.push(["I1  mavjud bo'lmagan filial", bad.unknown.length]);
checks.push(["I2  payrollBranchId yo'q", bad.noPayroll.length]);
checks.push(["I2  payrollBranchId a'zolikdan tashqarida", bad.payrollOutside.length]);
checks.push(["I4  ish haqi qatori a'zolikdan tashqarida", bad.assignOutside.length]);

for (const [label, n] of checks) {
  console.log(`  ${n === 0 ? "✅" : "❌"} ${label.padEnd(44)} ${n}`);
}

// I3 — BO'LINISH. Har bir faol xodim aynan BITTA filialning oylik
// ro'yxatida turishi shart; yig'indi faol xodimlar soniga teng bo'lsin.
console.log("\nOYLIK RO'YXATLARINING BO'LINISHI (I3):");
let sum = 0;
for (const b of branches) {
  const n = active.filter((e) => Number(e.payrollBranchId) === Number(b.id)).length;
  sum += n;
  console.log(`  ${String(b.name).padEnd(28)} ${String(n).padStart(3)} ta`);
}
const orphan = active.length - sum;
console.log(`  ${"—".padEnd(28)} ${"—".padStart(3)}`);
console.log(`  ${"JAMI".padEnd(28)} ${String(sum).padStart(3)} ta   (faol xodimlar: ${active.length})`);
console.log(`  ${orphan === 0 ? "✅ bo'linish to'liq" : `❌ ${orphan} ta xodim hech bir ro'yxatda yo'q`}`);

// KO'RINISH — a'zolik bo'yicha (kesishishi MUMKIN va bu normal).
console.log("\nKO'RINISH (branchIds — kesishishi mumkin):");
for (const b of branches) {
  const n = active.filter((e) => (e.branchIds ?? []).map(Number).includes(Number(b.id))).length;
  console.log(`  ${String(b.name).padEnd(28)} ${String(n).padStart(3)} ta`);
}
const multi = active.filter((e) => (e.branchIds ?? []).length > 1);
console.log(`\nKo'p filialli xodimlar: ${multi.length} ta`);
for (const e of multi) {
  const ids = (e.branchIds ?? []).map(Number);
  console.log(
    `  ${String(e.name).padEnd(28)} ko'rinadi: ${ids.map((i) => nameOf.get(i) ?? i).join(" + ")}` +
    `  ·  oyligi: ${nameOf.get(Number(e.payrollBranchId)) ?? "(yo'q)"}`,
  );
}

// Tafsilotlar — faqat muammo bo'lsa.
const anyBad = checks.some(([, n]) => n > 0) || orphan !== 0;
if (anyBad) {
  console.log("\n─── TAFSILOT ───");
  for (const e of bad.noBranch) console.log(`  filialsiz: id=${e.id} ${e.name}`);
  for (const e of bad.unknown) console.log(`  noma'lum filial: id=${e.id} ${e.name} ${JSON.stringify(e.branchIds)}`);
  for (const e of bad.noPayroll) console.log(`  payrollBranchId yo'q: id=${e.id} ${e.name}`);
  for (const e of bad.payrollOutside) console.log(`  oylik uyi tashqarida: id=${e.id} ${e.name} branchIds=${JSON.stringify(e.branchIds)} payroll=${e.payrollBranchId}`);
  for (const { e, a } of bad.assignOutside) {
    console.log(`  ish haqi tashqarida: id=${e.id} ${e.name} branchIds=${JSON.stringify(e.branchIds)} qator=${nameOf.get(Number(a.branchId)) ?? a.branchId} (${(a.salary || 0).toLocaleString("ru-RU")} so'm)`);
  }
}

if (!APPLY) console.log("\n(--yes qo'shilmadi — hech narsa yozilmadi)");
console.log(`\n${anyBad ? "NATIJA: ❌ invariantlar buzilgan — O'QISH FILTRINI YOQMANG" : "NATIJA: ✅ hamma invariant toza"}`);

await client.close();
process.exit(anyBad ? 1 : 0);
