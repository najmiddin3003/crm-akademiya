// FAQAT O'QIYDI. "Moderator akkauntidan avans" muammosini tekshiradi:
// kassalar, filiallar, xodimlarning payrollBranchId taqsimoti va
// employees-payroll qaysi xodimlarni qaytarishi.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const branches = await db.collection("branches").find({}).toArray();
console.log("FILIALLAR:");
for (const b of branches) console.log(`  id ${b.id} — ${b.name}`);

const boxes = await db.collection("cashboxes").find({}, { projection: { id: 1, name: 1, moderator: 1, branchId: 1 } }).toArray();
console.log("\nKASSALAR:");
for (const c of boxes) console.log(`  id ${c.id} — ${c.name} | moderator=${c.moderator} | branchId=${c.branchId}`);

const emps = await db.collection("hr_employees")
  .find({}, { projection: { id: 1, name: 1, turi: 1, archReason: 1, branchIds: 1, payrollBranchId: 1, oylik: 1, salaries: 1, plastikSalary: 1 } })
  .toArray();
const active = emps.filter((e) => !e.archReason);
console.log(`\nXODIMLAR: jami ${emps.length}, aktiv ${active.length}`);

const byPayroll = {};
for (const e of active) {
  const k = e.payrollBranchId ?? "(yo'q)";
  byPayroll[k] = (byPayroll[k] || 0) + 1;
}
console.log("aktiv xodimlar payrollBranchId bo'yicha:", byPayroll);

const byVisible = {};
for (const e of active) {
  for (const b of (Array.isArray(e.branchIds) ? e.branchIds : ["(yo'q)"])) byVisible[b] = (byVisible[b] || 0) + 1;
}
console.log("aktiv xodimlar branchIds (ko'rinish) bo'yicha:", byVisible);

console.log("\nEkrandagi to'rt xodim:");
for (const nm of ["Abdulloh Raxmatullayev", "Abdushukur Abdug'aniyev", "Hasanboy Obidov", "Shoxsanam Obidova"]) {
  const e = emps.find((x) => x.name === nm);
  if (!e) { console.log(`  ${nm}: TOPILMADI`); continue; }
  console.log(`  ${nm}: id=${e.id} turi=${e.turi} branchIds=${JSON.stringify(e.branchIds)} payrollBranchId=${e.payrollBranchId} oylik=${e.oylik ?? "-"} salaries=${JSON.stringify(e.salaries ?? null)}`);
}

for (const bid of branches.map((b) => b.id)) {
  const inBranch = active.filter((e) => e.payrollBranchId === bid);
  console.log(`\nfilial ${bid} (${branches.find((b) => b.id === bid)?.name}) — employees-payroll ${inBranch.length} ta qator qaytaradi`);
  for (const e of inBranch.slice(0, 10)) console.log(`    ${e.name} (${e.turi})`);
}

await client.close();
