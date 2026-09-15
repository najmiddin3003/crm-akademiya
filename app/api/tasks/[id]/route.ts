import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { resolveStaffId } from "@/lib/taskStaff";
import { isTaskDate, isTaskPriority, isTaskRecurring, isTaskState, isTaskTargetKind, type Task } from "@/lib/tasksData";
import { uzParseStamp } from "@/lib/uzTime";

// PATCH /api/tasks/:id — mavjud topshiriqni yangilaydi (holat, sana, va h.k.).
//
// HISOBOT QACHON O'CHADI. Xodim "bajarilmadi" deb javob bergach topshiriq
// "Kutilmoqda" ustuniga tushadi va rahbar uni qayta beradi: yangi muddat
// qo'yadi yoki boshqa xodimga biriktiradi. Shunda eski hisobot o'chiriladi
// va topshiriq xodim oynasiga QAYTADAN tushadi — aks holda qayta berilgan
// topshiriqni hech kim ko'rmasdi. Xuddi shu holat kanbanda "Yangi"
// ustuniga qaytarilganda ham ("boshidan").
//
// Sana TAQQOSLASHI lahza bo'yicha (`uzParseStamp`), satr bo'yicha emas:
// tahrirlash oynasi sanani har safar qaytadan yig'adi va o'zgarmagan
// sana ham boshqa satr bo'lib kelishi mumkin.
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
  if (body.targetKind !== undefined && isTaskTargetKind(body.targetKind)) {
    set.targetKind = body.targetKind;
  }
  if (body.dependsOn !== undefined && Number.isFinite(Number(body.dependsOn))) {
    set.dependsOn = Number(body.dependsOn);
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("tasks");
  // Mavjud yozuv KERAK: mas'ul/sana o'zgardimi — shuni bilmasdan hisobotni
  // o'chirish-o'chirmaslikni hal qilib bo'lmaydi.
  const prev = await col.findOne({ id: taskId }, { projection: { _id: 0, staffId: 1, date: 1, state: 1, report: 1 } });
  if (!prev) {
    return NextResponse.json({ ok: false, error: "Topshiriq topilmadi" }, { status: 404 });
  }

  const update: { $set: Record<string, unknown>; $unset?: Record<string, ""> } = { $set: { ...set } };
  // `null` ham, yo'q maydon ham "bog'lanmagan" (Number(null) === 0).
  const prevStaffId = Number(prev.staffId) > 0 ? Number(prev.staffId) : undefined;
  // Mas'ul yoki muddat o'zgardi — lekin bu faqat OCHIQ topshiriqni qayta
  // beradi. "Bajarilgan" topshiriqning sanasini to'g'rilash uni qayta
  // ochmasin; uni qayta berishning aniq yo'li — kanbanda "Yangi" ga surish.
  let changed = false;

  // Mas'ul xodim — id'ga bog'lanadi (POST bilan bir xil qoida,
  // lib/taskStaff.ts). Ism bo'shatilsa id ham ketadi.
  if (set.staff !== undefined || body.staffId !== undefined) {
    const staffId = set.staff === "" ? undefined : await resolveStaffId(db, body.staffId, set.staff);
    if (staffId === undefined) update.$unset = { ...update.$unset, staffId: "" };
    else update.$set.staffId = staffId;
    if (staffId !== prevStaffId) changed = true;
  }
  if (set.date !== undefined) {
    const a = uzParseStamp(prev.date);
    const b = uzParseStamp(set.date);
    if (a === null || b === null || Math.abs(a - b) >= 60_000) changed = true;
  }

  const reissued = set.state === "yangi" || (changed && prev.state !== "bajarilgan");
  if (reissued && prev.report) {
    update.$unset = { ...update.$unset, report: "" };
    // "Bajarilmadi" dan keyin topshiriq "Kutilmoqda" da turgan bo'ladi;
    // qayta berilgani kanbanda ham "Yangi" bo'lib ko'rinsin.
    if (set.state === undefined) update.$set.state = "yangi";
  }

  const res = await col.findOneAndUpdate({ id: taskId }, update, { returnDocument: "after" });
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
