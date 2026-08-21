import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isTaskDate, isTaskPriority, isTaskRecurring, isTaskState, type Task } from "@/lib/tasksData";

// GET /api/tasks — barcha topshiriqlar ro'yxati.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("tasks").find({}).sort({ id: 1 }).toArray();
  // POST/PATCH endi qiymatlarni tekshiradi, lekin bazada eskidan qolgan yoki
  // import orqali tushgan yaroqsiz yozuv bo'lishi mumkin. Bunday qatorni
  // yashirmasdan eng yaqin haqiqiy qiymatga keltiramiz — aks holda mijozdagi
  // guruhlash undefined'ga urilib, butun sahifa render bo'lmaydi.
  const tasks: Task[] = rows.map((r) => ({
    id: r.id,
    student: r.student,
    date: isTaskDate(r.date) ? r.date : new Date().toISOString(),
    description: r.description,
    staff: r.staff ?? undefined,
    type: r.type ?? undefined,
    group: r.group ?? undefined,
    state: isTaskState(r.state) ? r.state : "yangi",
    priority: isTaskPriority(r.priority) ? r.priority : "orta",
    recurring: isTaskRecurring(r.recurring) ? r.recurring : "none",
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
  // Qiymatlar ro'yxatdagilardan bo'lishi shart — aks holda yozuv bazaga
  // tushadi-yu, /tasks sahifasi uni guruhlay olmay render bo'lmaydi.
  if (!isTaskState(body.state)) {
    return NextResponse.json({ ok: false, error: "Holat noto'g'ri" }, { status: 400 });
  }
  if (!isTaskPriority(body.priority)) {
    return NextResponse.json({ ok: false, error: "Muhimlik darajasi noto'g'ri" }, { status: 400 });
  }
  if (!isTaskDate(body.date)) {
    return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("tasks");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Yozuvni maydonma-maydon yig'amiz — mijoz yuborgan begona maydonlar
  // (va `id`) bazaga tushmaydi.
  const task: Task = {
    id: nextId,
    student: String(body.student).trim(),
    date: body.date,
    description: typeof body.description === "string" ? body.description : "",
    staff: typeof body.staff === "string" ? body.staff : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    group: typeof body.group === "string" ? body.group : undefined,
    state: body.state,
    priority: body.priority,
    recurring: isTaskRecurring(body.recurring) ? body.recurring : "none",
    dependsOn: Number.isFinite(Number(body.dependsOn)) ? Number(body.dependsOn) : undefined,
  };
  await col.insertOne({ ...task });

  return NextResponse.json({ ok: true, task });
}
