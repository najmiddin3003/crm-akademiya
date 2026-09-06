import { MongoClient } from "mongodb";
import fs from "node:fs";

// 1-BOSQICH NEYTRALLIK DARVOZASI.
//
// Plastik ishining birinchi bosqichi HECH QANDAY raqamni o'zgartirmasligi
// kerak. Bu skript shuni o'lchaydi, ishonch bilan aytmaydi.
//
// Tekshiriladi:
//   1. `parseMoney` (lib/taxes.ts) — YAGONA xulqi o'zgargan funksiya.
//      Bazadagi HAR BIR haqiqiy qiymatda eski va yangi natija teng bo'lishi shart.
//   2. Soliq qoidalari tegilmagan — hammasi qat'iy summa bo'lib qoladi.
//   3. Hech bir xodimda `plastikSalary` yo'q → karta oyog'i 0, hamma pul naqd.
//   4. Soliq yig'indisi — migratsiyadan keyin solishtirish uchun tayanch raqam.

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const db = client.db("crm-akademiya-nextjs");

// ---- Eski va yangi parser (aynan nusxa) ----
function parseMoneyOld(raw) {
  const s = String(raw ?? "").replace(/\s| /g, "").replace(/%/g, "").replace(",", ".");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function parseMoneyNew(raw) {
  let s = String(raw ?? "").replace(/\s/g, "").replace(/%/g, "");
  s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

let fail = 0;
const bad = [];

// ---- 1. parseMoney: bazadagi har bir qiymat ----
const taxes = await db.collection("settings_taxes").find({}).sort({ id: 1 }).toArray();
const percents = await db.collection("settings_monthly_percents").find({}).toArray();
const samples = [];
for (const t of taxes) samples.push(["settings_taxes.amount", t.id, t.amount], ["settings_taxes.percent", t.id, t.percent]);
for (const p of percents) samples.push(["settings_monthly_percents.percent", p.id, p.percent]);
// Qo'lda yozilishi mumkin bo'lgan shakllar ham sinaladi.
for (const v of ["1 500 000", "1 500 000", "12%", "12,5", "12.5", "", null, "2000000", "1,800,000", "0"]) {
  samples.push(["qo'lda", "-", v]);
}

for (const [where, id, raw] of samples) {
  const a = parseMoneyOld(raw);
  const b = parseMoneyNew(raw);
  if (a !== b) {
    bad.push({ where, id, raw, eski: a, yangi: b });
  }
}

console.log("1) parseMoney — bazadagi va qo'lda yoziladigan qiymatlar");
console.log(`   sinalgan: ${samples.length} ta`);
if (bad.length === 0) {
  console.log("   ✅ hammasi TENG — hech qanday raqam o'zgarmaydi\n");
} else {
  // "1,800,000" ATAYLAB farq qiladi — bu tuzatilgan xato, regressiya emas.
  const kutilgan = bad.filter((b) => String(b.raw) === "1,800,000");
  const kutilmagan = bad.filter((b) => String(b.raw) !== "1,800,000");
  for (const b of kutilgan) console.log(`   ℹ  ATAYLAB tuzatildi: "${b.raw}" ${b.eski} → ${b.yangi}`);
  for (const b of kutilmagan) { console.log(`   ❌ REGRESSIYA: ${b.where} id=${b.id} "${b.raw}" ${b.eski} → ${b.yangi}`); fail++; }
  console.log();
}

// ---- 2. Soliq qoidalari TEGILMAGAN ----
// Plastik ishi soliqqa umuman tegmasligi kerak: soliq bugungidek qat'iy
// summa bo'lib, hisoblangan oylikdan ushlanadi.
const percentRules = taxes.filter((t) => !/aniq|summa/i.test(String(t.taxType ?? "")));
console.log("2) settings_taxes — soliq turlari");
console.log(`   qoidalar: ${taxes.length} ta, foizli: ${percentRules.length} ta`);
if (percentRules.length === 0) console.log("   ✅ hammasi qat'iy summa — soliq hisobi o'zgarmagan\n");
else console.log(`   ℹ  foizli qoidalar: ${percentRules.map((t) => `${t.id}="${t.name}"`).join(", ")}\n`);

// ---- 3. plastikSalary kimda bor ----
const emps = await db.collection("hr_employees").find({}).project({ id: 1, name: 1, taxIds: 1, plastikSalary: 1, archReason: 1, _id: 0 }).toArray();
const withPlastik = emps.filter((e) => e.plastikSalary !== undefined && e.plastikSalary !== null);
console.log("3) hr_employees.plastikSalary");
console.log(`   xodimlar: ${emps.length} ta, plastik biriktirilgani: ${withPlastik.length} ta`);
if (withPlastik.length === 0) console.log("   ✅ karta oyog'i hamma xodimda 0 — pul bugungidek bitta kanaldan chiqadi\n");
else { console.log(`   ℹ  ${withPlastik.map((e) => `${e.name}=${e.plastikSalary}`).join(", ")}\n`); }

// ---- 4. Tayanch soliq yig'indisi ----
const byId = new Map(taxes.map((t) => [Number(t.id), t]));
let total = 0;
const rows = [];
for (const e of emps) {
  if (e.archReason) continue;
  const ids = Array.isArray(e.taxIds) ? e.taxIds : [];
  if (ids.length === 0) continue;
  let sum = 0;
  for (const id of ids) {
    const r = byId.get(Number(id));
    if (!r || r.active === false) continue;
    const isAmount = /aniq|summa/i.test(String(r.taxType ?? ""));
    const v = parseMoneyNew(isAmount ? r.amount : r.percent);
    if (v <= 0) continue;
    sum += isAmount ? Math.round(v) : 0; // foizli qoida yo'q — bo'lsa gross kerak bo'lardi
  }
  total += sum;
  rows.push({ id: e.id, name: e.name, soliq: sum });
}
console.log("4) TAYANCH RAQAM — migratsiyadan keyin AYNAN shu chiqishi shart");
for (const r of rows) console.log(`   id=${String(r.id).padStart(2)} ${String(r.name).padEnd(28)} ${r.soliq.toLocaleString("ru-RU").padStart(9)}`);
console.log(`   ${"JAMI".padEnd(33)} ${total.toLocaleString("ru-RU").padStart(9)} so'm / oy`);
console.log(`   xodimlar: ${rows.length} ta\n`);

await client.close();
console.log(fail === 0 ? "NATIJA: ✅ 1-bosqich neytral" : `NATIJA: ❌ ${fail} ta regressiya`);
process.exit(fail === 0 ? 0 : 1);
