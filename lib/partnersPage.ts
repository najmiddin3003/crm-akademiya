import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { addMonths, profitAndLoss } from "@/lib/financialPlan";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { parseMoney } from "@/lib/taxes";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → MOLIYA → «HAMKORLAR VA 3-SHAXSLAR» (39-qism). Ro'yxatlar — eski Sozlamalar → Moliya tablari bilan
// umumiy (`settings_partners`, `settings_third_persons`, /api/settings-lists). Hamkor ulushi o'tgan oy sof foydasidan
// (Moliyaviy reja → Foyda va zarar, lib/financialPlan.ts → profitAndLoss) FAQAT KO'RSATISH uchun hisoblanadi —
// ulush to'lovi kassadan alohida yoziladi. 3-shaxslar kassa amallariga hali bog'lanmagan (SAVOLLAR 523).
export async function partnersPage(db: Db, scope: BranchScope) {
  const prev = addMonths(uzDateIso().slice(0, 7), -1);
  const [partners, thirds, pnl] = await Promise.all([
    db.collection(SETTINGS_LIST_KINDS.partners).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection(SETTINGS_LIST_KINDS["third-persons"]).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    profitAndLoss(db, scope, prev, null),
  ]);
  const i = pnl.months.indexOf(prev);
  const income = pnl.totals.income[i] ?? 0;
  const expense = pnl.totals.expense[i] ?? 0;
  const profit = pnl.totals.profit[i] ?? income - expense;
  const rows = partners.map((p) => {
    const share = parseMoney(p.share);
    return { id: Number(p.id), name: String(p.name ?? ""), phone: String(p.phone ?? ""), share, amount: Math.round((Math.max(profit, 0) * share) / 100) };
  });
  return {
    ok: true as const,
    month: prev,
    income,
    expense,
    profit,
    partners: rows,
    shareSum: rows.reduce((a, r) => a + r.share, 0),
    thirds: thirds.map((t) => ({ id: Number(t.id), name: String(t.name ?? ""), phone: String(t.phone ?? ""), balance: parseMoney(t.balance) })),
  };
}
