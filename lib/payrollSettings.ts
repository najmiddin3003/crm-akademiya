import type { Db } from "mongodb";
import { buildPayrollRows } from "@/lib/payrollSources";
import {
  payrollEarned,
  payrollFoizPart,
  payrollHasOklad,
  payrollMonthKey,
  payrollOkladDays,
  payrollOkladPart,
  payrollPeriod,
  payrollTax,
  payrollTaxLines,
  type EmployeePayroll,
} from "@/lib/salary";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { parseMoney } from "@/lib/taxes";

// SOZLAMALAR → MOLIYA → «OYLIK VA SOLIQ» (39-qism, rasm «Sozlamalar · Oylik va soliq»).
//
// Sahifa HISOBLAMAYDI va hech narsa o'zgartirmaydi — Oylik chiqarish ishlatadigan o'sha hisobni
// (lib/payrollSources.ts → buildPayrollRows, lib/salary.ts formulalari) sozlamalar ko'rinishida beradi:
//   • oylik turlari — foiz / oklad / oklad + foiz bo'yicha xodimlar soni;
//   • xodimlar jadvali — turi, stavkasi va shu oyda hozirgacha hisoblangani;
//   • soliqlar — Sozlamalar → Moliya → Soliq ro'yxati (`settings_taxes`), qaysi xodimga biriktirilgani;
//   • foiz darajalari — `settings_monthly_percents` (xodim kartasidagi «Oladigan foizi»);
//   • misol — bitta xodimning shu oydagi hisobi qadam-baqadam.
// Qiymatlarni tahrirlash mavjud joyida: xodim kartasi (oklad/foiz/soliq) va eski Soliq/Oylik foizlari tablari.

export type PayrollKind = "foiz" | "fixed" | "mixed";

export interface PayrollSettingsRow {
  id: number;
  name: string;
  turi: string;
  configured: boolean;
  kind: PayrollKind;
  percent: number;
  fixedSalary: number;
  earned: number;
  taxable: boolean;
}

export interface PayrollExample {
  name: string;
  turi: string;
  kind: PayrollKind;
  fixedSalary: number;
  okladDays: number;
  daysIn: number;
  okladPart: number;
  percent: number;
  collected: number;
  foizPart: number;
  bonus: number;
  jarima: number;
  earned: number;
  taxLines: { name: string; detail: string; amount: number }[];
  tax: number;
  net: number;
}

function exampleOf(e: EmployeePayroll, p: ReturnType<typeof payrollPeriod>): PayrollExample {
  const earned = payrollEarned(e, p);
  const tax = payrollTax(e, p);
  return {
    name: e.name,
    turi: e.turi,
    kind: e.salaryType,
    fixedSalary: e.fixedSalary,
    okladDays: payrollHasOklad(e) ? payrollOkladDays(e, p) : 0,
    daysIn: p.daysIn,
    okladPart: payrollOkladPart(e, p),
    percent: e.percent,
    collected: e.collected,
    foizPart: payrollFoizPart(e),
    bonus: e.bonus,
    jarima: e.jarima,
    earned,
    taxLines: payrollTaxLines(e, p),
    tax,
    net: earned - tax,
  };
}

export async function payrollSettingsPage(db: Db, building: number, exampleId?: number) {
  const p = payrollPeriod();
  const [rows, tiers, taxes, taxAssigned] = await Promise.all([
    buildPayrollRows(db, p, { payrollBranchId: building }),
    db.collection(SETTINGS_LIST_KINDS["monthly-percents"]).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection(SETTINGS_LIST_KINDS.taxes).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db
      .collection("hr_employees")
      .aggregate<{ _id: number; n: number }>([{ $match: { archived: { $ne: true } } }, { $unwind: "$taxIds" }, { $group: { _id: "$taxIds", n: { $sum: 1 } } }])
      .toArray(),
  ]);
  const active = rows.filter((e) => !e.archived);
  const configured = active.filter((e) => e.configured);
  const pickExample = () => {
    if (exampleId) return configured.find((e) => e.id === exampleId);
    return configured.find((e) => e.salaryType === "mixed") ?? configured.find((e) => e.salaryType === "foiz" && e.collected > 0) ?? configured[0];
  };
  const ex = pickExample();
  const assigned = new Map(taxAssigned.map((t) => [Number(t._id), t.n]));
  const tierCount = new Map<string, number>();
  for (const e of configured) if (e.salaryType !== "fixed") tierCount.set(String(e.percent), (tierCount.get(String(e.percent)) ?? 0) + 1);
  return {
    ok: true as const,
    month: payrollMonthKey(p),
    day: p.day,
    daysIn: p.daysIn,
    rows: active
      .map(
        (e): PayrollSettingsRow => ({
          id: e.id,
          name: e.name,
          turi: e.turi,
          configured: e.configured,
          kind: e.salaryType,
          percent: e.percent,
          fixedSalary: e.fixedSalary,
          earned: e.configured ? payrollEarned(e, p) : 0,
          taxable: e.taxable,
        }),
      )
      .sort((a, b) => Number(b.configured) - Number(a.configured) || b.earned - a.earned),
    tiers: tiers.map((t) => {
      const pct = parseMoney(t.percent);
      return { id: Number(t.id), name: String(t.name ?? ""), percent: pct, staff: tierCount.get(String(pct)) ?? 0 };
    }),
    taxes: taxes.map((t) => {
      const type = /aniq|summa/i.test(String(t.taxType ?? "")) ? ("amount" as const) : ("percent" as const);
      return {
        id: Number(t.id),
        name: String(t.name ?? ""),
        type,
        value: parseMoney(type === "amount" ? t.amount : t.percent),
        active: t.active !== false,
        staff: assigned.get(Number(t.id)) ?? 0,
      };
    }),
    example: ex ? exampleOf(ex, p) : null,
    exampleId: ex?.id ?? null,
  };
}
