import type { Db, Document } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { groupLabel } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";
import {
  LESSON_TAGS,
  MIN_RATINGS_FOR_AVG,
  RATE_WINDOW_DAYS,
  type MyRating,
  type RatingComment,
  type TeacherRatingRow,
  type TeacherRatingsPayload,
} from "@/lib/lessonRatingTypes";

// DARS BAHOSI (34-qism, rasmlar «O'quvchi kabineti · Darsni baholash» va «Ustozlar reytingi»).
//
// O'quvchi KELGAN darsini (davomatda keldi / kechikdi / birinchi) dars kunidan RATE_WINDOW_DAYS kun
// ichida BIR MARTA baholaydi: 1–5 yulduz, teglar, izoh. Saqlanadi `lesson_ratings` (pupilId + groupId +
// date — noyob). Ustoz nomi baho paytidagi guruh ustozi (keyin almashsa ham baho o'sha ustozniki).
// Rahbar sahifasi oy bo'yicha ustozlar: soni, o'rtacha, taqsimot, o'tgan oy, past baholar (1–2), izohlar.
// O'quvchi ismi rahbar sahifasida ham, ustozga ham chiqmaydi (rasm: «kim qo'yganini ko'rmaydi»).

export const LESSON_RATINGS = "lesson_ratings";
type Fail = { ok: false; error: string; status: number };

const CAME = ["keldi", "kechikdi", "birinchi"];

function addDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n));
  return d.toISOString().slice(0, 10);
}
function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
const round1 = (x: number) => Math.round(x * 10) / 10;

export async function ensureRatingIndexes(db: Db) {
  await db.collection(LESSON_RATINGS).createIndex({ pupilId: 1, groupId: 1, date: 1 }, { unique: true }).catch(() => {});
  await db.collection(LESSON_RATINGS).createIndex({ date: 1 }).catch(() => {});
}

/** O'quvchining oxirgi baholari (kabinet «Oxirgi baholarim») va hali baholanmagan kelgan darslari. */
export async function myRatings(db: Db, pupilId: number): Promise<{ ratings: MyRating[]; rated: string[]; windowDays: number }> {
  const today = uzDateIso();
  const rows = await db.collection(LESSON_RATINGS).find({ pupilId }, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).limit(20).toArray();
  const gids = [...new Set(rows.map((r) => Number(r.groupId)))];
  const groups = await db.collection("groups").find({ id: { $in: gids } }, { projection: { _id: 0, id: 1, name: 1, course: 1 } }).toArray();
  const gBy = new Map(groups.map((g) => [Number(g.id), g]));
  return {
    ratings: rows.slice(0, 8).map((r) => {
      const g = gBy.get(Number(r.groupId));
      return {
        groupId: Number(r.groupId),
        date: String(r.date),
        stars: Number(r.stars),
        title: g ? groupLabel({ id: Number(g.id), name: String(g.name ?? ""), course: String(g.course ?? "") }) : "",
        course: String(g?.course ?? ""),
        teacher: String(r.teacher ?? ""),
      };
    }),
    // Kabinet tugmani yashirishi uchun: shu oyna ichida baholangan darslar kaliti.
    rated: rows.filter((r) => String(r.date) >= addDays(today, -RATE_WINDOW_DAYS)).map((r) => `${r.groupId}|${r.date}`),
    windowDays: RATE_WINDOW_DAYS,
  };
}

export async function submitRating(
  db: Db,
  pupilId: number,
  input: { groupId: number; date: string; stars: number; tags: string[]; comment: string },
): Promise<{ ok: true } | Fail> {
  const today = uzDateIso();
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) return { ok: false, error: "Bahoni tanlang", status: 400 };
  if (input.date > today || input.date < addDays(today, -RATE_WINDOW_DAYS)) return { ok: false, error: "Bu darsni baholash muddati o'tgan", status: 422 };
  const mark = await db.collection("attendance").findOne({ pupilId, groupId: input.groupId, date: input.date }, { projection: { _id: 0, status: 1 } });
  if (!mark || !CAME.includes(String(mark.status))) return { ok: false, error: "Faqat kelgan darsingizni baholay olasiz", status: 422 };
  const g = await db.collection("groups").findOne({ id: input.groupId }, { projection: { _id: 0, teacher: 1, branchId: 1 } });
  if (!g) return { ok: false, error: "Guruh topilmadi", status: 404 };
  const tags = input.tags.filter((x): x is (typeof LESSON_TAGS)[number] => (LESSON_TAGS as readonly string[]).includes(x));
  await ensureRatingIndexes(db);
  try {
    await db.collection(LESSON_RATINGS).insertOne({
      pupilId,
      groupId: input.groupId,
      date: input.date,
      teacher: String(g.teacher ?? "").trim(),
      branchId: Number.isFinite(Number(g.branchId)) && g.branchId !== null ? Number(g.branchId) : 1,
      stars: input.stars,
      tags,
      comment: input.comment.trim().slice(0, 500),
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { ok: false, error: "Bu darsni allaqachon baholagansiz", status: 409 };
    throw e;
  }
  return { ok: true };
}

// ── Rahbar sahifasi ─────────────────────────────────────────────────────

export async function teacherRatings(db: Db, opts: { month: string; branchIds: number[]; course: string }): Promise<TeacherRatingsPayload> {
  const from = `${opts.month}-01`;
  const to = `${opts.month}-31`;
  const prevM = shiftMonth(opts.month, -1);
  const [branchRows, groups] = await Promise.all([
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    db.collection("groups").find(branchInCondition(opts.branchIds) as Document, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, status: 1 } }).toArray(),
  ]);
  const branchName = new Map(branchRows.map((b) => [Number(b.id), String(b.name ?? "")]));
  const courses = [...new Set(groups.map((g) => String(g.course ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uz"));
  const scoped = groups.filter((g) => !opts.course || String(g.course ?? "") === opts.course);
  const gids = scoped.map((g) => Number(g.id));
  const gBy = new Map(scoped.map((g) => [Number(g.id), g]));

  const [cur, prev, attended] = await Promise.all([
    db.collection(LESSON_RATINGS).find({ groupId: { $in: gids }, date: { $gte: from, $lte: to } }, { projection: { _id: 0 } }).sort({ date: -1, createdAt: -1 }).toArray(),
    db
      .collection(LESSON_RATINGS)
      .aggregate<{ _id: string; s: number; n: number }>([
        { $match: { groupId: { $in: gids }, date: { $gte: `${prevM}-01`, $lte: `${prevM}-31` } } },
        { $group: { _id: "$teacher", s: { $sum: "$stars" }, n: { $sum: 1 } } },
      ])
      .toArray(),
    db.collection("attendance").countDocuments({ groupId: { $in: gids }, date: { $gte: from, $lte: to }, status: { $in: CAME } }),
  ]);
  const prevBy = new Map(prev.map((p) => [p._id, p.n >= MIN_RATINGS_FOR_AVG ? round1(p.s / p.n) : null]));

  const byTeacher = new Map<string, Document[]>();
  for (const r of cur) {
    const k = String(r.teacher ?? "") || "—";
    byTeacher.set(k, [...(byTeacher.get(k) ?? []), r]);
  }
  // Ustoz qatori ostidagi matn: guruhlari (kurslar) va filiali.
  const subOf = (teacher: string) => {
    const gs = scoped.filter((g) => String(g.teacher ?? "").trim() === teacher && g.status === "active");
    const labels = [...new Set(gs.map((g) => groupLabel({ id: Number(g.id), name: String(g.name ?? ""), course: String(g.course ?? "") })))];
    const br = [...new Set(gs.map((g) => branchName.get(Number.isFinite(Number(g.branchId)) && g.branchId !== null ? Number(g.branchId) : 1) ?? ""))].filter(Boolean);
    return [labels.slice(0, 3).join(", "), br.join(", ")].filter(Boolean).join(" · ");
  };

  const rows: TeacherRatingRow[] = [...byTeacher.entries()].map(([teacher, list]) => {
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of list) dist[5 - Number(r.stars)] += 1;
    const sum = list.reduce((a, r) => a + Number(r.stars), 0);
    return {
      teacher,
      sub: subOf(teacher),
      count: list.length,
      avg: list.length >= MIN_RATINGS_FOR_AVG ? round1(sum / list.length) : null,
      dist,
      prevAvg: prevBy.get(teacher) ?? null,
      low: dist[3] + dist[4],
    };
  });
  rows.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count - a.count);

  const all = cur.length;
  const low = cur.filter((r) => Number(r.stars) <= 2).length;
  const lowTop = rows.reduce((m, r) => Math.max(m, r.low), 0);
  const counted = rows.filter((r) => r.avg !== null);

  // Diqqat: o'rtachasi eng past (4 dan past) ustoz — oxirgi 6 darsi va takrorlangan teglari.
  let attention: TeacherRatingsPayload["attention"] = null;
  const worst = [...counted].sort((a, b) => (a.avg ?? 5) - (b.avg ?? 5))[0];
  if (worst && (worst.avg ?? 5) < 4) {
    const list = byTeacher.get(worst.teacher) ?? [];
    const lessons = [...new Set(list.map((r) => `${r.groupId}|${r.date}`))].slice(0, 6);
    const last = list.filter((r) => lessons.includes(`${r.groupId}|${r.date}`));
    const tagCount = new Map<string, number>();
    for (const r of list) for (const t of (r.tags as string[] | undefined) ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    const g = gBy.get(Number(list[0]?.groupId));
    attention = {
      teacher: worst.teacher,
      groupLabel: g ? groupLabel({ id: Number(g.id), name: String(g.name ?? ""), course: String(g.course ?? "") }) : "",
      lastAvg: last.length ? round1(last.reduce((a, r) => a + Number(r.stars), 0) / last.length) : 0,
      lastN: lessons.length,
      low: worst.low,
      tags: [...tagCount.entries()]
        .filter(([t]) => t === "Juda tez o'tdi" || t === "Uy vazifasi ko'p")
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t),
    };
  }

  const comments: RatingComment[] = cur
    .filter((r) => String(r.comment ?? "").trim())
    .slice(0, 6)
    .map((r) => {
      const g = gBy.get(Number(r.groupId));
      return { groupLabel: g ? groupLabel({ id: Number(g.id), name: String(g.name ?? ""), course: String(g.course ?? "") }) : "", date: String(r.date), stars: Number(r.stars), text: String(r.comment) };
    });

  return {
    ok: true,
    month: opts.month,
    branches: branchRows.filter((b) => opts.branchIds.includes(Number(b.id))).map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
    courses,
    kpi: {
      avg: counted.length ? round1(counted.reduce((a, r) => a + (r.avg ?? 0) * r.count, 0) / counted.reduce((a, r) => a + r.count, 0)) : null,
      count: all,
      teachers: rows.length,
      ratedPct: attended ? Math.round((all / attended) * 100) : null,
      low,
      lowPct: all ? Math.round((low / all) * 100) : 0,
      lowTopTeacher: lowTop,
      comments: cur.filter((r) => String(r.comment ?? "").trim()).length,
    },
    rows,
    attention,
    comments,
  };
}
