import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { applyCashboxAdjust, type AdjustInput } from "@/lib/cashboxAdjust";

// POST /api/cashboxes/:id/adjust — kassaning bitta to'lov turiga Kirim
// qo'shadi yoki undan Chiqim oladi. Ko'chirishdan farqi — bu safar umumiy
// balans ham o'zgaradi (pul kassaning o'ziga kirdi/undan chiqdi). Har bir
// amal "transaction_entries" (Tranzaksiyalar jurnali) va "transactions"
// (Moliya hisobotlari/analitikasi — daromad/xarajat) kolleksiyalariga ham
// haqiqiy yozuv qo'shadi.
//
// BUTUN MANTIQ lib/cashboxAdjust.ts da — bu route faqat HTTP qobig'i.
// Sabab: xuddi shu amalni xodimlar Telegram boti ham bajaradi
// (lib/staffBot), va ikkala kiruvchi bitta yadrodan o'tishi shart —
// aks holda chegara tekshiruvlari ikki joyda ikki xil bo'lib qolardi.
//
// Ruxsat: proxy.ts (`/finance-cash`, lib/apiPermissions.generated.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: {
    mode?: string; method?: string; amount?: number;
    category?: string; teacherName?: string; studentName?: string; date?: string; note?: string;
    periodMonth?: string; studentId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  // Maydonlar NOMMA-NOM olinadi, `...body` bilan emas: `origin` web'dan
  // YOZILMAYDI (lib/transactionEntries.ts) va so'rov tanasidagi begona
  // maydon yadroga o'tib ketmasin. `mode` yadroda tekshiriladi —
  // noto'g'ri qiymat "Noto'g'ri amal turi" bilan qaytadi.
  const input: AdjustInput = {
    cashboxId,
    mode: body.mode as AdjustInput["mode"],
    method: String(body.method ?? ""),
    amount: Number(body.amount),
    category: body.category,
    teacherName: body.teacherName,
    studentName: body.studentName,
    date: body.date,
    note: body.note,
    periodMonth: body.periodMonth,
    studentId: body.studentId,
  };

  const db = await ensureIndexes();
  // `after` — javob KASSIRGA YUBORILGANDAN KEYIN ishlaydi, ya'ni Google
  // va Telegram sekin javob bersa ham kassa oynasi kutib turmaydi.
  const out = await applyCashboxAdjust(db, input, { defer: after });
  if (!out.ok) {
    return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  }
  return NextResponse.json({ ok: true, cashbox: out.cashbox });
}
