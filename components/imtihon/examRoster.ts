import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import type { StudentRow } from "@/lib/studentsData";
import { searchPhoneDigits } from "@/lib/phoneSearch";
import { intOf, normHeader } from "./importUtils";

// IMTIHON → NATIJA KIRITISH: O'QUVCHILAR RO'YXATI YORDAMCHILARI — eski (GroupExamDrawer) va yangi
// (v2/imtihon/ExamEntryV2) panel uchun bitta qoida.
//
// GURUHSIZ RO'YXAT (01.11.2026, foydalanuvchi: «hali hammani guruhga joylamaganmiz … Markaz bo'yicha
// 1 ta ro'yxat qilish kerak … qaysi guruhda o'qiysiz demasin»; qoidalari lib/imtihon.ts da): ro'yxat
// guruhdan emas — filialning barcha faol o'quvchilari (pastdagi «Guruhsiz ro'yxat» bo'limi), bazada
// yo'q bo'lsa karta ochiladi, Excel'dan yuklansa — butun filial bazasidan moslanadi.

/** Qidiruv natijasi → jadval qatori (jadval `Pupil` bilan ishlaydi; kerakligi — id, ism, telefon). */
export function pupilOfRow(s: Pick<StudentRow, "id" | "name" | "phone">): Pupil {
  return { id: s.id, firstName: s.name, lastName: "", phone: s.phone ?? "" } as unknown as Pupil;
}

/** Saqlangan sarhisobning o'quvchilari (tahrir rejimi) — ism/telefon sarhisobdagidek. */
export function rosterOfExam(exam: Pick<GroupExam, "students">): Pupil[] {
  return exam.students.map((s) => ({ id: s.pupilId, firstName: s.name, lastName: "", phone: s.phone }) as unknown as Pupil);
}

export interface PriorResult {
  exam: GroupExam;
  pct: number;
}

/**
 * Shu oy va fan bo'yicha BOSHQA sarhisoblardagi natija (arxivdagisiz; bir nechta bo'lsa — eng
 * oxirgisi): ro'yxatda «bu oyda bor» belgisi — bir o'quvchi ikki marta kiritilmasin. Ikkalasi
 * saqlansa reyting va o'quvchilar botida eng oxirgisi hisoblanadi (lib/examRanking.ts → rankPool).
 */
export function priorResults(exams: GroupExam[], month: string, course: string, skipId?: number): Map<number, PriorResult> {
  const out = new Map<number, PriorResult>();
  const want = course.trim().toLowerCase();
  if (!want) return out;
  const list = exams
    .filter((e) => e.id !== skipId && !e.archived && groupExamMonth(e) === month && e.course.trim().toLowerCase() === want)
    .sort((a, b) => a.id - b.id);
  for (const e of list) for (const s of e.students) out.set(s.pupilId, { exam: e, pct: s.pct });
  return out;
}

/* ---------------- Excel'dan yuklash ---------------- */

/** Ism solishtirish: apostrof turlari va bo'shliqlar farq qilmasin. */
export const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’ʻʼ`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export interface ResultColumns {
  /** Ism ustuni — bitta («O'quvchi», «F.I.Sh») yoki ikkita («Familiya» + «Ism»). */
  nameCols: number[];
  corrCol: number;
  /** Telefon ustuni; yo'q — -1. */
  phoneCol: number;
  /** Ma'lumot boshlanadigan qator. */
  start: number;
}

/**
 * Natijalar jadvalidagi ustunlar. Sarlavha (birinchi 5 qatordan): «O'quvchi/Ism/F.I.Sh» va «To'g'ri
 * javob/Ball»; sarlavhasiz fayl — ism harfli birinchi ustun, natija undan keyingi raqamli ustun.
 */
export function findResultColumns(table: string[][]): ResultColumns | null {
  for (let i = 0; i < Math.min(table.length, 5); i++) {
    // Nuqta («F.I.Sh.») va o'zbekcha tutuq belgilari («Oʻquvchi», «To‘g‘ri») ham tashlanadi.
    const h = table[i].map((x) => normHeader(x).replace(/[.ʻ‘]/g, ""));
    const n = h.findIndex((x) => /oquvchi|ism|fio|fish|familiya|name|student/.test(x));
    const c = h.findIndex((x) => /togri|javob|correct|ball|natija/.test(x));
    if (n < 0 || c < 0) continue;
    const fam = h.findIndex((x) => /familiya/.test(x));
    const ism = h.findIndex((x) => /^(ism|ismi|name|firstname)$/.test(x));
    return {
      nameCols: fam >= 0 && ism >= 0 && fam !== ism ? [fam, ism] : [n],
      corrCol: c,
      phoneCol: h.findIndex((x) => /telefon|phone|^tel/.test(x)),
      start: i + 1,
    };
  }
  for (const r of table) {
    const n = r.findIndex((x) => /\p{L}/u.test(String(x)));
    const c = n >= 0 ? r.findIndex((x, j) => j > n && /^\s*\d+\s*$/.test(String(x))) : -1;
    if (n >= 0 && c >= 0) return { nameCols: [n], corrCol: c, phoneCol: -1, start: 0 };
  }
  return null;
}

export interface ImportMatch {
  /** Topilganlar — fayl tartibida; bir o'quvchi ikki qatorda bo'lsa — keyingisi. */
  hits: { pupil: Pupil; correct: number }[];
  /** Bazada (guruhda) topilmagan ismlar. */
  missing: string[];
  /** Bir xil ismli bir nechta o'quvchi (telefon bilan ham ajralmadi) — qo'lda tanlanadi. */
  ambiguous: string[];
}

const phone9 = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(-9);

/**
 * Fayl qatorlari → o'quvchilar. GURUH rejimi (`strict: false`) — avvalgidek: ism guruh ro'yxatidan,
 * bir xil ism bo'lsa ro'yxatdagi keyingisi. GURUHSIZ (`strict: true`, butun filial bazasi): telefon
 * ustuni bo'lsa bir xil ismlilar telefon bilan ajratiladi (ism mos kelmasa telefonning o'zi bilan
 * ham topiladi), baribir bir nechta qolsa — `ambiguous` (taxmin bilan yozilmaydi).
 */
export function matchResultRows(
  table: string[][],
  cols: ResultColumns,
  pool: Pupil[],
  opts: { total: number; strict: boolean; /** Ismdoshlar orasida bittasi shu to'plamda bo'lsa — o'sha (faol o'quvchi arxivdagidan oldin). */ prefer?: ReadonlySet<number> },
): ImportMatch {
  const byName = new Map<string, Pupil[]>();
  const byPhone = new Map<string, Pupil[]>();
  const push = (m: Map<string, Pupil[]>, key: string, p: Pupil) => {
    if (!key) return;
    const list = m.get(key) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    m.set(key, list);
  };
  for (const p of pool) {
    push(byName, normName(pupilFullName(p)), p);
    push(byName, normName(`${p.lastName ?? ""} ${p.firstName ?? ""}`), p);
    const d = phone9(p.phone);
    if (d.length === 9) push(byPhone, d, p);
  }

  const hits = new Map<number, { pupil: Pupil; correct: number }>();
  const missing: string[] = [];
  const ambiguous: string[] = [];
  for (const r of table.slice(cols.start)) {
    const name = cols.nameCols
      .map((i) => String(r[i] ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const raw = String(r[cols.corrCol] ?? "").trim();
    if (!name || raw === "") continue;
    let list = byName.get(normName(name)) ?? [];
    let p: Pupil | undefined;
    if (opts.strict) {
      const d = cols.phoneCol >= 0 ? phone9(r[cols.phoneCol]) : "";
      if (d.length === 9) {
        const same = list.filter((x) => phone9(x.phone) === d);
        if (same.length) list = same;
        else if (!list.length) list = byPhone.get(d) ?? [];
      }
      if (list.length > 1 && opts.prefer) {
        const pref = list.filter((x) => opts.prefer!.has(x.id));
        if (pref.length === 1) list = pref;
      }
      if (list.length === 1) p = list[0];
    } else {
      p = list[list.length - 1];
    }
    if (!p) {
      (list.length ? ambiguous : missing).push(name);
      continue;
    }
    let v = intOf(raw);
    if (opts.total > 0 && v > opts.total) v = opts.total;
    hits.delete(p.id);
    hits.set(p.id, { pupil: p, correct: v });
  }
  return { hits: [...hits.values()], missing, ambiguous };
}

/** Xabar uchun: birinchi uchta ism, qolgani «…». */
export function namesPreview(list: string[]): string {
  return list.slice(0, 3).join(", ") + (list.length > 3 ? "…" : "");
}

/* ---------------- Guruhsiz ro'yxat: filialning barcha faol o'quvchilari ---------------- */
//
// 01.11.2026 (kechqurun), foydalanuvchi: «guruhsiz ro'yxat deyilgan yerda "ro'yxat bo'sh" chiqyapti,
// uni o'rniga markazdagi barcha o'quvchilar ro'yxati chiqsin, guruhsiz o'quvchilar chiqsin». Ro'yxat
// endi qo'lda yig'ilmaydi — filialning (hovuzi bilan) BARCHA faol o'quvchilari chiqadi, natija
// yozilmagani saqlanmaydi. Ustiga atayin qo'shilganlar (yangi karta, arxivdagi, Excel'dan,
// tahrirdagi sarhisobda bo'lib endi faol bo'lmagan) — ro'yxat boshida.

/** Ro'yxat filtri: hammasi, guruhga joylanmaganlar, natijasi yozilganlar. */
export type RosterFilter = "all" | "groupless" | "entered";

type GroupLike = { id: number; name?: string; course?: string; status?: string; studentIds?: readonly (number | string)[] };

/** pupilId → guruh yorliqlari («Matematika · 7-A»); arxivdagi guruh hisob emas. */
export function groupsByPupil(groups: readonly GroupLike[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const g of groups) {
    if (g.status === "archive") continue;
    const label = [g.course?.trim(), g.name?.trim()].filter(Boolean).join(" · ") || `#${g.id}`;
    for (const raw of g.studentIds ?? []) {
      const id = Number(raw);
      if (!Number.isFinite(id)) continue;
      const list = out.get(id);
      if (!list) out.set(id, [label]);
      else if (!list.includes(label)) list.push(label);
    }
  }
  return out;
}

const nameCollator = new Intl.Collator("uz", { sensitivity: "base", numeric: true });

/** Ism bo'yicha (alifbo; ismsiz — oxirida); bir o'quvchi bir marta. */
export function sortByName(list: readonly Pupil[]): Pupil[] {
  const seen = new Set<number>();
  const rows: { p: Pupil; name: string }[] = [];
  for (const p of list) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    rows.push({ p, name: pupilFullName(p) });
  }
  rows.sort((a, b) => Number(!a.name) - Number(!b.name) || nameCollator.compare(a.name, b.name) || a.p.id - b.p.id);
  return rows.map((r) => r.p);
}

/**
 * Jadval tartibi: atayin qo'shilganlar (qo'shilish tartibida) boshida, keyin faollar alifbo bo'yicha.
 * Qo'shilgan o'quvchi faollar ro'yxatida ham bo'lsa — o'sha (jonli) yozuvi: tahrirdagi sarhisobning
 * eski ismi/telefoni emas, hozirgisi ko'rinadi (server ham saqlashda ismni bazadan oladi).
 */
export function centerRoster(sortedBase: readonly Pupil[], extras: readonly Pupil[]): Pupil[] {
  if (!extras.length) return [...sortedBase];
  const ids = new Set(extras.map((p) => p.id));
  const live = new Map<number, Pupil>();
  for (const p of sortedBase) if (ids.has(p.id)) live.set(p.id, p);
  return [...extras.map((p) => live.get(p.id) ?? p), ...sortedBase.filter((p) => !ids.has(p.id))];
}

/** Qidiruv kaliti — lib/examRanking.ts dagi qoida (tutuq belgilari bir xil, katta-kichik harf farqsiz). */
export const foldSearch = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export interface RosterEntry {
  p: Pupil;
  /** foldSearch(ism) */
  key: string;
  /** Telefon raqamlari (faqat raqam). */
  digits: string;
}

/** Filtrlash uchun indeks — har harf bosilganda 5 000 ismni qayta katlamaslik uchun bir marta. */
export function rosterIndex(list: readonly Pupil[]): RosterEntry[] {
  return list.map((p) => ({ p, key: foldSearch(pupilFullName(p)), digits: String(p.phone ?? "").replace(/\D/g, "") }));
}

/**
 * Qidiruv va filtr. Ism — so'zlar istalgan tartibda («Aliyev Vali» ham «Vali Aliyev» ni topadi,
 * har so'z ism ichida bo'lsa bas); 3+ raqam — telefon ham. «entered» — tanlangan paytdagi natijali
 * o'quvchilar (`entered`): natijasi o'chirilsa ham qator ko'z oldidan qochib ketmaydi.
 */
export function filterRoster(
  index: readonly RosterEntry[],
  o: { query: string; filter: RosterFilter; groupsOf: ReadonlyMap<number, string[]>; entered: ReadonlySet<number> },
): Pupil[] {
  const q = foldSearch(o.query);
  const words = q ? q.split(" ") : [];
  const qDigits = searchPhoneDigits(o.query);
  const out: Pupil[] = [];
  for (const e of index) {
    if (o.filter === "groupless" && o.groupsOf.has(e.p.id)) continue;
    if (o.filter === "entered" && !o.entered.has(e.p.id)) continue;
    if (words.length && !words.every((w) => e.key.includes(w)) && !(qDigits !== null && e.digits.includes(qDigits))) continue;
    out.push(e.p);
  }
  return out;
}
