import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Task } from "@/lib/tasksData";

// PATCH /api/tasks/:id — mavjud topshiriqni yangilaydi (holat, sana, va h.k.).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Partial<Omit<Task, "id">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("tasks").findOneAndUpdate(
    { id: taskId },
    { $set: body },
    { returnDocument: "after" },
  );

  if (!res) {
    return NextResponse.json({ ok: false, error: "Topshiriq topilmadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, task: res });
}

// DELETE /api/tasks/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("tasks").deleteOne({ id: taskId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Topshiriq topilmadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
