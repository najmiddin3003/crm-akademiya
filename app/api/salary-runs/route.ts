import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SalaryRun, SalaryRunItem } from "@/lib/salary";
import { payrollEarned, payrollDue, payrollMonthKey, payrollPeriod } from "@/lib/salary";
import { buildPayrollRows } from "@/lib/payrollSources";

// Moliya → Oylik chiqarish backend'i (MongoDB `salary_runs`).
//
// Demo seed OLIB TASHLANDI: SALARY_RUN_SEED o'ylab topilgan oylik hisoboti
// edi va u haqiqiy yozuvlar bilan yonma-yon, ajratib bo'lmaydigan holda
// turardi. Bo'sh ro'yxat — haqiqat, soxta tarix emas.

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("salary_runs");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const runs = rows.map(({ _id, ...rest }) => rest as unknown as SalaryRun);
  return NextResponse.json({ ok: true, runs });
}

// POST — "Oylik chiqarish": tanlangan xodimlar bo'yicha bitta hisobot
// yozuvi yaratiladi. Hamma had HAQIQIY manbadan (lib/payrollSources.ts):
// oklad xodim kartasidan, bonus/jarima o'z kolleksiyalaridan, avans/oylik
// esa kassadan chiqarilgan yozuvlardan.
//
// DAVOMAT va AKLADI 0 bo'lib qoladi — tizimda ular uchun manba yo'q va
// o'ylab topilmaydi.
export async function POST(req: Request) {
  let body: { employeeIds?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.map(Number).filter(Number.isFinite) : [];
  if (employeeIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Kamida bitta xodimni tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // Hamma qiymat bitta haqiqiy manbadan (lib/payrollSources.ts) — shu
  // bois Oylik chiqarish, Xodimlar ro'yxati va xodim profili bir xil
  // raqam ko'rsatadi.
  const all = await buildPayrollRows(db);
  const chosen = all.filter((e) => employeeIds.includes(e.id));
  if (chosen.length === 0) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  // Oyligi sozlanmagan xodimni hisobga qo'shib bo'lmaydi — uning
  // "hisoblangan"i 0 bo'lardi va bu haqiqat emas, sozlama yo'qligi.
  const unconfigured = chosen.filter((e) => !e.configured);
  if (unconfigured.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Oyligi sozlanmagan xodim(lar): ${unconfigured.map((e) => e.name).join(", ")}`,
        unconfigured: unconfigured.map((e) => e.id),
      },
      { status: 400 },
    );
  }

  const period = payrollPeriod();
  let oylik = 0;
  let bonus = 0;
  let jarima = 0;
  let avans = 0;
  let akladi = 0;
  let tolanmagan = 0;
  let qarzdorlik = 0;
  const items: SalaryRunItem[] = [];
  for (const ep of chosen) {
    const empDue = payrollDue(ep, period);
    oylik += payrollEarned(ep, period);
    bonus += ep.bonus;
    jarima += ep.jarima;
    avans += ep.paidAvans;
    akladi += ep.paidOylik;
    tolanmagan += Math.max(empDue, 0);
    // Manfiy qoldiq — xodim hisoblanganidan ko'proq olgan (avans bergan,
    // keyin uni qoplagan to'lov bekor qilingan). Ilgari u shu yerda
    // `Math.max(…, 0)` bilan nolga tenglashtirilardi va qarz IZSIZ
    // yo'qolardi — keyingi oy hisobiga ham o'tmasdi. Endi ishorali holicha
    // saqlanadi: loadCarryOver uni keyingi oyning `carryOver`iga o'tkazadi.
    qarzdorlik += Math.max(-empDue, 0);
    items.push({ employeeId: ep.id, name: ep.name, amount: empDue });
  }

  const col = db.collection("salary_runs");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const run: SalaryRun = {
    id: nextId,
    employeeCount: chosen.length,
    oylik,
    davomat: 0,
    davomatFoizi: 0,
    bonus,
    avans,
    jarima,
    akladi,
    tolanmagan,
    qarzdorlik,
    createdAt: fmtNow(new Date()),
    month: payrollMonthKey(period),
    items,
  };
  await col.insertOne({ ...run });
  return NextResponse.json({ ok: true, run });
}
