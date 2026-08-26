// O'qituvchilarga oylik FOIZINI biriktiradi: Excel ro'yxatidagi har bir
// o'qituvchining `hr_employees.percent` maydonini belgilangan foizga
// o'rnatadi.
//
// Sukut bo'yicha QURUQ YURISH. Yozish uchun `--yes`.
//
//   node scripts/import-teacher-percents.mjs "C:/.../royxat.xlsx" --percent 40
//   node scripts/import-teacher-percents.mjs "C:/.../royxat.xlsx" --percent 40 --yes
//
// Fayl formati (edutizim "Xodimlar" eksporti):
//   To'liq ismi | Telefon raqami | Kurslar | Jinsi | Turi | Filial
//
// NIMA UCHUN TELEFON BO'YICHA MOSLASHTIRILADI: bazada ismlari juda
// o'xshash xodimlar bor ("Abdullo Rahmatullayev" — o'qituvchi va
// "Abdulloh Raxmatullayev" — moderator). Ism bo'yicha moslashtirish
// noto'g'ri odamga oylik yozib qo'yishi mumkin, telefon esa unikal.
// Ism faqat ZAXIRA sifatida va telefon topilmagandagina ishlatiladi.
//
// FOIZ QANDAY SAQLANADI: `percent` maydonida DARAJA NOMI turadi, raqam
// esa Sozlamalar → Moliya → Oylik foizlari ro'yxatida (lib/payrollSources.ts
// → loadPercentByTier). Shu sababli skript avval o'sha ro'yxatda kerakli
// darajani topadi, topmasa — yaratadi, so'ng xodimga uning NOMINI yozadi.
// Aks holda xodim kartasidagi "Ish haqi" oynasida dropdown bo'sh ko'rinadi.
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
// Xodimda ALLAQACHON boshqa foiz turgan bo'lsa — tegmaydi. Ro'yxat ommaviy
// biriktirish uchun, alohida kelishilgan foiz esa ro'yxatdan ustun turadi.
const KEEP_EXISTING = process.argv.includes("--keep-existing");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
const pi = process.argv.indexOf("--percent");
const PERCENT = pi > -1 ? Number(process.argv[pi + 1]) : NaN;

if (!FILE || !Number.isFinite(PERCENT) || PERCENT <= 0) {
  console.error('Foydalanish: node scripts/import-teacher-percents.mjs "<fayl.xlsx>" --percent 40 [--keep-existing] [--yes]');
  process.exit(1);
}

const norm = (v) => String(v ?? "").replace(/[\u2019\u02BB\u02BC`]/g, "'").replace(/\s+/g, " ").trim();
/**
 * Telefonni solishtirish kaliti — OXIRGI 9 raqam (O'zbekistonda milliy
 * raqam aynan 9 xonali).
 *
 * DIQQAT: bu yerda `.replace(/^998/, "")` ishlatib BO'LMAYDI. Baza raqamni
 * mamlakat kodisiz saqlaydi ("99 867 05 27"), lekin uning O'ZI 998 bilan
 * boshlanadi — prefiks kesuvchi uni ham qirqib "670527" qoldiradi va
 * o'sha xodim telefon bo'yicha topilmay qoladi.
 */
const digits = (v) => String(v ?? "").replace(/\D/g, "").slice(-9);
const nameKey = (v) => norm(v).toLowerCase();
const numOf = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------- Excel

const wb = XLSX.readFile(FILE);
const R = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
const wanted = [];
for (let i = 1; i < R.length; i++) {
  const name = norm(R[i][0]);
  const phone = digits(R[i][1]);
  if (!name) continue;
  wanted.push({ row: i + 1, name, phone });
}
console.log(`Excel: ${FILE}`);
console.log(`Ro'yxatda ${wanted.length} ta o'qituvchi, biriktiriladigan foiz: ${PERCENT}%\n`);

// ---------------------------------------------------------------- baza

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB || "crm_akademiya");
const employees = db.collection("hr_employees");
const tiers = db.collection("settings_monthly_percents");

// 1) Daraja (Oylik foizlari ro'yxatidagi yozuv) — bor bo'lsa o'shani olamiz,
//    bo'lmasa yangisini rejalashtiramiz (`__create` belgisi bilan; haqiqiy
//    yozish faqat --yes bo'lganda, 4-bosqichda bo'ladi).
const tierPool = await tiers.find({}).toArray();
let nextTierId = Math.max(0, ...tierPool.map((t) => Number(t.id) || 0)) + 1;
function ensureTier(value) {
  const found = tierPool.find((t) => numOf(t.percent) === value);
  if (found) return found;
  const made = {
    id: nextTierId++,
    kind: "monthly-percents",
    name: String(value),
    percent: String(value),
    system: false,
    __create: true,
  };
  tierPool.push(made);
  return made;
}

const tier = ensureTier(PERCENT);
console.log(
  tier.__create
    ? `Oylik foizlari ro'yxatida ${PERCENT}% yo'q — "${tier.name}" nomli yangi daraja yaratiladi (id=${tier.id}).`
    : `Oylik foizlari ro'yxatidan mavjud daraja ishlatiladi: "${tier.name}" (${tier.percent}%).`,
);

// 2) Xodimlarni moslashtirish.
const all = await employees.find({}).sort({ id: 1 }).toArray();
const byPhone = new Map();
for (const e of all) {
  const k = digits(e.phone);
  if (!k) continue;
  // Telefon takrorlansa moslashtirish ishonchsiz — belgilab qo'yamiz.
  byPhone.set(k, byPhone.has(k) ? "AMBIGUOUS" : e);
}
const byName = new Map();
for (const e of all) {
  const k = nameKey(e.name);
  byName.set(k, byName.has(k) ? "AMBIGUOUS" : e);
}

const plan = [];
const problems = [];
for (const w of wanted) {
  let emp = w.phone ? byPhone.get(w.phone) : undefined;
  let how = "telefon";
  if (!emp || emp === "AMBIGUOUS") {
    const byN = byName.get(nameKey(w.name));
    if (emp === "AMBIGUOUS") {
      problems.push(`${w.row}-qator: ${w.name} — telefon (${w.phone}) bir necha xodimda uchradi`);
      continue;
    }
    if (!byN) { problems.push(`${w.row}-qator: ${w.name} (${w.phone}) — bazada topilmadi`); continue; }
    if (byN === "AMBIGUOUS") { problems.push(`${w.row}-qator: ${w.name} — ism bir necha xodimda uchradi`); continue; }
    emp = byN;
    how = "ism (telefon mos kelmadi)";
  }
  if (emp.turi !== "teacher") {
    problems.push(`${w.row}-qator: ${w.name} — bazada "${emp.turi}", o'qituvchi emas`);
    continue;
  }
  plan.push({ emp, excelName: w.name, how, before: String(emp.percent ?? "") });
}

// 3) Hisobot.
const same = plan.filter((p) => p.before === tier.name);
// Boshqa foiz turgan xodimlar: --keep-existing bilan chetlab o'tiladi,
// aks holda ustiga yoziladi (va hisobotda alohida ogohlantiriladi).
const conflicting = plan.filter((p) => p.before !== "" && p.before !== tier.name);
const kept = KEEP_EXISTING ? conflicting : [];
const changed = plan.filter((p) => p.before !== tier.name && !kept.includes(p));

console.log(`\nMoslashtirildi: ${plan.length}/${wanted.length}`);
for (const p of plan) {
  const mark =
    kept.includes(p) ? `= ${p.before}% saqlanadi (tegilmaydi)`
    : p.before === tier.name ? "= o'zgarishsiz"
    : p.before ? `${p.before} → ${tier.name}`
    : `(bo'sh) → ${tier.name}`;
  console.log(`  #${String(p.emp.id).padStart(2)} ${p.emp.name.padEnd(26)} ${mark}${p.how !== "telefon" ? `   [${p.how}]` : ""}`);
}
// Chetlab o'tilgan xodimning foizi ham ro'yxatda TURISHI kerak — aks holda
// uning kartasidagi "Ish haqi" oynasida dropdown bo'sh ko'rinadi (hisob-kitob
// esa ishlayveradi: resolvePercent raqamga fallback qiladi).
const extraTiers = [...new Set(kept.map((p) => numOf(p.before)).filter((v) => v !== null && v > 0))]
  .map(ensureTier)
  .filter((t) => t.__create);

if (kept.length) {
  console.log(`\n--keep-existing — mavjud foizi bor ${kept.length} ta xodim chetlab o'tildi:`);
  for (const p of kept) console.log(`  #${p.emp.id} ${p.emp.name}: ${p.before}% saqlanadi`);
  for (const t of extraTiers) console.log(`  → "${t.name}" (${t.percent}%) darajasi ham ro'yxatga qo'shiladi (id=${t.id})`);
} else if (conflicting.length) {
  console.log(`\nDIQQAT — mavjud BOSHQA foiz ustiga yoziladi (${conflicting.length}):`);
  for (const p of conflicting) console.log(`  #${p.emp.id} ${p.emp.name}: ${p.before}% → ${PERCENT}%`);
}
if (problems.length) {
  console.log(`\nMUAMMOLAR (${problems.length}) — bu qatorlar O'TKAZIB YUBORILADI:`);
  for (const s of problems) console.log(`  ${s}`);
}

// 4) Yozish.
if (!APPLY) {
  console.log(`\nQURUQ YURISH — hech narsa yozilmadi. Yozish uchun --yes qo'shing.`);
  const newTiers = [tier, ...extraTiers].filter((t) => t.__create).length;
  console.log(`Yoziladi: ${changed.length} ta xodim${newTiers ? ` + ${newTiers} ta daraja yozuvi` : ""}.`);
  await client.close();
  process.exit(0);
}

for (const t of [tier, ...extraTiers]) {
  if (t.__create) { const { __create, ...doc } = t; await tiers.insertOne(doc); }
}
let n = 0;
for (const p of changed) {
  const res = await employees.updateOne({ id: p.emp.id }, { $set: { percent: tier.name } });
  n += res.modifiedCount;
}
console.log(`\nYOZILDI: ${n} ta xodim yangilandi, ${same.length} tasi allaqachon ${PERCENT}% edi.`);
if (kept.length) console.log(`${kept.length} ta xodim mavjud foizi bilan qoldirildi.`);
for (const t of [tier, ...extraTiers]) {
  if (t.__create) console.log(`Oylik foizlari ro'yxatiga "${t.name}" (${t.percent}%) qo'shildi.`);
}
await client.close();
