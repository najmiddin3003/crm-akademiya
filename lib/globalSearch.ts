// GLOBAL QIDIRUV (Ctrl K oynasi, 21-qism · Yuqori panel, 02.11.2026) — TOZA yordamchilar.
//
// Bitta qoida ikki joyda ishlaydi: serverda (app/api/search/global — Mongo naqshi va
// tartiblash) va klientda (components/v2/shell/CommandPaletteV2.tsx — sahifalarni
// qidirish va topilgan qismni bo'yash). Ular ayri yozilsa, server topgan natijani klient
// «mos emas» deb bo'yamay qo'yardi (lib/phoneSearch.ts boshidagi hikoya bilan bir xil).
//
// Bu fayl brauzerga ham tushadi: faqat toza funksiyalar va turlar, server modullari yo'q.
// Sinov: node --experimental-transform-types --no-warnings scripts/_verify-global-search.mjs

import { searchPhoneDigits, phoneSearchPattern } from "@/lib/phoneSearch";

/** Shundan qisqa so'rov qidirilmaydi (lib/pupilSearch.ts → MIN_QUERY bilan bir xil). */
export const SEARCH_MIN = 2;
/** Har bir bo'limda ko'pi bilan shuncha natija. */
export const SEARCH_CAP = 5;

// ── Javob shakli (GET /api/search/global) ────────────────────────────────────

export type SearchKind = "students" | "leads" | "groups" | "staff" | "payments";
export const SEARCH_KINDS: readonly SearchKind[] = ["students", "leads", "groups", "staff", "payments"];

/**
 * Manba holati: `off` — xodimda o'sha bo'lim ruxsati yo'q (manba umuman so'ralmaydi);
 * `no-cashbox` — to'lovlar faqat o'z kassasida, lekin kassa biriktirilmagan;
 * `error` — shu manba so'rovida xato (qolganlari baribir qaytadi).
 */
export type SearchSourceState = "on" | "off" | "no-cashbox" | "error";

export interface StudentHit {
  id: number;
  name: string;
  phone: string;
  category: string;
  /** Qarz (so'm, musbat). 0 — qarzi yo'q (`balance >= 0`). */
  debt: number;
  /** "Aktiv" | "Muzlatilgan" | "Arxiv". */
  status: string;
  /** Joriy filial hovuzidan TASHQARIDAGI yozuv bo'lsa — o'sha filial nomi, aks holda `null`. */
  branch: string | null;
}

export interface LeadHit {
  id: number;
  name: string;
  phone: string;
  course: string;
  /** Qayerdan eshitgan (yoki manba; qattiq yozilgan «Sayt» — bo'sh). */
  source: string;
  /** lib/leadHolat.ts → LeadHolat. */
  holat: string;
  /** «Yangi» lid necha daqiqadan beri javob kutmoqda; boshqa holatda — `null`. */
  waitingMinutes: number | null;
  branch: string | null;
}

export interface GroupHit {
  id: number;
  /** «Matematika (13-guruh)» — lib/groups.ts → groupLabel. */
  label: string;
  course: string;
  teacher: string;
  /** «14:00 - 16:00» — bazadagi ko'rinishda. */
  time: string;
  room: string;
  students: number;
  /** gathering | active | frozen | archive. */
  status: string;
  branch: string | null;
}

export interface StaffHit {
  id: number;
  name: string;
  /** Lavozim yorlig'i: «O'qituvchi» kabi (constants/employees.js → ROLE_LABELS) yoki Rollar'dagi nom (centerRoleId). */
  position: string;
  /** Guruhlari soni — HOZIRCHA SANALMAYDI (route 0 qaytaradi, qatorda ko'rinmaydi): ustoz guruhga ism bilan bog'langan, ismdosh tuzog'i. */
  groups: number;
  /** Xodim biriktirilgan filiallar nomi (takrorsiz). */
  branches: string[];
  archived: boolean;
}

export interface PaymentHit {
  /** «Chek №» — transaction_entries.id. */
  id: number;
  payer: string;
  /** Summa, musbat. */
  amount: number;
  /** "YYYY-MM-DD". */
  date: string;
  method: string;
  cashboxId: number;
  cashboxName: string;
  pupilId: number | null;
  /**
   * Chekni kassa kesimida ochish mumkinmi (admin yoki kassa egasi). `false` va `pupilId`
   * yo'q bo'lsa chek oynasi ochilmaydi — /api/transaction-entries?cashboxId= rad etadi.
   */
  own: boolean;
  cancelled: boolean;
}

export interface SearchGroup<T> {
  state: SearchSourceState;
  items: T[];
  /** Ko'rsatilganidan ko'proq mos yozuv bor. */
  more: boolean;
}

export interface GlobalSearchResults {
  students: SearchGroup<StudentHit>;
  leads: SearchGroup<LeadHit>;
  groups: SearchGroup<GroupHit>;
  staff: SearchGroup<StaffHit>;
  payments: SearchGroup<PaymentHit>;
}

export interface GlobalSearchResponse {
  ok: true;
  q: string;
  /** Qidiruv qamrovi — navbardagi joriy filial (hovuzi bilan). */
  scope: { branchId: number; branchName: string };
  results: GlobalSearchResults;
}

// ── Matnni bir xil ko'rinishga keltirish ─────────────────────────────────────

/** Apostrof o'rnida uchraydigan belgilar: «G'ulom», «Gʻulom», «G’ulom», «G`ulom» — bitta ism. */
const APOS_CHARS = "ʻʼ’‘`´'ʹ′";
const APOS_RE = new RegExp(`[${APOS_CHARS}]`, "g");
const isApos = (ch: string) => APOS_CHARS.includes(ch);

/** Kichik harf, apostroflarsiz, bo'shliqlar bitta. */
export function normalizeSearch(s: string): string {
  return String(s ?? "").toLowerCase().replace(APOS_RE, "").replace(/\s+/g, " ").trim();
}

/** O'zbek va rus kirill harflari → lotin (ў → o', ғ → g' — apostrof keyin baribir tushadi). */
const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
};

export function cyrToLat(s: string): string {
  let out = "";
  for (const ch of String(s ?? "").toLowerCase()) out += CYR_TO_LAT[ch] ?? ch;
  return out;
}

/**
 * Klaviatura rus tartibida qolib ketgan bo'lsa: «ьфвштф» → «madina» (ЙЦУКЕН → QWERTY,
 * tugma joyi bo'yicha). «э» — apostrof tugmasi.
 */
const LAYOUT_TO_LAT: Record<string, string> = {
  й: "q", ц: "w", у: "e", к: "r", е: "t", н: "y", г: "u", ш: "i", щ: "o", з: "p", х: "[", ъ: "]",
  ф: "a", ы: "s", в: "d", а: "f", п: "g", р: "h", о: "j", л: "k", д: "l", ж: ";", э: "'",
  я: "z", ч: "x", с: "c", м: "v", и: "b", т: "n", ь: "m", б: ",", ю: ".", ё: "`",
};

export function layoutToLat(s: string): string {
  let out = "";
  for (const ch of String(s ?? "").toLowerCase()) out += LAYOUT_TO_LAT[ch] ?? ch;
  return out;
}

const HAS_CYR = /[Ѐ-ӿ]/;

/**
 * So'rovning qidiriladigan ko'rinishlari: asl matn, kirilldan lotinga o'girilgani va
 * klaviatura tartibi almashtirilgani. Lotin so'rovda — faqat o'zi.
 *
 * Rus «х» lotinda ikki xil yoziladi: «Хасанов» → «Xasanov» ham, «Hasanov» ham; «Рахимова»
 * odatda «Rahimova» — shuning uchun «х» → «h» ko'rinishi ham qo'shiladi.
 */
export function queryVariants(query: string): string[] {
  const raw = String(query ?? "").trim();
  const out = [normalizeSearch(raw)];
  if (HAS_CYR.test(raw)) {
    out.push(normalizeSearch(cyrToLat(raw)));
    if (/х/i.test(raw)) out.push(normalizeSearch(cyrToLat(raw.replace(/х/gi, "ҳ"))));
    out.push(normalizeSearch(layoutToLat(raw)));
  }
  return [...new Set(out)].filter((v) => v.length > 0);
}

// ── So'rov rejasi (server) ───────────────────────────────────────────────────

export interface QueryPlan {
  raw: string;
  /** Har bir ko'rinishning so'zlari (ko'pi bilan 5 ta). */
  variantTerms: string[][];
  /** Faqat raqam (va ajratkichlar) — ism bo'yicha qidirilmaydi. */
  digitsOnly: boolean;
  /** Telefon naqshi (lib/phoneSearch.ts) — kamida 3 raqam. */
  phonePattern: string | null;
  /** Aniq ID (o'quvchi, lid, xodim, guruh). */
  idNumber: number | null;
  /** «Chek №» — «4512», «#4512», «№4512», «chek 4512». */
  receipt: number | null;
}

const DIGITS_ONLY = /^[\d\s()+\-#№]+$/;

/** «4512», «#4512», «№ 4512», «chek 4512», «чек №4512» → 4512. */
export function receiptNumberOf(q: string): number | null {
  const m = /^\s*(?:(?:chek|check|чек)\s*)?(?:№|#)?\s*(\d{1,9})\s*$/i.exec(String(q ?? ""));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function planQuery(q: string): QueryPlan {
  const raw = String(q ?? "").trim().slice(0, 80);
  const digitsOnly = DIGITS_ONLY.test(raw) && /\d/.test(raw);
  const bare = raw.replace(/[\s#№]/g, "");
  const idNumber = digitsOnly && /^\d{1,9}$/.test(bare) ? Number(bare) : null;
  return {
    raw,
    variantTerms: digitsOnly ? [] : queryVariants(raw).map((v) => v.split(" ").filter(Boolean).slice(0, 5)),
    digitsOnly,
    phonePattern: digitsOnly ? phoneSearchPattern(raw) : null,
    idNumber: idNumber !== null && idNumber > 0 ? idNumber : null,
    receipt: receiptNumberOf(raw),
  };
}

/** Mongo/PCRE uchun maxsus belgilarni qochirish. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const APOS_OPT = `[${APOS_CHARS}]?`;
/** So'z boshi: satr boshi yoki bo'shliq, chiziqcha, qavs, nuqta, vergul, slash. */
const WORD_START = "(?:^|[\\s,./()\\-])";

/**
 * Bitta so'z uchun apostrofga chidamli naqsh manbai: «gulom» → g[ʻ…]?u[ʻ…]?l… — bazadagi
 * «G'ulomov», «Gʻulomov», «Gulomov» uchalasiga mos. `wordStart` — so'z boshidan.
 */
export function looseRegexSource(term: string, wordStart = false): string {
  const chars = Array.from(normalizeSearch(term));
  const body = chars.map(escapeRe).join(APOS_OPT);
  return wordStart ? WORD_START + body : body;
}

// ── Tartiblash ───────────────────────────────────────────────────────────────

/**
 * Matn so'rovga qanchalik mos: 100 — aynan, 80 — boshidan, 60 — har bir so'z biror so'z
 * boshidan, 40 — ichida, 0 — mos emas. So'rovning barcha ko'rinishlari sinab ko'riladi.
 */
export function matchScore(text: string, query: string): number {
  const t = normalizeSearch(text);
  if (!t) return 0;
  let best = 0;
  for (const v of queryVariants(query)) {
    if (t === v) return 100;
    if (t.startsWith(v)) {
      best = Math.max(best, 80);
      continue;
    }
    const terms = v.split(" ").filter(Boolean);
    if (terms.length === 0) continue;
    let all = true;
    let starts = 0;
    for (const term of terms) {
      if (!t.includes(term)) {
        all = false;
        break;
      }
      if (t.startsWith(term) || t.includes(` ${term}`)) starts += 1;
    }
    if (all) best = Math.max(best, starts === terms.length ? 60 : 40);
  }
  return best;
}

/** Ballga ko'ra kamayish tartibida (barqaror) va `cap` tagacha kesish. */
export function rankTop<T>(items: readonly T[], score: (x: T) => number, cap = SEARCH_CAP): { items: T[]; more: boolean } {
  const ranked = items
    .map((x, i) => ({ x, i, s: score(x) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.x);
  return { items: ranked.slice(0, cap), more: ranked.length > cap };
}

// ── Bo'yash (highlight) ──────────────────────────────────────────────────────

export type Range = [number, number];

/** Kichik harfli, apostrofsiz matn va har bir belgining asl matndagi o'rni. */
function mapNormalize(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (isApos(ch)) continue;
    const low = /\s/.test(ch) ? " " : ch.toLowerCase();
    for (const c of low) {
      norm += c;
      map.push(i);
    }
  }
  return { norm, map };
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

/** Raqamli so'rov — telefon yoki chek raqamida ajratkichlardan qat'i nazar. */
function digitRanges(text: string, digits: string): Range[] {
  let ds = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] >= "0" && text[i] <= "9") {
      ds += text[i];
      map.push(i);
    }
  }
  const at = ds.indexOf(digits);
  return at < 0 ? [] : [[map[at], map[at + digits.length - 1] + 1]];
}

/**
 * Matndagi so'rovga mos qismlar `[boshi, oxiri)` — asl matn indekslarida (apostrof va
 * katta harf hisobga olinadi: «G'ulomov» da «gul» → «G'ul»). Har so'z bitta joyda:
 * avval so'z boshidan, bo'lmasa ichidan (1 harfli so'z — faqat so'z boshidan).
 */
export function highlightRanges(text: string, query: string): Range[] {
  const src = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!src || !q) return [];
  if (DIGITS_ONLY.test(q) && /\d/.test(q)) {
    const d = searchPhoneDigits(q) ?? q.replace(/\D/g, "");
    return d ? digitRanges(src, d) : [];
  }
  const { norm, map } = mapNormalize(src);
  const out: Range[] = [];
  for (const v of queryVariants(q)) {
    for (const term of v.split(" ").filter(Boolean)) {
      let at = norm.startsWith(term) ? 0 : -1;
      if (at < 0) {
        const ws = norm.indexOf(` ${term}`);
        if (ws >= 0) at = ws + 1;
      }
      if (at < 0 && term.length >= 2) at = norm.indexOf(term);
      if (at < 0) continue;
      out.push([map[at], map[at + term.length - 1] + 1]);
    }
  }
  return mergeRanges(out);
}

/** Matnni bo'laklarga bo'lish: `hit` — bo'yaladigan qism. */
export function splitByRanges(text: string, ranges: readonly Range[]): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a), hit: false });
    out.push({ text: text.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false });
  return out;
}

// ── Kichik formatlar ─────────────────────────────────────────────────────────

/** 350000 → «350 000» (yaxlitlanadi, ishorasiz; lokalga bog'liq emas — gidratsiya xavfsiz). */
export function groupDigits(n: number): string {
  return String(Math.round(Math.abs(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «29.08.2026 | 11:42» (Toshkent vaqti, lib/uzTime.ts → uzStamp) → epoch ms; noto'g'ri — `null`. */
export function parseUzStamp(s: string | undefined | null): number | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s*\|?\s*(\d{1,2}):(\d{2}))?/.exec(String(s ?? ""));
  if (!m) return null;
  const [d, mo, y, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  // Toshkent = UTC+5, yozgi vaqt yo'q.
  return Date.UTC(y, mo - 1, d, h - 5, mi);
}

/** Kutish muddati: 59 daqiqagacha — daqiqa, 48 soatgacha — soat, keyin — kun. */
export function waitingParts(minutes: number): { n: number; unit: "min" | "hour" | "day" } {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return { n: m, unit: "min" };
  if (m < 48 * 60) return { n: Math.floor(m / 60), unit: "hour" };
  return { n: Math.floor(m / 1440), unit: "day" };
}

/** «2026-10-31» → «31.10.2026». */
export function dmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso ?? "");
}

/** «Asadbek Karimov» → «AK». */
export function initialsOf(name: string): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** ["Lid", "to'lov", "sahifa"], "va" → «Lid, to'lov va sahifa». */
export function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}
