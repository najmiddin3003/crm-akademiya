// Guruh a'zoligini import qiladi: har biri bitta guruhning o'quvchilari
// bo'lgan Excel fayllar papkasidan `groups.studentIds` ni to'ldiradi.
//
// Sukut bo'yicha QURUQ YURISH. Yozish uchun `--yes`.
//
//   node scripts/import-group-members.mjs "C:/.../crm-guruhlar"
//   node scripts/import-group-members.mjs "C:/.../crm-guruhlar" --yes
//
// Fayl formati (edutizim "Guruh o'quvchilari" eksporti):
//   A1              → guruh nomi
//   "Active students" / "Archived students" → bo'lim sarlavhasi
//   Name | Phone number | Balance | Price   → ustun sarlavhasi
//
// Guruh nomi fayl NOMIDAN emas, fayl ICHIDAN olinadi — papkada nomi
// adashgan fayl bo'lishi mumkin (38.xlsx ichida guruh 5 chiqqan).
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
const DIR = process.argv.slice(2).find((a) => !a.startsWith("--")) || "C:/Users/zovaxx/Desktop/crm-guruhlar";

const norm = (v) => String(v ?? "").replace(/[\u2019\u02BB\u02BC`]/g, "'").replace(/\s+/g, " ").trim();
/** Telefonni solishtirish uchun: faqat raqamlar, mamlakat kodisiz. */
const digits = (v) => String(v ?? "").replace(/\D/g, "").replace(/^998/, "");
const nameKey = (v) => norm(v).toLowerCase();

// ---------------------------------------------------------------- fayllarni o'qish

/** Bitta faylni bo'limlarga ajratib o'qiydi. */
function readFile(file) {
  const wb = XLSX.readFile(path.join(DIR, file));
  const ws = wb.Sheets["Guruh o'quvchilari"] ?? wb.Sheets[wb.SheetNames[0]];
  const R = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const group = norm(R[0]?.[0]);
  const rows = [];
  let section = "";
  for (let i = 1; i < R.length; i++) {
    const c0 = norm(R[i][0]);
    const c1 = norm(R[i][1]);
    if (!c0) continue;
    // Ikkinchi katak bo'sh bo'lsa — bu bo'lim sarlavhasi.
    if (!c1) { section = c0; continue; }
    if (c1.toLowerCase() === "phone number") continue;
    rows.push({ name: c0, phone: c1, archived: section === "Archived students" });
  }
  return { file, group, rows };
}

const files = fs.readdirSync(DIR).filter((f) => /\.(xlsx|xls)$/i.test(f) && !f.startsWith("~$"));
const parsed = files.map(readFile);

// Bir xil guruhni ikki marta eksport qilgan fayllar (mazmuni aynan bir xil)
// — biri tashlab yuboriladi, aks holda a'zolar ikki marta sanalardi.
const seen = new Map();
const duplicates = [];
const usable = [];
for (const p of parsed) {
  const sig = `${p.group}|${p.rows.map((r) => r.phone).join(",")}`;
  if (seen.has(sig)) { duplicates.push({ file: p.file, sameAs: seen.get(sig) }); continue; }
  seen.set(sig, p.file);
  usable.push(p);
}

// ------------------------------------------------------------------- baza

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB);

const groups = await db.collection("groups").find({}).toArray();
const pupils = await db.collection("pupils").find({}).project({ id: 1, firstName: 1, lastName: 1, phone: 1 }).toArray();

const byPhone = new Map();
for (const p of pupils) { const d = digits(p.phone); if (d) byPhone.set(d, p); }

// Ism bo'yicha zaxira moslashuv — FAQAT ism bazada yagona bo'lsa.
// 499 ta ism bir nechta o'quvchida takrorlanadi, shuning uchun ko'p qiymatli
// ismga moslashish begona bolani guruhga qo'shib qo'yardi.
const byName = new Map();
for (const p of pupils) {
  const k = nameKey(`${p.firstName} ${p.lastName}`);
  if (!byName.has(k)) byName.set(k, []);
  byName.get(k).push(p);
}
function resolvePupil(row) {
  const d = digits(row.phone);
  if (d && byPhone.has(d)) return { pupil: byPhone.get(d), how: "telefon" };
  const k = nameKey(row.name);
  const rev = nameKey(row.name.split(" ").reverse().join(" "));
  for (const key of [k, rev]) {
    const hits = byName.get(key);
    if (hits && hits.length === 1) return { pupil: hits[0], how: "yagona ism" };
  }
  return { pupil: null, how: "topilmadi" };
}

/**
 * Fayl qaysi guruhga tegishli. Nomi yagona bo'lsa — to'g'ridan-to'g'ri;
 * bir nechta guruh bir xil raqamda bo'lsa (36, 62, 66, 104, 115) —
 * AKTIV o'quvchilar soni bo'yicha ajratiladi, chunki juftliklarning
 * sonlari bir-biridan farq qiladi (10/8, 25/7, 17/37, 11/15, 15/5).
 */
function resolveGroup(p) {
  const cands = groups.filter((g) => norm(g.name) === p.group);
  if (cands.length === 0) return { group: null, why: "bazada bunday guruh yo'q" };
  if (cands.length === 1) return { group: cands[0], why: "nom yagona" };
  const activeCount = p.rows.filter((r) => !r.archived).length;
  const exact = cands.filter((g) => Number(g.sourceActive ?? -1) === activeCount);
  if (exact.length === 1) return { group: exact[0], why: "aktiv soni bo'yicha" };
  return { group: null, why: `nom takroriy (${cands.length} ta), aktiv soni ${activeCount} bilan ajratib bo'lmadi` };
}

// Takroriy nomli guruhlarni ajratish uchun manba fayldagi aktiv sonini
// guruh hujjatiga vaqtincha biriktiramiz (bazada bunday maydon yo'q).
const SOURCE_XLSX = "C:/Users/zovaxx/Downloads/1787642203969.xlsx";
if (fs.existsSync(SOURCE_XLSX)) {
  const S = XLSX.utils.sheet_to_json(XLSX.readFile(SOURCE_XLSX).Sheets["Export"], { header: 1, defval: "" }).slice(1);
  for (const r of S) {
    const name = norm(r[0]);
    if (!name) continue;
    const g = groups.find((x) => norm(x.name) === name && norm(x.time) === `${norm(r[4])} - ${norm(r[5])}` && norm(x.day) === norm(r[3]));
    if (g) g.sourceActive = Number(r[8]) || 0;
  }
}

// ---------------------------------------------------------------- hisoblash

const assignments = new Map(); // groups.id → Set(pupils.id)
const unresolvedPupils = [];
const unresolvedGroups = [];
let matchedPhone = 0, matchedName = 0, archivedIncluded = 0;

for (const p of usable) {
  const { group, why } = resolveGroup(p);
  if (!group) { unresolvedGroups.push({ file: p.file, group: p.group, why }); continue; }
  if (!assignments.has(group.id)) assignments.set(group.id, new Set());
  const set = assignments.get(group.id);
  for (const row of p.rows) {
    const { pupil, how } = resolvePupil(row);
    if (!pupil) { unresolvedPupils.push({ file: p.file, group: p.group, ...row }); continue; }
    if (how === "telefon") matchedPhone++; else matchedName++;
    if (row.archived) archivedIncluded++;
    set.add(pupil.id);
  }
}

// --------------------------------------------------------------------- hisobot

console.log(APPLY ? "=== BAJARILMOQDA ===\n" : "=== QURUQ YURISH — bazaga hech narsa yozilmaydi ===\n");
console.log(`Papka: ${DIR}`);
console.log(`  fayllar          : ${files.length}`);
console.log(`  takroriy nusxa   : ${duplicates.length}${duplicates.length ? " → " + duplicates.map((d) => `${d.file} (= ${d.sameAs})`).join(", ") : ""}`);
console.log(`  ishlatiladi      : ${usable.length}`);

console.log(`\nO'QUVCHI MOSLASHUVI`);
console.log(`  telefon bo'yicha : ${matchedPhone}`);
console.log(`  yagona ism bilan : ${matchedName}`);
console.log(`  TOPILMADI        : ${unresolvedPupils.length}`);
console.log(`  arxiv bo'limidan : ${archivedIncluded}  (egasining qarori bilan qo'shiladi)`);

console.log(`\nGURUHLAR`);
console.log(`  a'zo biriktiriladi: ${assignments.size} guruhga`);
console.log(`  jami a'zolik      : ${[...assignments.values()].reduce((s, v) => s + v.size, 0)}`);
console.log(`  guruhi aniqlanmadi: ${unresolvedGroups.length}`);
unresolvedGroups.forEach((u) => console.log(`    ${u.file} ("${u.group}") — ${u.why}`));

const withoutFile = groups.filter((g) => !assignments.has(g.id));
console.log(`  fayli yo'q guruh  : ${withoutFile.length} → ${withoutFile.map((g) => `${g.name}(${g.course})`).join(", ")}`);

if (unresolvedPupils.length) {
  console.log(`\nTOPILMAGAN O'QUVCHILAR (${unresolvedPupils.length})`);
  unresolvedPupils.forEach((u) => console.log(`  ${u.file.padEnd(22)} ${u.name.padEnd(30)} ${u.phone}`));
}

if (!APPLY) {
  console.log(`\nHaqiqatan bajarish uchun: node scripts/import-group-members.mjs "${DIR}" --yes`);
  await client.close();
  process.exit(0);
}

let updated = 0;
for (const [groupId, set] of assignments) {
  const ids = [...set].sort((a, b) => a - b);
  await db.collection("groups").updateOne(
    { id: groupId },
    // `students` — ilovada o'lik sanoq, lekin eksport/jadvallarda uchraydi;
    // studentIds bilan bir xil turishi uchun birga yoziladi.
    { $set: { studentIds: ids, students: ids.length } },
  );
  updated++;
}

const after = await db.collection("groups").find({}).project({ studentIds: 1 }).toArray();
console.log(`\n✓ yangilangan guruh : ${updated}`);
console.log(`✓ jami a'zolik      : ${after.reduce((s, g) => s + (g.studentIds?.length ?? 0), 0)}`);
console.log(`✓ a'zosi bor guruh  : ${after.filter((g) => g.studentIds?.length).length} / ${after.length}`);
await client.close();
