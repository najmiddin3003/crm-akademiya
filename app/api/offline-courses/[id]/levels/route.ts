import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseLevel, LevelBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// POST /api/offline-courses/:id/levels — kursning `levels` massiviga yangi
// daraja qo'shadi (daraja id'si shu kurs ichida avtomatik oshiriladi).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { name?: string; color?: string; branches?: LevelBranch[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Daraja nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection<OfflineCourse>("offline_courses");
  const course = await col.findOne({ id: courseId });
  if (!course) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }

  const levels = course.levels ?? [];
  const nextLevelId = levels.reduce((max, l) => Math.max(max, l.id), 0) + 1;
  const level: CourseLevel = {
    id: nextLevelId,
    name,
    color: body.color || "#000000",
    branches: body.branches ?? [],
  };
  await col.updateOne({ id: courseId }, { $push: { levels: level } });
  return NextResponse.json({ ok: true, level });
}
