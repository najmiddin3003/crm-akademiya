// Excel'dan guruhlarni import qiladi (+ xonalarni guruhlar faylidan hosil qiladi).
//
// Sukut bo'yicha QURUQ YURISH. Yozish uchun `--yes`.
//
//   node scripts/import-groups-from-excel.mjs             → nima bo'lishini ko'rsatadi
//   node scripts/import-groups-from-excel.mjs --yes       → bajaradi
//
// Oldin zaxira: node scripts/_backup-db.mjs
//
// A'ZOLIK BU YERDA EMAS. Fayldagi "O'quvchilar" ustuni faqat SON, undan kim
// qaysi guruhda ekanini tiklab bo'lmaydi — shuning uchun studentIds bo'sh
// qoladi va alohida a'zolik faylidan to'ldiriladi.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const APPLY = process.argv.includes("--yes");
const GROUPS_XLSX = process.argv.find((a) => a.endsWith(".xlsx") && !a.startsWith("--"))
  || "C:/Users/zovaxx/Downloads/1787642203969.xlsx";

const norm = (v) => String(v ?? "").replace(/[\u2019\u02BB\u02BC`]/g, "'").replace(/\s+/g, " ").trim();

/** "02.09.2025" → "2025-09-02"; tushunarsiz bo'lsa bo'sh satr. */
function isoDate(dmy) {
  const m = norm(dmy).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

const EDU_TYPE = { offline: "Oflayn", online: "Onlayn" };

const rows = XLSX.utils
  .sheet_to_json(XLSX.readFile(GROUPS_XLSX).Sheets["Export"], { header: 1, defval: "" })
  .slice(1)
  .filter((r) => norm(r[0]));

const today = new Date().toISOString().slice(0, 10);
const groups = [];
const roomNames = new Set();
const skipped = [];

for (const r of rows) {
  const name = norm(r[0]);
  const period = norm(r[7]);
  const [fromDmy, toDmy] = period.split("-").map((x) => norm(x));
  const startDate = isoDate(fromDmy);
  const endDate = isoDate(toDmy);
  const room = norm(r[10]);
  if (room) roomNames.add(room);

  const start = norm(r[4]);
  const end = norm(r[5]);
  const time = start && end ? `${start} - ${end}` : "";
  if (!time) skipped.push(`${name}: dars vaqti yo'q`);

  groups.push({
    id: groups.length + 1,
    name,
    course: norm(r[1]),
    level: norm(r[2]),
    day: norm(r[3]),
    time,
    period,
    // Ilovaning o'z route'lari bu maydonni doim false yozadi va hech qachon
    // qayta hisoblamaydi. Import paytida esa haqiqiy qiymat ma'lum, shuning
    // uchun muddati o'tgan guruhlar rostgo'y qizil belgi oladi.
    periodExpired: !!endDate && endDate < today,
    // studentIds bo'sh bo'lgani uchun sanoq ham 0 — fayldagi son bu yerga
    // yozilsa, ro'yxatda bo'lmagan o'quvchilar borday ko'rinardi.
    students: 0,
    teacher: norm(r[9]),
    room,
    telegram: norm(r[11]) || null,
    status: norm(r[12]) || "active",
    // GET /api/groups buni har so'rovda qayta hisoblaydi.
    highlighted: false,
    eduType: EDU_TYPE[norm(r[6]).toLowerCase()] ?? "Oflayn",
    assistant: "",
    startDate,
    endDate,
    studentIds: [],
  });
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);

const empNames = new Set(
  (await db.collection("hr_employees").find({}).project({ name: 1 }).toArray())
    .map((e) => norm(e.name).toLowerCase()),
);
const courseNames = new Set(
  (await db.collection("offline_courses").find({}).project({ name: 1 }).toArray())
    .map((c) => norm(c.name).toLowerCase()),
);

const { GROUP_DAYS } = await import("../constants/groups.js");
const badDays = groups.filter((g) => !GROUP_DAYS.includes(g.day));
const badTeachers = groups.filter((g) => g.teacher && !empNames.has(g.teacher.toLowerCase()));
const badCourses = groups.filter((g) => g.course && !courseNames.has(g.course.toLowerCase()));

console.log(APPLY ? "=== BAJARILMOQDA ===\n" : "=== QURUQ YURISH — bazaga hech narsa yozilmaydi ===\n");
console.log(`Fayl: ${GROUPS_XLSX}`);
console.log(`\nGURUHLAR`);
console.log(`  import qilinadi   : ${groups.length}  (id 1…${groups.length})`);
console.log(`  muddati o'tgan    : ${groups.filter((g) => g.periodExpired).length}`);
console.log(`  xonalar           : ${roomNames.size}`);

const byDay = {};
groups.forEach((g) => { byDay[g.day] = (byDay[g.day] ?? 0) + 1; });
console.log(`  kunlar            :`, JSON.stringify(byDay));

console.log(`\nTEKSHIRUV`);
console.log(`  noto'g'ri kun     : ${badDays.length}${badDays.length ? " → " + badDays.map((g) => `${g.name}(${g.day})`).join(", ") : " ✓"}`);
console.log(`  topilmagan ustoz  : ${badTeachers.length}${badTeachers.length ? " → " + badTeachers.map((g) => g.teacher).join(", ") : " ✓"}`);
console.log(`  topilmagan kurs   : ${badCourses.length}${badCourses.length ? " → " + badCourses.map((g) => g.course).join(", ") : " ✓"}`);
console.log(`  vaqtsiz guruh     : ${skipped.length}${skipped.length ? " → " + skipped.join(", ") : " ✓"}`);

const dupNames = Object.entries(
  groups.reduce((m, g) => { m[g.name] = (m[g.name] ?? 0) + 1; return m; }, {}),
).filter(([, n]) => n > 1);
console.log(`  takroriy nom      : ${dupNames.length}${dupNames.length ? " → " + dupNames.map(([n, c]) => `${n}×${c}`).join(", ") + "  (ataylab saqlanadi)" : ""}`);

console.log(`\nNAMUNALAR`);
for (const g of groups.slice(0, 4)) {
  console.log(`  #${g.id} "${g.name}" | ${g.course} ${g.level || ""} | ${g.day} ${g.time} | ${g.teacher} | ${g.room} | ${g.eduType}`);
}

const existingGroups = await db.collection("groups").countDocuments();
const existingRooms = await db.collection("rooms").countDocuments();
console.log(`\nBAZADA HOZIR: groups=${existingGroups}, rooms=${existingRooms}`);
if (existingGroups > 0) console.log(`  ⚠ groups bo'sh emas — import ustiga yozmaydi, avval tozalash kerak.`);

if (!APPLY) {
  console.log(`\nHaqiqatan bajarish uchun: node scripts/import-groups-from-excel.mjs --yes`);
  await client.close();
  process.exit(0);
}

if (badTeachers.length || badCourses.length || badDays.length) {
  console.error("\nTo'xtatildi: yuqoridagi mos kelmagan qiymatlar avval tuzatilsin.");
  await client.close();
  process.exit(1);
}

const roomCol = db.collection("rooms");
let roomId = (await roomCol.find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id ?? 0;
const haveRooms = new Set((await roomCol.find({}).toArray()).map((r) => norm(r.name).toLowerCase()));
let addedRooms = 0;
for (const name of [...roomNames].sort()) {
  if (haveRooms.has(name.toLowerCase())) continue;
  // Sig'im faylda yo'q — 0 qoladi, egasi Xonalar sahifasida to'ldiradi.
  await roomCol.insertOne({ id: ++roomId, name, capacity: 0, note: "" });
  addedRooms++;
}

await db.collection("groups").insertMany(groups, { ordered: false });

console.log(`\n✓ guruh : ${await db.collection("groups").countDocuments()}`);
console.log(`✓ xona  : ${await roomCol.countDocuments()} (yangi ${addedRooms})`);
console.log(`\nKeyingi qadam: guruh a'zoligi fayli (kim qaysi guruhda) — studentIds hozir bo'sh.`);
await client.close();
