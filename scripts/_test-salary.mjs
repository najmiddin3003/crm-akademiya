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
//   • PLASTIK — karta BIRINCHI, naqd — faqat undan oshgani (16.09.2026
//     dagi yakuniy qoida; 10.09–16.09 oralig'ida karta davrga bo'linardi):
//       kartaga = min(plastik summasi − shu oyda kartadan berilgani,
//                     to'lanadigan qoldiq)
//       naqd    = to'lanadigan qoldiq − kartaga     (= "Qolgan" ustuni,
//                                                    NAQD chiqarish chegarasi)
//   • INVARIANT: kartaga + naqd = chiqariladigan jami = max(qoldiq, 0);
//     karta qoldiqdan OSHMAYDI (yetmagani keyingi oyga o'tmaydi), naqd
//     hech qachon manfiy emas.

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
  payrollPlastikLeg, payrollCashLeg, payrollCashDue, payrollPayout,
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
    salaryType: "fixed", fixedSalary: 0, percent: 0, collected: 0, refunded: 0, futureCollected: 0,
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
  check("NAQD (= Qolgan ustuni)", naqd, want.naqd);
  // INVARIANTLAR: ikki oyoq yig'indisi — musbat qoldiq (kassadan
  // chiqadigan jami); karta qoldiqdan oshmaydi; naqd manfiy emas.
  check("karta + naqd = chiqariladigan", plastik + naqd, payrollPayout(e, p));
  check("chiqariladigan = max(qoldiq, 0)", payrollPayout(e, p), Math.max(due, 0));
  check("karta ≤ max(qoldiq, 0)", plastik <= Math.max(due, 0), true);
  check("kartadan keyingi qoldiq", payrollCashDue(e, p), due - plastik);
  check("naqd manfiy emas", naqd >= 0, true);
}

console.log("\n═══ PLASTIK OYLIK — haqiqiy lib/salary.ts funksiyalari ═══");

scenario("A) Odatiy oy — oklad 5 000 000, plastik 2 000 000, soliq 216 000",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: 5000000, tax: 216000, due: 4784000, plastik: 2000000, naqd: 2784000 });

scenario("B) Katta plastik — 4 000 000 (soliq O'ZGARMAYDI)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 4000000 }), P30,
  { gross: 5000000, tax: 216000, due: 4784000, plastik: 4000000, naqd: 784000 });

// C/D — KARTA QOLDIQDAN KATTA: kartaga qoldiqning o'zi ketadi, naqd 0,
// yetmagani KEYINGI OYGA O'TMAYDI (chiqarishdan keyingi qoldiq 0).
scenario("C) Sust oy — foizli o'qituvchi, hisoblangan 550 000 (karta qoldiqcha)",
  emp({ salaryType: "foiz", collected: 1000000, percent: 55, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: 550000, tax: 216000, due: 334000, plastik: 334000, naqd: 0 });

scenario("D) AVANS TUZOG'I — 3 000 000 naqd avans olingan (naqd 0, karta qoldiqcha)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000, paidAvans: 3000000 }), P30,
  { gross: 5000000, tax: 216000, due: 1784000, plastik: 1784000, naqd: 0 });

// FOYDALANUVCHI MISOLI (16.09.2026): kartaga 1 000 000, xodim shu
// kungacha 800 000 ishlagan → kartaga 800 000, "Qolgan" 0; 1 200 000
// ishlagan bo'lsa — kartaga 1 000 000, oshgan 200 000 qo'lga beriladi.
// Umuman ishlamagan xodimga karta ham hisoblanmaydi. Soliqsiz, tugagan oy.
scenario("D1) Foydalanuvchi misoli — karta 1 000 000, ishlagani 800 000",
  emp({ salaryType: "foiz", collected: 1600000, percent: 50, plastikSalary: 1000000 }), P30,
  { gross: 800000, tax: 0, due: 800000, plastik: 800000, naqd: 0 });

scenario("D2) Foydalanuvchi misoli — ishlagani 1 200 000 (oshgani qo'lga)",
  emp({ salaryType: "foiz", collected: 2400000, percent: 50, plastikSalary: 1000000 }), P30,
  { gross: 1200000, tax: 0, due: 1200000, plastik: 1000000, naqd: 200000 });

scenario("D3) Umuman ishlamagan xodim — kartaga ham hech narsa",
  emp({ salaryType: "foiz", collected: 0, percent: 50, plastikSalary: 1000000 }), P30,
  { gross: 0, tax: 0, due: 0, plastik: 0, naqd: 0 });

// Haqiqiy qator (16.09.2026, 16/30 kun): Abdulloh — oklad 5 000 000,
// plastik 1 980 000, soliq 270 000, avans 2 200 500, kartadan 1 001
// berilgan. Qoldiq 195 166 to'liq kartaga, qo'lga 0.
scenario("D4) Abdulloh (16/30) — avans katta, qoldiq kartaga",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [{ id: 9, name: "270 000", type: "amount", value: 270000 }],
    plastikSalary: 1980000, paidAvans: 2200500, paidOylik: 1001, paidPlastik: 1001 }),
  { year: 2026, month: 8, day: 16, daysIn: 30 },
  { gross: 2666667, tax: 270000, due: 195166, plastik: 195166, naqd: 0 });

// E1/E2 — KARTA DAVRGA BO'LINMAYDI (16.09.2026 dan; 10.09–16.09 oralig'ida
// bo'linardi). 15-kunda ham kartaga to'liq 1 500 000 mo'ljal: qoldiq
// yetgani uchun butun karta ketadi, qolgani naqd. Oy oxirida karta
// allaqachon to'lgan — mo'ljal 0, hammasi naqd.
scenario("E1) Bir oyda ikki chiqarish — 15-kun (karta to'liq, qoldiq yetadi)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 1500000 }), P15,
  { gross: 2500000, tax: 216000, due: 2284000, plastik: 1500000, naqd: 784000 });

scenario("E2) …30-kun (karta avval to'lgan — hammasi naqd)",
  emp({ fixedSalary: 5000000, taxable: true, taxRules: [TAX_216], plastikSalary: 1500000, paidOylik: 2284000, paidPlastik: 1500000 }), P30,
  { gross: 5000000, tax: 216000, due: 2500000, plastik: 0, naqd: 2500000 });

// NAQD CHEGARASI (kassa Chiqim oynasi va adjust route): karta
// qoplanmaguncha naqd avans chiqmaydi — chegara aynan `payrollCashLeg`.
console.log("\nE3) NAQD AVANS CHEGARASI — karta qoplanmaguncha 0");
const e3a = emp({ salaryType: "foiz", collected: 3000000, percent: 50, taxable: true, taxRules: [TAX_216], plastikSalary: 1584000 });
check("hisoblangan 1 500 000, soliq 216 000 → qoldiq", payrollDue(e3a, P30), 1284000);
check("naqd chegarasi (karta 1 584 000 qoplanmadi)", payrollCashLeg(e3a, P30), 0);
check("kartaga (qoldiqcha)", payrollPlastikLeg(e3a, P30), 1284000);
const e3b = emp({ salaryType: "foiz", collected: 4000000, percent: 50, taxable: true, taxRules: [TAX_216], plastikSalary: 1584000 });
check("hisoblangan 2 000 000 → naqd chegarasi", payrollCashLeg(e3b, P30), 200000);
check("plastik turida chegara (karta + naqd)", payrollPayout(e3b, P30), 1784000);

scenario("F) Manfiy hisoblangan (jarima asosdan katta) — soliq 0, hech narsa chiqmaydi",
  emp({ fixedSalary: 5000000, jarima: 5500000, taxable: true, taxRules: [TAX_216], plastikSalary: 2000000 }), P30,
  { gross: -500000, tax: 0, due: -500000, plastik: 0, naqd: 0 });

scenario("F1) Plastiksiz qarzdor — pul chiqmaydi",
  emp({ fixedSalary: 5000000, jarima: 5500000, taxable: true, taxRules: [TAX_216], plastikSalary: 0 }), P30,
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
