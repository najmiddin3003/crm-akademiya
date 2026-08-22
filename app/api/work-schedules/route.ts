import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { WorkSchedule } from "@/lib/workSchedules";

// Boshqaruv → Ish jadvali backend'i (MongoDB `work_schedules`). Demo seed
// YO'Q — jadvallarni foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("work_schedules");
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const schedules = rows.map(({ _id, ...rest }) => rest as unknown as WorkSchedule);
  return NextResponse.json({ ok: true, schedules });
}

export async function POST(req: Request) {
  let body: Partial<WorkSchedule>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("work_schedules");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const schedule: WorkSchedule = {
    id: nextId,
    name,
    code: (body.code || "").trim(),
    active: body.active !== false,
  };
  await col.insertOne({ ...schedule });
  return NextResponse.json({ ok: true, schedule });
}
