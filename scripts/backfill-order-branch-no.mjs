// LIDLARGA FILIAL ICHIDAGI TARTIB RAQAMI (orders.branchNo) — bir martalik to'ldirish.
//
// 11.09.2026: buyurtmalar ro'yxatidagi "ID" endi filial bo'yicha raqamlanadi
// (lib/ordersData.ts → Order.branchNo). Yangi lidlar raqamni POST /api/orders
// da oladi; bu skript ESKI lidlarga beradi: har filial ichida `id` tartibida
// (ya'ni yaratilish tartibida) 1, 2, 3… Filialsiz eski lidlar (branchId
// yo'q — bo'linishdan oldingi 42 ta) 1-FILIAL raqamlashiga kiradi: ular
// ro'yxatda aynan 1-filialda ko'rinadi (lib/branchScope.ts →
// branchCondition), alohida raqamlansa bitta ro'yxatda ikki xil "1" chiqardi.
//
//   node scripts/backfill-order-branch-no.mjs            -> quruq sinov
//   node scripts/backfill-order-branch-no.mjs --apply    -> yozadi
//
// IDEMPOTENT: raqami bor lidga tegmaydi, davomini o'sha filialning eng
// katta raqamidan boshlaydi. `id` (texnik kalit) O'ZGARMAYDI.
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const APPLY = process.argv.includes("--apply");

const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
try {
  const col = client.db(pick("MONGODB_DB", "crm_akademiya")).collection("orders");
  const rows = await col
    .find({}, { projection: { _id: 0, id: 1, branchId: 1, branchNo: 1 } })
    .sort({ id: 1 })
    .toArray();
  const groups = new Map();
  for (const r of rows) {
    const key = r.branchId ?? 1;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const ops = [];
  for (const [branchId, list] of groups) {
    let next = list.reduce((m, r) => Math.max(m, Number(r.branchNo) || 0), 0) + 1;
    let assigned = 0;
    for (const r of list) {
      if (Number(r.branchNo) > 0) continue;
      ops.push({ updateOne: { filter: { id: r.id, branchNo: { $exists: false } }, update: { $set: { branchNo: next } } } });
      next++;
      assigned++;
    }
    console.log(`branchId=${branchId}: ${list.length} ta lid (filialsiz eskilar 1-filialga), raqam beriladi: ${assigned}, oxirgi raqam: ${next - 1}`);
  }
  if (!APPLY) {
    console.log(`\nQURUQ SINOV — ${ops.length} ta yozuv o'zgaradi. Yozish: --apply`);
  } else if (ops.length) {
    const res = await col.bulkWrite(ops, { ordered: false });
    console.log(`\nYOZILDI: ${res.modifiedCount} ta lidga branchNo berildi`);
  } else {
    console.log("\nHammasida raqam bor — o'zgarish yo'q.");
  }
} finally {
  await client.close();
}
