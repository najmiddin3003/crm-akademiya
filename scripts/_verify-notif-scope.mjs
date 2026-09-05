// FAQAT O'QIYDI. Qo'ng'iroq kimga chiqadi, kimga chiqmaydi.
// app/api/notifications/route.ts dagi qorovulni aynan takrorlaydi:
//   admin                       -> chiqadi (hamma kassa)
//   kassa egasi (admin emas)    -> CHIQMAYDI (vaqtincha o'chirilgan)
//   qolganlar                   -> bugungidek
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

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameEq = (name) => ({ $regex: "^" + esc(name.trim()) + "$", $options: "i" });

const users = await db.collection("users")
  .find({}, { projection: { _id: 0, fullName: 1, role: 1, hrEmployeeId: 1 } }).toArray();

console.log("foydalanuvchi                rol         kassa egasimi   qo'ng'iroq");
for (const u of users) {
  const emp = u.hrEmployeeId == null
    ? null
    : await db.collection("hr_employees").findOne({ id: u.hrEmployeeId }, { projection: { _id: 0, name: 1 } });
  const name = String(emp?.name ?? "").trim();
  const box = name
    ? await db.collection("cashboxes").findOne({ moderator: nameEq(name) }, { projection: { _id: 0, id: 1, name: 1 } })
    : null;
  const isAdmin = u.role === "admin";
  const blocked = !isAdmin && !!box;
  console.log(
    `${String(u.fullName).padEnd(28)} ${String(u.role).padEnd(11)} ` +
    `${(box ? `ha (#${box.id})` : "yo'q").padEnd(15)} ${blocked ? "O'CHIQ" : "chiqadi"}`,
  );
}

await c.close();
