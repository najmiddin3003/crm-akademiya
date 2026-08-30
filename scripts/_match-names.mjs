// FAQAT O'QIYDI — Exceldagi ismlarni bazadagi xodim/o'quvchi bilan solishtiradi.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import XLSX from "xlsx"; import { MongoClient } from "mongodb";
const HERE = path.dirname(fileURLToPath(import.meta.url));
for (const l of fs.readFileSync(path.join(HERE, "..", ".env.local"), "utf8").split("\n")) {
  const s = l.trim(); if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("="); if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}
const wb = XLSX.readFile(process.argv[2]);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const t = (r, i) => String(r?.[i] ?? "").trim();

// Uch xil apostrof va ortiqcha bo'shliq bir xillashtiriladi (import-from-excel.mjs uslubi).
const norm = (v) => String(v ?? "").replace(/[\u2019\u02BB\u02BC`']/g, "'").replace(/\s+/g, " ").trim();
const key = (v) => norm(v).toLowerCase();
const phoneKey = (v) => { const d = String(v ?? "").replace(/\D/g, ""); return d.startsWith("998") ? d.slice(3) : d; };

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 }); await client.connect();
const db = client.db(process.env.MONGODB_DB);
const emps = await db.collection("hr_employees").find({}).toArray();
const pupils = await db.collection("pupils").find({}).toArray();
const groups = await db.collection("groups").find({}).toArray();
const empByName = new Map(emps.map((e) => [key(e.name), e]));
const empByPhone = new Map(emps.map((e) => [phoneKey(e.phone), e]));
const pupilByName = new Map(pupils.map((p) => [key([p.firstName, p.lastName].filter(Boolean).join(" ") || p.name), p]));
const pupilByPhone = new Map(pupils.map((p) => [phoneKey(p.phone), p]));

// Bo'lim chegaralari
const idx = (n) => rows.findIndex((r) => t(r, 1) === n);
const secs = { stud: [idx("Student Bilan") + 1, idx("Hodim Bilan") - 3], hod: [idx("Hodim Bilan") + 1, idx("Boshqa") - 3] };

console.log("=== HODIM BILAN — xodim ismlari (idx2) ===");
const hodNames = new Map();
for (let i = secs.hod[0]; i <= secs.hod[1]; i++) {
  const n = t(rows[i], 2); if (!n) continue;
  if (!hodNames.has(key(n))) hodNames.set(key(n), { name: n, phone: t(rows[i], 3), n: 0 });
  hodNames.get(key(n)).n++;
}
let hitN = 0, hitP = 0, miss = [];
for (const [k, v] of hodNames) {
  const byName = empByName.get(k), byPhone = empByPhone.get(phoneKey(v.phone));
  if (byName) hitN++; else if (byPhone) hitP++; else miss.push(v);
  const mark = byName ? "ISM" : byPhone ? `TEL → "${byPhone.name}"` : "✗ TOPILMADI";
  console.log(`  ${String(v.n).padStart(3)}x ${v.name.padEnd(28)} ${v.phone.padEnd(15)} ${mark}`);
}
console.log(`  → ism bo'yicha ${hitN}, telefon bo'yicha ${hitP}, topilmadi ${miss.length} (jami ${hodNames.size} xodim)`);

console.log("\n=== STUDENT BILAN — o'quvchi va ustoz ===");
for (let i = secs.stud[0]; i <= secs.stud[1]; i++) {
  const st = t(rows[i], 2), stPh = t(rows[i], 3), te = t(rows[i], 7), tePh = t(rows[i], 8), g = t(rows[i], 10);
  if (!st) continue;
  const sHit = pupilByName.get(key(st)) ? "ism" : pupilByPhone.get(phoneKey(stPh)) ? "tel" : "✗";
  const tHit = empByName.get(key(te)) ? "ism" : empByPhone.get(phoneKey(tePh)) ? "tel" : "✗";
  const gHit = groups.find((x) => String(x.id) === g || key(x.name) === key(g)) ? "bor" : "✗";
  console.log(`  o'quvchi ${st.padEnd(26)}[${sHit}]  ustoz ${te.padEnd(24)}[${tHit}]  guruh ${String(g).padEnd(4)}[${gHit}]`);
}

console.log("\n=== KASSA MODERATORLARI ===");
for (const n of ["Abdulloh Raxmatullayev", "Nilufar Sharipova", "Dilmurod Komilov", "Shohruh Ahmadjanov"]) {
  const e = empByName.get(key(n));
  console.log(`  ${n.padEnd(26)} ${e ? `bazada bor (id=${e.id}, ${e.turi})` : "✗ bazada YO'Q"}`);
}
console.log("\n  Bazadagi kassalar:");
for (const c of await db.collection("cashboxes").find({}).sort({id:1}).toArray())
  console.log(`    id=${c.id} "${c.name}" moderator="${c.moderator}"`);

console.log("\n  Bazadagi 'Abdull' bilan boshlanadigan xodimlar:");
for (const e of emps.filter((x) => /abdull/i.test(x.name))) console.log(`    id=${e.id} "${e.name}" ${e.turi} ${e.phone}`);

await client.close();
