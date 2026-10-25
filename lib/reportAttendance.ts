import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { groupWeekdays, toIsoDate, type AttendanceStatus } from "@/lib/attendance";
import { GROUP_MEMBERSHIPS, groupEndIso, groupStartIso, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";

// HISOBOTLAR → DAVOMAT (yangi versiya, 15-qism, 25.10.2026) — «Guruhlar bo'yicha» va
// «O'qituvchilar bo'yicha» uchun bitta hisob. Route'lar: app/api/reports/attendance-groups,
// app/api/reports/attendance-teachers.
//
// MANBA — `attendance` (Guruh → Bugungi dars yozadigan belgilar: keldi, kechikdi, birinchi,
// sababli, sababsiz). Qatnashish = (keldi + kechikdi + birinchi) / hamma belgi.
//
// REJADAGI DARSLAR — guruh jadvali (`groups.day`) bo'yicha dars kunlari; guruh FAOL bo'lgan
// kundan (guruh boshlanish sanasi, u yo'q bo'lsa — birinchi o'quvchisi qo'shilgan kun;
// a'zolik tarixi 20.09.2026 dan) bugungacha / guruh tugashi yoki arxivigacha. Shu bois
// guruh ochilmagan kunlar «belgilanmagan dars» bo'lib chiqmaydi (eski «Davomat
// qilinmagan guruhlar» sahifasi boshlanish sanasi yo'q guruhni umuman tashlab yuborardi).
// «Yig'ilayotgan» guruh darslari boshlanmagan — hisobga kirmaydi.

interface GroupDoc {
  id: number;
  name?: string;
  course?: string;
  level?: string;
  teacher?: string;
  day?: string;
  branchId?: number | null;
  status?: string;
  archivedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  period?: string | null;
}

interface MarkDoc {
  groupId: number;
  pupilId: number;
  date: string;
  status: AttendanceStatus | string;
}

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();
/** Guruh nomi (lib/groups.ts → groupLabel) — maydonlari bo'sh bo'lishi mumkin. */
const labelOfGroup = (g: GroupDoc) => groupLabel({ id: g.id, name: String(g.name ?? ""), course: String(g.course ?? "") });
const PRESENT = new Set(["keldi", "kechikdi", "birinchi"]);

function scheduleDates(day: string | undefined, from: string, to: string): string[] {
  const wd = groupWeekdays(day);
  if (wd.length === 0 || from > to) return [];
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = new Date(ty, tm - 1, td);
  for (const cur = new Date(y, m - 1, d); cur <= end; cur.setDate(cur.getDate() + 1)) if (wd.includes(cur.getDay())) out.push(toIsoDate(cur));
  return out;
}

export interface AttendanceGroupRow {
  id: number;
  label: string;
  course: string;
  level: string;
  teacher: string;
  branchId: number;
  /** Rejadagi darslar (oraliq ichida, bugungacha). */
  scheduled: number;
  /** Davomat belgilangan darslar (kunlar). */
  marked: number;
  /** Rejada bo'lib, belgilanmagan darslar. */
  unmarked: number;
  /** Belgilar soni (o'quvchi × dars). */
  marks: number;
  present: number;
  late: number;
  excused: number;
  unexcused: number;
  /** Qatnashish (0..1); belgi yo'q — null. */
  rate: number | null;
  /** Oxirgi belgilangan dars ("YYYY-MM-DD"). */
  lastMarked: string | null;
  /** Jadval tanilmagan — rejadagi darslarni sanab bo'lmadi. */
  noSchedule: boolean;
}

export interface AttendanceTeacherRow {
  teacher: string;
  groups: number;
  scheduled: number;
  marked: number;
  unmarked: number;
  /** Belgilangan / rejada (0..1); rejada dars yo'q — null. */
  journal: number | null;
  /** O'quvchilar qatnashishi (0..1). */
  rate: number | null;
  lastMarked: string | null;
}

export interface AttendanceReport {
  from: string;
  to: string;
  historyStart: string;
  groups: AttendanceGroupRow[];
  teachers: AttendanceTeacherRow[];
  totals: { scheduled: number; marked: number; unmarked: number; marks: number; present: number; late: number; excused: number; unexcused: number; rate: number | null };
  courses: string[];
}

export async function computeAttendance(
  db: Db,
  branchIds: readonly number[],
  opts: { from: string; to: string; course?: string; today: string },
): Promise<AttendanceReport> {
  const to = opts.to > opts.today ? opts.today : opts.to;
  const from = opts.from > to ? to : opts.from;
  const courseKey = norm(opts.course);

  const all = await db
    .collection<GroupDoc>("groups")
    .find(branchInCondition(branchIds), {
      projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, day: 1, branchId: 1, status: 1, archivedAt: 1, startDate: 1, endDate: 1, period: 1 },
    })
    .toArray();
  const courses = [...new Map(all.filter((g) => (g.status || "") !== "archive" && String(g.course ?? "").trim()).map((g) => [norm(g.course), String(g.course).trim()])).values()].sort((a, b) => a.localeCompare(b));
  const groups = all.filter((g) => (g.status || "") !== "gathering" && (!courseKey || norm(g.course) === courseKey));
  const ids = groups.map((g) => g.id);

  const [memberships, first, marks] = await Promise.all([
    ids.length
      ? db.collection<GroupMembership>(GROUP_MEMBERSHIPS).find({ groupId: { $in: ids } }, { projection: { _id: 0, groupId: 1, joinedAt: 1 } }).toArray()
      : Promise.resolve([] as Pick<GroupMembership, "groupId" | "joinedAt">[]),
    db.collection<{ createdAt?: unknown }>(GROUP_MEMBERSHIPS).find({}, { projection: { _id: 0, createdAt: 1 } }).sort({ _id: 1 }).limit(1).toArray(),
    ids.length
      ? db
          .collection<MarkDoc>("attendance")
          .find({ groupId: { $in: ids }, date: { $gte: from, $lte: to } }, { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1, status: 1 } })
          .toArray()
      : Promise.resolve([] as MarkDoc[]),
  ]);
  const created = first[0]?.createdAt;
  const createdDate = created instanceof Date ? created : typeof created === "string" ? new Date(created) : null;
  const historyStart = createdDate && !Number.isNaN(createdDate.getTime()) ? new Date(createdDate.getTime() + 5 * 3600_000).toISOString().slice(0, 10) : opts.today;

  // Guruh qachondan faol: boshlanish sanasi, bo'lmasa birinchi a'zolik (backfill — tarix boshi).
  const firstMember = new Map<number, string>();
  for (const m of memberships) {
    const d = isoDateOrNull(m.joinedAt) ?? historyStart;
    const prev = firstMember.get(m.groupId);
    if (!prev || d < prev) firstMember.set(m.groupId, d);
  }
  const marksBy = new Map<number, MarkDoc[]>();
  for (const mk of marks) {
    const list = marksBy.get(mk.groupId);
    if (list) list.push(mk);
    else marksBy.set(mk.groupId, [mk]);
  }

  const rows: AttendanceGroupRow[] = [];
  for (const g of groups) {
    const gm = marksBy.get(g.id) ?? [];
    const start = groupStartIso(g) ?? firstMember.get(g.id) ?? null;
    const endBounds = [to, groupEndIso(g), (g.status || "") === "archive" ? isoDateOrNull(g.archivedAt) : null].filter((x): x is string => !!x);
    const end = endBounds.reduce((a, b) => (b < a ? b : a));
    const noSchedule = groupWeekdays(g.day).length === 0;
    const plan = start ? scheduleDates(g.day, start > from ? start : from, end) : [];
    // Arxivlangan va oraliqda hech narsasi yo'q guruh — ro'yxatga kirmaydi.
    if ((g.status || "") === "archive" && plan.length === 0 && gm.length === 0) continue;
    if (!start && gm.length === 0) continue;

    const markedDays = new Set(gm.map((m) => m.date));
    const planSet = new Set(plan);
    let unmarked = 0;
    for (const d of planSet) if (!markedDays.has(d)) unmarked += 1;
    let present = 0;
    let late = 0;
    let excused = 0;
    let unexcused = 0;
    for (const m of gm) {
      if (PRESENT.has(m.status)) present += 1;
      if (m.status === "kechikdi") late += 1;
      if (m.status === "sababli") excused += 1;
      if (m.status === "sababsiz") unexcused += 1;
    }
    const lastMarked = gm.reduce<string | null>((a, m) => (a === null || m.date > a ? m.date : a), null);
    rows.push({
      id: g.id,
      label: labelOfGroup(g),
      course: String(g.course ?? "").trim(),
      level: String(g.level ?? "").trim(),
      teacher: String(g.teacher ?? "").trim(),
      branchId: Number(g.branchId) || 1,
      scheduled: plan.length,
      marked: markedDays.size,
      unmarked,
      marks: gm.length,
      present,
      late,
      excused,
      unexcused,
      rate: gm.length ? present / gm.length : null,
      lastMarked,
      noSchedule,
    });
  }
  rows.sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.unmarked - a.unmarked || a.label.localeCompare(b.label));

  const byTeacher = new Map<string, AttendanceTeacherRow & { _marks: number; _present: number }>();
  for (const r of rows) {
    const key = norm(r.teacher) || "—";
    let t = byTeacher.get(key);
    if (!t) byTeacher.set(key, (t = { teacher: r.teacher || "—", groups: 0, scheduled: 0, marked: 0, unmarked: 0, journal: null, rate: null, lastMarked: null, _marks: 0, _present: 0 }));
    t.groups += 1;
    t.scheduled += r.scheduled;
    t.marked += r.marked;
    t.unmarked += r.unmarked;
    t._marks += r.marks;
    t._present += r.present;
    if (r.lastMarked && (!t.lastMarked || r.lastMarked > t.lastMarked)) t.lastMarked = r.lastMarked;
  }
  const teachers = [...byTeacher.values()]
    .map(({ _marks, _present, ...t }) => ({
      ...t,
      journal: t.scheduled ? Math.min(1, (t.scheduled - t.unmarked) / t.scheduled) : null,
      rate: _marks ? _present / _marks : null,
    }))
    .sort((a, b) => (a.journal ?? 2) - (b.journal ?? 2) || b.unmarked - a.unmarked || a.teacher.localeCompare(b.teacher));

  const totals = rows.reduce(
    (s, r) => ({
      scheduled: s.scheduled + r.scheduled,
      marked: s.marked + r.marked,
      unmarked: s.unmarked + r.unmarked,
      marks: s.marks + r.marks,
      present: s.present + r.present,
      late: s.late + r.late,
      excused: s.excused + r.excused,
      unexcused: s.unexcused + r.unexcused,
      rate: null as number | null,
    }),
    { scheduled: 0, marked: 0, unmarked: 0, marks: 0, present: 0, late: 0, excused: 0, unexcused: 0, rate: null as number | null },
  );
  totals.rate = totals.marks ? totals.present / totals.marks : null;
  return { from, to, historyStart, groups: rows, teachers, totals, courses };
}
