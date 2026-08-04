import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SeasonalAssessment } from "@/lib/seasonalAssessments";

// PATCH /api/seasonal-assessments/:id — bahoni (ball/izoh) tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isFinite(assessmentId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<SeasonalAssessment>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (body.ball !== undefined) set.ball = Number(body.ball) || 0;
  if (typeof body.izoh === "string") set.izoh = body.izoh.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("seasonal_assessments").findOneAndUpdate(
    { id: assessmentId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Baho topilmadi" }, { status: 404 });
  }
  const { _id, ...assessment } = res;
  return NextResponse.json({ ok: true, assessment: assessment as unknown as SeasonalAssessment });
}

// DELETE /api/seasonal-assessments/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = Number(id);
  if (!Number.isFinite(assessmentId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("seasonal_assessments").deleteOne({ id: assessmentId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Baho topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
