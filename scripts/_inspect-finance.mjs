// FAQAT O'QIYDI. Bazadagi barcha kolleksiyalar va moliyaviy holat kesimi.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const ROOT = "C:/Users/zovaxx/Desktop/crm-akademiya-nextjs";
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);
console.log("BAZA:", db.databaseName, "\n");

const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
console.log("=== BARCHA KOLLEKSIYALAR ===");
for (const n of names) {
  const c = await db.collection(n).countDocuments();
  console.log(`  ${n.padEnd(32)} ${String(c).padStart(7)}`);
}

console.log("\n=== transaction_entries kesimi ===");
const te = db.collection("transaction_entries");
console.log("jami:", await te.countDocuments());
for (const g of await te.aggregate([{ $group: { _id: "$txType", n: { $sum: 1 }, sum: { $sum: "$amount" } } }, { $sort: { n: -1 } }]).toArray())
  console.log(`  txType=${String(g._id).padEnd(10)} ${String(g.n).padStart(6)}  sum=${g.sum}`);
for (const g of await te.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray())
  console.log(`  status="${g._id}" ${g.n}`);
console.log("  txName bo'yicha:");
for (const g of await te.aggregate([{ $group: { _id: "$txName", n: { $sum: 1 }, sum: { $sum: "$amount" } } }, { $sort: { n: -1 } }, { $limit: 30 }]).toArray())
  console.log(`    ${String(g._id).padEnd(34)} ${String(g.n).padStart(6)}  ${g.sum}`);
const dates = await te.aggregate([{ $group: { _id: null, min: { $min: "$date" }, max: { $max: "$date" } } }]).toArray();
console.log("  sana oralig'i:", JSON.stringify(dates[0] ?? {}));

console.log("\n=== transactions ===");
console.log("jami:", await db.collection("transactions").countDocuments());

console.log("\n=== cashboxes ===");
for (const c of await db.collection("cashboxes").find({}).sort({ id: 1 }).toArray())
  console.log(`  id=${c.id} "${c.name}" balance=${c.balance} archived=${c.archived} primary=${c.isPrimary} methodTotals=${JSON.stringify(c.methodTotals)}`);

console.log("\n=== salary_runs ===");
for (const r of await db.collection("salary_runs").find({}).sort({ id: 1 }).toArray())
  console.log(`  id=${r.id} month=${r.month} xodim=${r.employeeCount} oylik=${r.oylik} tolangan=${r.tolangan} items=${(r.items||[]).length} createdAt=${r.createdAt}`);

for (const n of ["bonuses", "penalties", "sync_outbox", "sync_runs", "pupil_activity", "planned_expenses", "finance_contracts", "contracts"]) {
  console.log(`\n=== ${n} === ${await db.collection(n).countDocuments()}`);
  const s = await db.collection(n).find({}).limit(2).toArray();
  for (const d of s) { const { _id, ...r } = d; console.log("   ", JSON.stringify(r).slice(0, 300)); }
}

console.log("\n=== pupils balance ===");
const pupils = db.collection("pupils");
console.log("jami o'quvchi:", await pupils.countDocuments());
console.log("balance != 0:", await pupils.countDocuments({ balance: { $ne: 0 } }));
const pb = await pupils.aggregate([{ $group: { _id: null, sum: { $sum: "$balance" }, min: { $min: "$balance" }, max: { $max: "$balance" } } }]).toArray();
console.log("balance yig'indisi:", JSON.stringify(pb[0] ?? {}));

console.log("\n=== hisobot kolleksiyalari ===");
for (const n of ["unpaid_students","price_differences","cancelled_payments","student_discounts","cancelled_attendance","leave_reasons"])
  console.log(`  ${n.padEnd(24)} ${await db.collection(n).countDocuments()}`);

await client.close();
