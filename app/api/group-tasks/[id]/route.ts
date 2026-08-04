import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { formatDeadline, type GroupTask } from "@/lib/groupTasks";

// PATCH /api/group-tasks/:id — vazifani yangilaydi (Barcha vazifalar edit).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<GroupTask> & { maxScore?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.type === "string") set.type = body.type;
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.deadline === "string") set.deadline = formatDeadline(body.deadline);
  if (typeof body.note === "string") set.note = body.note.trim();
  if (typeof body.fileName === "string") set.fileName = body.fileName.trim();
  if (body.maxScore !== undefined) set.maxScore = parseInt(String(body.maxScore), 10) || 0;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("group_tasks").findOneAndUpdate(
    { id: taskId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Vazifa topilmadi" }, { status: 404 });
  }
  const { _id, ...task } = res;
  return NextResponse.json({ ok: true, task: task as unknown as GroupTask });
}

// DELETE /api/group-tasks/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("group_tasks").deleteOne({ id: taskId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Vazifa topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
