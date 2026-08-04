import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";

// POST /api/cashboxes/:id/set-primary — shu kassani "Bosh kassa" qiladi
// (Kassalar sahifasidagi toj belgisi). Bir vaqtda faqat bitta kassa bosh
// bo'lishi mumkin — avval barcha kassalarda isPrimary'ni o'chiradi, so'ng
// shu birini yoqadi.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("cashboxes");
  const existing = await col.findOne({ id: cashboxId });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  await col.updateMany({ id: { $ne: cashboxId } }, { $set: { isPrimary: false } });
  const res = await col.findOneAndUpdate(
    { id: cashboxId },
    { $set: { isPrimary: true } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }
  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, await loadPaymentMethodKeys(db)) });
}
