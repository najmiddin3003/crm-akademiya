import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import type { TransactionEntry } from "@/lib/transactionEntries";

// POST /api/transaction-entries/:id/cancel — Kassalar sahifasidagi
// tranzaksiya tafsilot oynasidagi "Tranzaksiyani bekor qilish". Faqat
// Kirim/Chiqim (payIn/payOut) yozuvlari uchun: kassaning balansi va shu
// to'lov turi summasi teskari o'zgartiriladi (adjust route'idagi mantiqning
// aksi), "Moliya hisobotlari/analitikasi" (transactions) muvozanatini
// saqlash uchun teskari (-amount) yozuv ham qo'shiladi. Asl yozuv
// o'chirilmaydi — faqat status="cancelled" bo'ladi (audit iz qoladi).
// Ko'chirish (transfer) yozuvlari bu yerda qo'llab-quvvatlanmaydi — ular
// juft yozuv (chiqadigan+kiradigan) sifatida saqlanadi va xavfsiz teskari
// qaytarish uchun alohida ishlov talab qiladi.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const entriesCol = db.collection("transaction_entries");
  const entry = (await entriesCol.findOne({ id: entryId })) as (TransactionEntry & { _id: unknown }) | null;
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (entry.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Tranzaksiya allaqachon bekor qilingan" }, { status: 400 });
  }
  if (entry.txType !== "payIn" && entry.txType !== "payOut") {
    return NextResponse.json({ ok: false, error: "Bu turdagi tranzaksiyani bu yerdan bekor qilib bo'lmaydi" }, { status: 400 });
  }

  const methods = await loadPaymentMethods(db);
  const method = methods.find((m) => m.name === entry.paymentType);

  if (method) {
    const cashboxesCol = db.collection("cashboxes");
    const cashbox = await cashboxesCol.findOne({ id: entry.cashboxId });
    if (cashbox) {
      await cashboxesCol.updateOne(
        { id: entry.cashboxId },
        { $inc: { [`methodTotals.${method.key}`]: -entry.amount, balance: -entry.amount } },
      );
      await logTransaction(db, {
        date: todayIso(),
        time: nowTime(),
        amount: -entry.amount,
        category: `${entry.txName} (bekor qilindi)`,
        method: method.key,
        methodLabel: method.name,
        cashboxId: entry.cashboxId,
      });
    }
  }

  await entriesCol.updateOne({ id: entryId }, { $set: { status: "cancelled" } });
  const updated = await entriesCol.findOne({ id: entryId });
  const { _id, ...rest } = updated as TransactionEntry & { _id: unknown };
  return NextResponse.json({ ok: true, entry: rest });
}
