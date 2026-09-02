// AVGUST (2026-08) OYLIGINI NOL QOLDIQ BILAN YOPADI.
//
//   node scripts/close-august-payroll.mjs           # quruq yurish, hech narsa yozmaydi
//   node scripts/close-august-payroll.mjs --apply   # haqiqatan yozadi
//
// ------------------------------------------------------------------
// NIMA UCHUN KERAK BO'LDI
//
// Tizim 02.09.2026 da ishga tushdi: barcha `transaction_entries`
// yozuvlari o'sha kuni yaratilgan. Avgustda atigi 3 ta yozuv bor va
// ular ham sentabrda ORQAGA SANA qo'yib kiritilgan o'quvchi to'lovlari
// (jami 695 000 so'm). Iyulda umuman yozuv yo'q.
//
// Oylik hisobida (lib/payrollSources.ts -> loadCarryOver) shunday shart
// bor: "o'tgan oyda birorta ham moliyaviy yozuv bo'lmasa, qoldiq
// o'tkazilmaydi". Avgustda 3 ta yozuv bor — shart ISHLAMAYDI. Natijada
// tizim avgustni haqiqiy ishlangan oy deb hisoblab, oklad oladigan
// 8 xodimning TO'LIQ oyligini (34 500 000 so'm) "to'lanmagan" deb
// sentabrga o'tkazadi.
//
// Bu QARZ EMAS — avgustda hech kimga oylik chiqarilmagan, chunki tizim
// hali ishlamayotgan edi. Oklad "hisoblangan"i har oy o'z-o'zidan paydo
// bo'ladi, "to'langan"i esa faqat kassa yozuvidan keladi; kassada avgust
// oyligi yo'q, shuning uchun hamma summa ochiq qoldiq bo'lib chiqadi.
//
// ------------------------------------------------------------------
// YECHIM (foydalanuvchi tanlovi)
//
// Avgust uchun `salary_runs` hujjati yoziladi va undagi HAR BIR xodimning
// qoldig'i 0 qilib qo'yiladi. loadCarryOver mana shu shoxni tanlaydi:
//
//     const prevRuns = await db.collection("salary_runs").find({ month: prev })...
//     if (prevRuns.length === 0) { ...jonli hisob... }   // <- endi bu yerga TUSHMAYDI
//     // muzlatilgan qoldiq jonli hisobdan USTUN
//
// Ya'ni sentabr sahifasidagi "O'tgan oydan" ustuni butunlay bo'shaydi —
// oklad oladigan 8 xodimga ham, foizli o'qituvchilarga ham.
//
// PUL HARAKATLANMAYDI. Bu skript FAQAT `salary_runs` ga bitta hujjat
// yozadi; `transaction_entries` ga ham, `transactions` ga ham, kassa
// balansiga ham TEGMAYDI. Ya'ni bu "oylik chiqarish" emas, "avgustni
// nol qoldiq bilan yopish".
//
// OGOHLANTIRISH: hujjat "Moliya -> Oylik chiqarish" tarixida bo'lib
// o'tmagan chiqarish bo'lib ko'rinadi (summalari nol). Bu tanlovning
// ma'lum kamchiligi. Qaytarish oson:
//     DELETE /api/salary-runs/<id>   yoki   db.salary_runs.deleteOne({id})
// bog'liq kassa yozuvi bo'lmagani uchun o'chirish boshqa hech narsaga
// tegmaydi.
//
// IDEMPOTENT: avgust uchun yozuv allaqachon bo'lsa, skript hech narsa
// qilmaydi.

import fs from "fs";
import { MongoClient } from "mongodb";

const MONTH = "2026-08";
const APPLY = process.argv.includes("--apply");

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

/**
 * "DD.MM.YYYY | HH:mm" — SalaryRun.createdAt formati, TOSHKENT soatida.
 * Mahalliy soatga tayanmaydi: skript boshqa zonadagi mashinadan ishga
 * tushirilsa ham yozuv sanasi tizimnikiga mos bo'lishi kerak
 * (lib/uzTime.ts bilan bir xil qoida).
 */
function stamp() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fmt = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n || 0));

const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 5 });
await client.connect();
const db = client.db(env.MONGODB_DB || undefined);
console.log(`Baza: ${db.databaseName}`);
console.log(APPLY ? "REJIM: --apply (YOZADI)\n" : "REJIM: quruq yurish (hech narsa yozilmaydi)\n");

const runsCol = db.collection("salary_runs");

// --- 1. Idempotentlik ---
const existing = await runsCol.find({ month: MONTH }).toArray();
if (existing.length > 0) {
  console.log(`${MONTH} uchun ALLAQACHON ${existing.length} ta salary_runs yozuvi bor:`);
  for (const r of existing) console.log(`  id=${r.id} createdAt=${r.createdAt} items=${r.items?.length ?? 0}`);
  console.log("\nHech narsa qilinmadi.");
  await client.close();
  process.exit(0);
}

// --- 2. Xodimlar ---
// Arxivlangan xodim oylik hisobiga UMUMAN kirmaydi (lib/payrollSources.ts
// dagi `archReason: { $in: ["", null] }` filtri), shuning uchun ro'yxatga
// faqat aktivlar olinadi.
const emps = await db.collection("hr_employees")
  .find({ $or: [{ archReason: "" }, { archReason: null }, { archReason: { $exists: false } }] })
  .project({ _id: 0, id: 1, name: 1, percent: 1, branchAssignments: 1 })
  .sort({ id: 1 })
  .toArray();

const fixedOf = (e) => (e.branchAssignments ?? []).reduce((s, b) => s + (Number(b?.salary) || 0), 0);
const oklad = emps.filter((e) => fixedOf(e) > 0);

console.log(`Aktiv xodim: ${emps.length} ta`);
console.log(`  shundan oklad oladigan: ${oklad.length} ta, jami ${fmt(oklad.reduce((s, e) => s + fixedOf(e), 0))} so'm/oy`);
console.log(`  (aynan shu summa hozir sentabrga "o'tgan oydan qarz" bo'lib o'tyapti)\n`);

// --- 3. Hujjat ---
const last = await runsCol.find({}).sort({ id: -1 }).limit(1).toArray();
const nextId = (Number(last[0]?.id) || 0) + 1;

const doc = {
  id: nextId,
  month: MONTH,
  createdAt: stamp(),
  employeeCount: emps.length,
  // Hamma had NOL — bu chiqarish emas, oyni nol qoldiq bilan yopish.
  oylik: 0,
  davomat: 0,
  davomatFoizi: 0,
  bonus: 0,
  avans: 0,
  jarima: 0,
  akladi: 0,
  soliq: 0,
  tolanmagan: 0,
  tolangan: 0,
  qarzdorlik: 0,
  // Har bir xodimning KEYINGI OYGA o'tadigan qoldig'i = 0.
  // loadCarryOver aynan shu massivdan o'qiydi.
  items: emps.map((e) => ({ employeeId: e.id, name: String(e.name ?? ""), amount: 0, paid: 0 })),
};

console.log(`Yoziladigan hujjat: salary_runs id=${doc.id} month=${doc.month} items=${doc.items.length} ta (hammasi amount: 0)`);
console.log(`  createdAt: ${doc.createdAt}`);
console.log(`  pul harakati: YO'Q (transaction_entries ga tegilmaydi)\n`);

if (!APPLY) {
  console.log("Quruq yurish tugadi. Yozish uchun: node scripts/close-august-payroll.mjs --apply");
  await client.close();
  process.exit(0);
}

await runsCol.insertOne(doc);
console.log(`YOZILDI: salary_runs id=${doc.id}`);

// --- 4. Tekshiruv ---
const check = await runsCol.find({ month: MONTH }).toArray();
const nonZero = (check[0]?.items ?? []).filter((i) => Number(i.amount) !== 0);
console.log(`Tekshiruv: ${MONTH} uchun ${check.length} ta yozuv, nolga teng bo'lmagan qoldiq: ${nonZero.length} ta`);
console.log("\nEndi sentabr oylik sahifasidagi \"O'tgan oydan\" ustuni bo'sh bo'lishi kerak.");
console.log(`Qaytarish: DELETE /api/salary-runs/${doc.id}`);

await client.close();
