import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeDebtors } from "@/lib/debtors";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/debtors?to=YYYY-MM-DD&month=YYYY-MM — qarzdor o'quvchilar
// hisoboti (Hisobotlar → Qarzdor o'quvchilar, /reports-unpaid).
//
// Butun hisob lib/debtors.ts da (qoida va manbalar o'sha yerda yozilgan);
// bu route faqat parametrlarni o'qiydi va filial qamrovini beradi.
//
// `to` — HISOB SANASI: shu kungacha (kun ham kiradi) guruh jadvali bo'yicha
// o'tgan darslar va shu kungacha qilingan to'lovlar olinadi. Berilmasa —
// bugun (Toshkent). Kelajak sanasi rad etilmaydi — jadval bo'yicha o'sha
// kungacha bo'ladigan darslar sanaladi (reja).
//
// `month` — ixtiyoriy OY: berilsa javobda `month` jamlanmasi ham keladi —
// shu oyda o'quvchilardan jami qancha kutilyapti (oyning hamma dars
// kunlari), qanchasi tushdi, qanchasi qoldi.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("to") || "";
  if (raw && !ISO_DATE.test(raw)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }
  const month = sp.get("month") || "";
  if (month && !ISO_MONTH.test(month)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri oy (YYYY-MM kutilgan)" }, { status: 400 });
  }
  const asOf = raw || uzDateIso();

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const report = await computeDebtors(db, scope, asOf, month || undefined);
  return NextResponse.json({ ok: true, ...report });
}
