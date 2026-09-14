// 4-filial (Uchqo'rg'on) sentabr-2026 importidan KEYINGI holatni ko'rsatadi —
// faqat o'qiydi. scripts/_import-uchqorgon-2026-09.mjs yonidagi tekshiruv.
//
//   node scripts/_verify-uchqorgon-2026-09.mjs
//
// MONGODB_URI env'dan, bo'lmasa joriy papkadagi .env.local dan.
import fs from "node:fs";
import { MongoClient } from "mongodb";

function readEnv(k, d) {
  if (process.env[k]) return process.env[k];
  if (!fs.existsSync(".env.local")) return d;
  const env = fs.readFileSync(".env.local", "utf8");
  return (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
}
const client = new MongoClient(readEnv("MONGODB_URI"));
await client.connect();
const db = client.db(readEnv("MONGODB_DB", "crm_akademiya"));
const B = 4;

const gs = await db.collection("groups").find({ branchId: B },
  { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, day: 1, time: 1, room: 1, students: 1, studentIds: 1, eduType: 1, status: 1 } })
  .sort({ id: 1 }).toArray();
console.log(`groups (4-filial): ${gs.length} ta | a'zolik jami: ${gs.reduce((s, g) => s + (g.studentIds ?? []).length, 0)}`);
for (const g of gs) {
  const mismatch = g.students !== (g.studentIds ?? []).length ? "  <-- students != studentIds.length" : "";
  console.log(`  #${g.id} ${g.name} | ${g.course} | ${g.teacher} | ${g.day} ${g.time} | ${g.room} | ${g.students} o'quvchi | ${g.eduType} ${g.status}${mismatch}`);
}
// Har bir a'zo 4-filial pupils ichida bormi?
const ids = [...new Set(gs.flatMap((g) => g.studentIds ?? []))];
const found = await db.collection("pupils").countDocuments({ id: { $in: ids }, branchId: B });
console.log(`studentIds: ${ids.length} unikal id, pupils(4-filial) da topildi: ${found}${found !== ids.length ? "  <-- YETISHMAYDI" : ""}`);
// Bir o'quvchi ikki guruhda bo'lsa — ko'rsat (Excel'da bunday bo'lmasligi kerak edi)
const seen = new Map();
for (const g of gs) for (const id of g.studentIds ?? []) seen.set(id, [...(seen.get(id) ?? []), g.name]);
const multi = [...seen].filter(([, names]) => names.length > 1);
if (multi.length) console.log(`ikki guruhda: ${multi.map(([id, n]) => `#${id} (${n.join(", ")})`).join("; ")}`);

console.log(`pupils (4-filial): jami ${await db.collection("pupils").countDocuments({ branchId: B })}, aktiv ${await db.collection("pupils").countDocuments({ branchId: B, $or: [{ status: "Aktiv" }, { status: { $exists: false } }] })}, "Oylik to'lov" izohi bilan ${await db.collection("pupils").countDocuments({ branchId: B, note: /Oylik to'lov/ })}`);

const teachers = await db.collection("hr_employees").find({ branchIds: B, turi: "teacher" }, { projection: { _id: 0, id: 1, name: 1, kurs: 1, archDate: 1 } }).sort({ id: 1 }).toArray();
console.log(`teachers (4-filial): ${teachers.map((t) => `#${t.id} ${t.name} (${t.kurs || "-"})${t.archDate ? " ARXIV" : ""}`).join(", ")}`);
// Guruhdagi o'qituvchi nomi xodimlar ro'yxatida bormi (select shu nomga qaraydi)
const tnames = new Set(teachers.map((t) => t.name));
for (const g of gs) if (!tnames.has(g.teacher)) console.log(`  <-- guruh #${g.id} o'qituvchisi "${g.teacher}" hr_employees(4) da yo'q`);

const rooms = await db.collection("rooms").find({ branchId: B }, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray();
console.log(`rooms (4-filial): ${rooms.map((r) => `#${r.id} ${r.name}`).join(", ")}`);
const rnames = new Set(rooms.map((r) => r.name));
for (const g of gs) if (!rnames.has(g.room)) console.log(`  <-- guruh #${g.id} xonasi "${g.room}" rooms(4) da yo'q`);

// Kurs nomlari offline_courses bilan mos (kanonik)?
const courses = new Set((await db.collection("offline_courses").find({}, { projection: { _id: 0, name: 1 } }).toArray()).map((c) => c.name));
for (const g of gs) if (!courses.has(g.course)) console.log(`  <-- guruh #${g.id} kursi "${g.course}" offline_courses da yo'q`);

// Yangi o'quvchidan namuna (parol xeshlarisiz)
const sample = await db.collection("pupils").find({ branchId: B, source: "Akademiya'da o'qiydi" },
  { projection: { _id: 0, studentPasswordHash: 0, parentPasswordHash: 0 } }).sort({ id: -1 }).limit(1).toArray();
console.log("eng yangi o'quvchi:", JSON.stringify(sample[0]));
const noted = await db.collection("pupils").findOne({ branchId: B, note: /Oylik to'lov/, id: { $lt: 16987 } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, note: 1 } });
console.log("mavjud o'quvchi izohi namunasi:", JSON.stringify(noted));
await client.close();
