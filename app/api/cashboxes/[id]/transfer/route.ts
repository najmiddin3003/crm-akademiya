import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { applyMethodTransfer } from "@/lib/cashboxTransfer";

// POST /api/cashboxes/:id/transfer — bitta kassa ichida to'lov turlari
// orasida pul ko'chiradi (masalan Naqd → Plastik). Umumiy balansga
// tegmaydi, faqat methodTotals'ni qayta taqsimlaydi. "Tranzaksiyalar"
// jurnaliga ikkita qator yoziladi: chiqadigan tur manfiy, tushadigani
// musbat miqdor bilan. Daromad/xarajat hisobotiga tegmaydi.
//
// BUTUN MANTIQ lib/cashboxTransfer.ts da — bu route faqat HTTP qobig'i
// (xodimlar Telegram boti ham o'sha yadroni chaqiradi, lib/staffBot).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { from?: string; to?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const out = await applyMethodTransfer(
    db,
    { cashboxId, from: String(body.from ?? ""), to: String(body.to ?? ""), amount: Number(body.amount) },
    // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
    // kunlik cron'ni kutmasdan tushadi (boshqa yozuv route'lari ham shunday).
    { defer: after },
  );
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, cashbox: out.cashbox });
}
