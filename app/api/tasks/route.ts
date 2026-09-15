import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { resolveStaffId, taskAuthorOf } from "@/lib/taskStaff";
import {
  isTaskDate,
  isTaskPriority,
  isTaskRecurring,
  isTaskState,
  isTaskTargetKind,
  parseTaskAuthor,
  parseTaskReport,
  type Task,
} from "@/lib/tasksData";

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
    // `null` ham, yo'q maydon ham "bog'lanmagan" (Number(null) === 0).
    staffId: Number(r.staffId) > 0 ? Number(r.staffId) : undefined,
    type: r.type ?? undefined,
    group: r.group ?? undefined,
    targetKind: isTaskTargetKind(r.targetKind) ? r.targetKind : undefined,
    state: isTaskState(r.state) ? r.state : "yangi",
    priority: isTaskPriority(r.priority) ? r.priority : "orta",
    recurring: isTaskRecurring(r.recurring) ? r.recurring : "none",
    dependsOn: r.dependsOn ?? undefined,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : undefined,
    createdBy: parseTaskAuthor(r.createdBy),
    report: parseTaskReport(r.report),
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

  // Muallif — hisobot shu odamga qaytadi (xodim oynasi, app/api/tasks/inbox).
  // Proxy sessiyani allaqachon tekshirgan; bu yerda `null` faqat sessiya
  // shu lahzada uzilganida bo'ladi.
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("tasks");
  const staff = typeof body.staff === "string" ? body.staff : undefined;
  const [last, staffId, createdBy] = await Promise.all([
    col.find({}).sort({ id: -1 }).limit(1).toArray(),
    // Mas'ul xodim ID'GA bog'lanadi — ism satri xodim oynasiga yetarli emas
    // (lib/tasksData.ts dagi `staffId` izohi).
    resolveStaffId(db, body.staffId, staff),
    taskAuthorOf(db, me),
  ]);
  const nextId = (last[0]?.id ?? 0) + 1;

  // Yozuvni maydonma-maydon yig'amiz — mijoz yuborgan begona maydonlar
  // (va `id`, `report`, `createdBy`) bazaga tushmaydi.
  const task: Task = {
    id: nextId,
    student: String(body.student).trim(),
    date: body.date,
    description: typeof body.description === "string" ? body.description : "",
    staff,
    staffId,
    type: typeof body.type === "string" ? body.type : undefined,
    group: typeof body.group === "string" ? body.group : undefined,
    targetKind: isTaskTargetKind(body.targetKind) ? body.targetKind : undefined,
    state: body.state,
    priority: body.priority,
    recurring: isTaskRecurring(body.recurring) ? body.recurring : "none",
    dependsOn: Number.isFinite(Number(body.dependsOn)) ? Number(body.dependsOn) : undefined,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await col.insertOne({ ...task });

  return NextResponse.json({ ok: true, task });
}
