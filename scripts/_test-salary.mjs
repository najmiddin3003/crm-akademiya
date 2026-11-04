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
//   • O'TGAN OY QOLDIG'I — JORIY OYGA QO'SHILADI (04.11.2026, N bo'limi):
//     o'tgan oy qoldig'i va oy o'tgandan keyin o'sha oy uchun kelgan
//     to'lov ulushi keyingi oyning "O'tgan oydan"iga o'tadi; `carryMonths`
//     qaysi oydan kelganini aytadi; to'langach keyingi oyga o'tmaydi.
//     N8 — qadam yig'ish (`carryFoldsByEmployee`).

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
  payrollBase, payrollOkladDays, payrollOkladPart, payrollFoizPart, payrollStartsInPeriod, payrollEndsInPeriod, salaryTypeTag,
  carryContribution, foldCarryChain, carryNoteOf,
  carryFoldsByEmployee, applySettledShare, payrollDebt, frozenRateFor,
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

// ── ISHGA KIRGAN SANA (29.09.2026) ─────────────────────────────────────
// Oklad ishga kirgan kundan: 23-sentabrda kirgan xodimga sentabr uchun
// 8/30 kun, to'liq oy EMAS. Sana yo'q yoki oldingi oyda — avvalgidek.
console.log("\nK) ISHGA KIRGAN SANA — oklad shu kundan");
const k23 = emp({ fixedSalary: 5000000, salaryStart: "2026-09-23" });
check("30-sentabr: kunlar (23..30)", payrollOkladDays(k23, P30), 8);
check("30-sentabr: oklad 5 mln × 8/30", payrollBase(k23, P30), 1333333);
check("15-sentabr: hali kirmagan → 0 kun", payrollOkladDays(k23, P15), 0);
check("15-sentabr: oklad 0", payrollBase(k23, P15), 0);
check("sana shu oyda → izoh chiqadi", payrollStartsInPeriod(k23, P30), true);
const kAug = emp({ fixedSalary: 5000000, salaryStart: "2026-08-10" });
check("avgustda kirgan → sentabr to'liq", payrollBase(kAug, P30), 5000000);
check("avgustda kirgan → izoh yo'q", payrollStartsInPeriod(kAug, P30), false);
const kOct = emp({ fixedSalary: 5000000, salaryStart: "2026-10-01" });
check("oktabrda kiradi → sentabrga 0", payrollBase(kOct, P30), 0);
const kNone = emp({ fixedSalary: 5000000 });
check("sanasiz — eski xulq, to'liq oy", payrollBase(kNone, P30), 5000000);
check("sanasiz — 15-kuni yarmi", payrollBase(kNone, P15), 2500000);
check("1-sanada kirgan = to'liq oy", payrollBase(emp({ fixedSalary: 3000000, salaryStart: "2026-09-01" }), P30), 3000000);
check("noto'g'ri sana e'tiborsiz", payrollBase(emp({ fixedSalary: 3000000, salaryStart: "23.09.2026" }), P30), 3000000);
check("foizli xodimga sana ta'sir qilmaydi",
  payrollBase(emp({ salaryType: "foiz", collected: 1000000, percent: 50, salaryStart: "2026-09-23" }), P30), 500000);

// ── ISHDAN KETGAN SANA (30.09.2026) ────────────────────────────────────
// Oklad oxirgi ish kunigacha (shu kun ham): 15-sentabrda ketgan — 15/30.
console.log("\nM) ISHDAN KETGAN SANA — oklad shu kungacha");
check("15-sentabrda ketgan: 5 mln × 15/30", payrollBase(emp({ fixedSalary: 5000000, salaryEnd: "2026-09-15" }), P30), 2500000);
check("avgustda ketgan → sentabrga 0", payrollBase(emp({ fixedSalary: 5000000, salaryEnd: "2026-08-31" }), P30), 0);
check("oktabrda ketadi → sentabr to'liq", payrollBase(emp({ fixedSalary: 5000000, salaryEnd: "2026-10-05" }), P30), 5000000);
check("10-kirib 20-ketgan: 11 kun", payrollOkladDays(emp({ salaryStart: "2026-09-10", salaryEnd: "2026-09-20" }), P30), 11);
check("10-kirib 20-ketgan: 3 mln × 11/30", payrollBase(emp({ fixedSalary: 3000000, salaryStart: "2026-09-10", salaryEnd: "2026-09-20" }), P30), 1100000);
check("15-kuni ko'rilsa, 20-ketadi → 15 kun", payrollOkladDays(emp({ salaryEnd: "2026-09-20" }), P15), 15);
check("ketgan sana kirgandan oldin → 0", payrollOkladDays(emp({ salaryStart: "2026-09-20", salaryEnd: "2026-09-10" }), P30), 0);
check("izoh: shu oyda ketgan", payrollEndsInPeriod(emp({ salaryEnd: "2026-09-15" }), P30), true);
check("izoh: keyingi oyda ketadi — yo'q", payrollEndsInPeriod(emp({ salaryEnd: "2026-10-05" }), P30), false);
check("oklad + foiz: ketgunicha oklad + to'liq foiz",
  payrollBase(emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 30, collected: 2000000, salaryEnd: "2026-09-15" }), P30), 1100000);

// ── OKLAD + FOIZ (29.09.2026) ──────────────────────────────────────────
// Foydalanuvchi misoli: 1 000 000 oklad + har bir o'quvchi to'lovidan 30%.
console.log("\nL) OKLAD + FOIZ — ikkalasi qo'shiladi");
const mix = emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 30, collected: 2000000 });
check("oklad qismi (to'liq oy)", payrollOkladPart(mix, P30), 1000000);
check("foiz qismi 2 mln × 30%", payrollFoizPart(mix), 600000);
check("asos = 1 000 000 + 600 000", payrollBase(mix, P30), 1600000);
check("hisoblangan (+bonus −jarima)", payrollEarned({ ...mix, bonus: 50000, jarima: 20000 }, P30), 1630000);
check("to'lanadigan (avans 400 000)", payrollDue({ ...mix, paidAvans: 400000 }, P30), 1200000);
check("15-kuni: oklad yarmi + to'liq foiz", payrollBase(mix, P15), 1100000);
const mix26 = { ...mix, salaryStart: "2026-09-26" };
check("26-sentabrda kirgan: oklad 5/30", payrollOkladPart(mix26, P30), 166667);
check("26-sentabrda kirgan: asos", payrollBase(mix26, P30), 766667);
check("faqat oklad — foiz qo'shilmaydi", payrollBase(emp({ fixedSalary: 1000000, percent: 30, collected: 2000000 }), P30), 1000000);
check("faqat foiz — oklad qo'shilmaydi", payrollBase(emp({ salaryType: "foiz", fixedSalary: 1000000, percent: 30, collected: 2000000 }), P30), 600000);
check("yorliq (Sheets/Telegram)", salaryTypeTag(mix), "oklad + 30%");
scenario("L2) Oklad + foiz, plastik 1 000 000, soliq 216 000",
  emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 30, collected: 2000000, taxable: true, taxRules: [TAX_216], plastikSalary: 1000000 }), P30,
  { gross: 1600000, tax: 216000, due: 1384000, plastik: 1000000, naqd: 384000 });

// ── O'TGAN OY QOLDIG'I: JORIY OYGA QO'SHILADI (04.11.2026) ─────────────
// Foydalanuvchi: "hozir noyabr oyi, agar oktabr oyiga to'lov qilinsa noyabr
// oyligiga qo'shilaversin, qancha summa qo'shilayotgani ko'rinib tursa
// bo'ldi". Zanjir lib/salary.ts → `foldCarryChain`, oy ulushi —
// `carryContribution` (ikkalasi ham haqiqiy).
const PAUG = { year: 2026, month: 7, day: 31, daysIn: 31 };
const PSEP = P30;
const POCT = { year: 2026, month: 9, day: 31, daysIn: 31 };
const PNOV = { year: 2026, month: 10, day: 30, daysIn: 30 };
const step = (month, contribution) => ({ month, contribution });
const sumC = (steps) => steps.reduce((s, x) => s + x.contribution, 0);
const sumM = (f) => f.months.reduce((s, x) => s + x.amount, 0);
const monStr = (f) => f.months.map((x) => `${x.month}:${x.amount}`).join(",");

console.log("\nN1) Misol: oktabr uchun to'lov noyabrda keldi → noyabr oyligiga qo'shiladi");
// Foiz 50%: oktabrda 2 000 000 tushum, 1 000 000 berilgan — oy to'liq yopilgan.
const octClosed = emp({ salaryType: "foiz", percent: 50, collected: 2000000, paidOylik: 1000000 });
check("oktabr ulushi 0", carryContribution(octClosed, POCT, false), 0);
check("noyabrga hech narsa o'tmaydi", foldCarryChain([step("2026-10", 0)]).carryOver, 0);
check("…va oy nomi ham yo'q", monStr(foldCarryChain([step("2026-10", 0)])), "");
// Noyabrda «Oktabr» tanlab 400 000 to'lov keldi — ustoz ulushi 200 000.
const octLate = { ...octClosed, collected: 2400000 };
const cLate = carryContribution(octLate, POCT, false);
check("kech to'lov ulushi", cLate, 200000);
const novFold = foldCarryChain([step("2026-10", cLate)]);
check("noyabrga qo'shiladi", novFold.carryOver, 200000);
check("qaysi oydan ko'rinadi", monStr(novFold), "2026-10:200000");
// Noyabrning o'z oyligi 800 000 — jami 1 000 000 chiqadi.
const novRow = emp({ salaryType: "foiz", percent: 50, collected: 1600000, carryOver: novFold.carryOver, carryMonths: novFold.months });
check("noyabr Qolgan = o'z oyligi + oktabrdan", payrollDue(novRow, PNOV), 1000000);
check("chiqariladigan ham shu", payrollPayout(novRow, PNOV), 1000000);

console.log("\nN2) Noyabrda to'langach dekabrga o'tmaydi — ikki marta to'lash yo'q");
const novPaid = emp({ salaryType: "foiz", percent: 50, collected: 1600000, paidOylik: 1000000 });
const cNov = carryContribution(novPaid, PNOV, false);
check("noyabr ulushi = −oktabrdan kelgani", cNov, -200000);
const decFold = foldCarryChain([step("2026-10", cLate), step("2026-11", cNov)]);
check("dekabrga 0 o'tadi", decFold.carryOver, 0);
check("«Oktabr +X, Noyabr −X» shovqini yo'q", monStr(decFold), "");
// Keyin oktabrga yana to'lov keldi — yana aynan «Oktabr» bo'lib ko'rinadi.
const decFold2 = foldCarryChain([step("2026-10", cLate + 50000), step("2026-11", cNov)]);
check("yana kech to'lov: summa", decFold2.carryOver, 50000);
check("yana kech to'lov: oy", monStr(decFold2), "2026-10:50000");

console.log("\nN3) Berilgan pul eng eski qoldiqni yopadi");
const f3a = foldCarryChain([step("2026-09", 100000), step("2026-10", 500000), step("2026-11", -300000)]);
check("sentabr yopildi, oktabrda qoldi", monStr(f3a), "2026-10:300000");
check("summa", f3a.carryOver, 300000);
const f3b = foldCarryChain([step("2026-09", 100000), step("2026-10", 500000), step("2026-11", -50000)]);
check("sentabrdan qisman", monStr(f3b), "2026-09:50000,2026-10:500000");
const f3c = foldCarryChain([step("2026-09", 100000), step("2026-10", 500000)]);
check("ikki oy ham ko'rinadi", monStr(f3c), "2026-09:100000,2026-10:500000");

console.log("\nN4) Qarzdorlik keyin musbat oy va teskarisi");
const f4a = foldCarryChain([step("2026-09", -100000), step("2026-10", 300000)]);
check("−100k, +300k → oktabrdan 200k", monStr(f4a), "2026-10:200000");
check("−100k, +300k → carryOver", f4a.carryOver, 200000);
const f4b = foldCarryChain([step("2026-09", -100000), step("2026-10", 50000)]);
check("−100k, +50k → sentabr qarzi 50k", monStr(f4b), "2026-09:-50000");
check("−100k, +50k → carryOver", f4b.carryOver, -50000);
const f4c = foldCarryChain([step("2026-09", 314000), step("2026-10", -80000)]);
check("+314k, −80k → sentabrdan 234k", monStr(f4c), "2026-09:234000");
const f4d = foldCarryChain([step("2026-09", 100000), step("2026-10", -300000)]);
check("+100k, −300k → oktabr qarzi 200k", monStr(f4d), "2026-10:-200000");

console.log("\nN5) Nol-yopish oyi — ulushi avvalgidek hisoblanadi");
// Oklad + 50%: nol-yopish oyida FAQAT foiz ulushi o'tadi (oklad yopiq).
const augRow = emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 308000 });
const sepRow = emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 320000, paidAvans: 1000000 });
const cAug = carryContribution(augRow, PAUG, true);
const cSep = carryContribution(sepRow, PSEP, false);
check("avgust ulushi (faqat foiz)", cAug, 154000);
check("sentabr ulushi", cSep, 160000);
const octFold = foldCarryChain([step("2026-08", cAug), step("2026-09", cSep)]);
check("oktabrga ikkalasi o'tadi", octFold.carryOver, 314000);
check("ikkala oy ko'rinadi", monStr(octFold), "2026-08:154000,2026-09:160000");
check("sozlanmagan xodim ulushi", carryContribution(emp({ configured: false, fixedSalary: 5000000 }), PSEP, false), 0);
check("nol-yopishda faqat okladli → 0", carryContribution(emp({ fixedSalary: 5000000, paidAvans: 0 }), PAUG, true), 0);
check("nol-yopishda okladli avans olgan → 0", carryContribution(emp({ fixedSalary: 5000000, paidAvans: 700000 }), PAUG, true), 0);
check("bo'sh zanjir → 0", foldCarryChain([]).carryOver, 0);

console.log("\nN6) Qoldiq izohi (carryNoteOf)");
check("bitta oy", carryNoteOf([{ month: "2026-10", amount: 500000 }], PNOV), "Oktabr oyidan qolgan");
check("ikki oy", carryNoteOf([{ month: "2026-09", amount: 1 }, { month: "2026-10", amount: 2 }], PNOV), "Sentabr, Oktabr oylaridan qolgan");
check("qarzdorlik", carryNoteOf([{ month: "2026-10", amount: -500000 }], PNOV), "Oktabr oyidan qarzdorlik");
check("boshqa yil", carryNoteOf([{ month: "2025-12", amount: 500000 }], PNOV), "Dekabr 2025 oyidan qolgan");
check("qoldiq yo'q", carryNoteOf([], PNOV), "");

console.log("\nN7) TASODIFIY ZANJIRLAR (2 000 ta) — invariantlar");
let seed = 20261104;
const rnd = () => {
  // mulberry32 — takrorlanadigan tasodif
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
const bad = { sum: 0, months: 0, sign: 0, order: 0, shuffle: 0, page: 0 };
for (let i = 0; i < 2000; i++) {
  const len = 1 + Math.floor(rnd() * months.length);
  const steps = months.slice(months.length - len).map((m) =>
    step(m, (Math.floor(rnd() * 1001) - 500) * 1000 * (rnd() < 0.15 ? 0 : 1)));
  const f = foldCarryChain(steps);
  // 1) carryOver = ulushlar yig'indisi — pul yo'qolmaydi va qo'shilmaydi.
  if (f.carryOver !== sumC(steps)) bad.sum++;
  // 2) oylar kesimi yig'indisi = carryOver.
  if (sumM(f) !== f.carryOver) bad.months++;
  // 3) hammasi bir xil ishorali, nol yo'q.
  if (f.months.some((x) => x.amount === 0 || (x.amount > 0) !== (f.months[0].amount > 0))) bad.sign++;
  // 4) eskidan yangiga.
  if (f.months.some((x, j) => j > 0 && f.months[j - 1].month >= x.month)) bad.order++;
  // 5) kirish tartibi ahamiyatsiz.
  const shuffled = [...steps].sort(() => rnd() - 0.5);
  if (JSON.stringify(foldCarryChain(shuffled)) !== JSON.stringify(f)) bad.shuffle++;
  // 6) o'tgan oy sahifasidagi Qolgan = keyingi oyning «O'tgan oydan»i.
  const base = emp({ salaryType: "foiz", percent: 50, collected: Math.floor(rnd() * 3000) * 1000, paidAvans: Math.floor(rnd() * 1000) * 1000 });
  const before = foldCarryChain(steps.slice(0, -1));
  const own = steps[steps.length - 1].contribution;
  const page = payrollDue({ ...base, collected: 0, paidAvans: -own, carryOver: before.carryOver }, POCT);
  if (page !== f.carryOver) bad.page++;
}
check("carryOver = Σ ulushlar", bad.sum, 0);
check("Σ oylar = carryOver", bad.months, 0);
check("bir xil ishora, nol yo'q", bad.sign, 0);
check("eskidan yangiga", bad.order, 0);
check("tartibga bog'liq emas", bad.shuffle, 0);
check("oy Qolgan = keyingi oy «O'tgan oydan»", bad.page, 0);

// ── N8: QADAM YIG'ISH — lib/salary.ts → carryFoldsByEmployee ──────────
// loadCarryOver faqat zanjirni quradi va shu funksiyani chaqiradi.
console.log("\nN8) Qadam yig'ish (carryFoldsByEmployee)");
// Qatorlar `carryOver: false` bilan qurilgandek: o'z carryOver'i 0.
const part = (month, period, pureClose, rows) => ({ month, period, pureClose, rows });
// Xodim 1 — oklad + 50%: avgust nol-yopishda foiz ulushi 154 000, sentabr
// ulushi AYNAN 0 (hisoblangan − olingan = 0).
const e1Aug = emp({ id: 1, salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 308000 });
const e1Sep = emp({ id: 1, salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 0, paidAvans: 1000000 });
// Xodim 2 — sentabr qatori YO'Q (o'sha oy ro'yxatida emas), avgust ulushi 50 000.
const e2Aug = emp({ id: 2, salaryType: "foiz", percent: 50, collected: 100000 });
// Xodim 3 — ikkala oyda ham ulushi 0 (hech narsa o'tmaydi).
const e3Aug = emp({ id: 3, fixedSalary: 2000000 });
const e3Sep = emp({ id: 3, fixedSalary: 2000000, paidOylik: 2000000 });
// Xodim 4 — sozlanmagan: ulushi doim 0.
const e4Sep = emp({ id: 4, configured: false, fixedSalary: 5000000 });
// Xodim 5 — sentabrda ortiqcha olgan (qarzdorlik o'tadi).
const e5Sep = emp({ id: 5, fixedSalary: 1000000, paidAvans: 1200000 });
const folds = carryFoldsByEmployee([
  // Zanjir orqaga qurilgani kabi — avval sentabr, keyin avgust.
  part("2026-09", PSEP, false, [e1Sep, e3Sep, e4Sep, e5Sep]),
  part("2026-08", PAUG, true, [e1Aug, e2Aug, e3Aug]),
]);
const f1 = folds.get(1);
check("(a) 0 ulushli oydan keyin ham o'tadi", f1?.carryOver, 154000);
check("(a) …avgust nomi bilan", f1 ? monStr(f1) : "yo'q", "2026-08:154000");
const f2 = folds.get(2);
check("(b) qatori yo'q oy o'tkaziladi", f2?.carryOver, 50000);
check("(c) ikkalasi 0 → xaritada yo'q", folds.has(3), false);
check("(d) sozlanmagan → yo'q", folds.has(4), false);
check("qarzdorlik o'tadi", folds.get(5)?.carryOver, -200000);
check("qarzdorlik: oy nomi bilan", monStr(folds.get(5)), "2026-09:-200000");
check("bo'sh zanjir → bo'sh xarita", carryFoldsByEmployee([]).size, 0);

// ── QO'LDA BERILGAN ULUSH VA YOPILGAN OY (11.10.2026) ─────────────────
// Foydalanuvchi: «avgustda qancha tushum bo'lgan, qancha oylik, qancha avans
// berilgan — shu ko'rinib tursin, qolgan to'lanadiganda esa 0 tursin».
// applySettledShare faqat yalpi ulushni belgilaydi (tushum/to'langan
// o'zgarmaydi), nol-yopish zanjiri uni o'tkazmaydi; yopilgan oyda
// (`closedMonth`) «Qolgan» 0.
console.log("\nQ) Qo'lda berilgan ulush va yopilgan oy");
// Abdushukur: tushum 1 040 000, 50%, qat'iy soliq 216 000, hammasi belgilangan.
const sq1 = applySettledShare(emp({ salaryType: "foiz", percent: 50, collected: 1040000, taxable: true, taxRules: [TAX_216] }), 1040000);
check("tushum o'zgarmaydi", sq1.collected, 1040000);
check("yalpi ulush", sq1.settledShare, 520000);
check("to'langan o'zgarmaydi", sq1.paidOylik, 0);
check("hisoblangan ko'rinadi", payrollEarned(sq1, PAUG), 520000);
check("sentabrga 0 o'tadi", carryContribution(sq1, PAUG, true), 0);
check("yopilmagan oyda Qolgan", payrollDue(sq1, PAUG), 304000);
check("yopilgan oyda Qolgan 0", payrollDue({ ...sq1, closedMonth: true }, PAUG), 0);
check("yopilgan: qarzdorlik 0", payrollDebt({ ...sq1, closedMonth: true }, PAUG), 0);
// Avgustda avans berilgan bo'lsa — ko'rinadi, zanjirdan ayriladi.
const sq2 = applySettledShare(emp({ salaryType: "foiz", percent: 60, collected: 1150000, paidAvans: 100000 }), 1150000);
check("avans ko'rinadi", sq2.paidAvans, 100000);
check("avans: o'tadi −100 000", carryContribution(sq2, PAUG, true), -100000);
check("avans: yopilgan Qolgan 0", payrollDue({ ...sq2, closedMonth: true }, PAUG), 0);
// Qisman: 1 000 000 dan 400 000 belgilangan — qolgan 600 000 ning ulushi o'tadi.
const sq4 = applySettledShare(emp({ salaryType: "foiz", percent: 50, collected: 1000000 }), 400000);
check("qisman: yalpi ulush", sq4.settledShare, 200000);
check("qisman: o'tadi 300 000", carryContribution(sq4, PAUG, true), 300000);
// Okladli xodim yopilgan oyda — hisoblangan ko'rinadi, Qolgan 0.
const okl = emp({ fixedSalary: 3000000 });
check("okladli: o'zgarmaydi", applySettledShare(okl, 500000) === okl, true);
check("okladli yopilgan: Qolgan 0", payrollDue({ ...okl, closedMonth: true }, P30), 0);
check("okladli yopilgan: hisoblangan", payrollEarned({ ...okl, closedMonth: true }, P30), 3000000);
check("okladli yopilgan: chiqariladigan 0", payrollPayout({ ...okl, closedMonth: true }, P30), 0);
// Belgilangan yo'q — o'sha obyekt.
const plain = emp({ salaryType: "foiz", percent: 50, collected: 1000000 });
check("belgisiz: o'zgarmaydi", applySettledShare(plain, 0) === plain, true);

// O'TGAN OY STAVKASI (04.11.2026): oy shu oyga yoki undan keyingi eng yaqin,
// xodim bor nusxa bilan hisoblanadi; nusxa yo'q bo'lsa — bugungi stavka.
console.log("\nO — o'tgan oy stavkasi nusxasi");
const rate = (fixedSalary, extra = {}) => ({ fixedSalary, percent: null, plastikSalary: 0, taxIds: [], ...extra });
const snapOf = (month, employees) => ({ month, employees, taxRules: [{ id: 5, name: month, type: "amount", value: 1 }] });
const pickRate = (list, m, hasStart = false) => frozenRateFor(list, m, 7, hasStart);
const oldSnap = snapOf("2026-10", { 7: rate(3000000) });
const newSnap = snapOf("2026-12", { 7: rate(4000000) });
check("nusxa yo'q — bugungi stavka", pickRate([], "2026-10"), null);
check("o'sha oyning nusxasi", pickRate([oldSnap], "2026-10")?.rate.fixedSalary, 3000000);
check("oldingi oy ham shu nusxa bilan", pickRate([oldSnap], "2026-09")?.rate.fixedSalary, 3000000);
check("nusxadan keyingi oy — bugungi stavka", pickRate([oldSnap], "2026-11"), null);
check("eng yaqini tanlanadi", pickRate([newSnap, oldSnap], "2026-09")?.rate.fixedSalary, 3000000);
check("oraliq oy keyingi nusxadan", pickRate([newSnap, oldSnap], "2026-11")?.rate.fixedSalary, 4000000);
check("soliq o'sha nusxadan", pickRate([newSnap, oldSnap], "2026-09")?.taxRules[0].name, "2026-10");
// Nusxadan keyin ochilgan xodim — keyingi nusxada bor bo'lsa o'sha stavka.
check("nusxada yo'q — keyingisidan", pickRate([snapOf("2026-10", {}), newSnap], "2026-10")?.rate.fixedSalary, 4000000);
check("hech qaysida yo'q — bugungi", pickRate([snapOf("2026-10", {})], "2026-10"), null);
// Sozlanmagan: sanasi bor xodimda stavka emas, sanasizda — turadi.
const unset = snapOf("2026-10", { 7: rate(0) });
check("sozlanmagan, sana bor — bugungi", pickRate([unset], "2026-10", true), null);
check("sozlanmagan, sana bor — keyingisidan", pickRate([unset, newSnap], "2026-10", true)?.rate.fixedSalary, 4000000);
check("sozlanmagan, sana yo'q — turadi", pickRate([unset], "2026-10", false)?.rate.fixedSalary, 0);
// Arxivdagi xodim sanasi bor bo'lsa ham o'tkazib yuborilmaydi.
check("arxivda: turadi", pickRate([snapOf("2026-10", { 7: rate(0, { offFrom: "2026-09" }) })], "2026-10", true)?.rate.offFrom, "2026-09");

console.log(`\n${fail === 0 ? "NATIJA: ✅ hamma tekshiruv o'tdi" : `NATIJA: ❌ ${fail} ta xato`}`);
process.exit(fail === 0 ? 0 : 1);
