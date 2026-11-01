import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { searchPhoneDigits } from "@/lib/phoneSearch";

// IMTIHON → SARHISOB → MARKAZ REYTINGI (01.11.2026). Mijoz: «Butun markazdagi natijani ham
// ko'ra oladimi? Jami topshirganlarni ichidan top 3 va qolganlar kabi … 100 tacha guruh
// topshiradi … qo'shib filtrlasa bo'ladimi». Tanlangan oyning BARCHA (arxivda bo'lmagan)
// sarhisoblaridagi o'quvchi natijalari bitta ro'yxatga yig'iladi va o'rin beriladi. Qamrov —
// sarhisoblar ro'yxati bilan bir xil (joriy filial, GET /api/imtihon/group); hisob shu yerda,
// mijozda — yangi so'rov yo'q. Eski (components/imtihon/SarhisobView) va yangi
// (components/v2/imtihon/SarhisobListV2) versiya bitta qoida bilan (useCenterRanking orqali).
//
// QOIDALAR:
//  • O'rin FOIZ bo'yicha (savollar soni guruhlarda har xil), ko'rinib turgan butun foiz;
//    teng natija — teng o'rin: 100, 96, 96, 92 → 1, 2, 2, 4 (ochiq guruh sahifasidagi bilan
//    bir xil — components/imtihon/PublicResultsPage). Tenglar ichida — ism bo'yicha.
//  • Bir o'quvchi bir oyda bir fandan BIR MARTA: ikki sarhisobda bo'lsa (guruh almashgan,
//    ikki guruhda o'qiydi) — ENG OXIRGI (id bo'yicha) sarhisobdagisi, o'quvchilar botidagi
//    natija bilan bir xil (lib/groupExamsServer.ts → syncMonthlyMirror). Turli fan — alohida qator.
//  • Filtr (fan, bosqich, ustoz, guruh) reytingni SHU TO'PLAM ichida qayta hisoblaydi;
//    qidiruv faqat qatorni topadi — o'rin o'zgarmaydi.
//  • Uchlik — 1–3-o'rinlar: teng bo'lsa bir o'rinda bir necha o'quvchi (2 kishi 1-o'rinda bo'lsa
//    2-o'rin yo'q, keyingisi 3-o'rin); 0% uchlikka kirmaydi.

export interface RankRow {
  /** Qator kaliti — sarhisob + o'quvchi. */
  key: string;
  examId: number;
  pupilId: number;
  name: string;
  phone: string;
  course: string;
  teacher: string;
  groupId: number;
  groupName: string;
  groupLabel: string;
  level: string;
  total: number;
  correct: number;
  pct: number;
  /** O'rin (teng natija — teng o'rin); `rankPool` dan chiqqanda 0. */
  rank: number;
}

export interface RankFacets {
  course: string;
  level: string;
  teacher: string;
  /** `groupId` matn ko'rinishida. */
  group: string;
}

export type RankFacetKey = keyof RankFacets;

export const RANK_FACETS: RankFacetKey[] = ["course", "level", "teacher", "group"];

/** «Yaxshi natija» chegarasi — yangi versiyadagi `examBand` ning yuqori bandi bilan bir xil. */
export const RANK_HIGH_PCT = 80;

/**
 * Guruh nomi: «7» → «7-guruh» (`t` — joriy til), qolgani o'z nomi bilan (bo'sh bo'lsa — to'liq
 * yorliq). CRM va ochiq sahifa uchun bitta (components/imtihon/sarhisobCore ham shuni beradi).
 */
export function examGroupTitle(r: { groupName: string; groupLabel: string }, t: (key: string, params?: { n: string }) => string): string {
  return /^\d+$/.test(r.groupName) ? t("{n}-guruh", { n: r.groupName }) : r.groupName || r.groupLabel;
}

/** O'quvchi kaliti: `pupils.id`, bo'lmasa (eski yozuv) — ism. */
export function rankPupilKey(r: Pick<RankRow, "pupilId" | "name">): string {
  return r.pupilId > 0 ? `p${r.pupilId}` : `n${r.name.trim().toLowerCase()}`;
}

/** Oyning natijalari — takrorsiz, o'rinsiz (`rank` 0). Arxivdagi sarhisob olinmaydi. */
export function rankPool(exams: GroupExam[], month: string): RankRow[] {
  const latest = new Map<string, RankRow>();
  const list = exams.filter((e) => !e.archived && groupExamMonth(e) === month).sort((a, b) => a.id - b.id);
  for (const e of list) {
    for (const s of e.students ?? []) {
      const row: RankRow = {
        key: `${e.id}:${s.pupilId}:${s.name}`,
        examId: e.id,
        pupilId: Number(s.pupilId) || 0,
        name: String(s.name ?? "").trim(),
        phone: String(s.phone ?? ""),
        course: e.course,
        teacher: e.teacher,
        groupId: e.groupId,
        groupName: e.groupName,
        groupLabel: e.groupLabel,
        level: e.level ?? "",
        total: e.total,
        correct: s.correct,
        pct: s.pct,
        rank: 0,
      };
      // id o'sish tartibida — keyingisi (eng oxirgi sarhisob) avvalgisining o'rniga yoziladi.
      latest.set(`${rankPupilKey(row)}|${e.course.trim().toLowerCase()}`, row);
    }
  }
  return [...latest.values()];
}

/** `skip` — shu filtrni hisobga olmay (tanlov ro'yxatidagi sonlar uchun). */
export function matchesFacets(r: RankRow, f: RankFacets, skip?: RankFacetKey): boolean {
  return (
    (skip === "course" || !f.course || r.course === f.course) &&
    (skip === "level" || !f.level || r.level === f.level) &&
    (skip === "teacher" || !f.teacher || r.teacher === f.teacher) &&
    (skip === "group" || !f.group || String(r.groupId) === f.group)
  );
}

/** Foiz kamayishi bo'yicha; teng foiz — teng o'rin (1, 2, 2, 4), tenglar ichida — ism. */
export function rankRows(rows: RankRow[]): RankRow[] {
  const sorted = [...rows].sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name) || a.examId - b.examId);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.pct !== sorted[i - 1].pct) rank = i + 1;
    return { ...r, rank };
  });
}

const foldName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Qidiruv: ism bo'lagi yoki telefon raqamlari (3 tadan kam raqam — telefon bo'yicha emas). */
export function matchesQuery(r: Pick<RankRow, "name" | "phone">, query: string): boolean {
  const q = foldName(query);
  if (!q) return true;
  if (foldName(r.name).includes(q)) return true;
  const digits = searchPhoneDigits(query);
  return digits !== null && r.phone.replace(/\D/g, "").includes(digits);
}

export interface PodiumPlace {
  rank: number;
  pct: number;
  rows: RankRow[];
}

/** 1–3-o'rinlar (`rankRows` natijasidan); teng natijalar bitta o'rinda. */
export function podiumOf(ranked: RankRow[]): PodiumPlace[] {
  const places: PodiumPlace[] = [];
  for (const r of ranked) {
    if (r.rank > 3 || r.pct <= 0) break;
    const last = places[places.length - 1];
    if (last && last.rank === r.rank) last.rows.push(r);
    else places.push({ rank: r.rank, pct: r.pct, rows: [r] });
  }
  return places;
}

export interface RankStats {
  results: number;
  pupils: number;
  groups: number;
  /** O'rtacha foiz; natija yo'q — null. */
  avg: number | null;
  /** RANK_HIGH_PCT va undan yuqori natijalar. */
  high: number;
}

export function rankStats(rows: RankRow[]): RankStats {
  return {
    results: rows.length,
    pupils: new Set(rows.map(rankPupilKey)).size,
    groups: new Set(rows.map((r) => r.groupId)).size,
    avg: rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : null,
    high: rows.filter((r) => r.pct >= RANK_HIGH_PCT).length,
  };
}

export interface FacetCount {
  value: string;
  count: number;
}

/**
 * Har filtr tanlovi: boshqa filtrlar qo'llangan to'plamdagi qiymatlar va natijalar soni
 * (fan tanlansa — ustozlar ro'yxatida faqat shu fan ustozlari). Tanlangan qiymat shu oyda
 * bo'lmasa ham ro'yxatda qoladi (0 bilan) — tugmada ko'rinib, tozalansin.
 */
export function facetCounts(pool: RankRow[], f: RankFacets): Record<RankFacetKey, FacetCount[]> {
  const out = {} as Record<RankFacetKey, FacetCount[]>;
  for (const key of RANK_FACETS) {
    const counts = new Map<string, number>();
    for (const r of pool) {
      if (!matchesFacets(r, f, key)) continue;
      const v = key === "group" ? String(r.groupId) : r[key];
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    if (f[key] && !counts.has(f[key])) counts.set(f[key], 0);
    out[key] = [...counts].map(([value, count]) => ({ value, count }));
  }
  return out;
}

/** CSV (Reyting_YYYY-MM.csv): ustunlar Sarhisob CSV'si uslubida, har natija — qator. */
export function rankingCsvRows(rows: RankRow[]): unknown[][] {
  const head = ["O'rin", "O'quvchi", "Fan", "Guruh", "Bosqich", "Ustoz", "Savollar", "To'g'ri javob", "O'zlashtirish %"];
  return [head, ...rows.map((r) => [r.rank, r.name, r.course, r.groupLabel, r.level, r.teacher, r.total, r.correct, r.pct])];
}

/* ============================================================
   OCHIQ MARKAZ REYTINGI — /natijalar/markaz/<kalit> (01.11.2026, foydalanuvchi: «markaz
   bo'yicha reytingni ulashish»). Hisob serverda shu qoidalar bilan (`rankPool`), brauzerga
   faqat ko'rinadigan maydonlar boradi: TELEFON, USTOZ va haqiqiy id'lar YO'Q. O'quvchi, guruh
   va sarhisob — shu javob ichidagi tartib raqamlari (ko'rsatkichlar sanog'i va tenglar
   tartibi CRM'dagidek chiqsin; sarhisob raqami id tartibida beriladi).
   ============================================================ */

export interface PublicRankRow {
  /** O'quvchining shu javobdagi raqami (bir o'quvchi ikki fanda — bitta raqam). */
  pupil: number;
  /** Guruhning shu javobdagi raqami. */
  group: number;
  /** Sarhisobning shu javobdagi raqami — id o'sish tartibida. */
  exam: number;
  name: string;
  course: string;
  groupName: string;
  groupLabel: string;
  level: string;
  total: number;
  correct: number;
  pct: number;
}

/** Ochiq reyting sahifasining ma'lumoti (lib/publicResults.ts → loadCenterRanking). */
export interface PublicCenterRanking {
  /** Filial nomi (hovuzdagi ikki filialning nomi bir xil). */
  branchName: string;
  /** Natijasi bor oylar — yangisi birinchi. */
  months: string[];
  /** Ko'rsatilayotgan oy; natija umuman yo'q — `null`. */
  month: string | null;
  /** Shu oyning natijalari — takrorsiz (`rankPool`), o'rinsiz. */
  rows: PublicRankRow[];
}

/** `rankPool` natijasi → ochiq qatorlar (telefon, ustoz va id'lar olib tashlanadi). */
export function publicRankRows(pool: RankRow[]): PublicRankRow[] {
  const examNo = new Map([...new Set(pool.map((r) => r.examId))].sort((a, b) => a - b).map((id, i) => [id, i + 1] as const));
  const pupilNo = new Map<string, number>();
  const groupNo = new Map<number, number>();
  const numberOf = <K>(map: Map<K, number>, key: K): number => {
    const known = map.get(key);
    if (known !== undefined) return known;
    map.set(key, map.size + 1);
    return map.size;
  };
  return pool.map((r) => ({
    pupil: numberOf(pupilNo, rankPupilKey(r)),
    group: numberOf(groupNo, r.groupId),
    exam: examNo.get(r.examId) ?? 0,
    name: r.name,
    course: r.course,
    groupName: r.groupName,
    groupLabel: r.groupLabel,
    level: r.level,
    total: r.total,
    correct: r.correct,
    pct: r.pct,
  }));
}

/** Ochiq qator → `RankRow` (sahifa shu faylning `rankRows`, `podiumOf`, `rankStats` idan foydalanadi). */
export function rankRowOfPublic(r: PublicRankRow, i: number): RankRow {
  return {
    key: String(i),
    examId: r.exam,
    pupilId: r.pupil,
    name: r.name,
    phone: "",
    course: r.course,
    teacher: "",
    groupId: r.group,
    groupName: r.groupName,
    groupLabel: r.groupLabel,
    level: r.level,
    total: r.total,
    correct: r.correct,
    pct: r.pct,
    rank: 0,
  };
}
