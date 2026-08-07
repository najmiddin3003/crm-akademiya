import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { BlockTestExam } from "@/lib/blockTestExams";

function toIdArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => Number(v)).filter((v) => Number.isFinite(v));
}

// PATCH /api/block-test-exams/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<BlockTestExam>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (body.typeId !== undefined) set.typeId = body.typeId === null ? null : Number(body.typeId);
  if (typeof body.date === "string") set.date = body.date.trim();
  if (typeof body.startTime === "string") set.startTime = body.startTime.trim();
  if (body.durationMinutes !== undefined) set.durationMinutes = parseInt(String(body.durationMinutes), 10) || 0;
  if (body.groupIds !== undefined) set.groupIds = toIdArray(body.groupIds);
  if (body.responsibleEmployeeId !== undefined) set.responsibleEmployeeId = body.responsibleEmployeeId === null ? null : Number(body.responsibleEmployeeId);
  if (typeof body.comment === "string") set.comment = body.comment.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("block_test_exams").findOneAndUpdate(
    { id: examId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Blok test topilmadi" }, { status: 404 });
  }
  const { _id, ...exam } = res;
  return NextResponse.json({ ok: true, exam: exam as unknown as BlockTestExam });
}

// DELETE /api/block-test-exams/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("block_test_exams").deleteOne({ id: examId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Blok test topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
