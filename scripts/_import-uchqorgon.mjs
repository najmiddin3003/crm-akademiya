// "O'QUVCHILAR RO'YXATI.xlsx" -> 4-filial (Akademiya 4 Uchqo'rg'on).
//
//   node scripts/_import-uchqorgon.mjs "<fayl>"            -> QURUQ YURISH (yozmaydi)
//   node scripts/_import-uchqorgon.mjs "<fayl>" --apply    -> bazaga yozadi
//   node scripts/_import-uchqorgon.mjs --undo              -> hammasini qaytarib oladi
//
// Nima yaratadi: 2 ta kurs (umumiy), 5 ta xona, 5 ta o'qituvchi, 59 ta
// o'quvchi, 18 ta guruh — hammasi `branchId: 4` bilan (kurslardan tashqari,
// ular umumiy sozlama).
//
// Hujjat shakllari ILOVANING O'Z route'laridan ko'chirilgan:
//   pupils  -> app/api/pupils POST (buildPupilFromValues + branchId)
//   groups  -> app/api/groups POST
//   rooms   -> app/api/rooms POST
//   courses -> app/api/offline-courses POST
//   xodim   -> app/api/hr-employees POST
//
// `id` HAR BIR kolleksiyada GLOBAL ketma-ket — filial bo'yicha kesilmaydi,
// aks holda ikkinchi filial mavjud id ni qayta ishlatib E11000 ga urilardi.
//
// QAYTARIB OLISH: yozilgan har bir id `scripts/_uchqorgon-import-receipt.json`
// ga saqlanadi va `--undo` faqat o'shalarni o'chiradi — qo'lda kiritilgan
// yozuvlarga tegmaydi.
import XLSX from "xlsx";
import fs from "node:fs";
import { MongoClient } from "mongodb";

const RECEIPT = "scripts/_uchqorgon-import-receipt.json";
const BRANCH_ID = 4;
const BRANCH_NAME = "Akademiya 4 Uchqo'rg'on";
const SOURCE = "Akademiya'da o'qiydi";

const env = fs.readFileSync(".env.local", "utf8");
const pick = (k, d) => (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
const client = new MongoClient(pick("MONGODB_URI"));
await client.connect();
const db = client.db(pick("MONGODB_DB", "crm_akademiya"));

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");

// ── Qaytarib olish ───────────────────────────────────────────────────────
if (UNDO) {
  if (!fs.existsSync(RECEIPT)) { console.log("Kvitansiya topilmadi — o'chiradigan narsa yo'q."); await client.close(); process.exit(0); }
  const r = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  for (const [coll, ids] of Object.entries(r.created ?? {})) {
    if (!ids.length) continue;
    const res = await db.collection(coll).deleteMany({ id: { $in: ids } });
    console.log(`${coll}: ${res.deletedCount} ta o'chirildi`);
  }
  fs.unlinkSync(RECEIPT);
  console.log("Qaytarib olindi.");
  await client.close();
  process.exit(0);
}

const file = process.argv[2];
if (!file) { console.error("Fayl yo'lini bering"); await client.close(); process.exit(1); }

// ── Excel -> reja ────────────────────────────────────────────────────────
const SHEET_RANK = { SENTYABR: 0, AVGUST: 1, IYUL: 2, QABUL: 3 };
const DAY_MAP = { "D.CH.J": "Toq kunlar", "S.P.SH": "Juft kunlar" };
const COURSE_MAP = {
  "KOREYS TILI": "Koreys tili", "INGLIZ TILI": "Ingliz tili", "INGLIZ TILI CEFR": "Ingliz tili",
  "ARAB TILI": "Arab tili", "RUS TILI": "Rus tili", "BIOLOGIYA": "Biologiya",
  "TURK TILI": "Turk tili", "XUQUQ": "Huquq",
  "NEMIS TILI": "Nemis tili", "IT(WEBS DESIGN)": "IT (Web dizayn)",
};
const NEW_COURSES = [
  { name: "Nemis tili", color: "#8e24aa" },
  { name: "IT (Web dizayn)", color: "#00897b" },
];

const nameKey = (s) => String(s ?? "").toUpperCase().replace(/[’'`]/g, "'").replace(/\s+/g, " ").trim();
const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();
const titleAll = (s) => nameKey(s).split(" ").filter(Boolean).map(title).join(" ");
const normDay = (v) => DAY_MAP[String(v ?? "").toUpperCase().replace(/\s+/g, "")] ?? "";
const normTime = (v) => {
  const m = String(v ?? "").match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(m[1])}:${m[2]} - ${p(m[3])}:${m[4]}`;
};
function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  if (d.length === 8) d = "0" + d;
  if (d.length !== 9) return "";
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}
function normDate(raw) {
  const m = String(raw ?? "").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (!m) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(m[1])}.${p(m[2])}.${m[3]} | 09:00`;
}
function splitName(full) {
  const parts = nameKey(full).split(" ").filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return { firstName: title(parts[0]), lastName: "" };
  return { lastName: title(parts[0]), firstName: parts.slice(1).map(title).join(" ") };
}

const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
const pad = (n) => String(n).padStart(2, "0");
const NOW_STAMP = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const wb = XLSX.readFile(file);
const cell = (r, i) => String(r[i] ?? "").trim();
const raws = [];
for (const sheet of wb.SheetNames) {
  if (sheet === "OQITUVCHILAR") continue;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => String(c).trim() === "")) continue;
    const isQabul = sheet === "QABUL";
    const full = isQabul ? cell(r, 1) : cell(r, 2);
    if (!full || /^(F[.,]?\s*I[.,]?\s*SH|JAMI|UMUMIY|TOTAL|O'?QITUVCHI)/i.test(full) || /^\d+$/.test(full)) continue;
    const split = splitName(full);
    if (!split) continue;
    raws.push({
      sheet, rank: SHEET_RANK[sheet] ?? 9, full: nameKey(full), ...split,
      phone: normPhone(isQabul ? cell(r, 4) : cell(r, 3)),
      extraPhone: normPhone(isQabul ? cell(r, 5) : cell(r, 4)),
      fan: (isQabul ? cell(r, 2) : cell(r, 5)).toUpperCase().replace(/\s+/g, " ").trim(),
      day: normDay(isQabul ? cell(r, 3) : cell(r, 6)),
      time: isQabul ? "" : normTime(cell(r, 7)),
      teacher: isQabul ? "" : titleAll(cell(r, 1)),
      arrived: isQabul ? "" : normDate(cell(r, 8)),
    });
  }
}

const byName = new Map();
for (const r of raws) {
  if (!byName.has(r.full)) byName.set(r.full, []);
  byName.get(r.full).push(r);
}
const pupils = [];
for (const [key, list] of byName) {
  list.sort((a, b) => a.rank - b.rank);
  const latest = list[0];
  pupils.push({
    key, firstName: latest.firstName, lastName: latest.lastName,
    phone: list.map((r) => r.phone).find(Boolean) ?? "",
    extraPhone: list.map((r) => r.extraPhone).find(Boolean) ?? "",
    createdAt: list.map((r) => r.arrived).find(Boolean) ?? NOW_STAMP,
    fan: latest.fan, day: latest.day, time: latest.time, teacher: latest.teacher,
  });
}
pupils.sort((a, b) => a.key.localeCompare(b.key));

const groupMap = new Map();
for (const p of pupils) {
  if (!p.teacher || !p.fan || !p.day || !p.time) continue;
  const course = COURSE_MAP[p.fan] ?? "";
  const gk = `${p.teacher}|${course}|${p.day}|${p.time}`;
  if (!groupMap.has(gk)) groupMap.set(gk, { teacher: p.teacher, course, day: p.day, time: p.time, members: [] });
  groupMap.get(gk).members.push(p.key);
}
const groups = [...groupMap.values()].sort((a, b) =>
  a.teacher.localeCompare(b.teacher) || a.course.localeCompare(b.course) || a.time.localeCompare(b.time));
groups.forEach((g, i) => { g.name = `UCH-${i + 1}`; });

// XONA TAQSIMOTI FAYLDAN EMAS — bir vaqtda ketadigan guruhlar bir xonaga
// tushmasligi uchun mexanik joylashtiriladi. Foydalanuvchi keyin tuzatadi.
//
// VAQT KESISHISHI bo'yicha, aynan tenglik bo'yicha EMAS: "13:00 - 15:00" va
// "14:00 - 15:00" bir xonada tura olmaydi. Birinchi urinishda shu e'tiborga
// olinmagandi va jadvalda kesishgan darslardan biri UMUMAN chizilmasdi —
// buildMatrices() (components/groups/GroupSchedulePage.tsx) bir katakka
// ikkinchi darsni qo'ymaydi. Xona soni kerak bo'lganicha o'sadi.
const mins = (hhmm) => { const m = String(hhmm).match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
const rangeOf = (t) => { const m = String(t).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/); return m ? { from: mins(m[1]), to: mins(m[2]) } : null; };
const overlaps = (a, b) => a.from < b.to && b.from < a.to;

const ROOM_NAMES = [];
const busyByDay = new Map();
// Boshlanish vaqti bo'yicha tartib — ochko'z joylashtirish shunda optimal.
for (const g of [...groups].sort((a, b) => a.day.localeCompare(b.day) || mins(a.time) - mins(b.time))) {
  const r = rangeOf(g.time);
  if (!r) { g.room = ""; continue; }
  if (!busyByDay.has(g.day)) busyByDay.set(g.day, new Map());
  const perRoom = busyByDay.get(g.day);
  let chosen = "";
  for (const room of ROOM_NAMES) {
    if (!(perRoom.get(room) ?? []).some((t) => overlaps(t, r))) { chosen = room; break; }
  }
  if (!chosen) { chosen = `${ROOM_NAMES.length + 1} - xona`; ROOM_NAMES.push(chosen); }
  perRoom.set(chosen, [...(perRoom.get(chosen) ?? []), r]);
  g.room = chosen;
}

const teachers = [...new Set(groups.map((g) => g.teacher))].sort();
const teacherCourse = new Map();
for (const g of groups) if (!teacherCourse.has(g.teacher)) teacherCourse.set(g.teacher, g.course);

// ── Hisobot ──────────────────────────────────────────────────────────────
console.log(`${APPLY ? "YOZILADI" : "QURUQ YURISH (bazaga tegilmaydi)"}\n`);
console.log(`  kurs (umumiy):  ${NEW_COURSES.length} ta -> ${NEW_COURSES.map((c) => c.name).join(", ")}`);
console.log(`  xona (4-filial): ${ROOM_NAMES.length} ta`);
console.log(`  o'qituvchi:      ${teachers.length} ta -> ${teachers.join(", ")}`);
console.log(`  o'quvchi:        ${pupils.length} ta`);
console.log(`  guruh:           ${groups.length} ta`);
console.log(`  guruhsiz o'quvchi: ${pupils.filter((p) => !p.teacher).length} ta`);

// ── Takrorni oldini olish ────────────────────────────────────────────────
const existingPhones = new Set(
  (await db.collection("pupils").find({ phone: { $in: pupils.map((p) => p.phone).filter(Boolean) } },
    { projection: { _id: 0, phone: 1 } }).toArray()).map((r) => r.phone),
);
const dupes = pupils.filter((p) => p.phone && existingPhones.has(p.phone));
if (dupes.length) {
  console.log(`\n  DIQQAT: ${dupes.length} ta telefon bazada allaqachon bor — ular O'TKAZIB YUBORILADI:`);
  for (const d of dupes) console.log(`    ${d.firstName} ${d.lastName}  ${d.phone}`);
}
const toInsert = pupils.filter((p) => !p.phone || !existingPhones.has(p.phone));

if (!APPLY) {
  console.log(`\nYozish uchun: node scripts/_import-uchqorgon.mjs "<fayl>" --apply`);
  await client.close();
  process.exit(0);
}

// ── Yozish ───────────────────────────────────────────────────────────────
const receipt = { at: NOW_STAMP, branchId: BRANCH_ID, created: { offline_courses: [], rooms: [], hr_employees: [], pupils: [], groups: [] } };
const nextIdOf = async (coll) => ((await db.collection(coll).find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id ?? 0) + 1;

// 1) Kurslar (umumiy — branchId YO'Q, boshqa kurslar kabi)
let cid = await nextIdOf("offline_courses");
for (const c of NEW_COURSES) {
  const has = await db.collection("offline_courses").findOne({ name: c.name });
  if (has) { console.log(`kurs "${c.name}" allaqachon bor — o'tkazildi`); continue; }
  const doc = { id: cid++, name: c.name, color: c.color, branches: [], levels: [] };
  await db.collection("offline_courses").insertOne({ ...doc });
  receipt.created.offline_courses.push(doc.id);
}

// 2) Xonalar
let rid = await nextIdOf("rooms");
const roomIdByName = new Map();
for (const nm of ROOM_NAMES) {
  const has = await db.collection("rooms").findOne({ name: nm, branchId: BRANCH_ID });
  if (has) { roomIdByName.set(nm, has.id); continue; }
  const doc = { id: rid++, name: nm, capacity: 0, note: "", branchId: BRANCH_ID };
  await db.collection("rooms").insertOne({ ...doc });
  roomIdByName.set(nm, doc.id);
  receipt.created.rooms.push(doc.id);
}

// 3) O'qituvchilar (hr_employees, turi: "teacher")
let eid = await nextIdOf("hr_employees");
for (const t of teachers) {
  const has = await db.collection("hr_employees").findOne({ name: t, turi: "teacher", branchIds: BRANCH_ID });
  if (has) { console.log(`o'qituvchi "${t}" allaqachon bor — o'tkazildi`); continue; }
  const doc = {
    id: eid++, name: t, gender: "", aktivOq: 0, groups: groups.filter((g) => g.teacher === t).length,
    turi: "teacher", filial: BRANCH_NAME, phone: "", kurs: teacherCourse.get(t) ?? "",
    created: NOW_STAMP, lastActive: "", archReason: "", archDate: "", email: "",
    percent: "", degree: "", photoUrl: "", branchAssignments: [], taxIds: [],
    permissions: null, branchIds: [BRANCH_ID], plastikSalary: null, payrollBranchId: BRANCH_ID,
  };
  await db.collection("hr_employees").insertOne({ ...doc });
  receipt.created.hr_employees.push(doc.id);
}

// 4) O'quvchilar
let pid = await nextIdOf("pupils");
const pupilIdByKey = new Map();
for (const p of toInsert) {
  const doc = {
    firstName: p.firstName, lastName: p.lastName, phone: p.phone, extraPhone: p.extraPhone,
    category: "", birthDate: "", source: SOURCE,
    id: pid++, createdAt: p.createdAt, balance: 0, coin: 0, moderator: "", status: "Aktiv",
    branchId: BRANCH_ID,
  };
  await db.collection("pupils").insertOne({ ...doc });
  pupilIdByKey.set(p.key, doc.id);
  receipt.created.pupils.push(doc.id);
}
// O'tkazib yuborilganlarni ham guruhga bog'lay olish uchun id'sini topamiz.
for (const d of dupes) {
  const row = await db.collection("pupils").findOne({ phone: d.phone }, { projection: { _id: 0, id: 1 } });
  if (row) pupilIdByKey.set(d.key, row.id);
}

// 5) Guruhlar
let gid = await nextIdOf("groups");
for (const g of groups) {
  const studentIds = g.members.map((k) => pupilIdByKey.get(k)).filter((x) => typeof x === "number");
  const doc = {
    id: gid++, name: g.name, course: g.course, level: "", day: g.day, time: g.time,
    period: "", periodExpired: false, students: studentIds.length,
    teacher: g.teacher, room: g.room, telegram: null, status: "active",
    highlighted: false, studentIds, branchId: BRANCH_ID,
  };
  await db.collection("groups").insertOne({ ...doc });
  receipt.created.groups.push(doc.id);
}

fs.writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2), "utf8");
console.log(`\nYOZILDI:`);
for (const [coll, ids] of Object.entries(receipt.created)) console.log(`  ${coll.padEnd(16)} ${ids.length} ta`);
console.log(`\nKvitansiya: ${RECEIPT}`);
console.log(`Qaytarib olish: node scripts/_import-uchqorgon.mjs --undo`);

await client.close();
