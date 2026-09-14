// "AKADEMIYA.xlsx" (sentabr 2026 ro'yxati, 38 qator) -> 4-filial
// (Akademiya 4 Uchqo'rg'on). scripts/_import-uchqorgon.mjs (07.09.2026)
// ning davomi — o'sha faylning hujjat shakllari saqlangan, farqi:
// baza allaqachon 4-filial yozuvlari bilan to'lgan, shu bois BOR
// narsani QAYTA YARATMAYDI — topib, ulaydi.
//
//   node scripts/_import-uchqorgon-2026-09.mjs "<fayl>"           -> QURUQ YURISH (yozmaydi)
//   node scripts/_import-uchqorgon-2026-09.mjs "<fayl>" --apply   -> bazaga yozadi
//   node scripts/_import-uchqorgon-2026-09.mjs --undo             -> kvitansiya bo'yicha qaytaradi
//
// Excel ustunlari (bitta varaq, 1-qator sarlavha):
//   A No | B O'QITUVCHISI | C F.I.SH | D TEL | E (2-tel) | F FAN | G kunlar
//   H SOATI | I KELGAN SANA | J TO'LOV (bo'sh) | K TO'LASH KERAK (oylik narx)
//
// NIMA QILADI:
//   kurs    -> offline_courses'da nomi bo'yicha topadi, yo'q bo'lsa yaratadi (umumiy)
//   xona    -> 4-filialdagi mavjud xonalarni ishlatadi, yetmasa qo'shadi
//   ustoz   -> hr_employees (turi "teacher", branchIds 4) ichidan ISMI bo'yicha
//              topadi ("Dildora" ↔ "Dildora ..."), yo'q bo'lsa yaratadi
//   o'quvchi-> 4-filial pupils ichidan TELEFON (raqamlar) yoki F.I.SH bo'yicha
//              topadi; topilmasa yaratadi. Oylik narx ("TO'LASH KERAK") CRM'da
//              alohida maydon bo'lmagani uchun `note` ga yoziladi.
//   guruh   -> (ustoz, kurs, kun, vaqt) bo'yicha; bir xil TIRIK guruh bo'lsa
//              o'quvchilar unga QO'SHILADI, aks holda "UCH-N" nomi bilan
//              yangi guruh (raqam arxivdagi UCH-18 dan davom etadi).
//
// Bazaga ulanish: MONGODB_URI env o'zgaruvchisi, bo'lmasa joriy papkadagi
// .env.local. Prod baza VPS'da — skript o'sha yerda, /var/www/crm/current
// ichidan ishga tushiriladi (node_modules shu yerda).
//
// QAYTARIB OLISH: yaratilgan har bir id va o'zgartirilgan har bir maydonning
// ESKI qiymati kvitansiyaga (skript yonidagi _uchqorgon-import-2026-09-receipt.json)
// yoziladi; `--undo` faqat o'shalarni qaytaradi — qo'lda kiritilganlarga tegmaydi.
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECEIPT = path.join(HERE, "_uchqorgon-import-2026-09-receipt.json");
const BRANCH_ID = 4;
const BRANCH_NAME = "Akademiya 4 Uchqo'rg'on";
const SOURCE = "Akademiya'da o'qiydi";
const ARCHIVE = "arxivTugaganGuruhlarimiz"; // lib/groups.ts ARCHIVED_GROUPS_COLLECTION

function readEnv(k, d) {
  if (process.env[k]) return process.env[k];
  if (!fs.existsSync(".env.local")) return d;
  const env = fs.readFileSync(".env.local", "utf8");
  return (new RegExp(`^${k}=(.*)$`, "m").exec(env)?.[1] || "").trim().replace(/^["']|["']$/g, "") || d;
}
const uri = readEnv("MONGODB_URI");
if (!uri) { console.error("MONGODB_URI topilmadi (env yoki .env.local)"); process.exit(1); }
const client = new MongoClient(uri);
await client.connect();
const db = client.db(readEnv("MONGODB_DB", "crm_akademiya"));
console.log(`Baza: ${db.databaseName} @ ${uri.replace(/\/\/[^@]*@/, "//***@").replace(/\?.*$/, "")}\n`);

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");

// ── Qaytarib olish ───────────────────────────────────────────────────────
if (UNDO) {
  if (!fs.existsSync(RECEIPT)) { console.log("Kvitansiya topilmadi — qaytaradigan narsa yo'q."); await client.close(); process.exit(0); }
  const r = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  for (const [coll, ids] of Object.entries(r.created ?? {})) {
    if (!ids.length) continue;
    const res = await db.collection(coll).deleteMany({ id: { $in: ids } });
    console.log(`${coll}: ${res.deletedCount} ta o'chirildi`);
  }
  for (const u of r.pupilNotes ?? []) {
    await db.collection("pupils").updateOne({ id: u.id }, u.before === undefined ? { $unset: { note: "" } } : { $set: { note: u.before } });
  }
  if (r.pupilNotes?.length) console.log(`pupils.note: ${r.pupilNotes.length} ta eski holatiga qaytarildi`);
  for (const a of r.groupAdds ?? []) {
    await db.collection("groups").updateOne({ id: a.groupId }, { $pull: { studentIds: { $in: a.pupilIds } } });
    const g = await db.collection("groups").findOne({ id: a.groupId }, { projection: { studentIds: 1 } });
    if (g) await db.collection("groups").updateOne({ id: a.groupId }, { $set: { students: (g.studentIds ?? []).length } });
  }
  if (r.groupAdds?.length) console.log(`mavjud guruhlardan ${r.groupAdds.reduce((s, a) => s + a.pupilIds.length, 0)} ta a'zolik olib tashlandi`);
  fs.unlinkSync(RECEIPT);
  console.log("Qaytarib olindi.");
  await client.close();
  process.exit(0);
}

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error("Excel fayl yo'lini bering"); await client.close(); process.exit(1); }

// ── Normalizatsiya ───────────────────────────────────────────────────────
const DAY_MAP = { "D.CH.J": "Toq kunlar", "S.P.SH": "Juft kunlar" };
const COURSE_MAP = {
  "KOREYS TILI": "Koreys tili", "INGLIZ TILI": "Ingliz tili", "INGLIZ TILI CEFR": "Ingliz tili",
  "ARAB TILI": "Arab tili", "RUS TILI": "Rus tili", "BIOLOGIYA": "Biologiya",
  "TURK TILI": "Turk tili", "XUQUQ": "Huquq", "HUQUQ": "Huquq", "MATEMATIKA": "Matematika",
  "NEMIS TILI": "Nemis tili", "IT(WEBS DESIGN)": "IT (Web dizayn)",
};
const COURSE_COLORS = { Matematika: "#1e88e5", Biologiya: "#43a047", "Nemis tili": "#8e24aa", "IT (Web dizayn)": "#00897b" };

const nameKey = (s) => String(s ?? "").toUpperCase().replace(/[’'`ʻʼ]/g, "'").replace(/\s+/g, " ").trim();
const title = (w) => w.charAt(0) + w.slice(1).toLowerCase();
const titleAll = (s) => nameKey(s).split(" ").filter(Boolean).map(title).join(" ");
const normDay = (v) => DAY_MAP[String(v ?? "").toUpperCase().replace(/\s+/g, "")] ?? "";
const warnings = [];
function normTime(v, who) {
  // "15:00-117:00" kabi xato ham uchraydi — 3 xonali soatning oxirgi ikkitasi olinadi.
  const m = String(v ?? "").match(/(\d{1,3}):(\d{2})\s*-\s*(\d{1,3}):(\d{2})/);
  if (!m) return "";
  const hh = (x) => { let n = String(x); if (n.length > 2) { warnings.push(`${who}: soat "${v}" -> "${n.slice(-2)}" deb o'qildi`); n = n.slice(-2); } return n.padStart(2, "0"); };
  return `${hh(m[1])}:${m[2]} - ${hh(m[3])}:${m[4]}`;
}
const digits9 = (raw) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("998")) d = d.slice(3);
  if (d.length === 8) d = "0" + d;
  return d.length === 9 ? d : "";
};
const fmtPhone = (d) => (d ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}` : "");
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
const fmtSum = (n) => Number(n).toLocaleString("ru-RU").replace(/,/g, " ");

const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
const pad = (n) => String(n).padStart(2, "0");
const NOW_STAMP = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
const NOTE_TAG = "Oylik to'lov";
const feeNote = (fee) => `${NOTE_TAG}: ${fmtSum(fee)} so'm (Excel ro'yxati, ${NOW_STAMP.slice(0, 10)})`;

// ── Excel -> qatorlar ────────────────────────────────────────────────────
const wb = XLSX.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
const cell = (r, i) => String(r[i] ?? "").trim();
const raws = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.every((c) => String(c).trim() === "")) continue;
  const full = cell(r, 2);
  if (!full || /^(TOTAL|JAMI|UMUMIY)/i.test(cell(r, 1)) || /^(F[.,]?\s*I[.,]?\s*SH|JAMI|UMUMIY|TOTAL)/i.test(full)) continue;
  const split = splitName(full);
  if (!split) continue;
  const who = `${i + 1}-qator ${full}`;
  const fan = nameKey(cell(r, 5));
  const feeRaw = cell(r, 10).replace(/\D/g, "");
  raws.push({
    row: i + 1, full: nameKey(full), ...split,
    phone: digits9(cell(r, 3)), extraPhone: digits9(cell(r, 4)),
    fan, course: COURSE_MAP[fan] ?? "",
    day: normDay(cell(r, 6)), time: normTime(cell(r, 7), who),
    teacher: titleAll(cell(r, 1)), arrived: normDate(cell(r, 8)),
    fee: feeRaw ? Number(feeRaw) : 0,
  });
  if (fan && !COURSE_MAP[fan]) warnings.push(`${who}: fan "${fan}" xaritada yo'q — guruhsiz qoladi`);
  if (cell(r, 3) && !raws.at(-1).phone) warnings.push(`${who}: telefon "${cell(r, 3)}" o'qilmadi`);
}
// Bir odam ikki qatorda bo'lsa — birinchisi asos, ikkinchisi faqat guruh uchun.
const seen = new Map();
for (const r of raws) {
  const k = r.full + "|" + r.phone;
  if (seen.has(k)) warnings.push(`${r.row}-qator ${r.full}: takror qator (${seen.get(k)}-qator bilan bir xil)`);
  else seen.set(k, r.row);
}

// ── Bazadagi holat (faqat o'qish) ────────────────────────────────────────
const branch = await db.collection("branches").findOne({ id: BRANCH_ID }, { projection: { _id: 0, id: 1, name: 1 } });
if (!branch) { console.error(`branches'da id=${BRANCH_ID} topilmadi!`); await client.close(); process.exit(1); }
console.log(`Filial: #${branch.id} ${branch.name}`);

const b4Pupils = await db.collection("pupils").find({ branchId: BRANCH_ID },
  { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, extraPhone: 1, note: 1, status: 1 } }).toArray();
const pupilName = (p) => nameKey(`${p.lastName ?? ""} ${p.firstName ?? ""}`);
const pupilNameRev = (p) => nameKey(`${p.firstName ?? ""} ${p.lastName ?? ""}`);
const byPhone = new Map();
for (const p of b4Pupils) for (const d of [digits9(p.phone), digits9(p.extraPhone)]) {
  if (!d) continue;
  if (!byPhone.has(d)) byPhone.set(d, []);
  byPhone.get(d).push(p);
}
const nameScore = (r, p) => {
  const a = nameKey(`${r.lastName} ${r.firstName}`);
  if (a === pupilName(p) || a === pupilNameRev(p)) return 2;
  if (r.lastName && nameKey(r.lastName) === nameKey(p.lastName ?? "")) return 1;
  return 0;
};

const b4Teachers = await db.collection("hr_employees").find({ branchIds: BRANCH_ID, turi: "teacher" },
  { projection: { _id: 0, id: 1, name: 1, archDate: 1, kurs: 1 } }).toArray();
const findTeacher = (first) => {
  const f = nameKey(first);
  const hits = b4Teachers.filter((t) => { const parts = nameKey(t.name).split(" "); return parts[0] === f || nameKey(t.name) === f; });
  if (hits.length > 1) warnings.push(`o'qituvchi "${first}" bazada ${hits.length} ta: ${hits.map((t) => `#${t.id} ${t.name}`).join(", ")} — birinchisi olinadi`);
  return hits.sort((a, b) => (a.archDate ? 1 : 0) - (b.archDate ? 1 : 0))[0] ?? null;
};

const courses = await db.collection("offline_courses").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
const findCourse = (nm) => courses.find((c) => nameKey(c.name) === nameKey(nm)) ?? null;

const b4Rooms = (await db.collection("rooms").find({ branchId: BRANCH_ID }, { projection: { _id: 0, id: 1, name: 1 } }).toArray())
  .sort((a, b) => a.id - b.id);
const liveGroups = await db.collection("groups").find({ branchId: BRANCH_ID },
  { projection: { _id: 0, id: 1, name: 1, course: 1, day: 1, time: 1, teacher: 1, room: 1, status: 1, studentIds: 1 } }).toArray();

// ── O'quvchilarni bog'lash ───────────────────────────────────────────────
const pupils = []; // { raw, existing: pupil|null, why }
for (const r of raws) {
  let existing = null, why = "";
  const cands = [...new Set([...(byPhone.get(r.phone) ?? []), ...(byPhone.get(r.extraPhone) ?? [])])].filter(Boolean);
  if (cands.length) {
    const best = cands.map((p) => ({ p, s: nameScore(r, p) })).sort((a, b) => b.s - a.s)[0];
    if (best.s > 0) { existing = best.p; why = best.s === 2 ? "telefon+ism" : "telefon+familiya"; }
    else if (cands.length === 1) warnings.push(`${r.row}-qator ${r.full}: telefon ${fmtPhone(r.phone)} bazada #${cands[0].id} ${pupilName(cands[0])} niki — ism boshqa, YANGI yoziladi (aka-uka bo'lsa to'g'ri)`);
  }
  if (!existing) {
    const a = nameKey(`${r.lastName} ${r.firstName}`);
    const byName = b4Pupils.filter((p) => a === pupilName(p) || a === pupilNameRev(p));
    if (byName.length === 1) { existing = byName[0]; why = "ism"; }
    else if (byName.length > 1) warnings.push(`${r.row}-qator ${r.full}: ism bo'yicha ${byName.length} ta mos — YANGI yoziladi, qo'lda tekshiring`);
  }
  if (existing && existing.status && existing.status !== "Aktiv") warnings.push(`${r.row}-qator ${r.full}: bazadagi #${existing.id} holati "${existing.status}" — o'zgartirilmaydi`);
  pupils.push({ raw: r, existing, why });
}
// Boshqa filialda shu telefon bormi — faqat ogohlantirish.
const otherBranch = await db.collection("pupils").find(
  { branchId: { $ne: BRANCH_ID }, phone: { $in: [...new Set(raws.map((r) => fmtPhone(r.phone)).filter(Boolean))] } },
  { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, branchId: 1 } }).toArray();
for (const o of otherBranch) warnings.push(`telefon ${o.phone} ${o.branchId}-filialdagi #${o.id} ${pupilName(o)} da ham bor — tegilmaydi`);

// ── Guruhlar ─────────────────────────────────────────────────────────────
const groupMap = new Map();
for (const p of pupils) {
  const r = p.raw;
  if (!r.teacher || !r.course || !r.day || !r.time) { warnings.push(`${r.row}-qator ${r.full}: ustoz/kurs/kun/vaqt to'liq emas — guruhsiz`); continue; }
  const t = findTeacher(r.teacher);
  const teacherName = t ? t.name : r.teacher;
  const gk = `${teacherName}|${r.course}|${r.day}|${r.time}`;
  if (!groupMap.has(gk)) groupMap.set(gk, { teacherFirst: r.teacher, teacher: teacherName, teacherDoc: t, course: r.course, day: r.day, time: r.time, members: [] });
  groupMap.get(gk).members.push(p);
}
const groups = [...groupMap.values()].sort((a, b) =>
  a.teacher.localeCompare(b.teacher) || a.course.localeCompare(b.course) || a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
for (const g of groups) {
  g.live = liveGroups.find((l) => nameKey(l.teacher) === nameKey(g.teacher) && nameKey(l.course) === nameKey(g.course)
    && l.day === g.day && l.time === g.time && (l.status === "active" || l.status === "frozen")) ?? null;
}

// UCH-N raqamlash arxivdan davom etadi.
const uchNums = [];
for (const coll of ["groups", ARCHIVE]) {
  const docs = await db.collection(coll).find({ branchId: BRANCH_ID, name: /^UCH-\d+$/ }, { projection: { _id: 0, name: 1 } }).toArray();
  for (const d of docs) uchNums.push(Number(d.name.slice(4)));
}
let uchNext = (uchNums.length ? Math.max(...uchNums) : 0) + 1;
for (const g of groups) if (!g.live) g.name = `UCH-${uchNext++}`;

// Xona: mavjud tirik guruhlar band qilgan vaqtlar hisobga olinadi.
const mins = (hhmm) => { const m = String(hhmm).match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
const rangeOf = (t) => { const m = String(t).match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/); return m ? { from: mins(m[1]), to: mins(m[2]) } : null; };
const overlaps = (a, b) => a.from < b.to && b.from < a.to;
const ROOM_NAMES = b4Rooms.map((r) => r.name);
const NEW_ROOMS = [];
const busyByDay = new Map();
const busy = (day) => { if (!busyByDay.has(day)) busyByDay.set(day, new Map()); return busyByDay.get(day); };
for (const l of liveGroups) {
  if (l.status !== "active" && l.status !== "frozen") continue;
  const r = rangeOf(l.time); if (!r || !l.room) continue;
  const perRoom = busy(l.day); perRoom.set(l.room, [...(perRoom.get(l.room) ?? []), r]);
}
for (const g of [...groups].filter((g) => !g.live).sort((a, b) => a.day.localeCompare(b.day) || mins(a.time) - mins(b.time))) {
  const r = rangeOf(g.time);
  if (!r) { g.room = ROOM_NAMES[0] ?? "1 - xona"; continue; }
  const perRoom = busy(g.day);
  let chosen = "";
  for (const room of ROOM_NAMES) if (!(perRoom.get(room) ?? []).some((t) => overlaps(t, r))) { chosen = room; break; }
  if (!chosen) { chosen = `${ROOM_NAMES.length + 1} - xona`; ROOM_NAMES.push(chosen); NEW_ROOMS.push(chosen); }
  perRoom.set(chosen, [...(perRoom.get(chosen) ?? []), r]);
  g.room = chosen;
}

const teacherFirsts = [...new Set(groups.map((g) => g.teacherFirst))].sort();
const newTeachers = teacherFirsts.filter((f) => !findTeacher(f));
const courseNames = [...new Set(groups.map((g) => g.course))].sort();
const newCourses = courseNames.filter((c) => !findCourse(c));

// ── Hisobot ──────────────────────────────────────────────────────────────
const newPupils = pupils.filter((p) => !p.existing);
const oldPupils = pupils.filter((p) => p.existing);
console.log(`${APPLY ? "YOZILADI" : "QURUQ YURISH (bazaga tegilmaydi)"}\n`);
console.log(`Excel: ${raws.length} qator, jami oylik ${fmtSum(raws.reduce((s, r) => s + r.fee, 0))} so'm`);
console.log(`Bazada (4-filial): ${b4Pupils.length} o'quvchi, ${b4Teachers.length} o'qituvchi, ${b4Rooms.length} xona, ${liveGroups.length} tirik guruh\n`);
console.log(`  kurs:      ${courseNames.length} ta; yangi: ${newCourses.length ? newCourses.join(", ") : "—"}`);
console.log(`  xona:      ${b4Rooms.length} ta mavjud; yangi: ${NEW_ROOMS.length ? NEW_ROOMS.join(", ") : "—"}`);
console.log(`  o'qituvchi: ${teacherFirsts.length} ta; yangi: ${newTeachers.length ? newTeachers.join(", ") : "—"}`);
for (const f of teacherFirsts) { const t = findTeacher(f); if (t) console.log(`               ${f} -> #${t.id} ${t.name}${t.archDate ? " (ARXIVDA!)" : ""}`); }
console.log(`  o'quvchi:  ${pupils.length} ta -> ${oldPupils.length} ta bazada bor (ulanadi), ${newPupils.length} ta YANGI`);
console.log(`  guruh:     ${groups.length} ta -> ${groups.filter((g) => g.live).length} ta mavjudga qo'shiladi, ${groups.filter((g) => !g.live).length} ta yangi\n`);

console.log("GURUHLAR:");
for (const g of groups) {
  const tag = g.live ? `MAVJUD #${g.live.id} "${g.live.name}"` : `YANGI "${g.name}" · ${g.room}`;
  console.log(`  ${tag} · ${g.course} · ${g.teacher} · ${g.day} · ${g.time} · ${g.members.length} o'quvchi`);
  for (const m of g.members) {
    const r = m.raw;
    const st = m.existing ? `bor #${m.existing.id} (${m.why})` : "YANGI";
    console.log(`      ${st.padEnd(26)} ${(r.lastName + " " + r.firstName).padEnd(28)} ${fmtPhone(r.phone).padEnd(13)} ${r.arrived.slice(0, 10)}  ${r.fee ? fmtSum(r.fee) : "-"}`);
  }
}
const noGroup = pupils.filter((p) => !groups.some((g) => g.members.includes(p)));
if (noGroup.length) { console.log("\nGURUHSIZ:"); for (const p of noGroup) console.log(`  ${p.raw.row}-qator ${p.raw.full}`); }
const notInExcel = b4Pupils.filter((p) => (p.status ?? "Aktiv") === "Aktiv" && !pupils.some((x) => x.existing?.id === p.id));
console.log(`\nBazadagi aktiv 4-filial o'quvchilaridan Excel'da YO'Q: ${notInExcel.length} ta (tegilmaydi)`);
if (warnings.length) { console.log("\nOGOHLANTIRISHLAR:"); for (const w of warnings) console.log("  ! " + w); }

if (!APPLY) {
  console.log(`\nYozish uchun: node scripts/_import-uchqorgon-2026-09.mjs "<fayl>" --apply`);
  await client.close();
  process.exit(0);
}
if (fs.existsSync(RECEIPT)) { console.error(`\nKvitansiya allaqachon bor (${RECEIPT}) — avval --undo qiling yoki faylni ko'chiring.`); await client.close(); process.exit(1); }

// ── Yozish ───────────────────────────────────────────────────────────────
const receipt = { at: NOW_STAMP, branchId: BRANCH_ID, file: path.basename(file),
  created: { offline_courses: [], rooms: [], hr_employees: [], pupils: [], groups: [] }, pupilNotes: [], groupAdds: [] };
const save = () => fs.writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2), "utf8");
const nextIdOf = async (coll) => ((await db.collection(coll).find({}).sort({ id: -1 }).limit(1).toArray())[0]?.id ?? 0) + 1;

// 1) Kurslar (umumiy — branchId yo'q, boshqa kurslar kabi)
let cid = await nextIdOf("offline_courses");
for (const nm of newCourses) {
  const doc = { id: cid++, name: nm, color: COURSE_COLORS[nm] ?? "#546e7a", branches: [], levels: [] };
  await db.collection("offline_courses").insertOne({ ...doc });
  courses.push(doc); receipt.created.offline_courses.push(doc.id); save();
}
// Guruhga kurs hujjatidagi KANONIK nom yoziladi (lib/groupCourseCheck.ts kabi)
for (const g of groups) g.course = findCourse(g.course)?.name ?? g.course;

// 2) Xonalar
let rid = await nextIdOf("rooms");
for (const nm of NEW_ROOMS) {
  const doc = { id: rid++, name: nm, capacity: 0, note: "", branchId: BRANCH_ID };
  await db.collection("rooms").insertOne({ ...doc });
  receipt.created.rooms.push(doc.id); save();
}

// 3) O'qituvchilar (hr_employees, turi "teacher") — app/api/hr-employees POST shakli
let eid = await nextIdOf("hr_employees");
for (const f of newTeachers) {
  const mine = groups.filter((g) => g.teacherFirst === f);
  const doc = {
    id: eid++, branchIds: [BRANCH_ID], payrollBranchId: BRANCH_ID, name: f, gender: "", aktivOq: 0,
    groups: mine.length, turi: "teacher", filial: BRANCH_NAME, phone: "", kurs: mine[0]?.course ?? "",
    created: NOW_STAMP, lastActive: "", archReason: "", archDate: "", email: "",
    percent: "", degree: "", employmentRate: "", photoUrl: "", branchAssignments: [], taxIds: [],
    permissions: null, plastikSalary: null,
  };
  await db.collection("hr_employees").insertOne({ ...doc });
  b4Teachers.push({ id: doc.id, name: doc.name, archDate: "", kurs: doc.kurs });
  receipt.created.hr_employees.push(doc.id); save();
}

// 4) O'quvchilar — lib/pupilsData.ts buildPupilFromValues shakli + branchId + note
let pid = await nextIdOf("pupils");
for (const p of pupils) {
  const r = p.raw;
  if (p.existing) {
    if (r.fee && !String(p.existing.note ?? "").includes(NOTE_TAG)) {
      const before = p.existing.note;
      const after = before ? `${before}\n${feeNote(r.fee)}` : feeNote(r.fee);
      await db.collection("pupils").updateOne({ id: p.existing.id }, { $set: { note: after } });
      receipt.pupilNotes.push({ id: p.existing.id, before }); save();
    }
    p.id = p.existing.id;
    continue;
  }
  const doc = {
    firstName: r.firstName, lastName: r.lastName, phone: fmtPhone(r.phone), extraPhone: fmtPhone(r.extraPhone),
    category: "", birthDate: "", source: SOURCE, note: r.fee ? feeNote(r.fee) : "",
    id: pid++, createdAt: r.arrived || NOW_STAMP, balance: 0, coin: 0, moderator: "", status: "Aktiv",
    branchId: BRANCH_ID,
  };
  await db.collection("pupils").insertOne({ ...doc });
  p.id = doc.id; receipt.created.pupils.push(doc.id); save();
}

// 5) Guruhlar — app/api/groups POST shakli (+ studentIds, students)
let gid = Math.max(await nextIdOf("groups"), await nextIdOf(ARCHIVE)); // lib/groupIds.ts
for (const g of groups) {
  const ids = g.members.map((m) => m.id).filter((x) => typeof x === "number");
  if (g.live) {
    const have = new Set(g.live.studentIds ?? []);
    const add = ids.filter((x) => !have.has(x));
    if (add.length) {
      await db.collection("groups").updateOne({ id: g.live.id }, { $addToSet: { studentIds: { $each: add } } });
      const doc = await db.collection("groups").findOne({ id: g.live.id }, { projection: { studentIds: 1 } });
      await db.collection("groups").updateOne({ id: g.live.id }, { $set: { students: (doc.studentIds ?? []).length } });
      receipt.groupAdds.push({ groupId: g.live.id, pupilIds: add }); save();
    }
    continue;
  }
  const doc = {
    id: gid++, name: g.name, course: g.course, level: "", eduType: "Oflayn", day: g.day, time: g.time,
    period: "", periodExpired: false, students: ids.length, teacher: g.teacher, room: g.room,
    telegram: null, status: "active", highlighted: false, startDate: "", endDate: "",
    studentIds: ids, branchId: BRANCH_ID,
  };
  await db.collection("groups").insertOne({ ...doc });
  g.id = doc.id; receipt.created.groups.push(doc.id); save();
}

console.log(`\nYOZILDI:`);
for (const [coll, ids] of Object.entries(receipt.created)) console.log(`  ${coll.padEnd(16)} ${ids.length} ta${ids.length ? ` (id ${ids[0]}…${ids.at(-1)})` : ""}`);
console.log(`  pupils.note      ${receipt.pupilNotes.length} ta mavjud o'quvchiga oylik narx yozildi`);
console.log(`  mavjud guruhga   ${receipt.groupAdds.reduce((s, a) => s + a.pupilIds.length, 0)} ta a'zolik qo'shildi`);
console.log(`\nKvitansiya: ${RECEIPT}`);
console.log(`Qaytarib olish: node scripts/_import-uchqorgon-2026-09.mjs --undo`);
await client.close();
