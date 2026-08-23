import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { pickCourseFields, type OnlineCourse } from "@/lib/onlineCourses";

// PATCH /api/online-courses/:id — g'ilofchidagi maydonlarni yangilaydi.
// `published` alohida: detail sahifasidagi Published/Unpublished tugmasi
// faqat shuni yuboradi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = { ...pickCourseFields(body) };
  if (typeof body.published === "boolean") set.published = body.published;

  if ("name" in set && !set.name) {
    return NextResponse.json({ ok: false, error: "Kurs nomini kiriting" }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("online_courses").findOneAndUpdate(
    { id: courseId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  const { _id, ...course } = res;
  return NextResponse.json({ ok: true, course: course as unknown as OnlineCourse });
}

// DELETE /api/online-courses/:id — kursni o'chiradi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("online_courses").deleteOne({ id: courseId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
