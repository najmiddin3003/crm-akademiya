import type { Db } from "mongodb";
import { withBranch, withPupilBranch, type BranchScope } from "@/lib/branchScope";
import type { Group } from "@/lib/groups";

// O'qituvchining guruhlari va ulardagi o'quvchilari — xodim profilidagi
// "Guruh" ustuni, guruh filtri va "To'lanmagan to'lovlar" tabining manbasi.
//
// Zanjir: hr_employees.name → groups.teacher (satr; sxemada teacherId yo'q)
// → groups.studentIds[] → pupils.id. Oxirgi bo'g'in — yagona haqiqiy raqamli
// bog'lanish (app/api/groups/[id]/students/route.ts dagi bilan bir xil).
//
// Ikki chaqiruvchi (28.09.2026 da route'dan ajratildi):
//   • sayt — GET /api/hr-employees/:id/students, navbardagi filial bilan;
//   • xodimlar botining «Profilim» Mini App'i (app/api/xodim/data) —
//     `scope: null`: xodim O'Z guruhlarini hamma filialdan ko'radi (saytda
//     "barcha filiallar" rejimi yo'q, lekin o'z profilida bo'lishi kerak).

export interface TeacherStudent {
  pupilId: number;
  name: string;
  groupId: number;
  groupName: string;
}

export interface TeacherRoster {
  teacher: string;
  groups: { id: number; name: string }[];
  students: TeacherStudent[];
}

export async function loadTeacherRoster(db: Db, teacherName: string, scope: BranchScope | null): Promise<TeacherRoster> {
  const teacher = teacherName.trim();
  if (!teacher) return { teacher: "", groups: [], students: [] };

  const byTeacher = { teacher: { $regex: `^${teacher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } };
  const groupRows = await db
    .collection<Group>("groups")
    .find(scope ? withBranch(byTeacher, scope) : byTeacher)
    .toArray();

  const pupilIds = [...new Set(groupRows.flatMap((g) => g.studentIds ?? []))];
  const byIds = { id: { $in: pupilIds } };
  const pupilRows = pupilIds.length
    ? await db.collection("pupils").find(scope ? withPupilBranch(byIds, scope) : byIds).toArray()
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

  return {
    teacher,
    groups: groupRows.map((g) => ({ id: g.id, name: g.name || String(g.id) })),
    students,
  };
}
