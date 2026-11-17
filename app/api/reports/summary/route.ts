import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { branchInCondition, getBranchScope } from "@/lib/branchScope";
import { computeDebtors } from "@/lib/debtors";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";
import { computeFunnel } from "@/lib/reportLeads";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/summary — Hisobotlar katalogi tepasidagi «Tez-tez ochiladi» kartalari (35-qism): Qarzdorlar,
// Sotuv voronkasi, Kirim va chiqim (shu oy sof), Faol o'quvchilar. Joriy filial; har karta — o'z hisobotining
// ruxsati bo'lsagina (ruxsat yo'q karta qaytmaydi).
export async function GET() {
  const me = await getCurrentUser();
  const scope = await getBranchScope();
  if (!me || !scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const can = (p: string) => isPathAllowed(p, me.permissions);
  const db = await ensureIndexes();
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const ids = [scope.branchId];
  const out: Record<string, unknown> = { ok: true, today };

  if (can("/reports-unpaid")) {
    const rep = await computeDebtors(db, scope, today);
    const owing = rep.rows.filter((r) => r.debt > 0);
    out.debtors = { count: owing.length, sum: owing.reduce((a, r) => a + r.debt, 0), long: owing.filter((r) => (r.unpaid?.count ?? 0) >= 2).length };
  }
  if (can("/reports-funnel")) {
    const f = await computeFunnel(db, ids, `${month}-01`, today, {});
    out.funnel = { leads: f.total, paid: f.stages[4]?.count ?? 0 };
  }
  if (can("/finance-cashflow")) {
    const boxes = await db.collection("cashboxes").find(branchInCondition(ids), { projection: { _id: 0, id: 1 } }).toArray();
    const [r] = await db
      .collection("transaction_entries")
      .aggregate([
        { $match: { txType: { $in: ["payIn", "payOut"] }, status: { $nin: ["cancelled", "waiting"] }, date: { $gte: `${month}-01`, $lte: today }, cashboxId: { $in: boxes.map((b) => Number(b.id)) } } },
        { $group: { _id: null, inc: { $sum: { $cond: [{ $gt: ["$amount", 0] }, "$amount", 0] } }, net: { $sum: "$amount" } } },
      ])
      .toArray();
    out.cash = { net: Number(r?.net ?? 0), income: Number(r?.inc ?? 0) };
  }
  if (can("/active-students") || can("/groups")) {
    const groups = await db.collection("groups").find(branchInCondition(ids), { projection: { _id: 0, id: 1 } }).toArray();
    const gid = groups.map((g) => Number(g.id));
    const [active, joined, left] = await Promise.all([
      db.collection(GROUP_MEMBERSHIPS).distinct("pupilId", { groupId: { $in: gid }, leftAt: null }),
      db.collection(GROUP_MEMBERSHIPS).distinct("pupilId", { groupId: { $in: gid }, joinedAt: { $gte: `${month}-01` } }),
      db.collection(GROUP_MEMBERSHIPS).distinct("pupilId", { groupId: { $in: gid }, leftAt: { $gte: `${month}-01` } }),
    ]);
    out.active = { count: active.length, joined: joined.length, left: left.length };
  }
  return NextResponse.json(out);
}
