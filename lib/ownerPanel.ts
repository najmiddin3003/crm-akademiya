import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { cameStatus, type AttendanceStatus } from "@/lib/attendance";
import { attendanceOverview } from "@/lib/attendanceControl";
import { loadDailyHandover } from "@/lib/dailyHandover";
import { profitAndLoss, revenuePlan } from "@/lib/financialPlan";
import { holatOf, type HolatSource } from "@/lib/leadHolat";
import { LEAD_CALLS } from "@/lib/frontDesk";
import { ADVANCE_REQUESTS, salaryState } from "@/lib/advanceRequests";
import { staffDay } from "@/lib/staffAttendanceToday";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// RAHBAR PANELI (48-qism, rasmlar «Rahbar paneli · umumiy ko'rinish», «Rahbar kassasi», «Ko'chirmalar»,
// «Tasdiqlar», telefon). Barcha filiallar bitta joyda, faqat Rahbar (admin) ko'radi. Yangi pul yo'li YO'Q —
// hammasi mavjud manbalardan: kassalar va ko'chirmalar (lib/dailyHandover.ts, transaction_entries), tushum rejasi
// va foyda (lib/financialPlan.ts), xodimlar davomati (lib/staffAttendanceToday.ts), belgilanmagan darslar
// (lib/attendanceControl.ts), narx so'rovlari (price_exceptions) va avans so'rovlari (lib/advanceRequests.ts).

const COLL = "transaction_entries";
const LIVE = { status: { $nin: ["cancelled", "waiting"] } };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);
const sum = (o: Record<string, unknown> | undefined) => Object.values(o ?? {}).reduce<number>((a, v) => a + (Number(v) || 0), 0);
const createdMonth = (o: Record<string, unknown>) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(o.createdAt ?? o.created ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

type Box = { id: number; name: string; moderator?: string; isPrimary?: boolean; branchId?: number; balance?: number; methodTotals?: Record<string, number> };

async function loadBranches(db: Db) {
  return (await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray()).map((b) => ({ id: Number(b.id), name: String(b.name ?? "") }));
}

/** Rahbar kassasidan chiqib, filial «Oldim» bosmagan ko'chirmalar (yo'lda). */
async function outgoingFromPrimary(db: Db, primaryId: number, month?: string) {
  const outs = await db
    .collection(COLL)
    .find(
      { cashboxId: primaryId, txType: "transfer", transferRole: "out", ...(month ? { $or: [{ status: "waiting" }, { status: { $ne: "cancelled" }, date: { $gte: `${month}-01`, $lte: `${month}-31` } }] } : { status: "waiting" }) },
      { projection: { _id: 0, id: 1, transferId: 1, amount: 1, status: 1, date: 1, time: 1, note: 1, paymentMethodKey: 1 } },
    )
    .sort({ date: -1, time: -1 })
    .toArray();
  if (!outs.length) return [];
  const ins = await db
    .collection(COLL)
    .find({ transferId: { $in: outs.map((o) => Number(o.transferId)) }, transferRole: "in" }, { projection: { _id: 0, transferId: 1, cashboxId: 1, status: 1, decidedAt: 1, decidedBy: 1, confirmedAt: 1, confirmedBy: 1 } })
    .toArray();
  const boxes = await db.collection("cashboxes").find({ id: { $in: ins.map((i) => Number(i.cashboxId)) } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1 } }).toArray();
  return outs.map((o) => {
    const i = ins.find((x) => Number(x.transferId) === Number(o.transferId));
    const b = boxes.find((x) => Number(x.id) === Number(i?.cashboxId));
    return {
      id: Number(o.id),
      to: String(b?.name ?? ""),
      owner: String(b?.moderator ?? ""),
      amount: Math.abs(Number(o.amount) || 0),
      method: String(o.paymentMethodKey ?? ""),
      date: String(o.date ?? ""),
      time: String(o.time ?? ""),
      note: String(o.note ?? ""),
      waiting: String(i?.status ?? o.status) === "waiting",
      takenBy: String(i?.confirmedBy ?? i?.decidedBy ?? ""),
    };
  });
}

/** Barcha tasdiqlar: avans so'rovlari + direktorga keladigan narx/chegirma so'rovlari. */
export async function ownerApprovals(db: Db) {
  const today = uzDateIso();
  const [adv, prices, branches, settled] = await Promise.all([
    db.collection(ADVANCE_REQUESTS).find({ status: "pending" }, { projection: { _id: 0 } }).sort({ id: -1 }).toArray(),
    db.collection("price_exceptions").find({ status: "pending" }, { projection: { _id: 0 } }).sort({ id: -1 }).toArray(),
    loadBranches(db),
    Promise.all([
      db.collection(ADVANCE_REQUESTS).find({ $or: [{ decidedAt: { $regex: `^${today}` } }, { givenAt: { $regex: `^${today}` } }] }, { projection: { _id: 0 } }).toArray(),
      db.collection("price_exceptions").find({ decidedAt: { $regex: `^${today}` } }, { projection: { _id: 0 } }).toArray(),
    ]),
  ]);
  const bName = (id: unknown) => branches.find((b) => b.id === Number(id))?.name ?? "";
  const states = new Map<number, Awaited<ReturnType<typeof salaryState>>>();
  for (const a of adv) states.set(Number(a.employeeId), await salaryState(db, Number(a.employeeId)).catch(() => null));
  const boxes = await db.collection("cashboxes").find({ id: { $in: adv.map((a) => Number(a.cashboxId)).filter(Boolean) } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1, balance: 1, methodTotals: 1 } }).toArray();
  const items = [
    ...adv.map((a) => {
      const s = states.get(Number(a.employeeId)) ?? null;
      const box = boxes.find((b) => Number(b.id) === Number(a.cashboxId));
      const over = s ? Math.max(0, Number(a.amount) - s.canTake) : 0;
      return {
        key: `a:${a.id}`,
        kind: "avans" as const,
        id: Number(a.id),
        title: `${a.employeeName} — avans`,
        sub: [bName(a.branchId), `${a.createdBy} yozdi ${a.time}`].filter(Boolean).join(" · "),
        amount: Number(a.amount),
        badge: s ? (over > 0 ? { tone: "danger", text: `${over.toLocaleString("ru-RU")} ko'p` } : { tone: "success", text: "hisoblangan doirasida" }) : null,
        at: `${a.date} ${a.time}`,
        detail: {
          employee: a.employeeName,
          role: a.role,
          branch: bName(a.branchId),
          note: a.note,
          createdBy: a.createdBy,
          date: a.date,
          time: a.time,
          salary: s,
          over,
          cashbox: box ? { name: String(box.name ?? ""), owner: String(box.moderator ?? ""), naqd: Number((box.methodTotals as Record<string, number>)?.naqd) || 0 } : null,
        },
      };
    }),
    ...prices.map((p) => ({
      key: `p:${p.id}`,
      kind: "narx" as const,
      id: Number(p.id),
      title: `${p.pupilName} — ${p.type === "chegirma" ? "chegirma" : p.type === "narx" ? "alohida narx" : p.type === "qarz" ? "qarz kechirish" : "dars haqi"}`,
      sub: [bName(p.branchId), p.basePrice && p.type !== "qarz" ? `${Number(p.basePrice).toLocaleString("ru-RU")} → ${(Number(p.basePrice) - Number(p.amount)).toLocaleString("ru-RU")}` : "", `${p.createdBy} ${String(p.createdAt ?? "").slice(11, 16)}`].filter(Boolean).join(" · "),
      amount: Number(p.amount),
      percent: p.percent ?? (p.basePrice ? Math.round((Number(p.amount) / Number(p.basePrice)) * 100) : null),
      badge: { tone: "neutral", text: "chegaradan katta" },
      at: String(p.createdAt ?? ""),
      detail: { pupil: p.pupilName, group: p.groupLabel, type: p.type, amount: p.amount, basePrice: p.basePrice, percent: p.percent, reason: p.reason, note: p.note, from: p.from, to: p.to, createdBy: p.createdBy, branch: bName(p.branchId) },
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const [advDone, priceDone] = settled;
  const resolved = [
    ...advDone.map((a) => ({
      kind: "avans",
      title: `${a.employeeName} — avans ${Number(a.approvedAmount ?? a.amount).toLocaleString("ru-RU")}`,
      sub: a.status === "rejected" ? `Rad etildi ${String(a.decidedAt).slice(11)} · «${a.decisionNote}»` : a.status === "given" ? `Tasdiqlandi ${String(a.decidedAt).slice(11)} · ${a.givenBy} berdi ${String(a.givenAt).slice(11)}` : `Tasdiqlandi ${String(a.decidedAt).slice(11)} · berilishi kutilmoqda`,
      result: a.status === "rejected" ? "rad etildi" : a.status === "given" ? "berildi" : "tasdiqlandi",
      at: String(a.givenAt || a.decidedAt),
    })),
    ...priceDone.map((p) => ({
      kind: "narx",
      title: `${p.pupilName} — ${p.type === "chegirma" ? "chegirma" : "alohida narx"}${p.percent ? ` ${p.percent}%` : ""}`,
      sub: `${p.status === "approved" ? "Tasdiqlandi" : "Rad etildi"} ${String(p.decidedAt).slice(11, 16)}${p.decisionNote ? ` · «${p.decisionNote}»` : ""}`,
      result: p.status === "approved" ? "tasdiqlandi" : "rad etildi",
      at: String(p.decidedAt),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    today,
    now: uzTimeHm(),
    items,
    counts: { all: items.length, avans: items.filter((i) => i.kind === "avans").length, narx: items.filter((i) => i.kind === "narx").length },
    resolved,
  };
}

// ─────────────────────────────── Umumiy ko'rinish ───────────────────────────────

export async function ownerOverview(db: Db) {
  const today = uzDateIso();
  const now = uzTimeHm();
  const month = today.slice(0, 7);
  const branches = await loadBranches(db);
  const allIds = branches.map((b) => b.id);
  const scope = { branchId: allIds[0] ?? 1, allowed: allIds, isAdmin: true } as unknown as BranchScope;

  const [boxes, handover, todayIn, revenue, approvals, pupils, groups, emps, orders, calls, att, ratings, overdueTasks] = await Promise.all([
    db.collection<Box>("cashboxes").find({ archived: { $ne: true } }, { projection: { _id: 0 } }).toArray(),
    loadDailyHandover(db, month),
    db.collection(COLL).find({ txType: "payIn", ...LIVE, date: today }, { projection: { _id: 0, amount: 1, paidAmount: 1, paymentMethodKey: 1, pupilId: 1, cashboxId: 1, time: 1 } }).toArray(),
    revenuePlan(db, scope, month, null).catch(() => null),
    ownerApprovals(db),
    db.collection("pupils").find({}, { projection: { _id: 0, id: 1, status: 1, branchId: 1 } }).toArray(),
    db.collection("groups").find({}, { projection: { _id: 0, id: 1, branchId: 1, capacity: 1, studentIds: 1, status: 1 } }).toArray(),
    db.collection("hr_employees").find({ $or: [{ archDate: { $in: ["", null] } }, { archDate: { $exists: false } }] }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1 } }).toArray(),
    db.collection("orders").find({ name: { $nin: ["", null] } }, { projection: { _id: 0, id: 1, holat: 1, groupId: 1, firstLessonStatus: 1, createdAt: 1, created: 1, branchId: 1 } }).toArray(),
    db.collection(LEAD_CALLS).distinct("target.id", { "target.type": "lead" }),
    db.collection("attendance").find({ date: { $gte: `${month}-01`, $lte: today } }, { projection: { _id: 0, status: 1, pupilId: 1, groupId: 1 } }).toArray(),
    db.collection("lesson_ratings").find({ date: { $gte: `${month}-01` } }, { projection: { _id: 0, branchId: 1, stars: 1 } }).toArray(),
    db.collection("staff_tasks").find({ status: "muddati_otdi" }, { projection: { _id: 0, branchId: 1 } }).toArray(),
  ]);

  // ── Pul ──
  const primary = boxes.find((b) => b.isPrimary) ?? null;
  const cards = handover.ok ? handover.cards : [];
  const outgoing = primary ? await outgoingFromPrimary(db, primary.id) : [];
  const outWaiting = outgoing.filter((o) => o.waiting);
  const inTransit = cards.filter((c) => c.pending).map((c) => ({ from: c.name, owner: c.moderator, amount: c.pending!.total, time: c.pending!.time, date: c.pending!.date }));
  const branchCash = cards.reduce((a, c) => a + c.total, 0);
  const transit = inTransit.reduce((a, x) => a + x.amount, 0) + outWaiting.reduce((a, x) => a + x.amount, 0);
  const primaryCash = primary ? sum(primary.methodTotals) - outWaiting.reduce((a, x) => a + x.amount, 0) : 0;
  const stale = cards.filter((c) => c.total > 0 && !c.pending && (!c.last || daysBetween(c.last.date, today) >= 2));

  // ── Bugungi tushum ──
  const pupilBranch = new Map(pupils.map((p) => [Number(p.id), Number(p.branchId) || null]));
  const boxBranch = new Map(boxes.map((b) => [b.id, Number(b.branchId) || null]));
  const paid = (e: Record<string, unknown>) => Math.abs(Number(e.paidAmount ?? e.amount) || 0);
  const byMethod: Record<string, number> = {};
  const byBranch: Record<number, number> = {};
  for (const e of todayIn) {
    const k = String(e.paymentMethodKey ?? "boshqa");
    byMethod[k] = (byMethod[k] ?? 0) + paid(e);
    const b = pupilBranch.get(Number(e.pupilId)) ?? boxBranch.get(Number(e.cashboxId)) ?? allIds[0];
    if (b) byBranch[b] = (byBranch[b] ?? 0) + paid(e);
  }
  const lastTime = todayIn.map((e) => String(e.time ?? "")).sort().pop() ?? "";

  // ── Filiallar taqqoslash ──
  const [y, mo] = month.split("-").map(Number);
  const daysIn = new Date(y, mo, 0).getDate();
  const day = Number(today.slice(8, 10));
  const calledSet = new Set(calls.map(Number));
  const pnlAll = await profitAndLoss(db, scope, month, null).catch(() => null);
  const rows = [];
  for (const b of branches) {
    const rb = revenue?.branches.find((x) => x.branchId === b.id);
    const pnl = branches.length > 1 ? await profitAndLoss(db, scope, month, b.id).catch(() => null) : pnlAll;
    const myPupils = pupils.filter((p) => (Number(p.branchId) || allIds[0]) === b.id);
    const active = myPupils.filter((p) => p.status === "Aktiv");
    const activeIds = new Set(active.map((p) => Number(p.id)));
    const myGroups = groups.filter((g) => Number(g.branchId) === b.id);
    const seats = myGroups.reduce((a, g) => a + (Number(g.capacity) || 0), 0);
    const inGroups = myGroups.reduce((a, g) => a + ((g.studentIds as number[]) ?? []).length, 0);
    const myOrders = orders.filter((o) => (Number(o.branchId) || allIds[0]) === b.id);
    const monthLeads = myOrders.filter((o) => createdMonth(o).startsWith(month));
    const firstPay = monthLeads.filter((o) => holatOf(o as unknown as HolatSource) === "guruh").length;
    const myAtt = att.filter((a) => activeIds.has(Number(a.pupilId)));
    const came = myAtt.filter((a) => cameStatus(a.status as AttendanceStatus)).length;
    const myRatings = ratings.filter((r) => Number(r.branchId) === b.id);
    const profit = pnl ? pnl.totals.profit[pnl.totals.profit.length - 1] ?? 0 : 0;
    // Prognoz: oy boshidan foyda / o'tgan kunlar × oy kunlari (sodda chiziqli).
    const forecast = day > 0 ? Math.round((profit / day) * daysIn) : profit;
    rows.push({
      id: b.id,
      name: b.name,
      groups: myGroups.length,
      staff: emps.filter((e) => ((e.branchIds as number[]) ?? []).map(Number).includes(b.id)).length,
      revenue: rb?.received ?? 0,
      plan: rb?.plan ?? 0,
      planPct: rb?.plan ? Math.round(((rb.received ?? 0) / rb.plan) * 100) : null,
      debtors: rb?.debtors ?? 0,
      debtorsPct: active.length ? Math.round(((rb?.debtors ?? 0) / active.length) * 1000) / 10 : 0,
      profit,
      forecast,
      leads: monthLeads.length,
      convPct: monthLeads.length ? Math.round((firstPay / monthLeads.length) * 100) : null,
      firstPay,
      active: active.length,
      fillPct: seats ? Math.round((inGroups / seats) * 100) : null,
      attendancePct: myAtt.length ? Math.round((came / myAtt.length) * 100) : null,
      rating: myRatings.length ? Math.round((myRatings.reduce((a, r) => a + (Number(r.stars) || 0), 0) / myRatings.length) * 10) / 10 : null,
      todayIncome: byBranch[b.id] ?? 0,
    });
  }

  // ── Xodimlar va nazorat · bugun ──
  const staffRows = [];
  for (const b of branches) {
    const [d, ac] = await Promise.all([
      staffDay(db, { buildingId: b.id, date: today, allowed: [b.id], isAdmin: true }).catch(() => null),
      attendanceOverview(db, { branchIds: [b.id], from: today, to: today, isAdmin: true }).catch(() => null),
    ]);
    const list = d && "rows" in d ? d.rows : [];
    const expected = list.filter((r) => r.expected || r.enter);
    const box = cards.find((c) => (boxBranch.get(c.cashboxId) ?? allIds[0]) === b.id);
    const owner = box ? list.find((r) => r.name.trim().toLowerCase() === box.moderator.trim().toLowerCase()) : null;
    const unanswered = orders.filter((o) => (Number(o.branchId) || allIds[0]) === b.id && holatOf(o as unknown as HolatSource) === "yangi" && !calledSet.has(Number(o.id)) && createdMonth(o) && daysBetween(createdMonth(o), today) >= 1).length;
    staffRows.push({
      id: b.id,
      name: b.name,
      staff: emps.filter((e) => ((e.branchIds as number[]) ?? []).map(Number).includes(b.id)).length,
      came: list.filter((r) => r.enter).length,
      expected: expected.length,
      late: list.filter((r) => r.state === "late").length,
      absent: list.filter((r) => r.state === "absent").map((r) => r.name),
      unmarked: ac?.unmarked.filter((u) => u.date === today).length ?? 0,
      unmarkedList: (ac?.unmarked ?? []).filter((u) => u.date === today).slice(0, 2).map((u) => `${u.label} (${u.time})`),
      overdueTasks: overdueTasks.filter((t) => Number(t.branchId) === b.id).length,
      unanswered,
      cash: box
        ? box.pending
          ? { tone: "info", text: "yo'lda" }
          : owner && owner.state === "absent"
            ? { tone: "danger", text: "mas'ul kelmagan" }
            : box.total > 0
              ? { tone: box.last && daysBetween(box.last.date, today) < 2 ? "neutral" : "warning", text: box.last ? `${daysBetween(box.last.date, today)} kun` : "topshirmagan" }
              : { tone: "success", text: "topshirilgan" }
        : null,
      cashOwnerAbsent: !!(owner && owner.state === "absent" && box && box.total > 0),
      cashOwner: box?.moderator ?? "",
      cashTotal: box?.total ?? 0,
    });
  }

  // ── E'tibor talab qiladi ──
  const alerts: { kind: string; title: string; sub: string; href: string; action?: string }[] = [];
  for (const r of rows) if (r.profit < 0) alerts.push({ kind: "loss", title: `${r.name} ${new Intl.DateTimeFormat("uz", { month: "long" }).format(new Date(y, mo - 1, 1))}da zararda: ${r.profit.toLocaleString("ru-RU")}`, sub: `tushum ${r.revenue.toLocaleString("ru-RU")} · guruhlar to'liqligi ${r.fillPct ?? "—"}%`, href: "/finance-planned" });
  for (const s of staffRows) if (s.cashOwnerAbsent) alerts.push({ kind: "staff", title: `${s.name} kassa mas'uli ishga kelmadi`, sub: `${s.cashOwner} · kassada ${s.cashTotal.toLocaleString("ru-RU")}`, href: "/nazorat-turnstile" });
  if (stale.length) alerts.push({ kind: "cash", title: `${stale.length} kassa topshirilmagan · ${stale.reduce((a, c) => a + c.total, 0).toLocaleString("ru-RU")}`, sub: stale.map((c) => `${c.name} — ${c.last ? `${daysBetween(c.last.date, today)} kun` : "hali topshirmagan"}`).join(", "), href: "/owner-transfers", action: "remind" });
  const unansweredAll = staffRows.reduce((a, s) => a + s.unanswered, 0);
  if (unansweredAll) alerts.push({ kind: "lead", title: `${unansweredAll} ta lid 24 soatdan beri javobsiz`, sub: staffRows.filter((s) => s.unanswered).map((s) => `${s.name} — ${s.unanswered}`).join(", "), href: "/orders-list" });

  const t = revenue?.totals;
  const profitTotal = pnlAll ? pnlAll.totals.profit[pnlAll.totals.profit.length - 1] ?? 0 : 0;
  const salaryFund = await db
    .collection(COLL)
    .aggregate([{ $match: { txType: "payOut", ...LIVE, date: { $gte: `${month}-01`, $lte: `${month}-31` }, txName: { $regex: "avans|oylik", $options: "i" } } }, { $group: { _id: { $cond: [{ $regexMatch: { input: "$txName", regex: "avans", options: "i" } }, "avans", "oylik"] }, s: { $sum: { $abs: "$amount" } } } }])
    .toArray();
  const totalCash = boxes.reduce((a, b) => a + sum(b.methodTotals), 0);
  return {
    today,
    now,
    month,
    monthPct: Math.round((day / daysIn) * 100),
    day,
    daysIn,
    branches,
    money: {
      total: totalCash,
      primary: primaryCash,
      branchCash,
      branchCount: cards.filter((c) => c.total > 0).length,
      staleNote: stale.map((c) => `${c.name} — ${c.last ? `${daysBetween(c.last.date, today)} kun` : "topshirmagan"}`).join(", "),
      transit,
      inTransit,
      outWaiting: outWaiting.length,
    },
    todayIncome: { total: Object.values(byMethod).reduce((a, v) => a + v, 0), count: todayIn.length, byMethod, byBranch: branches.map((b) => ({ id: b.id, name: b.name, sum: byBranch[b.id] ?? 0 })), lastTime },
    revenue: t ? { received: t.received, plan: t.plan, pct: t.plan ? Math.round((t.received / t.plan) * 100) : null, pending: t.pending, overdue: t.overdue, debtors: t.debtors, expectedToDate: t.expectedToDate } : null,
    compare: rows,
    approvals: { items: approvals.items.slice(0, 5), counts: approvals.counts },
    alerts,
    staff: staffRows,
    profit: {
      total: profitTotal,
      forecast: day > 0 ? Math.round((profitTotal / day) * daysIn) : profitTotal,
      planIncome: pnlAll?.totals.planIncome ?? null,
      planExpense: pnlAll?.totals.planExpense ?? null,
      branches: rows.map((r) => ({ id: r.id, name: r.name, profit: r.profit, forecast: r.forecast, pct: r.revenue ? Math.round((r.profit / r.revenue) * 100) : null })),
      salary: { avans: Number(salaryFund.find((s) => s._id === "avans")?.s ?? 0), oylik: Number(salaryFund.find((s) => s._id === "oylik")?.s ?? 0) },
      cashForecast: totalCash + (t?.pending ?? 0),
      cashForecastPlus: t?.pending ?? 0,
    },
  };
}

// ─────────────────────────────── Rahbar kassasi ───────────────────────────────

export async function ownerCash(db: Db, opts: { from: string; to: string; kind: string; method: string; page: number }) {
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [primary, handover, methods] = await Promise.all([
    db.collection<Box>("cashboxes").findOne({ isPrimary: true }, { projection: { _id: 0 } }),
    loadDailyHandover(db, month),
    db.collection("settings_payment_methods").find({}, { projection: { _id: 0, key: 1, name: 1 } }).toArray(),
  ]);
  if (!primary) return { ok: false as const, error: "Bosh kassa belgilanmagan" };
  const methodNames: Record<string, string> = Object.fromEntries(methods.filter((m) => m.key).map((m) => [String(m.key), String(m.name ?? m.key)]));
  const outgoing = await outgoingFromPrimary(db, primary.id);
  const outWaiting = outgoing.filter((o) => o.waiting).reduce((a, o) => a + o.amount, 0);
  const cards = handover.ok ? handover.cards : [];

  // Amallar jurnali (Rahbar kassasi).
  const match: Record<string, unknown> = { cashboxId: primary.id, status: { $ne: "cancelled" }, date: { $gte: opts.from, $lte: opts.to } };
  if (opts.method) match.paymentMethodKey = opts.method;
  const all = await db
    .collection(COLL)
    .find(match, { projection: { _id: 0, id: 1, txType: 1, transferRole: 1, transferId: 1, amount: 1, paidAmount: 1, date: 1, time: 1, txName: 1, category: 1, studentName: 1, note: 1, paymentMethodKey: 1, status: 1, pupilId: 1, internal: 1, kind: 1 } })
    .sort({ date: -1, time: -1, id: -1 })
    .toArray();
  const kindOf = (e: Record<string, unknown>) => {
    if (e.txType === "transfer") return e.transferId ? "kochirma" : "almashtirish";
    const cat = String(e.category ?? e.txName ?? "");
    if (/divid/i.test(cat)) return "dividend";
    if (/sarmoya|investits/i.test(cat)) return "sarmoya";
    return e.txType === "payIn" ? "kirim" : "chiqim";
  };
  // Ko'chirmaning ikkinchi tomoni — qaysi kassa.
  const tIds = all.filter((e) => e.txType === "transfer" && e.transferId).map((e) => Number(e.transferId));
  const others = tIds.length ? await db.collection(COLL).find({ transferId: { $in: tIds }, cashboxId: { $ne: primary.id } }, { projection: { _id: 0, transferId: 1, cashboxId: 1, cashboxName: 1 } }).toArray() : [];
  const boxNames = new Map((await db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray()).map((b) => [Number(b.id), String(b.name ?? "")]));
  const rows = all.map((e) => {
    const k = kindOf(e);
    const other = others.find((o) => Number(o.transferId) === Number(e.transferId));
    const otherName = other ? boxNames.get(Number(other.cashboxId)) ?? String(other.cashboxName ?? "") : "";
    const amount = Number(e.paidAmount ?? e.amount) || 0;
    return {
      id: Number(e.id),
      kind: k,
      title: k === "kochirma" ? `${amount < 0 ? "→" : "←"} ${otherName}` : k === "almashtirish" ? String(e.txName ?? "Almashtirish") : String(e.studentName || e.category || e.txName || (k === "kirim" ? "Kirim" : "Chiqim")),
      sub: k === "kochirma" ? (amount < 0 ? "Filialga berish" : "Ko'chirma qabul") : [k === "kirim" ? "Kirim" : k === "chiqim" ? "Chiqim" : k === "dividend" ? "Dividend" : k === "sarmoya" ? "Sarmoya" : "Almashtirish", e.category && e.studentName ? String(e.category) : "", String(e.note ?? "")].filter(Boolean).join(" · "),
      branch: otherName,
      amount,
      method: String(e.paymentMethodKey ?? ""),
      date: String(e.date ?? ""),
      time: String(e.time ?? ""),
      waiting: e.status === "waiting",
      pupilId: Number(e.pupilId) || null,
    };
  });
  const counts = { all: rows.length, kirim: 0, chiqim: 0, kochirma: 0, almashtirish: 0, dividend: 0, sarmoya: 0 } as Record<string, number>;
  for (const r of rows) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  const filtered = opts.kind && opts.kind !== "all" ? rows.filter((r) => r.kind === opts.kind || (opts.kind === "chiqim" && r.kind === "dividend") || (opts.kind === "kirim" && r.kind === "sarmoya")) : rows;
  const PAGE = 10;
  const year = today.slice(0, 4);
  const divRows = await db
    .collection(COLL)
    .find({ status: { $ne: "cancelled" }, date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }, $or: [{ category: { $regex: "divid|sarmoya|investits", $options: "i" } }, { txName: { $regex: "divid|sarmoya|investits", $options: "i" } }] }, { projection: { _id: 0, amount: 1, date: 1, category: 1, txName: 1, note: 1 } })
    .sort({ date: 1 })
    .toArray();
  const monthsUz = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const group = (re: RegExp) => {
    const list = divRows.filter((r) => re.test(String(r.category ?? r.txName ?? "")));
    const byM = new Map<string, number>();
    for (const r of list) byM.set(String(r.date).slice(0, 7), (byM.get(String(r.date).slice(0, 7)) ?? 0) + Math.abs(Number(r.amount) || 0));
    return { total: [...byM.values()].reduce((a, v) => a + v, 0), parts: [...byM.entries()].map(([m, v]) => `${monthsUz[Number(m.slice(5, 7)) - 1]} ${v.toLocaleString("ru-RU")}`), lastNote: String(list[list.length - 1]?.note ?? "") };
  };

  return {
    ok: true as const,
    today,
    primary: { id: primary.id, name: primary.name, owner: String(primary.moderator ?? ""), methods: primary.methodTotals ?? {}, total: sum(primary.methodTotals), outWaiting },
    methodNames,
    incoming: cards.filter((c) => c.pending).map((c) => ({ cashboxId: c.cashboxId, name: c.name, owner: c.moderator, amount: c.pending!.total, time: c.pending!.time, date: c.pending!.date })),
    branches: cards.map((c) => ({ cashboxId: c.cashboxId, name: c.name, owner: c.moderator, total: c.total, pending: c.pending?.total ?? 0, days: c.last ? daysBetween(c.last.date, today) : null })),
    outgoing: outgoing.filter((o) => o.waiting),
    dividend: group(/divid/i),
    sarmoya: group(/sarmoya|investits/i),
    counts,
    rows: filtered.slice(opts.page * PAGE, opts.page * PAGE + PAGE),
    total: filtered.length,
    page: opts.page,
    pageSize: PAGE,
  };
}

/** Dividend oynasi: tanlangan oyning sof foydasi va undan avval olingan dividend. */
export async function dividendRoom(db: Db, month: string) {
  const scope = { branchId: 1, allowed: [], isAdmin: true } as unknown as BranchScope;
  const pnl = await profitAndLoss(db, scope, month, null).catch(() => null);
  const profit = pnl ? pnl.totals.profit[pnl.totals.profit.length - 1] ?? 0 : 0;
  const taken = await db
    .collection(COLL)
    .aggregate([{ $match: { status: { $ne: "cancelled" }, $or: [{ category: { $regex: "divid", $options: "i" } }, { txName: { $regex: "divid", $options: "i" } }], note: { $regex: `\\[${month}\\]` } } }, { $group: { _id: null, s: { $sum: { $abs: "$amount" } } } }])
    .toArray();
  return { month, profit, taken: Number(taken[0]?.s ?? 0) };
}

// ─────────────────────────────── Ko'chirmalar ───────────────────────────────

export async function ownerTransfers(db: Db, month: string) {
  const today = uzDateIso();
  const [handover, primary] = await Promise.all([loadDailyHandover(db, month), db.collection<Box>("cashboxes").findOne({ isPrimary: true }, { projection: { _id: 0, id: 1 } })]);
  if (!handover.ok) return handover;
  const outgoing = primary ? await outgoingFromPrimary(db, primary.id, month) : [];
  const handovers = await db.collection("cash_handovers").find({ date: { $gte: `${month}-01`, $lte: `${month}-31` } }, { projection: { _id: 0 } }).toArray();
  const cards = handover.cards;
  const branchTotal = cards.reduce((a, c) => a + c.total, 0);
  const stale = cards.filter((c) => c.total > 0 && !c.pending && (!c.last || daysBetween(c.last.date, today) >= 2));
  return {
    ...handover,
    kpi: {
      transit: cards.filter((c) => c.pending).reduce((a, c) => a + c.pending!.total, 0),
      transitCount: cards.filter((c) => c.pending).length,
      transitFrom: cards.filter((c) => c.pending).map((c) => c.name).join(", "),
      branchTotal,
      branchCount: cards.filter((c) => c.total > 0).length,
      stale: stale.reduce((a, c) => a + c.total, 0),
      staleCount: stale.length,
      monthTotal: handover.records.reduce((a, r) => a + r.total, 0),
      monthCount: handover.records.length,
      monthDiff: handover.records.reduce((a, r) => a + r.diff, 0),
    },
    outgoing,
    handoverMeta: handovers.map((h) => ({ id: h.id, cashboxId: h.cashboxId, date: h.date, time: h.time, counted: h.counted, system: h.system, diff: h.diff, note: h.note })),
  };
}
