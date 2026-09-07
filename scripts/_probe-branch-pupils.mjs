// FAQAT O'QIYDI. Filial bo'yicha ajratishdan OLDINGI holat:
// qaysi filialda nechta o'quvchi, guruh va xodim bor.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const branches = await db.collection("branches").find({}).sort({ id: 1 }).toArray();
console.log("=== FILIALLAR ===");
for (const b of branches) console.log(`  ${b.id}  ${b.name ?? "(nomsiz)"}`);

const byBranch = async (coll) => {
  const rows = await db.collection(coll).aggregate([
    { $group: { _id: "$branchId", n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  return rows.map((r) => `${r._id === null || r._id === undefined ? "(yo'q)" : r._id}: ${r.n}`).join("   ");
};

console.log("\n=== BRANCHID BO'YICHA ===");
for (const c of ["pupils", "groups", "orders", "hr_employees", "cashboxes"]) {
  console.log(`  ${c.padEnd(14)} ${await byBranch(c)}`);
}

console.log("\n=== XODIMLAR: branchIds ===");
const emps = await db.collection("hr_employees")
  .find({}, { projection: { id: 1, name: 1, turi: 1, branchIds: 1, status: 1, _id: 0 } })
  .sort({ id: 1 })
  .toArray();
const byIds = new Map();
for (const e of emps) {
  const key = Array.isArray(e.branchIds) && e.branchIds.length ? e.branchIds.join(",") : "(yo'q)";
  if (!byIds.has(key)) byIds.set(key, []);
  byIds.get(key).push(`${e.id} ${e.name ?? ""} [${e.turi ?? "-"}${e.status ? " " + e.status : ""}]`);
}
for (const [k, list] of [...byIds].sort()) {
  console.log(`  branchIds=${k}  (${list.length} ta)`);
  for (const s of list.slice(0, 12)) console.log(`      ${s}`);
  if (list.length > 12) console.log(`      ... yana ${list.length - 12} ta`);
}

console.log("\n=== 4-FILIALDAGI O'QUVCHILAR ===");
const p4 = await db.collection("pupils")
  .find({ branchId: 4 }, { projection: { id: 1, firstName: 1, lastName: 1, status: 1, createdAt: 1, _id: 0 } })
  .sort({ id: -1 })
  .limit(20)
  .toArray();
console.log(`  jami: ${await db.collection("pupils").countDocuments({ branchId: 4 })}`);
for (const p of p4) console.log(`  ${p.id}  ${p.lastName ?? ""} ${p.firstName ?? ""}  [${p.status ?? "-"}]  ${p.createdAt ?? ""}`);

console.log("\n=== ENG SO'NGGI 5 TA O'QUVCHI (har qanday filial) ===");
const last = await db.collection("pupils")
  .find({}, { projection: { id: 1, firstName: 1, lastName: 1, branchId: 1, createdAt: 1, _id: 0 } })
  .sort({ id: -1 })
  .limit(5)
  .toArray();
for (const p of last) console.log(`  ${p.id}  ${p.lastName ?? ""} ${p.firstName ?? ""}  branchId=${p.branchId ?? "(yo'q)"}  ${p.createdAt ?? ""}`);

await client.close();
