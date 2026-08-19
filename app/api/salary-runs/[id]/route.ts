import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// DELETE /api/salary-runs/:id — Moliya → Oylik chiqarish jadvalidagi bitta
// tarixiy chiqarishni o'chirish (referens dizaynda AMALLAR ustunidagi
// savatcha tugmasi). Audit-log emas, ro'yxatdagi bitta partiya olib
// tashlanadi; qaytarilishi mumkin emas — klient tomonda tasdiqlash beriladi.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false, error: "Noto'g'ri ID" }, { status: 400 });
  const db = await ensureIndexes();
  const res = await db.collection("salary_runs").deleteOne({ id: n });
  if (res.deletedCount === 0) return NextResponse.json({ ok: false, error: "Topilmadi" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false, error: "Noto'g'ri ID" }, { status: 400 });
  const db = await ensureIndexes();
  const row = await db.collection("salary_runs").findOne({ id: n });
  if (!row) return NextResponse.json({ ok: false, error: "Topilmadi" }, { status: 404 });
  const { _id, ...rest } = row;
  return NextResponse.json({ ok: true, run: rest });
}
