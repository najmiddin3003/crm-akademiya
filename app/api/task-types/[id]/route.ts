import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeTaskType, type TaskType } from "@/lib/taskTypes";

// PATCH /api/task-types/:id — turni tahrirlash (nomi, rangi, belgisi).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Partial<TaskType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { name, color, icon } = sanitizeTaskType(body);
  if (!name) {
    return NextResponse.json({ ok: false, error: "Tur nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("task_types");

  const others = await col.find({ id: { $ne: typeId } }).toArray();
  if (others.some((t) => String(t.name).trim().toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ ok: false, error: "Bunday nomli tur allaqachon bor" }, { status: 409 });
  }

  const res = await col.findOneAndUpdate(
    { id: typeId },
    { $set: { name, color, icon } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Tur topilmadi" }, { status: 404 });
  }
  const { _id, ...type } = res;
  return NextResponse.json({ ok: true, type: type as unknown as TaskType });
}

// DELETE /api/task-types/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("task_types").deleteOne({ id: typeId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Tur topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
