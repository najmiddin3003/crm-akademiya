import type { Db, Document } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import type { SupportLesson, SupportLessonRow, SupportPayload, SupportSeat, SupportStatus, SupportTeacherRow } from "@/lib/supportLessonTypes";

// SUPPORT DARSLARI (34-qism). Qo'shimcha yordam darsi: sana, vaqt, xona, kurs, mavzu, support ustoz va
// sig'im. O'quvchi yoziladi — joy bo'lsa `seats`ga, tugagan bo'lsa `queue`ga (navbat). Kimdir chiqsa
// navbatdagi birinchi o'quvchi joyga o'tadi. Dars o'tgach ustoz/admin «keldi / kelmadi» belgilaydi.
// Saqlanadi `support_lessons`. Hozircha yozishni admin qiladi; o'quvchi kabinetidan o'zi yozilishi —
// keyingi bosqich (SAVOLLAR). Eski `support_analytics` (faqat o'qiladigan ro'yxat) tegilmagan.

export const SUPPORT_LESSONS = "support_lessons";
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const stamp = () => `${uzDateIso()}T${uzTimeHm()}`;
const strip = (d: Document): SupportLesson => {
  const r = { ...d };
  delete r._id;
  return r as unknown as SupportLesson;
};

export function statusOf(l: SupportLesson, now = stamp()): SupportStatus {
  if (`${l.date}T${l.start}` > now) return l.seats.length >= l.capacity ? "full" : "open";
  return l.seats.length && l.seats.every((s) => s.came !== null) ? "done" : l.seats.length ? "unmarked" : "done";
}

export async function listSupport(db: Db, { from, to, course, branchIds }: { from: string; to: string; course: string; branchIds: number[] }): Promise<SupportPayload> {
  const col = db.collection(SUPPORT_LESSONS);
  const base = { $and: [branchInCondition(branchIds), { date: { $gte: from, $lte: to } }] };
  const docs = (await col.find(base).sort({ date: -1, start: -1 }).toArray()).map(strip);
  const courses = [...new Set(docs.map((d) => d.course).filter(Boolean))].sort();
  const now = stamp();
  const rows: SupportLessonRow[] = docs.filter((d) => !course || d.course === course).map((d) => ({ ...d, status: statusOf(d, now), came: d.seats.filter((s) => s.came === true).length }));
  const past = rows.filter((r) => r.status === "done" || r.status === "unmarked");
  const marked = past.flatMap((r) => r.seats.filter((s) => s.came !== null));
  const came = marked.filter((s) => s.came).length;
  const pupils = new Set(past.flatMap((r) => r.seats.map((s) => s.pupilId)));
  const byT = new Map<string, { courses: Set<string>; lessons: number; enrolled: number; came: number; marked: number }>();
  for (const r of rows) {
    const t = byT.get(r.teacher) ?? { courses: new Set(), lessons: 0, enrolled: 0, came: 0, marked: 0 };
    t.courses.add(r.course);
    t.lessons += 1;
    t.enrolled += r.seats.length;
    if (r.status === "done" || r.status === "unmarked") {
      t.came += r.came;
      t.marked += r.seats.filter((s) => s.came !== null).length;
    }
    byT.set(r.teacher, t);
  }
  const teachers: SupportTeacherRow[] = [...byT.entries()]
    .map(([teacher, t]) => ({ teacher, course: [...t.courses].join(", "), lessons: t.lessons, enrolled: t.enrolled, pct: t.marked ? Math.round((t.came / t.marked) * 100) : null }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.lessons - a.lessons);
  return {
    ok: true,
    from,
    to,
    courses,
    kpi: {
      lessons: rows.length,
      done: past.length,
      planned: rows.length - past.length,
      enrolled: past.reduce((a, r) => a + r.seats.length, 0),
      pupils: pupils.size,
      came,
      cameOf: marked.length,
      noShow: marked.length - came,
      pct: marked.length ? Math.round((came / marked.length) * 100) : null,
      queue: rows.filter((r) => r.status === "open" || r.status === "full").reduce((a, r) => a + r.queue.length, 0),
    },
    rows,
    teachers,
  };
}

export interface CreateInput {
  date?: unknown;
  start?: unknown;
  room?: unknown;
  course?: unknown;
  topic?: unknown;
  teacher?: unknown;
  capacity?: unknown;
}

export async function createSupport(db: Db, branchId: number, by: string, b: CreateInput): Promise<{ ok: true; lesson: SupportLesson } | Fail> {
  const s = (v: unknown) => String(v ?? "").trim();
  const date = s(b.date);
  const start = s(b.start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Sanani kiriting");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return fail("Vaqtni kiriting");
  if (!s(b.topic)) return fail("Mavzuni kiriting");
  if (!s(b.teacher)) return fail("Support ustozni tanlang");
  const capacity = Math.floor(Number(b.capacity));
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 100) return fail("Joylar soni 1–100 oralig'ida bo'lsin");
  const col = db.collection(SUPPORT_LESSONS);
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const lesson: SupportLesson = {
    id: (Number(last[0]?.id) || 0) + 1,
    branchId,
    date,
    start,
    room: s(b.room),
    course: s(b.course),
    topic: s(b.topic).slice(0, 160),
    teacher: s(b.teacher),
    capacity,
    seats: [],
    queue: [],
    createdAt: stamp(),
    createdBy: by,
  };
  await col.insertOne({ ...lesson });
  return { ok: true, lesson };
}

export type SupportAction =
  | { action: "enroll"; id: number; pupilId: number; name: string }
  | { action: "remove"; id: number; pupilId: number }
  | { action: "mark"; id: number; marks: Record<string, boolean | null> }
  | { action: "delete"; id: number };

export async function updateSupport(db: Db, branchIds: number[], a: SupportAction): Promise<{ ok: true; lesson?: SupportLesson; placed?: "seat" | "queue" } | Fail> {
  const col = db.collection(SUPPORT_LESSONS);
  const q = { $and: [{ id: a.id }, branchInCondition(branchIds)] };
  const doc = await col.findOne(q);
  if (!doc) return fail("Dars topilmadi", 404);
  const l = strip(doc);
  const now = stamp();
  const started = `${l.date}T${l.start}` <= now;
  if (a.action === "delete") {
    if (l.seats.some((s) => s.came !== null)) return fail("Davomati belgilangan darsni o'chirib bo'lmaydi");
    await col.deleteOne(q);
    return { ok: true };
  }
  if (a.action === "enroll") {
    const pupilId = Math.floor(Number(a.pupilId));
    if (!pupilId) return fail("O'quvchini tanlang");
    if ([...l.seats, ...l.queue].some((s) => s.pupilId === pupilId)) return fail("Bu o'quvchi allaqachon yozilgan");
    const seat: SupportSeat = { pupilId, name: String(a.name ?? "").trim(), at: now, came: null };
    const placed = l.seats.length < l.capacity ? "seat" : "queue";
    if (placed === "seat") l.seats.push(seat);
    else if (started) return fail("Dars boshlangan — joy yo'q");
    else l.queue.push(seat);
    await col.updateOne(q, { $set: { seats: l.seats, queue: l.queue } });
    return { ok: true, lesson: l, placed };
  }
  if (a.action === "remove") {
    const inSeat = l.seats.some((s) => s.pupilId === a.pupilId);
    l.seats = l.seats.filter((s) => s.pupilId !== a.pupilId);
    l.queue = l.queue.filter((s) => s.pupilId !== a.pupilId);
    if (inSeat && !started && l.queue.length) l.seats.push({ ...l.queue.shift()!, came: null });
    await col.updateOne(q, { $set: { seats: l.seats, queue: l.queue } });
    return { ok: true, lesson: l };
  }
  if (!started) return fail("Dars hali boshlanmagan");
  l.seats = l.seats.map((s) => (String(s.pupilId) in a.marks ? { ...s, came: a.marks[String(s.pupilId)] } : s));
  await col.updateOne(q, { $set: { seats: l.seats } });
  return { ok: true, lesson: l };
}
