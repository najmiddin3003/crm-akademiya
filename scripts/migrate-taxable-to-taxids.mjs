// BIR MARTALIK MIGRATSIYA: `hr_employees.taxable` (mantiqiy bayroq) →
// `hr_employees.taxIds` (biriktirilgan soliq turlari ro'yxati).
//
// Ilgari tugmacha yoqilgan xodimga Sozlamalar → Moliya → Soliq dagi HAMMA
// faol qoida qo'llanardi. Endi har bir xodimga aynan tanlangan turlar
// biriktiriladi. Eski holatni saqlab qolish uchun `taxable: true` bo'lgan
// xodimga o'sha ondagi barcha FAOL qoidalar biriktiriladi — ya'ni hisob-kitob
// natijasi o'zgarmaydi.
//
// Sukut bo'yicha QURUQ YURISH. Yozish uchun `--yes`.
//
//   node scripts/migrate-taxable-to-taxids.mjs
//   node scripts/migrate-taxable-to-taxids.mjs --yes
//
// Idempotent: `taxIds` allaqachon bor xodimga tegilmaydi, `taxable` maydoni
// esa har ikki holatda ham olib tashlanadi (u endi o'qilmaydi).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");

// Faol soliq turlari — eski "hammasi" mantig'ining aynan o'zi.
const taxes = await db.collection("settings_taxes").find({}).sort({ id: 1 }).toArray();
const activeIds = taxes.filter((t) => t?.active !== false).map((t) => Number(t.id)).filter(Number.isFinite);
console.log(`Faol soliq turlari: ${activeIds.length ? activeIds.join(", ") : "(yo'q)"}`);

const employees = await db.collection("hr_employees").find({ taxable: { $exists: true } }).sort({ id: 1 }).toArray();
if (employees.length === 0) {
  console.log("`taxable` maydoni bor xodim topilmadi — migratsiya shart emas.");
  await client.close();
  process.exit(0);
}

const plan = [];
for (const e of employees) {
  const hasIds = Array.isArray(e.taxIds) && e.taxIds.length > 0;
  const nextIds = hasIds ? e.taxIds : e.taxable === true ? activeIds : [];
  plan.push({ id: e.id, name: e.name, was: e.taxable, hasIds, nextIds });
}

console.log(`\n\`taxable\` maydoni bor ${plan.length} ta xodim:`);
for (const p of plan) {
  const mark = p.hasIds
    ? `taxIds allaqachon bor (${p.taxIds ?? p.nextIds.join(", ")}) — tegilmaydi`
    : p.was === true
      ? `taxable:true → taxIds: [${p.nextIds.join(", ") || "bo'sh"}]`
      : "taxable:false → taxIds: []";
  console.log(`  #${String(p.id).padStart(3)} ${String(p.name).padEnd(28)} ${mark}`);
}

if (!APPLY) {
  console.log("\nQURUQ YURISH — hech narsa yozilmadi. Yozish uchun --yes qo'shing.");
  await client.close();
  process.exit(0);
}

let n = 0;
for (const p of plan) {
  const update = { $unset: { taxable: "" } };
  if (!p.hasIds) update.$set = { taxIds: p.nextIds };
  const res = await db.collection("hr_employees").updateOne({ id: p.id }, update);
  n += res.modifiedCount;
}
console.log(`\nYOZILDI: ${n} ta xodim yangilandi, \`taxable\` maydoni olib tashlandi.`);
await client.close();
