// FAQAT O'QIYDI — kassa qamrovini bazadagi haqiqiy hisoblar bilan tekshiradi.
//
// lib/currentEmployee.ts dagi zanjirni takrorlaydi:
//   users.hrEmployeeId → hr_employees.id → hr_employees.name
//   → cashboxes.moderator (katta-kichik harf farqlanmaydi)
//
// Har bir foydalanuvchi uchun unga qaysi kassa ko'rinishini chop etadi.
// Ishga tushirish:  node scripts/_verify-cashbox-scope.mjs
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const uri = env.match(/^MONGODB_URI=(.+)$/m)?.[1]?.trim();
const dbName = env.match(/^MONGODB_DB=(.+)$/m)?.[1]?.trim() || "crm";
if (!uri) throw new Error(".env.local ichida MONGODB_URI topilmadi");

const client = new MongoClient(uri, { maxPoolSize: 5 }); // zip.md qoidasi: skriptlar 5 dan oshmasin
await client.connect();
const db = client.db(dbName);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const eq = (name) => ({ $regex: `^${esc(name.trim())}$`, $options: "i" });

const users = await db.collection("users").find({}).toArray();
const boxes = await db.collection("cashboxes").find({}).sort({ id: 1 }).toArray();

console.log(`Kassalar (${boxes.length}):`);
for (const b of boxes) {
  console.log(`  ${b.id}  ${b.name}  → mas'ul: "${b.moderator}"${b.archived ? "  [arxiv]" : ""}`);
}
console.log();

for (const u of users) {
  const rol = u.role || "employee";
  if (rol === "admin") {
    console.log(`${u.fullName} (${u.phone}) — admin → HAMMA kassa (${boxes.length} ta)`);
    continue;
  }
  const empId = Number(u.hrEmployeeId);
  if (!Number.isFinite(empId)) {
    console.log(`${u.fullName} (${u.phone}) — hrEmployeeId YO'Q → 0 ta kassa`);
    continue;
  }
  const emp = await db.collection("hr_employees").findOne({ id: empId }, { projection: { name: 1 } });
  const name = (emp?.name ?? "").trim();
  if (!name) {
    console.log(`${u.fullName} (${u.phone}) — hr_employees ${empId} topilmadi → 0 ta kassa`);
    continue;
  }
  const mine = await db.collection("cashboxes").find({ moderator: eq(name) }).toArray();
  console.log(
    `${u.fullName} (${u.phone}) — xodim ${empId} "${name}" → ${mine.length} ta kassa` +
      (mine.length ? `: ${mine.map((c) => `${c.id} ${c.name}`).join(", ")}` : ""),
  );
}

await client.close();
