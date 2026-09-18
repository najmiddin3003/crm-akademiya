import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import type { HrEmployee } from "@/lib/hrEmployees";
import { buildSalaryLedger } from "@/lib/salaryLedger";

// GET /api/hr-employees/:id/salary-ledger — xodimning OYLIK DAFTARI:
// oyligiga ta'sir qilgan har bir kassa yozuvi uchun ta'siri (foizli
// ulush / olingan avans) va shu yozuvdan oldingi-keyingi QOLDIQ.
//
// Xodim profili → "Tranzaksiyalar tarixi" jadvalining "Oyligiga ta'siri"
// va "Qoldiq oldin/keyin" ustunlari shundan to'ladi. Qoida — lib/salaryLedger.ts
// (lib/payrollSources.ts bilan bir xil manba), ya'ni oyning oxirgi
// qatoridagi qoldiq chap kartadagi "To'lanmagan" bilan bir xil raqam.
//
// Qamrov — profilning o'zi bilan bir xil (scopedEmployeeFilter): boshqa
// filial xodimi uchun 404, borligi ham oshkor bo'lmaydi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }
  const db = await ensureIndexes();
  const emp = await db.collection<HrEmployee>("hr_employees").findOne(scopedEmployeeFilter({ id: empId }, scope));
  if (!emp) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  const ledger = await buildSalaryLedger(db, emp);
  return NextResponse.json({ ok: true, ledger });
}
