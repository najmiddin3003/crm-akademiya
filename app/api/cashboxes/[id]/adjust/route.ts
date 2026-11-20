import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { applyCashboxAdjust, applyCashboxKirimSplit, type AdjustInput, type KirimSplitLeg } from "@/lib/cashboxAdjust";

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
    splits?: unknown;
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

  // ARALASH TO'LOV (20.11.2026) — `splits: [{ method, amount }, …]`, faqat kirimda:
  // har to'lov turi alohida yozuv, umumiy kalit bilan (lib/cashboxAdjust.ts →
  // applyCashboxKirimSplit). Bunda `method`/`amount` o'qilmaydi — summa bo'laklardan.
  if (body.splits !== undefined) {
    if (input.mode !== "kirim") {
      return NextResponse.json({ ok: false, error: "Bir nechta to'lov turi faqat kirimda" }, { status: 400 });
    }
    if (!Array.isArray(body.splits)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
    }
    const legs: KirimSplitLeg[] = body.splits.map((x) => {
      const r = (x ?? {}) as { method?: unknown; amount?: unknown };
      return { method: String(r.method ?? ""), amount: Number(r.amount) };
    });
    const split = await applyCashboxKirimSplit(
      db,
      {
        cashboxId,
        category: input.category,
        teacherName: input.teacherName,
        studentName: input.studentName,
        date: input.date,
        note: input.note,
        periodMonth: input.periodMonth,
        studentId: input.studentId,
      },
      legs,
      { defer: after },
    );
    if (!split.ok) {
      return NextResponse.json({ ok: false, error: split.error }, { status: split.status });
    }
    // `entryId` — birinchi bo'lak: «Chekni ko'rish» undan `splitId` orqali hammasini oladi.
    return NextResponse.json({ ok: true, cashbox: split.cashbox, entryId: split.entryIds[0], entryIds: split.entryIds });
  }

  // `after` — javob KASSIRGA YUBORILGANDAN KEYIN ishlaydi, ya'ni Google
  // va Telegram sekin javob bersa ham kassa oynasi kutib turmaydi.
  const out = await applyCashboxAdjust(db, input, { defer: after });
  if (!out.ok) {
    return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  }
  // `entryId` — yangi jurnal yozuvi (19.10.2026): yangi versiya oynasi saqlangach
  // «Chekni ko'rish» tugmasi shu yozuvni ochadi. Eski mijozlar e'tibor bermaydi.
  return NextResponse.json({ ok: true, cashbox: out.cashbox, entryId: out.entryId });
}
