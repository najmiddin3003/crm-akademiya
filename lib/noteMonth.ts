// IZOHDAGI OY SO'ZLARI — kassir to'lov qaysi oy uchun ekanini ko'pincha
// IZOHGA yozadi ("Muhammadjon avgust"), «Qaysi oy uchun» maydoniga esa
// tegmaydi. Ustozning foizli oyligi esa aynan o'sha maydon (`periodMonth`)
// bo'yicha hisoblanadi (lib/payrollSources.ts → monthMatch).
//
// O'lchandi (prod, 02.10.2026): bitta kassada «avgust» izohli 41 ta kirimdan
// 40 tasi sentabrga, «sentabr» izohli 31 tasi oktabrga yozilgan — ya'ni
// ustoz ulushi izohda aytilgan oyga emas, boshqa oyga tushgan. Kirim oynasi
// (components/finance/CashboxKirimDrawer.tsx) shu funksiya bilan izoh va
// tanlangan oy farq qilganda ogohlantiradi.
//
// Sof funksiya — brauzerda ham, Node'da ham (sinov) ishlaydi.

/** Oy raqami (1–12) → izohda uchraydigan o'zaklar: o'zbek lotin, o'zbek kiril, rus. */
const STEMS: [number, string][] = [
  [1, "yanvar|январ"],
  [2, "fevral|феврал"],
  [3, "mart|март"],
  [4, "aprel|апрел"],
  [5, "may|ма[йя]"],
  [6, "iyun|июн"],
  [7, "iyul|июл"],
  [8, "avgust|avgus|август"],
  [9, "s[ei]nt(?:a|ya|ia|iya)br|сентябр"],
  [10, "okt(?:a|ya)br|октябр"],
  [11, "noyab(?:i)?r|ноябр"],
  [12, "dekab(?:i)?r|декабр"],
];

// O'zakdan keyin: hech narsa yoki qo'shimcha (avgustGA, sentabrDAN,
// сентябрЬ, августА), undan keyin harf emas. Lotin "a" qo'shimcha EMAS —
// aks holda "2 marta" mart oyi deb olinardi.
const SUFFIX = "(?:ga|da|dan|ni|ning|niki|gacha|ь|я|а|га|да|дан|ни|нинг|гача)?";

const PATTERNS = STEMS.map(([m, stem]) => [m, new RegExp(`(?<!\\p{L})(?:${stem})${SUFFIX}(?!\\p{L})`, "iu")] as const);

/** Izohda tilga olingan oylar (1–12), o'sish tartibida. Bo'lmasa — bo'sh. */
export function monthsInNote(note: unknown): number[] {
  const s = String(note ?? "");
  if (!s.trim()) return [];
  return PATTERNS.filter(([, re]) => re.test(s)).map(([m]) => m);
}

/**
 * Izohdagi oy (1–12) uchun `around` ("YYYY-MM") ga ENG YAQIN "YYYY-MM".
 * Yil chegarasi uchun: 2027-01 da «dekabr» → 2026-12, 2026-10 da «avgust» → 2026-08.
 */
export function nearestMonthKey(month: number, around: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(String(around ?? ""));
  if (!m || month < 1 || month > 12) return around;
  const y = Number(m[1]);
  const base = y * 12 + (Number(m[2]) - 1);
  let best = y;
  for (const cand of [y - 1, y, y + 1]) {
    if (Math.abs(cand * 12 + (month - 1) - base) < Math.abs(best * 12 + (month - 1) - base)) best = cand;
  }
  return `${best}-${String(month).padStart(2, "0")}`;
}
