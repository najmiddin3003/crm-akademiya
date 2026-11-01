import type { Db, Document, Filter } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { branchPool, collapseBranchPools } from "@/lib/branchPools";
import { groupExamMonth, publicExamOf, type GroupExam, type PublicBranch, type PublicResults } from "@/lib/imtihon";

// OCHIQ NATIJALAR (01.11.2026, foydalanuvchi: «imtihon sarhisob bo'limida
// o'quvchilar o'z natijalarini ko'ra olishlari uchun ochiq sahifa ... login
// qilmasdan ham kirish mumkin bo'lsin») — /natijalar sahifasining ma'lumoti.
// Sahifa (app/natijalar/page.tsx) SERVERDA chaqiradi — alohida ochiq API yo'q.
//
// Faqat O'QIYDI va faqat Sarhisob (`group_exams`) natijalarini: fan, ustoz,
// guruh, sana, savollar soni, o'quvchi ismi va natijasi. TELEFON SHU YERDA
// YASHIRILADI — faqat oxirgi 4 raqam (lib/imtihon.ts → maskPhoneTail);
// o'quvchi id'si va kim kiritgani brauzerga umuman yetib bormaydi.
//
// ?filial=<id> — Sarhisob'dagidek HOVUZ bilan (1 yoki 2 → ikkalasi; admin
//               ko'rgan ro'yxat bilan bir xil); yo'q yoki noto'g'ri — barcha filiallar.
// ?oy=YYYY-MM  — yo'q yoki noto'g'ri — natijasi bor eng oxirgi oy. Havolada
//               berilgan oyda natija hali bo'lmasa ham shu oy qoladi (admin oy
//               boshida havolani tarqatadi, natija kiritilgach ko'rinadi).

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function loadPublicResults(db: Db, query: { filial?: string | null; oy?: string | null }): Promise<PublicResults> {
  const col = db.collection("group_exams");

  const [branchDocs, usedRaw, legacy] = await Promise.all([
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    col.distinct("branchId"),
    col.findOne({ $or: [{ branchId: { $exists: false } }, { branchId: null }] }, { projection: { _id: 1 } }),
  ]);
  const used = new Set(usedRaw.map(Number).filter((n) => Number.isInteger(n) && n > 0));
  // `branchId` siz eski hujjatlar — 1-filialniki (lib/branchScope.ts → branchInCondition).
  if (legacy) used.add(1);

  const all: PublicBranch[] = branchDocs
    .map((b) => ({ id: Number(b.id), name: String(b.name ?? "").trim() }))
    .filter((b) => Number.isInteger(b.id) && b.id > 0 && b.name !== "");
  const wanted = Number(query.filial);
  const branch = all.find((b) => b.id === wanted) ?? null;
  // Tanlovda — natijasi bor filiallar; tanlangani bo'sh bo'lsa ham qoladi (yozuvi to'g'ri chiqsin).
  const branches = collapseBranchPools(
    all.filter((b) => b.id === branch?.id || branchPool(b.id).some((id) => used.has(id))),
    branch?.id ?? null,
  );
  const where: Filter<Document> = branch ? branchInCondition(branchPool(branch.id)) : {};

  // Oylar — faqat sana/oy maydonlari (21.09.2026 gacha yozilganlarda `month` yo'q — sanadan).
  const meta = await col.find<Pick<GroupExam, "date" | "month">>(where, { projection: { _id: 0, date: 1, month: 1 } }).toArray();
  const months = [...new Set(meta.map(groupExamMonth))].filter((m) => MONTH_RE.test(m));
  const asked = query.oy ?? "";
  const month = MONTH_RE.test(asked) ? asked : (months.sort().at(-1) ?? null);
  if (month && !months.includes(month)) months.push(month);
  months.sort().reverse();

  const rows = month
    ? await col
        .find<GroupExam>(
          // `month` oldin tekshirilgan (MONTH_RE) — regex'ga boshqa belgi tushmaydi.
          { $and: [where, { $or: [{ month }, { month: { $in: [null, ""] }, date: { $regex: `^${month}-` } }] }] },
          { projection: { _id: 0, createdBy: 0, createdAt: 0 } },
        )
        .sort({ date: -1, id: -1 })
        .toArray()
    : [];

  return { branch, branches, months, month, exams: rows.map(publicExamOf) };
}
