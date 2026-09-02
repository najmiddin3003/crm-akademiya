// Xodimlardagi TAKROR yozuvlarni birlashtiradi va telefon raqamlarni
// yagona ko'rinishga keltiradi (bir martalik tuzatish).
//
// MUAMMO: takror raqam tekshiruvi NORMALLASHTIRILGAN raqam bilan qidiradi
// (app/api/hr-employees/route.ts), bazadagi eski yozuvlarda esa raqam xom
// holda saqlangan — "94 042 82 84". `normalizePhone` uni "998940428284"
// qiladi, ya'ni qidiruv mos kelmaydi va bir odamga IKKINCHI xodim yozuvi
// yaratilib ketaveradi. O'lchandi: 57 xodimdan 53 tasining raqami xom.
//
// Natijada ikkita juft paydo bo'lgan. Ularda ma'lumot IKKIGA BO'LINGAN:
//   • eski yozuvda — oylik (oklad) va soliq,
//   • yangi yozuvda — login hisobi (`users.hrEmployeeId`) va ruxsatlar.
// Oylik ISM bo'yicha hisoblanadi, ruxsat esa id bo'yicha — ya'ni bitta
// odam ikki qatorda turadi va yangisiga oylik kiritilsa ikki barobar
// hisoblanadi.
//
// Ishga tushirish:
//   node scripts/merge-duplicate-employees.mjs           # faqat ko'rsatadi
//   node scripts/merge-duplicate-employees.mjs --apply    # bajaradi
//
// QAYTARISH: skript o'chirilgan yozuvlarni `--apply` dan OLDIN
// `scripts/_backup-merged-employees.json` ga to'liq nusxalaydi.
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";

const ROOT = path.resolve(import.meta.dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith("#")) continue;
  const i = s.indexOf("=");
  if (i > 0) process.env[s.slice(0, i).trim()] ??= s.slice(i + 1).trim();
}

const APPLY = process.argv.includes("--apply");

/** lib/eskiz.ts dagi normalizePhone bilan AYNAN bir xil. */
function normalizePhone(input) {
  const d = String(input ?? "").replace(/\D/g, "");
  if (d.length === 9) return "998" + d;
  if (d.length === 12 && d.startsWith("998")) return d;
  if (d.length === 13 && d.startsWith("998")) return d.slice(0, 12);
  return d;
}

const client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);
const col = db.collection("hr_employees");
console.log("Baza:", db.databaseName, APPLY ? "| REJIM: BAJARISH" : "| REJIM: faqat ko'rsatish");

const emps = await col.find({}).sort({ id: 1 }).toArray();

// ── 1-QADAM: telefonlarni normallashtirish ──────────────────────────────
const xom = emps.filter((e) => String(e.phone ?? "") !== normalizePhone(e.phone) && normalizePhone(e.phone));
console.log("\n=== 1) TELEFONLARNI NORMALLASHTIRISH ===");
console.log("  tuzatiladi: " + xom.length + " / " + emps.length);
for (const e of xom.slice(0, 5)) {
  console.log("    id " + String(e.id).padStart(3) + "  \"" + e.phone + "\"  ->  \"" + normalizePhone(e.phone) + "\"");
}
if (xom.length > 5) console.log("    … yana " + (xom.length - 5) + " ta");

// ── 2-QADAM: takror juftlarni topish ────────────────────────────────────
const byPhone = new Map();
for (const e of emps) {
  const k = normalizePhone(e.phone);
  if (!k) continue;
  if (!byPhone.has(k)) byPhone.set(k, []);
  byPhone.get(k).push(e);
}
const pairs = [...byPhone.entries()].filter(([, v]) => v.length > 1);

const userRows = await db.collection("users").find({}).project({ hrEmployeeId: 1, fullName: 1, _id: 0 }).toArray();
const boundIds = new Set(userRows.map((u) => Number(u.hrEmployeeId)).filter(Number.isFinite));

console.log("\n=== 2) TAKROR YOZUVLARNI BIRLASHTIRISH ===");
console.log("  juftlar: " + pairs.length);

const plan = [];
for (const [phone, list] of pairs) {
  // SAQLANADIGAN yozuv — login hisobi bog'langani. Ruxsatlar va sessiya
  // aynan shunga bog'langan (`users.hrEmployeeId`), uni o'chirish
  // foydalanuvchini tizimdan uzib qo'yardi.
  const keep = list.find((e) => boundIds.has(e.id)) ?? list[list.length - 1];
  const drop = list.filter((e) => e.id !== keep.id);

  // Yig'iladigan oklad — eski yozuvdagi filiallar bo'yicha ish haqi
  // yig'indisi. U SAQLANADIGAN yozuvning filialiga (yoki 1-filialga)
  // ko'chiriladi: eski yozuvdagi `branchId: 3` oylik sozlagichida
  // tanlangan qiymat bo'lib, haqiqiy ish joyini ko'rsatmaydi.
  const oklad = list.reduce(
    (s, e) => s + (e.branchAssignments ?? []).reduce((x, a) => x + (Number(a?.salary) || 0), 0), 0);
  const keepBranch = Number(keep.branchAssignments?.[0]?.branchId) || Number(keep.branchIds?.[0]) || 1;
  const keepRole = keep.branchAssignments?.[0]?.roleId ?? null;

  const set = {};
  if (oklad > 0) {
    set.branchAssignments = [{ branchId: keepBranch, roleId: keepRole, scheduleId: null, salary: oklad }];
  }
  // Bo'sh bo'lgan maydonlar eski yozuvdan to'ldiriladi — hech narsa yo'qolmasin.
  for (const f of ["gender", "kurs", "percent", "degree", "photoUrl", "email", "birthDate", "filial"]) {
    if (String(keep[f] ?? "").trim()) continue;
    const manba = drop.find((e) => String(e[f] ?? "").trim());
    if (manba) set[f] = manba[f];
  }
  const taxIds = [...new Set(list.flatMap((e) => (Array.isArray(e.taxIds) ? e.taxIds : [])).map(Number).filter(Number.isFinite))];
  if (taxIds.length > 0 && !(keep.taxIds ?? []).length) set.taxIds = taxIds;
  set.phone = normalizePhone(keep.phone);

  plan.push({ phone, keep, drop, set });

  console.log("\n  " + phone + "  (" + keep.name + ")");
  console.log("    SAQLANADI  id " + keep.id + "  \"" + keep.name + "\"  " +
    (boundIds.has(keep.id) ? "[login shu yerda]" : "[login yo'q]"));
  for (const d of drop) console.log("    O'CHIRILADI id " + d.id + "  \"" + d.name + "\"");
  console.log("    yoziladi: " + JSON.stringify(set));
}

if (!APPLY) {
  console.log("\nBajarish uchun: node scripts/merge-duplicate-employees.mjs --apply");
  await client.close();
  process.exit(0);
}

// ── ZAXIRA ──────────────────────────────────────────────────────────────
const backup = { at: new Date().toISOString(), dropped: plan.flatMap((p) => p.drop), before: plan.map((p) => p.keep) };
const backupPath = path.join(ROOT, "scripts", "_backup-merged-employees.json");
fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf8");
console.log("\nZaxira yozildi: " + backupPath);

// ── BAJARISH ────────────────────────────────────────────────────────────
let nPhone = 0;
for (const e of xom) {
  await col.updateOne({ id: e.id }, { $set: { phone: normalizePhone(e.phone) } });
  nPhone++;
}
console.log("Telefon normallashtirildi: " + nPhone);

for (const p of plan) {
  await col.updateOne({ id: p.keep.id }, { $set: p.set });
  for (const d of p.drop) await col.deleteOne({ id: d.id });
  console.log("Birlashtirildi: id " + p.keep.id + " <- " + p.drop.map((d) => d.id).join(", "));
}

// ── TEKSHIRUV ───────────────────────────────────────────────────────────
const after = await col.find({}).project({ id: 1, name: 1, phone: 1, _id: 0 }).toArray();
const m = new Map();
for (const e of after) {
  const k = normalizePhone(e.phone);
  if (!k) continue;
  m.set(k, (m.get(k) ?? 0) + 1);
}
const qolgan = [...m.values()].filter((k) => k > 1).length;
const xomQolgan = after.filter((e) => String(e.phone ?? "") !== normalizePhone(e.phone) && normalizePhone(e.phone)).length;
console.log("\n=== TEKSHIRUV ===");
console.log("  xodimlar: " + after.length);
console.log("  takror raqamli juft: " + qolgan);
console.log("  xom raqam: " + xomQolgan);

await client.close();
