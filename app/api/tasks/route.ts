import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Task } from "@/lib/tasksData";

// GET /api/tasks — barcha topshiriqlar ro'yxati.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("tasks").find({}).sort({ id: 1 }).toArray();
  const tasks: Task[] = rows.map((r) => ({
    id: r.id,
    student: r.student,
    date: r.date,
    description: r.description,
    staff: r.staff ?? undefined,
    type: r.type ?? undefined,
    group: r.group ?? undefined,
    state: r.state,
    priority: r.priority,
    recurring: r.recurring,
    dependsOn: r.dependsOn ?? undefined,
  }));
  return NextResponse.json({ ok: true, tasks });
}

// POST /api/tasks — yangi topshiriq qo'shadi (bazaga yoziladi).
export async function POST(req: Request) {
  let body: Omit<Task, "id">;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!body.student || !body.date || !body.state || !body.priority) {
    return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("tasks");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const task: Task = { ...body, id: nextId };
  await col.insertOne(task);

  return NextResponse.json({ ok: true, task });
}
