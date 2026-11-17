import type { Db } from "mongodb";
import type { OnlineCourseRow, OnlineCoursesPayload, OnlineModule } from "@/lib/onlineCourseAdminTypes";

// ONLAYN KURSLAR — YANGI VERSIYA (36-qism). `online_courses` hujjatiga tuzilma qo'shiladi: `modules` (modul →
// darslar: sarlavha, video, davomiylik; modul oxiridagi test savollari soni), `teacher`, `audienceNote`.
// Eski `sections` (nom + natija) birinchi ochilishda modullarga aylantiriladi (darssiz).
// Statistika — `online_progress` (kurs + o'quvchi: ko'rilgan darslar, modul test foizlari, tugatgan vaqt).
// O'quvchi kabinetidagi video pleer hali yo'q — progress yozilmaguncha ko'rsatkichlar 0 (SAVOLLAR).
// Pullik kurs tushumi — kassadagi kirimlar, toifasi «Onlayn kurs» (kassada shu toifa bilan to'lanadi).

export const ONLINE_PROGRESS = "online_progress";
const rid = () => Math.random().toString(36).slice(2, 10);

function modulesOf(c: Record<string, unknown>): OnlineModule[] {
  if (Array.isArray(c.modules)) return c.modules as OnlineModule[];
  return ((c.sections ?? []) as { name: string }[]).map((s) => ({ id: rid(), name: String(s.name), lessons: [], testQuestions: 0 }));
}

export async function onlineCourses(db: Db): Promise<OnlineCoursesPayload> {
  const [courses, prog, rev] = await Promise.all([
    db.collection("online_courses").find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection(ONLINE_PROGRESS).find({}, { projection: { _id: 0 } }).toArray(),
    db
      .collection("transaction_entries")
      .aggregate([{ $match: { txType: "payIn", status: { $nin: ["cancelled", "waiting"] }, category: { $regex: "onlayn kurs", $options: "i" } } }, { $group: { _id: null, sum: { $sum: "$amount" }, pupils: { $addToSet: "$pupilId" } } }])
      .toArray(),
  ]);
  const rows: OnlineCourseRow[] = courses.map((c) => {
    const modules = modulesOf(c);
    const lessons = modules.flatMap((m) => m.lessons);
    const mine = prog.filter((p) => Number(p.courseId) === Number(c.id));
    const opened = mine.filter((p) => ((p.lessonsDone as string[]) ?? []).length > 0);
    const tests = mine.flatMap((p) => Object.values((p.tests ?? {}) as Record<string, number>));
    return {
      id: Number(c.id),
      name: String(c.name ?? ""),
      teacher: String(c.teacher ?? ""),
      audience: String(c.audienceNote ?? c.audience ?? ""),
      free: c.free !== false && !Number(c.price),
      price: Number(c.price) || 0,
      published: !!c.published,
      cover: String(c.cover ?? ""),
      modules,
      lessons: lessons.length,
      ready: lessons.filter((l) => l.video).length,
      minutes: Math.round(lessons.reduce((a, l) => a + (Number(l.minutes) || 0) + (Number(l.seconds) || 0) / 60, 0)),
      pupils: opened.length,
      finished: mine.filter((p) => p.doneAt).length,
      testAvg: tests.length ? Math.round(tests.reduce((a, b) => a + b, 0) / tests.length) : null,
      moduleProgress: modules.map((m) => {
        if (!m.lessons.length || !opened.length) return 0;
        const ids = new Set(m.lessons.map((l) => l.id));
        const done = opened.reduce((a, p) => a + ((p.lessonsDone as string[]) ?? []).filter((x) => ids.has(x)).length, 0);
        return Math.round((done / (m.lessons.length * opened.length)) * 100);
      }),
      moduleTest: modules.map((m) => {
        const v = mine.map((p) => ((p.tests ?? {}) as Record<string, number>)[m.id]).filter((x) => typeof x === "number");
        return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
      }),
    };
  });
  const allTests = prog.flatMap((p) => Object.values((p.tests ?? {}) as Record<string, number>));
  const paid = rows.filter((r) => !r.free);
  return {
    ok: true,
    rows,
    kpi: {
      pupils: new Set(prog.filter((p) => ((p.lessonsDone as string[]) ?? []).length).map((p) => p.pupilId)).size,
      finished: new Set(prog.filter((p) => p.doneAt).map((p) => p.pupilId)).size,
      testAvg: allTests.length ? Math.round(allTests.reduce((a, b) => a + b, 0) / allTests.length) : null,
      revenue: Number(rev[0]?.sum) || 0,
      paidPupils: ((rev[0]?.pupils as unknown[]) ?? []).filter(Boolean).length,
      paidName: paid.map((r) => r.name).join(", "),
    },
  };
}

function cleanModules(raw: unknown): OnlineModule[] | string {
  if (!Array.isArray(raw)) return "Noto'g'ri tuzilma";
  const out: OnlineModule[] = [];
  for (const m of raw.slice(0, 30) as Record<string, unknown>[]) {
    const name = String(m?.name ?? "").trim().slice(0, 100);
    if (!name) return "Modul nomini yozing";
    const lessons = (Array.isArray(m.lessons) ? m.lessons : []).slice(0, 60).map((l: Record<string, unknown>) => ({
      id: String(l?.id || rid()).slice(0, 20),
      title: String(l?.title ?? "").trim().slice(0, 120),
      video: /^https?:\/\//.test(String(l?.video ?? "")) ? String(l.video) : "",
      minutes: Math.max(0, Math.min(600, Math.floor(Number(l?.minutes) || 0))),
      seconds: Math.max(0, Math.min(59, Math.floor(Number(l?.seconds) || 0))),
    }));
    if (lessons.some((l) => !l.title)) return "Dars nomini yozing";
    out.push({ id: String(m.id || rid()).slice(0, 20), name, lessons, testQuestions: Math.max(0, Math.min(100, Math.floor(Number(m.testQuestions) || 0))) });
  }
  return out;
}

export async function saveOnlineCourse(db: Db, b: { id?: number; modules?: unknown; teacher?: string; audience?: string; published?: boolean }) {
  const c = await db.collection("online_courses").findOne({ id: Number(b.id) });
  if (!c) return { ok: false as const, error: "Kurs topilmadi" };
  const set: Record<string, unknown> = {};
  if (b.modules !== undefined) {
    const m = cleanModules(b.modules);
    if (typeof m === "string") return { ok: false as const, error: m };
    set.modules = m;
  }
  if (b.teacher !== undefined) set.teacher = String(b.teacher).trim().slice(0, 80);
  if (b.audience !== undefined) set.audienceNote = String(b.audience).trim().slice(0, 160);
  if (typeof b.published === "boolean") set.published = b.published;
  if (!Object.keys(set).length) return { ok: false as const, error: "O'zgarish yo'q" };
  await db.collection("online_courses").updateOne({ id: Number(b.id) }, { $set: set });
  return { ok: true as const };
}
