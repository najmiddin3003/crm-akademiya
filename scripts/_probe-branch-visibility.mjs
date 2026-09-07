// FAQAT O'QIYDI. "Kim nechta o'quvchi ko'radi" — yangi qamrov bo'yicha.
//
// lib/branchScope.ts dagi `branchCondition` va `loadBranchScope` mantig'i
// shu yerda AYNAN takrorlangan (uchta qator), so'ng har bir hisob uchun
// `/api/pupils` GET qanday filtr bilan ishlashini ko'rsatadi.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

// lib/branchScope.ts -> branchCondition
const branchCondition = (branchId) =>
  branchId === 1
    ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }
    : { branchId };

const branches = await db.collection("branches").find({}).sort({ id: 1 }).toArray();
const allIds = branches.map((b) => Number(b.id));
const nameOf = new Map(branches.map((b) => [Number(b.id), b.name]));

console.log("=== FILIAL BO'YICHA O'QUVCHILAR (yangi qamrov) ===");
for (const id of allIds) {
  const n = await db.collection("pupils").countDocuments(branchCondition(id));
  const sample = await db.collection("pupils")
    .find(branchCondition(id), { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .sort({ id: -1 }).limit(3).toArray();
  const names = sample.map((p) => `${p.firstName} ${p.lastName} (#${p.id})`).join(", ");
  console.log(`  ${id} ${String(nameOf.get(id)).padEnd(22)} ${String(n).padStart(5)} ta   so'nggilari: ${names || "—"}`);
}

console.log("\n=== HISOBLAR: kim qaysi filialni tanlay oladi ===");
const users = await db.collection("users")
  .find({}, { projection: { _id: 0, fullName: 1, role: 1, hrEmployeeId: 1, status: 1 } })
  .toArray();

for (const u of users) {
  const emp = u.hrEmployeeId
    ? await db.collection("hr_employees").findOne({ id: Number(u.hrEmployeeId) }, { projection: { _id: 0, turi: 1, branchIds: 1, name: 1 } })
    : null;
  const isAdmin = u.role === "admin";
  // lib/branchScope.ts -> loadBranchScope
  const mine = Array.isArray(emp?.branchIds) ? emp.branchIds.map(Number).filter(Number.isFinite) : [];
  const allowed = isAdmin ? allIds : mine.filter((id) => allIds.includes(id));
  const eff = allowed.length ? allowed : [allIds[0] ?? 1];

  const counts = [];
  for (const id of eff) {
    counts.push(`${id}:${await db.collection("pupils").countDocuments(branchCondition(id))}`);
  }
  const who = `${u.fullName ?? "(nomsiz)"} [${isAdmin ? "admin" : (emp?.turi ?? "-")}]`;
  console.log(`  ${who.padEnd(42)} ko'ra oladi: ${eff.join(",").padEnd(9)} o'quvchi: ${counts.join("  ")}`);
}

console.log("\n=== TEKSHIRUV: 4-filialdagi sinov o'quvchisi ===");
const test = await db.collection("pupils").findOne({ branchId: 4 }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1 } });
console.log("  yozuv:", test ?? "(yo'q)");
if (test) {
  for (const id of allIds) {
    const seen = await db.collection("pupils").countDocuments({ $and: [{ id: test.id }, branchCondition(id)] });
    console.log(`    ${id}-filialda ko'rinadimi: ${seen ? "HA" : "yo'q"}`);
  }
}

console.log("\n=== TEKSHIRUV: 1-filial o'quvchisi 4-filialda ko'rinadimi ===");
const one = await db.collection("pupils").findOne({ branchId: 1 }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } });
if (one) {
  const seen4 = await db.collection("pupils").countDocuments({ $and: [{ id: one.id }, branchCondition(4)] });
  console.log(`  ${one.firstName} ${one.lastName} (#${one.id}) -> 4-filialda: ${seen4 ? "HA (XATO!)" : "yo'q (to'g'ri)"}`);
}

await client.close();
