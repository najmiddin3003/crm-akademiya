import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";

// PATCH /api/offline-courses/:id — kurs nomi/rangi/filiallarini yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { name?: string; color?: string; branches?: CourseBranch[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.color === "string") set.color = body.color;
  if (Array.isArray(body.branches)) set.branches = body.branches;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("offline_courses").findOneAndUpdate(
    { id: courseId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  const { _id, ...course } = res;
  return NextResponse.json({ ok: true, course: course as unknown as OfflineCourse });
}

// DELETE /api/offline-courses/:id — kursni o'chiradi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("offline_courses").deleteOne({ id: courseId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
