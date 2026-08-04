import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { WorkSchedule } from "@/lib/workSchedules";

// PATCH /api/work-schedules/:id — ish rejimini tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isFinite(scheduleId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<WorkSchedule>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.code === "string") set.code = body.code.trim();
  if (typeof body.active === "boolean") set.active = body.active;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("work_schedules").findOneAndUpdate(
    { id: scheduleId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Ish jadvali topilmadi" }, { status: 404 });
  }
  const { _id, ...schedule } = res;
  return NextResponse.json({ ok: true, schedule: schedule as unknown as WorkSchedule });
}

// DELETE /api/work-schedules/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);
  if (!Number.isFinite(scheduleId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("work_schedules").deleteOne({ id: scheduleId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Ish jadvali topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
