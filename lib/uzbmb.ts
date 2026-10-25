// UzBMB (Imtihon → UzBMB) — 12-qism, 25.10.2026. Umumiy tiplar va hisob: API route'lari ham,
// klient ham shu faylni bo'lishadi (ball formulasi bitta joyda).
//
// TUZILISH (rasm «UzBMB · Natija kiritish / Natijalar va taqqoslash», «Sozlamalar · Imtihon fanlari»):
//   • SOZLAMA (`uzbmb_settings`, bitta hujjat, barcha filiallar uchun): ball tuzilishi (1-blok,
//     2-blok, majburiy — savollar × koeffitsiyent) va fanlar ro'yxati (majburiy uchtasi qulf);
//   • TEST (`uzbmb_tests`): filial bo'yicha ketma-ket raqam (№1, №2 …), nomi, sanasi va YARATILGAN
//     PAYTDAGI ball tuzilishi — sozlama keyin o'zgarsa eski testlar o'zgarmaydi (rasmdagi izoh
//     «o'zgarsa, faqat yangi testlarga ta'sir qiladi»);
//   • NATIJA (`uzbmb_exams` — eski kolleksiya, maydonlari saqlangan): test × o'quvchi bitta yozuv,
//     guruh va yo'nalish (1-blok / 2-blok fani) bilan. O'quvchilar boti va kabinet shu yozuvlarni
//     o'qiydi (lib/studentBot/data.ts → loadExams) — eski maydonlar (student, month, b1s … total)
//     shuning uchun to'ldiriladi. 25.10.2026 gacha yozilgan 3 ta eski natijada test/guruh yo'q.

/* ── Ball tuzilishi ─────────────────────────────────────────────────────── */

export interface UbPart {
  /** Savollar soni. */
  q: number;
  /** Bir to'g'ri javob bali (koeffitsiyent). */
  k: number;
}

export interface UbScheme {
  b1: UbPart;
  b2: UbPart;
  /** Har bir majburiy fan uchun (uchtasi bir xil). */
  maj: UbPart;
}

/** UzBMB amaldagi tuzilishi: 30 × 3,1 + 30 × 2,1 + 3 × 10 × 1,1 = 189. */
export const UB_DEFAULT_SCHEME: UbScheme = {
  b1: { q: 30, k: 3.1 },
  b2: { q: 30, k: 2.1 },
  maj: { q: 10, k: 1.1 },
};

/** Bir kasrgacha yaxlitlash (ballar 3,1 / 2,1 / 1,1 koeffitsiyentlarida). */
export function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface UbMax {
  b1: number;
  b2: number;
  /** Bitta majburiy fan. */
  one: number;
  /** Uchala majburiy fan. */
  maj: number;
  total: number;
}

export function schemeMax(s: UbScheme): UbMax {
  const b1 = r1(s.b1.q * s.b1.k);
  const b2 = r1(s.b2.q * s.b2.k);
  const one = r1(s.maj.q * s.maj.k);
  const maj = r1(s.maj.q * 3 * s.maj.k);
  return { b1, b2, one, maj, total: r1(b1 + b2 + maj) };
}

/** Savollar soni va koeffitsiyent chegaralari (sozlama formasida ham, serverda ham). */
export const UB_Q_MAX = 100;
export const UB_K_MIN = 0.1;
export const UB_K_MAX = 10;

function partOk(p: unknown): p is UbPart {
  if (!p || typeof p !== "object") return false;
  const { q, k } = p as Record<string, unknown>;
  return Number.isInteger(q) && (q as number) >= 1 && (q as number) <= UB_Q_MAX && typeof k === "number" && Number.isFinite(k) && k >= UB_K_MIN && k <= UB_K_MAX;
}

/** Tuzilishni tekshiradi; koeffitsiyent ikki kasrgacha yaxlitlanadi. Xato — null. */
export function cleanScheme(raw: unknown): UbScheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const fix = (p: unknown): UbPart | null => {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const part = { q: Number(o.q), k: Math.round(Number(o.k) * 100) / 100 };
    return partOk(part) ? part : null;
  };
  const b1 = fix(r.b1);
  const b2 = fix(r.b2);
  const maj = fix(r.maj);
  return b1 && b2 && maj ? { b1, b2, maj } : null;
}

/* ── Fanlar ─────────────────────────────────────────────────────────────── */

export type UbMajKey = "m1" | "m2" | "m3";
export const UB_MAJ_KEYS: readonly UbMajKey[] = ["m1", "m2", "m3"];

/**
 * Jadval ustunlaridagi qisqa nomlar (rasmda «Ona tili», «Matematika», «Tarix»). Majburiy fanlar
 * qulf — nomi sozlamada o'zgarmaydi, shu bois qisqa nom ham o'zgarmas.
 */
export const UB_MAJ_SHORT: Record<UbMajKey, string> = { m1: "Ona tili", m2: "Matematika", m3: "Tarix" };

export interface UbSubject {
  id: string;
  name: string;
  /** Majburiy uchtadan biri — qulf: nomi o'zgarmaydi, o'chirilmaydi, faolsizlantirilmaydi. */
  maj?: UbMajKey;
  /** Blok fani sifatida tanlanadimi (majburiyda — «blokda ham»; qolganlari doim true). */
  block: boolean;
  active: boolean;
}

/**
 * Boshlang'ich ro'yxat: majburiy uchta (rasmdagidek — Matematika «blokda ham») va eski UzBMB
 * oynasidagi blok fanlari (constants/imtihon.js → UB_MAIN_SUBJECTS). Rasmda «Fanlar» kartasi
 * «Namuna» belgili — ro'yxat markazniki bo'ladi, sozlamada qo'shiladi/o'chiriladi.
 */
export const UB_DEFAULT_SUBJECTS: readonly UbSubject[] = [
  { id: "m1", name: "Ona tili", maj: "m1", block: false, active: true },
  { id: "m2", name: "Matematika", maj: "m2", block: true, active: true },
  { id: "m3", name: "O'zbekiston tarixi", maj: "m3", block: false, active: true },
  { id: "biologiya", name: "Biologiya", block: true, active: true },
  { id: "kimyo", name: "Kimyo", block: true, active: true },
  { id: "fizika", name: "Fizika", block: true, active: true },
  { id: "ingliz", name: "Ingliz tili", block: true, active: true },
  { id: "adabiyot", name: "Ona tili va adabiyot", block: true, active: true },
  { id: "tarix", name: "Tarix", block: true, active: true },
  { id: "huquq", name: "Huquq", block: true, active: true },
  { id: "geografiya", name: "Geografiya", block: true, active: true },
  { id: "rus", name: "Rus tili", block: true, active: true },
];

export interface UbConfig {
  scheme: UbScheme;
  subjects: UbSubject[];
  updatedAt?: string;
  updatedBy?: string;
}

export const UB_DEFAULT_CONFIG: UbConfig = { scheme: UB_DEFAULT_SCHEME, subjects: [...UB_DEFAULT_SUBJECTS] };

export const UB_NAME_MAX = 60;

const normKey = (s: string) => s.trim().toLowerCase().replace(/[‘’ʻʼ`']/g, "'").replace(/\s+/g, " ");

/** Nomlarni solishtirish (apostrof turlari va bo'shliqlar farq qilmasin). */
export function sameSubject(a: string, b: string): boolean {
  return normKey(a) === normKey(b);
}

/**
 * Fanlar ro'yxatini tekshiradi: majburiy uchtasi joyida va qulf (nomi asl holida, faol), nomlar
 * bo'sh emas va takrorlanmaydi. Xato bo'lsa — foydalanuvchiga ko'rsatiladigan matn.
 */
export function cleanSubjects(raw: unknown): { ok: true; subjects: UbSubject[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Fanlar ro'yxati noto'g'ri" };
  const out: UbSubject[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "Fanlar ro'yxati noto'g'ri" };
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim().slice(0, 40);
    const name = String(o.name ?? "").trim().replace(/\s+/g, " ");
    if (!id || ids.has(id)) return { ok: false, error: "Fanlar ro'yxati noto'g'ri" };
    if (!name) return { ok: false, error: "Fan nomini kiriting" };
    if (name.length > UB_NAME_MAX) return { ok: false, error: "Fan nomi juda uzun" };
    if (out.some((s) => sameSubject(s.name, name))) return { ok: false, error: `«${name}» fani ro'yxatda bor` };
    const maj = UB_MAJ_KEYS.includes(o.maj as UbMajKey) ? (o.maj as UbMajKey) : undefined;
    ids.add(id);
    out.push({ id, name, ...(maj ? { maj } : {}), block: maj ? Boolean(o.block) : true, active: maj ? true : o.active !== false });
  }
  for (const key of UB_MAJ_KEYS) {
    const list = out.filter((s) => s.maj === key);
    const def = UB_DEFAULT_SUBJECTS.find((s) => s.maj === key)!;
    if (list.length !== 1 || list[0].name !== def.name) return { ok: false, error: "Majburiy fanlar o'zgartirilmaydi" };
  }
  return { ok: true, subjects: out };
}

/** Yo'nalishda tanlanadigan fanlar (blok fanlari va «blokda ham» majburiylar). */
export function blockSubjects(cfg: Pick<UbConfig, "subjects">, opts: { inactive?: boolean } = {}): UbSubject[] {
  return cfg.subjects.filter((s) => s.block && (s.active || opts.inactive));
}

/* ── Natija ─────────────────────────────────────────────────────────────── */

/** Kiritiladigan kataklar: to'g'ri javoblar soni yoki (sertifikatda) ball. */
export interface UbCells {
  b1c: number | null;
  b1cert: boolean;
  /** Sertifikat bali (qo'lda, koeffitsiyentsiz). */
  b1m: number | null;
  b2c: number | null;
  b2cert: boolean;
  b2m: number | null;
  m1: number | null;
  m2: number | null;
  m3: number | null;
}

export const EMPTY_CELLS: UbCells = { b1c: null, b1cert: false, b1m: null, b2c: null, b2cert: false, b2m: null, m1: null, m2: null, m3: null };

export interface UbCalc {
  b1: number | null;
  b2: number | null;
  /** Har majburiy fan bali (kiritilmagan — null). */
  mb: Record<UbMajKey, number | null>;
  /** Uchala majburiy fan bali (kiritilmagani 0). */
  maj: number;
  /** Kiritilganlar yig'indisi. */
  total: number;
  /** Kiritilgan bo'laklar (1-blok, 2-blok, uchta majburiy) — 0…5. */
  filled: number;
  complete: boolean;
}

export function cellsCalc(c: UbCells, s: UbScheme): UbCalc {
  const max = schemeMax(s);
  const block = (cert: boolean, count: number | null, ball: number | null, part: UbPart, cap: number) =>
    cert ? (ball === null ? null : Math.min(cap, r1(ball))) : count === null ? null : r1(count * part.k);
  const b1 = block(c.b1cert, c.b1c, c.b1m, s.b1, max.b1);
  const b2 = block(c.b2cert, c.b2c, c.b2m, s.b2, max.b2);
  const mb = { m1: c.m1 === null ? null : r1(c.m1 * s.maj.k), m2: c.m2 === null ? null : r1(c.m2 * s.maj.k), m3: c.m3 === null ? null : r1(c.m3 * s.maj.k) };
  const maj = r1(((c.m1 ?? 0) + (c.m2 ?? 0) + (c.m3 ?? 0)) * s.maj.k);
  const filled = [b1, b2, c.m1, c.m2, c.m3].filter((v) => v !== null).length;
  return { b1, b2, mb, maj, total: r1((b1 ?? 0) + (b2 ?? 0) + maj), filled, complete: filled === 5 };
}

export interface UbTest {
  id: number;
  branchId: number;
  /** Filial (hovuz) bo'yicha tartib raqami — «№3». */
  no: number;
  name: string;
  /** "YYYY-MM-DD". */
  date: string;
  scheme: UbScheme;
  createdAt: string;
  createdBy: string;
}

/** Ro'yxatdagi test: natijalar va guruhlar soni bilan. */
export interface UbTestRow extends UbTest {
  resultCount: number;
  groupCount: number;
}

export interface UbResult extends UbCells {
  id: number;
  testId: number;
  groupId: number;
  pupilId: number;
  /** O'quvchi ismi (saqlangan paytdagi; bot ism bo'yicha ham qidiradi). */
  student: string;
  /** Test topshirilgan sana — "YYYY-MM-DD". */
  date: string;
  /** 1-blok va 2-blok fani (yo'nalish). */
  b1s: string;
  b2s: string;
  b1: number;
  b2: number;
  maj: number;
  total: number;
  complete: boolean;
}

export function resultCells(r: Pick<UbResult, keyof UbCells>): UbCells {
  return {
    b1c: r.b1c ?? null,
    b1cert: Boolean(r.b1cert),
    b1m: r.b1cert ? (r.b1m ?? null) : null,
    b2c: r.b2c ?? null,
    b2cert: Boolean(r.b2cert),
    b2m: r.b2cert ? (r.b2m ?? null) : null,
    m1: r.m1 ?? null,
    m2: r.m2 ?? null,
    m3: r.m3 ?? null,
  };
}

/**
 * Mijoz yuborgan kataklarni tekshiradi (sxema chegaralari bilan). Server ikkinchi qorovul:
 * mijoz maydonda chegaradan oshganini o'zi qisqartiradi.
 */
export function cleanCells(raw: unknown, s: UbScheme): { ok: true; cells: UbCells } | { ok: false; error: string } {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const max = schemeMax(s);
  const count = (v: unknown, q: number): number | null | undefined => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= q ? n : undefined;
  };
  const ball = (v: unknown, cap: number): number | null | undefined => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= cap ? r1(n) : undefined;
  };
  const b1cert = Boolean(o.b1cert);
  const b2cert = Boolean(o.b2cert);
  const cells = {
    b1cert,
    b1c: b1cert ? null : count(o.b1c, s.b1.q),
    b1m: b1cert ? ball(o.b1m, max.b1) : null,
    b2cert,
    b2c: b2cert ? null : count(o.b2c, s.b2.q),
    b2m: b2cert ? ball(o.b2m, max.b2) : null,
    m1: count(o.m1, s.maj.q),
    m2: count(o.m2, s.maj.q),
    m3: count(o.m3, s.maj.q),
  };
  if (cells.b1c === undefined || cells.b2c === undefined) return { ok: false, error: `Blok javoblari 0 dan ${Math.max(s.b1.q, s.b2.q)} gacha bo'lishi kerak` };
  if (cells.b1m === undefined || cells.b2m === undefined) return { ok: false, error: "Sertifikat bali blokning eng katta balidan oshmasin" };
  if (cells.m1 === undefined || cells.m2 === undefined || cells.m3 === undefined) return { ok: false, error: `Majburiy fan javoblari 0 dan ${s.maj.q} gacha bo'lishi kerak` };
  return { ok: true, cells: cells as UbCells };
}

export function cellsEmpty(c: UbCells): boolean {
  return !c.b1cert && !c.b2cert && [c.b1c, c.b2c, c.m1, c.m2, c.m3].every((v) => v === null);
}

/** Ikki katak to'plami bir xilmi (o'zgargan qatorni topish uchun). */
export function sameCells(a: UbCells, b: UbCells): boolean {
  return (
    a.b1cert === b.b1cert &&
    a.b2cert === b.b2cert &&
    (a.b1cert ? a.b1m === b.b1m : a.b1c === b.b1c) &&
    (a.b2cert ? a.b2m === b.b2m : a.b2c === b.b2c) &&
    a.m1 === b.m1 &&
    a.m2 === b.m2 &&
    a.m3 === b.m3
  );
}

/* ── Taqqoslash ─────────────────────────────────────────────────────────── */

/** Ball oralig'i chegaralari (rasm: ≥ 150, 120–149, < 120 — 189 dan; tuzilish boshqa bo'lsa mutanosib). */
export function ballBands(maxTotal: number): { hi: number; mid: number } {
  if (Math.abs(maxTotal - 189) < 0.05) return { hi: 150, mid: 120 };
  return { hi: Math.round((maxTotal * 150) / 189), mid: Math.round((maxTotal * 120) / 189) };
}

/** Teng ballilar bir xil o'rin oladi (1, 2, 2, 4). */
export function rankOf(total: number, all: readonly number[]): number {
  return 1 + all.filter((x) => x > total).length;
}

export function avgOf(list: readonly number[]): number | null {
  return list.length ? r1(list.reduce((a, b) => a + b, 0) / list.length) : null;
}

/** Test sanasi uchun oy — eski maydon `month` ("YYYY-MM"), bot shu bo'yicha tartiblaydi. */
export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Sukut nomi — «UzBMB sinov testi №3». */
export function defaultTestName(no: number): string {
  return `UzBMB sinov testi №${no}`;
}
