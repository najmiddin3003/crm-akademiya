import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import type { HrEmployee } from "@/lib/hrEmployees";
import { isActiveTeacher, teacherFromEmployee, type Teacher } from "@/lib/teachersData";

// GET /api/teachers — faol o'qituvchilar ro'yxati (MongoDB `hr_employees`,
// `turi: "teacher"`, arxivlanmaganlar). Buyurtma formalari, hisobot
// filtrlari va o'qituvchi tanlanadigan boshqa joylar shundan o'qiydi.
//
// FILIAL BO'YICHA KESILADI (qaror 2026-09-07). Boshqaruv > Xodimlar sahifasi
// ALLAQACHON kesilgan edi (`scopedEmployeeFilter`), bu route esa yo'q — ya'ni
// ro'yxatda ko'rinmaydigan o'qituvchi guruh formasidagi tanlovda turaverardi
// va uni guruhga biriktirib qo'yish mumkin edi.
//
// `branchIds` — MASSIV (xodim bir necha filialda ishlashi mumkin), shuning
// uchun `withBranch` EMAS, `scopedEmployeeFilter` (lib/employeeBranches.ts).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db.collection("hr_employees")
    .find(scopedEmployeeFilter({ turi: "teacher" }, scope))
    .sort({ name: 1 })
    .toArray();
  const teachers: Teacher[] = rows
    .map(({ _id, ...rest }) => rest as unknown as HrEmployee)
    .filter(isActiveTeacher)
    .map(teacherFromEmployee);
  return NextResponse.json({ ok: true, teachers });
}
