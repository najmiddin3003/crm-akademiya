// BITTA XODIMNING OYLIK QATORINI HAQIQIY SERVER KODI BILAN HISOBLAYDI.
//
// `lib/payrollSources.ts` → `buildPayrollRows()` — Oylik chiqarish sahifasi
// aynan shu funksiyaning natijasini ko'rsatadi. Ya'ni bu skript sahifadagi
// raqamlarni TAXMIN QILMAYDI, o'sha kodni bevosita chaqiradi.
//
// Foydalanish:
//   node scripts/_probe-payroll-row.mjs "najmiddin"
//   node scripts/_probe-payroll-row.mjs "najmiddin" --oy-oxiri   # 30/30 kun

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";

const needle = (process.argv[2] || "").trim();
const MONTH_END = process.argv.includes("--oy-oxiri");
if (!needle) {
  console.error('Foydalanish: node scripts/_probe-payroll-row.mjs "<ism bo\'lagi>" [--oy-oxiri]');
  process.exit(1);
}

const OUT = ".salarytest";
console.log("Server modullari kompilyatsiya qilinmoqda…");
execFileSync("npx", ["tsc", "-p", "tsconfig.salarytest.json"], { stdio: "inherit", shell: true });

// Emit qilingan fayllar Next'ning `@/` taxallusini saqlaydi — oddiy Node
// uni bilmaydi. Nisbiy yo'lga o'giramiz.
for (const f of fs.readdirSync(path.join(OUT, "lib"))) {
  const p = path.join(OUT, "lib", f);
  fs.writeFileSync(
    p,
    fs.readFileSync(p, "utf8")
      .replace(/"@\/lib\/([^"]+)"/g, '"./$1.js"')
      .replace(/"@\/constants\/([^"]+)"/g, '"../constants/$1.js"')
      .replace(/"\.\/uzTime"/g, '"./uzTime.js"'),
  );
}

const { buildPayrollRows } = await import(pathToFileURL(path.resolve(OUT, "lib/payrollSources.js")).href);
const salary = await import(pathToFileURL(path.resolve(OUT, "lib/salary.js")).href);
const {
  payrollPeriod, payrollEarned, payrollTax, payrollDue,
  payrollPlastikLeg, payrollCashLeg, payrollCashDue, payrollPayout, payrollTaxLines,
} = salary;

const uri = /^MONGODB_URI=(.*)$/m.exec(fs.readFileSync(".env.local", "utf8"))[1].trim().replace(/^["']|["']$/g, "");
const client = new MongoClient(uri);
await client.connect();
const db = client.db("crm-akademiya-nextjs");

let period = payrollPeriod();
if (MONTH_END) period = { ...period, day: period.daysIn };

// Sahifa AYNAN shu chaqiruvni qiladi (app/api/salary-runs/employees-payroll).
const rows = await buildPayrollRows(db, period, { payrollBranchId: 1 });
const e = rows.find((r) => r.name.toLowerCase().includes(needle.toLowerCase()));
if (!e) {
  console.error(`\n❌ "${needle}" 1-filial oylik ro'yxatida topilmadi (ro'yxatda ${rows.length} ta xodim).`);
  await client.close();
  process.exit(1);
}

const money = (n) => Math.round(n).toLocaleString("ru-RU").padStart(13);

console.log(`\n═══ ${e.name} ═══`);
console.log(`Davr: ${period.day}/${period.daysIn} kun · ${MONTH_END ? "OY OXIRI (bashorat)" : "bugungi holat"}`);
console.log(`Turi: ${e.turi} · ${e.salaryType === "foiz" ? `foiz ${e.percent}%` : `oklad ${e.fixedSalary.toLocaleString("ru-RU")}`}`);
console.log(`Plastik oylik: ${e.plastikSalary > 0 ? e.plastikSalary.toLocaleString("ru-RU") + " so'm" : "(biriktirilmagan)"}`);
console.log(`Shu oyda kartadan berilgani: ${e.paidPlastik.toLocaleString("ru-RU")}\n`);

const lines = payrollTaxLines(e, period);
console.log("JADVAL QATORI (Oylik chiqarish sahifasidagi ustunlar tartibida):");
console.log(`  Hisoblangan    ${money(payrollEarned(e, period))}`);
console.log(`  Kartaga        ${e.plastikSalary > 0 ? money(payrollPlastikLeg(e, period)) : "            —"}`);
console.log(`  Soliq         ${payrollTax(e, period) > 0 ? money(-payrollTax(e, period)) : "            0"}${lines.length ? "   (" + lines.map((l) => `${l.name}: ${l.detail}`).join(", ") + ")" : ""}`);
console.log(`  Avans olingan  ${money(e.paidAvans)}`);
console.log(`  To'langan oylik${money(e.paidOylik)}`);
console.log(`  O'tgan oydan   ${money(e.carryOver)}`);
console.log(`  Bonus          ${money(e.bonus)}`);
console.log(`  Jarima         ${money(e.jarima)}`);
// QOLGAN — kartadan KEYINGI qoldiq (sahifadagi ustun bilan bir xil):
// karta yetmasa 0 va yetmagan summa; plastiksiz qarzdorda manfiy.
const cashDue = payrollCashDue(e, period);
const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
console.log(`  QOLGAN         ${money(e.plastikSalary > 0 ? Math.max(cashDue, 0) : cashDue)}${
  cashDue < 0 && e.plastikSalary > 0 ? `   (kartaga ${fmt(-cashDue)} yetmadi)` : cashDue < 0 ? "   (qarzdor)" : ""}`);

const k = payrollPlastikLeg(e, period);
const n = payrollCashLeg(e, period);
const payout = payrollPayout(e, period);
console.log(`\nINVARIANT: kartaga ${fmt(k)} + naqd ${fmt(n)} = ${fmt(k + n)}` +
  `  ${Math.round(k + n) === Math.round(payout) ? "✅ chiqariladigan bilan teng" : "❌ MOS EMAS (" + Math.round(payout) + ")"}` +
  `  · to'lanadigan qoldiq ${fmt(payrollDue(e, period))}`);

await client.close();
