import type { Db } from "mongodb";
import { cameStatus, isFrozenPupil, type AttendanceMark, type AttendanceStatus } from "@/lib/attendance";
import { saveAttendanceMark } from "@/lib/attendanceWrite";
import { withPupilBranch, type BranchScope } from "@/lib/branchScope";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import type { GamActor } from "@/lib/gamification/actor";
import { branchNames, isOwnGroup } from "@/lib/gamification/scope";
import { GROUP_MEMBERSHIPS, type GroupMembership } from "@/lib/groupMembership";
import { lessonExpectedOn, parseTimeRange } from "@/lib/groupRules";
import { groupLabel, type Group } from "@/lib/groups";
import { toUz, uzDateIso } from "@/lib/uzTime";

// USTOZ DARSLARI — XODIMLAR BOTIDAN DAVOMAT (05.11.2026). Egasi: «o'qituvchilar
// o'z o'quvchilarini botdan turib davomat qilish imkoniyati bo'lishi kerak …
// profilim bo'limida bo'lishi kerak».
//
// Mini App (components/employees/StaffLessonsTg.tsx → app/api/xodim/dars) va
// bot eslatmalari (lib/staffBot/dayReminders.ts) shu yerdan o'qiydi. Yozish —
// saytdagi bilan BITTA yadro (lib/attendanceWrite.ts): tarix, tanga va
// o'quvchiga xabar o'zgarishsiz ishlaydi.
//
// KIMNING GURUHI: `groups.teacher` ISM bo'yicha (teacherId yo'q), gamifikatsiya
// qoidasi bilan bir xil — isOwnGroup. Yordamchi ustoz (`assistant`) kirmaydi:
// saytda ham davomatni guruh ustozi belgilaydi.
//
// FAQAT BUGUN: sana klientdan olinmaydi. O'tgan darsni tuzatish — saytda,
// filial admini orqali (lib/gamification/attendance.ts → attendanceEditDenial).
//
// RO'YXAT saytdagi «Bugungi dars» bilan bir xil: belgisi borlar + muzlatilmagan,
// shu kungacha guruhga qo'shilganlar (TodayLessonTab.tsx).

/** Darsdan necha daqiqa oldin ustozga xabar ketadi. */
export const LESSON_REMINDER_MIN = 10;

export type LessonGroup = Pick<
  Group,
  "id" | "name" | "course" | "level" | "day" | "time" | "period" | "status" | "teacher" | "room" | "startDate" | "endDate" | "studentIds"
> & { branchId?: number | null };

export const LESSON_GROUP_FIELDS = {
  _id: 0,
  id: 1,
  name: 1,
  course: 1,
  level: 1,
  day: 1,
  time: 1,
  period: 1,
  status: 1,
  teacher: 1,
  room: 1,
  startDate: 1,
  endDate: 1,
  studentIds: 1,
  branchId: 1,
} as const;

/** Toshkent bo'yicha hozirgi lahza. */
export interface UzClock {
  /** "YYYY-MM-DD". */
  iso: string;
  /** JS `getDay()`: 0 = yakshanba. */
  weekday: number;
  /** Kun boshidan daqiqa. */
  nowMin: number;
}

export function uzClock(nowMs: number): UzClock {
  const now = new Date(nowMs);
  const u = toUz(now);
  return { iso: uzDateIso(now), weekday: u.getDay(), nowMin: u.getHours() * 60 + u.getMinutes() };
}

/** Darsi `beforeMin` daqiqa ichida boshlanadigan guruhlar: [boshlanish − beforeMin, boshlanish). */
export function lessonsStartingSoon<G extends Pick<LessonGroup, "status" | "day" | "startDate" | "endDate" | "period" | "time">>(
  groups: readonly G[],
  clock: UzClock,
  beforeMin: number = LESSON_REMINDER_MIN,
): G[] {
  return groups.filter((g) => {
    if (!lessonExpectedOn(g, clock.iso, clock.weekday)) return false;
    const range = parseTimeRange(g.time);
    return !!range && clock.nowMin >= range[0] - beforeMin && clock.nowMin < range[0];
  });
}

/** Kun oxiri: 23:55 da tugagan darsning muddati ertangi kunga o'tib ketmasin. */
const LAST_MINUTE = 23 * 60 + 59;

/**
 * Darsi tugab, ustiga `afterMin` daqiqa o'tgan guruhlar. Muddati `sinceMin` daqiqasigacha
 * kelib bo'lganlari kirmaydi (lib/attendanceAlert.ts → `since`).
 */
export function lessonsEndedBy<G extends Pick<LessonGroup, "status" | "day" | "startDate" | "endDate" | "period" | "time">>(
  groups: readonly G[],
  clock: UzClock,
  afterMin: number,
  sinceMin: number = -1,
): G[] {
  return groups.filter((g) => {
    if (!lessonExpectedOn(g, clock.iso, clock.weekday)) return false;
    const range = parseTimeRange(g.time);
    if (!range) return false;
    const due = Math.min(range[1] + afterMin, LAST_MINUTE);
    return clock.nowMin >= due && due > sinceMin;
  });
}

/**
 * Darsi boshlanib, ustiga `afterMin` daqiqa o'tgan va hali TUGAMAGAN guruhlar. Muddati `sinceMin`
 * daqiqasigacha kelib bo'lganlari kirmaydi (lib/attendanceAlert.ts → `since`). Dars tugagach
 * kirmaydi: server o'chib qolib, kechqurun yoqilsa ertalabgi «hali kelmadi» xabarlari yog'ilmasin.
 */
export function lessonsStartedBy<G extends Pick<LessonGroup, "status" | "day" | "startDate" | "endDate" | "period" | "time">>(
  groups: readonly G[],
  clock: UzClock,
  afterMin: number,
  sinceMin: number = -1,
): G[] {
  return groups.filter((g) => {
    if (!lessonExpectedOn(g, clock.iso, clock.weekday)) return false;
    const range = parseTimeRange(g.time);
    if (!range) return false;
    const due = range[0] + afterMin;
    return clock.nowMin >= due && clock.nowMin < range[1] && due > sinceMin;
  });
}

const hm = (n: number) => String(n).padStart(2, "0");

/** "14:00 - 15:30" → "14:00"; vaqt kiritilmagan bo'lsa "". */
function lessonStart(time: string): string {
  const range = parseTimeRange(time);
  return range ? `${hm(Math.floor(range[0] / 60))}:${hm(range[0] % 60)}` : "";
}

/** Guruh o'z filiali doirasida — xodimning «joriy filiali» yo'q (Mini App sessiyasiz). */
function groupScope(g: { branchId?: number | null }): BranchScope {
  const n = Number(g.branchId);
  const branchId = g.branchId !== null && g.branchId !== undefined && Number.isFinite(n) ? n : 1;
  return { branchId, allowed: [branchId], isAdmin: false };
}

/** Guruh filiali (bazada bo'sh bo'lsa — 1-filial). */
export const lessonBranchId = (g: { branchId?: number | null }): number => groupScope(g).branchId;

type SavedMark = Pick<AttendanceMark, "status" | "grade" | "reason" | "note">;

interface RosterRow {
  id: number;
  name: string;
  mark: SavedMark | null;
}

async function rosterOf(db: Db, g: LessonGroup, iso: string): Promise<RosterRow[]> {
  const ids = g.studentIds ?? [];
  if (!ids.length) return [];
  const [pupils, memberships, marks] = await Promise.all([
    db
      .collection("pupils")
      .find(withPupilBranch({ id: { $in: ids } }, groupScope(g)), { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1 } })
      .toArray(),
    db
      .collection<GroupMembership>(GROUP_MEMBERSHIPS)
      .find({ groupId: g.id, pupilId: { $in: ids }, leftAt: null }, { projection: { _id: 0, pupilId: 1, joinedAt: 1 } })
      .toArray(),
    db
      .collection<AttendanceMark>("attendance")
      .find({ groupId: g.id, date: iso }, { projection: { _id: 0, pupilId: 1, status: 1, grade: 1, reason: 1, note: 1 } })
      .toArray(),
  ]);
  const joinedAt = new Map(memberships.map((m) => [m.pupilId, m.joinedAt]));
  const saved = new Map(marks.map((m) => [m.pupilId, m]));
  return pupils
    .filter((p) => {
      const joined = joinedAt.get(Number(p.id));
      return saved.has(Number(p.id)) || (!isFrozenPupil(p.status) && (!joined || joined <= iso));
    })
    .map((p) => ({
      id: Number(p.id),
      name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
      mark: saved.get(Number(p.id)) ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));
}

export interface TeacherLesson {
  groupId: number;
  title: string;
  level: string;
  day: string;
  time: string;
  /** Boshlanishi, "HH:MM" ("" — vaqt kiritilmagan). */
  start: string;
  room: string;
  branch: string;
  /** Dars ro'yxatidagi o'quvchilar. */
  pupils: number;
  /** Shulardan davomati belgilangani. */
  marked: number;
}

function toLesson(g: LessonGroup, roster: RosterRow[], branch: string): TeacherLesson {
  return {
    groupId: g.id,
    title: groupLabel(g),
    level: String(g.level ?? "").trim(),
    day: String(g.day ?? "").trim(),
    time: String(g.time ?? "").trim(),
    start: lessonStart(g.time),
    room: String(g.room ?? "").trim(),
    branch,
    pupils: roster.length,
    marked: roster.filter((r) => r.mark).length,
  };
}

/** Bitta guruhning bugungi darsi — xabar matni va ro'yxat uchun. */
export async function describeLesson(db: Db, g: LessonGroup, iso: string, branches: Map<number, string>): Promise<TeacherLesson> {
  return toLesson(g, await rosterOf(db, g, iso), branches.get(groupScope(g).branchId) ?? "");
}

type Teacher = { id: number; name: string };

const asTeacher = (emp: Teacher) => ({ role: "teacher" as const, name: emp.name });

export interface TodayLessons {
  date: string;
  /** Xodimga umuman guruh biriktirilganmi — yo'q bo'lsa Mini App bo'limni ko'rsatmaydi. */
  hasGroups: boolean;
  lessons: TeacherLesson[];
}

export async function loadTodayLessons(db: Db, emp: Teacher, nowMs: number = Date.now()): Promise<TodayLessons> {
  const clock = uzClock(nowMs);
  const active = await db.collection<LessonGroup>("groups").find({ status: "active" }, { projection: LESSON_GROUP_FIELDS }).toArray();
  const mine = active.filter((g) => isOwnGroup(asTeacher(emp), g));
  const today = mine.filter((g) => lessonExpectedOn(g, clock.iso, clock.weekday));
  const branches = today.length ? await branchNames(db) : new Map<number, string>();
  const lessons = await Promise.all(today.map((g) => describeLesson(db, g, clock.iso, branches)));
  lessons.sort((a, b) => a.start.localeCompare(b.start) || a.groupId - b.groupId);
  return { date: clock.iso, hasGroups: mine.length > 0, lessons };
}

type Denied = { ok: false; status: 403 | 404 | 409; error: string };

/** Guruh shu ustozniki va bugun darsi bor. */
async function ownLessonToday(db: Db, emp: Teacher, groupId: number, nowMs: number): Promise<{ ok: true; group: LessonGroup; iso: string } | Denied> {
  const group = await db.collection<LessonGroup>("groups").findOne({ id: groupId }, { projection: LESSON_GROUP_FIELDS });
  if (!group) return { ok: false, status: 404, error: "Guruh topilmadi" };
  if (!isOwnGroup(asTeacher(emp), group)) return { ok: false, status: 403, error: "Bu guruh sizga biriktirilmagan" };
  const clock = uzClock(nowMs);
  if (!lessonExpectedOn(group, clock.iso, clock.weekday)) return { ok: false, status: 409, error: "Bu guruhda bugun dars yo'q" };
  return { ok: true, group, iso: clock.iso };
}

export interface LessonPupil {
  id: number;
  name: string;
  /** Saqlangan belgi; `null` — hali belgilanmagan. */
  status: AttendanceStatus | null;
  note: string;
}

export interface LessonSheet {
  date: string;
  lesson: TeacherLesson;
  pupils: LessonPupil[];
}

async function buildSheet(db: Db, g: LessonGroup, iso: string): Promise<LessonSheet> {
  const [roster, branches] = await Promise.all([rosterOf(db, g, iso), branchNames(db)]);
  return {
    date: iso,
    lesson: toLesson(g, roster, branches.get(groupScope(g).branchId) ?? ""),
    pupils: roster.map((r) => ({ id: r.id, name: r.name, status: r.mark?.status ?? null, note: r.mark?.note ?? "" })),
  };
}

export async function loadLessonSheet(
  db: Db,
  emp: Teacher,
  groupId: number,
  nowMs: number = Date.now(),
): Promise<{ ok: true; sheet: LessonSheet } | Denied> {
  const own = await ownLessonToday(db, emp, groupId, nowMs);
  if (!own.ok) return own;
  return { ok: true, sheet: await buildSheet(db, own.group, own.iso) };
}

/** Mini App'dagi uch tugma (saytdagi «Bugungi dars» bilan bir xil). */
export type LessonMarkStatus = "keldi" | "sababsiz" | "sababli";

export interface LessonMarkInput {
  pupilId: number;
  status: LessonMarkStatus;
  note: string;
}

/**
 * Gamifikatsiya cheklovi va tanga yozuvi uchun amal egasi. Sessiya yo'q — ustoz
 * ekani shu yergacha tekshirilgan (ownLessonToday). Sayt hisobi bo'lmasa
 * `userId` bo'sh: raqam ulashib kirgan ustozda `users` yozuvi yo'q.
 */
async function teacherActor(db: Db, emp: Teacher): Promise<GamActor> {
  const account = await db.collection("users").findOne({ hrEmployeeId: emp.id }, { projection: { _id: 1 } });
  return { role: "teacher", userId: account ? String(account._id) : "", name: emp.name, employeeId: emp.id, branchIds: [] };
}

export type SaveLessonResult =
  | { ok: true; date: string; branchId: number; saved: number; failed: { pupilId: number; error: string }[]; sheet: LessonSheet }
  | Denied;

/**
 * O'zgargan belgilarni saqlaydi. Tartibi saytdagi kabi (TodayLessonTab → bodyOf):
 * baho saqlanadi; kechikdi / birinchi dars «Keldi» bo'lib ko'rinadi va
 * o'zgartirilmasa qoladi; sabab faqat oldin ham sababli bo'lsa; izoh — darsda
 * yo'qlarga. Bittasi xato bersa qolganlari yoziladi (bitta-bitta, tarix
 * id'lari ketma-ket bo'lsin).
 */
export async function saveLessonMarks(
  db: Db,
  emp: Teacher,
  groupId: number,
  marks: readonly LessonMarkInput[],
  deps: AdjustDeps,
  nowMs: number = Date.now(),
): Promise<SaveLessonResult> {
  const own = await ownLessonToday(db, emp, groupId, nowMs);
  if (!own.ok) return own;
  const { group, iso } = own;
  const [roster, actor] = await Promise.all([rosterOf(db, group, iso), teacherActor(db, emp)]);
  const byId = new Map(roster.map((r) => [r.id, r]));
  const scope = groupScope(group);

  let saved = 0;
  const failed: { pupilId: number; error: string }[] = [];
  for (const m of marks) {
    const row = byId.get(m.pupilId);
    if (!row) {
      failed.push({ pupilId: m.pupilId, error: "O'quvchi bu guruhda emas" });
      continue;
    }
    const prev = row.mark;
    const status: AttendanceStatus = m.status === "keldi" && prev && cameStatus(prev.status) ? prev.status : m.status;
    const res = await saveAttendanceMark(
      db,
      scope,
      {
        groupId,
        pupilId: m.pupilId,
        date: iso,
        status,
        grade: prev?.grade ?? null,
        reason: status === "sababli" && prev?.status === "sababli" ? (prev.reason ?? null) : null,
        note: cameStatus(status) ? null : m.note.trim() || null,
      },
      emp.name,
      deps,
      actor,
    );
    if (res.ok) saved += 1;
    else failed.push({ pupilId: m.pupilId, error: res.error });
  }
  return { ok: true, date: iso, branchId: scope.branchId, saved, failed, sheet: await buildSheet(db, group, iso) };
}
