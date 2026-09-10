// OYLIK FORMULASINING TESTI — haqiqiy `lib/salary.ts` funksiyalarida.
//
// Formulani NUSXALAMAYDI: `lib/salary.ts` alohida kompilyatsiya qilinib,
// aynan ishlab chiqarishda ishlaydigan funksiyalar chaqiriladi. Aks holda
// test o'z nusxasini tekshirib, hisobdagi xatoni ko'rmay qolardi.
//
// Ishga tushirish:  node scripts/_test-salary.mjs
//
// NIMA TEKSHIRILADI:
//   • SOLIQ — bugungidek QAT'IY summa, hisoblangan oylikdan ushlanadi.
//     Plastik unga UMUMAN TA'SIR QILMAYDI.
//   • PLASTIK — to'lovni ikki kanalga bo'ladi, xolos:
//       kartaga = min(plastik summasi − shu oyda kartadan berilgani,
//                     to'lanadigan qoldiq)
//       naqd    = to'lanadigan qoldiq − kartaga
//   • INVARIANT: kartaga + naqd = to'lanadigan qoldiq (HAR DOIM).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const OUT = ".salarytest";

console.log("lib/salary.ts kompilyatsiya qilinmoqda…");
execFileSync("npx", ["tsc", "-p", "tsconfig.salarytest.json"], { stdio: "inherit", shell: true });

// Emit qilingan fayl `@/lib/uzTime` ni import qiladi — bu Next'ning taxallusi,
// oddiy Node uni bilmaydi. Nisbiy yo'lga almashtiramiz.
// YO'L `.salarytest/lib/salary.js` — `.salarytest/salary.js` EMAS.
// tsconfig.salarytest.json da `rootDir: "."` va ro'yxatda `constants/`
// ham bor, ya'ni tsc papka tuzilishini saqlab chiqaradi. Ilgari bu yerda
// tekis yo'l turgan edi va u faqat ESKI seansdan qolgan fayl tufayli
// "ishlardi": tekshiruvlar o'zgartirilgan koddan emas, eskisidan
// o'tardi. `.salarytest` o'chirilishi bilan skript ENOENT bilan yiqildi.
const salaryPath = path.join(OUT, "lib", "salary.js");
fs.writeFileSync(salaryPath, fs.readFileSync(salaryPath, "utf8").replace('"@/lib/uzTime"', '"./uzTime.js"'));

const {
  payrollEarned, payrollTax, payrollTaxLines, payrollDue,
  payrollPlastikLeg, payrollCashLeg,
} = await import(pathToFileURL(path.resolve(salaryPath)).href);

// Davrlar: 30 kunlik oyning turli kunlari.
const P30 = { year: 2026, month: 8, day: 30, daysIn: 30 };
const P15 = { year: 2026, month: 8, day: 15, daysIn: 30 };

// Bazadagi haqiqiy qoidalar — hammasi "Aniq summa".
const TAX_216 = { id: 5, name: "216 000", type: "amount", value: 216000 };
const TAX_180 = { id: 8, name: "180 000", type: "amount", value: 180000 };

function emp(o) {
  return {
    id: 1, name: "Sinov", phone: "", turi: "teacher", configured: true,
    salaryType: "fixed", fixedSalary: 0, percent: 0, collected: 0, futureCollected: 0,
    bonus: 0, jarima: 0, paidAvans: 0, paidOylik: 0, carryOver: 0, carryNote: "",
    taxable: false, taxRules: [], plastikSalary: 0, paidPlastik: 0,
    ...o,
  };
}

let fail = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`   ${ok ? "✅" : "❌"} ${label.padEnd(32)} ${String(got).padStart(12)}${ok ? "" : `   kutilgan: ${want}`}`);
}

function scenario(title, e, p, want) {
  console.log(`\n${title}`);
  const due = payrollDue(e, p);
  const plastik = payrollPlastikLeg(e, p);
  const naqd = payrollCashLeg(e, p);
  check("hisoblangan", payrollEarned(e, p), want.gross);
  check("soliq (qat'iy)", payrollTax(e, p), want.tax);
  check("to'lanadigan", due, want.due);
  check("KARTAGA", plastik, want.plastik);
  check("NAQD", naqd, want.naqd);
  // INVARIANT: ikki oyoq har doim to'lanadigan qoldiqni to'liq qoplaydi.
  check("karta + naqd = to'lanadigan", plastik + naqd, Math.max(due, 0));
}

console.log("\n═══ PLASTIK OYLIK — haqiqiy lib/salary.ts funksiyalari ═══");

scenario("A) Odatiy oy — oklad 5 000 000, plastik 2 000 000, soliq 216 000",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: 5000000, tax: 216000, due: 4784000, plastik: 2000000, naqd: 2784000 });

scenario("B) Katta plastik — 4 000 000 (soliq O'ZGARMAYDI)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 4000000 }), P30,
  { gross: 5000000, tax: 216000, due: 4784000, plastik: 4000000, naqd: 784000 });

scenario("C) Sust oy — foizli o'qituvchi, hisoblangan 550 000",
  emp({ salaryType: "foiz", collected: 1000000, percent: 55, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: 550000, tax: 216000, due: 334000, plastik: 334000, naqd: 0 });

scenario("D) AVANS TUZOG'I — 3 000 000 naqd avans olingan",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000, paidAvans: 3000000 }), P30,
  { gross: 5000000, tax: 216000, due: 1784000, plastik: 1784000, naqd: 0 });

// E1/E2 — PLASTIK OYLIK DAVRGA BO'LINADI (10.09.2026 dan).
// 15-kunda kartaga oylik summaning yarmi mo'ljallanadi (1 500 000/2 =
// 750 000), qolgani naqd oyog'iga tushadi. Oy oxirida ikkinchi chiqarish
// qolgan 750 000 ni kartaga yuboradi — ya'ni oy bo'yicha kartaga baribir
// to'liq 1 500 000 ketadi, faqat ikki bo'lakda.
//
// Ilgari bu yerda 15-kunda ham BUTUN 1 500 000 kutilardi va natijada
// naqd oyog'i deyarli har doim 0 chiqardi (lib/salary.ts →
// payrollPlastikTarget izohiga qarang).
scenario("E1) Bir oyda ikki chiqarish — 15-kun (kartaga yarmi)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 1500000 }), P15,
  { gross: 2500000, tax: 216000, due: 2284000, plastik: 750000, naqd: 1534000 });

scenario("E2) …30-kun (kartaga avval 750 000 ketgan — qolgani yuboriladi)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 1500000, paidOylik: 2284000, paidPlastik: 750000 }), P30,
  { gross: 5000000, tax: 216000, due: 2500000, plastik: 750000, naqd: 1750000 });

scenario("F) Manfiy hisoblangan (jarima asosdan katta) — soliq 0",
  emp({ fixedSalary: 5000000, jarima: 5500000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: -500000, tax: 0, due: -500000, plastik: 0, naqd: 0 });

scenario("G) NEYTRALLIK — plastik yo'q, hammasi bitta kanaldan",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 0 }), P30,
  { gross: 5000000, tax: 216000, due: 4784000, plastik: 0, naqd: 4784000 });

console.log("\nH) SOLIQ PLASTIKDAN MUSTAQIL — plastik o'zgarsa soliq o'zgarmaydi");
const noPl = emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 0 });
const withPl = emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 4000000 });
check("plastiksiz soliq", payrollTax(noPl, P30), 216000);
check("plastikli soliq — o'sha", payrollTax(withPl, P30), 216000);
check("plastiksiz to'lanadigan", payrollDue(noPl, P30), 4784000);
check("plastikli to'lanadigan — o'sha", payrollDue(withPl, P30), 4784000);

console.log("\nI) Ikkita qat'iy soliq — qo'shiladi");
const two = emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216, TAX_180], plastikSalary: 2000000 });
check("soliq qatorlari", payrollTaxLines(two, P30).length, 2);
check("jami soliq", payrollTax(two, P30), 396000);
check("to'lanadigan", payrollDue(two, P30), 4604000);
check("KARTAGA", payrollPlastikLeg(two, P30), 2000000);
check("NAQD", payrollCashLeg(two, P30), 2604000);

console.log("\nJ) Chegara — soliq hisoblangandan oshmaydi");
const capped = emp({ salaryType: "foiz", collected: 200000, percent: 50, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 });
check("hisoblangan", payrollEarned(capped, P30), 100000);
check("soliq 216k → 100k ga qisildi", payrollTax(capped, P30), 100000);
check("to'lanadigan", payrollDue(capped, P30), 0);

console.log(`\n${fail === 0 ? "NATIJA: ✅ hamma tekshiruv o'tdi" : `NATIJA: ❌ ${fail} ta xato`}`);
process.exit(fail === 0 ? 0 : 1);
