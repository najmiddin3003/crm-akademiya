import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { studentBalanceMatch } from "@/lib/studentRefund";

// GET /api/students/balances — har bir o'quvchining balansi.
//
// Manba: `transaction_entries` — o'quvchi qilgan to'lovlar (payIn) MINUS
// unga qaytarib berilgan pul (payOut + `studentRefund: true`), bekor
// qilinganlarsiz. Shart BITTA joyda — lib/studentRefund.ts →
// studentBalanceMatch (lib/pupilsDb.ts ham aynan shuni ishlatadi, ya'ni
// balans ikki joyda ikki xil chiqmaydi). Kassalardagi "Kirim" va "Chiqim"
// oynalarida o'quvchi tanlanayotganda uning balansi ko'rsatiladi.
//
// DIQQAT: bu TO'LANGAN pul yig'indisi. Tizimda o'quvchining to'lashi kerak
// bo'lgan summa (dars narxi × dars soni) yuritilmaydi, shuning uchun
// "qarzdorlik" hisoblab bo'lmaydi va o'ylab topilmaydi ham.
export async function GET() {
  const db = await ensureIndexes();
  // Yig'indi MONGO'da hisoblanadi. Ilgari 16 937 qator Node'ga kelib,
  // pastdagi tsikl ularni shu yerda qo'shardi — natija esa atigi ~3 264 ta
  // kalit, ya'ni kelgan qatorlarning ~80% i allaqachon xaritada bor kalit
  // edi. O'lchandi: 1 167 ms → ~480 ms, 899 KB → ~140 KB.
  //
  // Guruhlash XOM `studentName` bo'yicha ketadi, kichik harfga o'tkazish
  // esa pastda, JS'da qoladi. Bu ataylab: bazada chetida bo'shliq bor 15 ta
  // yozuv va katta-kichik harfi farq qiladigan 38 ta ism juftligi bor —
  // ular AYNAN shu `trim().toLowerCase()` orqali birlashadi. Mongo'da
  // `$toLower` bilan guruhlash o'zbek harflarida boshqacha ishlashi
  // mumkin, shuning uchun qoida bir joyda — JS'da — qoladi.
  const rows = await db
    .collection("transaction_entries")
    .aggregate([
      // Qaytarim yozuvi MANFIY summa bilan turadi — ishorali yig'indi uni
      // o'z-o'zidan ayiradi.
      { $match: studentBalanceMatch() },
      { $group: { _id: "$studentName", total: { $sum: "$amount" } } },
    ])
    .toArray();

  const balances: Record<string, number> = {};
  for (const r of rows) {
    const key = String(r._id ?? "").trim().toLowerCase();
    if (!key) continue;
    balances[key] = (balances[key] ?? 0) + (Number(r.total) || 0);
  }

  return NextResponse.json({ ok: true, balances });
}
