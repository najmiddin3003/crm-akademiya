import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { groupScopeFilter } from "@/lib/groupScope";
import type { OnlineCourse } from "@/lib/onlineCourses";

// "Kurs biriktirish" drawer'ining backend'i (components/online-courses/BindCourseDrawer.tsx).
//
// Ilgari o'sha oynadagi "Saqlash" HECH NARSA saqlamasdi — faqat "Biriktirildi"
// toastini ko'rsatib yopilardi, ya'ni foydalanuvchiga bo'lmagan ish haqida
// xabar berardi. Endi biriktirish onlayn kurs hujjatiga yoziladi:
//
//   • Guruh  → `groupIds` massiviga qo'shiladi ($addToSet — takror bo'lmaydi)
//   • Kurs   → `categoryId` (O'quv bo'limi → Kategoriya, /api/edu-categories)
//
// `categoryId` lib/onlineCourses.ts dagi OnlineCourse'da allaqachon bor;
// `groupIds` esa faqat shu yerda paydo bo'ladi, shuning uchun quyida mahalliy
// kengaytma tipi bilan qaytariladi.
export type BoundOnlineCourse = OnlineCourse & { groupIds?: number[] };

/**
 * Kolleksiyaning shu route uchun kerakli qismi — terilgan kolleksiyasiz
 * mongodb drayveri `$addToSet`/`$pull` maydonini massiv deb bilmaydi.
 */
interface OnlineCourseDoc {
  id: number;
  groupIds?: number[];
  categoryId?: number | null;
}

function parseCourseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// POST /api/online-courses/:id/bind — { groupId } yoki { categoryId }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = parseCourseId(id);
  if (courseId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { groupId?: unknown; categoryId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection<OnlineCourseDoc>("online_courses");

  const groupId = typeof body.groupId === "number" && Number.isFinite(body.groupId) ? body.groupId : null;
  const categoryId = typeof body.categoryId === "number" && Number.isFinite(body.categoryId) ? body.categoryId : null;

  if (groupId === null && categoryId === null) {
    return NextResponse.json({ ok: false, error: "Guruh yoki kurs tanlang" }, { status: 400 });
  }

  // Biriktirilayotgan yozuv HAQIQATAN bazada borligini tekshiramiz — aks holda
  // kursga mavjud bo'lmagan guruh/kategoriya id'si yozilib qolardi.
  if (groupId !== null) {
    // Guruh JORIY FILIALDA bo'lishi shart — aks holda boshqa filialning
    // guruhini onlayn kursga biriktirib, uni shu orqali ko'rib olardi.
    const where = await groupScopeFilter({ id: groupId });
    if (!where) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
    const group = await db.collection("groups").findOne(where, { projection: { id: 1 } });
    if (!group) {
      return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
    }
  }
  if (categoryId !== null) {
    const category = await db.collection("edu_categories").findOne({ id: categoryId }, { projection: { id: 1 } });
    if (!category) {
      return NextResponse.json({ ok: false, error: "Kurs kategoriyasi topilmadi" }, { status: 404 });
    }
  }

  // Ikki shoxni alohida yozamiz — birlashtirilgan `update` obyekti
  // drayverning UpdateFilter tipiga tushmaydi.
  const res = groupId !== null
    ? await col.findOneAndUpdate({ id: courseId }, { $addToSet: { groupIds: groupId } }, { returnDocument: "after" })
    : await col.findOneAndUpdate({ id: courseId }, { $set: { categoryId } }, { returnDocument: "after" });
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }

  const { _id, ...course } = res;
  return NextResponse.json({ ok: true, course: course as unknown as BoundOnlineCourse });
}

// DELETE /api/online-courses/:id/bind?groupId=12 — biriktirishni bekor qiladi.
// groupId berilmasa kategoriya biriktiruvi olib tashlanadi.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseId = parseCourseId(id);
  if (courseId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const raw = new URL(req.url).searchParams.get("groupId");
  const groupId = raw === null ? null : Number(raw);
  if (raw !== null && !Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri groupId" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection<OnlineCourseDoc>("online_courses");
  const res = groupId !== null
    ? await col.findOneAndUpdate({ id: courseId }, { $pull: { groupIds: groupId } }, { returnDocument: "after" })
    : await col.findOneAndUpdate({ id: courseId }, { $set: { categoryId: null } }, { returnDocument: "after" });
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
  }

  const { _id, ...course } = res;
  return NextResponse.json({ ok: true, course: course as unknown as BoundOnlineCourse });
}
