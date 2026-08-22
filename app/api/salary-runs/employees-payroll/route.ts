import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { buildPayrollRows } from "@/lib/payrollSources";

// GET /api/salary-runs/employees-payroll — Oylik chiqarish → xodim tanlash
// jadvali uchun har bir xodimning joriy hisoblangan qatori.
//
// Hamma qiymat HAQIQIY manbadan (lib/payrollSources.ts):
//   bonus/jarima ← bonuses, penalties
//   paidAvans/paidOylik ← transaction_entries (shu oydagi chiqimlar)
//   fixedSalary ← xodim kartasidagi filiallar bo'yicha ish haqi
//   percent ← Sozlamalar > Moliya > Oylik foizlari (daraja nomi orqali)
//   carryOver ← o'tgan oy yopilgan salary_runs yozuvi
//
// `configured: false` bo'lgan xodimning raqamlari ma'nosiz — interfeys
// ularni "Oylik sozlanmagan" deb ko'rsatishi kerak.
export async function GET() {
  const db = await ensureIndexes();
  const employees = await buildPayrollRows(db);
  return NextResponse.json({ ok: true, employees });
}
