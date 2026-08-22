import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SeasonalAssessment, SeasonalAssessmentEntry } from "@/lib/seasonalAssessments";

// O'quv bo'limi → Mavsumiy baholash backend'i (MongoDB `seasonal_assessments`).
// Demo seed YO'Q — baholarni foydalanuvchi o'zi kiritadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("seasonal_assessments");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const assessments = rows.map(({ _id, ...rest }) => rest as unknown as SeasonalAssessment);
  return NextResponse.json({ ok: true, assessments });
}

// POST — "Baholash" qo'shish sahifasidan: bitta oy+guruh uchun bir nechta
// o'quvchining bahosini bir yo'la saqlaydi (har biri alohida yozuv sifatida).
export async function POST(req: Request) {
  let body: {
    month?: number;
    course?: string;
    groupId?: number;
    groupName?: string;
    teacher?: string;
    entries?: SeasonalAssessmentEntry[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const month = Number(body.month);
  const groupId = Number(body.groupId);
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: "Oyni tanlang" }, { status: 400 });
  }
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Guruhni tanlang" }, { status: 400 });
  }
  if (entries.length === 0) {
    return NextResponse.json({ ok: false, error: "Baholanadigan o'quvchi yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("seasonal_assessments");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  let nextId = (last[0]?.id ?? 0) + 1;

  const assessments: SeasonalAssessment[] = entries.map((e) => ({
    id: nextId++,
    month,
    course: body.course || "",
    groupId,
    groupName: body.groupName || String(groupId),
    teacher: body.teacher || "",
    studentId: Number(e.studentId),
    studentName: e.studentName || "",
    ball: Number(e.ball) || 0,
    izoh: (e.izoh || "").trim(),
  }));

  await col.insertMany(assessments.map((a) => ({ ...a })));
  return NextResponse.json({ ok: true, assessments });
}
