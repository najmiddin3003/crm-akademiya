import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseLevel, LevelBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// PATCH /api/offline-courses/:id/levels/:levelId — kurs ichidagi bitta darajani
// yangilaydi (positional arrayFilters orqali).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; levelId: string }> }) {
  const { id, levelId } = await params;
  const courseId = Number(id);
  const lId = Number(levelId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { name?: string; color?: string; branches?: LevelBranch[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set["levels.$[l].name"] = body.name.trim();
  if (typeof body.color === "string") set["levels.$[l].color"] = body.color;
  if (Array.isArray(body.branches)) set["levels.$[l].branches"] = body.branches;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("offline_courses").findOneAndUpdate(
    { id: courseId },
    { $set: set },
    { arrayFilters: [{ "l.id": lId }], returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  const level = ((res.levels as CourseLevel[]) ?? []).find((l) => l.id === lId);
  if (!level) {
    return NextResponse.json({ ok: false, error: "Daraja topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, level });
}

// DELETE /api/offline-courses/:id/levels/:levelId — kursdan bitta darajani olib tashlaydi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; levelId: string }> }) {
  const { id, levelId } = await params;
  const courseId = Number(id);
  const lId = Number(levelId);
  if (!Number.isFinite(courseId) || !Number.isFinite(lId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection<OfflineCourse>("offline_courses").updateOne(
    { id: courseId },
    { $pull: { levels: { id: lId } } },
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
