import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";

// POST /api/cashboxes/:id/transfer — bitta kassa ichida to'lov turlari
// orasida pul ko'chiradi (masalan Naqd → Plastik). Umumiy balansga
// tegmaydi, faqat methodTotals'ni qayta taqsimlaydi. "Tranzaksiyalar"
// jurnaliga ikkita qator yoziladi: chiqadigan tur manfiy, tushadigani
// musbat miqdor bilan. Daromad/xarajat hisobotiga tegmaydi.
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
  // Erta tekshiruv — kassirga darhol tushunarli xabar berish uchun.
  // Himoya esa quyidagi filtrda.
  if ((totals[fromMethod.key] ?? 0) < amount) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
  }

  // Shart FILTRDA — `adjust` bilan bir xil sabab: ilgari yuqoridagi
  // tekshiruv bilan bu yozuv orasida boshqa so'rov o'sha puldan sarflab
  // ulgurishi mumkin edi va chiqadigan tur minusga tushardi.
  //
  // `balance` sharti bu yerda KERAK EMAS: bitta kassa ichidagi ko'chirish
  // umumiy balansga tegmaydi, faqat turlar orasida qayta taqsimlaydi.
  const res = await col.findOneAndUpdate(
    { id: cashboxId, [`methodTotals.${from}`]: { $gte: amount } },
    { $inc: { [`methodTotals.${from}`]: -amount, [`methodTotals.${to}`]: amount } },
    { returnDocument: "after" },
  );
  if (!res) {
    const exists = await col.findOne({ id: cashboxId }, { projection: { _id: 1 } });
    return exists
      ? NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 })
      : NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  const fromLabel = fromMethod.name;
  const toLabel = toMethod.name;
  const entryDate = todayIso();
  const entryTime = nowTime();
  const base = {
    date: entryDate,
    time: entryTime,
    studentName: "",
    // YOZILGAN natijadan: `totals` parallel so'rov oralasa eskirgan
    // bo'lishi mumkin (`adjust` dagi bilan bir xil sabab). Chiqadigan tur
    // `amount` ga kamaygan, ya'ni ko'chirishdan oldingi qiymat shu.
    before: ((res.methodTotals as CashboxMethodTotals)[fromMethod.key] ?? 0) + amount,
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
  // Chiqadigan tur manfiy, tushadigani musbat — yuqoridagi `$inc` bilan
  // bir xil va edutizimdan ko'chirilgan juftliklar bilan bir xil
  // (scripts/import-cashbox-api.mjs kategoriyasiz kirim/chiqimni aynan
  // shunday yozadi). Ikkalasi ham manfiy bo'lsa "Ko'chirmalar" varag'ida
  // ikkala qator ham "Chiqim" bo'lib chiqardi (lib/sync/mappers.ts).
  await logEntry(db, { ...base, amount: -amount, paymentType: fromLabel });
  await logEntry(db, { ...base, amount, paymentType: toLabel });

  // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
  // kunlik cron'ni kutmasdan tushadi (boshqa yozuv route'lari ham shunday).
  after(() => flushSoon(db));

  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)) });
}
