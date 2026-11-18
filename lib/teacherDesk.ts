import type { Db } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import { cameStatus, groupWeekdays, type AttendanceStatus } from "@/lib/attendance";
import { GAM } from "@/lib/gamification/db";
import { loadSettings as loadGamSettings } from "@/lib/gamification/settings";
import { groupLabel, type Group } from "@/lib/groups";
import { formatDeadline } from "@/lib/groupTasks";
import { loadCollectedByTeacher, loadPaidByEmployee, loadPercentByTier, resolvePercent } from "@/lib/payrollSources";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// O'QITUVCHI ISH STOLI (45-qism, rasmlar «O'qituvchi · bosh sahifa», «dars oynasi», «uy vazifasini tekshirish»,
// «guruhlarim»). Kim — `hr_employees.turi = "teacher"` xodimi; guruhlari — `groups.teacher` ismi bilan (gamifikatsiya
// lib/gamification/scope.ts → isOwnGroup bilan bir xil qoida). Rahbar (admin) istalgan o'qituvchi ko'rinishini
// `?teacher=ISM` bilan ko'radi (faqat ko'rish uchun emas — admin hamma guruhda yozishi mumkin, qolgan joylardagi kabi).
//
// YANGI KOLLEKSIYALAR:
//   lesson_topics  {groupId, date, topic, note, by, at}            — dars mavzusi (kurs dasturi tizimda yo'q: erkin matn)
//   lesson_closes  {groupId, date, at, by}                          — «Darsni yakunlash»
//   task_checks    {taskId, groupId, pupilId, done, score, note, at, by, coin} — uy vazifasini tekshirish (✓/✗, ball)
// Uy vazifasi — mavjud `group_tasks` (Guruh → Topshiriqlar bilan bir xil yozuv). Tanga — gamifikatsiya API'lari
// (davomat, faollik, uy vazifasi ✓/✗ — lib/gamification/lesson.ts), shu yerda alohida tanga yozilmaydi.

export const LESSON_TOPICS = "lesson_topics";
export const LESSON_CLOSES = "lesson_closes";
export const TASK_CHECKS = "task_checks";
const SETTINGS_KEY = "teacher_desk";

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[ʻʼ`‘’']/g, "")
    .replace(/\s+/g, " ")
    .trim();

export interface TeacherWho {
  name: string;
  employeeId: number | null;
  /** Rahbar boshqa o'qituvchi ko'rinishini ochgan. */
  preview: boolean;
}

/** O'qituvchi — o'zi; admin — `?teacher=` (bo'lmasa birinchi guruh o'qituvchisi). Boshqalar — null. */
export async function resolveTeacher(db: Db, user: CurrentUser, asName?: string | null): Promise<TeacherWho | null> {
  if (user.role === "admin") {
    let name = String(asName ?? "").trim();
    if (!name) {
      const g = await db.collection("groups").findOne({ status: "active", teacher: { $nin: ["", null] } }, { projection: { _id: 0, teacher: 1 }, sort: { id: 1 } });
      name = String(g?.teacher ?? "").trim();
    }
    if (!name) return null;
    const emp = await db.collection("hr_employees").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
    const e = emp.find((x) => norm(x.name) === norm(name));
    return { name, employeeId: e ? Number(e.id) : null, preview: true };
  }
  if (user.hrEmployeeId === null) return null;
  const emp = await db.collection("hr_employees").findOne({ id: user.hrEmployeeId }, { projection: { _id: 0, id: 1, name: 1, turi: 1 } });
  if (!emp || emp.turi !== "teacher") return null;
  return { name: String(emp.name ?? "").trim() || user.fullName, employeeId: Number(emp.id), preview: false };
}

export interface DeskSettings {
  /** «Yangi vazifadan oldin o'tgan vazifani baholash» (rahbar sozlamasi). */
  requireCheck: boolean;
}
export async function loadDeskSettings(db: Db): Promise<DeskSettings> {
  const d = await db.collection("app_settings").findOne({ key: SETTINGS_KEY }, { projection: { _id: 0, requireCheck: 1 } });
  return { requireCheck: d?.requireCheck === true };
}

interface TGroup {
  id: number;
  title: string;
  label: string;
  course: string;
  level: string;
  room: string;
  day: string;
  weekdays: number[];
  start: string;
  end: string;
  branchId: number;
}

function toTGroup(g: Group & { branchId?: number }): TGroup {
  const [start = "", end = ""] = String(g.time ?? "").split("-").map((x) => x.trim());
  const course = String(g.course ?? "").trim();
  const level = String(g.level ?? "").trim();
  return {
    id: Number(g.id),
    title: course && level ? `${course} · ${level}` : groupLabel(g),
    label: groupLabel(g),
    course,
    level,
    room: String(g.room ?? ""),
    day: String(g.day ?? ""),
    weekdays: groupWeekdays(g.day),
    start,
    end,
    branchId: Number(g.branchId) || 1,
  };
}

export async function teacherGroups(db: Db, name: string): Promise<TGroup[]> {
  const rows = (await db.collection("groups").find({ status: "active" }, { projection: { _id: 0 } }).sort({ id: 1 }).toArray()) as unknown as Group[];
  return rows.filter((g) => norm(g.teacher) === norm(name)).map(toTGroup);
}

async function members(db: Db, groupIds: number[]) {
  const mem = await db.collection("group_memberships").find({ groupId: { $in: groupIds }, leftAt: null }, { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1 } }).toArray();
  const pupils = (await db
    .collection("pupils")
    .find({ id: { $in: [...new Set(mem.map((m) => Number(m.pupilId)))] } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1 } })
    .toArray()) as unknown as Pupil[];
  const byId = new Map(pupils.map((p) => [Number(p.id), p]));
  return mem
    .filter((m) => byId.has(Number(m.pupilId)))
    .map((m) => ({ groupId: Number(m.groupId), pupilId: Number(m.pupilId), name: pupilFullName(byId.get(Number(m.pupilId))!) }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));
}

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
/** «12.11.2026 | 18:00» → «2026-11-12». */
export function deadlineIso(s: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}/.test(String(s)) ? String(s).slice(0, 10) : null;
}
const createdIso = (s: string) => deadlineIso(s);

async function lessonNoOf(db: Db, groupId: number, date: string): Promise<number> {
  const dates = await db.collection("attendance").distinct("date", { groupId, date: { $lt: date } });
  return dates.length + 1;
}

/** Guruhning vazifalari (eng yangisi birinchi) + tekshiruvlar. */
async function tasksWithChecks(db: Db, groupIds: number[], sinceIso: string) {
  const tasks = (await db.collection("group_tasks").find({ groupId: { $in: groupIds }, type: { $ne: "Manba" } }, { projection: { _id: 0 } }).sort({ id: -1 }).toArray()).filter((t) => {
    const c = createdIso(String(t.createdAt ?? "")) ?? deadlineIso(String(t.deadline ?? "")) ?? "";
    return c >= sinceIso;
  });
  const checks = tasks.length ? await db.collection(TASK_CHECKS).find({ taskId: { $in: tasks.map((t) => Number(t.id)) } }, { projection: { _id: 0 } }).toArray() : [];
  return { tasks, checks };
}

// ─────────────────────────────── Bosh sahifa ───────────────────────────────

export async function teacherHome(db: Db, who: TeacherWho) {
  const today = uzDateIso();
  const now = uzTimeHm();
  const month = today.slice(0, 7);
  const groups = await teacherGroups(db, who.name);
  const gids = groups.map((g) => g.id);
  const [mem, gam, att, topics, closes, keldim, staffTasks] = await Promise.all([
    members(db, gids),
    loadGamSettings(db).catch(() => null),
    db.collection("attendance").find({ groupId: { $in: gids }, date: today }, { projection: { _id: 0, groupId: 1, pupilId: 1, status: 1, updatedAt: 1, createdAt: 1 } }).toArray(),
    db.collection(LESSON_TOPICS).find({ groupId: { $in: gids }, date: today }, { projection: { _id: 0 } }).toArray(),
    db.collection(LESSON_CLOSES).find({ groupId: { $in: gids }, date: today }, { projection: { _id: 0 } }).toArray(),
    who.employeeId !== null
      ? db.collection("turnstile_io").findOne({ date: today, employeeId: who.employeeId, personType: "employee" }, { projection: { _id: 0, enterTime: 1, status: 1, lateMinutes: 1, source: 1 } })
      : null,
    who.employeeId !== null
      ? db.collection("staff_tasks").find({ employeeId: who.employeeId, status: { $in: ["yangi", "qaytarildi", "muddati_otdi"] } }, { projection: { _id: 0, id: 1, title: 1, deadline: 1, createdByName: 1, status: 1 } }).sort({ deadline: 1 }).limit(5).toArray()
      : [],
  ]);
  const { tasks, checks } = await tasksWithChecks(db, gids, addDays(today, -30));
  const activity = gids.length
    ? await db.collection(GAM.tx).aggregate([{ $match: { groupId: { $in: gids }, date: today, status: "active", type: "activity" } }, { $group: { _id: "$groupId", s: { $sum: "$amount" } } }]).toArray()
    : [];

  // Tekshirilmagan ishlar: har vazifa — guruh a'zolari − tekshirilganlar.
  const pendingTasks = tasks
    .map((t) => {
      const g = groups.find((x) => x.id === Number(t.groupId));
      const pupils = mem.filter((m) => m.groupId === Number(t.groupId));
      const done = checks.filter((c) => Number(c.taskId) === Number(t.id));
      return {
        id: Number(t.id),
        groupId: Number(t.groupId),
        group: g?.title ?? String(t.groupName ?? ""),
        level: g?.level ?? "",
        name: String(t.name ?? ""),
        note: String(t.note ?? ""),
        deadline: deadlineIso(String(t.deadline ?? "")),
        deadlineText: String(t.deadline ?? ""),
        total: pupils.length,
        checked: done.length,
        left: Math.max(0, pupils.length - done.length),
      };
    })
    .filter((t) => t.left > 0 && (t.deadline ?? today) <= addDays(today, 1));

  const wd = weekdayOf(today);
  const lessons = groups
    .filter((g) => g.weekdays.includes(wd))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((g) => {
      const marks = att.filter((a) => Number(a.groupId) === g.id);
      const came = marks.filter((a) => cameStatus(a.status as AttendanceStatus)).length;
      const topic = topics.find((x) => Number(x.groupId) === g.id) ?? null;
      const hwToday = tasks.find((t) => Number(t.groupId) === g.id && createdIso(String(t.createdAt ?? "")) === today) ?? null;
      const prevPending = pendingTasks.find((t) => t.groupId === g.id && t.deadline !== null && t.deadline <= today) ?? null;
      const state = g.end && now >= g.end ? "tugadi" : g.start && now >= g.start ? "hozir" : "keyin";
      return {
        groupId: g.id,
        title: g.title,
        course: g.course,
        room: g.room,
        start: g.start,
        end: g.end,
        pupils: mem.filter((m) => m.groupId === g.id).length,
        state,
        minutesFromStart: g.start ? toMin(now) - toMin(g.start) : null,
        closed: closes.some((c) => Number(c.groupId) === g.id),
        attendance: { marked: marks.length, came },
        topic: topic ? String(topic.topic ?? "") : null,
        homework: hwToday ? String(hwToday.name ?? "") : null,
        prevPending: prevPending ? prevPending.left : 0,
        activity: Number(activity.find((a) => Number(a._id) === g.id)?.s ?? 0),
        activityLimit: gam?.activityGroupLimitPerLesson ?? 0,
      };
    });

  // Keyingi dars kuni (bugun darsi yo'q yoki tugagan bo'lsa ma'lumot qatori uchun).
  let nextDay: { date: string; items: { title: string; start: string }[] } | null = null;
  for (let i = 1; i <= 7 && !nextDay; i++) {
    const d = addDays(today, i);
    const items = groups.filter((g) => g.weekdays.includes(weekdayOf(d))).map((g) => ({ title: g.title, start: g.start }));
    if (items.length) nextDay = { date: d, items: items.sort((a, b) => a.start.localeCompare(b.start)) };
  }

  // Birinchi darsga keladiganlar (shu hafta, o'z guruhlariga).
  const leads = gids.length
    ? await db
        .collection("orders")
        .find({ firstLessonGroupId: { $in: gids }, firstLessonStatus: { $ne: "GURUHGA_QOSHILDI" }, groupId: { $in: [null, 0] } }, { projection: { _id: 0, id: 1, name: 1, firstLesson: 1, firstLessonGroupId: 1, referralPupilId: 1 } })
        .toArray()
    : [];
  const firstLessons = leads
    .map((l) => {
      const raw = String(l.firstLesson ?? "");
      const d = deadlineIso(raw.split("|")[0].trim());
      const g = groups.find((x) => x.id === Number(l.firstLessonGroupId));
      return { id: Number(l.id), name: String(l.name ?? ""), group: g?.title ?? "", date: d, time: (raw.split("|")[1] ?? "").trim() || g?.start || "" };
    })
    .filter((l) => l.date && l.date >= today && l.date <= addDays(today, 7))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  return {
    today,
    now,
    who,
    branch: await branchName(db, groups[0]?.branchId ?? 1),
    keldim: keldim ? { time: String(keldim.enterTime ?? ""), late: Number(keldim.lateMinutes) > 0 || keldim.status === "kechikkan", source: String(keldim.source ?? "") } : null,
    groups: groups.map((g) => ({ id: g.id, title: g.title, pupils: mem.filter((m) => m.groupId === g.id).length })),
    lessons,
    nextDay,
    pending: { works: pendingTasks.reduce((a, t) => a + t.left, 0), tasks: pendingTasks },
    firstLessons,
    staffTasks: (staffTasks as Record<string, unknown>[]).map((x) => ({ id: Number(x.id), title: String(x.title ?? ""), deadline: String(x.deadline ?? ""), by: String(x.createdByName ?? "") })),
    salary: await salaryOf(db, who, month),
  };
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

async function branchName(db: Db, id: number) {
  const b = await db.collection("branches").findOne({ id }, { projection: { _id: 0, name: 1 } });
  return String(b?.name ?? "");
}

/** «Oyligim»: shu oy o'qituvchi orqali tushgan pul × foiz − chiqarilgan avans/oylik (Moliya → Oylik bilan bir manba). */
async function salaryOf(db: Db, who: TeacherWho, month: string) {
  if (who.employeeId === null) return null;
  const emp = await db.collection("hr_employees").findOne({ id: who.employeeId }, { projection: { _id: 0, percent: 1, name: 1 } });
  const [collected, paid, tiers] = await Promise.all([loadCollectedByTeacher(db, month), loadPaidByEmployee(db, month), loadPercentByTier(db)]);
  const key = norm(who.name);
  const find = <T,>(m: Map<string, T>) => [...m.entries()].find(([k]) => norm(k) === key)?.[1];
  const c = find(collected);
  const p = find(paid);
  const percent = resolvePercent(emp?.percent, tiers);
  const base = (c?.collected ?? 0) - (c?.refunded ?? 0);
  const total = percent !== null ? Math.round((base * percent) / 100) : null;
  const avans = (p?.avans ?? 0) + (p?.oylik ?? 0);
  return { month, base, percent, total, avans, left: total !== null ? total - avans : null };
}

// ─────────────────────────────── Dars oynasi ───────────────────────────────

export async function lessonDesk(db: Db, who: TeacherWho, groupId: number) {
  const today = uzDateIso();
  const g = (await teacherGroups(db, who.name)).find((x) => x.id === groupId);
  if (!g) return null;
  const [mem, topic, closed, settings, lessonNo, recentTopics] = await Promise.all([
    members(db, [groupId]),
    db.collection(LESSON_TOPICS).findOne({ groupId, date: today }, { projection: { _id: 0 } }),
    db.collection(LESSON_CLOSES).findOne({ groupId, date: today }, { projection: { _id: 0 } }),
    loadDeskSettings(db),
    lessonNoOf(db, groupId, today),
    db.collection(LESSON_TOPICS).find({ groupId, date: { $lt: today } }, { projection: { _id: 0, date: 1, topic: 1 } }).sort({ date: -1 }).limit(5).toArray(),
  ]);
  const { tasks, checks } = await tasksWithChecks(db, [groupId], addDays(today, -60));
  const todayTask = tasks.find((t) => createdIso(String(t.createdAt ?? "")) === today) ?? null;
  const prevTask = tasks.find((t) => createdIso(String(t.createdAt ?? "")) !== today) ?? null;
  const prevChecks = prevTask ? checks.filter((c) => Number(c.taskId) === Number(prevTask.id)) : [];
  const unchecked = prevTask ? mem.filter((m) => !prevChecks.some((c) => Number(c.pupilId) === m.pupilId)) : [];
  return {
    today,
    now: uzTimeHm(),
    group: g,
    lessonNo,
    pupils: mem.map((m) => {
      const c = prevChecks.find((x) => Number(x.pupilId) === m.pupilId);
      return { pupilId: m.pupilId, name: m.name, check: c ? { done: c.done === true, score: c.score ?? null, coin: c.coin ?? null, note: String(c.note ?? "") } : null };
    }),
    topic: topic ? { topic: String(topic.topic ?? ""), note: String(topic.note ?? ""), at: String(topic.at ?? "") } : null,
    recentTopics: recentTopics.map((x) => ({ date: String(x.date), topic: String(x.topic ?? "") })),
    closed: closed ? String(closed.at ?? "") : null,
    homework: todayTask ? { id: Number(todayTask.id), name: String(todayTask.name ?? ""), note: String(todayTask.note ?? ""), deadline: String(todayTask.deadline ?? ""), maxScore: Number(todayTask.maxScore) || 0, at: String(todayTask.createdAt ?? "") } : null,
    prevTask: prevTask ? { id: Number(prevTask.id), name: String(prevTask.name ?? ""), maxScore: Number(prevTask.maxScore) || 0, checked: prevChecks.length, unchecked: unchecked.map((u) => u.name) } : null,
    requireCheck: settings.requireCheck,
    nextLesson: nextLessonDate(g, today),
  };
}

function nextLessonDate(g: TGroup, today: string): string | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    if (g.weekdays.includes(weekdayOf(d))) return d;
  }
  return null;
}

type Fail = { ok: false; error: string };

export async function saveTopic(db: Db, who: TeacherWho, b: Record<string, unknown>): Promise<{ ok: true } | Fail> {
  const groupId = Number(b.groupId);
  if (!(await teacherGroups(db, who.name)).some((g) => g.id === groupId)) return { ok: false, error: "Guruh topilmadi" };
  const topic = String(b.topic ?? "").trim().slice(0, 200);
  if (!topic) return { ok: false, error: "Mavzuni yozing" };
  const today = uzDateIso();
  await db.collection(LESSON_TOPICS).updateOne(
    { groupId, date: today },
    { $set: { groupId, date: today, topic, note: String(b.note ?? "").trim().slice(0, 500), by: who.name, at: uzTimeHm() } },
    { upsert: true },
  );
  return { ok: true };
}

export async function giveHomework(db: Db, who: TeacherWho, b: Record<string, unknown>): Promise<{ ok: true; id: number } | Fail> {
  const groupId = Number(b.groupId);
  const g = (await teacherGroups(db, who.name)).find((x) => x.id === groupId);
  if (!g) return { ok: false, error: "Guruh topilmadi" };
  const name = String(b.name ?? "").trim().slice(0, 200);
  if (!name) return { ok: false, error: "Vazifa nomini yozing" };
  const desk = await lessonDesk(db, who, groupId);
  if (desk?.requireCheck && desk.prevTask && desk.prevTask.unchecked.length > 0 && !desk.homework)
    return { ok: false, error: `Avval o'tgan vazifani baholang: ${desk.prevTask.unchecked.length} ta ish` };
  const maxScore = Math.max(0, Math.min(100, Math.round(Number(b.maxScore) || 10)));
  const deadline = formatDeadline(String(b.deadline ?? "")) || "";
  const groupDoc = await db.collection("groups").findOne({ id: groupId }, { projection: { _id: 0, name: 1 } });
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = uzDateIso();
  const createdAt = `${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)} | ${uzTimeHm(d)}`;
  if (desk?.homework) {
    await db.collection("group_tasks").updateOne({ id: desk.homework.id }, { $set: { name, note: String(b.note ?? "").trim().slice(0, 1000), deadline, maxScore } });
    return { ok: true, id: desk.homework.id };
  }
  const last = await db.collection("group_tasks").find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  const id = (Number(last[0]?.id) || 0) + 1;
  await db.collection("group_tasks").insertOne({
    id,
    groupId,
    type: "Vazifa",
    name,
    deadline,
    teacher: who.name,
    groupName: String(groupDoc?.name ?? ""),
    maxScore,
    note: String(b.note ?? "").trim().slice(0, 1000),
    fileName: "",
    createdAt,
    source: "dars",
    createdHm: `${p(d.getHours())}:${p(d.getMinutes())}`,
  });
  return { ok: true, id };
}

export async function finishLesson(db: Db, who: TeacherWho, groupId: number): Promise<{ ok: true } | Fail> {
  if (!(await teacherGroups(db, who.name)).some((g) => g.id === groupId)) return { ok: false, error: "Guruh topilmadi" };
  const today = uzDateIso();
  await db.collection(LESSON_CLOSES).updateOne({ groupId, date: today }, { $set: { groupId, date: today, at: uzTimeHm(), by: who.name } }, { upsert: true });
  return { ok: true };
}

// ─────────────────────────────── Tekshirish ───────────────────────────────

export async function checksBoard(db: Db, who: TeacherWho) {
  const today = uzDateIso();
  const groups = await teacherGroups(db, who.name);
  const gids = groups.map((g) => g.id);
  const mem = await members(db, gids);
  const { tasks, checks } = await tasksWithChecks(db, gids, addDays(today, -45));
  const absences = tasks.length
    ? await db.collection("attendance").find({ groupId: { $in: gids }, date: { $gte: addDays(today, -45) }, status: { $in: ["sababli", "sababsiz"] } }, { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1, status: 1 } }).toArray()
    : [];
  return {
    today,
    groups: groups.map((g) => ({ id: g.id, title: g.title, level: g.level })),
    tasks: tasks.map((t) => {
      const pupils = mem.filter((m) => m.groupId === Number(t.groupId));
      const dIso = deadlineIso(String(t.deadline ?? ""));
      const g = groups.find((x) => x.id === Number(t.groupId));
      return {
        id: Number(t.id),
        groupId: Number(t.groupId),
        group: g?.title ?? "",
        level: g?.level ?? "",
        name: String(t.name ?? ""),
        note: String(t.note ?? ""),
        maxScore: Number(t.maxScore) || 10,
        createdAt: String(t.createdAt ?? ""),
        deadline: String(t.deadline ?? ""),
        deadlineIso: dIso,
        rows: pupils.map((p) => {
          const c = checks.find((x) => Number(x.taskId) === Number(t.id) && Number(x.pupilId) === p.pupilId);
          const abs = dIso ? absences.find((a) => Number(a.groupId) === Number(t.groupId) && Number(a.pupilId) === p.pupilId && a.date === dIso) : null;
          return {
            pupilId: p.pupilId,
            name: p.name,
            absent: abs ? String(abs.status) : null,
            check: c ? { done: c.done === true, score: c.score ?? null, note: String(c.note ?? ""), at: String(c.at ?? ""), coin: c.coin ?? null } : null,
          };
        }),
      };
    }),
  };
}

export async function saveCheck(db: Db, who: TeacherWho, b: Record<string, unknown>): Promise<{ ok: true; groupId: number; pupilId: number; done: boolean } | Fail> {
  const taskId = Number(b.taskId);
  const pupilId = Number(b.pupilId);
  const t = await db.collection("group_tasks").findOne({ id: taskId }, { projection: { _id: 0, groupId: 1, maxScore: 1 } });
  if (!t) return { ok: false, error: "Vazifa topilmadi" };
  const groupId = Number(t.groupId);
  if (!(await teacherGroups(db, who.name)).some((g) => g.id === groupId)) return { ok: false, error: "Guruh topilmadi" };
  if (!(await db.collection("group_memberships").findOne({ groupId, pupilId, leftAt: null }))) return { ok: false, error: "O'quvchi guruhda emas" };
  if (b.clear === true) {
    await db.collection(TASK_CHECKS).deleteOne({ taskId, pupilId });
    return { ok: true, groupId, pupilId, done: false };
  }
  const done = b.done === true;
  const max = Number(t.maxScore) || 10;
  const raw = Number(b.score);
  const score = done && Number.isFinite(raw) ? Math.max(0, Math.min(max, Math.round(raw))) : done ? null : 0;
  await db.collection(TASK_CHECKS).updateOne(
    { taskId, pupilId },
    { $set: { taskId, groupId, pupilId, done, score, note: String(b.note ?? "").trim().slice(0, 500), at: `${uzDateIso()}T${uzTimeHm()}`, by: who.name } },
    { upsert: true },
  );
  return { ok: true, groupId, pupilId, done };
}

/** Tanga yozildi (gamifikatsiya uy vazifasi) — tekshiruvga belgi. */
export async function markCheckCoin(db: Db, taskId: number, pupilId: number, coin: number | null) {
  await db.collection(TASK_CHECKS).updateOne({ taskId, pupilId }, { $set: { coin } });
}

// ─────────────────────────────── Guruhlarim ───────────────────────────────

export async function groupsBoard(db: Db, who: TeacherWho) {
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const groups = await teacherGroups(db, who.name);
  const gids = groups.map((g) => g.id);
  const mem = await members(db, gids);
  const pids = [...new Set(mem.map((m) => m.pupilId))];
  const [att, wallets, season, tasks] = await Promise.all([
    db.collection("attendance").find({ groupId: { $in: gids }, date: { $gte: `${month}-01`, $lte: `${month}-31` } }, { projection: { _id: 0, groupId: 1, pupilId: 1, status: 1, date: 1 } }).toArray(),
    db.collection(GAM.wallets).find({ pupilId: { $in: pids } }, { projection: { _id: 0, pupilId: 1, balance: 1 } }).toArray(),
    db.collection("season_grades").find({ groupId: { $in: gids }, pupilId: { $in: pids } }, { projection: { _id: 0 } }).sort({ season: -1 }).toArray(),
    tasksWithChecks(db, gids, `${month}-01`),
  ]);
  const lessonDates = (gid: number) => new Set(att.filter((a) => Number(a.groupId) === gid).map((a) => String(a.date))).size;
  const avg = (s: Record<string, unknown> | undefined) => {
    const v = Object.values((s?.scores as Record<string, number>) ?? {}).filter((x) => x >= 1 && x <= 5);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  return {
    today,
    month,
    pupilsTotal: pids.length,
    groups: groups.map((g) => {
      const my = mem.filter((m) => m.groupId === g.id);
      const ga = att.filter((a) => Number(a.groupId) === g.id);
      const cameN = ga.filter((a) => cameStatus(a.status as AttendanceStatus)).length;
      const gSeason = season.filter((s) => Number(s.groupId) === g.id);
      const latest = gSeason[0]?.season ?? null;
      const gTasks = tasks.tasks.filter((t) => Number(t.groupId) === g.id);
      return {
        ...g,
        lessonsThisMonth: lessonDates(g.id),
        attendancePct: ga.length ? Math.round((cameN / ga.length) * 100) : null,
        seasonDone: latest ? gSeason.filter((s) => s.season === latest).length : 0,
        nextLesson: nextLessonDate(g, today),
        pupils: my.map((m) => {
          const pa = ga.filter((a) => Number(a.pupilId) === m.pupilId);
          const ch = tasks.checks.filter((c) => Number(c.pupilId) === m.pupilId && gTasks.some((t) => Number(t.id) === Number(c.taskId)));
          const s = gSeason.find((x) => Number(x.pupilId) === m.pupilId && x.season === latest);
          return {
            pupilId: m.pupilId,
            name: m.name,
            attended: pa.filter((a) => cameStatus(a.status as AttendanceStatus)).length,
            lessons: pa.length,
            hwDone: ch.filter((c) => c.done === true).length,
            hwTotal: gTasks.length,
            coins: Number(wallets.find((w) => Number(w.pupilId) === m.pupilId)?.balance ?? 0),
            season: avg(s),
          };
        }),
      };
    }),
  };
}

export async function pupilCard(db: Db, who: TeacherWho, groupId: number, pupilId: number) {
  const groups = await teacherGroups(db, who.name);
  const g = groups.find((x) => x.id === groupId);
  if (!g) return null;
  if (!(await db.collection("group_memberships").findOne({ groupId, pupilId, leftAt: null }))) return null;
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [pupil, mems, att, wallet, season, bots, tasks] = await Promise.all([
    db.collection("pupils").findOne({ id: pupilId }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }),
    db.collection("group_memberships").find({ pupilId, leftAt: null }, { projection: { _id: 0, groupId: 1 } }).toArray(),
    db.collection("attendance").find({ groupId, pupilId, date: { $gte: `${month}-01`, $lte: `${month}-31` } }, { projection: { _id: 0, status: 1 } }).toArray(),
    db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1, earnedTotal: 1 } }),
    db.collection("season_grades").find({ groupId, pupilId }, { projection: { _id: 0 } }).sort({ season: -1 }).limit(1).toArray(),
    db.collection("student_bot_users").find({ "links.pupilId": pupilId }, { projection: { _id: 0, tgName: 1, links: 1 } }).toArray(),
    tasksWithChecks(db, [groupId], `${month}-01`),
  ]);
  if (!pupil) return null;
  const otherGroups = await db.collection("groups").find({ id: { $in: mems.map((m) => Number(m.groupId)) } }, { projection: { _id: 0 } }).toArray();
  const s = season[0];
  const crit = (s?.criteria as string[]) ?? Object.keys((s?.scores as Record<string, number>) ?? {});
  const myChecks = tasks.checks.filter((c) => Number(c.pupilId) === pupilId);
  const streak = await db.collection(GAM.tx).countDocuments({ pupilId, groupId, type: "attendance", status: "active", date: { $gte: `${month}-01` } });
  return {
    pupilId,
    name: pupilFullName(pupil as unknown as Pupil),
    groups: otherGroups.map((x) => {
      const tg = toTGroup(x as unknown as Group);
      return { id: tg.id, title: tg.title, course: tg.course, teacher: String(x.teacher ?? ""), mine: norm(x.teacher) === norm(who.name) };
    }),
    attendance: { came: att.filter((a) => cameStatus(a.status as AttendanceStatus)).length, total: att.length },
    homework: { done: myChecks.filter((c) => c.done === true).length, total: tasks.tasks.length },
    coins: { balance: Number(wallet?.balance ?? 0), earned: Number(wallet?.earnedTotal ?? 0) },
    attendanceCoins: streak,
    season: s ? { season: String(s.season), criteria: crit.map((c) => ({ name: c, score: Number((s.scores as Record<string, number>)?.[c] ?? 0) })), note: String(s.note ?? ""), by: String(s.teacher ?? "") } : null,
    parents: bots
      .filter((u) => (u.links as { pupilId: number; role: string }[]).some((l) => l.pupilId === pupilId && l.role === "parent"))
      .map((u) => ({ name: String(u.tgName ?? "") })),
  };
}
