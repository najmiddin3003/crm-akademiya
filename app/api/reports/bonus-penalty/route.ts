import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { expandBranchPools } from "@/lib/branchPools";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";
import {
  buildBonusPenalty,
  type RawBonus,
  type RawEmployee,
  type RawFine,
  type RawPenalty,
  type RawPendingTask,
} from "@/lib/reportBonusPenalty";
import { uzMonthOf } from "@/lib/staffTasks";
import { FINES_COL, TASKS_COL, loadSettings, runAutomation } from "@/lib/staffTasksServer";

// GET /api/reports/bonus-penalty?month=YYYY-MM — Hisobotlar → «Bonus va jarimalar»
// (26-qism). Hisob — lib/reportBonusPenalty.ts (manbalar o'sha yerda yozilgan).
//
// RUXSAT shu yerda: route sahifa ruxsatlari jadvalida yo'q (sessiya yetarli), hisobot esa
// «Moliya → Bonus» YOKI «Moliya → Jarima» ruxsati bilan ochiladi (lib/reportsCatalog.ts).
// Har manba o'z ruxsati bilan kesiladi — faqat Bonus ruxsati bor xodim jarimalarni ko'rmaydi
// (va aksincha), yopiq manba umuman so'ralmaydi.
//
// FILIAL: xodim oyligi qaysi filialdan chiqsa (`payrollBranchId`) — o'sha. Admin — hammasi;
// boshqalar — o'z filiallari (1+2 hovuzi birga). Filiali noma'lum yozuv faqat adminga.

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const can = {
    bonus: isPathAllowed("/finance-bonus", me.permissions),
    penalty: isPathAllowed("/finance-penalty", me.permissions),
  };
  if (!can.bonus && !can.penalty) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }

  const currentMonth = uzMonthOf(Date.now());
  const month = new URL(req.url).searchParams.get("month") || currentMonth;
  if (!ISO_MONTH.test(month)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri oy (YYYY-MM kutilgan)" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  // Topshiriq holatlari «dangasa» o'tadi (lib/staffTasksServer.ts → runAutomation) —
  // Jarimalar tabi kabi, o'qishdan oldin: muddati o'tgani «kutilmoqda»ga, qayta muddati
  // o'tgani jarimaga.
  if (can.penalty) await runAutomation(db);

  const none = Promise.resolve([] as never[]);
  const [settings, bonuses, penalties, fines, pending, employees, roles, groups, branches] = await Promise.all([
    loadSettings(db),
    can.bonus ? db.collection("bonuses").find({ type: "employee" }, { projection: { _id: 0 } }).toArray() : none,
    can.penalty ? db.collection("penalties").find({ type: "employee" }, { projection: { _id: 0, image: 0 } }).toArray() : none,
    can.penalty ? db.collection(FINES_COL).find({ month }, { projection: { _id: 0 } }).toArray() : none,
    can.penalty
      ? db
        .collection(TASKS_COL)
        .find(
          { status: "muddati_otdi", fineAmount: { $gt: 0 } },
          { projection: { _id: 0, id: 1, title: 1, employeeId: 1, employeeName: 1, branchId: 1, priority: 1, fineAmount: 1, redeadline: 1 } },
        )
        .toArray()
      : none,
    db
      .collection("hr_employees")
      .find({}, { projection: { _id: 0, id: 1, name: 1, turi: 1, centerRoleId: 1, branchIds: 1, payrollBranchId: 1, workStart: 1, workEnd: 1, kurs: 1, archReason: 1 } })
      .toArray(),
    db.collection("roles").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    db.collection("groups").find({ status: "active" }, { projection: { _id: 0, teacher: 1, status: 1 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
  ]);

  const report = buildBonusPenalty({
    month,
    currentMonth,
    limitPercent: settings.limitPercent,
    can,
    bonuses: bonuses as unknown as RawBonus[],
    penalties: penalties as unknown as RawPenalty[],
    fines: fines as unknown as RawFine[],
    pending: pending as unknown as RawPendingTask[],
    employees: employees as unknown as RawEmployee[],
    roles: roles as unknown as { id: number; name: string }[],
    groups: groups as { teacher?: string; status?: string }[],
    branches: branches as unknown as { id: number; name: string }[],
    allowed: scope.isAdmin ? null : expandBranchPools(scope.allowed),
  });

  return NextResponse.json({ ok: true, ...report });
}
