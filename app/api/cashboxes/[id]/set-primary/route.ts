import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";
import { getCurrentEmployee } from "@/lib/currentEmployee";

// POST /api/cashboxes/:id/set-primary — shu kassani "Bosh kassa" qiladi
// (Kassalar sahifasidagi toj belgisi). Bir vaqtda faqat bitta kassa bosh
// bo'lishi mumkin — avval barcha kassalarda isPrimary'ni o'chiradi, so'ng
// shu birini yoqadi.
//
// FAQAT ADMIN. Bu amal BOSHQA kassalarga ham tegadi (`updateMany` bilan
// ularning `isPrimary` ini o'chiradi), ya'ni kassir o'z kassasidan
// tashqaridagi holatni o'zgartirardi. Ilgari bu yerda hech qanday
// tekshiruv yo'q edi.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!me.isAdmin) {
    return NextResponse.json({ ok: false, error: "Bu amal faqat administrator uchun" }, { status: 403 });
  }

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
