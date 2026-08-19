import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { demoAvans, demoAkladi, demoCollected, demoPercent, demoCarryOver } from "@/constants/salary";
import { prevMonthName, payrollPeriod } from "@/lib/salary";
import type { EmployeePayroll } from "@/lib/salary";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";

// GET /api/salary-runs/employees-payroll — Oylik chiqarish → xodim tanlash
// jadvali uchun har bir xodimning joriy hisoblangan qatori (skrinshot 3).
// BONUS/JARIMA — real (Moliya → Bonus/Jarima'dagi bekor qilinmagan
// yozuvlar yig'indisi); PAIDAVANS/PAIDOYLIK — demo (xodim id'sidan
// deterministik, loyihada hali alohida real "avans" kuzatuvi yo'q).
export async function GET() {
  const db = await ensureIndexes();
  const [employeeRows, bonusRows, penaltyRows] = await Promise.all([
    db.collection<HrEmployee>("hr_employees").find({}).sort({ id: 1 }).toArray(),
    db.collection<Bonus>("bonuses").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    db.collection<Penalty>("penalties").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
  ]);

  const p = payrollPeriod();
  const prevMonth = prevMonthName(p);

  const employees: EmployeePayroll[] = employeeRows.map((emp) => {
    const bonus = bonusRows.filter((b) => b.recipientName === emp.name).reduce((s, b) => s + b.amount, 0);
    const jarima = penaltyRows.filter((p) => p.recipientName === emp.name).reduce((s, p) => s + p.amount, 0);
    const paidAvans = demoAvans(emp.id);
    const paidOylik = demoAkladi(emp.id);

    // Xodim kartasidagi filiallar bo'yicha ish haqi yig'indisi (fixed).
    const fixedSalary = (emp.branchAssignments ?? []).reduce((s: number, b: any) => s + (b.salary ?? 0), 0);
    const salaryType: "fixed" | "foiz" = fixedSalary > 0 ? "fixed" : "foiz";
    const percent = emp.percent ? Number(String(emp.percent).replace(/[^\d.]/g, "")) || demoPercent(emp.id) : demoPercent(emp.id);
    const collected = salaryType === "foiz" ? demoCollected(emp.id) : 0;
    const carryOver = demoCarryOver(emp.id);

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      turi: emp.turi ?? "teacher",
      salaryType,
      fixedSalary,
      percent,
      collected,
      futureCollected: 0,
      bonus,
      jarima,
      paidAvans,
      paidOylik,
      carryOver,
      carryNote: carryOver > 0 ? `${prevMonth} oyidan qolgan` : "",
    };
  });

  return NextResponse.json({ ok: true, employees });
}
