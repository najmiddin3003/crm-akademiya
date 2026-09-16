import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods, PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import { logEntry, logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";
import { buildPayrollRows } from "@/lib/payrollSources";
import { payrollCashLeg, payrollPayout, payrollPeriodOf, payrollPlastikLeg } from "@/lib/salary";
import { findTeacherOfStudent, isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import { paymentSmsEnabled, sendPaymentSms } from "@/lib/paymentSms";
import { notifyPayment } from "@/lib/studentBot/notify";

// POST /api/cashboxes/:id/adjust — kassaning bitta to'lov turiga Kirim
// qo'shadi yoki undan Chiqim oladi. Ko'chirishdan farqi — bu safar umumiy
// balans ham o'zgaradi (pul kassaning o'ziga kirdi/undan chiqdi). Har bir
// amal "transaction_entries" (Tranzaksiyalar jurnali) va "transactions"
// (Moliya hisobotlari/analitikasi — daromad/xarajat) kolleksiyalariga ham
// haqiqiy yozuv qo'shadi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: {
    mode?: string; method?: string; amount?: number;
    category?: string; teacherName?: string; studentName?: string; date?: string; note?: string;
    periodMonth?: string;
    /**
     * Tanlangan o'quvchining ID si — faqat SMS uchun (Kirim oynasi
     * yuboradi). Jurnal yozuvi bugungidek ISM bilan ishlaydi, bu maydon
     * unga tegmaydi.
     *
     * NEGA ID KERAK: telefonni ism bo'yicha topib bo'lmaydi — bazada
     * 511 ta ism takrorlanadi va ularning 501 tasida telefon har xil
     * (lib/paymentSms.ts izohiga qarang).
     */
    studentId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { mode, method, amount, category, teacherName, studentName, date, note, periodMonth, studentId } = body;
  if (mode !== "kirim" && mode !== "chiqim") {
    return NextResponse.json({ ok: false, error: "Noto'g'ri amal turi" }, { status: 400 });
  }
  if (!amount || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Qiymatni to'g'ri kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // To'lov turlari Sozlamalardan keladi — ro'yxat o'zgarganda bu yerda
  // hech narsa o'zgartirilmaydi.
  const methods = await loadPaymentMethods(db);
  const chosen = methods.find((m) => m.key === method);
  if (!chosen) {
    return NextResponse.json({ ok: false, error: "To'lov turini tanlang" }, { status: 400 });
  }
  const col = db.collection("cashboxes");
  const current = await col.findOne({ id: cashboxId });
  if (!current) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  const signedAmount = mode === "kirim" ? amount : -amount;
  // ERTA TEKSHIRUV — pastdagi oylik chegarasi so'rovlarini bekorga
  // qilmaslik uchun. Bu HIMOYA EMAS: haqiqiy qorovul quyida,
  // `findOneAndUpdate` filtrida (o'sha yerdagi izohga qarang).
  const available = (current.methodTotals as CashboxMethodTotals)[chosen.key] ?? 0;
  if (mode === "chiqim" && available < amount) {
    return NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 });
  }

  // Xodimga oylik/avans chiqarilsa — summa xodimning shu oyda CHIQARISH
  // MUMKIN bo'lgan qoldig'idan oshmasligi kerak. Frontend (Chiqim oynasi)
  // ham tekshiradi, bu backend zaxira — ikkalasi BIR XIL funksiyalar bilan
  // (lib/salary.ts), ya'ni oyna ruxsat bergan summani server rad etmaydi va
  // aksincha.
  //
  // QOIDA (foydalanuvchi, 16.09.2026): xodim ishlab topgani avval KARTAGA
  // ketadi, qo'lga faqat undan oshgani. Shu bois:
  //   naqd (va boshqa) turida chegara → payrollCashLeg — hisoblangan −
  //                                      soliq − karta oyog'i − olingan;
  //   plastik turida               → payrollPayout  — karta + naqd.
  //
  // NIMA NOTO'G'RI EDI: chegara `fixedSalaryOf − olingan` edi — soliqni
  // ham, kartani ham hisobga olmasdi va FAQAT okladli xodimga qo'llanardi
  // (foizli o'qituvchida `fixedSalaryOf` 0, ya'ni `isSalaryConfigured`
  // yolg'on va tekshiruv umuman o'tkazib yuborilardi). Shu teshikdan
  // kartasi qoplanmagan o'qituvchiga naqd avans chiqib ketardi.
  //
  // Oyligi SOZLANMAGAN xodimga (oklad ham, foiz ham yo'q) chegara
  // qo'llanmaydi: aks holda 0 deb o'qilib, hamma to'lov rad etilgan
  // bo'lardi. Sozlanmagani "0 oylik" degani emas.
  //
  // Qator BUTUN KOMPANIYA bo'yicha quriladi (filialga kesilmaydi) — Chiqim
  // oynasi ham `branch=all` bilan so'raydi; xodim boshqa filialning oylik
  // ro'yxatida bo'lsa ham chegara o'sha yerdagi raqam bilan bir xil.
  if (mode === "chiqim" && studentName && /avans|oylik/i.test(category || "")) {
    const dateIso = date || todayIso();
    const period = payrollPeriodOf(dateIso.slice(0, 7));
    const rows = await buildPayrollRows(db, period);
    const key = studentName.trim().toLowerCase();
    const row = rows.find((e) => e.name.trim().toLowerCase() === key);
    if (row && row.configured) {
      const isPlastik = chosen.key === PLASTIK_METHOD_KEY;
      const remaining = isPlastik ? payrollPayout(row, period) : payrollCashLeg(row, period);
      if (remaining <= 0) {
        // Sabab AYNAN aytiladi: karta hali qoplanmagan bo'lsa "oylik
        // tugagan" degan xabar yolg'on bo'lardi.
        const karta = payrollPlastikLeg(row, period);
        const error = !isPlastik && karta > 0
          ? `Hisoblangan oylik karta summasidan oshmaydi — naqd avans yoki oylik chiqarib bo'lmaydi (qoldiq ${karta.toLocaleString("ru-RU")} so'm kartaga ketadi)`
          : "Bu oyda xodimga chiqariladigan qoldiq yo'q — oylik to'liq chiqarilgan yoki hali hisoblanmagan";
        return NextResponse.json({ ok: false, error }, { status: 400 });
      }
      if (amount > remaining) {
        return NextResponse.json(
          {
            ok: false,
            error: `Summa ${isPlastik ? "qolgan oylikdan" : "naqd chiqarish mumkin bo'lgan summadan"} ko'p bo'lmasin (qolgan: ${remaining.toLocaleString("ru-RU")} so'm)`,
          },
          { status: 400 },
        );
      }
    }
  }

  // QOROVUL SHARTNING O'ZI FILTRDA — `transfer-to` va `salary-runs` bilan
  // bir xil uslub.
  //
  // NIMA NOTO'G'RI EDI: shart yuqorida `findOne` bilan O'QIB tekshirilar,
  // yozish esa shartsiz (`{ id: cashboxId }`) ketardi. Ikkita oqibati bor edi:
  //
  //   1. O'qish bilan yozish orasida boshqa so'rov o'sha puldan sarflab
  //      ulgursa, ikkala chiqim ham o'tib ketardi.
  //   2. Shart faqat `methodTotals` ga qarardi, `balance` ga UMUMAN
  //      qaramasdi. 2026-09-03 da Nilufar kassasi aynan shundan `-1` ga
  //      tushdi: `methodTotals.plastik` da jurnalda izi yo'q soxta 1 turgan
  //      va 1 so'mlik chiqim o'shani "yeb" ketgan — to'lov turi uchun pul
  //      bor edi, balans uchun esa yo'q.
  //
  // Shu bois endi IKKALASI ham shart: to'lov turi ham, umumiy balans ham
  // yetarli bo'lishi kerak. Sog'lom kassada `balance` turlar yig'indisiga
  // teng, ya'ni ikkinchi shart hech narsani to'smaydi — u faqat hujjat
  // allaqachon buzilgan holatda ishga tushadi.
  const res = await col.findOneAndUpdate(
    mode === "chiqim"
      ? {
          id: cashboxId,
          [`methodTotals.${method}`]: { $gte: amount },
          balance: { $gte: amount },
        }
      : { id: cashboxId },
    { $inc: { [`methodTotals.${method}`]: signedAmount, balance: signedAmount } },
    { returnDocument: "after" },
  );
  if (!res) {
    // Shart bajarilmadi. Kassaning o'zi yo'qolgani kamdan-kam, deyarli
    // doim mablag' yetmagani — ikkovini ajratamiz, aks holda kassir
    // "Kassa topilmadi" degan chalg'ituvchi xabar olardi.
    const exists = await col.findOne({ id: cashboxId }, { projection: { _id: 1 } });
    return exists
      ? NextResponse.json({ ok: false, error: "Mablag' yetarli emas" }, { status: 400 })
      : NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  // Jurnaldagi "oldingi/keyingi miqdor" YOZILGAN natijadan chiqariladi,
  // yuqorida o'qilgan `current` dan emas: parallel so'rov oralab ketsa u
  // eskirgan bo'lardi va jurnalda uzilgan ketma-ketlik qolardi.
  const afterTotal = (res.methodTotals as CashboxMethodTotals)[chosen.key] ?? 0;
  const beforeTotal = afterTotal - signedAmount;

  const methodLabel = chosen.name;
  const entryDate = date || todayIso();
  const txName = category || (mode === "kirim" ? "O'quvchi to'ladi" : "Boshqa");

  // Yozuv qaysi o'qituvchining oyligiga tegishli.
  //   • chiqim + "hodimga avans/oylik" → puli chiqarilayotgan xodim
  //   • kirim → oynada tanlangan o'qituvchi, tanlanmagan bo'lsa
  //     o'quvchining guruhidagi ustoz
  // Topilmasa bo'sh qoladi — taxmin qilinmaydi.
  let salaryTarget = "";
  if (mode === "chiqim") {
    // Nomida "avans"/"oylik" bo'lgan turlarda xodim `studentName` da keladi
    // (jurnaldagi "KIM" ustuni), qolgan XODIM turlarida esa — "KPI bonusi",
    // "Oyning eng yaxshi o'qituvchisi", "Bayram mukofoti" — oyna uni
    // `teacherName` da alohida yuboradi. Ilgari ikkinchi holat umuman
    // qaralmasdi va bunday chiqim hech kimga biriktirilmasdi.
    salaryTarget = isEmployeePayoutCategory(category)
      ? (studentName || "").trim()
      : (teacherName || "").trim();
  } else if (mode === "kirim") {
    salaryTarget = (teacherName || "").trim() || (await findTeacherOfStudent(db, studentName || "")) || "";
  }
  await logEntry(db, {
    date: entryDate,
    time: nowTime(),
    studentName: studentName || "",
    amount: signedAmount,
    before: beforeTotal,
    after: afterTotal,
    txType: mode === "kirim" ? "payIn" : "payOut",
    txName,
    paymentType: methodLabel,
    // To'lov turining BARQAROR kaliti.
    //
    // NIMA UCHUN KERAK: `paymentType` — Sozlamalardan o'zgartirilishi
    // mumkin bo'lgan KO'RINADIGAN nom, ya'ni undan kanalni aniqlash
    // ishonchsiz. Kalit esa o'zgarmaydi. Oylik hisobi shu maydondan
    // "xodimga PLASTIK bilan qancha berilgan"ni o'qiydi
    // (lib/payrollSources.ts → loadPaidByEmployee).
    //
    // NIMA NOTO'G'RI EDI: bu yerda maydon UMUMAN yozilmasdi (o'lchandi:
    // bazadagi 19 ta chiqim yozuvining birortasida ham yo'q). Kassa
    // oynasidan kartaga qo'lda berilgan oylik hisobga tushmasdi va
    // keyingi "Oylik chiqarish" kartaga YANA to'liq summa yuborardi.
    paymentMethodKey: chosen.key,
    group: "",
    lessonDate: "",
    // `moderator` — yozuvni qayd etgan kassa mas'uli.
    moderator: current.moderator || "",
    // `teacherName` — yozuv KIMNING oyligiga ta'sir qilishi:
    //   kirim  → to'lagan o'quvchining ustozi (qo'lda tanlangan bo'lsa
    //            o'sha, aks holda guruhidan topiladi),
    //   chiqim → puli chiqarilayotgan xodimning o'zi.
    teacherName: salaryTarget,
    reason: "-",
    note: note || "",
    status: "",
    cashboxId,
    // To'lov QAYSI OY uchun ekani — Kirim oynasida tanlanadi.
    // Sana bilan bir xil bo'lsa ham yoziladi: keyinchalik "bu yozuvda oy
    // ataylab tanlanganmi yoki eski yozuvmi?" degan savol tug'ilmasin.
    // Faqat "YYYY-MM" shakli qabul qilinadi.
    ...(typeof periodMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)
      ? { periodMonth }
      : {}),
  });
  await logTransaction(db, {
    date: entryDate,
    time: nowTime(),
    amount: signedAmount,
    category: txName,
    method: chosen.key,
    methodLabel,
    cashboxId,
  });

  // Yozuv navbatga logEntry ichida qo'yilgan (lib/transactionLog.ts).
  // `after` — javob KASSIRGA YUBORILGANDAN KEYIN ishlaydi, ya'ni Google
  // va Telegram sekin javob bersa ham kassa oynasi kutib turmaydi.
  // Bu yerda xato bo'lsa ham to'lov allaqachon bazada: navbat uni
  // keyingi imkoniyatda yoki kunlik tekshiruvda yuboradi.
  after(() => flushSoon(db));

  // TO'LOV SMS I — o'quvchiga "to'lovingiz qabul qilindi" xabari.
  //
  // Shartlar: faqat KIRIM, faqat o'quvchi tanlangan bo'lsa (Kitob sotuvi
  // kabi "Uchinchi shaxs" turlarida o'quvchi yo'q) va faqat sozlama
  // yoqilgan bo'lsa.
  //
  // `after` ichida — SMS to'lovni BLOKLAMAYDI. Eskiz sekin javob bersa
  // yoki umuman yiqilsa ham pul allaqachon kassaga yozilgan va kassir
  // javobni olgan bo'ladi. `sendPaymentSms` o'zi ham hech qachon
  // otmaydi, natijani `sms_messages` jurnaliga yozadi.
  if (mode === "kirim" && (studentName || "").trim() && paymentSmsEnabled()) {
    after(() =>
      sendPaymentSms(db, {
        pupilId: Number.isFinite(Number(studentId)) ? Number(studentId) : null,
        pupilName: (studentName || "").trim(),
        amount,
        moderator: current.moderator || "",
        cashboxId,
        cashboxName: current.name || "",
      }),
    );
  }

  // O'QUVCHILAR BOTI — "to'lovingiz qabul qilindi" xabari.
  //
  // SMS bilan YONMA-YON, uning o'rniga emas: SMS hammaga boradi, bot
  // xabari esa faqat botga ulanganlarga. Ikkalasini birlashtirish
  // ulanmagan o'quvchini xabarsiz qoldirardi.
  //
  // FAQAT `studentId` BO'LGANDA. Ism bo'yicha qidirilmaydi — bazada
  // 511 ta ism takrorlanadi va begona odamga boshqa birovning to'lovi
  // haqida xabar ketishi mumkin edi (lib/studentBot/notify.ts).
  //
  // `notifyPayment` o'zi hech qachon otmaydi va sozlama o'chiq bo'lsa
  // jimgina qaytadi.
  if (mode === "kirim" && Number.isFinite(Number(studentId))) {
    after(() =>
      notifyPayment(db, {
        pupilId: Number(studentId),
        amount,
        method: methodLabel,
        date: entryDate,
        // Xabarlar jurnali uchun — SMS yozuvidagi bilan bir xil maydonlar.
        pupilName: (studentName || "").trim(),
        moderator: current.moderator || "",
        cashboxId,
        cashboxName: current.name || "",
      }),
    );
  }

  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)) });
}
