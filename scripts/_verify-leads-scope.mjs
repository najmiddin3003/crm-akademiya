// FAQAT O'QIYDI. Lidlar qamrovi: kim nechta lidni ko'radi.
// app/api/orders/route.ts + lib/leadScope.ts dagi filtrni takrorlaydi.
import fs from "fs";
import { MongoClient } from "mongodb";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const c = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 20000 });
await c.connect();
const db = c.db(env.MONGODB_DB);
const col = db.collection("orders");

/** lib/branchScope.ts -> branchCondition */
const branchCond = (b) => b === 1
  ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }
  : { branchId: b };

/**
 * lib/leadScope.ts -> withLeadScope.
 * Muallif sharti tekshiruvda ANIQ TENGLIK bilan (kodda katta-kichik
 * harfni farqlamaydigan regex) — bazadagi ismlar aynan mos yozilgan.
 */
const leadScope = (b, author) => {
  const a = (author ?? "").trim();
  return a ? { $or: [branchCond(b), { moderator: a }] } : branchCond(b);
};

console.log("lidlar jami:", await col.countDocuments());
console.log(
  "branchId bo'yicha:",
  JSON.stringify(await col.aggregate([{ $group: { _id: "$branchId", n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray()),
);
console.log(
  "moderator bo'yicha:",
  JSON.stringify(await col.aggregate([{ $group: { _id: "$moderator", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray()),
);

const emps = await db.collection("hr_employees")
  .find({ id: { $in: [1, 57, 58] } }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1 } })
  .toArray();

console.log("\nkim nechta lid ko'radi:");
for (const e of emps) {
  const b = (e.branchIds ?? [1])[0];
  const only = await col.countDocuments(branchCond(b));
  const withAuthor = await col.countDocuments(leadScope(b, e.name));
  console.log(
    `  ${String(e.name).padEnd(26)} filial ${b}: faqat filial ${String(only).padStart(3)}` +
    `  |  + o'zi qo'shgani ${String(withAuthor).padStart(3)}`,
  );
}

const d = emps.find((e) => /dilmurod/i.test(e.name));
console.log(`\nDilmurod (filial 2) ko'radigan lidlar:`);
const rows = await col
  .find(leadScope(2, d?.name ?? ""), { projection: { _id: 0, id: 1, branchId: 1, moderator: 1, created: 1, name: 1 } })
  .sort({ id: -1 })
  .toArray();
for (const o of rows) {
  console.log(`  #${o.id} b=${o.branchId ?? "-"} mod="${o.moderator ?? ""}" ${o.created} ${o.name}`);
}
console.log(`  jami ${rows.length} ta`);

await c.close();
