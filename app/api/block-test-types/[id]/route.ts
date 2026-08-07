import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { BlockTestType, BlockTestSubject } from "@/lib/blockTestTypes";

function normalizeSubjects(input: unknown): BlockTestSubject[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      subject: String((s as Partial<BlockTestSubject>)?.subject || "").trim(),
      questionsCount: parseInt(String((s as Partial<BlockTestSubject>)?.questionsCount ?? ""), 10) || 0,
      pointsPerCorrect: parseFloat(String((s as Partial<BlockTestSubject>)?.pointsPerCorrect ?? "")) || 0,
    }))
    .filter((s) => s.subject);
}

// PATCH /api/block-test-types/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<BlockTestType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.kind === "string") set.kind = body.kind.trim();
  if (body.durationMinutes !== undefined) set.durationMinutes = parseInt(String(body.durationMinutes), 10) || 0;
  if (body.subjects !== undefined) set.subjects = normalizeSubjects(body.subjects);
  if (body.active !== undefined) set.active = !!body.active;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("block_test_types").findOneAndUpdate(
    { id: typeId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Tur topilmadi" }, { status: 404 });
  }
  const { _id, ...type } = res;
  return NextResponse.json({ ok: true, type: type as unknown as BlockTestType });
}

// DELETE /api/block-test-types/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("block_test_types").deleteOne({ id: typeId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Tur topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
