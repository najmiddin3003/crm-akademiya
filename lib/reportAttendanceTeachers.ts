import type { Db } from "mongodb";
import { MISSED_ALERT_AFTER_MIN } from "@/lib/attendanceAlert";
import { groupWeekdays } from "@/lib/attendance";
import { branchPool } from "@/lib/branchPools";
import { groupEndIso, groupStartIso, isoDateOrNull } from "@/lib/groupMembership";
import { parseTimeRange } from "@/lib/groupRules";
import { computeAttendance, type AttendanceGroupRow } from "@/lib/reportAttendance";
import { toUz, uzDateIso } from "@/lib/uzTime";

// HISOBOTLAR → DAVOMAT → «O'QITUVCHILAR BO'YICHA» (27-qism, 14.11.2026; rasmlar 53–54):
// davomat dars tugagach o'z vaqtida belgilanyaptimi — filial → o'qituvchi.
//
// DARSLAR VA QATNASHISH — lib/reportAttendance.ts (`computeAttendance`, «Guruhlar bo'yicha»
// bilan BITTA hisob, o'zgartirilmaydi): rejadagi dars (guruh jadvali, guruh faol bo'lgan
// kundan) + rejadan tashqari belgilangan kun; «Belgilanmagan» — rejada bo'lib birorta
// belgisi yo'q dars; qatnashish = (keldi + kechikdi + birinchi) / hamma belgi.
//
// VAQTIDA / KECHIKIB — `attendance_history` (har belgi o'zgarishi yoziladi, 20.09.2026 dan;
// lib/attendanceWrite.ts, lib/gamification/lesson.ts): darsning BIRINCHI belgisi yozilgan
// vaqt. Muddat — dars tugashi + MISSED_ALERT_AFTER_MIN daqiqa: «davomat qilinmagan» xabari
// rahbarga shu paytda ketadi (lib/attendanceAlert.ts, Sozlamalar → Nazorat qoidalari).
// Guruh vaqti yo'q yoki tanilmagan — muddat shu kun 23:59 gacha.
//   • tarixi yo'q belgilangan dars (tarix boshlanishidan oldingi kun) — «vaqti noma'lum»:
//     vaqtida ham, kechikib ham emas;
//   • BUGUNGI, muddati hali kelmagan belgisiz dars — hisobga KIRMAYDI (`pending`): ertalab
//     ochilgan hisobot kechki darsni «belgilanmagan» deb ko'rsatmasin.
//
// O'QITUVCHI — guruhning hozirgi ustozi (`groups.teacher`, «Guruhlar bo'yicha» bilan bir xil);
// kalit — kichik harfli ism. FILIAL — guruh filiali, hovuz (1+2 Chortoq) BITTA filial
// (lib/branchPools.ts). Bir o'qituvchi ikki filialda dars bersa — har filialda o'z qatori,
// «Jami»dagi o'qituvchilar soni takrorsiz.

/** Muddat daqiqalari — hisobot izohida ko'rsatiladi. */
export const ON_TIME_AFTER_MIN = MISSED_ALERT_AFTER_MIN;
const LAST_MINUTE = 23 * 60 + 59;

export interface TeacherAttRow {
  /** `${filial}|${ustoz kaliti}`. */
  key: string;
  /** Ism; bo'sh — guruhga ustoz biriktirilmagan. */
  teacher: string;
  /** Hovuz vakili (hovuzsiz filialda — o'zi). */
  branchId: number;
  courses: string[];
  groups: number;
  /** Hisobga kirgan darslar = onTime + late + unknown + unmarked. */
  lessons: number;
  onTime: number;
  late: number;
  /** Belgilangan, lekin qachon belgilangani noma'lum (tarix boshlanishidan oldin). */
  unknown: number;
  /** Muddati o'tib, birorta belgi qo'yilmagan darslar. */
  unmarked: number;
  /** O'quvchi × dars belgilari va ulardan kelganlar (keldi, kechikdi, birinchi). */
  marks: number;
  present: number;
}

export interface TeacherAttTotals {
  lessons: number;
  onTime: number;
  late: number;
  unknown: number;
  unmarked: number;
  marks: number;
  present: number;
  groups: number;
  /** Takrorsiz o'qituvchilar. */
  teachers: number;
  /** Bugungi, muddati hali kelmagan belgisiz darslar (hisobga kirmagan). */
  pending: number;
}

export interface TeacherAttReport {
  from: string;
  to: string;
  /** Davomat tarixi boshlangan kun ("YYYY-MM-DD"); tarix yo'q — `null`. */
  historyStart: string | null;
  deadlineMin: number;
  rows: TeacherAttRow[];
  totals: TeacherAttTotals;
  branches: { id: number; name: string }[];
}

/** Guruh maydonlari: dars vaqti va «bugun rejadami» tekshiruvi. */
export interface TeacherGroupMeta {
  id: number;
  time?: string | null;
  day?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  period?: string | null;
  archivedAt?: string | null;
}

/** Darsning birinchi belgisi yozilgan payt (Toshkent). */
export interface FirstMark {
  iso: string;
  min: number;
}

const norm = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

/** "DD.MM.YYYY | HH:mm" → { iso, min }; tanilmasa `null`. */
export function parseStamp(raw: unknown): FirstMark | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}) \| (\d{2}):(\d{2})$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  return { iso: `${m[3]}-${m[2]}-${m[1]}`, min: Number(m[4]) * 60 + Number(m[5]) };
}

/** Dars kunidagi muddat (daqiqa): tugash + `afterMin`, 23:59 dan oshmaydi; vaqti yo'q — 23:59. */
export function deadlineOf(time: string | null | undefined, afterMin: number): number {
  const r = parseTimeRange(String(time ?? ""));
  return r ? Math.min(r[1] + afterMin, LAST_MINUTE) : LAST_MINUTE;
}

/** Belgi muddatgacha qo'yilganmi (dars kunidan oldin qo'yilgani ham — vaqtida). */
export function markedOnTime(first: FirstMark, lessonIso: string, deadline: number): boolean {
  return first.iso < lessonIso || (first.iso === lessonIso && first.min <= deadline);
}

/** "YYYY-MM-DD" ning hafta kuni (0 = yakshanba). */
function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Bugun shu guruhning rejadagi dars kunimi — `computeAttendance` rejasi bilan bir xil chegaralar
 * (jadval kuni, boshlanish, tugash, arxiv sanasi). Boshlanish sanasi yo'q guruhda birinchi
 * a'zolik kuni olinadi — u bugundan keyin bo'lmaydi, shuning uchun tekshirilmaydi.
 */
function plannedToday(g: TeacherGroupMeta, today: string): boolean {
  if (!groupWeekdays(g.day ?? undefined).includes(weekdayOf(today))) return false;
  const start = groupStartIso(g);
  if (start && start > today) return false;
  const end = groupEndIso(g);
  if (end && end < today) return false;
  if ((g.status || "") === "archive") {
    const a = isoDateOrNull(g.archivedAt);
    if (a && a < today) return false;
  }
  return true;
}

export interface BuildInput {
  groups: readonly AttendanceGroupRow[];
  meta: ReadonlyMap<number, TeacherGroupMeta>;
  /** Guruh → belgisi bor kunlar. */
  markedDays: ReadonlyMap<number, ReadonlySet<string>>;
  /** `${groupId}|${date}` → birinchi belgi. */
  firstMarks: ReadonlyMap<string, FirstMark>;
  historyStart: string | null;
  /** Hisobot oxirgi kuni (bugundan oshmaydi). */
  to: string;
  today: string;
  /** Hozir, Toshkent bo'yicha kun boshidan daqiqa. */
  nowMin: number;
  afterMin: number;
}

/** Sof hisob (bazasiz) — sinov skriptlari ham shuni chaqiradi. */
export function buildTeacherRows(input: BuildInput): { rows: TeacherAttRow[]; totals: TeacherAttTotals } {
  const rows = new Map<string, TeacherAttRow & { _courses: Map<string, string> }>();
  const teacherKeys = new Set<string>();
  let pending = 0;
  for (const g of input.groups) {
    const meta = input.meta.get(g.id) ?? { id: g.id };
    const deadline = deadlineOf(meta.time, input.afterMin);
    const days = input.markedDays.get(g.id) ?? new Set<string>();

    let onTime = 0;
    let late = 0;
    let unknown = 0;
    for (const d of days) {
      const first = input.historyStart && d >= input.historyStart ? input.firstMarks.get(`${g.id}|${d}`) : undefined;
      if (!first) unknown += 1;
      else if (markedOnTime(first, d, deadline)) onTime += 1;
      else late += 1;
    }
    // Bugungi belgisiz dars muddati hali kelmagan bo'lsa — kutilmoqda (hisobdan chiqadi).
    let unmarked = g.unmarked;
    if (unmarked > 0 && input.to === input.today && !days.has(input.today) && input.nowMin < deadline && plannedToday(meta, input.today)) {
      unmarked -= 1;
      pending += 1;
    }

    const tKey = norm(g.teacher);
    const branchId = branchPool(g.branchId)[0];
    const key = `${branchId}|${tKey}`;
    teacherKeys.add(tKey);
    let r = rows.get(key);
    if (!r) {
      r = { key, teacher: g.teacher.trim(), branchId, courses: [], groups: 0, lessons: 0, onTime: 0, late: 0, unknown: 0, unmarked: 0, marks: 0, present: 0, _courses: new Map() };
      rows.set(key, r);
    }
    r.groups += 1;
    r.onTime += onTime;
    r.late += late;
    r.unknown += unknown;
    r.unmarked += unmarked;
    r.lessons += onTime + late + unknown + unmarked;
    r.marks += g.marks;
    r.present += g.present;
    const c = g.course.trim();
    if (c && !r._courses.has(norm(c))) r._courses.set(norm(c), c);
  }

  const out = [...rows.values()]
    .map(({ _courses, ...r }) => ({ ...r, courses: [..._courses.values()].sort((a, b) => a.localeCompare(b)) }))
    // Filial tartibi, ichida — muammosi ko'p o'qituvchi tepada (kechikib + belgilanmagan).
    .sort((a, b) => a.branchId - b.branchId || b.late + b.unmarked - (a.late + a.unmarked) || b.lessons - a.lessons || a.teacher.localeCompare(b.teacher));

  const totals = out.reduce<TeacherAttTotals>(
    (s, r) => ({
      lessons: s.lessons + r.lessons,
      onTime: s.onTime + r.onTime,
      late: s.late + r.late,
      unknown: s.unknown + r.unknown,
      unmarked: s.unmarked + r.unmarked,
      marks: s.marks + r.marks,
      present: s.present + r.present,
      groups: s.groups + r.groups,
      teachers: 0,
      pending: 0,
    }),
    { lessons: 0, onTime: 0, late: 0, unknown: 0, unmarked: 0, marks: 0, present: 0, groups: 0, teachers: 0, pending: 0 },
  );
  totals.teachers = teacherKeys.size;
  totals.pending = pending;
  return { rows: out, totals };
}

/** Toshkent bo'yicha hozirgi daqiqa (kun boshidan). */
function uzNowMin(nowMs: number): number {
  const u = toUz(new Date(nowMs));
  return u.getHours() * 60 + u.getMinutes();
}

export async function computeAttendanceTeachers(
  db: Db,
  branchIds: readonly number[],
  opts: { from: string; to: string; today: string; nowMs?: number },
): Promise<TeacherAttReport> {
  const nowMs = opts.nowMs ?? Date.now();
  const base = await computeAttendance(db, branchIds, { from: opts.from, to: opts.to, today: opts.today });
  const ids = base.groups.map((g) => g.id);

  const [meta, marked, firstHist, branches] = await Promise.all([
    ids.length
      ? db
          .collection<TeacherGroupMeta>("groups")
          .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, time: 1, day: 1, status: 1, startDate: 1, endDate: 1, period: 1, archivedAt: 1 } })
          .toArray()
      : Promise.resolve([] as TeacherGroupMeta[]),
    ids.length
      ? db
          .collection("attendance")
          .aggregate<{ _id: { g: number; d: string } }>([
            { $match: { groupId: { $in: ids }, date: { $gte: base.from, $lte: base.to } } },
            { $group: { _id: { g: "$groupId", d: "$date" } } },
          ])
          .toArray()
      : Promise.resolve([] as { _id: { g: number; d: string } }[]),
    db.collection<{ createdAt?: unknown }>("attendance_history").find({}, { projection: { _id: 0, createdAt: 1 } }).sort({ id: 1 }).limit(1).toArray(),
    db.collection<{ id: number; name?: string }>("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
  ]);
  const historyStart = parseStamp(firstHist[0]?.createdAt)?.iso ?? null;

  const markedDays = new Map<number, Set<string>>();
  for (const m of marked) {
    const set = markedDays.get(m._id.g);
    if (set) set.add(m._id.d);
    else markedDays.set(m._id.g, new Set([m._id.d]));
  }

  // Birinchi belgi: tarixdagi eng erta yozuv (o'chirish yozuvi — `status: null` — hisobga olinmaydi).
  const firstMarks = new Map<string, FirstMark>();
  const histFrom = historyStart && historyStart > base.from ? historyStart : base.from;
  if (ids.length && historyStart && histFrom <= base.to) {
    const hist = await db
      .collection<{ groupId: number; date: string; createdAt?: unknown; status?: unknown }>("attendance_history")
      .find({ groupId: { $in: ids }, date: { $gte: histFrom, $lte: base.to }, status: { $ne: null } }, { projection: { _id: 0, groupId: 1, date: 1, createdAt: 1 } })
      .toArray();
    for (const h of hist) {
      const at = parseStamp(h.createdAt);
      if (!at) continue;
      const k = `${h.groupId}|${h.date}`;
      const cur = firstMarks.get(k);
      if (!cur || at.iso < cur.iso || (at.iso === cur.iso && at.min < cur.min)) firstMarks.set(k, at);
    }
  }

  const { rows, totals } = buildTeacherRows({
    groups: base.groups,
    meta: new Map(meta.map((g) => [g.id, g])),
    markedDays,
    firstMarks,
    historyStart,
    to: base.to,
    today: opts.today,
    nowMin: opts.today === uzDateIso(new Date(nowMs)) ? uzNowMin(nowMs) : LAST_MINUTE + 1,
    afterMin: ON_TIME_AFTER_MIN,
  });
  const used = new Set(rows.map((r) => r.branchId));
  return {
    from: base.from,
    to: base.to,
    historyStart,
    deadlineMin: ON_TIME_AFTER_MIN,
    rows,
    totals,
    branches: branches.filter((b) => used.has(Number(b.id))).map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
  };
}
