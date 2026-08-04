import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { demoAvans, demoAkladi } from "@/constants/salary";
import type { EmployeePayroll } from "@/lib/salary";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";

// GET /api/salary-runs/employees-payroll — Oylik chiqarish → xodim tanlash
// jadvali uchun har bir xodimning joriy hisoblangan qatori (skrinshot 3).
// BONUS/JARIMA — real (Moliya → Bonus/Jarima'dagi bekor qilinmagan
// yozuvlar yig'indisi); AVANS/AKLADI — demo (xodim id'sidan deterministik,
// loyihada hali alohida real "avans" kuzatuvi yo'q); ISH HAQI = AKLADI -
// AVANS + BONUS - JARIMA (POST /api/salary-runs bilan bir xil formula).
export async function GET() {
  const db = await ensureIndexes();
  const [employeeRows, bonusRows, penaltyRows] = await Promise.all([
    db.collection<HrEmployee>("hr_employees").find({}).sort({ id: 1 }).toArray(),
    db.collection<Bonus>("bonuses").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    db.collection<Penalty>("penalties").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
  ]);

  const employees: EmployeePayroll[] = employeeRows.map((emp) => {
    const bonus = bonusRows.filter((b) => b.recipientName === emp.name).reduce((s, b) => s + b.amount, 0);
    const jarima = penaltyRows.filter((p) => p.recipientName === emp.name).reduce((s, p) => s + p.amount, 0);
    const avans = demoAvans(emp.id);
    const akladi = demoAkladi(emp.id);
    const ishHaqi = akladi - avans + bonus - jarima;
    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      ishHaqi,
      davomat: 0,
      davomatFoizi: 0,
      bonus,
      avans,
      jarima,
      akladi,
      tolanmagan: Math.max(ishHaqi, 0),
    };
  });

  return NextResponse.json({ ok: true, employees });
}
