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
//   • O'TGAN OY QOLDIG'I — "FAQAT O'Z OYIDAN" (04.10.2026, N bo'limi):
//     o'tgan oyning musbat qoldig'i keyingi oyda TO'LANMAYDI (`carryPending`,
//     faqat ma'lumot), nol-yopish ulushi va qarzdorlik avvalgidek o'tadi;
//     INVARIANT carryOver + Σ pending = eski chiziqli yig'indi (aniq).
//     N8 — qadam yig'ish (`carryFoldsByEmployee`: 0 ulushli oy qadam, qatori
//     yo'q oy emas); N9 — o'tish davri qorovuli (`payrollPendingMaybePaid`:
//     o'tgan oy puli shu oy yozuvi bo'lib berilgan bo'lishi mumkin).

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
  carryContribution, foldCarryChain, payrollOwedTotal, payrollCarryTotal,
  carryFoldsByEmployee, payrollPendingMaybePaid, pendingMaybePaidByMonth,
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

// ── O'TGAN OY QOLDIG'I: "FAQAT O'Z OYIDAN" (04.10.2026) ────────────────
// Foydalanuvchi qarori: o'tgan oyning to'lanmagan (musbat) qoldig'i keyingi
// oyning to'lanadigan summasiga QO'SHILMAYDI — faqat o'z oyining sahifasidan
// chiqariladi, keyingi oyda ma'lumot (`carryPending`). Nol-yopish ulushi va
// qarzdorlik avvalgidek keyingi oyga o'tadi. Zanjir lib/salary.ts →
// `foldCarryChain`, oy ulushi — `carryContribution` (ikkalasi ham haqiqiy).
const PAUG = { year: 2026, month: 7, day: 31, daysIn: 31 };
const PSEP = P30;
const POCT = { year: 2026, month: 9, day: 31, daysIn: 31 };
const step = (month, contribution, pureClose = false) => ({ month, pureClose, contribution });
const sumC = (steps) => steps.reduce((s, x) => s + x.contribution, 0);
const sumP = (f) => f.pending.reduce((s, x) => s + x.amount, 0);
const pendStr = (f) => f.pending.map((x) => `${x.month}:${x.amount}`).join(",");

console.log("\nN1) Misol: avgust nol-yopish 154 000 + sentabr 160 000 → oktabrda pending");
// Oklad + 50%: nol-yopish oyida FAQAT foiz ulushi o'tadi (oklad yopiq).
const augRow = emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 308000 });
const sepRow = emp({ salaryType: "mixed", fixedSalary: 1000000, percent: 50, collected: 320000, paidAvans: 1000000 });
const cAug = carryContribution(augRow, PAUG, true);
const cSep = carryContribution(sepRow, PSEP, false);
check("avgust ulushi (faqat foiz)", cAug, 154000);
check("sentabr ulushi (1 160 000 − 1 000 000)", cSep, 160000);
const sepFold = foldCarryChain([step("2026-08", cAug, true)]);
check("sentabr sahifasi: carryOver", sepFold.carryOver, 154000);
check("sentabr sahifasi: pending yo'q", sepFold.pending.length, 0);
const sepPage = { ...sepRow, carryOver: sepFold.carryOver, carryPending: 0 };
check("sentabr sahifasi: Qolgan", payrollDue(sepPage, PSEP), 314000);
// Zanjir ORQAGA qurilgani kabi teskari tartibda beriladi — fold o'zi saralaydi.
const octSteps = [step("2026-09", cSep), step("2026-08", cAug, true)];
const octFold = foldCarryChain(octSteps);
check("oktabr: to'lanadigan carryOver", octFold.carryOver, 0);
check("oktabr: pending", pendStr(octFold), "2026-09:314000");
check("pending = sentabr sahifasi Qolgan", octFold.pending[0]?.amount, payrollDue(sepPage, PSEP));
check("INVARIANT: carry + pending = eski", octFold.carryOver + sumP(octFold), sumC(octSteps));
// Oktabrda o'z ishlagani yo'q — o'tgan oy puli bu yerdan CHIQMAYDI.
const octIdle = emp({ salaryType: "foiz", percent: 50, collected: 0, carryOver: octFold.carryOver, carryPending: sumP(octFold) });
check("oktabr: payrollDue (pendingsiz)", payrollDue(octIdle, POCT), 0);
check("oktabr: chiqariladigan 0", payrollPayout(octIdle, POCT), 0);
check("oktabr: naqd chegarasi 0", payrollCashLeg(octIdle, POCT), 0);
check("oktabr: jami qarz (owedTotal)", payrollOwedTotal(octIdle, POCT), 314000);
check("oktabr: jami carry (carryTotal)", payrollCarryTotal(octIdle), 314000);
// O'z ishlagani bor bo'lsa — faqat o'shani to'laydi.
const octWork = emp({ salaryType: "foiz", percent: 50, collected: 1000000, carryOver: octFold.carryOver, carryPending: sumP(octFold) });
check("oktabr 500 000 ishlagan: chiqariladigan", payrollPayout(octWork, POCT), 500000);
check("oktabr 500 000 ishlagan: jami qarz", payrollOwedTotal(octWork, POCT), 814000);
check("eski formula = owedTotal", payrollDue({ ...octWork, carryOver: sumC(octSteps), carryPending: 0 }, POCT), payrollOwedTotal(octWork, POCT));

console.log("\nN2) Sentabr o'z sahifasidan chiqarildi → oktabrda hech narsa qolmaydi");
const cSepPaid = carryContribution({ ...sepRow, paidOylik: 314000 }, PSEP, false);
check("sentabr ulushi (chiqarilgandan keyin)", cSepPaid, -154000);
const octFold2 = foldCarryChain([step("2026-08", cAug, true), step("2026-09", cSepPaid)]);
check("oktabr: carryOver", octFold2.carryOver, 0);
check("oktabr: pending yo'q", octFold2.pending.length, 0);

console.log("\nN3) QARZDORLIK — ortiqcha to'langan keyingi oydan ushlanadi");
const cSepOver = carryContribution({ ...sepRow, paidAvans: 1360000 }, PSEP, false);
check("sentabr ulushi (ortiqcha avans)", cSepOver, -200000);
const octFold3 = foldCarryChain([step("2026-08", cAug, true), step("2026-09", cSepOver)]);
check("oktabr: carryOver (qarzdorlik)", octFold3.carryOver, -46000);
check("oktabr: pending yo'q", octFold3.pending.length, 0);
const octDebt = emp({ salaryType: "foiz", percent: 50, collected: 1000000, carryOver: octFold3.carryOver, carryPending: 0 });
check("oktabr: 500 000 − 46 000", payrollDue(octDebt, POCT), 454000);
check("oktabr: owedTotal = payrollDue", payrollOwedTotal(octDebt, POCT), 454000);

console.log("\nN4) Ikki oy to'lanmagan — har biri o'z oyida, eskidan yangiga");
const novFold = foldCarryChain([step("2026-10", 500000), step("2026-08", 154000, true), step("2026-09", 160000)]);
check("noyabr: carryOver", novFold.carryOver, 0);
check("noyabr: pending", pendStr(novFold), "2026-09:314000,2026-10:500000");
check("noyabr: jami pending", sumP(novFold), 814000);

console.log("\nN5) Qarzdorlik keyin musbat oy / pending keyin qarzdorlik");
const f5a = foldCarryChain([step("2026-09", -100000), step("2026-10", 300000)]);
check("−100k, +300k → pending", pendStr(f5a), "2026-10:200000");
check("−100k, +300k → carryOver", f5a.carryOver, 0);
const f5b = foldCarryChain([step("2026-09", -100000), step("2026-10", 50000)]);
check("−100k, +50k → carryOver", f5b.carryOver, -50000);
check("−100k, +50k → pending yo'q", f5b.pending.length, 0);
const f5c = foldCarryChain([step("2026-09", 314000), step("2026-10", -80000)]);
check("+314k, −80k → pending", pendStr(f5c), "2026-09:314000");
check("+314k, −80k → carryOver", f5c.carryOver, -80000);

console.log("\nN6) Nol-yopish oyi chiqarilmaydi — hammasi o'tadi");
check("musbat nol-yopish → carryOver", foldCarryChain([step("2026-08", 154000, true)]).carryOver, 154000);
check("manfiy nol-yopish → carryOver", foldCarryChain([step("2026-08", -30000, true)]).carryOver, -30000);
check("bo'sh zanjir → 0", foldCarryChain([]).carryOver, 0);
// Nol-yopishdan kelgan musbat qoldiq ulushi 0 bo'lgan oyda ham TURIB QOLADI.
check("avgust 154k, sentabr 0 → pending", pendStr(foldCarryChain([step("2026-08", 154000, true), step("2026-09", 0)])), "2026-09:154000");
check("sozlanmagan xodim ulushi", carryContribution(emp({ configured: false, fixedSalary: 5000000 }), PSEP, false), 0);
check("nol-yopishda faqat okladli → 0", carryContribution(emp({ fixedSalary: 5000000, paidAvans: 0 }), PAUG, true), 0);
check("nol-yopishda okladli avans olgan → 0", carryContribution(emp({ fixedSalary: 5000000, paidAvans: 700000 }), PAUG, true), 0);

console.log("\nN7) TASODIFIY ZANJIRLAR (2 000 ta) — invariantlar");
let seed = 20261004;
const rnd = () => {
  // mulberry32 — takrorlanadigan tasodif
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const months = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
const bad = { inv: 0, positive: 0, order: 0, payable: 0, pageDue: 0, shuffle: 0, owed: 0 };
for (let i = 0; i < 2000; i++) {
  const len = 1 + Math.floor(rnd() * months.length);
  const pureFirst = rnd() < 0.5;
  const steps = months.slice(months.length - len).map((m, j) =>
    step(m, (Math.floor(rnd() * 1001) - 500) * 1000 * (rnd() < 0.15 ? 0 : 1), pureFirst && j === 0));
  const f = foldCarryChain(steps);
  // 1) carryOver + Σ pending = chiziqli yig'indi — ANIQ.
  if (f.carryOver + sumP(f) !== sumC(steps)) bad.inv++;
  // 2) pending har biri musbat va nol-yopish oyi emas.
  if (f.pending.some((x) => !(x.amount > 0) || steps.find((s) => s.month === x.month)?.pureClose)) bad.positive++;
  // 3) pending eskidan yangiga.
  if (f.pending.some((x, j) => j > 0 && f.pending[j - 1].month >= x.month)) bad.order++;
  // 4) musbat to'lanadigan qoldiq FAQAT eng yangi oy nol-yopish bo'lsa.
  if (f.carryOver > 0 && !steps[steps.length - 1].pureClose) bad.payable++;
  // 5) pending summasi = o'sha oy sahifasidagi qoldiq (o'sha oygacha bo'lgan
  //    zanjirning carryOver + o'sha oy ulushi).
  for (const x of f.pending) {
    const k = steps.findIndex((s) => s.month === x.month);
    if (foldCarryChain(steps.slice(0, k)).carryOver + steps[k].contribution !== x.amount) { bad.pageDue++; break; }
  }
  // 6) kirish tartibi ahamiyatsiz.
  const shuffled = [...steps].sort(() => rnd() - 0.5);
  if (JSON.stringify(foldCarryChain(shuffled)) !== JSON.stringify(f)) bad.shuffle++;
  // 7) eski payrollDue (chiziqli carryOver) = yangi payrollOwedTotal.
  const base = emp({ salaryType: "foiz", percent: 50, collected: Math.floor(rnd() * 3000) * 1000, paidAvans: Math.floor(rnd() * 1000) * 1000 });
  const oldDue = payrollDue({ ...base, carryOver: sumC(steps) }, POCT);
  if (payrollOwedTotal({ ...base, carryOver: f.carryOver, carryPending: sumP(f), carryPendingMonths: f.pending }, POCT) !== oldDue) bad.owed++;
}
check("INVARIANT carry + pending = eski", bad.inv, 0);
check("pending > 0, nol-yopish emas", bad.positive, 0);
check("pending eskidan yangiga", bad.order, 0);
check("musbat carry faqat nol-yopishdan", bad.payable, 0);
check("pending = o'sha oy Qolgan", bad.pageDue, 0);
check("tartibga bog'liq emas", bad.shuffle, 0);
check("eski payrollDue = owedTotal", bad.owed, 0);

// ── N8: QADAM YIG'ISH — lib/salary.ts → carryFoldsByEmployee (04.10.2026) ──
// loadCarryOver faqat zanjirni quradi va shu funksiyani chaqiradi. Bu yerda
// sinalmasa, kimdir eski `if (v !== 0)` filtrini qaytarsa avgust ulushi yana
// oktabrda TO'LANADIGAN bo'lib ketardi, N1–N7 esa yashil qolardi.
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
// Xodim 5 — sentabrda ortiqcha olgan (qarzdorlik o'tadi, pending yo'q).
const e5Sep = emp({ id: 5, fixedSalary: 1000000, paidAvans: 1200000 });
const folds = carryFoldsByEmployee([
  // Zanjir orqaga qurilgani kabi — avval sentabr, keyin avgust.
  part("2026-09", PSEP, false, [e1Sep, e3Sep, e4Sep, e5Sep]),
  part("2026-08", PAUG, true, [e1Aug, e2Aug, e3Aug]),
]);
const f1 = folds.get(1);
check("(a) 0 ulushli oy QADAM: carryOver", f1?.carryOver, 0);
check("(a) 0 ulushli oy QADAM: pending", f1 ? pendStr(f1) : "yo'q", "2026-09:154000");
const f2 = folds.get(2);
check("(b) qatori yo'q oy o'tkaziladi", f2?.carryOver, 50000);
check("(b) …va pending yo'q", f2?.pending.length, 0);
check("(c) ikkalasi 0 → xaritada yo'q", folds.has(3), false);
check("(c) carryOver 0 + pending → bor", folds.has(1), true);
check("(d) sozlanmagan → yo'q", folds.has(4), false);
check("qarzdorlik o'tadi", folds.get(5)?.carryOver, -200000);
check("qarzdorlik: pending yo'q", folds.get(5)?.pending.length, 0);
check("bo'sh zanjir → bo'sh xarita", carryFoldsByEmployee([]).size, 0);
// N1 bilan bir xil natija — sof fold va yig'ish bir-biriga mos.
check("N1 bilan mos (fold)", pendStr(folds.get(1)), pendStr(foldCarryChain([step("2026-08", 154000, true), step("2026-09", 0)])));

// ── N9: O'TISH DAVRI QOROVULI — payrollPendingMaybePaid (04.10.2026) ──
// 02.10–deploy oralig'ida sentabr puli oktabr yozuvi bo'lib berilgan:
// oktabr payrollDue < 0, sentabr pending > 0, jami qarz 0. Interfeys
// "sentabr sahifasidan chiqariladi" demasligi kerak (ikkinchi to'lov).
console.log("\nN9) O'tgan oy puli shu oy yozuvi bo'lib berilganmi (payrollPendingMaybePaid)");
const pend = (amount, month = "2026-09") => ({ carryPending: amount, carryPendingMonths: amount > 0 ? [{ month, amount }] : [] });
// #14 ko'zgu misoli: oktabrda 180 000 «Oylik chiqarish», ishlagani 0.
const g14 = emp({ salaryType: "foiz", percent: 50, collected: 0, paidOylik: 180000, ...pend(180000) });
check("#14: oktabr payrollDue", payrollDue(g14, POCT), -180000);
check("#14: jami qarz 0", payrollOwedTotal(g14, POCT), 0);
check("#14: shubha = 180 000", payrollPendingMaybePaid(g14, POCT), 180000);
check("#14: oy bo'yicha", pendingMaybePaidByMonth(g14, POCT).map((x) => `${x.month}:${x.amount}`).join(","), "2026-09:180000");
// Oy boshida AVANS hisoblangandan oshgan — odatiy, o'tgan oy puli EMAS.
const adv = emp({ salaryType: "foiz", percent: 50, collected: 200000, paidAvans: 300000, ...pend(500000) });
check("avans oshgan: payrollDue < 0", payrollDue(adv, POCT), -200000);
check("avans oshgan: shubha yo'q", payrollPendingMaybePaid(adv, POCT), 0);
// Shu oy ortiqcha emas — pending bemalol o'z oyidan chiqariladi.
const ok1 = emp({ salaryType: "foiz", percent: 50, collected: 1000000, paidOylik: 180000, ...pend(180000) });
check("ortiqcha yo'q: shubha 0", payrollPendingMaybePaid(ok1, POCT), 0);
// Qisman: ortiqcha 100 000, pending 314 000 → faqat 100 000 shubhali.
const part1 = emp({ salaryType: "foiz", percent: 50, collected: 160000, paidOylik: 180000, ...pend(314000) });
check("qisman: shubha = ortiqcha", payrollPendingMaybePaid(part1, POCT), 100000);
// Pending yo'q — ortiqcha bo'lsa ham shubha yo'q (oddiy qarzdorlik).
check("pending yo'q: 0", payrollPendingMaybePaid(emp({ paidOylik: 500000 }), POCT), 0);
check("sozlanmagan: 0", payrollPendingMaybePaid(emp({ configured: false, paidOylik: 500000, ...pend(500000) }), POCT), 0);
// O'rtadagi oyda ortiqcha to'lov qarzdorlik bo'lib o'tgan (carryOver < 0).
const mid = emp({ salaryType: "foiz", percent: 50, collected: 0, carryOver: -180000, ...pend(180000) });
check("o'tgan qarzdorlik: shubha", payrollPendingMaybePaid(mid, POCT), 180000);
// Ikki pending oy — shubha ENG YANGISIDAN bo'linadi.
const twoMonths = emp({ salaryType: "foiz", percent: 50, collected: 0, paidOylik: 250000,
  carryPending: 400000, carryPendingMonths: [{ month: "2026-08", amount: 100000 }, { month: "2026-09", amount: 300000 }] });
check("ikki oy: shubha", payrollPendingMaybePaid(twoMonths, POCT), 250000);
check("ikki oy: eng yangisidan", pendingMaybePaidByMonth(twoMonths, POCT).map((x) => `${x.month}:${x.amount}`).join(","), "2026-09:250000");
const twoMonths2 = { ...twoMonths, paidOylik: 350000 };
check("ikki oy: oshsa eskisiga", pendingMaybePaidByMonth(twoMonths2, POCT).map((x) => `${x.month}:${x.amount}`).join(","), "2026-08:50000,2026-09:300000");
// Qorovul faqat ko'rsatadi — chegara/chiqarish o'zgarmaydi.
check("#14: chiqariladigan baribir 0", payrollPayout(g14, POCT), 0);

console.log(`\n${fail === 0 ? "NATIJA: ✅ hamma tekshiruv o'tdi" : `NATIJA: ❌ ${fail} ta xato`}`);
process.exit(fail === 0 ? 0 : 1);
