import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// DELETE /api/bonuses/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bonusId = Number(id);
  if (!Number.isFinite(bonusId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("bonuses").deleteOne({ id: bonusId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Bonus topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
