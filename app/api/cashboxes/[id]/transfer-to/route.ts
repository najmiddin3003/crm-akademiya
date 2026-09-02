import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";

// POST /api/cashboxes/:id/transfer-to — pulni bitta kassadan BOSHQA kassaga
// ko'chiradi (referens saytdagi Kassalar → asosiy kartochka "Ko'chirish"
// tugmasi, "Moliya bo'limi" maydoni). Bitta kassa ichida to'lov turlari
// orasidagi Ko'chirishdan (transfer/route.ts) farqi shu: pul BOSHQA
// EGAGA o'tadi. "Tranzaksiyalar" jurnaliga har ikkala kassa uchun alohida
// qator yoziladi; daromad/xarajat hisobotiga tegmaydi (bu ham Ko'chirish,
// umumiy pulni o'zgartirmaydi).
//
// ------------------------------------------------------------------
// TASDIQLASH TALAB QILINADI — pul "YO'LDA" turadi (eskrou)
//
// NIMA NOTO'G'RI EDI: bu route ikkala kassaning balansini DARHOL
// o'zgartirar va ikkala qatorni ham `status: ""` (qabul qilingan) qilib
// yozardi. Ya'ni qabul qiluvchi kassa pulni tasdiqlamasdan olardi, jadvaldagi
// qizil × va yashil ✓ esa faqat bezak edi (onClick'siz <span>).
//
// ENDI:
//   jo'natish  — pul jo'natuvchidan DARHOL yechiladi, qabul qiluvchiga
//                QO'SHILMAYDI: u "yo'lda" turadi. Ikkala qator `waiting`.
//   ✓ tasdiq   — qabul qiluvchiga qo'shiladi, ikkala qator `""` bo'ladi.
//   × rad etish — pul jo'natuvchiga QAYTARILADI, ikkala qator `cancelled`.
//
// Jo'natuvchidan darhol yechilishining sababi: aks holda tasdiq
// kutilayotgan pulni jo'natuvchi ikkinchi marta sarflashi mumkin edi.
//
// Tasdiqlash/rad etish: app/api/transaction-entries/[id]/transfer-confirm
// va .../transfer-reject.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fromId = Number(id);
  if (!Number.isFinite(fromId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { toCashboxId?: number; method?: string; amount?: number; date?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { toCashboxId, method, amount, date, note } = body;
  if (!toCashboxId || !Number.isFinite(toCashboxId)) {
    return NextResponse.json({ ok: false, error: "Moliya bo'limini tanlang" }, { status: 400 });
  }
  if (toCashboxId === fromId) {
    return NextResponse.json({ ok: false, error: "Bir xil kassani tanlab bo'lmaydi" }, { status: 400 });
  }
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // To'lov turlari Sozlamalardan (lib/paymentMethods.ts).
  const methods = await loadPaymentMethods(db);
  const chosen = methods.find((m) => m.key === method);
  if (!chosen) {
    return NextResponse.json({ ok: false, error: "To'lov turini tanlang" }, { status: 400 });
  }
  const col = db.collection("cashboxes");
  const source = await col.findOne({ id: fromId });
  if (!source) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }
  const dest = await col.findOne({ id: toCashboxId });
  if (!dest) {
    return NextResponse.json({ ok: false, error: "Moliya bo'limi topilmadi" }, { status: 404 });
  }
  const totals = source.methodTotals as CashboxMethodTotals;
  if ((totals[chosen.key] ?? 0) < amount) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
  }

  // FAQAT JO'NATUVCHIDAN yechiladi. Qabul qiluvchining balansiga bu yerda
  // TEGILMAYDI — pul tasdiqlangunicha "yo'lda" turadi (yuqoridagi izoh).
  //
  // Shart bilan yozamiz: yechish paytida mablag' hali ham yetarli
  // bo'lishi kerak. Yuqoridagi tekshiruvdan keyin boshqa so'rov o'sha
  // puldan sarflab ulgurgan bo'lishi mumkin — o'qib-keyin-yozish
  // oralig'idagi teshik shu shart bilan yopiladi.
  const fromRes = await col.findOneAndUpdate(
    { id: fromId, [`methodTotals.${method}`]: { $gte: amount } },
    { $inc: { [`methodTotals.${method}`]: -amount, balance: -amount } },
    { returnDocument: "after" },
  );
  if (!fromRes) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
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
  };
  // ISHORA JUFT BO'LADI: jo'natgan kassada manfiy, qabul qilganda musbat —
  // yuqoridagi `$inc` bilan bir xil. Ilgari ikkalasi ham manfiy yozilardi
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
  });
  await db.collection("transaction_entries").updateOne({ id: outId }, { $set: { transferId: outId } });
  await logEntry(db, {
    ...base, amount,
    before: (dest.methodTotals as CashboxMethodTotals)[method as keyof CashboxMethodTotals] ?? 0,
    moderator: dest.moderator || "", cashboxId: toCashboxId,
    transferId: outId, transferRole: "in",
  });

  // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
  // kunlik cron'ni kutmasdan tushadi (boshqa yozuv route'lari ham shunday).
  after(() => flushSoon(db));

  const { _id: _f, ...fromCashbox } = fromRes;
  // Qabul qiluvchi kassa O'ZGARMAGAN holida qaytariladi — pul unga hali
  // qo'shilgani yo'q. Uni javobdan olib tashlamaymiz: klient ikkala
  // kartochkani ham yangilaydi va "to" yo'q bo'lsa eski qiymat qolib
  // ketardi.
  const { _id: _t, ...toCashbox } = dest;
  return NextResponse.json({
    ok: true,
    from: normalizeCashbox(fromCashbox, methods.map((m) => m.key)),
    to: normalizeCashbox(toCashbox, methods.map((m) => m.key)),
  });
}
