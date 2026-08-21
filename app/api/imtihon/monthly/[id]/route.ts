import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// DELETE /api/imtihon/monthly/:id — bitta oylik imtihon natijasini o'chiradi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("monthly_exams").deleteOne({ id: examId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Natija topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
