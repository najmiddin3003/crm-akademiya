import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
import { flushSoon } from "@/lib/sync/dispatch";
import { fixedSalaryOf, isSalaryConfigured, type HrEmployee } from "@/lib/hrEmployees";
import { findTeacherOfStudent, isEmployeePayoutCategory } from "@/lib/teacherOfStudent";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { mode, method, amount, category, teacherName, studentName, date, note, periodMonth } = body;
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

  // Xodimga oylik/avans chiqarilsa — shu oyda ushbu xodim uchun oldin
  // chiqarilgan oylik+avans yig'indisi bilan birga uning oyligidan
  // oshib ketmasligi kerak. Frontendda ham tekshiriladi, backend zaxira.
  if (mode === "chiqim" && studentName && /avans|oylik/i.test(category || "")) {
    const employees = await db.collection("hr_employees").find({ name: studentName }).toArray();
    const employee = employees.find((e) => !e.archReason) || employees[0];
    // Chegara xodimning HAQIQIY oyligiga tayanadi (xodim kartasidagi
    // filiallar bo'yicha ish haqi). Ilgari bu yerda xodim id'sidan
    // hisoblanadigan demo funksiya turardi — ya'ni o'ylab topilgan raqam
    // haqiqiy pulning chiqishini to'sar yoki ortiqcha chiqishiga yo'l
    // qo'yardi.
    //
    // Oyligi SOZLANMAGAN xodimga chegara qo'llanmaydi: aks holda 0 deb
    // o'qilib, hamma to'lov rad etilgan bo'lardi. Sozlanmagani "0 oylik"
    // degani emas.
    const empRec = employee as unknown as HrEmployee | undefined;
    if (empRec && typeof empRec.id === "number" && isSalaryConfigured(empRec)) {
      const oylik = fixedSalaryOf(empRec);
      const dateIso = date || todayIso();
      const month = dateIso.slice(0, 7);
      const prior = await db
        .collection("transaction_entries")
        .find({
          studentName,
          txType: "payOut",
          date: { $regex: `^${month}-` },
          status: { $ne: "cancelled" },
        })
        .toArray();
      const paid = prior
        .filter((r) => /avans|oylik/i.test(String(r.txName ?? "")))
        .reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
      const remaining = Math.max(0, oylik - paid);
      if (remaining <= 0) {
        return NextResponse.json(
          { ok: false, error: "Bu oyga xodim oyligi to'liq chiqarib bo'lingan — keyingi oygacha qo'shimcha pul chiqarib bo'lmaydi" },
          { status: 400 },
        );
      }
      if (amount > remaining) {
        return NextResponse.json(
          { ok: false, error: `Summa qolgan oylikdan ko'p bo'lmasin (qolgan: ${remaining})` },
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

  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)) });
}
