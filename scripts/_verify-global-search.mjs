// GLOBAL QIDIRUV yordamchilari sinovi (02.11.2026): lib/globalSearch.ts — Ctrl K oynasi
// (components/v2/shell/CommandPaletteV2.tsx) va GET /api/search/global bitta qoidada.
//
// Bazaga ham, tarmoqqa ham CHIQMAYDI: faqat toza funksiyalar. Mongo naqshlari (`looseRegexSource`)
// shu yerda JS RegExp bilan sinaladi — ishlatilgan sintaksis ([…]? sinflar, (?:^|…) guruhi)
// PCRE va JS da bir xil ma'noda.
//
//   node --experimental-transform-types --no-warnings scripts/_verify-global-search.mjs
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_URL = pathToFileURL(ROOT).href + "/";

// ── "@/..." va nisbiy yo'llarni .ts fayllarga bog'lash (scripts/_verify-outbound-guard.mjs dagidek) ──
const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];
function withExt(url) {
  const p = fileURLToPath(url);
  if (existsSync(p) && statSync(p).isFile()) return url;
  for (const ext of EXTS) if (existsSync(p + ext)) return url + ext;
  return url;
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    let url = null;
    if (specifier.startsWith("@/")) url = withExt(new URL(specifier.slice(2), ROOT_URL).href);
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      url = withExt(new URL(specifier, context.parentURL).href);
    }
    if (url === null) return nextResolve(specifier, context);
    return nextResolve(url, context);
  },
});

const gs = await import("@/lib/globalSearch");

let pass = 0;
let fail = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(title, got, want) {
  if (same(got, want)) {
    pass += 1;
    console.log(`✓ ${title}`);
  } else {
    fail += 1;
    console.log(`✗ ${title}\n    kutilgan: ${JSON.stringify(want)}\n    chiqdi:   ${JSON.stringify(got)}`);
  }
}
const re = (src) => new RegExp(src, "i");

// ── Matnni bir xil ko'rinishga keltirish ──
check("normalize: apostroflar, katta harf, bo'shliqlar", gs.normalizeSearch("  Gʻulomov   O’G‘ILOY "), "gulomov ogiloy");
check("kirill → lotin (o'zbek harflari bilan)", gs.normalizeSearch(gs.cyrToLat("Мадина Раҳимова Ўғилой Қодирова")), "madina rahimova ogiloy qodirova");
check("klaviatura tartibi: «ьфвштф» → «madina»", gs.layoutToLat("ьфвштф"), "madina");
check("klaviatura tartibi: «щэпэшд» → «o'g'il»", gs.layoutToLat("щэпэшд"), "o'g'il");
check("lotin so'rov — bitta ko'rinish", gs.queryVariants("Madina"), ["madina"]);
check("kirill so'rov — asl + translit + klaviatura", gs.queryVariants("Мадина"), ["мадина", "madina", "vflbyf"]);
check("rus tartibida yozilgan lotin ism topiladi", gs.queryVariants("ьфвштф").includes("madina"), true);
check("rus «х» — ham «x», ham «h» («Хасанов»)", ["xasanov", "hasanov"].map((v) => gs.queryVariants("Хасанов").includes(v)), [true, true]);

// ── Chek raqami va so'rov rejasi ──
check("chek: «4512»", gs.receiptNumberOf("4512"), 4512);
check("chek: «#4512»", gs.receiptNumberOf("#4512"), 4512);
check("chek: «№ 4512»", gs.receiptNumberOf("№ 4512"), 4512);
check("chek: «chek 4512»", gs.receiptNumberOf("chek 4512"), 4512);
check("chek: «чек №4512»", gs.receiptNumberOf("чек №4512"), 4512);
check("chek emas: «ali»", gs.receiptNumberOf("ali"), null);
check("chek emas: «0»", gs.receiptNumberOf("0"), null);

{
  const p = gs.planQuery("ali valiyev");
  check("reja: ism — so'zlar, raqam emas", [p.digitsOnly, p.variantTerms, p.phonePattern, p.idNumber, p.receipt], [false, [["ali", "valiyev"]], null, null, null]);
}
{
  const p = gs.planQuery("+998 94 155 88 55");
  check("reja: to'liq telefon — 998 tashlanadi, ID emas", [p.digitsOnly, p.phonePattern, p.idNumber, p.variantTerms], [true, "9[^0-9]*4[^0-9]*1[^0-9]*5[^0-9]*5[^0-9]*8[^0-9]*8[^0-9]*5[^0-9]*5", null, []]);
  check("reja: telefon naqshi bazadagi ko'rinishga mos («94 155 88 55»)", re(p.phonePattern).test("94 155 88 55"), true);
}
{
  const p = gs.planQuery("16751");
  check("reja: raqam — ID va chek", [p.digitsOnly, p.idNumber, p.receipt], [true, 16751, 16751]);
}
check("reja: 80 belgidan uzun so'rov kesiladi", gs.planQuery("a".repeat(200)).raw.length, 80);

// ── Mongo naqshi (apostrofga chidamli, so'z boshi) ──
{
  const any = re(gs.looseRegexSource("gulomov"));
  check("naqsh: «G'ulomov», «Gʻulomov», «G’ulomov», «Gulomov» — hammasi", ["G'ulomov", "Gʻulomov", "G’ulomov", "Gulomov"].map((s) => any.test(s)), [true, true, true, true]);
  check("naqsh: «Gulyamov» — mos emas", any.test("Gulyamov"), false);
  const word = re(gs.looseRegexSource("ali", true));
  check("so'z boshidan: «Ali», «Valiyev Ali», «Abdu-ali» — ha; «Valijon» — yo'q", ["Ali", "Valiyev Ali", "Abdu-ali", "Valijon"].map((s) => word.test(s)), [true, true, true, false]);
  check("naqsh: maxsus belgilar qochiriladi", gs.looseRegexSource("a.b"), "a[ʻʼ’‘`´'ʹ′]?\\.[ʻʼ’‘`´'ʹ′]?b");
  check("so'rovdagi apostrof ham hisobga olinmaydi («o'g'iloy»)", re(gs.looseRegexSource("o'g'iloy")).test("Ogʻiloy"), true);
}

// ── Tartiblash ──
check("ball: aynan — 100", gs.matchScore("Madina", "madina"), 100);
check("ball: boshidan — 80", gs.matchScore("Madina Rahimova", "madi"), 80);
check("ball: so'z boshidan — 60", gs.matchScore("Oylik chiqarish", "chiqar"), 60);
check("ball: teskari tartibdagi ism — 60", gs.matchScore("Madina Rahimova", "rahimova madina"), 60);
check("ball: ichida — 40", gs.matchScore("Kassa", "ass"), 40);
check("ball: mos emas — 0", gs.matchScore("Kassa", "xyz"), 0);
check("ball: apostrofsiz yozilgan sahifa nomi", gs.matchScore("O'quvchilar ro'yxati", "oquvchi"), 80);
check("ball: kirillda yozilgan so'rov", gs.matchScore("Madina", "мадина"), 100);
check("ball: rus tartibida yozilgan so'rov", gs.matchScore("Madina Rahimova", "ьфвштф"), 80);
{
  const r = gs.rankTop(["c", "a", "b", "a2", "x", "y"], (s) => (s.startsWith("a") ? 2 : s === "b" ? 1 : 0), 3);
  check("rankTop: ball bo'yicha, teng ballda — asl tartib, kesish va «yana bor»", [r.items, r.more], [["a", "a2", "b"], true]);
  check("rankTop: kam bo'lsa «yana bor» yo'q", gs.rankTop([1, 2], (n) => n).more, false);
}

// ── Bo'yash ──
check("bo'yash: apostrofli ism — «G'ul»", gs.highlightRanges("G'ulomov Ali", "gul"), [[0, 4]]);
check("bo'yash: familiya", gs.highlightRanges("Madina Rahimova", "rahim"), [[7, 12]]);
check("bo'yash: ikki so'z", gs.highlightRanges("Madina Rahimova", "madina rahimova"), [[0, 6], [7, 15]]);
check("bo'yash: telefon ajratkichlardan qat'i nazar", gs.highlightRanges("93 448 21 07", "9344821"), [[0, 9]]);
check("bo'yash: rus tartibida yozilgan so'rov", gs.highlightRanges("Madina", "ьфвштф"), [[0, 6]]);
check("bo'yash: kirill so'rov — lotin ism", gs.highlightRanges("Madina Rahimova", "Рахимова"), [[7, 15]]);
check("bo'yash: 1 harf — faqat so'z boshidan", gs.highlightRanges("Madina Rahimova", "madina r"), [[0, 6], [7, 8]]);
check("bo'yash: mos emas — bo'sh", gs.highlightRanges("Kassa", "xyz"), []);
check("bo'yash: boshida bo'shliqli matn", gs.highlightRanges(" Madina", "madina"), [[1, 7]]);
check(
  "bo'laklash",
  gs.splitByRanges("Madina Rahimova", [[0, 3], [7, 9]]),
  [
    { text: "Mad", hit: true },
    { text: "ina ", hit: false },
    { text: "Ra", hit: true },
    { text: "himova", hit: false },
  ],
);

// ── Kichik formatlar ──
check("summa: 350 000", gs.groupDigits(350000), "350 000");
check("summa: yaxlitlanadi, ishorasiz", gs.groupDigits(-1234567.6), "1 234 568");
check("summa: noto'g'ri qiymat — 0", gs.groupDigits(Number.NaN), "0");
check("uzStamp: Toshkent vaqti (UTC+5)", gs.parseUzStamp("29.08.2026 | 11:42"), Date.UTC(2026, 7, 29, 6, 42));
check("uzStamp: yarim tunda — oldingi kun UTC da", gs.parseUzStamp("01.09.2026 | 02:00"), Date.UTC(2026, 7, 31, 21, 0));
check("uzStamp: noto'g'ri — null", [gs.parseUzStamp("2026-08-29"), gs.parseUzStamp("31.13.2026 | 10:00"), gs.parseUzStamp("")], [null, null, null]);
check("kutish: 30 daqiqa", gs.waitingParts(30), { n: 30, unit: "min" });
check("kutish: 33 soat", gs.waitingParts(33 * 60 + 5), { n: 33, unit: "hour" });
check("kutish: 47 soat 59 daqiqa — hali soat", gs.waitingParts(47 * 60 + 59), { n: 47, unit: "hour" });
check("kutish: 48 soat — 2 kun", gs.waitingParts(48 * 60), { n: 2, unit: "day" });
check("sana: 2026-10-31 → 31.10.2026", gs.dmy("2026-10-31"), "31.10.2026");
check("bosh harflar", [gs.initialsOf("Asadbek Karimov"), gs.initialsOf("  madina "), gs.initialsOf("")], ["AK", "M", "?"]);
check("ro'yxat: «Lid, to'lov va sahifa»", gs.joinList(["Lid", "to'lov", "sahifa"], "va"), "Lid, to'lov va sahifa");
check("ro'yxat: bitta va bo'sh", [gs.joinList(["Lid"], "va"), gs.joinList([], "va")], ["Lid", ""]);
check("qochirish", gs.escapeRe("a.b(c)[d]"), "a\\.b\\(c\\)\\[d\\]");

console.log(fail === 0 ? `\nHammasi to'g'ri: ${pass} ta holat` : `\nXATO: ${fail} ta (to'g'ri: ${pass})`);
process.exit(fail === 0 ? 0 : 1);
