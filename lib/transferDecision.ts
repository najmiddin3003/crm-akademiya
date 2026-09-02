import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee, ownsCashbox } from "@/lib/currentEmployee";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { enqueue } from "@/lib/sync/outbox";
import { classifyEntry } from "@/lib/sync/dispatch";
import type { TransactionEntry } from "@/lib/transactionEntries";

// Kassalararo ko'chirmani TASDIQLASH yoki RAD ETISH.
//
// Ikkala amal bir xil tekshiruvlardan o'tadi va faqat oxirgi qadamda
// ajraladi, shuning uchun mantiq shu yerda — route'lar ustidan yupqa
// qobiq (app/api/transaction-entries/[id]/transfer-confirm va
// .../transfer-reject).
//
// PUL QAYERDA TURADI (app/api/cashboxes/[id]/transfer-to/route.ts):
//   jo'natishda pul jo'natuvchidan DARHOL yechiladi, qabul qiluvchiga
//   qo'shilmaydi — "yo'lda" turadi, ikkala jurnal qatori `waiting`.
//     ✓ tasdiq    -> qabul qiluvchiga qo'shiladi, ikkala qator ""
//     × rad etish -> jo'natuvchiga QAYTARILADI, ikkala qator "cancelled"

export type TransferDecision = "confirm" | "reject";

/** Route'lar shuni qaytaradi — muvaffaqiyat ham, xato ham. */
type Result = NextResponse;

function err(message: string, status: number): Result {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function decideTransfer(entryId: number, decision: TransferDecision): Promise<Result> {
  if (!Number.isFinite(entryId)) return err("Noto'g'ri id", 400);

  const db = await ensureIndexes();
  const entriesCol = db.collection("transaction_entries");
  const entry = (await entriesCol.findOne({ id: entryId })) as (TransactionEntry & { _id: unknown }) | null;
  if (!entry) return err("Tranzaksiya topilmadi", 404);

  if (entry.txType !== "transfer") {
    return err("Bu tranzaksiya kassalararo ko'chirma emas", 400);
  }
  // Qaror QABUL QILUVCHI tomonning qatoriga tegishli: pul kelayotgan
  // kassaning egasi tasdiqlaydi. Chiquvchi qatordan tasdiqlashga ruxsat
  // berilsa, jo'natuvchi o'z ko'chirmasini o'zi tasdiqlab qo'yardi.
  if (entry.transferRole !== "in") {
    return err("Faqat pul KELAYOTGAN kassa tasdiqlashi mumkin", 400);
  }
  if (entry.status !== "waiting") {
    return err("Bu ko'chirma allaqachon hal qilingan", 409);
  }
  // Juftlik bog'lanmagan eski yozuv — ikkinchi qatorni ishonchli topib
  // bo'lmaydi, ya'ni pulni to'g'ri joyga qo'yib bo'lmaydi.
  const transferId = Number(entry.transferId);
  if (!Number.isFinite(transferId)) {
    return err("Ko'chirmaning ikkinchi qatori topilmadi (eski yozuv)", 400);
  }

  // ---- RUXSAT ----
  // Kassa egaligini tekshiradigan BIRINCHI yozuv route'i. Ilgari
  // /api/cashboxes/* ning hech biri egalikni tekshirmasdi — proxy.ts
  // faqat "/finance-cash" bo'lim ruxsatini talab qiladi, ya'ni moliya
  // sahifasiga kira oladigan har qanday xodim istalgan kassaga tegishi
  // mumkin edi.
  //
  // "Bosh kassa" (isPrimary) belgisiga ATAYLAB bog'lanmagan: uni
  // /finance-cash ruxsati bor istalgan xodim o'ziga o'tkazib olishi
  // mumkin, ya'ni u himoya emas, bezak.
  const me = await getCurrentEmployee();
  if (!me) return err("Tizimga kiring", 401);
  if (!me.isAdmin && !(await ownsCashbox(db, me.name, entry.cashboxId))) {
    return err("Bu kassani faqat uning mas'uli tasdiqlashi mumkin", 403);
  }

  const rows = (await entriesCol.find({ transferId }).toArray()) as unknown as TransactionEntry[];
  const out = rows.find((r) => r.transferRole === "out");
  if (!out) return err("Ko'chirmaning chiquvchi qatori topilmadi", 400);

  // ---- PUL QAYSI KASSAGA VA QAYSI TURGA ----
  const key = await methodKeyOf(db, entry);
  if (!key) return err("To'lov turi topilmadi", 400);
  const amount = Math.abs(Number(entry.amount) || 0);
  if (amount <= 0) return err("Ko'chirma summasi noto'g'ri", 400);
  // Tasdiq — pul qabul qiluvchiga qo'shiladi; rad etish — jo'natuvchiga
  // qaytariladi. Ikkalasida ham MUSBAT $inc, faqat kassa boshqa.
  const targetCashboxId = decision === "confirm" ? entry.cashboxId : out.cashboxId;
  const newStatus = decision === "confirm" ? "" : "cancelled";

  // ---- HOLATNI ALMASHTIRISH (avval), SO'NG PUL ----
  //
  // Tartib ATAYLAB shunday. Tugma ikki marta bosilsa yoki ikkita so'rov
  // bir vaqtda kelsa, `status: "waiting"` sharti faqat BIRINCHISIGA
  // to'g'ri keladi — ikkinchisi 0 qator o'zgartiradi va pul ikki marta
  // ko'chmaydi.
  //
  // Teskari tartib (avval pul) xavfliroq bo'lardi: $inc o'tib, holat
  // yozilmay qolsa, keyingi urinish pulni YANA qo'shib yuborardi.
  //
  // MongoDB tranzaksiyasi ishlatilmadi — loyihada hech qayerda yo'q va
  // bu birinchisi bo'lib qolardi. Qolgan xavf: CAS bajarilib, keyingi
  // $inc gacha jarayon o'lsa, pul "yo'lda" qolib ketadi. Pul yo'qolmaydi
  // (jo'natuvchidan yechilgan, jurnalda ikkala qator ko'rinadi), lekin
  // qo'lda tuzatish talab qiladi. $inc SINXRON xato bersa quyida holat
  // orqaga qaytariladi.
  const cas = await entriesCol.updateMany(
    { transferId, status: "waiting" },
    { $set: { status: newStatus } },
  );
  if (cas.modifiedCount === 0) {
    return err("Bu ko'chirma allaqachon hal qilingan", 409);
  }

  const inc = await db.collection("cashboxes").updateOne(
    { id: targetCashboxId },
    { $inc: { [`methodTotals.${key}`]: amount, balance: amount } },
  );
  if (inc.matchedCount === 0) {
    // Kassa yo'q — holatni qaytaramiz, aks holda pul "yo'lda" qolib,
    // ko'chirma esa hal qilingan bo'lib ko'rinardi.
    await entriesCol.updateMany({ transferId }, { $set: { status: "waiting" } });
    return err("Kassa topilmadi", 404);
  }

  // ---- SINXRONIZATSIYA ----
  // Google Sheets qatori holat ustuni bilan birga qayta yoziladi
  // (lib/sync/mappers.ts -> statusLabel: "" -> "Faol",
  // "cancelled" -> "Bekor qilindi"). Ikkala qator ham yangilanadi.
  // Telegram guruhga ko'chirma HECH QACHON chiqmaydi (lib/sync/outbox.ts
  // dagi `kindNotifiesTelegram`), shuning uchun bayroq ahamiyatsiz.
  for (const r of rows) {
    const kind = classifyEntry(r);
    if (kind) {
      await enqueue(db, {
        kind,
        entryId: r.id,
        event: decision === "confirm" ? "confirmed" : "cancelled",
        notifyTelegram: false,
      });
    }
  }

  return NextResponse.json({ ok: true, decision, transferId });
}

/**
 * Pul qaysi `methodTotals` maydoniga qaytishi.
 *
 * Yangi ko'chirmalarda `paymentMethodKey` yozuvning o'zida turadi. Eski
 * yozuvlarda u yo'q — ularda ko'rinadigan nom bo'yicha qidiriladi, lekin
 * nom Sozlamalardan o'zgartirilgan bo'lsa topilmasligi mumkin.
 */
async function methodKeyOf(db: Db, entry: TransactionEntry): Promise<string | null> {
  if (entry.paymentMethodKey) return entry.paymentMethodKey;
  const methods = await loadPaymentMethods(db);
  return methods.find((m) => m.name === entry.paymentType)?.key ?? null;
}
