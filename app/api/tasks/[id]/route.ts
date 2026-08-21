import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isTaskDate, isTaskPriority, isTaskRecurring, isTaskState, type Task } from "@/lib/tasksData";

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

  // Faqat ruxsat etilgan maydonlar yangilanadi va sanab o'tilgan qiymatlar
  // tekshiriladi — `id` yoki begona maydon yozilib qolmasin, yaroqsiz
  // `state`/`priority` esa /tasks sahifasini render bo'lmay qoldiradi.
  const set: Partial<Omit<Task, "id">> = {};
  if (body.state !== undefined) {
    if (!isTaskState(body.state)) {
      return NextResponse.json({ ok: false, error: "Holat noto'g'ri" }, { status: 400 });
    }
    set.state = body.state;
  }
  if (body.priority !== undefined) {
    if (!isTaskPriority(body.priority)) {
      return NextResponse.json({ ok: false, error: "Muhimlik darajasi noto'g'ri" }, { status: 400 });
    }
    set.priority = body.priority;
  }
  if (body.date !== undefined) {
    if (!isTaskDate(body.date)) {
      return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
    }
    set.date = body.date;
  }
  if (body.recurring !== undefined) {
    if (!isTaskRecurring(body.recurring)) {
      return NextResponse.json({ ok: false, error: "Takrorlanish noto'g'ri" }, { status: 400 });
    }
    set.recurring = body.recurring;
  }
  for (const k of ["student", "description", "staff", "type", "group"] as const) {
    if (typeof body[k] === "string") set[k] = body[k];
  }
  if (body.dependsOn !== undefined && Number.isFinite(Number(body.dependsOn))) {
    set.dependsOn = Number(body.dependsOn);
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("tasks").findOneAndUpdate(
    { id: taskId },
    { $set: set },
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
