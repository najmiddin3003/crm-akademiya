import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import type { Bonus } from "@/lib/bonuses";
import type { Penalty } from "@/lib/penalties";
import type { TransactionEntry } from "@/lib/transactionEntries";

// Hisobotlar → Balans (href /reports-balance).
//
// Yangi kolleksiya YO'Q — hammasi mavjud manbalardan jamlanadi:
//   Bonus   ← `bonuses`            (recipientName bo'yicha)
//   Jarima  ← `penalties`          (recipientName bo'yicha, bekor qilinganlar hisobga olinmaydi)
//   Avans   ← `transaction_entries` ("Hodimga avans" nomli chiqim yozuvlari)
//   Ish haqi = Bonus − Jarima − Avans
//
// "Ish haqi" ustuni shu tarzda QOLDIQ sifatida chiqadi (referensda ham
// avansi katta xodimlarda manfiy). Alohida oylik jadvali paydo bo'lsa,
// shu formulani almashtirish kifoya.

export interface BalanceRow {
  id: number;
  name: string;
  phone: string;
  salary: number;
  bonus: number;
  advance: number;
  penalty: number;
}

export async function GET() {
  const db = await ensureIndexes();

  const [employees, bonuses, penalties, entries] = await Promise.all([
    db.collection("hr_employees").find({}).sort({ id: 1 }).toArray(),
    db.collection("bonuses").find({}).toArray(),
    db.collection("penalties").find({}).toArray(),
    db.collection("transaction_entries").find({ txName: "Hodimga avans" }).toArray(),
  ]);

  const sumBy = <T,>(rows: T[], nameOf: (r: T) => string, amountOf: (r: T) => number) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const name = nameOf(r);
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + amountOf(r));
    }
    return map;
  };

  const bonusBy = sumBy(bonuses as unknown as Bonus[], (b) => b.recipientName, (b) => b.amount);
  // Bekor qilingan jarima qoldiqqa ta'sir qilmasligi kerak.
  const penaltyBy = sumBy(
    (penalties as unknown as Penalty[]).filter((p) => p.status !== "cancelled"),
    (p) => p.recipientName,
    (p) => p.amount,
  );
  const advanceBy = sumBy(
    entries as unknown as TransactionEntry[],
    (e) => e.moderator || e.studentName,
    (e) => Math.abs(e.amount),
  );

  const rows: BalanceRow[] = (employees as unknown as HrEmployee[]).map((e) => {
    const bonus = bonusBy.get(e.name) ?? 0;
    const penalty = penaltyBy.get(e.name) ?? 0;
    const advance = advanceBy.get(e.name) ?? 0;
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
