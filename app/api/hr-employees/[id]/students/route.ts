import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
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

  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne({ id: empId });
  if (!emp) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  const teacher = String(emp.name ?? "").trim();
  if (!teacher) {
    return NextResponse.json({ ok: true, teacher: "", groups: [], students: [] });
  }

  const groupRows = await db
    .collection<Group>("groups")
    .find({ teacher: { $regex: `^${teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } })
    .toArray();

  const pupilIds = [...new Set(groupRows.flatMap((g) => g.studentIds ?? []))];
  const pupilRows = pupilIds.length
    ? await db.collection("pupils").find({ id: { $in: pupilIds } }).toArray()
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
