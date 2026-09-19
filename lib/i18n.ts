import en from "@/messages/en.json";
import uzCyrl from "@/messages/uz-cyrl.json";
import { toCyrillic } from "@/lib/translit";

// INTERFEYS TILI — uch til (18.09.2026 qarori):
//
//   uz       — lotin o'zbek: MANBA. Koddagi har bir matn shu tilda yoziladi
//              va `t("Saqlash")` da KALIT sifatida ishlatiladi (gettext
//              uslubi — kalit o'ylab topilmaydi, o'rash kifoya).
//   uz-cyrl  — kiril o'zbek: lug'at EMAS, lotin matn lib/translit.ts bilan
//              o'giriladi; messages/uz-cyrl.json faqat qo'lda tuzatilgan
//              istisnolar uchun (bo'sh bo'lsa ham bo'ladi).
//   en       — ingliz: messages/en.json ("Saqlash": "Save"). Tarjima yo'q
//              kalit o'zbekcha chiqadi — sayt hech qachon "yarim" bo'lmaydi.
//
// `ru` 18.09.2026 da OLIB TASHLANDI (foydalanuvchi qarori) — eski
// localStorage qiymati "uz" ga tushiriladi (components/shared/Language.tsx).
//
// Til QURILMAGA bog'langan (localStorage + cookie), hisobga emas. Server
// birinchi chizishda cookie'dan o'qiydi (app/layout.tsx) — EN foydalanuvchi
// sahifani yangilaganda bir lahza o'zbekcha ko'rmaydi.
//
// FOYDALANUVCHI MA'LUMOTI O'GIRILMAYDI: `translate()` avval andozani
// tarjima/translit qiladi, `{param}` qiymatlarini KEYIN qo'yadi — ism,
// kurs nomi, izoh qanday saqlangan bo'lsa shunday ko'rinadi.
//
// Sana tanlagichlar (DatePicker, DateRangePicker, MonthPicker,
// MonthYearPicker) oy va hafta kunlari nomlarini quyidagi jadvallardan
// oladi: ilgari ular inglizcha qattiq yozilgan edi.

export type Lang = "uz" | "uz-cyrl" | "en";

export const LANGS: Lang[] = ["uz", "uz-cyrl", "en"];

export const DEFAULT_LANG: Lang = "uz";

/** Noma'lum/eski qiymatni ("ru", bo'sh) manba tiliga tushiradi. */
export function normalizeLang(v: unknown): Lang {
  return v === "en" || v === "uz-cyrl" ? v : DEFAULT_LANG;
}

/** `<html lang>` uchun BCP-47 tegi. */
export function htmlLang(lang: Lang): string {
  return lang === "uz-cyrl" ? "uz-Cyrl" : lang;
}

/** To'liq oy nomlari (0 = Yanvar). */
export const MONTHS: Record<Lang, string[]> = {
  // Imlo referensdagidek ("Sentyabr"/"Oktyabr") — Tug'ilgan kunlar sahifasining
  // yillik ko'rinishidan olingan.
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"],
  "uz-cyrl": ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** Qisqa oy nomlari — MonthPicker/MonthYearPicker katakchalari uchun. */
export const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  "uz-cyrl": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/**
 * Hafta kunlari — YAKSHANBADAN boshlanadi (0 = Yakshanba), chunki taqvim
 * katakchalari `Date.getDay()` bilan tekislanadi.
 */
export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"],
  "uz-cyrl": ["Як", "Ду", "Се", "Чо", "Пай", "Жу", "Ша"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
};

// To'liq hafta kunlari — DUSHANBADAN boshlanadi (referensdagi Tug'ilgan
// kunlar kalendari shu tartibda). `WEEKDAYS_SHORT` esa yakshanbadan
// boshlanadi va sana tanlagichlarda ishlatiladi — ikkalasini aralashtirmang.
export const WEEKDAYS_FULL: Record<Lang, string[]> = {
  uz: ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"],
  "uz-cyrl": ["Душанба", "Сешанба", "Чоршанба", "Пайшанба", "Жума", "Шанба", "Якшанба"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};

/** `toLocaleString` va shunga o'xshash joylar uchun BCP-47 kodi. */
export const LOCALE: Record<Lang, string> = {
  uz: "uz-UZ",
  "uz-cyrl": "uz-Cyrl-UZ",
  en: "en-US",
};

// ── Tarjima ─────────────────────────────────────────────────────────

export type TParams = Record<string, string | number>;

const EN: Record<string, string> = en;
const CYRL: Record<string, string> = uzCyrl;

/**
 * ICU'ning kichik qismi: `{n, plural, one {# student} other {# students}}`.
 *
 * O'zbekchada ko'plik shakli yo'q ("5 ta o'quvchi"), inglizchada bor —
 * shu bois lug'atdagi INGLIZCHA qiymat ko'plikni o'zi hal qiladi, koddagi
 * o'zbekcha kalit esa oddiy `{n} ta o'quvchi` bo'lib qolaveradi.
 * `zero`, `one`, `other` shoxlari; `#` — sonning o'zi.
 */
function applyPlural(text: string, params: TParams): string {
  return text.replace(/\{(\w+),\s*plural,\s*((?:\s*\w+\s*\{[^{}]*\})+)\s*\}/g, (_, name: string, branches: string) => {
    const value = Number(params[name]);
    const forms: Record<string, string> = {};
    for (const m of branches.matchAll(/(\w+)\s*\{([^{}]*)\}/g)) forms[m[1]] = m[2];
    const pick = value === 0 && forms.zero !== undefined ? forms.zero
      : value === 1 && forms.one !== undefined ? forms.one
      : (forms.other ?? forms.one ?? "");
    return pick.replace(/#/g, String(params[name] ?? ""));
  });
}

function interpolate(text: string, params?: TParams): string {
  if (!params) return text;
  const withPlural = text.includes("plural") ? applyPlural(text, params) : text;
  return withPlural.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/**
 * Matnni tanlangan tilga o'giradi.
 *
 * `key` — o'zbekcha (lotin) manba matn. Tartib: lug'at (en / uz-cyrl
 * istisno) → kiril uchun translit → `{param}` qo'yish. Param qiymatlari
 * o'girilMAYDI (foydalanuvchi ma'lumoti).
 *
 * DARVOZA: kirilga faqat LUG'ATDA BOR kalit (messages/en.json — barcha
 * interfeys matnlarining ro'yxati) o'giriladi. `t(x.label)` ga ba'zan
 * bazadan kelgan matn ham tushadi (guruh nomi, kurs nomi) — u lug'atda
 * yo'q, demak o'z holicha qoladi. Aks holda "Alisher" → "Алишер" bo'lardi
 * (foydalanuvchi qarori: ma'lumot o'girilmasin). Yangi matn qo'shganda
 * `node scripts/i18n-scan.mjs --todo` uni lug'atga so'raydi.
 */
export function translate(lang: Lang, key: string, params?: TParams): string {
  if (lang === "uz" || !key) return interpolate(key, params);
  if (!(key in EN)) {
    // Lug'atda yo'q — balki bu RENDER BO'LGAN dinamik xabar (backend
    // `Mablag' yetarli emas — 5 000 so'm tasdiq kutmoqda` deb yuborgan,
    // kalit esa `… — {held} so'm …`). Andozaga teskari moslab ko'riladi.
    const matched = matchRendered(key);
    if (matched) {
      // Ushlangan bo'laklar ham o'giriladi — ular ichma-ich render bo'lgan
      // andoza bo'lishi mumkin ("Muddat: … — 2 kun kechikdi"). Foydalanuvchi
      // ma'lumoti lug'atda yo'q, demak o'z holicha qoladi (darvoza).
      const inner: TParams = {};
      for (const [name, value] of Object.entries(matched.params)) inner[name] = translate(lang, String(value));
      return translate(lang, matched.key, { ...inner, ...params });
    }
    return interpolate(key, params);
  }
  const text = lang === "en" ? EN[key] : (CYRL[key] ?? toCyrillic(key));
  return interpolate(text, params);
}

// ── Render bo'lgan xabarni andozaga qaytarish ──────────────────────
//
// BACKEND XABARLARI (app/api, lib) mijozga o'zbekcha TAYYOR matn holida
// keladi: statiklari lug'atdagi kalit bilan bir xil, andozalilari esa
// `${x}` bilan render bo'lgan. Serverga til o'rgatmasdan (cookie o'qish,
// har route'ni o'zgartirish) ularni o'girish uchun: lug'atdagi `{param}`li
// kalitlardan regex yasaladi (`{held}` → `(.+?)`), kelgan matn shu
// naqshlarga solishtiriladi, mos kelsa kalit + ushlangan param'lar bilan
// odatdagidek tarjima qilinadi. Kalit ro'yxati scripts/i18n-scan.mjs
// ning SERVER manbasidan keladi — andoza o'zgarsa skan yangi kalit so'raydi.
//
// Narx: lug'atda yo'q har bir NOYOB satr uchun bir marta ~300 regex
// (natija keshlanadi). Foydalanuvchi ma'lumoti (ism, guruh nomi) ham
// shu yo'ldan o'tadi — mos kelmaydi va o'z holicha qoladi.
/**
 * Kodda `t(...)` chaqiruvi ko'rinishida UCHRAMAYDIGAN, faqat render bo'lgan matnni
 * teskari moslash orqali ishlatiladigan andozalar — pul formatlovchilar
 * ("82 000 so'm" → `{n} so'm`). scripts/i18n-scan.mjs shu ro'yxatni ham
 * o'qiydi, aks holda ular "ishlatilmaydigan kalit" deb chiqardi.
 */
export const RENDERED_KEYS = [
  "{n} so'm",
  // lib/notifications.ts — relativeUz / overdueUz va topshiriq meta'si.
  "Hozirgina", "Kecha", "{n} daqiqa oldin", "{n} soat oldin",
  "{n} daqiqa kechikdi", "{n} soat kechikdi", "{n} kun kechikdi",
  "Muddat: {stamp} — {overdue}",
];

type Pattern = { key: string; names: string[]; re: RegExp };
let patterns: Pattern[] | null = null;
const renderedCache = new Map<string, { key: string; params: TParams } | null>();
const RENDERED_CACHE_LIMIT = 3000;

function buildPatterns(): Pattern[] {
  const out: Pattern[] = [];
  for (const key of Object.keys(EN)) {
    // Param'dan tashqari harf bo'lmasa (`{d}.{m}.{y}`) — o'giradigan narsa yo'q.
    if (!key.includes("{") || !/[A-Za-zЀ-ӿ]/.test(key.replace(/\{\w+\}/g, ""))) continue;
    const names: string[] = [];
    const source = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m) { names.push(m[1]); return "([\\s\\S]+?)"; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    if (!names.length) continue;
    out.push({ key, names, re: new RegExp(`^${source}$`) });
  }
  // Uzunroq (aniqroq) andoza birinchi sinaladi.
  out.sort((a, b) => b.key.length - a.key.length);
  return out;
}

function matchRendered(text: string): { key: string; params: TParams } | null {
  if (text.length > 600 || !/[A-Za-zЀ-ӿ]/.test(text)) return null;
  const hit = renderedCache.get(text);
  if (hit !== undefined) return hit;
  patterns ??= buildPatterns();
  let found: { key: string; params: TParams } | null = null;
  for (const p of patterns) {
    const m = p.re.exec(text);
    if (!m) continue;
    const params: TParams = {};
    p.names.forEach((n, i) => { params[n] = m[i + 1]; });
    found = { key: p.key, params };
    break;
  }
  if (renderedCache.size >= RENDERED_CACHE_LIMIT) renderedCache.clear();
  renderedCache.set(text, found);
  return found;
}

/** Lug'atda inglizcha tarjimasi bormi — skriptlar va tekshiruvlar uchun. */
export function hasEnglish(key: string): boolean {
  return key in EN;
}
