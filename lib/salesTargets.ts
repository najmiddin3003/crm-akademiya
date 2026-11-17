import type { Db } from "mongodb";
import { branchInCondition, type BranchScope } from "@/lib/branchScope";
import { scopedEmployeeFilter } from "@/lib/employeeBranches";
import { createdIso } from "@/lib/financeAnalytics";
import { uzDateIso } from "@/lib/uzTime";

// SAVDO PLANI (36-qism, rasmlar «Savdo plani», «Rejani sozlash»).
//
// Reja — har admin uchun OYLIK yangi o'quvchilar soni (`sales_targets`: oy + filial + admin ismi). Bajarilish —
// admin lidlaridan (`orders.moderator`) o'quvchi bo'lib, BIRINCHI to'lovi shu oyga tushganlar (lid qaysi oyda
// yozilgani muhim emas). Lid — shu oyda yozilgan lidlar; konversiya — shu oy lidlaridan to'lov qilganlar ulushi.
// Prognoz — bugungi sur'at bo'yicha oy oxiriga (bajarilish ÷ o'tgan kunlar × oydagi kunlar). «Bugungi kutilgan
// joy» — reja × o'tgan kun ÷ oydagi kun. Rejadan 15% dan ko'p orqada — «orqada».
// Eski «Savdo plani» (`sales_plans`, oyliksiz bitta son) — eski versiyada, tegilmagan.

export const SALES_TARGETS = "sales_targets";

const daysIn = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
export const prevMonth = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7);
export const nextMonth = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)).toISOString().slice(0, 7);

export interface AdminPlanRow {
  admin: string;
  branchId: number;
  target: number;
  done: number;
  leads: number;
  convPct: number | null;
  forecast: number;
  expected: number;
  behind: boolean;
}
export interface SalesPlanReport {
  ok: true;
  month: string;
  today: string;
  day: number;
  days: number;
  closed: boolean;
  rows: AdminPlanRow[];
  total: { target: number; done: number; leads: number; convPct: number | null; forecast: number; expected: number };
  daily: { day: number; cum: number }[];
  branches: { id: number; name: string; target: number; done: number; leads: number; came: number; paidOfCame: number }[];
  prev: { month: string; done: Record<string, number>; target: Record<string, number> };
}

async function actuals(db: Db, branchIds: number[], month: string) {
  const leads = await db
    .collection("orders")
    .find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, createdAt: 1, moderator: 1, pupilId: 1, branchId: 1, firstLessonStatus: 1, holat: 1, groupId: 1 } })
    .toArray();
  const pupilIds = leads.map((l) => Number(l.pupilId)).filter((x) => x > 0);
  const firsts = pupilIds.length
    ? await db
        .collection("transaction_entries")
        .aggregate([{ $match: { txType: "payIn", status: { $nin: ["cancelled", "waiting"] }, pupilId: { $in: pupilIds } } }, { $group: { _id: "$pupilId", first: { $min: "$date" } } }])
        .toArray()
    : [];
  const firstBy = new Map(firsts.map((f) => [Number(f._id), String(f.first)]));
  const adminOf = (l: Record<string, unknown>) => String(l.moderator ?? "").trim() || "Biriktirilmagan";
  const doneDates = new Map<string, string[]>();
  const leadCount = new Map<string, number>();
  const leadPaid = new Map<string, number>();
  const byBranch = new Map<number, { leads: number; came: number; paidOfCame: number; done: number }>();
  for (const l of leads) {
    const a = adminOf(l);
    const b = Number(l.branchId) || 1;
    const bb = byBranch.get(b) ?? { leads: 0, came: 0, paidOfCame: 0, done: 0 };
    const first = firstBy.get(Number(l.pupilId));
    if (first && first.slice(0, 7) === month) {
      doneDates.set(a, [...(doneDates.get(a) ?? []), first]);
      bb.done += 1;
    }
    if (createdIso(l.createdAt).slice(0, 7) === month) {
      leadCount.set(a, (leadCount.get(a) ?? 0) + 1);
      bb.leads += 1;
      if (first) leadPaid.set(a, (leadPaid.get(a) ?? 0) + 1);
      const came = ["KELDI", "GURUHGA_QOSHILDI"].includes(String(l.firstLessonStatus ?? "")) || l.holat === "guruh" || !!l.groupId;
      if (came) {
        bb.came += 1;
        if (first) bb.paidOfCame += 1;
      }
    }
    byBranch.set(b, bb);
  }
  return { doneDates, leadCount, leadPaid, byBranch };
}

export async function salesPlan(db: Db, scope: BranchScope, branchIds: number[], month: string): Promise<SalesPlanReport> {
  const today = uzDateIso();
  const days = daysIn(month);
  const closed = today.slice(0, 7) > month;
  const day = closed ? days : today.slice(0, 7) === month ? Number(today.slice(8, 10)) : 0;
  const [targets, prevTargets, employees, branchDocs] = await Promise.all([
    db.collection(SALES_TARGETS).find({ month, branchId: { $in: branchIds } }).toArray(),
    db.collection(SALES_TARGETS).find({ month: prevMonth(month), branchId: { $in: branchIds } }).toArray(),
    db.collection("hr_employees").find(scopedEmployeeFilter({ turi: "moderator", archived: { $ne: true } }, scope), { projection: { _id: 0, name: 1, branchId: 1 } }).toArray(),
    db.collection("branches").find({ id: { $in: branchIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);
  const { doneDates, leadCount, leadPaid, byBranch } = await actuals(db, branchIds, month);
  const prevAct = await actuals(db, branchIds, prevMonth(month));

  const names = new Set<string>([...employees.map((e) => String(e.name)), ...targets.map((t) => String(t.admin)), ...doneDates.keys(), ...leadCount.keys()]);
  const targetOf = (a: string) => targets.filter((t) => t.admin === a).reduce((s, t) => s + Number(t.target || 0), 0);
  const branchOfAdmin = (a: string) => Number(targets.find((t) => t.admin === a)?.branchId ?? employees.find((e) => e.name === a)?.branchId ?? branchIds[0]);
  const rows: AdminPlanRow[] = [...names]
    .map((admin) => {
      const target = targetOf(admin);
      const done = doneDates.get(admin)?.length ?? 0;
      const leads = leadCount.get(admin) ?? 0;
      const expected = Math.round(((target * day) / days) * 10) / 10;
      const forecast = day ? Math.round((done / day) * days) : 0;
      return { admin, branchId: branchOfAdmin(admin), target, done, leads, convPct: leads ? Math.round(((leadPaid.get(admin) ?? 0) / leads) * 100) : null, forecast, expected, behind: target > 0 && !closed && done < expected * 0.85 };
    })
    .filter((r) => r.target || r.done || r.leads || employees.some((e) => e.name === r.admin))
    .sort((a, b) => b.target - a.target || b.done - a.done);

  const allDates = [...doneDates.values()].flat().map((d) => Number(d.slice(8, 10)));
  const daily = Array.from({ length: days }, (_, i) => ({ day: i + 1, cum: allDates.filter((d) => d <= i + 1).length })).slice(0, Math.max(day, 0));
  const tT = rows.reduce((a, r) => a + r.target, 0);
  const tD = rows.reduce((a, r) => a + r.done, 0);
  const tL = rows.reduce((a, r) => a + r.leads, 0);
  const tP = [...leadPaid.values()].reduce((a, b) => a + b, 0);
  return {
    ok: true,
    month,
    today,
    day,
    days,
    closed,
    rows,
    total: { target: tT, done: tD, leads: tL, convPct: tL ? Math.round((tP / tL) * 100) : null, forecast: day ? Math.round((tD / day) * days) : 0, expected: Math.round(((tT * day) / days) * 10) / 10 },
    daily,
    branches: branchDocs.map((b) => {
      const x = byBranch.get(Number(b.id)) ?? { leads: 0, came: 0, paidOfCame: 0, done: 0 };
      return { id: Number(b.id), name: String(b.name), target: targets.filter((t) => Number(t.branchId) === Number(b.id)).reduce((s, t) => s + Number(t.target || 0), 0), ...x };
    }),
    prev: {
      month: prevMonth(month),
      done: Object.fromEntries([...prevAct.doneDates.entries()].map(([a, d]) => [a, d.length])),
      target: Object.fromEntries(prevTargets.map((t) => [String(t.admin), Number(t.target || 0)])),
    },
  };
}

export async function saveTargets(db: Db, branchId: number, month: string, targets: Record<string, number>, alsoNext: boolean, by: string) {
  const months = alsoNext ? [month, nextMonth(month)] : [month];
  for (const m of months)
    for (const [admin, v] of Object.entries(targets)) {
      const target = Math.max(0, Math.min(999, Math.floor(Number(v) || 0)));
      await db.collection(SALES_TARGETS).updateOne({ month: m, branchId, admin }, { $set: { month: m, branchId, admin, target, updatedBy: by, updatedAt: new Date().toISOString() } }, { upsert: true });
    }
  return { ok: true as const };
}
