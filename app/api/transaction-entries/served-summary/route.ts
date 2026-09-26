import { NextResponse } from "next/server";
import { ENTRY_PAID_EXPR } from "@/lib/transactionEntries";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/served-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Hisobotlar → "Xizmat ko'rsatilgan" sahifasidagi o'qituvchilar jadvali.
//
// Ilgari sahifa `/api/transaction-entries?txType=payIn&excludeCancelled=1`
// ni LIMITSIZ chaqirardi: 18 757 ta to'liq hujjat (~9.0 MB) brauzerga
// tushardi, sahifa esa ulardan atigi UCHTA maydonni o'qib (date,
// teacherName, amount) ko'pi bilan 45 ta qator chiqarardi.
// O'lchandi: 4 498 ms → ~180 ms, 9 019 KB → ~2 KB.
//
// Bu — Tushum rejasi uchun allaqachon qilingan ishning aynan o'zi
// (revenue-summary/route.ts), shunchaki bu iste'molchi o'shanda
// e'tibordan chetda qolgan edi.
//
// SHART: natija eski klient hisobi bilan bir xil bo'lishi kerak. Shuning
// uchun shartlar aynan o'sha tartibda takrorlangan:
//
//   txType === "payIn"                  -> { txType: "payIn" }
//   excludeCancelled=1                  -> { status: { $ne: "cancelled" } }
//   `if (!d) return false`              -> { date: { $nin: ["", null] } }
//         (sanasi yo'q yozuv oraliq tanlanmagan bo'lsa ham tashlanardi)
//   d >= from && d <= to                -> { $gte, $lte }  ("YYYY-MM-DD"
//         satrlarida leksikografik tartib = xronologik)
//
// GURUHLASH XOM `teacherName` BO'YICHA. Ismni normallashtirish (trim +
// kichik harf) ataylab klientda qoladi: sahifadagi `nameKey` guruhlar
// jadvalidagi o'qituvchi ismlari bilan ham bir xil ishlashi kerak, ya'ni
// qoida BITTA joyda turishi shart. Shu sababli "o'qituvchisi
// ko'rsatilmagan" yozuvlar ham alohida tashlanmaydi — ular ham qator
// bo'lib qaytadi (`teacherName: ""`), sahifa esa ularni o'zining
// `unattributedTotal` hisobida ishlatadi.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) {
    return NextResponse.json(
      { ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" },
      { status: 400 },
    );
  }

  // Sanasi bo'sh yozuv har doim chiqib ketadi; oraliq berilgan bo'lsa
  // ustiga chegaralar qo'shiladi.
  const date: Record<string, unknown> = { $nin: ["", null] };
  if (from) date.$gte = from;
  if (to) date.$lte = to;

  const db = await ensureIndexes();
  const grouped = await db
    .collection("transaction_entries")
    .aggregate([
      // O'QUVCHIGA QAYTARILGAN PUL AYRILADI (18.09.2026): qaytarim yozuvi
      // (`payOut` + `studentRefund: true`, lib/studentRefund.ts) o'sha
      // ustozning `teacherName` i va MANFIY summa bilan turadi — ishorali
      // yig'indi uni o'z-o'zidan ayiradi. Oylik hisobidagi `collected`
      // bilan bir xil qoida (lib/payrollSources.ts), faqat bu yerda oy
      // emas, `date` oralig'i.
      {
        $match: {
          $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }],
          status: { $ne: "cancelled" },
          date,
        },
      },
      // Tanga evaziga chegirma ham ustozniki — oylikdagi `collected` bilan
      // bir xil: ustoz foizi TO'LIQ narxdan (TZ 4.16.4).
      { $group: { _id: "$teacherName", amount: { $sum: ENTRY_PAID_EXPR } } },
      // Tartib aniq bo'lsin — $group tartibi kafolatlanmaydi.
      { $sort: { _id: 1 } },
    ])
    .toArray();

  const rows = grouped.map((r) => ({
    // Maydon yo'q bo'lsa Mongo `null` qaytaradi — klientdagi
    // `String(v ?? "")` uni bo'sh satrga aylantiradi, ya'ni eski xulq.
    teacherName: r._id === null || r._id === undefined ? "" : String(r._id),
    amount: Number(r.amount) || 0,
  }));

  return NextResponse.json({ ok: true, rows });
}
