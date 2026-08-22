import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/students/balances — har bir o'quvchining balansi.
//
// Manba: `transaction_entries` — o'quvchi qilgan to'lovlar (payIn), bekor
// qilinganlarsiz. Kassalardagi "Kirim" oynasida o'quvchi tanlanayotganda
// uning balansi ko'rsatiladi.
//
// DIQQAT: bu TO'LANGAN pul yig'indisi. Tizimda o'quvchining to'lashi kerak
// bo'lgan summa (dars narxi × dars soni) yuritilmaydi, shuning uchun
// "qarzdorlik" hisoblab bo'lmaydi va o'ylab topilmaydi ham.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db
    .collection("transaction_entries")
    .find({ txType: "payIn", status: { $ne: "cancelled" }, studentName: { $nin: ["", null] } })
    .project({ studentName: 1, amount: 1 })
    .toArray();

  const balances: Record<string, number> = {};
  for (const r of rows) {
    const key = String(r.studentName ?? "").trim().toLowerCase();
    if (!key) continue;
    balances[key] = (balances[key] ?? 0) + (Number(r.amount) || 0);
  }

  return NextResponse.json({ ok: true, balances });
}
