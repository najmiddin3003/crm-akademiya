import type { Db } from "mongodb";
import { normalizeCashbox, type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, nowTime, todayIso } from "@/lib/transactionLog";
import { loadPendingOut } from "@/lib/transferPending";
import { flushSoon } from "@/lib/sync/dispatch";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import type { EntryOrigin } from "@/lib/transactionEntries";
import { notifyTransferPending } from "@/lib/staffBot/notify";

// KO'CHIRISH — ikki yadro:
//
//   applyMethodTransfer     — bitta kassa ICHIDA to'lov turlari orasida
//                             (Naqd → Plastik). Umumiy balansga tegmaydi.
//   applyCashboxTransferTo  — BOSHQA kassaga (filial → rahbar). Pul
//                             TASDIQGACHA jo'natuvchida turadi
//                             (lib/transferDecision.ts).
//
// NEGA ROUTE'DAN AJRATILGAN — lib/cashboxAdjust.ts bilan bir xil sabab:
// xodimlar Telegram boti ham ko'chiradi (lib/staffBot/transfer.ts) va
// ikkala kiruvchi bitta koddan o'tishi shart. Route'lar
// (app/api/cashboxes/[id]/transfer, …/transfer-to) endi yupqa qobiq.
// Mantiq route'lardagi bilan AYNAN bir xil — izohlar ham o'sha yerdan.

type Deps = AdjustDeps;

// ── Kassa ichida: tur → tur ─────────────────────────────────────────

export interface MethodTransferInput {
  cashboxId: number;
  /** To'lov turi KALITLARI (`settings_payment_methods.key`). */
  from: string;
  to: string;
  amount: number;
  origin?: EntryOrigin;
}

export type MethodTransferOutcome =
  | { ok: true; cashbox: Cashbox; fromName: string; toName: string; outId: number; inId: number }
  | { ok: false; error: string; status: 400 | 404 };

export async function applyMethodTransfer(db: Db, input: MethodTransferInput, deps: Deps): Promise<MethodTransferOutcome> {
  const { cashboxId, from, to, amount } = input;
  const fail = (error: string, status: 400 | 404 = 400): MethodTransferOutcome => ({ ok: false, error, status });
  if (!Number.isFinite(cashboxId)) return fail("Noto'g'ri id");
  if (from === to) return fail("Bir xil to'lov turini tanlab bo'lmaydi");
  if (!amount || amount <= 0) return fail("Qiymatni to'g'ri kiriting");

  // To'lov turlari Sozlamalardan (lib/paymentMethods.ts).
  const methods = await loadPaymentMethods(db);
  const fromMethod = methods.find((m) => m.key === from);
  const toMethod = methods.find((m) => m.key === to);
  if (!fromMethod || !toMethod) return fail("To'lov turlarini tanlang");

  const col = db.collection("cashboxes");
  const current = await col.findOne({ id: cashboxId });
  if (!current) return fail("Kassa topilmadi", 404);
  const totals = current.methodTotals as CashboxMethodTotals;
  // Erta tekshiruv — kassirga darhol tushunarli xabar berish uchun.
  // Himoya esa quyidagi filtrda.
  if ((totals[fromMethod.key] ?? 0) < amount) return fail("Mablag' yetarli emas");

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
    return exists ? fail("Mablag' yetarli emas") : fail("Kassa topilmadi", 404);
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
    ...(input.origin ? { origin: input.origin } : {}),
  };
  // Chiqadigan tur manfiy, tushadigani musbat — yuqoridagi `$inc` bilan
  // bir xil va edutizimdan ko'chirilgan juftliklar bilan bir xil
  // (scripts/import-cashbox-api.mjs kategoriyasiz kirim/chiqimni aynan
  // shunday yozadi). Ikkalasi ham manfiy bo'lsa "Ko'chirmalar" varag'ida
  // ikkala qator ham "Chiqim" bo'lib chiqardi (lib/sync/mappers.ts).
  const outId = await logEntry(db, { ...base, amount: -amount, paymentType: fromLabel });
  const inId = await logEntry(db, { ...base, amount, paymentType: toLabel });

  // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
  // kunlik cron'ni kutmasdan tushadi (boshqa yozuv route'lari ham shunday).
  deps.defer(() => flushSoon(db));

  const { _id, ...cashbox } = res;
  return { ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)), fromName: fromLabel, toName: toLabel, outId, inId };
}

// ── Boshqa kassaga ──────────────────────────────────────────────────

export interface CashboxTransferInput {
  fromId: number;
  toCashboxId: number;
  method: string;
  amount: number;
  date?: string;
  note?: string;
  origin?: EntryOrigin;
}

export type CashboxTransferOutcome =
  | {
      ok: true;
      /** Ikkala kassa — o'zgarmagan holida, `pendingOut` yangilangan (route izohi). */
      from: Cashbox;
      to: Cashbox;
      /** Chiquvchi qatorning id'si (= `transferId`) va kiruvchi qator. */
      outId: number;
      inId: number;
      methodName: string;
      fromName: string;
      toName: string;
    }
  | { ok: false; error: string; status: 400 | 404 };

export async function applyCashboxTransferTo(db: Db, input: CashboxTransferInput, deps: Deps): Promise<CashboxTransferOutcome> {
  const { fromId, toCashboxId, method, amount, date, note } = input;
  const fail = (error: string, status: 400 | 404 = 400): CashboxTransferOutcome => ({ ok: false, error, status });
  if (!Number.isFinite(fromId)) return fail("Noto'g'ri id");
  if (!toCashboxId || !Number.isFinite(toCashboxId)) return fail("Moliya bo'limini tanlang");
  if (toCashboxId === fromId) return fail("Bir xil kassani tanlab bo'lmaydi");
  if (!amount || amount <= 0) return fail("Qiymatni to'g'ri kiriting");

  // To'lov turlari Sozlamalardan (lib/paymentMethods.ts).
  const methods = await loadPaymentMethods(db);
  const chosen = methods.find((m) => m.key === method);
  if (!chosen) return fail("To'lov turini tanlang");
  const col = db.collection("cashboxes");
  const source = await col.findOne({ id: fromId });
  if (!source) return fail("Kassa topilmadi", 404);
  const dest = await col.findOne({ id: toCashboxId });
  if (!dest) return fail("Moliya bo'limi topilmadi", 404);
  const totals = source.methodTotals as CashboxMethodTotals;
  // MAVJUD MABLAG' = qoldiq − tasdiq kutayotgan summa. Ikkinchi qism
  // shuning uchun ayriladi: jo'natilgan pul balansda TURAVERADI, ya'ni
  // faqat `methodTotals` ga qarasak o'sha pulni yana jo'natish mumkin
  // bo'lardi va rahbar ikkala ko'chirmani ham tasdiqlay olmasdi.
  const pending = (await loadPendingOut(db, [fromId])).get(fromId) ?? {};
  const available = (totals[chosen.key] ?? 0) - (pending[chosen.key] ?? 0);
  if (available < amount) {
    // Xabar ochiq aytadi: pul kassada bor, lekin allaqachon va'da
    // qilingan. Quruq "Mablag' yetarli emas" kassirni chalg'itardi —
    // u kartada boshqa raqamni ko'rib turibdi.
    const held = pending[chosen.key] ?? 0;
    return fail(
      held > 0
        ? `Mablag' yetarli emas — ${held.toLocaleString("ru-RU")} so'm tasdiq kutmoqda`
        : "Mablag' yetarli emas",
    );
  }

  const methodLabel = chosen.name;
  const entryDate = date || todayIso();
  const entryTime = nowTime();
  const txName = `Ko'chirish: ${source.name} → ${dest.name}`;
  const base = {
    date: entryDate,
    time: entryTime,
    studentName: "",
    after: null,
    txType: "transfer",
    txName,
    paymentType: methodLabel,
    group: "",
    lessonDate: "",
    reason: "-",
    note: note || "",
    // TASDIQ KUTILMOQDA. Ikkala qator ham `waiting` — jadvalda qizil ×
    // va yashil ✓ aynan shu holatda chiziladi.
    status: "waiting",
    // To'lov turining BARQAROR kaliti. Rad etishda pulni qaysi
    // `methodTotals` maydoniga qaytarishni SHU aniqlaydi: ko'rinadigan
    // nom (`paymentType`) Sozlamalardan o'zgartirilishi mumkin va nom
    // bo'yicha qidirish o'sha zahoti ishlamay qolardi — pul kassaga
    // qaytmasdi. Ilgari ko'chirma yozuvida bu maydon umuman yo'q edi.
    paymentMethodKey: chosen.key,
    ...(input.origin ? { origin: input.origin } : {}),
  };
  // ISHORA JUFT BO'LADI: jo'natgan kassada manfiy, qabul qilganda musbat —
  // tasdiqlashdagi `$inc` lar bilan bir xil. Ilgari ikkalasi ham manfiy yozilardi
  // va qabul qilgan kassaning daftarida pul KIRGANI "-500 000" bo'lib
  // ko'rinardi. Balansga ta'sir qilmagani uchun sezilmay yurgan, lekin
  // edutizimdan ko'chirilgan 3 578 ko'chirma juft ishora bilan yozilgan
  // (scripts/import-cashbox-api.mjs) va Google Sheets'dagi "Ko'chirmalar"
  // varag'i yo'nalishni AYNAN shu ishoradan oladi (lib/sync/mappers.ts).
  //
  // JUFTLIKNI BOG'LASH: `transferId` — chiquvchi qatorning o'z id'si,
  // ikkala qatorda bir xil. Tasdiqlash/rad etish ikkala qatorni ham
  // topishi kerak, ilgari esa ularni faqat qo'shni id va bir xil
  // `txName`/`date`/`time` bo'yicha TAXMIN qilish mumkin edi.
  //
  // Ikki qadam: avval chiquvchi qator yoziladi (id shundan chiqadi),
  // keyin o'sha id o'ziga `transferId` qilib qo'yiladi. `logEntry` id'ni
  // faqat yozgandan keyin qaytaradi, oldindan bilib bo'lmaydi.
  const outId = await logEntry(db, {
    ...base, amount: -amount,
    before: totals[method as keyof CashboxMethodTotals] ?? 0,
    moderator: source.moderator || "", cashboxId: fromId,
    transferRole: "out",
    // YANGI QOIDA BELGISI: pul jo'natishda YECHILMADI. Tasdiqlash aynan
    // shu maydonga qarab pulni jo'natuvchidan yechadi; maydonsiz (eski)
    // qatorlarda pul allaqachon yechilgan bo'ladi va tasdiq faqat qabul
    // qiluvchiga qo'shadi (lib/transactionEntries.ts dagi izoh).
    deductedOnSend: false,
  });
  await db.collection("transaction_entries").updateOne({ id: outId }, { $set: { transferId: outId } });
  const inId = await logEntry(db, {
    ...base, amount,
    before: (dest.methodTotals as CashboxMethodTotals)[method as keyof CashboxMethodTotals] ?? 0,
    moderator: dest.moderator || "", cashboxId: toCashboxId,
    transferId: outId, transferRole: "in",
  });

  // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
  // kunlik cron'ni kutmasdan tushadi (boshqa yozuv route'lari ham shunday).
  deps.defer(() => flushSoon(db));

  // QABUL QILUVCHIGA BOTDA XABAR — "📥 ko'chirma keldi" + ✓/✗ tugmalari
  // (lib/staffBot/notify.ts). Web'dan jo'natilganda ham: rahbar botga
  // ulangan bo'lsa tasdiqni telefondan bosadi. O'zi hech qachon otmaydi.
  deps.defer(() =>
    notifyTransferPending(db, {
      inEntryId: inId,
      toCashboxId,
      toCashboxName: String(dest.name ?? ""),
      fromCashboxName: String(source.name ?? ""),
      amount,
      methodName: methodLabel,
      note: note || "",
    }),
  );

  // IKKALA KASSA HAM O'ZGARMAGAN holida qaytariladi — hech kimning
  // balansiga tegilmadi. Ularni javobdan olib tashlamaymiz: klient ikkala
  // kartochkani ham shu javob bilan almashtiradi va biri yetishmasa eski
  // qiymat qolib ketardi.
  //
  // JO'NATUVCHIDA `pendingOut` YANGILANADI: kartochkada "tasdiq kutmoqda"
  // qatori shundan chiziladi va u hozirgina o'sgan. Qayta o'qiymiz —
  // yuqorida olingan `pending` bu yozuvdan OLDINGI holat.
  const keys = methods.map((m) => m.key);
  const pendingAfter = await loadPendingOut(db, [fromId, toCashboxId]);
  const { _id: _f, ...fromCashbox } = source;
  const { _id: _t, ...toCashbox } = dest;
  return {
    ok: true,
    from: { ...normalizeCashbox(fromCashbox, keys), pendingOut: pendingAfter.get(fromId) ?? {} },
    to: { ...normalizeCashbox(toCashbox, keys), pendingOut: pendingAfter.get(toCashboxId) ?? {} },
    outId,
    inId,
    methodName: methodLabel,
    fromName: String(source.name ?? ""),
    toName: String(dest.name ?? ""),
  };
}
