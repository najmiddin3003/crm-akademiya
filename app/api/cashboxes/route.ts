import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { CASHBOX_SEED } from "@/constants/cashboxes";
import { normalizeCashbox, zeroMethodTotals, type Cashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";

// Moliya → Kassalar backend'i (MongoDB `cashboxes`). Bo'sh bo'lsa demo
// kassalarni seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(CASHBOX_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("cashboxes");
  await seedIfEmpty(col);
  const keys = await loadPaymentMethodKeys(db);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const cashboxes = rows.map(({ _id, ...rest }) => normalizeCashbox({ isPrimary: false, ...rest }, keys));
  return NextResponse.json({ ok: true, cashboxes });
}

export async function POST(req: Request) {
  let body: Partial<Cashbox>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kassa nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("cashboxes");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashbox: Cashbox = {
    id: nextId,
    name,
    balance: 0,
    moderator: body.moderator || "",
    onlinePayment: !!body.onlinePayment,
    archived: !!body.archived,
    isPrimary: false,
    methodTotals: zeroMethodTotals(await loadPaymentMethodKeys(db)),
  };
  await col.insertOne({ ...cashbox });
  return NextResponse.json({ ok: true, cashbox });
}
