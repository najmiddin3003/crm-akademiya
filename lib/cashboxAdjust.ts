import type { Db } from "mongodb";
import { normalizeCashbox, type Cashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods, PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import { logEntry, logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";
import { buildPayrollRows } from "@/lib/payrollSources";
import { payrollCashLeg, payrollPayout, payrollPeriodOf, payrollPlastikLeg } from "@/lib/salary";
import { findTeacherOfStudent, isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import { isStudentRefundCategory, refundTeacherOf } from "@/lib/studentRefund";
import { studentPaidBalanceByName } from "@/lib/pupilsDb";
import { paymentSmsEnabled, sendPaymentSms } from "@/lib/paymentSms";
import { notifyPayment } from "@/lib/studentBot/notify";
import type { EntryOrigin } from "@/lib/transactionEntries";

// KASSAGA KIRIM / KASSADAN CHIQIM — yadro.
//
// NEGA ROUTE'DAN AJRATILGAN. Ilgari bu mantiq butunlay
// app/api/cashboxes/[id]/adjust/route.ts ichida edi va uni faqat web
// oynasi chaqirardi. Endi ikkinchi kiruvchi bor — xodimlar Telegram boti
// (lib/staffBot): kassir to'lovni botdan kiritadi. Bot HTTP route'ni
// chaqira olmaydi (unda sessiya cookie'si yo'q), mantiqni qayta yozish
// esa ikki nusxa demak — va ular albatta ajralib ketardi: birida oylik
// chegarasi, ikkinchisida o'quvchi balansi tekshirilmay qolardi.
//
// Shu bois yadro BITTA va u:
//   • to'lov turini, kassani, summani tekshiradi;
//   • xodimga avans/oylik chegarasini va o'quvchiga qaytarish chegarasini
//     qo'llaydi;
//   • kassaning `methodTotals` va `balance` ini QOROVUL SHART bilan
//     o'zgartiradi;
//   • jurnalga (`transaction_entries`) va hisobot kolleksiyasiga
//     (`transactions`) yozadi — jurnal yozuvi o'zi Sheets/Telegram
//     navbatiga tushadi (lib/transactionLog.ts);
//   • javob ketgandan keyin bajariladigan ishlarni (`flushSoon`, SMS,
//     o'quvchi botiga xabar) `defer` orqali rejalashtiradi.
//
// Route va bot faqat KIRISHNI tayyorlaydi va NATIJANI o'z tiliga
// o'giradi (HTTP javobi / Telegram xabari). Yadro `NextResponse` ni
// bilmaydi — u sof ma'lumot qaytaradi, shuning uchun uni Node skriptidan
// ham sinash mumkin.

export interface AdjustInput {
  cashboxId: number;
  mode: "kirim" | "chiqim";
  /** To'lov turining KALITI (`settings_payment_methods.key`). */
  method: string;
  amount: number;
  /** Tranzaksiya turining NOMI (`transaction_types.name`) — jurnal nom bo'yicha guruhlaydi. */
  category?: string;
  teacherName?: string;
  studentName?: string;
  /** "YYYY-MM-DD"; bo'sh bo'lsa bugun. */
  date?: string;
  note?: string;
  /** To'lov qaysi oy uchun — "YYYY-MM". Boshqa shakl jimgina tashlanadi. */
  periodMonth?: string;
  /**
   * Tanlangan o'quvchining ID si — faqat SMS/bot xabari uchun (Kirim
   * oynasi yuboradi). Jurnal yozuvi bugungidek ISM bilan ishlaydi, bu
   * maydon unga tegmaydi.
   *
   * NEGA ID KERAK: telefonni ism bo'yicha topib bo'lmaydi — bazada
   * 511 ta ism takrorlanadi va ularning 501 tasida telefon har xil
   * (lib/paymentSms.ts izohiga qarang).
   */
  studentId?: number;
  /** Yozuv qayerdan kiritilgani — web'da yozilmaydi, botda "telegram". */
  origin?: EntryOrigin;
}

export interface AdjustDeps {
  /**
   * JAVOB KETGANDAN KEYIN bajariladigan ish. Route'da bu `after`
   * (next/server): Google va Telegram sekin javob bersa ham kassa oynasi
   * kutib turmaydi. Node skriptida — darhol chaqiradigan yoki umuman
   * chaqirmaydigan funksiya.
   *
   * Bu yerda xato bo'lsa ham to'lov allaqachon bazada: navbat uni
   * keyingi imkoniyatda yoki kunlik tekshiruvda yuboradi.
   */
  defer: (fn: () => void | Promise<void>) => void;
}

export type AdjustOutcome =
  | {
      ok: true;
      /** Yangilangan kassa — `GET /api/cashboxes` javobidagi shaklda (`methodTotals` to'ldirilgan). */
      cashbox: Cashbox;
      /** Jurnal yozuvining id'si — bot kassirga "#708 saqlandi" deb ko'rsatadi. */
      entryId: number;
      /** Yozuvga tushgan qiymatlar — tasdiq xabari uchun. */
      entry: {
        date: string;
        amount: number;
        txName: string;
        paymentType: string;
        studentName: string;
        teacherName: string;
        periodMonth?: string;
      };
    }
  | { ok: false; error: string; status: 400 | 404 };

const fail = (error: string, status: 400 | 404 = 400): AdjustOutcome => ({ ok: false, error, status });

export async function applyCashboxAdjust(db: Db, input: AdjustInput, deps: AdjustDeps): Promise<AdjustOutcome> {
  const { cashboxId, mode, method, amount, category, teacherName, studentName, date, note, periodMonth, studentId } = input;
  if (!Number.isFinite(cashboxId)) return fail("Noto'g'ri id");
  if (mode !== "kirim" && mode !== "chiqim") return fail("Noto'g'ri amal turi");
  if (!amount || amount <= 0) return fail("Qiymatni to'g'ri kiriting");

  // To'lov turlari Sozlamalardan keladi — ro'yxat o'zgarganda bu yerda
  // hech narsa o'zgartirilmaydi.
  const methods = await loadPaymentMethods(db);
  const chosen = methods.find((m) => m.key === method);
  if (!chosen) return fail("To'lov turini tanlang");

  const col = db.collection("cashboxes");
  const current = await col.findOne({ id: cashboxId });
  if (!current) return fail("Kassa topilmadi", 404);

  const signedAmount = mode === "kirim" ? amount : -amount;
  // ERTA TEKSHIRUV — pastdagi oylik chegarasi so'rovlarini bekorga
  // qilmaslik uchun. Bu HIMOYA EMAS: haqiqiy qorovul quyida,
  // `findOneAndUpdate` filtrida (o'sha yerdagi izohga qarang).
  const available = (current.methodTotals as CashboxMethodTotals)[chosen.key] ?? 0;
  if (mode === "chiqim" && available < amount) return fail("Mablag' yetarli emas");

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
        return fail(
          !isPlastik && karta > 0
            ? `Hisoblangan oylik karta summasidan oshmaydi — naqd avans yoki oylik chiqarib bo'lmaydi (qoldiq ${karta.toLocaleString("ru-RU")} so'm kartaga ketadi)`
            : "Bu oyda xodimga chiqariladigan qoldiq yo'q — oylik to'liq chiqarilgan yoki hali hisoblanmagan",
        );
      }
      if (amount > remaining) {
        // Ikki alohida xabar (ichma-ich ternar emas): mijoz xabarni
        // lug'atdagi andozaga teskari moslab tarjima qiladi (lib/i18n.ts).
        const left = remaining.toLocaleString("ru-RU");
        return fail(
          isPlastik
            ? `Summa qolgan oylikdan ko'p bo'lmasin (qolgan: ${left} so'm)`
            : `Summa naqd chiqarish mumkin bo'lgan summadan ko'p bo'lmasin (qolgan: ${left} so'm)`,
        );
      }
    }
  }

  // O'QUVCHIGA PUL QAYTARISH — tur "Mijoz" bo'yicha O'QUVCHIGA qaratilgan
  // chiqim (lib/studentRefund.ts; oyna ham aynan shu qoida bilan o'quvchi
  // tanlovini ko'rsatadi). Bunday yozuv:
  //   • o'quvchi BALANSIDAN ayriladi — shu bois summa balansdan oshmasin
  //     (oyna tekshiradi, bu server zaxirasi; oylik chegarasi bilan bir
  //     uslub);
  //   • USTOZNING shu oydagi tushumidan ayriladi — `teacherName` ga o'sha
  //     to'lov foizi hisoblangan ustoz yoziladi (oyna tanlagan bo'lsa
  //     o'sha, aks holda o'quvchining oxirgi to'lovidagi / guruhidagi
  //     ustoz). Ustoz topilmasa yozuv ustozsiz qoladi — taxmin qilinmaydi.
  // Qolgani (markaz ulushi) shu chiqimning o'zi — kassadan chiqqan pul.
  const studentRefund = mode === "chiqim"
    && !!(studentName || "").trim()
    && (await isStudentRefundCategory(db, category || ""));
  let refundTeacher = "";
  if (studentRefund) {
    const balance = await studentPaidBalanceByName(db, studentName || "");
    if (amount > balance) {
      return fail(`Summa o'quvchi balansidan ko'p bo'lmasin (balans: ${balance.toLocaleString("ru-RU")} so'm)`);
    }
    refundTeacher = (teacherName || "").trim() || (await refundTeacherOf(db, studentName || "")) || "";
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
    return exists ? fail("Mablag' yetarli emas") : fail("Kassa topilmadi", 404);
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
  //   • chiqim + o'quvchiga pul qaytarildi → o'quvchining ustozi (uning
  //     tushumidan ayriladi, yuqoridagi `refundTeacher`)
  //   • kirim → oynada tanlangan o'qituvchi, tanlanmagan bo'lsa
  //     o'quvchining guruhidagi ustoz
  // Topilmasa bo'sh qoladi — taxmin qilinmaydi.
  let salaryTarget = "";
  if (studentRefund) {
    salaryTarget = refundTeacher;
  } else if (mode === "chiqim") {
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

  // Faqat "YYYY-MM" shakli qabul qilinadi.
  const period = typeof periodMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)
    ? periodMonth
    : undefined;

  const entryId = await logEntry(db, {
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
    ...(period ? { periodMonth: period } : {}),
    // O'quvchiga pul qaytarish belgisi — balans va ustoz tushumi shu
    // bayroq bo'yicha ayiradi (lib/transactionEntries.ts izohi). Oddiy
    // chiqimda maydon umuman yozilmaydi.
    ...(studentRefund ? { studentRefund: true } : {}),
    // Qayerdan kiritilgani — faqat bot yozadi (lib/transactionEntries.ts).
    ...(input.origin ? { origin: input.origin } : {}),
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
  // `defer` — javob KASSIRGA YUBORILGANDAN KEYIN ishlaydi, ya'ni Google
  // va Telegram sekin javob bersa ham kassa oynasi kutib turmaydi.
  deps.defer(() => flushSoon(db));

  // TO'LOV SMS I — o'quvchiga "to'lovingiz qabul qilindi" xabari.
  //
  // Shartlar: faqat KIRIM, faqat o'quvchi tanlangan bo'lsa (Kitob sotuvi
  // kabi "Uchinchi shaxs" turlarida o'quvchi yo'q) va faqat sozlama
  // yoqilgan bo'lsa.
  //
  // `defer` ichida — SMS to'lovni BLOKLAMAYDI. Eskiz sekin javob bersa
  // yoki umuman yiqilsa ham pul allaqachon kassaga yozilgan va kassir
  // javobni olgan bo'ladi. `sendPaymentSms` o'zi ham hech qachon
  // otmaydi, natijani `sms_messages` jurnaliga yozadi.
  if (mode === "kirim" && (studentName || "").trim() && paymentSmsEnabled()) {
    deps.defer(() =>
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
    deps.defer(() =>
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
  return {
    ok: true,
    cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)),
    entryId,
    entry: {
      date: entryDate,
      amount: signedAmount,
      txName,
      paymentType: methodLabel,
      studentName: studentName || "",
      teacherName: salaryTarget,
      periodMonth: period,
    },
  };
}
