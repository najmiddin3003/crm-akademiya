import type { Db, Document } from "mongodb";
import { branchPool, collapseBranchPools } from "@/lib/branchPools";
import type { BranchScope } from "@/lib/branchScope";
import { computeDebtors, monthBounds } from "@/lib/debtors";
import type { PlannedExpense } from "@/lib/plannedExpenses";
import { ENTRY_PAID_EXPR } from "@/lib/transactionEntries";
import { uzDateIso } from "@/lib/uzTime";
import type { ExpensePayload, ExpenseRow, FlowPayload, FlowWeek, PnlLine, PnlPayload, RevenueBranchRow, RevenueDebtor, RevenuePayload } from "@/lib/financialPlanTypes";

// MOLIYAVIY REJA (32-qism, rasmlar «Moliyaviy reja · Tushum / Xarajat / Pul oqimi / Foyda va zarar»).
//
// • TUSHUM REJASI — qarzdorlar hisobi (lib/debtors.ts) bilan bir xil qoida: reja = oy bo'yicha guruh
//   jadvalidagi darslar × dars narxi (oylik narx ÷ oydagi darslar) hamma a'zo bo'yicha. Tushdi — shu oyda
//   shu o'quvchilardan tushgan to'lov. Muddati o'tgan = o'quvchilarning bugungi qarzi (o'tgan darslar ×
//   narx − to'langan), oy rejasining to'lanmagan qismigacha; Kutilmoqda = reja − tushdi − muddati o'tgan. Filial hovuzi bitta qator (lib/branchPools.ts).
// • XARAJAT REJASI — «Rejalashtirilgan xarajatlar» (`planned_expenses`, oylikka keltiriladi) va shu oydagi
//   haqiqiy chiqimlar (`transaction_entries`, payOut, qaytarimsiz) tranzaksiya turi NOMI bo'yicha.
// • PUL OQIMI — kassalar qoldig'i haftalar bo'yicha (bekor qilingan va tasdiq kutayotgan ko'chirmalar
//   hisobga olinmaydi). Bugundan keyingi haftalar — prognoz: tushum rejasidagi «Kutilmoqda» va xarajat
//   rejasidagi qolgani qolgan kunlarga teng bo'linadi; qarzlar qo'shilmaydi.
// • FOYDA VA ZARAR — kassa usuli: oy ichida tushgan kirim va chiqim (to'lov qaysi oy uchunligi tizimda
//   yo'q — SAVOLLAR). Joriy oyda «reja» ustuni — tushum va xarajat rejasi.

const COLL = "transaction_entries";
const LIVE = { status: { $nin: ["cancelled", "waiting"] } };

export function addMonths(m: string, n: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const daysIn = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const dayIso = (m: string, d: number) => `${m}-${String(d).padStart(2, "0")}`;

interface BranchDoc {
  id: number;
  name: string;
}

async function branchList(db: Db, scope: BranchScope, only: number | null): Promise<BranchDoc[]> {
  const docs = (await db
    .collection("branches")
    .find({ id: { $in: scope.allowed } }, { projection: { _id: 0, id: 1, name: 1 } })
    .sort({ id: 1 })
    .toArray()) as unknown as BranchDoc[];
  const list = collapseBranchPools(docs, scope.branchId);
  return only ? list.filter((b) => branchPool(b.id).includes(only)) : list;
}

/** Filial kassalari (filial tanlangan bo'lsa); `null` — hammasi. */
async function cashboxFilter(db: Db, only: number | null): Promise<Document> {
  if (!only) return {};
  const pool = [...branchPool(only)];
  const boxes = await db.collection("cashboxes").find({ branchId: { $in: pool } }, { projection: { _id: 0, id: 1 } }).toArray();
  return { cashboxId: { $in: boxes.map((b) => Number(b.id)) } };
}

// ─────────────────────────────── Tushum rejasi ───────────────────────────────

export async function revenuePlan(db: Db, scope: BranchScope, month: string, only: number | null): Promise<RevenuePayload> {
  const today = uzDateIso();
  const { to: monthEnd } = monthBounds(month);
  const asOf = today < monthEnd ? today : monthEnd;
  const branches = await branchList(db, scope, only);
  const rows: RevenueBranchRow[] = [];
  const debtors: RevenueDebtor[] = [];
  let expectedToDate = 0;
  let issues = 0;
  for (const b of branches) {
    const bs: BranchScope = { ...scope, branchId: b.id };
    const rep = await computeDebtors(db, bs, asOf, month);
    const plan = rep.month?.expected ?? 0;
    const received = rep.month?.received ?? 0;
    const owing = rep.rows.filter((r) => r.debt > 0);
    const totalDebt = owing.reduce((a, r) => a + r.debt, 0);
    // Muddati o'tgan — bugungi qarz, lekin shu oy rejasining to'lanmagan qismidan oshmaydi (eski oylar
    // qarzi rejaga kirmaydi; u «qarzdorlar» ro'yxatida to'liq ko'rinadi).
    const overdue = Math.min(totalDebt, Math.max(0, plan - received));
    expectedToDate += received + overdue;
    issues += rep.issues.length;
    rows.push({ branchId: b.id, name: b.name, students: rep.month?.students ?? 0, plan, received, overdue, debtors: owing.length, pending: Math.max(0, plan - received - overdue) });
    for (const r of owing)
      debtors.push({ id: r.id, name: r.name, groups: r.groups.map((g) => g.group).join(", "), debt: r.debt, months: r.unpaid?.count ?? 0 });
  }
  const sum = (k: keyof RevenueBranchRow) => rows.reduce((a, r) => a + Number(r[k]), 0);
  return {
    ok: true,
    tab: "revenue",
    month,
    asOf,
    closed: asOf === monthEnd,
    totals: { plan: sum("plan"), received: sum("received"), overdue: sum("overdue"), pending: sum("pending"), expectedToDate, students: sum("students"), debtors: sum("debtors") },
    branches: rows,
    debtors: debtors.sort((a, b) => b.debt - a.debt).slice(0, 8),
    issues,
  };
}

// ─────────────────────────────── Xarajat rejasi ──────────────────────────────

function monthlyOf(e: PlannedExpense, month: string): { amount: number; note: string } | null {
  const { from, to } = monthBounds(month);
  if (e.status && e.status !== "Faol") return null;
  if (e.startDate && e.startDate > to) return null;
  if (e.endDate && e.endDate < from) return null;
  const a = Number(e.amount) || 0;
  switch (e.type) {
    case "Kunlik":
      return { amount: a * daysIn(month), note: `Kunlik × ${daysIn(month)}` };
    case "Haftalik":
      return { amount: Math.round((a * daysIn(month)) / 7), note: "Haftalik" };
    case "Yillik":
      return { amount: Math.round(a / 12), note: "Yillik ÷ 12" };
    default:
      return { amount: a, note: "Oylik" };
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[ʻʼ‘’`]/g, "'");

async function expenseActuals(db: Db, month: string, only: number | null) {
  const { from, to } = monthBounds(month);
  const box = await cashboxFilter(db, only);
  return db
    .collection(COLL)
    .aggregate([
      { $match: { ...LIVE, ...box, txType: "payOut", studentRefund: { $ne: true }, date: { $gte: from, $lte: to } } },
      { $group: { _id: "$txName", spent: { $sum: { $multiply: ["$amount", -1] } }, count: { $sum: 1 }, last: { $max: "$date" } } },
    ])
    .toArray();
}

export async function expensePlan(db: Db, month: string, only: number | null): Promise<ExpensePayload> {
  const planned = (await db.collection("planned_expenses").find({}, { projection: { _id: 0 } }).toArray()) as unknown as PlannedExpense[];
  const actual = await expenseActuals(db, month, only);
  const map = new Map<string, ExpenseRow>();
  for (const e of planned) {
    const m = monthlyOf(e, month);
    if (!m || !e.name) continue;
    const k = norm(e.name);
    const cur = map.get(k);
    if (cur) cur.plan = (cur.plan ?? 0) + m.amount;
    else map.set(k, { name: e.name, plan: m.amount, planNote: m.note, spent: 0, count: 0, lastDate: null });
  }
  for (const a of actual) {
    const name = String(a._id || "Boshqa chiqim");
    const k = norm(name);
    const cur = map.get(k) ?? { name, plan: null, planNote: "", spent: 0, count: 0, lastDate: null };
    cur.spent += Number(a.spent) || 0;
    cur.count += Number(a.count) || 0;
    cur.lastDate = a.last ? String(a.last) : cur.lastDate;
    map.set(k, cur);
  }
  const rows = [...map.values()].sort((a, b) => (b.plan ?? -1) - (a.plan ?? -1) || b.spent - a.spent);
  const planRows = rows.filter((r) => r.plan !== null);
  const plan = planRows.reduce((s, r) => s + (r.plan ?? 0), 0);
  const spentPlanned = planRows.reduce((s, r) => s + r.spent, 0);
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  return {
    ok: true,
    tab: "expense",
    month,
    totals: { plan, spent, spentPlanned, left: Math.max(0, planRows.reduce((s, r) => s + Math.max(0, (r.plan ?? 0) - r.spent), 0)), unplanned: spent - spentPlanned, items: planRows.length },
    rows,
  };
}

// ──────────────────────────────── Pul oqimi ───────────────────────────────────

export async function cashFlow(db: Db, scope: BranchScope, month: string, only: number | null): Promise<FlowPayload> {
  const today = uzDateIso();
  const { from, to } = monthBounds(month);
  const box = await cashboxFilter(db, only);
  const [openAgg] = await db
    .collection(COLL)
    .aggregate([{ $match: { ...LIVE, ...box, date: { $lt: from } } }, { $group: { _id: null, s: { $sum: "$amount" } } }])
    .toArray();
  const opening = Number(openAgg?.s ?? 0);
  const days = await db
    .collection(COLL)
    .aggregate([
      { $match: { ...LIVE, ...box, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$date",
          inflow: { $sum: { $cond: [{ $and: [{ $ne: ["$txType", "transfer"] }, { $gt: ["$amount", 0] }] }, "$amount", 0] } },
          outflow: { $sum: { $cond: [{ $and: [{ $ne: ["$txType", "transfer"] }, { $lt: ["$amount", 0] }] }, "$amount", 0] } },
          moved: { $sum: { $cond: [{ $eq: ["$txType", "transfer"] }, "$amount", 0] } },
        },
      },
    ])
    .toArray();
  const byDay = new Map(days.map((d) => [String(d._id), { inflow: Number(d.inflow), outflow: Number(d.outflow), moved: Number(d.moved) }]));
  const bigOut = await db
    .collection(COLL)
    .find({ ...LIVE, ...box, txType: "payOut", date: { $gte: from, $lte: to } }, { projection: { _id: 0, txName: 1, amount: 1, date: 1 } })
    .sort({ amount: 1 })
    .limit(40)
    .toArray();

  // Prognoz — faqat joriy oyda, bugundan keyingi kunlarga.
  const isCurrent = today >= from && today <= to;
  let perDayIn = 0;
  let perDayOut = 0;
  if (isCurrent && today < to) {
    const left = daysIn(month) - Number(today.slice(8, 10));
    const [rev, exp] = await Promise.all([revenuePlan(db, scope, month, only), expensePlan(db, month, only)]);
    perDayIn = rev.totals.pending / left;
    perDayOut = -exp.totals.left / left;
  }

  const weeks: FlowWeek[] = [];
  let bal = opening;
  let lowest = { amount: opening, date: from };
  let current = opening;
  const n = daysIn(month);
  for (let s = 1, w = 1; s <= n; s += 7, w++) {
    const e = Math.min(n, s + 6);
    const wk: FlowWeek = { label: `${w}-hafta`, from: dayIso(month, s), to: dayIso(month, e), start: bal, inflow: 0, outflow: 0, end: 0, forecast: dayIso(month, s) > today, notes: [] };
    for (let d = s; d <= e; d++) {
      const iso = dayIso(month, d);
      if (iso > today) {
        wk.inflow += perDayIn;
        wk.outflow += perDayOut;
        bal += perDayIn + perDayOut;
      } else {
        const x = byDay.get(iso);
        if (x) {
          wk.inflow += x.inflow;
          wk.outflow += x.outflow;
          bal += x.inflow + x.outflow + x.moved;
        }
        current = bal;
      }
      if (bal < lowest.amount) lowest = { amount: bal, date: iso };
    }
    wk.inflow = Math.round(wk.inflow);
    wk.outflow = Math.round(wk.outflow);
    wk.end = Math.round(bal);
    wk.notes = bigOut
      .filter((o) => o.date >= wk.from && o.date <= wk.to)
      .slice(0, 2)
      .map((o) => ({ name: String(o.txName || "Chiqim"), amount: -Number(o.amount), date: String(o.date) }));
    weeks.push(wk);
  }
  return { ok: true, tab: "flow", month, today, opening, current: Math.round(current), forecastEnd: Math.round(bal), lowest: { amount: Math.round(lowest.amount), date: lowest.date }, weeks };
}

// ───────────────────────────── Foyda va zarar ────────────────────────────────

export async function profitAndLoss(db: Db, scope: BranchScope, month: string, only: number | null): Promise<PnlPayload> {
  const months = [addMonths(month, -3), addMonths(month, -2), addMonths(month, -1), month];
  const from = `${months[0]}-01`;
  const { to } = monthBounds(month);
  const box = await cashboxFilter(db, only);
  const agg = await db
    .collection(COLL)
    .aggregate([
      { $match: { ...LIVE, ...box, txType: { $in: ["payIn", "payOut"] }, date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            m: { $substrBytes: ["$date", 0, 7] },
            kind: { $cond: [{ $eq: ["$txType", "payIn"] }, "in", { $cond: [{ $eq: ["$studentRefund", true] }, "refund", "out"] }] },
            name: { $ifNull: ["$category", "$txName"] },
          },
          s: { $sum: { $cond: [{ $eq: ["$txType", "payIn"] }, ENTRY_PAID_EXPR, "$amount"] } },
        },
      },
    ])
    .toArray();
  const income = new Map<string, PnlLine>();
  const expense = new Map<string, PnlLine>();
  const line = (m: Map<string, PnlLine>, label: string) => {
    const k = norm(label);
    if (!m.has(k)) m.set(k, { key: k, label, values: months.map(() => 0), plan: null });
    return m.get(k)!;
  };
  for (const a of agg) {
    const i = months.indexOf(String(a._id.m));
    if (i < 0) continue;
    const v = Number(a.s) || 0;
    if (a._id.kind === "in") line(income, String(a._id.name || "Boshqa kirim")).values[i] += v;
    else if (a._id.kind === "refund") line(income, "O'quvchiga qaytarilgan").values[i] += v;
    else line(expense, String(a._id.name || "Boshqa chiqim")).values[i] += -v;
  }
  const today = uzDateIso();
  const current = today.slice(0, 7) === month ? month : null;
  let planIncome: number | null = null;
  let planExpense: number | null = null;
  if (current) {
    const [rev, exp] = await Promise.all([revenuePlan(db, scope, month, only), expensePlan(db, month, only)]);
    planIncome = rev.totals.plan;
    planExpense = exp.totals.plan;
    for (const r of exp.rows) if (r.plan !== null) line(expense, r.name).plan = r.plan;
    line(income, "O'quvchi to'lovi").plan = rev.totals.plan;
  }
  const inc = [...income.values()].sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));
  const exp = [...expense.values()].sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));
  const col = (ls: PnlLine[]) => months.map((_, i) => ls.reduce((s, l) => s + l.values[i], 0));
  const ti = col(inc);
  const te = col(exp);
  return { ok: true, tab: "pnl", months, current, income: inc, expense: exp, totals: { income: ti, expense: te, profit: ti.map((v, i) => v - te[i]), planIncome, planExpense } };
}
