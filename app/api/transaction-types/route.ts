import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { TransactionType } from "@/lib/transactionTypes";

// Moliya → Tranzaksiya turi backend'i (MongoDB `transaction_types`). Demo
// seed YO'Q — turlarni foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("transaction_types");
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const types = rows.map(({ _id, ...rest }) => rest as unknown as TransactionType);
  return NextResponse.json({ ok: true, types });
}

export async function POST(req: Request) {
  let body: Partial<TransactionType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Ismni kiriting" }, { status: 400 });
  }
  const mainType = body.mainType || "kirim";
  const category = body.category || "Kirim";

  const db = await ensureIndexes();
  const col = db.collection("transaction_types");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const type: TransactionType = {
    id: nextId,
    name,
    minAmount: Number(body.minAmount) || 0,
    maxAmount: Number(body.maxAmount) || 0,
    customerType: body.customerType || "Boshqa",
    mainType,
    category,
  };
  await col.insertOne({ ...type });
  return NextResponse.json({ ok: true, type });
}
