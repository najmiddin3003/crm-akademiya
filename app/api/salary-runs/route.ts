import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SalaryRun, SalaryRunItem } from "@/lib/salary";
import {
  payrollBase,
  payrollEarned,
  payrollDue,
  payrollTax,
  payrollTaxLines,
  payrollMonthKey,
  payrollPeriod,
} from "@/lib/salary";
import { buildPayrollRows } from "@/lib/payrollSources";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";
import type { CashboxMethodTotals } from "@/lib/cashboxes";

// Moliya → Oylik chiqarish backend'i (MongoDB `salary_runs`).
//
// Demo seed OLIB TASHLANDI: SALARY_RUN_SEED o'ylab topilgan oylik hisoboti
// edi va u haqiqiy yozuvlar bilan yonma-yon, ajratib bo'lmaydigan holda
// turardi. Bo'sh ro'yxat — haqiqat, soxta tarix emas.

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Chiqim yozuvining turi ("Tranzaksiyalar" jurnalidagi nomi).
 *
 * Ro'yxatni admin boshqaradi (/finance-tx-types), shuning uchun nom qattiq
 * yozilmaydi — chiqim turlaridan "oylik" so'zi borini olamiz. Topilmasa
 * seed'dagi standart nom ishlatiladi. Nom MUHIM: "to'langan oylik" aynan
 * shu nomdagi yozuvlardan hisoblanadi (lib/payrollSources.ts →
 * loadPaidByEmployee) va sinxronizatsiya ham shunga qarab tasniflaydi
 * (lib/sync/mappers.ts → classifyEntry).
 */
async function salaryCategory(db: Awaited<ReturnType<typeof ensureIndexes>>): Promise<string> {
  const rows = await db.collection("transaction_types").find({}).sort({ id: 1 }).toArray();
  const found = rows.find((t) => /oylik/i.test(String(t?.name ?? "")) && !/o'quvchi|oquvchi/i.test(String(t?.name ?? "")));
  return found ? String(found.name) : "Hodimga oylik";
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("salary_runs");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const runs = rows.map(({ _id, ...rest }) => rest as unknown as SalaryRun);
  return NextResponse.json({ ok: true, runs });
}

// POST — "Oylik chiqarish": tanlangan xodimlar bo'yicha bitta hisobot
// yozuvi yaratiladi VA pul haqiqatan kassadan chiqariladi. Hamma had
// HAQIQIY manbadan (lib/payrollSources.ts): oklad xodim kartasidan,
// bonus/jarima o'z kolleksiyalaridan, avans/oylik esa kassadan chiqarilgan
// yozuvlardan.
//
// NIMA UCHUN PUL HAM CHIQADI: ilgari bu route faqat `salary_runs` ga
// hisobot yozardi. Kassada esa hech narsa o'zgarmasdi va "to'langan oylik"
// aynan kassa yozuvlaridan hisoblangani uchun u abadiy 0 bo'lib qolardi —
// chiqarilgan oylik ham "to'lanmagan" bo'lib ko'rinardi. Endi chiqarish
// kassa Chiqim oynasi bilan bir xil yozuvlarni yaratadi: `transaction_entries`
// (jurnal + sinxronizatsiya) va `transactions` (moliya hisobotlari).
//
// DAVOMAT va AKLADI 0 bo'lib qoladi — tizimda ular uchun manba yo'q va
// o'ylab topilmaydi.
export async function POST(req: Request) {
  let body: { employeeIds?: number[]; cashboxId?: number; method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.map(Number).filter(Number.isFinite) : [];
  if (employeeIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Kamida bitta xodimni tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();

  // ---- Kassa va to'lov turi ----------------------------------------
  const methods = await loadPaymentMethods(db);
  const chosenMethod = methods.find((m) => m.key === body.method);
  if (!chosenMethod) {
    return NextResponse.json({ ok: false, error: "To'lov turini tanlang" }, { status: 400 });
  }
  const cashboxId = Number(body.cashboxId);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Kassani tanlang" }, { status: 400 });
  }
  const cashboxesCol = db.collection("cashboxes");
  const cashbox = await cashboxesCol.findOne({ id: cashboxId });
  if (!cashbox) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  // Hamma qiymat bitta haqiqiy manbadan (lib/payrollSources.ts) — shu
  // bois Oylik chiqarish, Xodimlar ro'yxati va xodim profili bir xil
  // raqam ko'rsatadi.
  const all = await buildPayrollRows(db);
  const chosen = all.filter((e) => employeeIds.includes(e.id));
  if (chosen.length === 0) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  // Oyligi sozlanmagan xodimni hisobga qo'shib bo'lmaydi — uning
  // "hisoblangan"i 0 bo'lardi va bu haqiqat emas, sozlama yo'qligi.
  const unconfigured = chosen.filter((e) => !e.configured);
  if (unconfigured.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Oyligi sozlanmagan xodim(lar): ${unconfigured.map((e) => e.name).join(", ")}`,
        unconfigured: unconfigured.map((e) => e.id),
      },
      { status: 400 },
    );
  }

  const period = payrollPeriod();
  let oylik = 0;
  let bonus = 0;
  let jarima = 0;
  let avans = 0;
  let akladi = 0;
  let soliq = 0;
  let tolangan = 0;
  let tolanmagan = 0;
  let qarzdorlik = 0;
  // Kim uchun qancha chiqariladi — kassa yozuvlari shu ro'yxatdan yasaladi.
  const payouts: { name: string; amount: number }[] = [];
  const items: SalaryRunItem[] = [];
  for (const ep of chosen) {
    const empDue = payrollDue(ep, period);
    // Faqat MUSBAT qoldiq to'lanadi. Manfiysi — xodimning qarzi, unga pul
    // chiqarilmaydi (aks holda qarz ustiga yana pul berilgan bo'lardi).
    const empPaid = Math.max(empDue, 0);
    // Soliq `payrollDue` ichida allaqachon ayrilgan — bu yerda faqat
    // hisobot va chek uchun alohida qayd etiladi.
    const empGross = payrollEarned(ep, period);
    const empTax = payrollTax(ep, period);
    oylik += empGross;
    bonus += ep.bonus;
    jarima += ep.jarima;
    avans += ep.paidAvans;
    akladi += ep.paidOylik;
    soliq += empTax;
    tolangan += empPaid;
    // To'lov kassadan chiqqani uchun to'langan qism qoldiqda qolmaydi.
    tolanmagan += Math.max(empDue - empPaid, 0);
    // Manfiy qoldiq — xodim hisoblanganidan ko'proq olgan (avans bergan,
    // keyin uni qoplagan to'lov bekor qilingan). Ilgari u shu yerda
    // `Math.max(…, 0)` bilan nolga tenglashtirilardi va qarz IZSIZ
    // yo'qolardi — keyingi oy hisobiga ham o'tmasdi. Endi ishorali holicha
    // saqlanadi: loadCarryOver uni keyingi oyning `carryOver`iga o'tkazadi.
    qarzdorlik += Math.max(-empDue, 0);
    if (empPaid > 0) payouts.push({ name: ep.name, amount: empPaid });
    // `amount` — TO'LOVDAN KEYINGI qoldiq (keyingi oyga o'tadigan had).
    items.push({
      employeeId: ep.id,
      name: ep.name,
      amount: empDue - empPaid,
      paid: empPaid,
      // Chek uchun kesim — chiqarish paytidagi holat muzlatiladi, keyin
      // oylik yoki soliq o'zgarsa ham chek o'zgarmaydi.
      receipt: {
        turi: ep.turi,
        salaryType: ep.salaryType,
        fixedSalary: ep.fixedSalary,
        percent: ep.percent,
        collected: ep.collected,
        day: period.day,
        daysIn: period.daysIn,
        base: payrollBase(ep, period),
        bonus: ep.bonus,
        jarima: ep.jarima,
        gross: empGross,
        taxLines: payrollTaxLines(ep, period),
        tax: empTax,
        paidAvans: ep.paidAvans,
        paidOylik: ep.paidOylik,
        carryOver: ep.carryOver,
      },
    });
  }

  if (tolangan <= 0) {
    return NextResponse.json(
      { ok: false, error: "Tanlangan xodimlarda to'lanadigan summa yo'q — oylik allaqachon chiqarilgan yoki qarzdorlik bor" },
      { status: 400 },
    );
  }

  // Mablag' yetarlimi. Chegara kassaning UMUMIY balansi emas, tanlangan
  // TO'LOV TURIDAGI summa — Kassalar sahifasidagi Chiqim oynasi ham aynan
  // shunday tekshiradi (app/api/cashboxes/[id]/adjust/route.ts).
  const methodTotals = (cashbox.methodTotals ?? {}) as CashboxMethodTotals;
  const available = Number(methodTotals[chosenMethod.key]) || 0;
  if (available < tolangan) {
    return NextResponse.json(
      {
        ok: false,
        error: `Mablag' yetarli emas: "${cashbox.name}" kassasining "${chosenMethod.name}" summasi ${available.toLocaleString("ru-RU")} so'm, kerak ${tolangan.toLocaleString("ru-RU")} so'm`,
        available,
        required: tolangan,
      },
      { status: 400 },
    );
  }

  const col = db.collection("salary_runs");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Pulni kassadan yechamiz. Yozuvlar yaratilishidan OLDIN — shunda
  // balans yetmay qolgan holat (parallel chiqim) yozuvlar tug'ilgandan
  // keyin emas, oldin ushlanadi.
  const updated = await cashboxesCol.findOneAndUpdate(
    { id: cashboxId, [`methodTotals.${chosenMethod.key}`]: { $gte: tolangan } },
    { $inc: { [`methodTotals.${chosenMethod.key}`]: -tolangan, balance: -tolangan } },
    { returnDocument: "after" },
  );
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "Mablag' yetarli emas — kassa balansi shu orada o'zgardi, qayta urinib ko'ring" },
      { status: 409 },
    );
  }

  const txName = await salaryCategory(db);
  const entryDate = todayIso();
  const time = nowTime();

  const run: SalaryRun = {
    id: nextId,
    employeeCount: chosen.length,
    oylik,
    davomat: 0,
    davomatFoizi: 0,
    bonus,
    avans,
    jarima,
    akladi,
    soliq,
    tolangan,
    tolanmagan,
    qarzdorlik,
    cashboxId,
    cashboxName: String(cashbox.name ?? ""),
    method: chosenMethod.key,
    methodLabel: chosenMethod.name,
    createdAt: fmtNow(new Date()),
    month: payrollMonthKey(period),
    items,
  };

  // NIMA UCHUN TRY/CATCH VA ORQAGA QAYTARISH:
  // pul kassadan ALLAQACHON yechildi (yuqoridagi findOneAndUpdate). Agar
  // shundan keyingi yozuvlardan biri yiqilsa (masalan `transaction_entries.id`
  // unikal indeksida to'qnashuv — bir vaqtda kassir ham to'lov kiritsa),
  // ilgari route 500 bilan uzilardi va natijada: kassa kam, yozuvlar
  // yarim, `salary_runs` hujjati esa UMUMAN yo'q edi. Bunday holatni
  // interfeysdan qaytarib bo'lmasdi — chiqarish tarixida qator yo'q, ya'ni
  // o'chirib pulni tiklash ham mumkin emas.
  //
  // Endi har qanday xatoda hammasi joyiga qaytariladi: yaratilgan
  // yozuvlar o'chiriladi, sinxronizatsiya navbati tozalanadi va pul
  // kassaga qaytariladi. Ya'ni amal YO to'liq bajariladi, YO umuman iz
  // qoldirmaydi.
  const createdEntryIds: number[] = [];
  const createdTxIds: number[] = [];
  try {
    // Hujjat yozuvlardan OLDIN qo'yiladi: shunda hatto keyingi bosqichda
    // uzilib qolinsa ham tarixda qator turadi va uni o'chirib bo'ladi.
    await col.insertOne({ ...run });

    // Har bir xodim uchun alohida chiqim yozuvi — jurnal, moliya hisoboti va
    // "to'langan oylik" hisobi xodim kesimida bo'lishi kerak.
    let running = available;
    for (const p of payouts) {
      const before = running;
      running -= p.amount;
      const entryId = await logEntry(db, {
        date: entryDate,
        time,
        // `studentName` — pul chiqarilayotgan XODIM. loadPaidByEmployee
        // to'langan oylikni aynan shu maydondan topadi.
        studentName: p.name,
        amount: -p.amount,
        before,
        after: running,
        txType: "payOut",
        txName,
        paymentType: chosenMethod.name,
        // Kalit yozuvda saqlanadi — bekor qilishda kassaning qaysi
        // maydonini tiklashni nom emas, SHU aniqlaydi (nom o'zgarishi mumkin).
        paymentMethodKey: chosenMethod.key,
        group: "",
        lessonDate: "",
        moderator: String(cashbox.moderator ?? ""),
        // `teacherName` — yozuv kimning oyligiga ta'sir qilishi; chiqimda
        // bu xodimning o'zi (adjust route'idagi bilan bir xil qoida).
        teacherName: p.name,
        reason: "-",
        note: `Oylik chiqarish #${nextId}`,
        status: "",
        cashboxId,
        salaryRunId: nextId,
      });
      createdEntryIds.push(entryId);
      createdTxIds.push(
        await logTransaction(db, {
          date: entryDate,
          time,
          amount: -p.amount,
          category: txName,
          method: chosenMethod.key,
          methodLabel: chosenMethod.name,
          cashboxId,
        }),
      );
    }
  } catch (err) {
    await cashboxesCol.updateOne(
      { id: cashboxId },
      { $inc: { [`methodTotals.${chosenMethod.key}`]: tolangan, balance: tolangan } },
    );
    if (createdEntryIds.length > 0) {
      await db.collection("transaction_entries").deleteMany({ id: { $in: createdEntryIds } });
      // Navbatdagi vazifa qolib ketsa, mavjud bo'lmagan yozuvni yuborishga
      // urinardi — Sheets'da bo'sh qator va guruhda soxta xabar chiqardi.
      await db.collection("sync_outbox").deleteMany({ entryId: { $in: createdEntryIds } }).catch(() => {});
    }
    if (createdTxIds.length > 0) {
      await db.collection("transactions").deleteMany({ id: { $in: createdTxIds } });
    }
    await col.deleteOne({ id: nextId });
    console.error("Oylik chiqarish bekor qilindi (orqaga qaytarildi):", err);
    return NextResponse.json(
      { ok: false, error: "Oylik chiqarilmadi — amal to'liq orqaga qaytarildi, kassadan pul yechilmadi" },
      { status: 500 },
    );
  }

  // Sinxronizatsiya navbati logEntry ichida to'ldirilgan. Yuborish javob
  // ketgandan keyin ishlaydi — oylik chiqarish oynasi Sheets/Telegram
  // javobini kutib turmaydi.
  after(() => flushSoon(db));

  return NextResponse.json({ ok: true, run });
}
