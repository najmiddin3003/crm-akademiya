import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentEmployee, nameEq } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";
import { loadCashboxMonth } from "@/lib/reportCashboxMonth";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// GET /api/reports/cashbox-month?month=YYYY-MM — Hisobotlar → «Kirim va chiqim» →
// Kassalar tabi (26-qism): har kassa va to'lov turi bo'yicha oy boshidagi qoldiq,
// kirim, chiqim, ko'chirish va oy oxiridagi (joriy oyda — hozirgi) qoldiq. Hisob
// qoidasi — lib/reportCashboxMonth.ts.
//
// RUXSAT: hisobotning bo'limi — «Kirim chiqim» (/finance-cashflow, lib/reportsCatalog.ts).
// QAMROV — Moliya → Kassalar bilan bir xil (app/api/cashboxes/route.ts): admin hamma
// kassani, xodim faqat O'ZIGA biriktirilganini ko'radi. Kassa qoldig'i — shaxsiy
// javobgarlik; hisobot uni bo'lim ruxsati bilan kengaytirmaydi. Filial tanlovi mijozda
// (kassaning `branchId` si javobda bor).

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!isPathAllowed("/finance-cashflow", me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu hisobot sizga ochilmagan" }, { status: 403 });
  }

  const today = uzDateIso();
  const month = new URL(req.url).searchParams.get("month") || today.slice(0, 7);
  if (!ISO_MONTH.test(month)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri oy (YYYY-MM kutilgan)" }, { status: 400 });
  }
  if (month > today.slice(0, 7)) {
    return NextResponse.json({ ok: false, error: "Kelajak oyi tanlanmaydi" }, { status: 400 });
  }

  const emp = await getCurrentEmployee();
  if (!emp) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const now = { date: today, time: uzTimeHm() };
  // Kassaga biriktirilmagan xodim — bo'sh ro'yxat (Kassalar sahifasidagidek).
  if (!emp.isAdmin && !emp.name) {
    return NextResponse.json({ ok: true, month, from: `${month}-01`, to: today, current: month === today.slice(0, 7), asOf: now, methods: [], cashboxes: [] });
  }
  const filter = emp.isAdmin ? {} : { moderator: nameEq(emp.name!) };
  const report = await loadCashboxMonth(db, month, today, now, filter);
  return NextResponse.json({ ok: true, ...report });
}
