// FAQAT O'QIYDI. app/(app)/home/page.tsx dagi qarorni HAR BIR hisob uchun
// takrorlab, kim qayerga tushishini ko'rsatadi.
import { MongoClient } from "mongodb";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const HOME_BY_POSITION = { moderator: "/orders-list" };
const ALWAYS = new Set(["/settings-profile", "/settings-security", "/settings-devices", "/birthdays", "/home", "/dashboard"]);
const allowed = (path, perms) => perms === null || ALWAYS.has(path) || perms.includes(path);

// lib/rolePermissions.ts -> resolvePermissions
async function permsOf(u) {
  if (u.role === "admin") return null;
  const emp = await db.collection("hr_employees").findOne({ id: Number(u.hrEmployeeId) }, { projection: { turi: 1, permissions: 1 } });
  if (!emp) return null;
  if (Array.isArray(emp.permissions)) return emp.permissions;
  if (emp.turi !== "teacher" && emp.turi !== "moderator") return null;
  const role = await db.collection("roles").findOne({ key: emp.turi }, { projection: { permissions: 1 } });
  if (!role) return null;
  return Array.isArray(role.permissions) ? role.permissions : null;
}

const users = await db.collection("users").find({}, { projection: { fullName: 1, role: 1, hrEmployeeId: 1, status: 1 } }).toArray();
for (const u of users) {
  const emp = await db.collection("hr_employees").findOne({ id: Number(u.hrEmployeeId) }, { projection: { turi: 1, name: 1 } });
  const perms = await permsOf(u);

  // 1) lavozim manzili
  let where, why;
  const target = (u.role === "admin" || !Number.isFinite(Number(u.hrEmployeeId))) ? null : HOME_BY_POSITION[String(emp?.turi ?? "")];
  if (target && allowed(target, perms)) { where = target; why = `lavozim=${emp?.turi}`; }
  else if (target) { where = "(halqa oldi olindi)"; why = `lavozim=${emp?.turi}, lekin ${target} ruxsati yo'q`; }
  else if (allowed("/groups-schedule", perms)) { where = "Dars jadvali"; why = u.role === "admin" ? "admin (cheklovsiz)" : `turi=${emp?.turi}, /groups-schedule ruxsati bor`; }
  else { where = "Xush kelibsiz ekrani"; why = `turi=${emp?.turi}, /groups-schedule ruxsati yo'q`; }

  console.log(`${(u.fullName + "                        ").slice(0, 26)} -> ${(where + "                    ").slice(0, 22)} (${why})`);
}
await client.close();
