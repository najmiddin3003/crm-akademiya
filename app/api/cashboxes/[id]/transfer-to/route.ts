import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { applyCashboxTransferTo } from "@/lib/cashboxTransfer";

// POST /api/cashboxes/:id/transfer-to — pulni bitta kassadan BOSHQA kassaga
// ko'chiradi (referens saytdagi Kassalar → asosiy kartochka "Ko'chirish"
// tugmasi, "Moliya bo'limi" maydoni). Bitta kassa ichida to'lov turlari
// orasidagi Ko'chirishdan (transfer/route.ts) farqi shu: pul BOSHQA
// EGAGA o'tadi. "Tranzaksiyalar" jurnaliga har ikkala kassa uchun alohida
// qator yoziladi; daromad/xarajat hisobotiga tegmaydi (bu ham Ko'chirish,
// umumiy pulni o'zgartirmaydi).
//
// TASDIQLASH TALAB QILINADI — pul TASDIQGACHA JO'NATUVCHIDA TURADI:
// jo'natishda hech kimning balansi o'zgarmaydi, faqat ikkita `waiting`
// qator yoziladi; ✓ jo'natuvchidan yechib qabul qiluvchiga qo'shadi, × da
// hech narsa ko'chmaydi. Tarixi va tafsilotlari — lib/cashboxTransfer.ts
// (yadro) va lib/transferDecision.ts (✓/×). Bu route faqat HTTP qobig'i:
// xodimlar Telegram boti ham o'sha yadroni chaqiradi (lib/staffBot).
//
// Tasdiqlash/rad etish: app/api/transaction-entries/[id]/transfer-confirm
// va .../transfer-reject.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fromId = Number(id);
  if (!Number.isFinite(fromId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { toCashboxId?: number; method?: string; amount?: number; date?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const out = await applyCashboxTransferTo(
    db,
    {
      fromId,
      toCashboxId: Number(body.toCashboxId),
      method: String(body.method ?? ""),
      amount: Number(body.amount),
      date: body.date,
      note: body.note,
    },
    // Javob ketgandan keyin navbatni bo'shatamiz — qator Google Sheets'ga
    // kunlik cron'ni kutmasdan tushadi; qabul qiluvchiga bot xabari ham
    // shu yerda ketadi (lib/staffBot/notify.ts).
    { defer: after },
  );
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });

  // IKKALA KASSA HAM O'ZGARMAGAN holida qaytariladi — hech kimning
  // balansiga tegilmadi; jo'natuvchida `pendingOut` yangilangan (yadro izohi).
  return NextResponse.json({ ok: true, from: out.from, to: out.to });
}
