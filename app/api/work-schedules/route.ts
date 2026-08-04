import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { WORK_SCHEDULE_SEED } from "@/constants/workSchedules";
import type { WorkSchedule } from "@/lib/workSchedules";

// Boshqaruv → Ish jadvali backend'i (MongoDB `work_schedules`). Bo'sh bo'lsa
// demo rejimlarni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(WORK_SCHEDULE_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("work_schedules");
  await seedIfEmpty(col);
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
