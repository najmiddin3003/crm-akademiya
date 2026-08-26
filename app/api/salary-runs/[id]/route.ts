import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { classifyEntry, flushSoon } from "@/lib/sync/dispatch";
import { enqueue } from "@/lib/sync/outbox";

// DELETE /api/salary-runs/:id — Moliya → Oylik chiqarish jadvalidagi bitta
// tarixiy chiqarishni o'chirish (referens dizaynda AMALLAR ustunidagi
// savatcha tugmasi).
//
// Chiqarish endi HAQIQIY pul harakati: kassadan chiqim yozuvlari yaratiladi
// (app/api/salary-runs/route.ts). Shu sababli o'chirish ham shunchaki
// hisobotni olib tashlash emas — u avval chiqarilgan pulni QAYTARADI:
// har bir bog'liq chiqim bekor qilinadi (status="cancelled", asl yozuv
// o'chirilmaydi — audit iz qoladi), kassa balansi tiklanadi va moliya
// hisobotlariga teskari yozuv qo'shiladi. Aks holda o'chirish kassadan
// pulni izsiz yo'qotgan bo'lardi.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false, error: "Noto'g'ri ID" }, { status: 400 });

  const db = await ensureIndexes();
  const run = await db.collection("salary_runs").findOne({ id: n });
  if (!run) return NextResponse.json({ ok: false, error: "Topilmadi" }, { status: 404 });

  const entriesCol = db.collection("transaction_entries");
  const cashboxesCol = db.collection("cashboxes");
  const methods = await loadPaymentMethods(db);

  // Faqat shu chiqarish yaratgan va hali bekor qilinmagan yozuvlar.
  // Kassa oynasidan qo'lda bekor qilinganini ikkinchi marta qaytarish
  // kassaga ortiqcha pul qo'shib qo'yardi.
  const entries = (await entriesCol
    .find({ salaryRunId: n, status: { $ne: "cancelled" } })
    .toArray()) as unknown as TransactionEntry[];

  // ── Avval TEKSHIRAMIZ, keyin o'zgartiramiz ───────────────────────────
  //
  // NIMA NOTO'G'RI EDI: to'lov turi yozuvdagi NOM bo'yicha qidirilardi
  // (`m.name === entry.paymentType`). Nom esa Sozlamalar → To'lov turlarida
  // o'zgartiriladigan maydon (kalit barqaror, nom emas). Nom o'zgargan
  // bo'lsa qidiruv hech narsa topmasdi va `if (method)` bloki JIMGINA
  // o'tkazib yuborilardi: pul kassaga qaytmasdi, ammo yozuv baribir
  // "bekor qilindi" bo'lardi va chiqarish o'chirilardi. Natijada kassadan
  // pul izsiz chiqib ketardi, xodim esa yana "to'lanmagan" bo'lib ko'rinib,
  // ikkinchi marta to'lanishi mumkin edi.
  //
  // Endi kalit yozuvning O'ZIDAN o'qiladi (`paymentMethodKey`), eski
  // yozuvlarda esa chiqarishdagi `method`, undan keyin nom zaxira bo'ladi.
  // Bironta yozuv uchun pulni qaytarib bo'lmasa — HECH NARSA o'zgarmaydi.
  const plan: { entry: TransactionEntry; methodKey: string; methodName: string }[] = [];
  for (const entry of entries) {
    const byKey = entry.paymentMethodKey
      ? methods.find((m) => m.key === entry.paymentMethodKey)
      : undefined;
    const byRun = run.method ? methods.find((m) => m.key === run.method) : undefined;
    const byName = methods.find((m) => m.name === entry.paymentType);
    const method = byKey ?? byRun ?? byName;
    if (!method) {
      return NextResponse.json(
        {
          ok: false,
          error: `O'chirib bo'lmadi: "${entry.paymentType}" to'lov turi ro'yxatda topilmadi, shu sababli ${Math.abs(Number(entry.amount) || 0).toLocaleString("ru-RU")} so'mni kassaga qaytarib bo'lmaydi. To'lov turini tiklang yoki tranzaksiyani kassa oynasidan qo'lda bekor qiling.`,
        },
        { status: 409 },
      );
    }
    const cashbox = await cashboxesCol.findOne({ id: entry.cashboxId });
    if (!cashbox) {
      return NextResponse.json(
        {
          ok: false,
          error: `O'chirib bo'lmadi: pul chiqarilgan kassa (id=${entry.cashboxId}) topilmadi, ${Math.abs(Number(entry.amount) || 0).toLocaleString("ru-RU")} so'mni qaytarib bo'lmaydi.`,
        },
        { status: 409 },
      );
    }
    plan.push({ entry, methodKey: method.key, methodName: method.name });
  }

  let refunded = 0;
  for (const { entry, methodKey, methodName } of plan) {
    // `amount` chiqimda manfiy — teskarisi pulni kassaga qaytaradi.
    await cashboxesCol.updateOne(
      { id: entry.cashboxId },
      { $inc: { [`methodTotals.${methodKey}`]: -entry.amount, balance: -entry.amount } },
    );
    await logTransaction(db, {
      date: todayIso(),
      time: nowTime(),
      amount: -entry.amount,
      category: `${entry.txName} (bekor qilindi)`,
      method: methodKey,
      methodLabel: methodName,
      cashboxId: entry.cashboxId,
    });
    refunded += Math.abs(Number(entry.amount) || 0);
    await entriesCol.updateOne({ id: entry.id }, { $set: { status: "cancelled" } });

    // Sheet'dagi qator "Bekor qilindi" bo'lib yangilanadi va guruhga
    // alohida tuzatish xabari ketadi (transaction-entries/[id]/cancel
    // bilan bir xil qoida).
    const kind = classifyEntry(entry);
    if (kind) await enqueue(db, { kind, entryId: entry.id, event: "cancelled", notifyTelegram: true });
  }

  await db.collection("salary_runs").deleteOne({ id: n });
  if (entries.length > 0) after(() => flushSoon(db));

  return NextResponse.json({ ok: true, cancelledEntries: entries.length, refunded });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n)) return NextResponse.json({ ok: false, error: "Noto'g'ri ID" }, { status: 400 });
  const db = await ensureIndexes();
  const row = await db.collection("salary_runs").findOne({ id: n });
  if (!row) return NextResponse.json({ ok: false, error: "Topilmadi" }, { status: 404 });
  const { _id, ...rest } = row;
  return NextResponse.json({ ok: true, run: rest });
}
