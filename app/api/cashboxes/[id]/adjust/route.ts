import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type CashboxMethodTotals } from "@/lib/cashboxes";
import { loadPaymentMethods } from "@/lib/paymentMethods";
import { logEntry, logTransaction, nowTime, todayIso } from "@/lib/transactionLog";
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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { mode, method, amount, category, teacherName, studentName, date, note } = body;
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
  const before = (current.methodTotals as CashboxMethodTotals)[chosen.key] ?? 0;
  if (mode === "chiqim" && before < amount) {
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

  const res = await col.findOneAndUpdate(
    { id: cashboxId },
    { $inc: { [`methodTotals.${method}`]: signedAmount, balance: signedAmount } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }

  const methodLabel = chosen.name;
  const entryDate = date || todayIso();
  const txName = category || (mode === "kirim" ? "O'quvchi to'ladi" : "Boshqa");

  // Yozuv qaysi o'qituvchining oyligiga tegishli.
  //   • chiqim + "hodimga avans/oylik" → puli chiqarilayotgan xodim
  //   • kirim → oynada tanlangan o'qituvchi, tanlanmagan bo'lsa
  //     o'quvchining guruhidagi ustoz
  // Topilmasa bo'sh qoladi — taxmin qilinmaydi.
  let salaryTarget = "";
  if (mode === "chiqim" && isEmployeePayoutCategory(category)) {
    salaryTarget = (studentName || "").trim();
  } else if (mode === "kirim") {
    salaryTarget = (teacherName || "").trim() || (await findTeacherOfStudent(db, studentName || "")) || "";
  }
  await logEntry(db, {
    date: entryDate,
    time: nowTime(),
    studentName: studentName || "",
    amount: signedAmount,
    before,
    after: before + signedAmount,
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

  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, methods.map((m) => m.key)) });
}
