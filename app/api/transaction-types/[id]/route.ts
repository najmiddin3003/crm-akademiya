import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeCustomerTypes } from "@/lib/txTarget";
import type { TransactionType } from "@/lib/transactionTypes";

// PATCH /api/transaction-types/:id — tranzaksiya turini tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<TransactionType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Ismni kiriting" }, { status: 400 });
    set.name = name;
  }
  if (body.minAmount !== undefined) set.minAmount = Number(body.minAmount) || 0;
  if (body.maxAmount !== undefined) set.maxAmount = Number(body.maxAmount) || 0;
  // Ko'p tanlovli. `undefined` — maydon so'rovda kelmagan, ya'ni tegilmaydi;
  // bo'sh ro'yxat esa haqiqiy qiymat ("hech qaysi katakcha belgilanmagan").
  const customerTypes = sanitizeCustomerTypes(body.customerType);
  if (customerTypes !== undefined) set.customerType = customerTypes;
  if (typeof body.mainType === "string") set.mainType = body.mainType;
  if (typeof body.category === "string") set.category = body.category;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("transaction_types").findOneAndUpdate(
    { id: typeId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya turi topilmadi" }, { status: 404 });
  }
  const { _id, ...type } = res;
  return NextResponse.json({ ok: true, type: type as unknown as TransactionType });
}

// DELETE /api/transaction-types/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const typeId = Number(id);
  if (!Number.isFinite(typeId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("transaction_types").deleteOne({ id: typeId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya turi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
