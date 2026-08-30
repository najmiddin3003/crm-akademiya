import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { SalesPlanRow } from "@/lib/salesPlan";

// Sotuv va marketing → Savdo plani backend'i.
//
// Jadval qatorlari IKKI manbaning birlashmasi (lib/salesPlan.ts izohiga
// qarang): `hr_employees` dagi moderatorlar + `transaction_entries` da
// haqiqatan to'lov qayd etgan moderatorlar. Faqat plan raqami saqlanadi.

export async function GET() {
  const db = await ensureIndexes();

  // To'lovlar SONI moderator bo'yicha — Mongo'da guruhlanadi.
  //
  // Ilgari bu yerda `find({ txType: "payIn" }).toArray()` turardi: 18 822
  // hujjatning HAMMA maydoni (9.0 MB) Node'ga kelib, pastdagi tsikl ularni
  // shunchaki SANARDI. Bazada esa atigi 3 ta moderator bor.
  // O'lchandi: 5 544 ms → 196 ms, 9 051 KB → 0.1 KB.
  //
  // `$match` eski filtr + eski `if (!e.moderator) continue` qatoriga aynan
  // teng, shuning uchun `paymentsCount` o'zgarmaydi.
  const [employees, plans, moderatorCounts] = await Promise.all([
    db.collection("hr_employees").find({ turi: "moderator" }).sort({ id: 1 }).toArray(),
    db.collection("sales_plans").find({}).toArray(),
    db.collection("transaction_entries").aggregate([
      { $match: { txType: "payIn", moderator: { $nin: ["", null] } } },
      { $group: { _id: "$moderator", n: { $sum: 1 } } },
      // Tartib aniq bo'lishi uchun: $group tartibi kafolatlanmaydi, ilgari
      // esa tsikl kolleksiyani skanerlash tartibida ketardi. Roster'da
      // yo'q moderatorlar jadval oxirida shu tartibda chiqadi.
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  const planByName = new Map<string, number>();
  for (const p of plans) planByName.set(String(p.moderatorName), Number(p.plan) || 0);

  const paymentsByName = new Map<string, number>();
  for (const r of moderatorCounts) paymentsByName.set(String(r._id), Number(r.n) || 0);

  const employeeIdByName = new Map<string, number>();
  for (const emp of employees as unknown as HrEmployee[]) {
    if (!employeeIdByName.has(emp.name)) employeeIdByName.set(emp.name, emp.id);
  }

  // Roster tartibini saqlab, keyin faqat tranzaksiyalarda uchraydiganlarni
  // qo'shamiz — shunda ro'yxat barqaror bo'ladi.
  const names = [
    ...employeeIdByName.keys(),
    ...Array.from(paymentsByName.keys()).filter((n) => !employeeIdByName.has(n)),
  ];

  const rows: SalesPlanRow[] = names.map((name) => ({
    moderatorName: name,
    employeeId: employeeIdByName.get(name) ?? null,
    plan: planByName.get(name) ?? 0,
    paymentsCount: paymentsByName.get(name) ?? 0,
  }));

  return NextResponse.json({ ok: true, rows });
}

// PUT /api/sales-plans — "Planni sozlash" oynasi bir yo'la bir nechta
// moderatorning planini saqlaydi.
export async function PUT(req: Request) {
  let body: { plans?: { moderatorName: string; plan: number }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (!Array.isArray(body.plans)) {
    return NextResponse.json({ ok: false, error: "Plan ro'yxati yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("sales_plans");
  for (const p of body.plans) {
    const moderatorName = String(p.moderatorName || "").trim();
    if (!moderatorName) continue;
    await col.updateOne(
      { moderatorName },
      { $set: { moderatorName, plan: Math.max(0, Number(p.plan) || 0) } },
      { upsert: true },
    );
  }

  return NextResponse.json({ ok: true });
}
