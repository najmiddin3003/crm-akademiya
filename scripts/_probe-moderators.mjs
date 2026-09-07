// FAQAT O'QIYDI. Kim moderator, admin hisobi qaysi xodimga bog'langan va
// moderator rolida /orders-list ruxsati bormi — shuni ko'rsatadi.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const dbName = (/^MONGODB_DB=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))?.[1] || "").trim().replace(/^["']|["']$/g, "") || "crm_akademiya";
const db = client.db(dbName);
console.log("baza:", dbName);

const emps = await db.collection("hr_employees")
  .find({}, { projection: { id: 1, name: 1, turi: 1, permissions: 1, archReason: 1 } }).toArray();
const byTuri = {};
for (const e of emps) byTuri[e.turi ?? "(yo'q)"] = (byTuri[e.turi ?? "(yo'q)"] || 0) + 1;
console.log("hr_employees.turi taqsimoti:", byTuri);

const mods = emps.filter((e) => e.turi === "moderator");
console.log(`\nmoderatorlar: ${mods.length}`);
for (const m of mods) {
  const own = Array.isArray(m.permissions)
    ? `shaxsiy ruxsat ${m.permissions.length} ta, /orders-list ${m.permissions.includes("/orders-list") ? "BOR" : "YO'Q"}`
    : "rol ruxsatidan";
  console.log(`  id ${m.id} — ${m.name}${m.archReason ? " [ARXIV]" : ""}  (${own})`);
}

const role = await db.collection("roles").findOne({ key: "moderator" }, { projection: { name: 1, permissions: 1 } });
console.log(`\nmoderator ROLI: ${role?.name}`);
if (Array.isArray(role?.permissions)) {
  console.log(`  /orders-list:     ${role.permissions.includes("/orders-list") ? "BOR" : "YO'Q"}`);
  console.log(`  /groups-schedule: ${role.permissions.includes("/groups-schedule") ? "BOR" : "YO'Q"}`);
  console.log(`  jami ${role.permissions.length} ta: ${role.permissions.join(", ")}`);
} else {
  console.log("  permissions maydoni yo'q -> CHEKLOVSIZ");
}

const users = await db.collection("users")
  .find({}, { projection: { fullName: 1, role: 1, hrEmployeeId: 1, status: 1 } }).toArray();
console.log(`\nusers: ${users.length}`);
for (const u of users) {
  const e = emps.find((x) => x.id === Number(u.hrEmployeeId));
  console.log(`  ${u.fullName} | users.role=${u.role} | hrEmployeeId=${u.hrEmployeeId ?? "-"} -> ${e ? `${e.name} (turi=${e.turi})` : "topilmadi"} | ${u.status}`);
}

await client.close();
