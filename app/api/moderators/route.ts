import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import type { HrEmployee } from "@/lib/hrEmployees";
import { isActiveModerator, moderatorFromEmployee, type Moderator } from "@/lib/moderatorsData";

// GET /api/moderators — faol moderatorlar ro'yxati (MongoDB `hr_employees`,
// `turi: "moderator"`, arxivlanmaganlar). Moderator tanlanadigan joylar
// (kassa paneli, lid filtrlari) shundan o'qiydi — /api/teachers bilan bir
// xil qolip, filial qamrovi ham bir xil (o'sha yerdagi izohga qarang).
//
// DIQQAT: bu PUL ro'yxati EMAS. Kassadagi bonus/jarima/avans oynalari
// xodimni `/api/hr-employees/ref` dan oladi va u ATAYLAB kesilmaydi —
// to'lov istalgan xodimga qilinishi mumkin (lib/employeeBranches.ts va
// o'sha route'ning izohi).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db.collection("hr_employees")
    .find(scopedEmployeeFilter({ turi: "moderator" }, scope))
    .sort({ name: 1 })
    .toArray();
  const moderators: Moderator[] = rows
    .map(({ _id, ...rest }) => rest as unknown as HrEmployee)
    .filter(isActiveModerator)
    .map(moderatorFromEmployee);
  return NextResponse.json({ ok: true, moderators });
}
