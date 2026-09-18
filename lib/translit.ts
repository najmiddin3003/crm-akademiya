// O'ZBEK LOTIN → KIRIL transliteratsiyasi — interfeys matnlari uchun.
//
// NEGA KERAK: sayt uch tilda (lotin o'zbek, kiril o'zbek, ingliz —
// 18.09.2026 qarori, lib/i18n.ts). Kiril uchun ALOHIDA lug'at
// yuritilmaydi: matn manbasi lotin o'zbekcha, kiril esa shu funksiya
// bilan o'girilgan holda beriladi. Ya'ni kiril birinchi kundan butun
// saytda ishlaydi, lug'atda faqat qoida buzilgan so'zlar (istisnolar)
// va xohlasa qo'lda yozilgan variantlar turadi (messages/uz-cyrl.json).
//
// FAQAT INTERFEYS MATNI o'giriladi. Foydalanuvchi kiritgan ma'lumot
// (ism, kurs nomi, izoh) o'girilmaydi — foydalanuvchi qarori: qidiruv va
// hisobotlar bazadagi yozuv bilan bir xil bo'lib qolsin. `translate()`
// shu bois avval andozani o'giradi, keyin `{param}` larni qo'yadi.
//
// QOIDALAR (rasmiy 1995/2021 lotin alifbosi → kiril):
//   sh→ш  ch→ч  o'→ў  g'→ғ  yo→ё  yu→ю  ya→я  ye→е   ng→нг (ikki harf)
//   so'z boshida yoki unlidan keyin  e→э, qolgan joyda e→е
//   tutuq belgisi (ma'lumot) → ъ         ts → тс (ц faqat istisnolarda)
//   h→ҳ  x→х  q→қ  j→ж  y→й  va boshqa harflar birma-bir.
// Apostrofning hamma ko'rinishi (' ʻ ʼ ‘ ’ `) bir xil o'qiladi.
// Bosh harf saqlanadi: "Sh"→"Ш", "SHANBA"→"ШАНБА", "O'zbek"→"Ўзбек".

const APOS = "'ʻʼ‘’`´";
const VOWELS = "aeiouAEIOU";

/** Ikki harfli birikmalar — bittalik harflardan OLDIN tekshiriladi. */
const DIGRAPHS: Record<string, string> = {
  sh: "ш",
  ch: "ч",
  yo: "ё",
  yu: "ю",
  ya: "я",
  ye: "е",
};

const SINGLE: Record<string, string> = {
  a: "а", b: "б", d: "д", e: "е", f: "ф", g: "г", h: "ҳ", i: "и", j: "ж", k: "к",
  l: "л", m: "м", n: "н", o: "о", p: "п", q: "қ", r: "р", s: "с", t: "т", u: "у",
  v: "в", x: "х", y: "й", z: "з",
  // Lotin o'zbek alifbosida yo'q, lekin xorijiy so'zlarda uchraydi.
  c: "с", w: "в",
};

/**
 * Qoida bilan noto'g'ri chiqadigan so'zlar — butun so'z, kichik harfda.
 * Oylar kiril o'zbekchada yumshoq belgi bilan yoziladi (сентябрь),
 * qoida esa "сентябр" berardi. "ц" li o'zlashmalar ham shu yerda.
 */
const EXCEPTIONS: Record<string, string> = {
  yanvar: "январь",
  fevral: "февраль",
  aprel: "апрель",
  iyun: "июнь",
  iyul: "июль",
  sentabr: "сентябрь",
  sentyabr: "сентябрь",
  oktabr: "октябрь",
  oktyabr: "октябрь",
  noyabr: "ноябрь",
  dekabr: "декабрь",
  litsey: "лицей",
  tsex: "цех",
  sirk: "цирк",
  konsert: "концерт",
  protsent: "процент",
  protsess: "процесс",
  poezd: "поезд",
  // Lotinda "e" bilan boshlanib kirilda "е" bo'ladigan o'zlashmalar.
  ekspert: "эксперт",
};

/**
 * O'GIRILMAYDIGAN so'zlar — brend va texnik qisqartmalar. Ustiga qoida:
 * unlisiz so'z (Ctrl, PDF, QR, SMS) lotincha qoladi — ular o'zbek so'zi
 * emas va kirilda ham shunday yoziladi.
 */
const KEEP = new Set([
  "excel", "word", "google", "sheets", "telegram", "click", "payme", "uzum", "cloudinary", "eskiz",
  "id", "url", "api", "crm", "kpi", "ok", "pdf", "csv", "sms", "qr", "utm", "ip", "vps", "html",
]);

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

/** Manba bo'lagining registrini natijaga ko'chiradi ("Sh"→"Ш", "SH"→"Ш", "sh"→"ш"). */
function withCase(source: string, target: string): string {
  if (!target) return target;
  const first = source[0];
  if (!isUpper(first)) return target;
  // Ikki harfli manbaning ikkalasi ham katta — natija to'liq katta.
  const allUpper = source.length > 1 && [...source].every((c) => !/[a-z]/.test(c));
  if (allUpper) return target.toUpperCase();
  return target[0].toUpperCase() + target.slice(1);
}

function isLetter(ch: string): boolean {
  return /[A-Za-zЀ-ӿ]/.test(ch);
}

/** Bitta so'zni (harflar va apostroflar) o'giradi. */
function transliterateWord(word: string): string {
  const lower = word.toLowerCase();
  if (KEEP.has(lower) || !/[aeiou]/.test(lower)) return word;
  const exception = EXCEPTIONS[lower.replace(new RegExp(`[${APOS}]`, "g"), "'")];
  if (exception) return withCase(word, exception);

  let out = "";
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    const next = word[i + 1] ?? "";
    const lowCh = ch.toLowerCase();
    const lowNext = next.toLowerCase();

    // o' → ў, g' → ғ (apostrofning istalgan ko'rinishi bilan).
    if ((lowCh === "o" || lowCh === "g") && next && APOS.includes(next)) {
      out += withCase(ch, lowCh === "o" ? "ў" : "ғ");
      i += 2;
      continue;
    }
    // Ikki harfli birikmalar. "yo'q" da "yo" birikma EMAS — "y" + "o'":
    // ikkinchi harfdan keyin apostrof kelsa u o'/g' ga tegishli.
    const pair = lowCh + lowNext;
    const afterNext = word[i + 2];
    const nextIsOG = (lowNext === "o" || lowNext === "g") && afterNext !== undefined && APOS.includes(afterNext);
    if (next && DIGRAPHS[pair] && !nextIsOG) {
      out += withCase(ch + next, DIGRAPHS[pair]);
      i += 2;
      continue;
    }
    // Tutuq belgisi (ma'lumot → маълумот).
    if (APOS.includes(ch)) {
      out += "ъ";
      i += 1;
      continue;
    }
    // "e": so'z boshida yoki unlidan keyin — э.
    if (lowCh === "e") {
      const prev = i > 0 ? word[i - 1] : "";
      const atStart = i === 0 || !isLetter(prev);
      out += withCase(ch, atStart || (prev && VOWELS.includes(prev)) ? "э" : "е");
      i += 1;
      continue;
    }
    const single = SINGLE[lowCh];
    out += single ? withCase(ch, single) : ch;
    i += 1;
  }
  return out;
}

const cache = new Map<string, string>();
const CACHE_LIMIT = 5000;

/**
 * Matnni kirilga o'giradi. Harf bo'lmagan belgilar (raqam, tinish, emoji,
 * `{param}` andozalari) o'z holicha qoladi. Natija keshlanadi — bitta
 * satr har renderda qayta o'girilmasin.
 */
export function toCyrillic(text: string): string {
  if (!text) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;

  // So'z = lotin harflar va ular ORASIDAGI apostroflar. `{...}` andoza
  // ichidagi nom (param kaliti) o'girilmaydi — u kod uchun.
  const result = text.replace(/\{[^}]*\}|[A-Za-z]+(?:['ʻʼ‘’`´][A-Za-z]+)*['ʻʼ‘’`´]?/g, (m) => {
    if (m.startsWith("{")) return m;
    return transliterateWord(m);
  });

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(text, result);
  return result;
}
