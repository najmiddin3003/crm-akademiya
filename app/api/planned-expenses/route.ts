import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { PLANNED_EXPENSE_SEED } from "@/constants/plannedExpenses";
import type { PlannedExpense } from "@/lib/plannedExpenses";

// Moliya → Rejalashtirilgan xarajatlar backend'i (MongoDB `planned_expenses`).
// Bo'sh bo'lsa demo yozuvni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(PLANNED_EXPENSE_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("planned_expenses");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const expenses = rows.map(({ _id, ...rest }) => rest as unknown as PlannedExpense);
  return NextResponse.json({ ok: true, expenses });
}

export async function POST(req: Request) {
  let body: Partial<PlannedExpense>;
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
  const col = db.collection("planned_expenses");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const expense: PlannedExpense = {
    id: nextId,
    name,
    amount: Number(body.amount) || 0,
    type: body.type || "",
    status: body.status || "",
    startDate: body.startDate || null,
    endDate: body.endDate || null,
  };
  await col.insertOne({ ...expense });
  return NextResponse.json({ ok: true, expense });
}
