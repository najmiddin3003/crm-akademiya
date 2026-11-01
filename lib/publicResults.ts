import type { Db } from "mongodb";
import { groupLabel, type Group } from "@/lib/groups";
import { publicExamOf, type GroupExam, type PublicGroupResults } from "@/lib/imtihon";

// OCHIQ NATIJALAR — BITTA GURUH (01.11.2026, foydalanuvchi: «har bir guruh uchun alohida url
// link yaratsin ... har bir guruh alohida chiqsin va table ko'rinishida tartibli chiqsin»).
// /natijalar/<kalit> sahifasining ma'lumoti: sahifa (app/natijalar/[kalit]/page.tsx) kalit
// imzosini tekshirgach (lib/groupResultsLink.ts) SERVERDA chaqiradi — alohida ochiq API yo'q.
// Avvalgi «butun filial + oy» sahifasi (/natijalar?filial=…) shu bilan almashdi.
//
// Faqat O'QIYDI va faqat SHU GURUHNING Sarhisob (`group_exams`) natijalarini: fan, ustoz,
// guruh, sana, savollar soni, o'quvchi ismi va natijasi. TELEFON SHU YERDA YASHIRILADI —
// faqat oxirgi 4 raqam (lib/imtihon.ts → maskPhoneTail); o'quvchi id'si va kim kiritgani
// brauzerga umuman yetib bormaydi. ARXIVDAGI sarhisob (GroupExam.archived) ko'rinmaydi.
// Barcha oylar birdan yuklanadi (guruhda oyiga bitta sarhisob) — oy sahifaning o'zida tanlanadi.

export async function loadGroupResults(db: Db, groupId: number): Promise<PublicGroupResults | null> {
  const rows = await db
    .collection("group_exams")
    .find<GroupExam>(
      { groupId, archived: { $ne: true } },
      { projection: { _id: 0, createdBy: 0, createdAt: 0, updatedBy: 0, updatedAt: 0 } },
    )
    .toArray();
  // publicExamOf: `month` 21.09.2026 gacha yozilganlarda sanadan; yangisi birinchi.
  const exams = rows.map(publicExamOf).sort((a, b) => b.month.localeCompare(a.month) || b.date.localeCompare(a.date) || b.id - a.id);
  const head = exams[0];
  if (head) return { course: head.course, groupName: head.groupName, groupLabel: head.groupLabel, level: head.level, exams };

  // Natija hali kiritilmagan (yoki hammasi arxivda) — sarlavha guruhning o'zidan; guruh ham yo'q — null.
  const group = await db.collection<Group>("groups").findOne({ id: groupId }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1 } });
  if (!group) return null;
  return { course: group.course ?? "", groupName: group.name ?? "", groupLabel: groupLabel(group), level: group.level ?? "", exams: [] };
}
