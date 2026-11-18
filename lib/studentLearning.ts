import type { Db } from "mongodb";
import { branchPool } from "@/lib/branchPools";
import { ONLINE_PROGRESS } from "@/lib/onlineCourseAdmin";
import type { OnlineModule } from "@/lib/onlineCourseAdminTypes";
import { SUPPORT_LESSONS, statusOf, updateSupport } from "@/lib/supportLessons";
import type { SupportLesson } from "@/lib/supportLessonTypes";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// O'QUVCHI KABINETI → DARSLAR (43-qism): support darslari va onlayn kurslar. Kim ekani — Telegram `initData`
// (/api/student-web/extras). O'quvchi FAQAT O'ZINI yozadi/chiqaradi.
//
// SUPPORT: o'quvchi filiali hovuzidagi (lib/branchPools.ts) hali boshlanmagan darslar; kursi o'quvchi guruhlari
// kurslaridan biri (yoki kurssiz). Joy bo'lsa — joyga, to'lgan bo'lsa — navbatga (lib/supportLessons.ts → enroll).
// Cheklov: haftasiga 2 ta yozilish (joy + navbat; taxmin — SAVOLLAR 541). Boshlanishidan oldin chiqish mumkin —
// bo'shagan joyga navbatdagi birinchi o'tadi.
//
// ONLAYN KURSLAR: e'lon qilingan (`published`) kurslar; bepul — ochiq, pullik — hozircha yopiq (kassada to'langach
// ochish usuli yo'q — SAVOLLAR 542). Progress — `online_progress` (ko'rilgan darslar, oxirgi dars, tugatgan vaqt).
// Modul testlari savollari tizimda yo'q — test bo'limi «Tez orada», modullar ketma-ket bloklanmaydi.

export const SUPPORT_WEEK_LIMIT = 2;

const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * 86400_000).toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

async function pupilCourses(db: Db, pupilId: number): Promise<string[]> {
  const mem = await db.collection("group_memberships").find({ pupilId, leftAt: null }, { projection: { _id: 0, groupId: 1 } }).toArray();
  const groups = await db.collection("groups").find({ id: { $in: mem.map((m) => Number(m.groupId)) } }, { projection: { _id: 0, course: 1 } }).toArray();
  return [...new Set(groups.map((g) => String(g.course ?? "").trim().toLowerCase()).filter(Boolean))];
}

export async function supportForPupil(db: Db, pupil: { id: number; branchId?: number }) {
  const today = uzDateIso();
  const now = `${today}T${uzTimeHm()}`;
  const pool = [...branchPool(Number(pupil.branchId) || 1)];
  const courses = await pupilCourses(db, pupil.id);
  const mon = mondayOf(today);
  const docs = (await db
    .collection(SUPPORT_LESSONS)
    .find({ branchId: { $in: pool }, date: { $gte: addDays(today, -21), $lte: addDays(today, 21) } }, { projection: { _id: 0 } })
    .sort({ date: 1, start: 1 })
    .toArray()) as unknown as SupportLesson[];
  const fits = (l: SupportLesson) => !l.course || !courses.length || courses.some((c) => c.includes(l.course.toLowerCase()) || l.course.toLowerCase().includes(c));
  const where = (l: SupportLesson) => (l.seats.some((s) => s.pupilId === pupil.id) ? "seat" : l.queue.some((s) => s.pupilId === pupil.id) ? "queue" : null);
  const weekUsed = docs.filter((l) => l.date >= mon && l.date <= addDays(mon, 6) && where(l)).length;
  const upcoming = docs
    .filter((l) => `${l.date}T${l.start}` > now && fits(l))
    .map((l) => ({
      id: l.id,
      date: l.date,
      start: l.start,
      room: l.room,
      course: l.course,
      topic: l.topic,
      teacher: l.teacher,
      capacity: l.capacity,
      seats: l.seats.length,
      queue: l.queue.length,
      status: statusOf(l, now),
      mine: where(l),
      queuePos: l.queue.findIndex((s) => s.pupilId === pupil.id) + 1,
    }));
  const history = docs
    .filter((l) => `${l.date}T${l.start}` <= now && l.seats.some((s) => s.pupilId === pupil.id))
    .reverse()
    .slice(0, 6)
    .map((l) => ({ id: l.id, date: l.date, start: l.start, course: l.course, topic: l.topic, teacher: l.teacher, came: l.seats.find((s) => s.pupilId === pupil.id)?.came ?? null }));
  return { weekUsed, limit: SUPPORT_WEEK_LIMIT, upcoming, history };
}

export async function supportEnroll(db: Db, pupil: { id: number; branchId?: number; name: string }, id: number) {
  const st = await supportForPupil(db, pupil);
  const l = st.upcoming.find((x) => x.id === id);
  if (!l) return { ok: false as const, error: "Dars topilmadi yoki boshlangan" };
  if (l.mine) return { ok: false as const, error: "Siz allaqachon yozilgansiz" };
  if (st.weekUsed >= st.limit) return { ok: false as const, error: "Bu hafta yozilish chegarasiga yetdingiz" };
  const r = await updateSupport(db, [...branchPool(Number(pupil.branchId) || 1)], { action: "enroll", id, pupilId: pupil.id, name: pupil.name });
  return r.ok ? { ok: true as const, placed: r.placed ?? "seat" } : { ok: false as const, error: r.error };
}

export async function supportCancel(db: Db, pupil: { id: number; branchId?: number }, id: number) {
  const st = await supportForPupil(db, pupil);
  const l = st.upcoming.find((x) => x.id === id);
  if (!l || !l.mine) return { ok: false as const, error: "Yozilish topilmadi" };
  const r = await updateSupport(db, [...branchPool(Number(pupil.branchId) || 1)], { action: "remove", id, pupilId: pupil.id });
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

// ── Onlayn kurslar ──

export async function coursesForPupil(db: Db, pupilId: number) {
  const [courses, prog] = await Promise.all([
    db.collection("online_courses").find({ published: true }, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection(ONLINE_PROGRESS).find({ pupilId }, { projection: { _id: 0 } }).toArray(),
  ]);
  return courses.map((c) => {
    const modules = (Array.isArray(c.modules) ? (c.modules as OnlineModule[]) : []).map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.video) }));
    const p = prog.find((x) => Number(x.courseId) === Number(c.id));
    const done = ((p?.lessonsDone as string[]) ?? []).filter((id) => modules.some((m) => m.lessons.some((l) => l.id === id)));
    const free = c.free !== false && !Number(c.price);
    return {
      id: Number(c.id),
      name: String(c.name ?? ""),
      teacher: String(c.teacher ?? ""),
      cover: String(c.cover ?? ""),
      category: String(c.categoryName ?? c.level ?? ""),
      audience: String(c.audienceNote ?? c.audience ?? ""),
      free,
      price: Number(c.price) || 0,
      open: free,
      modules: free ? modules : modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => ({ ...l, video: "" })) })),
      done,
      last: String(p?.lastLesson ?? ""),
      lastAt: String(p?.updatedAt ?? ""),
    };
  });
}

export async function markLesson(db: Db, pupilId: number, courseId: number, lessonId: string) {
  const list = await coursesForPupil(db, pupilId);
  const c = list.find((x) => x.id === courseId);
  if (!c || !c.open) return { ok: false as const, error: "Kurs yopiq" };
  const all = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (!all.includes(lessonId)) return { ok: false as const, error: "Dars topilmadi" };
  const doneSet = new Set([...c.done, lessonId]);
  const at = new Date().toISOString();
  await db.collection(ONLINE_PROGRESS).updateOne(
    { courseId, pupilId },
    { $addToSet: { lessonsDone: lessonId }, $set: { courseId, pupilId, lastLesson: lessonId, updatedAt: at, ...(all.every((x) => doneSet.has(x)) ? { doneAt: at } : {}) } },
    { upsert: true },
  );
  return { ok: true as const };
}
