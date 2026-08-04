import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, nowTime, todayIso } from "@/lib/transactionLog";

// POST /api/cashboxes/:id/transfer — bitta kassa ichida to'lov turlari
// orasida pul ko'chiradi (masalan Naqd → Plastik). Umumiy balansga
// tegmaydi, faqat methodTotals'ni qayta taqsimlaydi. "Tranzaksiyalar"
// jurnaliga ikkita qator yoziladi (chiqadigan va tushadigan to'lov turi —
// manba saytidagi kabi ikkalasi ham manfiy miqdor bilan, TRANSACTION_ENTRY_SEED
// konvensiyasiga qarang); daromad/xarajat hisobotiga tegmaydi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { from?: string; to?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { from, to, amount } = body;
  if (from === to) {
    return NextResponse.json({ ok: false, error: "Bir xil to'lov turini tanlab bo'lmaydi" }, { status: 400 });
  }
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // To'lov turlari Sozlamalardan (lib/paymentMethods.ts).
  const methods = await loadPaymentMethods(db);
  const fromMethod = methods.find((m) => m.key === from);
  const toMethod = methods.find((m) => m.key === to);
  if (!fromMethod || !toMethod) {
    return NextResponse.json({ ok: false, error: "To'lov turlarini tanlang" }, { status: 400 });
  }
  const col = db.collection("cashboxes");
  const current = await col.findOne({ id: cashboxId });
  if (!current) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }
  const totals = current.methodTotals as CashboxMethodTotals;
  if ((totals[fromMethod.key] ?? 0) < amount) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
  }

  const res = await col.findOneAndUpdate(
    { id: cashboxId },
    { $inc: { [`methodTotals.${from}`]: -amount, [`methodTotals.${to}`]: amount } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  const fromLabel = fromMethod.name;
  const toLabel = toMethod.name;
  const entryDate = todayIso();
  const entryTime = nowTime();
  const base = {
    date: entryDate,
    time: entryTime,
    studentName: "",
    amount: -amount,
    before: totals[from as keyof CashboxMethodTotals] ?? 0,
    after: null,
    txType: "transfer",
    txName: `Ko'chirish: ${fromLabel} → ${toLabel}`,
    group: "",
    lessonDate: "",
    moderator: current.moderator || "",
    reason: "-",
    note: "",
    status: "",
    cashboxId,
  };
  await logEntry(db, { ...base, paymentType: fromLabel });
  await logEntry(db, { ...base, paymentType: toLabel });

  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)) });
}
