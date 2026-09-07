// FAQAT O'QIYDI (bazaga tegmaydi). Excel'dan 4-filial uchun TO'LIQ import
// rejasini tuzadi: o'quvchilar + o'qituvchilar + guruhlar.
//
//   node scripts/_plan-uchqorgon-import.mjs "<fayl>" [--json <chiqish>]
//
// QOIDA: o'quvchining JORIY holati eng oxirgi varaqdagi qatoridan olinadi
// (SENTYABR > AVGUST > IYUL > QABUL). Aks holda iyuldagi eski guruh
// sentyabrdagisini bosib ketardi.
import XLSX from "xlsx";
import fs from "node:fs";

const file = process.argv[2];
if (!file) { console.error("Fayl yo'lini bering"); process.exit(1); }

// Yangidan eskiga: birinchisi ustun.
const SHEET_RANK = { SENTYABR: 0, AVGUST: 1, IYUL: 2, QABUL: 3 };

// Excel'dagi qisqartma -> constants/groups.js dagi GROUP_DAYS qiymati.
//   D.CH.J  = Dushanba, Chorshanba, Juma   -> toq kunlar
//   S.P.SH  = Seshanba, Payshanba, Shanba  -> juft kunlar
const DAY_MAP = { "D.CH.J": "Toq kunlar", "S.P.SH": "Juft kunlar" };
const normDay = (v) => DAY_MAP[String(v ?? "").toUpperCase().replace(/\s+/g, "")] ?? "";

// Excel FAN -> bazadagi kurs nomi (offline_courses, umumiy sozlama).
const COURSE_MAP = {
  "KOREYS TILI": "Koreys tili",
  "INGLIZ TILI": "Ingliz tili",
  "INGLIZ TILI CEFR": "Ingliz tili",
  "ARAB TILI": "Arab tili",
  "RUS TILI": "Rus tili",
  "BIOLOGIYA": "Biologiya",
  "TURK TILI": "Turk tili",
  "XUQUQ": "Huquq",
  "NEMIS TILI": "Nemis tili",        // BAZADA YO'Q — yaratish kerak
  "IT(WEBS DESIGN)": "IT (Web dizayn)", // BAZADA YO'Q — yaratish kerak
};

const normTime = (v) => {
  const m = String(v ?? "").match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(m[1])}:${m[2]} - ${p(m[3])}:${m[4]}`;
};

const nameKey = (s) => String(s ?? "").toUpperCase().replace(/[’'`]/g, "'").replace(/\s+/g, " ").trim();
const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();
function splitName(full) {
  const parts = nameKey(full).split(" ").filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return { firstName: title(parts[0]), lastName: "" };
  return { lastName: title(parts[0]), firstName: parts.slice(1).map(title).join(" ") };
}
function normPhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  if (d.length === 8) d = "0" + d;
  if (d.length !== 9) return "";
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}
/** "04.06.2026" -> "04.06.2026 | 09:00" (bazadagi createdAt formati). */
function normDate(raw) {
  const m = String(raw ?? "").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (!m) return "";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(m[1])}.${p(m[2])}.${m[3]} | 09:00`;
}

const wb = XLSX.readFile(file);
const cell = (r, i) => String(r[i] ?? "").trim();
const rows = [];

for (const sheet of wb.SheetNames) {
  if (sheet === "OQITUVCHILAR") continue;
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => String(c).trim() === "")) continue;
    const isQabul = sheet === "QABUL";
    const full = isQabul ? cell(r, 1) : cell(r, 2);
    if (!full || /^(F[.,]?\s*I[.,]?\s*SH|JAMI|UMUMIY|TOTAL|O'?QITUVCHI)/i.test(full) || /^\d+$/.test(full)) continue;
    const split = splitName(full);
    if (!split) continue;
    rows.push({
      sheet, rank: SHEET_RANK[sheet] ?? 9, row: i + 1, full: nameKey(full), ...split,
      phone: normPhone(isQabul ? cell(r, 4) : cell(r, 3)),
      extraPhone: normPhone(isQabul ? cell(r, 5) : cell(r, 4)),
      fan: (isQabul ? cell(r, 2) : cell(r, 5)).toUpperCase().replace(/\s+/g, " ").trim(),
      day: normDay(isQabul ? cell(r, 3) : cell(r, 6)),
      time: isQabul ? "" : normTime(cell(r, 7)),
      teacher: isQabul ? "" : cell(r, 1).toUpperCase().trim(),
      arrived: isQabul ? "" : normDate(cell(r, 8)),
    });
  }
}

// ── O'quvchilar: eng yangi qatordan joriy holat ──────────────────────────
const byName = new Map();
for (const r of rows) {
  if (!byName.has(r.full)) byName.set(r.full, []);
  byName.get(r.full).push(r);
}
const pupils = [];
for (const [key, list] of byName) {
  list.sort((a, b) => a.rank - b.rank);
  const latest = list[0];
  pupils.push({
    key,
    firstName: latest.firstName,
    lastName: latest.lastName,
    phone: list.map((r) => r.phone).find(Boolean) ?? "",
    extraPhone: list.map((r) => r.extraPhone).find(Boolean) ?? "",
    createdAt: list.map((r) => r.arrived).find(Boolean) ?? "",
    fan: latest.fan,
    day: latest.day,
    time: latest.time,
    teacher: latest.teacher,
    fromSheet: latest.sheet,
    seenIn: list.map((r) => r.sheet),
  });
}
pupils.sort((a, b) => a.key.localeCompare(b.key));

// ── Guruhlar: (o'qituvchi, kurs, kun, vaqt) ──────────────────────────────
const groups = new Map();
for (const p of pupils) {
  if (!p.teacher || !p.fan || !p.day || !p.time) continue;
  const course = COURSE_MAP[p.fan] ?? "";
  const gk = `${p.teacher}|${course || p.fan}|${p.day}|${p.time}`;
  if (!groups.has(gk)) {
    groups.set(gk, { teacher: p.teacher, fanRaw: p.fan, course, day: p.day, time: p.time, members: [] });
  }
  groups.get(gk).members.push(p.key);
}
const groupList = [...groups.values()].sort((a, b) =>
  a.teacher.localeCompare(b.teacher) || a.course.localeCompare(b.course) || a.time.localeCompare(b.time));

// Nomlash: UCH-1 … UCH-N (1-filial nomlari bilan chalkashmasin).
groupList.forEach((g, i) => { g.name = `UCH-${i + 1}`; });

const teachers = [...new Set(groupList.map((g) => g.teacher))].sort();
const missingCourses = [...new Set(groupList.filter((g) => !g.course).map((g) => g.fanRaw))];
const needCourses = [...new Set(groupList.map((g) => g.course).filter((c) => c === "Nemis tili" || c === "IT (Web dizayn)"))];
const noGroup = pupils.filter((p) => !p.teacher || !p.day || !p.time);
const noDate = pupils.filter((p) => !p.createdAt);

// Bir vaqtda nechta guruh ketadi -> shuncha xona kerak.
const slots = new Map();
for (const g of groupList) {
  const k = `${g.day}|${g.time}`;
  slots.set(k, (slots.get(k) ?? 0) + 1);
}
const maxParallel = Math.max(0, ...slots.values());

console.log(`=== O'QUVCHILAR ===`);
console.log(`  noyob: ${pupils.length}   sanasi bor: ${pupils.length - noDate.length}   sanasiz: ${noDate.length}`);
console.log(`\n=== O'QITUVCHILAR (${teachers.length} ta) ===`);
for (const t of teachers) {
  const gs = groupList.filter((g) => g.teacher === t);
  console.log(`  ${t.padEnd(12)} ${gs.length} guruh, ${gs.reduce((n, g) => n + g.members.length, 0)} o'quvchi`);
}
console.log(`\n=== GURUHLAR (${groupList.length} ta) ===`);
for (const g of groupList) {
  console.log(`  ${g.name.padEnd(7)} ${(g.course || "?" + g.fanRaw).padEnd(14)} ${g.teacher.padEnd(11)} ${g.day.padEnd(12)} ${g.time.padEnd(15)} ${String(g.members.length).padStart(2)} o'quvchi`);
}
console.log(`\n  Bir vaqtda eng ko'pi: ${maxParallel} guruh -> shuncha xona kerak`);
for (const [k, n] of [...slots].sort()) console.log(`    ${k}  -> ${n} guruh`);

if (needCourses.length) console.log(`\n=== BAZADA YO'Q KURSLAR (yaratish kerak) ===\n  ${needCourses.join(", ")}`);
if (missingCourses.length) console.log(`\n=== MOSLANMAGAN FANLAR ===\n  ${missingCourses.join(", ")}`);
console.log(`\n=== GURUHSIZ QOLADIGAN O'QUVCHILAR (${noGroup.length} ta) ===`);
for (const p of noGroup) console.log(`  ${(p.firstName + " " + p.lastName).trim().padEnd(30)} ${p.fan.padEnd(18)} ${p.fromSheet}`);

const outIdx = process.argv.indexOf("--json");
if (outIdx > 0 && process.argv[outIdx + 1]) {
  fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify({ pupils, groups: groupList, teachers, needCourses, maxParallel }, null, 2), "utf8");
  console.log(`\nJSON: ${process.argv[outIdx + 1]}`);
}
