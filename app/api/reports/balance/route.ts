import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { TransactionEntry } from "@/lib/transactionEntries";
import { getBranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";

// Hisobotlar → Balans (href /reports-balance).
//
// Yangi kolleksiya YO'Q — hammasi mavjud manbalardan jamlanadi:
//   Bonus   ← `bonuses`             (recipientName bo'yicha)
//   Jarima  ← `penalties`           (recipientName bo'yicha)
//   Avans   ← `transaction_entries` (xodimga yozilgan avans chiqimlari)
//   Ish haqi = Bonus − Jarima − Avans
//
// "Ish haqi" ustuni shu tarzda QOLDIQ sifatida chiqadi (referensda ham
// avansi katta xodimlarda manfiy). Alohida oylik jadvali paydo bo'lsa,
// shu formulani almashtirish kifoya.
//
// Uch qoida — Xodim profili (components/employees/EmployeeProfilePage.tsx)
// bilan bir xil bo'lishi SHART, aks holda ikki ekran bir xil yozuv haqida
// turlicha raqam ko'rsatadi:
//   1. Avansning EGASI `studentName` da turadi, `moderator` da esa yozuvni
//      qayd etgan xodim. Yozish yo'li: app/api/cashboxes/[id]/adjust/route.ts
//      (`studentName: studentName` — tanlangan xodim, `moderator: teacherName
//      || current.moderator` — kassa mas'uli).
//   2. Kategoriya nomi admin tomonidan erkin yoziladi — bazada ham
//      "Hodimga avans", ham "hodimga avans" bor. Shuning uchun aniq satr
//      emas, /avans/i qidiriladi (app/api/employee-salary-summary/route.ts
//      dagi isSalaryCategory bilan bir xil).
//   3. Bekor qilingan yozuv (bonus, jarima yoki avans) qoldiqqa
//      qo'shilmaydi.

export interface BalanceRow {
  id: number;
  name: string;
  phone: string;
  salary: number;
  bonus: number;
  advance: number;
  penalty: number;
}

/** Ism kalitlari katta-kichik harf va ortiqcha bo'shliqqa bog'liq bo'lmasin. */
function key(name: unknown): string {
  return String(name ?? "").trim().toLowerCase();
}

export async function GET() {
  const db = await ensureIndexes();
  // FILIAL QAMROVI. Bu hisobot xodimlarning telefoni, oyligi, bonusi,
  // avansi va jarimasini birga qaytaradi — ya'ni kesilmagan holda u
  // butun kompaniyaning maosh ma'lumotini har bir filialga ochib berardi.
  //
  // Ilgari bu yerda `getBranchScope()` UMUMAN chaqirilmasdi va endpoint
  // qamrov ro'yxatlarining hech birida yo'q edi — shunchaki unutilgan.
  const scope = await getBranchScope();
  if (!scope) {
    return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  }

  const [employees, bonuses, penalties, entries] = await Promise.all([
    db.collection("hr_employees").find(scopedEmployeeFilter({}, scope)).sort({ id: 1 }).toArray(),
    db.collection("bonuses").find({}).toArray(),
    db.collection("penalties").find({}).toArray(),
    db
      .collection("transaction_entries")
      .find({ txType: "payOut", txName: { $regex: "avans", $options: "i" } })
      // Pastda faqat shu uchtasi o'qiladi: studentName (sumBy kaliti),
      // amount va status (notCancelled). 1 173 KB -> 160 KB.
      .project({ studentName: 1, amount: 1, status: 1, _id: 0 })
      .toArray(),
  ]);

  const sumBy = <T,>(rows: T[], nameOf: (r: T) => string, amountOf: (r: T) => number) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = key(nameOf(r));
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + amountOf(r));
    }
    return map;
  };

  const notCancelled = <T extends { status?: string }>(rows: T[]) => rows.filter((r) => r.status !== "cancelled");

  const bonusBy = sumBy(
    notCancelled(bonuses as unknown as Bonus[]),
    (b) => b.recipientName,
    (b) => b.amount,
  );
  const penaltyBy = sumBy(
    notCancelled(penalties as unknown as Penalty[]),
    (p) => p.recipientName,
    (p) => p.amount,
  );
  // Avans EGASI — `studentName`. `studentName` bo'sh yozuvlar (demo urug'ida
  // uchraydi) hech kimga tegishli emas: sumBy ularni tashlab ketadi.
  const advanceBy = sumBy(
    notCancelled(entries as unknown as TransactionEntry[]),
    (e) => e.studentName,
    (e) => Math.abs(e.amount),
  );

  const rows: BalanceRow[] = (employees as unknown as HrEmployee[]).map((e) => {
    const k = key(e.name);
    const bonus = bonusBy.get(k) ?? 0;
    const penalty = penaltyBy.get(k) ?? 0;
    const advance = advanceBy.get(k) ?? 0;
    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      bonus,
      penalty,
      advance,
      salary: bonus - penalty - advance,
    };
  });

  return NextResponse.json({ ok: true, rows });
}
