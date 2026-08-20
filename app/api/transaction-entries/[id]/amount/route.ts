import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import type { TransactionEntry } from "@/lib/transactionEntries";

// POST /api/transaction-entries/:id/amount — Kassalar sahifasidagi
// tranzaksiya tafsilot oynasidagi "Miqdorni tahrirlash". So'rovda summaning
// FAQAT KATTALIGI keladi (musbat son), yo'nalish esa asl yozuvdan olinadi:
// Kirim Kirimligicha, Chiqim Chiqimligicha qoladi — tahrirlash pulning
// yo'nalishini o'zgartirmasligi kerak.
//
// Farq (delta) kassaning balansiga va shu to'lov turi summasiga qo'llanadi,
// "Moliya hisobotlari/analitikasi" (transactions) muvozanati saqlanishi
// uchun delta qiymatli qo'shimcha yozuv ham qo'shiladi. Asl yozuv
// o'chirilmaydi — uning `amount`/`after` maydonlari yangilanadi.
//
// Bekor qilishdagi kabi, faqat Kirim/Chiqim (payIn/payOut) uchun: Ko'chirish
// juft yozuv sifatida saqlanadi va bir tomonini o'zgartirish taqsimotni
// buzardi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isFinite(entryId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const magnitude = Math.trunc(Number(body.amount));
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ ok: false, error: "Tahrir sababini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const entriesCol = db.collection("transaction_entries");
  const entry = (await entriesCol.findOne({ id: entryId })) as (TransactionEntry & { _id: unknown }) | null;
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (entry.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Bekor qilingan tranzaksiyani tahrirlab bo'lmaydi" }, { status: 400 });
  }
  if (entry.txType !== "payIn" && entry.txType !== "payOut") {
    return NextResponse.json({ ok: false, error: "Bu turdagi tranzaksiya miqdorini bu yerdan o'zgartirib bo'lmaydi" }, { status: 400 });
  }

  const newAmount = entry.amount < 0 ? -magnitude : magnitude;
  const delta = newAmount - entry.amount;
  if (delta === 0) {
    const { _id, ...rest } = entry;
    return NextResponse.json({ ok: true, entry: rest });
  }

  const methods = await loadPaymentMethods(db);
  const method = methods.find((m) => m.name === entry.paymentType);
  if (!method) {
    return NextResponse.json({ ok: false, error: "To'lov turi topilmadi" }, { status: 400 });
  }

  const cashboxesCol = db.collection("cashboxes");
  const cashbox = await cashboxesCol.findOne({ id: entry.cashboxId });
  if (!cashbox) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  // Kassada yetarli mablag' bo'lmasa — o'zgartirilmaydi (Chiqimni oshirish
  // yoki Kirimni kamaytirish qoldiqni manfiyga tushirishi mumkin).
  const methodTotals = (cashbox.methodTotals ?? {}) as Record<string, number>;
  const nextMethodTotal = (methodTotals[method.key] ?? 0) + delta;
  const nextBalance = (Number(cashbox.balance) || 0) + delta;
  if (nextMethodTotal < 0 || nextBalance < 0) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
  }

  await cashboxesCol.updateOne(
    { id: entry.cashboxId },
    { $inc: { [`methodTotals.${method.key}`]: delta, balance: delta } },
  );
  await logTransaction(db, {
    date: todayIso(),
    time: nowTime(),
    amount: delta,
    category: `${entry.txName} (tahrirlandi)`,
    method: method.key,
    methodLabel: method.name,
    cashboxId: entry.cashboxId,
  });

  // `after` — shu to'lov turi bo'yicha amaldan keyingi qoldiq. Ko'chirish
  // yozuvlarida u bo'sh bo'lishi mumkin, shuning uchun faqat mavjud bo'lsa
  // qayta hisoblanadi.
  const set: Record<string, number> = { amount: newAmount };
  if (entry.after !== null && entry.after !== undefined) set.after = entry.before + newAmount;
  const historyEntry = {
    at: new Date().toISOString(),
    from: entry.amount,
    to: newAmount,
    reason,
  };
  await entriesCol.updateOne(
    { id: entryId },
    { $set: set, $push: { editHistory: historyEntry } },
  );

  const updated = await entriesCol.findOne({ id: entryId });
  const { _id, ...rest } = updated as TransactionEntry & { _id: unknown };
  return NextResponse.json({ ok: true, entry: rest });
}
