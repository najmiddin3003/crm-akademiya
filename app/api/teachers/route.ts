import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import { isActiveTeacher, teacherFromEmployee, type Teacher } from "@/lib/teachersData";

// GET /api/teachers — faol o'qituvchilar ro'yxati (MongoDB `hr_employees`,
// `turi: "teacher"`, arxivlanmaganlar). Buyurtma formalari, hisobot
// filtrlari va o'qituvchi tanlanadigan boshqa joylar shundan o'qiydi.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("hr_employees").find({ turi: "teacher" }).sort({ name: 1 }).toArray();
  const teachers: Teacher[] = rows
    .map(({ _id, ...rest }) => rest as unknown as HrEmployee)
    .filter(isActiveTeacher)
    .map(teacherFromEmployee);
  return NextResponse.json({ ok: true, teachers });
}
