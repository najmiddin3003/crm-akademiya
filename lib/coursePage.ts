import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { uzDateIso } from "@/lib/uzTime";
import type { CourseBook, CoursePage, CourseTeacherRow } from "@/lib/coursePageTypes";

// KURS SAHIFASI (36-qism, rasm «Kurs sahifasi») — bitta kurs: darajalar va narx, ustozlar, dars vaqtlari, kitoblar.
// Hammasi guruhlardan yig'iladi (qo'lda kiritilmaydi): daraja — guruhning `level` i (kurs darajalari ro'yxati
// bilan birga), narx — lib/coursePrice.ts qoidasi, ustoz — `teacher`, vaqt — `day` + `time`. O'quvchi — ochiq
// a'zolik (`group_memberships`, leftAt: null). Davomat — joriy oy, keldi/kechikdi/birinchi ÷ jami belgi.
// Kitoblar — `course_books` (kurs + daraja); «o'quvchida» — shu darajadagi guruhlar o'quvchilari.

export const COURSE_BOOKS = "course_books";
const PRESENT = ["keldi", "kechikdi", "birinchi"];
const archived = (g: Record<string, unknown>) => ["archived", "closed", "arxiv"].includes(String(g.status ?? ""));

function dayKind(day: string): "odd" | "even" | "other" {
  const d = day.toLowerCase();
  if (d.includes("toq") || /du.*chor.*ju|1,3,5/.test(d)) return "odd";
  if (d.includes("juft") || /se.*pay.*sh|2,4,6/.test(d)) return "even";
  return "other";
}

async function attendancePct(db: Db, groupIds: number[] | null, month: string): Promise<number | null> {
  const match: Record<string, unknown> = { date: { $gte: `${month}-01`, $lte: `${month}-31` } };
  if (groupIds) match.groupId = { $in: groupIds };
  const r = await db
    .collection("attendance")
    .aggregate([{ $match: match }, { $group: { _id: null, all: { $sum: 1 }, ok: { $sum: { $cond: [{ $in: ["$status", PRESENT] }, 1, 0] } } } }])
    .toArray();
  return r[0]?.all ? Math.round((r[0].ok / r[0].all) * 100) : null;
}

export async function coursePage(db: Db, courseId: number, branchIds: number[], branchId: number): Promise<CoursePage | null> {
  const course = await db.collection("offline_courses").findOne({ id: courseId }, { projection: { _id: 0 } });
  if (!course) return null;
  const name = String(course.name);
  const month = uzDateIso().slice(0, 7);
  const [groupsAll, branches, books] = await Promise.all([
    db.collection("groups").find({ course: name, ...branchInCondition(branchIds) }, { projection: { _id: 0 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    db.collection<CourseBook>(COURSE_BOOKS).find({ courseId }, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
  ]);
  const groups = groupsAll.filter((g) => !archived(g));
  const gIds = groups.map((g) => Number(g.id));
  const mem = await db.collection(GROUP_MEMBERSHIPS).find({ groupId: { $in: gIds }, leftAt: null }, { projection: { _id: 0, groupId: 1, pupilId: 1 } }).toArray();
  const pupilsOf = new Map<number, Set<number>>();
  for (const m of mem) pupilsOf.set(Number(m.groupId), (pupilsOf.get(Number(m.groupId)) ?? new Set()).add(Number(m.pupilId)));
  const count = (gs: Record<string, unknown>[]) => new Set(gs.flatMap((g) => [...(pupilsOf.get(Number(g.id)) ?? [])])).size;
  const bName = new Map(branches.map((b) => [Number(b.id), String(b.name)]));

  const levelNames = [...new Set([...((course.levels ?? []) as { name: string }[]).map((l) => String(l.name)), ...groups.map((g) => String(g.level ?? "").trim()).filter(Boolean)])];
  const levels = levelNames.map((lv) => {
    const gs = groups.filter((g) => String(g.level ?? "").trim() === lv);
    return { name: lv, price: monthlyPriceFor({ course: name, level: lv, branchId }, [course as unknown as PricedCourse]), groups: gs.length, pupils: count(gs) };
  });
  const noLevel = groups.filter((g) => !String(g.level ?? "").trim());
  if (noLevel.length || !levels.length) levels.push({ name: "Darajasiz", price: monthlyPriceFor({ course: name, level: "", branchId }, [course as unknown as PricedCourse]), groups: noLevel.length, pupils: count(noLevel) });

  const tMap = new Map<string, Record<string, unknown>[]>();
  for (const g of groups) {
    const t = String(g.teacher ?? "").trim();
    if (t) tMap.set(t, [...(tMap.get(t) ?? []), g]);
  }
  const teachers: CourseTeacherRow[] = [...tMap.entries()]
    .map(([t, gs]) => ({ name: t, levels: [...new Set(gs.map((g) => String(g.level ?? "").trim()).filter(Boolean))], pupils: count(gs), groups: gs.length, branches: [...new Set(gs.map((g) => bName.get(Number(g.branchId) || 1) ?? ""))] }))
    .sort((a, b) => b.pupils - a.pupils);

  const tm = new Map<string, { time: string; odd: number; even: number; other: number }>();
  for (const g of groups) {
    const time = String(g.time ?? "").trim().replace(/\s*-\s*/, "–");
    if (!time) continue;
    const x = tm.get(time) ?? { time, odd: 0, even: 0, other: 0 };
    x[dayKind(String(g.day ?? ""))] += 1;
    tm.set(time, x);
  }

  const byBranch = new Map<string, number>();
  for (const g of groups) {
    const b = bName.get(Number(g.branchId) || 1) ?? "—";
    byBranch.set(b, (byBranch.get(b) ?? 0) + 1);
  }
  const [att, center] = await Promise.all([gIds.length ? attendancePct(db, gIds, month) : null, attendancePct(db, null, month)]);
  return {
    ok: true,
    course: { id: courseId, name, category: String(course.category ?? ""), branches: ((course.branches ?? []) as { enabled: boolean }[]).filter((b) => b.enabled).length },
    kpi: { groups: groups.length, byBranch: [...byBranch.entries()].map(([n, c]) => ({ name: n, n: c })), pupils: count(groups), teachers: teachers.length, topTeacher: teachers[0] ? { name: teachers[0].name, pupils: teachers[0].pupils } : null, attendance: att, centerAttendance: center, month },
    levels,
    teachers,
    times: [...tm.values()].sort((a, b) => a.time.localeCompare(b.time)),
    books: books.map((b) => ({ ...b, pupils: count(groups.filter((g) => !b.level || String(g.level ?? "").trim() === b.level)) })),
  };
}

export async function saveBook(db: Db, b: { id?: number; courseId?: number; name?: string; author?: string; level?: string; delete?: boolean }) {
  const col = db.collection<CourseBook>(COURSE_BOOKS);
  if (b.id && b.delete) {
    await col.deleteOne({ id: Number(b.id) });
    return { ok: true as const };
  }
  const name = String(b.name ?? "").trim().slice(0, 120);
  if (!name) return { ok: false as const, error: "Kitob nomini yozing" };
  const fields = { name, author: String(b.author ?? "").trim().slice(0, 80), level: String(b.level ?? "").trim().slice(0, 80) };
  if (b.id) {
    await col.updateOne({ id: Number(b.id) }, { $set: fields });
    return { ok: true as const };
  }
  if (!Number(b.courseId)) return { ok: false as const, error: "Kurs tanlanmagan" };
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  await col.insertOne({ id: (Number(last[0]?.id) || 0) + 1, courseId: Number(b.courseId), ...fields });
  return { ok: true as const };
}
