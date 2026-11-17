import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { createPenalty, type PenaltyInput, type PenaltyRecord } from "@/lib/penaltyCreate";

// Moliya → Jarima backend'i (MongoDB `penalties`). Demo seed YO'Q — kolleksiya
// bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.
//
// DIQQAT: Bonus'dagi "Kim tomonidan" (`givenBy`) nuqsoni bu yerda YO'Q —
// Penalty modelida bunday maydon umuman yo'q va PenaltiesPage bunday ustunni
// ko'rsatmaydi. Shuning uchun bu yerga qattiq yozilgan ism qo'shilmadi ham:
// mavjud bo'lmagan ma'lumot o'ylab topilmaydi.
//
// Saqlanadigan yozuv shakli (`PenaltyRecord`) va yozish mantig'i — lib/penaltyCreate.ts:
// xodim uchun balans manbasi yo'q, ya'ni `before`/`after` null bo'lishi mumkin.

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("penalties");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const penalties = rows.map(({ _id, ...rest }) => rest as unknown as PenaltyRecord);
  return NextResponse.json({ ok: true, penalties });
}

// POST — "Jarima qo'shish": Bonus bilan bir xil zanjir mantig'i, lekin
// ayirib boradi. "Oldingi miqdor" shu odamga oldin berilgan SO'NGGI jarima
// yozuvidagi "keyingi miqdor"dan davom etadi (bekor qilingan bo'lsa ham —
// bekor qilish faqat holat belgisi, zanjirni qayta hisoblamaydi); birinchi
// jarima bo'lsa:
//   • o'quvchi → HAQIQIY balansdan (bekor qilinmagan `payIn`
//     `transaction_entries` yig'indisi, lib/pupilsDb.ts). ILGARI bu yerda
//     `pupils.balance` o'qilardi — uni hech bir API yangilamaydi, ya'ni
//     jadvaldagi "Oldingi/Keyingi miqdor" o'ylab topilgan son edi.
//   • xodim    → null: xodimning balansi tizimda yuritilmaydi, 0 yozish
//     soxta faktik da'vo bo'lardi. Jadvalda "—".
export async function POST(req: Request) {
  let body: PenaltyInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  // Yozish mantig'i — lib/penaltyCreate.ts (Davomat nazoratidagi «Jarima yozish» bilan umumiy).
  const db = await ensureIndexes();
  const res = await createPenalty(db, body);
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, penalty: res.penalty });
}
