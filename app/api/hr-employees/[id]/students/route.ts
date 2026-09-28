import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import { loadTeacherRoster } from "@/lib/teacherRoster";

// GET /api/hr-employees/:id/students — shu o'qituvchining guruhlari va
// ulardagi o'quvchilari.
//
// Zanjir va qoidalar — lib/teacherRoster.ts (xodimlar botining «Profilim»
// Mini App'i ham shuni ishlatadi).
//
// DIQQAT: guruhlarga hali o'qituvchi biriktirilmagan bo'lsa (`teacher: ""`)
// bu bo'sh ro'yxat qaytaradi — bu xato emas. Xodim profilidagi to'lovlar
// ro'yxati bunga bog'liq emas, u `transaction_entries.moderator` orqali
// ishlaydi; bu endpoint "Guruh" ustuni va filtrlarni to'ldirish uchun.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  // FILIAL QAMROVI UCHALA BO'G'INDA: xodim ham, guruhlar ham, o'quvchilar
  // ham joriy filialdan. Ilgari bu route umuman kesilmagan edi — xodim
  // ro'yxati (/api/hr-employees) kesilgan bo'lsa ham, bu yerdan istalgan
  // xodimning id'si bilan uning guruhlari va O'QUVCHILARI olinardi.
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne(scopedEmployeeFilter({ id: empId }, scope));
  if (!emp) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...(await loadTeacherRoster(db, String(emp.name ?? ""), scope)) });
}
