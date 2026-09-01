import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/moderator-summary?moderator=<ism>
//
// Xodim profilidagi "KPI" tabidagi uchta son.
//
// Ilgari sahifa /api/transaction-entries?moderator=…&txType=payIn ni
// LIMITSIZ chaqirardi va uchta sonni brauzerda hisoblardi. Eng band
// moderatorda bu 13 369 qator, ya'ni 6 493 KB. Endi Mongo hisoblaydi.
//
// SHART: natija KpiTab dagi eski hisob bilan AYNAN bir xil bo'lishi kerak
// (components/employees/EmployeeProfileTabs.tsx). Shartlar o'sha tartibda:
//
//   route'ning `moderator` filtri  -> { $regex: "^ism$", $options: "i" }
//        (nameFilter bilan bir xil: chetlari kesilgan, katta-kichik harf
//         farq qilmaydi)
//   route'ning moderator shoxi     -> studentName: { $nin: ["", null] }
//        (o'quvchisiz yozuv — masalan kassalar aro ko'chirish — bu
//         ro'yxatga tushmaydi)
//   txType === "payIn"             -> { txType: "payIn" }
//   `payments.filter(e => e.status !== "cancelled")`
//                                  -> { status: { $ne: "cancelled" } }
//
// "To'lov qilgan o'quvchilar" — TAKRORLANMAS ismlar soni. Eski kod
// `new Set(live.map(e => e.studentName))` ishlatadi, ya'ni XOM ism
// bo'yicha, trim/kichik harfsiz. Shuning uchun bu yerda ham `$addToSet`
// xom maydonga qo'llanadi — aks holda son boshqacha chiqardi.

/** Regexda maxsus belgilar bo'lsa ular oddiy harf sifatida qaralsin. */
function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const moderator = (sp.get("moderator") || "").trim();
  // `?teacherName=` — USTOZ kesimi: shu ustozning o'quvchilari qilgan
  // to'lovlar. O'qituvchi hech qachon kassir bo'lmagani uchun `moderator`
  // bilan so'ralganda KPI doim nol chiqardi.
  const teacherName = (sp.get("teacherName") || "").trim();
  if (!moderator && !teacherName) {
    return NextResponse.json({ ok: false, error: "moderator yoki teacherName kerak" }, { status: 400 });
  }

  // Qolgan uchta shart O'ZGARMAYDI: ular Oyliklar sahifasidagi
  // `loadCollectedByTeacher` bilan bir xil qoida — aks holda KPI va oylik
  // hisobi bir-biriga chaqishmay qolardi.
  const who = moderator
    ? { moderator: { $regex: `^${escapeRegex(moderator)}$`, $options: "i" } }
    : { teacherName: { $regex: `^${escapeRegex(teacherName)}$`, $options: "i" } };

  const db = await ensureIndexes();
  const rows = await db
    .collection("transaction_entries")
    .aggregate([
      {
        $match: {
          ...who,
          studentName: { $nin: ["", null] },
          txType: "payIn",
          status: { $ne: "cancelled" },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
          students: { $addToSet: "$studentName" },
        },
      },
      { $project: { _id: 0, count: 1, amount: 1, students: { $size: "$students" } } },
    ])
    .toArray();

  // Bitta ham yozuv bo'lmasa `$group` hech narsa qaytarmaydi — nol.
  const r = rows[0] ?? {};
  return NextResponse.json({
    ok: true,
    count: Number(r.count ?? 0),
    amount: Number(r.amount ?? 0),
    students: Number(r.students ?? 0),
  });
}
