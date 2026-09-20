import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeDebtors } from "@/lib/debtors";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/debtors?to=YYYY-MM-DD — qarzdor o'quvchilar hisoboti
// (Hisobotlar → Qarzdor o'quvchilar, /reports-unpaid).
//
// Butun hisob lib/debtors.ts da (qoida va manbalar o'sha yerda yozilgan);
// bu route faqat hisob sanasini o'qiydi va filial qamrovini beradi.
//
// `to` — HISOB SANASI: shu kungacha (kun ham kiradi) qo'yilgan davomat va
// shu kungacha qilingan to'lovlar olinadi. Berilmasa — bugun (Toshkent).
// Kelajak sanasi rad etilmaydi: u shunchaki bugungi bilan bir xil natija
// beradi (kelajakka davomat qo'yilmaydi).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("to") || "";
  if (raw && !ISO_DATE.test(raw)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }
  const asOf = raw || uzDateIso();

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const report = await computeDebtors(db, scope, asOf);
  return NextResponse.json({ ok: true, ...report });
}
