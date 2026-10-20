import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { CourseBranch, OfflineCourse } from "@/components/offline-courses/OfflineCoursesProvider";
import { courseNameTaken, sameNameFilter, syncCourseRename } from "@/lib/courseRename";
import { normalizeCourseCategory } from "@/lib/courseCategories";

// PATCH /api/offline-courses/:id — kurs nomi/rangi/filiallarini, KATEGORIYASI va
// HOLATINI (20.10.2026, «Sozlamalar → Kurslar») yangilaydi.
//
//   category — «Chet tillari», «Fanlar» kabi guruhlash (lib/courseCategories.ts);
//              "" — kategoriyasiz;
//   active   — false bo'lsa kurs yangi lid/guruh/xodim oynalaridagi «Kursni
//              tanlang» ro'yxatidan chiqadi (mavjud yozuvlarda qoladi).
//
// NOM O'ZGARSA (20.10.2026) eski nom yozilgan guruh, lid, o'qituvchi va imtihon
// yozuvlari ham yangi nomga ko'chadi — lib/courseRename.ts. Boshqa kursda shu nom
// bo'lsa 409: ikki kursning bog'lanishlari aralashmasin.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { name?: string; color?: string; branches?: CourseBranch[]; category?: string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Kurs nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.color === "string") set.color = body.color;
  if (Array.isArray(body.branches)) set.branches = body.branches;
  if (typeof body.category === "string") set.category = normalizeCourseCategory(body.category);
  if (typeof body.active === "boolean") set.active = body.active;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("offline_courses");
  const before = await col.findOne({ id: courseId }, { projection: { _id: 0, name: 1 } });
  if (!before) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  const oldName = String(before.name ?? "").trim();
  const renaming = typeof set.name === "string" && set.name !== oldName;
  if (renaming && (await courseNameTaken(db, set.name as string, courseId))) {
    return NextResponse.json({ ok: false, error: "Bunday nomli kurs allaqachon bor" }, { status: 409 });
  }

  const res = await col.findOneAndUpdate({ id: courseId }, { $set: set }, { returnDocument: "after" });
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  // Faqat harf kattaligi o'zgarsa ham ko'chiriladi — guruhlarda yangi yozilishi tursin.
  const renamed = renaming ? await syncCourseRename(db, oldName, set.name) : undefined;
  const { _id, ...course } = res;
  return NextResponse.json({ ok: true, course: course as unknown as OfflineCourse, ...(renamed ? { renamed } : {}) });
}

// DELETE /api/offline-courses/:id — kursni o'chiradi.
//
// GURUHDA ISHLATILGAN KURS O'CHMAYDI (20.10.2026): guruh kursga NOMI bilan bog'langan
// (`groups.course`) — kurs o'chsa guruh tahriri «kurs topilmadi» deydi, qarzdorlar
// hisobotida narx yo'qoladi. 409 + guruhlar soni; bunday kurs «Nofaol» qilinadi
// (yangi tanlovlardan chiqadi, guruhlarda qoladi).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isFinite(courseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const current = await db.collection("offline_courses").findOne({ id: courseId }, { projection: { _id: 0, name: 1 } });
  if (!current) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  const inGroups = await db.collection("groups").countDocuments({ course: sameNameFilter(String(current.name ?? "")) });
  if (inGroups > 0) {
    return NextResponse.json(
      { ok: false, error: `Bu kurs ${inGroups} ta guruhda — o'chirib bo'lmaydi. Uni nofaol qiling.`, groups: inGroups },
      { status: 409 },
    );
  }
  const res = await db.collection("offline_courses").deleteOne({ id: courseId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
