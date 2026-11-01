import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { branchPool } from "@/lib/branchPools";
import { publicRankRows, rankPool, type PublicCenterRanking } from "@/lib/examRanking";
import { groupLabel, type Group } from "@/lib/groups";
import { groupExamMonth, publicExamOf, type GroupExam, type PublicGroupResults } from "@/lib/imtihon";

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

// OCHIQ MARKAZ REYTINGI (01.11.2026, foydalanuvchi: «markaz bo'yicha reytingni ulashish») —
// /natijalar/markaz/<kalit> sahifasining ma'lumoti. Qamrov CRM'dagi Sarhisob bilan bir xil:
// shu filial (hovuzda — butun hovuz, `branchCondition` qoidasi), arxivdagi sarhisoblarsiz.
// Faqat BITTA OY yuklanadi (filialda oyiga ~100 sarhisob); oylar ro'yxati — sana/oy maydonidan.
// Reyting qoidalari — lib/examRanking.ts (CRM bilan bitta); telefon va ustoz brauzerga bormaydi.

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function loadCenterRanking(db: Db, branchId: number, asked: string | null): Promise<PublicCenterRanking | null> {
  const branch = await db.collection("branches").findOne<{ name?: string }>({ id: branchId }, { projection: { _id: 0, name: 1 } });
  if (!branch) return null;
  const scope = { $and: [{ archived: { $ne: true } }, branchInCondition(branchPool(branchId))] };
  const col = db.collection("group_exams");

  const heads = await col.find<Pick<GroupExam, "date" | "month">>(scope, { projection: { _id: 0, date: 1, month: 1 } }).toArray();
  const months = [...new Set(heads.map(groupExamMonth))].filter((m) => MONTH_KEY.test(m)).sort().reverse();
  const month = asked && months.includes(asked) ? asked : (months[0] ?? null);
  const branchName = String(branch.name ?? "");
  if (!month) return { branchName, months, month: null, rows: [] };

  // `month` 21.09.2026 gacha yozilmagan — o'shandagilar sanadan (groupExamMonth bilan bir xil).
  const exams = await col
    .find<GroupExam>(
      { $and: [scope, { $or: [{ month }, { month: { $in: [null, ""] }, date: { $regex: `^${month}-` } }] }] },
      { projection: { _id: 0, createdBy: 0, createdAt: 0, updatedBy: 0, updatedAt: 0 } },
    )
    .toArray();
  return { branchName, months, month, rows: publicRankRows(rankPool(exams, month)) };
}
