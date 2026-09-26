import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { classifyEntry, flushSoon } from "@/lib/sync/dispatch";
import { enqueue, wasAnnounced } from "@/lib/sync/outbox";
import { revertDiscountOnCancel } from "@/lib/gamification/discounts";

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

  // Tanga evaziga chegirma qo'llangan to'lov bekor qilindi — chegirma yana
  // FAOL: qayta kiritilgan to'lovga qo'llanadi, oyi o'tgan bo'lsa tungi ish
  // tangani qaytaradi (lib/gamification/discounts.ts). Xato bekor qilishni
  // to'xtatmaydi.
  if (entry.discountId) {
    await revertDiscountOnCancel(db, entry.discountId, entryId).catch((e) => console.error("[cancel] chegirma qaytmadi:", e));
  }

  // Sinxronizatsiya: Sheet'dagi qator "Bekor qilindi" bo'lib yangilanadi
  // va guruhga ALOHIDA tuzatish xabari ketadi (eski xabar tahrirlanmaydi —
  // guruhdagi odam eski xabarni qayta o'qimaydi, tuzatish oxirgi xabar
  // bo'lib ko'rinishi kerak).
  //
  // Guruhga esa FAQAT o'sha to'lov yaratilganda e'lon qilingan bo'lsa
  // xabar ketadi (wasAnnounced). Edutizimdan ko'chirilgan tarix guruhga
  // hech qachon chiqmagan — uni bekor qilganda tuzatish xabari yuborish
  // odamlarni chalg'itardi.
  const kind = classifyEntry(entry);
  if (kind) {
    await enqueue(db, {
      kind,
      entryId,
      event: "cancelled",
      notifyTelegram: await wasAnnounced(db, kind, entryId),
    });
    after(() => flushSoon(db));
  }

  const updated = await entriesCol.findOne({ id: entryId });
  const { _id, ...rest } = updated as TransactionEntry & { _id: unknown };
  return NextResponse.json({ ok: true, entry: rest });
}
