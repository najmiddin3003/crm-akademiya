import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { fixedSalaryOf, type EmployeeBranchAssignment } from "@/lib/hrEmployees";
import {
  FINES_COL,
  fineInfo,
  fineScope,
  loadClosedMonths,
  loadSettings,
  loadViewer,
  runAutomation,
  type StaffFineDoc,
} from "@/lib/staffTasksServer";
import { uzMonthOf, type StaffFineSummaryRow, type StaffTaskFine } from "@/lib/staffTasks";

// GET /api/staff-tasks/fines — «Jarimalar» tabi.
//
// Ikki jadval uchun ma'lumot:
//   fines   — har bir jarima (qamrov: topshiriq qamrovi bilan bir xil);
//   summary — xodim × oy kesimida Oylikka tushadigan summa: oklad, limit,
//             ushlanadi / ushlanmaydi. "Ushlanadi" — Moliya → Jarima ga
//             HAQIQATAN yozilgan summa (`held`), ya'ni Oylik aynan shuni
//             ayiradi (lib/staffTasksServer.ts → syncFinePenalties).

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  await runAutomation(db);
  const v = await loadViewer(db, me);

  const [docs, closed, settings] = await Promise.all([
    db.collection<StaffFineDoc>(FINES_COL).find(fineScope(v), { projection: { _id: 0 } }).sort({ createdAt: -1, id: -1 }).toArray(),
    loadClosedMonths(db),
    loadSettings(db),
  ]);

  const fines: StaffTaskFine[] = docs.map((f) => ({
    ...(fineInfo(f, closed) as NonNullable<ReturnType<typeof fineInfo>>),
    taskId: f.taskId,
    taskTitle: f.taskTitle,
    employeeId: f.employeeId,
    employeeName: f.employeeName,
    branchId: f.branchId,
    priority: f.priority,
    deadline: f.deadline,
    redeadline: f.redeadline,
    failedAt: f.failedAt,
    createdAt: f.createdAt,
  }));

  // Oklad — oylik moduli bilan bir xil manbadan (filiallar bo'yicha ish haqi yig'indisi).
  const empIds = [...new Set(docs.map((f) => f.employeeId))];
  const emps = empIds.length
    ? await db.collection("hr_employees").find({ id: { $in: empIds } }, { projection: { _id: 0, id: 1, branchAssignments: 1 } }).toArray()
    : [];
  const okladBy = new Map(
    emps.map((e) => [Number(e.id), fixedSalaryOf(e as { branchAssignments?: EmployeeBranchAssignment[] })]),
  );

  const groups = new Map<string, StaffFineSummaryRow>();
  for (const f of docs) {
    if (f.status !== "kuchda") continue;
    const key = `${f.employeeId}|${f.month}`;
    let row = groups.get(key);
    if (!row) {
      const oklad = okladBy.get(f.employeeId) ?? 0;
      row = {
        employeeId: f.employeeId,
        employeeName: f.employeeName,
        month: f.month,
        oklad: oklad > 0 ? oklad : null,
        limit: oklad > 0 ? Math.round((oklad * settings.limitPercent) / 100) : null,
        total: 0,
        held: 0,
        closed: closed(f.employeeId, f.month),
      };
      groups.set(key, row);
    }
    row.total += f.amount;
    row.held += Number(f.held) || 0;
  }
  const summary = [...groups.values()].sort((a, b) => (a.month === b.month ? a.employeeName.localeCompare(b.employeeName) : a.month < b.month ? 1 : -1));

  const months = [...new Set([...docs.map((f) => f.month), uzMonthOf(Date.now())])].sort().reverse();

  return NextResponse.json({
    ok: true,
    fines,
    summary,
    months,
    limitPercent: settings.limitPercent,
    canCancel: v.role === "direktor",
  });
}
