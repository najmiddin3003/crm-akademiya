import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import type { Group } from "@/lib/groups";

export interface TeacherStudent {
  pupilId: number;
  name: string;
  groupId: number;
  groupName: string;
}

// GET /api/hr-employees/:id/students — shu o'qituvchining guruhlari va
// ulardagi o'quvchilari.
//
// Zanjir: hr_employees.name → groups.teacher (satr; sxemada teacherId yo'q)
// → groups.studentIds[] → pupils.id. Oxirgi bo'g'in — yagona haqiqiy raqamli
// bog'lanish (app/api/groups/[id]/students/route.ts dagi bilan bir xil).
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

  const teacher = String(emp.name ?? "").trim();
  if (!teacher) {
    return NextResponse.json({ ok: true, teacher: "", groups: [], students: [] });
  }

  const groupRows = await db
    .collection<Group>("groups")
    .find(withBranch(
      { teacher: { $regex: `^${teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      scope,
    ))
    .toArray();

  const pupilIds = [...new Set(groupRows.flatMap((g) => g.studentIds ?? []))];
  const pupilRows = pupilIds.length
    ? await db.collection("pupils").find(withBranch({ id: { $in: pupilIds } }, scope)).toArray()
    : [];
  const pupilById = new Map(pupilRows.map((p) => [p.id as number, p]));

  const students: TeacherStudent[] = [];
  for (const g of groupRows) {
    for (const pid of g.studentIds ?? []) {
      const p = pupilById.get(pid);
      if (!p) continue;
      students.push({
        pupilId: pid,
        name: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
        groupId: g.id,
        groupName: g.name || String(g.id),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    teacher,
    groups: groupRows.map((g) => ({ id: g.id, name: g.name || String(g.id) })),
    students,
  });
}
