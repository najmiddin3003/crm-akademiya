import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/revenue-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Moliya → Tushum rejasi sahifasidagi to'rtta raqam. Ilgari sahifa BUTUN
// `transaction_entries` ni (25 569 qator, ~11 MB) yuklab, yig'indini
// brauzerda hisoblardi. Endi Mongo hisoblaydi va to'rtta son qaytadi.
//
// SHART: natija eski klient hisobi bilan BAYT-BA-BAYT bir xil bo'lishi
// kerak — bular moliyaviy ko'rsatkichlar. Shuning uchun shartlar aynan
// o'sha tartibda takrorlangan:
//
//   txType === "payIn"                    -> { txType: "payIn" }
//   e.studentName (bo'sh bo'lmagan satr)  -> { $nin: ["", null] }
//         (Mongo'da maydon YO'Q bo'lsa ham `null` deb qaraladi, ya'ni
//          JS'dagi `undefined` -> falsy bilan bir xil natija beradi)
//   e.date >= from && e.date <= to        -> { $gte, $lte }  (satr taqqoslash;
//          "YYYY-MM-DD" da leksikografik tartib = xronologik)
//
// "O'quvchilar soni" — TAKRORLANMAS ismlar soni (klientdagi `new Set(...)`),
// yozuvlar soni emas.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** payIn + o'quvchisi ko'rsatilgan yozuvlar. */
const BASE = { txType: "payIn", studentName: { $nin: ["", null] } };

const SUMMARY_STAGES = [
  { $group: { _id: null, amount: { $sum: "$amount" }, students: { $addToSet: "$studentName" } } },
  { $project: { _id: 0, amount: 1, students: { $size: "$students" } } },
];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
    return NextResponse.json(
      { ok: false, error: "from va to kerak (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");

  const [thisMonth, before] = await Promise.all([
    col.aggregate([{ $match: { ...BASE, date: { $gte: from, $lte: to } } }, ...SUMMARY_STAGES]).toArray(),
    col.aggregate([{ $match: { ...BASE, date: { $lt: from } } }, ...SUMMARY_STAGES]).toArray(),
  ]);

  // Bitta ham yozuv topilmasa `$group` hech narsa qaytarmaydi — nol.
  const pick = (r: Record<string, unknown>[]) => ({
    amount: Number(r[0]?.amount ?? 0),
    students: Number(r[0]?.students ?? 0),
  });
  const a = pick(thisMonth);
  const b = pick(before);

  return NextResponse.json({
    ok: true,
    paidAmount: a.amount,
    paidStudents: a.students,
    paidBeforeAmount: b.amount,
    paidBeforeStudents: b.students,
  });
}
