import type { Db } from "mongodb";
import type { CurrentUser } from "@/lib/auth";
import type { BranchScope } from "@/lib/branchScope";
import { expandBranchPools } from "@/lib/branchPools";
import { cameStatus, type AttendanceStatus } from "@/lib/attendance";
import { computeDebtors } from "@/lib/debtors";
import { HANDOVERS } from "@/lib/dailyHandover";
import { holatOf, type HolatSource } from "@/lib/leadHolat";
import { loadReferrals, REF_REQUESTS } from "@/lib/referrals";
import { salesPlan } from "@/lib/salesTargets";
import { staffDay } from "@/lib/staffAttendanceToday";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import { LEAD_CALLS } from "@/lib/frontDesk";

// MENEJER, IT VA XIZMAT XODIMI ISH STOLI (47-qism, rasmlar «Menejer · bosh sahifa», «Menejer · tasdiq kutmoqda»,
// «Menejer · sovg'a so'rovini tasdiqlash», «IT mutaxassisi · bosh sahifa», «Xizmat xodimi · bosh sahifa»).
// Kim — xodimning filial biriktiruvidagi ROL NOMI: «Menejer» → menejer, «IT …» → IT, «Xizmat …» → xizmat xodimi.
// Rahbar `?as=ISM&mode=manager|it|service` bilan ko'radi.
//
// Tasdiqlar — mavjud manbalardan: topshiriqlar (`staff_tasks`, «tasdiq kutilmoqda»), referal sovg'a so'rovlari
// (`ref_requests`, «pending»), alohida narx so'rovlari (`price_exceptions`, «pending» — faqat ko'rish, rahbarda).
// Topshiriq amallari mijozdan /api/staff-tasks/:id orqali (ruxsat o'sha yerda), sovg'a — /api/staff-desk (filial).

export type DeskMode = "manager" | "it" | "service";
export interface DeskWho {
  name: string;
  employeeId: number | null;
  userId: string;
  branchIds: number[];
  mode: DeskMode;
  preview: boolean;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400_000);

export function modeOfRole(name: string): DeskMode | null {
  if (/menejer|manager|boshqaruvchi/i.test(name)) return "manager";
  if (/(^|\s)it(\s|$)|it mutax|texnik/i.test(name)) return "it";
  if (/xizmat|farrosh|qorovul|oshpaz|tozalik/i.test(name)) return "service";
  return null;
}

export async function resolveDesk(db: Db, user: CurrentUser, as?: string | null, modeArg?: string | null): Promise<DeskWho | null> {
  const roles = await db.collection("roles").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  const emps = await db.collection("hr_employees").find({ $or: [{ archDate: { $in: ["", null] } }, { archDate: { $exists: false } }] }, { projection: { _id: 0, id: 1, name: 1, branchIds: 1, branchAssignments: 1 } }).toArray();
  const modeOf = (e: Record<string, unknown>): DeskMode | null => {
    for (const a of (e.branchAssignments as { roleId?: number | null }[]) ?? []) {
      const m = modeOfRole(String(roles.find((r) => Number(r.id) === Number(a.roleId))?.name ?? ""));
      if (m) return m;
    }
    return null;
  };
  const pick = (e: Record<string, unknown>, mode: DeskMode, preview: boolean): DeskWho => ({
    name: String(e.name ?? "").trim(),
    employeeId: Number(e.id),
    userId: user.id,
    branchIds: expandBranchPools(((e.branchIds as number[]) ?? []).map(Number).filter(Boolean).length ? (e.branchIds as number[]).map(Number) : [1]),
    mode,
    preview,
  });
  const forced = modeArg === "manager" || modeArg === "it" || modeArg === "service" ? (modeArg as DeskMode) : null;
  if (user.role === "admin") {
    const e = as ? emps.find((x) => norm(x.name) === norm(as)) : null;
    if (!e) return null;
    return pick(e, forced ?? modeOf(e) ?? "manager", true);
  }
  if (user.hrEmployeeId === null) return null;
  const e = emps.find((x) => Number(x.id) === user.hrEmployeeId);
  const m = e ? modeOf(e) : null;
  return e && m ? pick(e, m, false) : null;
}

const scopeOf = (who: DeskWho) => ({ branchId: who.branchIds[0] ?? 1, allowed: who.branchIds }) as BranchScope;
const branchName = async (db: Db, id: number) => String((await db.collection("branches").findOne({ id }, { projection: { _id: 0, name: 1 } }))?.name ?? "");

// ─────────────────────────────── Tasdiqlar ───────────────────────────────

export interface Approval {
  key: string;
  kind: "topshiriq" | "sovga" | "rahbarda";
  id: number;
  title: string;
  sub: string;
  time: string;
  /** Batafsil (o'ng panel). */
  detail: Record<string, unknown>;
}

export async function approvals(db: Db, who: DeskWho) {
  const today = uzDateIso();
  const dayStart = new Date(`${today}T00:00:00+05:00`).toISOString();
  const [tasks, refData, prices, recentTasks] = await Promise.all([
    db.collection("staff_tasks").find({ status: "tasdiq_kutilmoqda", $or: [{ branchId: { $in: who.branchIds } }, { "createdBy.userId": who.userId }] }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray(),
    loadReferrals(db, who.branchIds).catch(() => null),
    db.collection("price_exceptions").find({ status: "pending", branchId: { $in: who.branchIds } }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(),
    db
      .collection("staff_tasks")
      .find(
        { branchId: { $in: who.branchIds }, $or: [{ completedAt: { $gte: dayStart } }, { history: { $elemMatch: { kind: "returned", at: { $gte: dayStart } } } }] },
        { projection: { _id: 0, id: 1, title: 1, employeeName: 1, completedAt: 1, status: 1, history: 1 } },
      )
      .limit(20)
      .toArray(),
  ]);
  const lastEvent = (t: Record<string, unknown>, kind: string) => [...((t.history as { kind: string; at: string; text?: string }[]) ?? (t.events as { kind: string; at: string; text?: string }[]) ?? [])].reverse().find((e) => e.kind === kind);
  const hm = (iso: string) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? new Date(d.getTime() + 5 * 3600_000).toISOString().slice(11, 16) : "";
  };
  const items: Approval[] = [];
  for (const t of tasks) {
    const done = lastEvent(t, "done");
    items.push({
      key: `t:${t.id}`,
      kind: "topshiriq",
      id: Number(t.id),
      title: String(t.title ?? ""),
      sub: [String(t.employeeName ?? ""), done ? `Bajardim ${hm(done.at)}` : "", t.deadline ? `muddat ${hm(String(t.deadline))}` : ""].filter(Boolean).join(" · "),
      time: done ? hm(done.at) : hm(String(t.updatedAt ?? t.createdAt ?? "")),
      detail: {
        employee: String(t.employeeName ?? ""),
        deadline: String(t.deadline ?? ""),
        priority: Number(t.priority) || 0,
        fine: Number(t.fineAmount) || 0,
        doneNote: String(t.doneNote ?? done?.text ?? ""),
        resultLink: String(t.resultLink ?? ""),
        createdBy: String((t.createdBy as { name?: string })?.name ?? t.createdByName ?? ""),
        createdAt: String(t.createdAt ?? ""),
        isLate: !!t.isLate,
        desc: String(t.desc ?? ""),
      },
    });
  }
  for (const q of refData?.requests.filter((r) => r.status === "pending") ?? []) {
    const ref = refData!.referrers.find((r) => r.id === q.referrerId);
    const gift = refData!.gifts.find((g) => g.id === q.giftId);
    items.push({
      key: `g:${q.id}`,
      kind: "sovga",
      id: q.id,
      title: q.giftName,
      sub: [q.referrerName, `${q.price} referal`, `balans ${q.balance} → ${q.balance - q.price}`].join(" · "),
      time: String(q.createdAt ?? "").slice(11, 16),
      detail: { referrer: q.referrerName, kind: q.referrerKind, note: ref?.note ?? "", price: q.price, balance: q.balance, invited: ref?.invited ?? 0, counted: ref?.counted ?? 0, stock: gift?.stock ?? 0, phone: ref?.phone ?? "" },
    });
  }
  for (const p of prices) {
    items.push({
      key: `p:${p.id}`,
      kind: "rahbarda",
      id: Number(p.id),
      title: `${p.pupilName} — ${p.type === "chegirma" ? `chegirma ${p.percent ?? ""}%` : String(p.type)}`,
      sub: [`${String(p.createdBy ?? "")} so'radi`, "direktor tasdiqlaydi"].join(" · "),
      time: String(p.createdAt ?? "").slice(11, 16),
      detail: { pupil: p.pupilName, group: p.groupLabel, amount: p.amount, basePrice: p.basePrice, percent: p.percent, reason: p.reason, note: p.note, from: p.from, to: p.to, createdBy: p.createdBy },
    });
  }
  items.sort((a, b) => b.time.localeCompare(a.time));
  const decidedGifts = (refData?.requests ?? []).filter((q) => q.status !== "pending" && String(q.decidedAt ?? "").startsWith(today));
  return {
    today,
    now: uzTimeHm(),
    who,
    branch: await branchName(db, who.branchIds[0]),
    items,
    counts: { all: items.length, topshiriq: items.filter((i) => i.kind === "topshiriq").length, sovga: items.filter((i) => i.kind === "sovga").length, rahbarda: items.filter((i) => i.kind === "rahbarda").length },
    resolved: [
      ...recentTasks.flatMap((t) => {
        const ret = lastEvent(t, "returned");
        const out: { kind: string; time: string; title: string; sub: string; result: string }[] = [];
        if (t.status === "yakunlandi" && String(t.completedAt ?? "") >= dayStart) out.push({ kind: "topshiriq", time: hm(String(t.completedAt)), title: String(t.title ?? ""), sub: String(t.employeeName ?? ""), result: "Tasdiqlandi" });
        if (ret && String(ret.at) >= dayStart) out.push({ kind: "topshiriq", time: hm(ret.at), title: String(t.title ?? ""), sub: String(t.employeeName ?? ""), result: "Qaytarildi" });
        return out;
      }),
      ...decidedGifts.map((q) => ({ kind: "sovga", time: String(q.decidedAt ?? "").slice(11, 16), title: q.giftName, sub: q.referrerName, result: q.status === "approved" ? "Tasdiqlandi" : "Rad etildi" })),
    ].sort((a, b) => b.time.localeCompare(a.time)),
  };
}

// ─────────────────────────────── Menejer bosh sahifasi ───────────────────────────────

export async function managerHome(db: Db, who: DeskWho) {
  const today = uzDateIso();
  const now = uzTimeHm();
  const month = today.slice(0, 7);
  const scope = scopeOf(who);
  const [rev, plan, att, debt, ap, day, cashboxes, leads, calls] = await Promise.all([
    db.collection("transaction_entries").aggregate([{ $match: { txType: "payIn", status: { $ne: "cancelled" }, date: { $gte: `${month}-01`, $lte: `${month}-31` }, branchId: { $in: who.branchIds } } }, { $group: { _id: null, s: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray(),
    salesPlan(db, scope, who.branchIds, month).catch(() => null),
    db.collection("attendance").find({ date: { $gte: `${month}-01`, $lte: today } }, { projection: { _id: 0, status: 1, pupilId: 1 } }).toArray(),
    computeDebtors(db, scope, today).catch(() => null),
    approvals(db, who),
    staffDay(db, { buildingId: who.branchIds[0] ?? 1, date: today, allowed: who.branchIds, isAdmin: false }).catch(() => null),
    db.collection("cashboxes").find({ archived: { $ne: true }, isPrimary: { $ne: true }, branchId: { $in: who.branchIds } }, { projection: { _id: 0, id: 1, name: 1, moderator: 1, balance: 1, methodTotals: 1 } }).toArray(),
    db.collection("orders").find({ branchId: { $in: who.branchIds }, name: { $nin: ["", null] } }, { projection: { _id: 0, id: 1, holat: 1, groupId: 1, firstLessonStatus: 1, createdAt: 1, created: 1, moderator: 1 } }).toArray(),
    db.collection(LEAD_CALLS).distinct("target.id", { "target.type": "lead" }),
  ]);
  const pupilsInBranch = new Set((await db.collection("pupils").find({ branchId: { $in: who.branchIds } }, { projection: { _id: 0, id: 1 } }).toArray()).map((p) => Number(p.id)));
  const myAtt = att.filter((a) => pupilsInBranch.has(Number(a.pupilId)));
  const came = myAtt.filter((a) => cameStatus(a.status as AttendanceStatus)).length;
  const debtors = (debt?.rows ?? []).filter((r) => r.debt > 0);

  // Kassalar: oxirgi topshiruvdan beri kun.
  const handovers = cashboxes.length ? await db.collection(HANDOVERS).aggregate([{ $match: { cashboxId: { $in: cashboxes.map((c) => Number(c.id)) } } }, { $group: { _id: "$cashboxId", last: { $max: "$date" } } }]).toArray() : [];
  const cash = cashboxes.map((c) => {
    const last = handovers.find((h) => Number(h._id) === Number(c.id))?.last as string | undefined;
    return { id: Number(c.id), name: String(c.name ?? ""), owner: String(c.moderator ?? ""), balance: Number(c.balance) || 0, mine: norm(c.moderator) === norm(who.name), days: last ? daysBetween(last, today) : null, methods: Object.keys((c.methodTotals as Record<string, number>) ?? {}).filter((k) => Number((c.methodTotals as Record<string, number>)[k])) };
  });

  // Liddan o'quvchigacha (shu oy).
  const created = (o: Record<string, unknown>) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(o.createdAt ?? o.created ?? ""));
    return m ? `${m[3]}-${m[2]}` : "";
  };
  const monthLeads = leads.filter((o) => created(o) === month);
  const holat = (o: Record<string, unknown>) => holatOf(o as unknown as HolatSource);
  const funnel = {
    leads: monthLeads.length,
    booked: monthLeads.filter((o) => ["sinov", "guruh"].includes(holat(o))).length,
    came: monthLeads.filter((o) => ["KELDI", "GURUHGA_QOSHILDI"].includes(String(o.firstLessonStatus)) || holat(o) === "guruh").length,
    paid: monthLeads.filter((o) => holat(o) === "guruh").length,
  };
  const calledSet = new Set(calls.map(Number));
  const stale = leads.filter((o) => holat(o) === "yangi" && !calledSet.has(Number(o.id)) && (() => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(o.createdAt ?? o.created ?? ""));
    return m ? daysBetween(`${m[3]}-${m[2]}-${m[1]}`, today) >= 1 : false;
  })());
  const old = debtors.filter((r) => (r.unpaid?.count ?? 0) >= 2);

  const rows = day && "rows" in day ? day.rows : [];
  const [y, mo] = month.split("-").map(Number);
  return {
    today,
    now,
    who,
    branch: await branchName(db, who.branchIds[0]),
    kpi: {
      revenue: Number(rev[0]?.s ?? 0),
      payments: Number(rev[0]?.n ?? 0),
      newDone: plan?.total.done ?? 0,
      newTarget: plan?.total.target ?? 0,
      attendancePct: myAtt.length ? Math.round((came / myAtt.length) * 100) : null,
      activePupils: pupilsInBranch.size,
      debtors: debtors.length,
      debt: debtors.reduce((a, r) => a + r.debt, 0),
      monthPct: Math.round((Number(today.slice(8, 10)) / new Date(y, mo, 0).getDate()) * 100),
    },
    approvals: { items: ap.items.slice(0, 6), counts: ap.counts },
    staff: {
      rows: rows.map((r) => ({ employeeId: r.employeeId, name: r.name, role: r.role, expected: r.expected, why: r.expectedWhy, enter: r.enter, exit: r.exit, late: r.lateMinutes, state: r.state })),
      came: rows.filter((r) => r.enter).length,
      late: rows.filter((r) => r.state === "late").length,
      left: rows.filter((r) => r.exit).length,
    },
    plan: plan ? { total: plan.total, rows: plan.rows.map((r) => ({ admin: r.admin, target: r.target, done: r.done, leads: r.leads, convPct: r.convPct, forecast: r.forecast, behind: r.behind, me: norm(r.admin) === norm(who.name) })), day: plan.day, days: plan.days } : null,
    funnel,
    cash,
    alerts: [
      ...(stale.length ? [{ kind: "lead", title: `${stale.length} ta lid 24 soatdan beri javobsiz`, sub: "Lidlar → qo'ng'iroq navbati", href: "/orders-list" }] : []),
      ...(old.length ? [{ kind: "debt", title: `${old.length} kishi 2+ oydan beri qarzdor`, sub: old.slice(0, 2).map((r) => `${r.name} — ${Math.round(r.debt).toLocaleString("ru-RU")}`).join(" · "), href: "/reports-unpaid" }] : []),
      ...(rows.filter((r) => r.state === "absent").length ? [{ kind: "staff", title: `${rows.filter((r) => r.state === "absent").length} xodim hali kelmadi`, sub: rows.filter((r) => r.state === "absent").slice(0, 3).map((r) => r.name).join(", "), href: "/nazorat-turnstile" }] : []),
    ],
  };
}

// ─────────────────────────────── IT va xizmat xodimi ───────────────────────────────

export async function workerHome(db: Db, who: DeskWho) {
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [keldim, tasks, emp, paid] = await Promise.all([
    who.employeeId !== null ? db.collection("turnstile_io").findOne({ date: today, employeeId: who.employeeId, personType: "employee" }, { projection: { _id: 0, enterTime: 1, exitTime: 1, status: 1, lateMinutes: 1, source: 1 } }) : null,
    who.employeeId !== null
      ? db.collection("staff_tasks").find({ employeeId: who.employeeId, status: { $in: ["yangi", "qaytarildi", "muddati_otdi", "tasdiq_kutilmoqda"] } }, { projection: { _id: 0, id: 1, title: 1, desc: 1, deadline: 1, priority: 1, status: 1, createdByName: 1, createdBy: 1 } }).sort({ deadline: 1 }).toArray()
      : [],
    who.employeeId !== null ? db.collection("hr_employees").findOne({ id: who.employeeId }, { projection: { _id: 0, branchAssignments: 1 } }) : null,
    db.collection("transaction_entries").find({ txType: "payOut", status: { $ne: "cancelled" }, date: { $gte: `${month}-01`, $lte: `${month}-31` }, txName: { $regex: "avans|oylik", $options: "i" } }, { projection: { _id: 0, studentName: 1, amount: 1 } }).toArray(),
  ]);
  const assigns = ((emp?.branchAssignments as { salary?: number; scheduleId?: number }[]) ?? []);
  const oklad = assigns.reduce((a, x) => a + (Number(x.salary) || 0), 0);
  const scheduleId = assigns.find((a) => a.scheduleId)?.scheduleId ?? null;
  const schedule = scheduleId ? await db.collection("work_schedules").findOne({ id: Number(scheduleId) }, { projection: { _id: 0 } }) : null;
  const [y, m] = month.split("-").map(Number);
  const daysIn = new Date(y, m, 0).getDate();
  const workDays = (schedule?.days as number[]) ?? [1, 2, 3, 4, 5, 6];
  let planned = 0;
  let passed = 0;
  for (let d = 1; d <= daysIn; d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
    if (!workDays.includes(wd)) continue;
    planned++;
    if (iso <= today) passed++;
  }
  const earned = planned ? Math.round((oklad * passed) / planned) : 0;
  const taken = paid.filter((p) => norm(p.studentName) === norm(who.name)).reduce((a, p) => a + Math.abs(Number(p.amount) || 0), 0);

  // Bu hafta (dushanbadan): kunlar va ish vaqti.
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const mon = addDays(today, -dow);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
    return { date: d, work: workDays.includes(wd), start: String(schedule?.start ?? ""), end: String(schedule?.end ?? "") };
  });

  // IT: tizim holati.
  let system: null | { key: string; title: string; sub: string; ok: boolean; badge: string }[] = null;
  if (who.mode === "it") {
    const [lastSync, sms, qr, users, apps] = await Promise.all([
      db.collection("sync_runs").find({}, { projection: { _id: 0, at: 1, finishedAt: 1, startedAt: 1, status: 1 } }).sort({ _id: -1 }).limit(1).toArray(),
      db.collection("settings_sms_devices").find({}, { projection: { _id: 0, name: 1, lastSeen: 1, status: 1 } }).toArray(),
      db.collection("turnstile_io").countDocuments({ date: today }),
      db.collection("users").find({}, { projection: { _id: 0, fullName: 1, lastLoginAt: 1, lastSeenAt: 1 } }).toArray(),
      db.collection("staff_app_devices").countDocuments({}).catch(() => 0),
    ]);
    const s = lastSync[0];
    const syncAt = String(s?.finishedAt ?? s?.at ?? s?.startedAt ?? "");
    const offline = sms.filter((d) => {
      const ls = Date.parse(String(d.lastSeen ?? ""));
      return !Number.isFinite(ls) || Date.now() - ls > 3 * 3600_000;
    });
    const stale = users.filter((u) => {
      const t = Date.parse(String(u.lastLoginAt ?? u.lastSeenAt ?? ""));
      return !Number.isFinite(t) || Date.now() - t > 3 * 86400_000;
    });
    system = [
      { key: "sync", title: "Google Sheets sinxroni", sub: syncAt ? `oxirgi: ${syncAt.slice(0, 16).replace("T", " ")}` : "hali ishga tushmagan", ok: !!syncAt, badge: syncAt ? "Ishlayapti" : "Sozlanmagan" },
      { key: "sms", title: `SMS qurilmalar · ${sms.length}`, sub: offline.length ? `${offline.length} tasi 3 soatdan beri aloqasiz` : sms.length ? "hammasi aloqada" : "qurilma ulanmagan", ok: sms.length > 0 && offline.length === 0, badge: sms.length === 0 ? "Yo'q" : offline.length ? "Oflayn" : "Ishlayapti" },
      { key: "qr", title: "QR kiosk va turniket", sub: `bugun ${qr} ta qayd`, ok: qr > 0, badge: qr > 0 ? "Ishlayapti" : "Qayd yo'q" },
      { key: "app", title: "Xodim ilovasi", sub: `${apps} qurilma ulangan`, ok: apps > 0, badge: `${apps} ta` },
      { key: "login", title: "Loginlar", sub: `${stale.length} hisob 3 kun ichida kirmadi`, ok: stale.length === 0, badge: `${stale.length} ta` },
    ];
  }

  return {
    today,
    now: uzTimeHm(),
    who,
    branch: await branchName(db, who.branchIds[0]),
    keldim: keldim ? { time: String(keldim.enterTime ?? ""), exit: String(keldim.exitTime ?? ""), late: Number(keldim.lateMinutes) > 0, source: String(keldim.source ?? "") } : null,
    schedule: schedule ? { name: String(schedule.name ?? ""), start: String(schedule.start ?? ""), end: String(schedule.end ?? "") } : null,
    tasks: (tasks as Record<string, unknown>[]).map((t) => ({ id: Number(t.id), title: String(t.title ?? ""), desc: String(t.desc ?? ""), deadline: String(t.deadline ?? ""), leftMin: Number.isFinite(Date.parse(String(t.deadline ?? ""))) ? Math.round((Date.parse(String(t.deadline)) - Date.now()) / 60000) : null, priority: Number(t.priority) || 0, status: String(t.status ?? ""), by: String((t.createdBy as { name?: string })?.name ?? t.createdByName ?? "") })),
    week,
    salary: oklad ? { month, oklad, planned, passed, earned, taken, left: earned - taken } : null,
    system,
  };
}

// ─────────────────────────────── Sovg'a so'rovi qarori ───────────────────────────────

export async function decideGift(db: Db, who: DeskWho, id: number, approve: boolean, comment: string) {
  const q = await db.collection(REF_REQUESTS).findOne({ id, status: "pending" }, { projection: { _id: 0, referrerId: 1 } });
  if (!q) return { ok: false as const, error: "So'rov topilmadi" };
  const { decideRequest } = await import("@/lib/referrals");
  const r = await decideRequest(db, who.branchIds, who.name, id, approve, comment);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}
