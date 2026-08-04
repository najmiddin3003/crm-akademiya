import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { PlannedExpense } from "@/lib/plannedExpenses";

// PATCH /api/planned-expenses/:id — rejalashtirilgan xarajatni tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isFinite(expenseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<PlannedExpense>;
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
  if (body.amount !== undefined) set.amount = Number(body.amount) || 0;
  if (typeof body.type === "string") set.type = body.type;
  if (typeof body.status === "string") set.status = body.status;
  if (body.startDate !== undefined) set.startDate = body.startDate;
  if (body.endDate !== undefined) set.endDate = body.endDate;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("planned_expenses").findOneAndUpdate(
    { id: expenseId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Yozuv topilmadi" }, { status: 404 });
  }
  const { _id, ...expense } = res;
  return NextResponse.json({ ok: true, expense: expense as unknown as PlannedExpense });
}

// DELETE /api/planned-expenses/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isFinite(expenseId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("planned_expenses").deleteOne({ id: expenseId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Yozuv topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
