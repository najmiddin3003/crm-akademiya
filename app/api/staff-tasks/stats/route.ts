import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FINES_COL,
  TASKS_COL,
  fineScope,
  loadPickableEmployees,
  loadViewer,
  runAutomation,
  taskScope,
  type StaffFineDoc,
  type StaffTaskDoc,
} from "@/lib/staffTasksServer";
import { ACTIVE_STATUSES, type StaffTaskStatRow } from "@/lib/staffTasks";

// GET /api/staff-tasks/stats — «Statistika» tabi: xodim kesimida.
//
// O'z vaqtida % = o'z vaqtida yakunlangan ÷ (yakunlangan + bajarilmagan).
// Bekor qilingan topshiriqlar hisobga olinmaydi. Qamrov — topshiriqlar
// ro'yxati bilan AYNAN bir xil (taskScope), aks holda jadval bir son,
// ro'yxat boshqa son ko'rsatardi.

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  await runAutomation(db);
  const v = await loadViewer(db, me);

  const [tasks, fines, pickable] = await Promise.all([
    db
      .collection<StaffTaskDoc>(TASKS_COL)
      .find(taskScope(v), { projection: { _id: 0, employeeId: 1, employeeName: 1, branchId: 1, status: 1, completedLate: 1 } })
      .toArray(),
    db
      .collection<StaffFineDoc>(FINES_COL)
      .find({ $and: [fineScope(v), { status: "kuchda" }] }, { projection: { _id: 0, employeeId: 1, amount: 1 } })
      .toArray(),
    loadPickableEmployees(db, v),
  ]);

  const rows = new Map<number, StaffTaskStatRow>();
  const rowOf = (id: number, name: string, branchId: number) => {
    let r = rows.get(id);
    if (!r) {
      r = { employeeId: id, employeeName: name, branchId, total: 0, active: 0, onTime: 0, late: 0, failed: 0, pct: null, fineTotal: 0 };
      rows.set(id, r);
    }
    return r;
  };
  // Rahbar/direktor — topshirig'i yo'q xodim ham ro'yxatda (0 bilan);
  // xodim — faqat o'zi.
  for (const e of pickable) rowOf(e.id, e.name, e.branchId);
  for (const t of tasks) {
    if (v.role === "xodim" && t.employeeId !== v.employeeId) continue;
    const r = rowOf(t.employeeId, t.employeeName, t.branchId);
    if (t.status === "bekor") continue;
    r.total++;
    if (ACTIVE_STATUSES.includes(t.status) || t.status === "tasdiq_kutilmoqda") r.active++;
    if (t.status === "yakunlandi") {
      if (t.completedLate) r.late++;
      else r.onTime++;
    }
    if (t.status === "bajarilmadi") r.failed++;
  }
  for (const f of fines) {
    const r = rows.get(f.employeeId);
    if (r) r.fineTotal += Number(f.amount) || 0;
  }
  if (v.role === "xodim" && v.employeeId !== null && !rows.has(v.employeeId)) {
    rowOf(v.employeeId, v.name, 0);
  }
  for (const r of rows.values()) {
    const den = r.onTime + r.late + r.failed;
    r.pct = den ? Math.round((r.onTime / den) * 100) : null;
  }
  const out = [...rows.values()].sort((a, b) => b.total - a.total || a.employeeName.localeCompare(b.employeeName));
  return NextResponse.json({ ok: true, rows: out });
}
