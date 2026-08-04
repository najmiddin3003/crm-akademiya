import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { EduCategory } from "@/lib/eduCategories";

// PATCH /api/edu-categories/:id — kategoriyani yangilaydi (tahrirlash).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<EduCategory>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kategoriya nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("edu_categories").findOneAndUpdate(
    { id: categoryId },
    { $set: { name } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kategoriya topilmadi" }, { status: 404 });
  }
  const { _id, ...category } = res;
  return NextResponse.json({ ok: true, category: category as unknown as EduCategory });
}

// DELETE /api/edu-categories/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("edu_categories").deleteOne({ id: categoryId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kategoriya topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
