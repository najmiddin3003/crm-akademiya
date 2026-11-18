import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { monthlyPriceFor, type PricedCourse } from "@/lib/coursePrice";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { groupWeekdays } from "@/lib/attendance";
import { lessonsPerMonthFor } from "@/lib/debtorsTypes";
import { pupilFullName } from "@/lib/pupilsData";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";
import { approvalLimits } from "@/lib/discountRules";
import {
  EXCEPTION_LABELS,
  EXCEPTION_TYPES,
  type ExceptionRow,
  type ExceptionType,
  type ExceptionsReport,
  type PriceException,
} from "@/lib/priceExceptionTypes";

// CHEGIRMA VA ISTISNOLAR (35-qism, rasmlar «Chegirma va istisnolar», «Qarzni kechirish so'rovi»).
//
// `price_exceptions` — kurs narxidan kam olinadigan har bir holat: CHEGIRMA (oyiga foiz yoki summa), ALOHIDA NARX
// (oyiga kelishilgan narx), KECHIRILGAN QARZ (bir marta) va DARS HAQI (sababli qoldirilgan darslar, bir marta).
// Sabab va kim ruxsat bergani majburiy. Imtiyoz guruh narxining 30% idan yoki 200 000 so'mdan katta bo'lsa —
// direktor (admin) tasdig'isiz kuchga kirmaydi; admin yozgani darhol tasdiqlanadi.
//
// QARZGA TA'SIRI: tasdiqlangan imtiyoz qarzdorlar hisobida TO'LANGAN qatoriga qo'shiladi (`exceptionCredits`,
// lib/debtors.ts) — tanga chegirmasi kabi: markaz kechgan qism qarz bo'lib qolmaydi. Oylik imtiyoz har oy
// boshida (shu oy hisob sanasidan oldin bo'lsa) qo'shiladi.
// Tanga evaziga to'lov chegirmasi (gamifikatsiya, `tuition_discounts`) hisobotda ham ko'rinadi — u to'lov
// yozuvining o'zida turadi, bu yerga yozilmaydi.

export const PRICE_EXCEPTIONS = "price_exceptions";
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const stamp = () => `${uzDateIso()}T${uzTimeHm()}`;
const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7))) + 1;
}

/** Imtiyozning [from, to] kunlari ichidagi ta'siri (so'm). */
export function exceptionEffect(e: PriceException, from: string | null, to: string): number {
  if (e.status !== "approved") return 0;
  if (!e.monthly) return e.from <= to && (!from || e.from >= from) ? e.amount : 0;
  const start = e.from.slice(0, 7);
  const last = [e.to ?? "9999-12", to.slice(0, 7)].sort()[0];
  const first = from ? [start, from.slice(0, 7)].sort().reverse()[0] : start;
  return last >= first ? e.amount * monthsBetween(first, last) : 0;
}

/** Qarzdorlar hisobi uchun: o'quvchi → tasdiqlangan imtiyozlar ta'siri ([from, to]). */
export async function exceptionCredits(db: Db, pupilIds: number[], from: string | null, to: string): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!pupilIds.length) return out;
  const docs = (await db.collection(PRICE_EXCEPTIONS).find({ pupilId: { $in: pupilIds }, status: "approved" }, { projection: { _id: 0 } }).toArray()) as unknown as PriceException[];
  for (const e of docs) {
    const v = exceptionEffect(e, from, to);
    if (v) out.set(e.pupilId, (out.get(e.pupilId) ?? 0) + v);
  }
  return out;
}

export interface ExceptionPrefill {
  ok: true;
  pupil: { id: number; name: string; branchId: number };
  groups: { id: number; label: string; price: number | null; lessonPrice: number | null }[];
}

export async function exceptionPrefill(db: Db, allowed: number[], pupilId: number): Promise<ExceptionPrefill | Fail> {
  const p = await db.collection("pupils").findOne({ $and: [{ id: pupilId }, branchInCondition(allowed)] }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, branchId: 1 } });
  if (!p) return fail("O'quvchi topilmadi", 404);
  const mem = await db.collection(GROUP_MEMBERSHIPS).find({ pupilId }, { projection: { _id: 0, groupId: 1, leftAt: 1 } }).sort({ joinedAt: -1 }).toArray();
  const groups = await db.collection("groups").find({ id: { $in: mem.map((m) => Number(m.groupId)) } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, branchId: 1, day: 1 } }).toArray();
  const courses = (await db.collection("offline_courses").find({}, { projection: { _id: 0 } }).toArray()) as unknown as PricedCourse[];
  return {
    ok: true,
    pupil: { id: Number(p.id), name: pupilFullName(p as never), branchId: Number(p.branchId) || 1 },
    groups: groups.map((g) => {
      const price = monthlyPriceFor(g as never, courses);
      return { id: Number(g.id), label: groupLabel(g as never), price, lessonPrice: price ? Math.round(price / lessonsPerMonthFor(groupWeekdays(String(g.day ?? "")).length)) : null };
    }),
  };
}

export async function createException(db: Db, allowed: number[], who: { name: string; isAdmin: boolean }, b: Record<string, unknown>): Promise<{ ok: true; exception: PriceException } | Fail> {
  const type = EXCEPTION_TYPES.includes(b.type as ExceptionType) ? (b.type as ExceptionType) : null;
  if (!type) return fail("Turini tanlang");
  const pre = await exceptionPrefill(db, allowed, Number(b.pupilId));
  if (!pre.ok) return pre;
  const g = pre.groups.find((x) => x.id === Number(b.groupId)) ?? null;
  const reason = String(b.reason ?? "").trim();
  if (!reason) return fail("Sababini yozing");
  const today = uzDateIso();
  let amount = 0;
  let percent: number | null = null;
  let lessons: number | null = null;
  const base = g?.price ?? null;
  if (type === "chegirma") {
    percent = Number(b.percent) || null;
    amount = percent && base ? Math.round((base * percent) / 100) : Math.round(Number(b.amount) || 0);
  } else if (type === "narx") {
    const price = Math.round(Number(b.price) || 0);
    if (!base) return fail("Guruh narxi noma'lum — avval guruhni tanlang");
    if (!(price > 0 && price < base)) return fail("Alohida narx guruh narxidan kam bo'lsin");
    amount = base - price;
    percent = Math.round((amount / base) * 100);
  } else if (type === "dars") {
    lessons = Math.floor(Number(b.lessons) || 0);
    if (!g?.lessonPrice || !lessons) return fail("Guruh va darslar sonini kiriting");
    amount = lessons * g.lessonPrice;
  } else amount = Math.round(Number(b.amount) || 0);
  if (!(amount > 0)) return fail("Summani kiriting");
  const monthly = type === "chegirma" || type === "narx";
  const from = monthly ? (/^\d{4}-\d{2}$/.test(String(b.from)) ? String(b.from) : today.slice(0, 7)) : today;
  const to = monthly && /^\d{4}-\d{2}$/.test(String(b.to ?? "")) ? String(b.to) : null;
  // Chegara — Sozlamalar → Chegirmalar → «Admin chegarasi» (lib/discountRules.ts, 39-qism).
  const lim = await approvalLimits(db);
  const big = amount >= lim.sum || (base ? (amount / base) * 100 >= lim.percent : false);
  const last = await db.collection(PRICE_EXCEPTIONS).find({}).sort({ id: -1 }).limit(1).toArray();
  const e: PriceException = {
    id: (Number(last[0]?.id) || 0) + 1,
    type,
    pupilId: pre.pupil.id,
    pupilName: pre.pupil.name,
    groupId: g?.id ?? null,
    groupLabel: g?.label ?? "",
    branchId: pre.pupil.branchId,
    monthly,
    amount,
    basePrice: base,
    percent,
    lessons,
    from,
    to,
    reason: reason.slice(0, 120),
    note: String(b.note ?? "").trim().slice(0, 300),
    status: big && !who.isAdmin ? "pending" : "approved",
    createdAt: stamp(),
    createdBy: who.name,
    decidedAt: big && !who.isAdmin ? null : stamp(),
    decidedBy: big && !who.isAdmin ? "" : who.name,
    decisionNote: "",
  };
  await db.collection(PRICE_EXCEPTIONS).insertOne({ ...e });
  return { ok: true, exception: e };
}

export async function decideException(db: Db, allowed: number[], who: { name: string; isAdmin: boolean }, id: number, approve: boolean, note: string): Promise<{ ok: true } | Fail> {
  if (!who.isAdmin) return fail("Katta imtiyozni faqat direktor tasdiqlaydi", 403);
  const q = { $and: [{ id, status: "pending" }, branchInCondition(allowed)] };
  const e = await db.collection(PRICE_EXCEPTIONS).findOne(q);
  if (!e) return fail("So'rov topilmadi", 404);
  if (!approve && !note.trim()) return fail("Rad etish sababini yozing");
  await db.collection(PRICE_EXCEPTIONS).updateOne(q, { $set: { status: approve ? "approved" : "rejected", decidedAt: stamp(), decidedBy: who.name, decisionNote: note.trim().slice(0, 300) } });
  return { ok: true };
}

// ─────────────────────────────── Hisobot ───────────────────────────────

export async function computeExceptions(db: Db, branchIds: number[], month: string, who: { isAdmin: boolean }, givenBy?: string): Promise<ExceptionsReport> {
  const mFrom = `${month}-01`;
  const mTo = `${month}-31`;
  const branches = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  const bName = (id: number) => String(branches.find((b) => Number(b.id) === id)?.name ?? "");
  const all = (await db.collection(PRICE_EXCEPTIONS).find(branchInCondition(branchIds), { projection: { _id: 0 } }).sort({ id: -1 }).toArray()) as unknown as PriceException[];
  const relevant = all.filter((e) => {
    if (e.status === "pending") return true;
    if (e.monthly) return e.from <= month && (!e.to || e.to >= month);
    return e.from.slice(0, 7) === month || e.createdAt.slice(0, 7) === month;
  });
  const lim = await approvalLimits(db);
  const rows: ExceptionRow[] = relevant.map((e) => {
    const eff = e.status === "approved" ? exceptionEffect(e, mFrom, mTo) : e.status === "pending" ? e.amount : 0;
    const big = e.amount >= lim.sum || (e.basePrice ? (e.amount / e.basePrice) * 100 >= lim.percent : false);
    let status: ExceptionRow["status"];
    let statusLabel: string;
    if (e.status === "pending") [status, statusLabel] = ["pending", "Tasdiq kutmoqda"];
    else if (e.status === "rejected") [status, statusLabel] = ["rejected", "Rad etilgan"];
    else if (!e.monthly) [status, statusLabel] = e.type === "dars" ? ["done", "Hisobdan chiqarildi"] : ["approved", "Tasdiqlangan"];
    else if (e.to) [status, statusLabel] = ["active", "Faol"];
    else [status, statusLabel] = ["open", "Muddat qo'yilmagan"];
    const amountLabel = e.monthly
      ? e.type === "narx" && e.basePrice
        ? `oyiga · ${nf(e.basePrice)} → ${nf(e.basePrice - e.amount)}`
        : `oyiga${e.percent ? ` · ${e.percent}%` : ""}`
      : e.type === "dars" && e.lessons
        ? `bir marta · ${e.lessons} dars`
        : "bir marta";
    return {
      key: `x${e.id}`,
      id: e.id,
      type: e.type,
      pupilName: e.pupilName,
      groupLabel: e.groupLabel,
      branch: bName(e.branchId),
      monthAmount: eff,
      amountLabel,
      reason: e.reason,
      reasonSub: e.note,
      who: e.createdBy,
      at: e.createdAt,
      status,
      statusLabel,
      until: e.monthly ? e.to : null,
      needsApproval: big,
    };
  });

  // Tanga evaziga to'lov chegirmasi (gamifikatsiya).
  const coins = await db
    .collection("tuition_discounts")
    .find({ $and: [{ month, status: { $in: ["active", "applied"] } }, branchInCondition(branchIds)] }, { projection: { _id: 0 } })
    .toArray();
  if (coins.length) {
    const pupils = await db.collection("pupils").find({ id: { $in: coins.map((c) => Number(c.pupilId)) } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } }).toArray();
    for (const c of coins) {
      const p = pupils.find((x) => Number(x.id) === Number(c.pupilId));
      rows.push({
        key: `c${c.id}`,
        id: null,
        type: "chegirma",
        pupilName: p ? pupilFullName(p as never) : `#${c.pupilId}`,
        groupLabel: String(c.groupLabel ?? ""),
        branch: bName(Number(c.branchId)),
        monthAmount: Number(c.appliedAmountSom ?? c.amountSom) || 0,
        amountLabel: `bir oy · ${c.percent}%`,
        reason: "Tanga evaziga chegirma",
        reasonSub: "Gamifikatsiya do'koni",
        who: String(c.createdByName ?? "O'quvchi"),
        at: String(c.createdAt ?? "").slice(0, 16),
        status: "coin",
        statusLabel: c.status === "applied" ? "To'lovga qo'llandi" : "Kutilmoqda",
        until: null,
        needsApproval: false,
      });
    }
  }

  const shown = givenBy ? rows.filter((r) => r.who === givenBy) : rows;
  const counted = shown.filter((r) => r.status !== "pending" && r.status !== "rejected");
  const kpi = Object.fromEntries(
    EXCEPTION_TYPES.map((t) => {
      const rs = counted.filter((r) => r.type === t);
      return [t, { sum: rs.reduce((a, r) => a + r.monthAmount, 0), pupils: new Set(rs.map((r) => r.pupilName)).size, count: rs.length }];
    }),
  ) as ExceptionsReport["kpi"];
  const total = EXCEPTION_TYPES.reduce((a, t) => a + kpi[t].sum, 0);
  const boxes = await db.collection("cashboxes").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1 } }).toArray();
  const [rev] = await db
    .collection("transaction_entries")
    .aggregate([{ $match: { txType: "payIn", status: { $nin: ["cancelled", "waiting"] }, date: { $gte: mFrom, $lte: mTo }, cashboxId: { $in: boxes.map((b) => Number(b.id)) } } }, { $group: { _id: null, s: { $sum: "$amount" } } }])
    .toArray();
  const giverMap = new Map<string, { who: string; count: number; sum: number; branches: Set<string> }>();
  for (const r of rows.filter((x) => x.status !== "coin" && x.status !== "rejected")) {
    const g = giverMap.get(r.who) ?? { who: r.who, count: 0, sum: 0, branches: new Set<string>() };
    g.count += 1;
    g.sum += r.monthAmount;
    g.branches.add(r.branch);
    giverMap.set(r.who, g);
  }
  const givers = [...giverMap.values()].map((g) => ({ who: g.who, count: g.count, sum: g.sum, branch: g.branches.size > 1 ? "barcha" : [...g.branches][0] ?? "" })).sort((a, b) => b.sum - a.sum);
  return {
    ok: true,
    month,
    rows: shown.sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || b.at.localeCompare(a.at)),
    kpi,
    total,
    revenue: Number(rev?.s ?? 0),
    pending: all
      .filter((e) => e.status === "pending")
      .map((e) => ({ ...e, branch: bName(e.branchId), givenBy: { count: giverMap.get(e.createdBy)?.count ?? 0, sum: giverMap.get(e.createdBy)?.sum ?? 0 } })),
    givers,
    canApprove: who.isAdmin,
    limits: lim,
  };
}

export const exceptionTypeLabel = (t: ExceptionType) => EXCEPTION_LABELS[t];
