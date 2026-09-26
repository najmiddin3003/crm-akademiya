import type { Db, Document } from "mongodb";
import { branchCondition, getBranchScope } from "@/lib/branchScope";
import { groupLabel, type Group } from "@/lib/groups";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { attendanceEditDenial, daysBetween, gamAttOf, isAbsentAtt, streakRun } from "./attendance";
import { badgeBoard } from "./badges";
import { GAM } from "./db";
import { reasonsForRole } from "./lesson";
import { groupRanking, monthRange, pupilName } from "./ranking";
import { listReasons, systemReasonMap } from "./reasons";
import { cancelDenial, canReturnOrder } from "./rights";
import { branchNames, groupInActorScope, toGamGroup, type GamGroup } from "./scope";
import { loadSettings } from "./settings";
import { levelIndexOf } from "./rules";
import { txLabel, type CoinTransaction } from "./types";
import { GamError, isFrozenStatus } from "./wallet";

// GAMIFIKATSIYA → O'QUVCHILAR va O'QUVCHI PROFILI (TZ 5.3, 5.4, 4.21).
//
// Ro'yxatda kimlar: xodim ko'ra oladigan faol guruhlarning a'zolari
// (navbardagi filial ichida) va — admin/direktorga — hamyoni bor, lekin
// hozir guruhda bo'lmagan o'quvchilar (masalan ketgan, balansi saqlangan).
// Ko'rish doirasi (TZ 3): direktor — hamma; filial admini — o'z filiali;
// ustoz — o'z guruhlari.

export type Toifa = "kids" | "older";

/** Sinf (1–11) — `pupils.grade`; bo'lmasa null (katta). */
export function gradeOf(p: { grade?: unknown } | Document): number | null {
  const g = Number(p.grade);
  return Number.isInteger(g) && g >= 1 && g <= 11 ? g : null;
}

/**
 * Toifa (TZ 4.21.4): sinf ≤ kidsMaxGrade — kichik, aks holda katta; sinf
 * ko'rsatilmagan — katta. Sinf bo'lmasa O'QUVCHI KATEGORIYASIDAN taxmin
 * qilinadi, faqat oraliqning HAMMASI kichiklarga tushsa ("1-4- sinflar",
 * "Kichik (1-4-sinf)"); "5-8" kabi aralash oraliq — katta.
 */
export function toifaOf(grade: number | null, category: unknown, kidsMaxGrade: number): Toifa {
  if (grade !== null) return grade <= kidsMaxGrade ? "kids" : "older";
  const c = String(category ?? "").toLowerCase();
  const m = c.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return Number(m[2]) <= kidsMaxGrade ? "kids" : "older";
  return /kichik/.test(c) ? "kids" : "older";
}

const PUPIL_FIELDS = { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1, grade: 1, category: 1 } as const;

interface PupilDoc {
  id: number;
  firstName?: string;
  lastName?: string;
  status?: string;
  branchId?: number | null;
  grade?: number | null;
  category?: string;
}

const branchOf = (p: { branchId?: unknown } | Document) =>
  Number.isFinite(Number(p.branchId)) && p.branchId !== null && p.branchId !== undefined ? Number(p.branchId) : 1;

/** Faol guruhlar (navbar filiali ichida, xodim doirasida) — ro'yxat va profil uchun. */
async function scopedActiveGroups(db: Db, actor: GamActor): Promise<GamGroup[]> {
  const scope = await getBranchScope();
  const where = { status: "active" };
  const rows = await db
    .collection("groups")
    .find(scope ? { $and: [where, branchCondition(scope)] } : where, {
      projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 },
    })
    .toArray();
  return rows.map((r) => toGamGroup(r as unknown as Group)).filter((g) => groupInActorScope(actor, g));
}

/**
 * O'quvchi shu xodimga ko'rinadimi (TZ 3): direktor — ha; filial admini —
 * o'quvchi o'z filialida yoki uning filiali guruhida; ustoz — o'z guruhida.
 */
export async function canSeePupil(db: Db, actor: GamActor, p: { id: number; branchId?: unknown }): Promise<boolean> {
  if (actor.role === "director") return true;
  if (actor.role === "branch_admin" && actor.branchIds.includes(branchOf(p))) return true;
  const groups = await db
    .collection("groups")
    .find({ studentIds: p.id }, { projection: { _id: 0, teacher: 1, branchId: 1 } })
    .toArray();
  return groups.some((g) => groupInActorScope(actor, { teacher: String(g.teacher ?? ""), branchId: branchOf(g) }));
}

export interface StudentRow {
  pupilId: number;
  name: string;
  grade: number | null;
  toifa: Toifa;
  branchName: string;
  groups: string[];
  levelPosition: number;
  levelName: string;
  balance: number;
  frozen: boolean;
}

export async function listStudents(db: Db, actor: GamActor): Promise<StudentRow[]> {
  const [settings, groups, names] = await Promise.all([loadSettings(db), scopedActiveGroups(db, actor), branchNames(db)]);
  const groupsOf = new Map<number, string[]>();
  for (const g of groups) for (const id of g.studentIds) groupsOf.set(id, [...(groupsOf.get(id) ?? []), g.label]);
  const ids = new Set(groupsOf.keys());

  // Hamyoni bor, guruhda yo'q o'quvchilar (ketganlar ham) — admin/direktorga.
  if (actor.role !== "teacher") {
    const scope = await getBranchScope();
    const walletIds = (await db.collection(GAM.wallets).distinct("pupilId")).map(Number);
    if (walletIds.length) {
      const extra = await db
        .collection("pupils")
        .find(
          { $and: [{ id: { $in: walletIds.filter((x) => !ids.has(x)) } }, ...(scope ? [pupilBranch(scope.branchId)] : [])] },
          { projection: { _id: 0, id: 1, branchId: 1 } },
        )
        .toArray();
      for (const p of extra) if (actor.role === "director" || actor.branchIds.includes(branchOf(p))) ids.add(Number(p.id));
    }
  }

  const list = [...ids];
  const [pupils, wallets] = await Promise.all([
    db.collection("pupils").find({ id: { $in: list } }, { projection: PUPIL_FIELDS }).toArray() as unknown as Promise<PupilDoc[]>,
    db.collection(GAM.wallets).find({ pupilId: { $in: list } }, { projection: { _id: 0, pupilId: 1, balance: 1, earnedTotal: 1 } }).toArray(),
  ]);
  const w = new Map(wallets.map((x) => [Number(x.pupilId), x]));
  const rows = pupils.map((p): StudentRow => {
    const wallet = w.get(p.id);
    const earned = Number(wallet?.earnedTotal) || 0;
    const li = levelIndexOf(earned, settings.levels);
    const grade = gradeOf(p);
    return {
      pupilId: p.id,
      name: pupilName(p),
      grade,
      toifa: toifaOf(grade, p.category, settings.kidsMaxGrade),
      branchName: names.get(branchOf(p)) ?? "",
      groups: groupsOf.get(p.id) ?? [],
      levelPosition: li + 1,
      levelName: settings.levels[li]?.name ?? "",
      balance: Number(wallet?.balance) || 0,
      frozen: isFrozenStatus(p.status),
    };
  });
  // Muzlatilganlar oxirida (TZ 5.3), qolganlari balans bo'yicha.
  return rows.sort((a, b) => Number(a.frozen) - Number(b.frozen) || b.balance - a.balance || a.name.localeCompare(b.name, "uz"));
}

/** O'quvchi filiali sharti (lib/branchScope.ts → pupilBranchCondition bilan bir xil ma'no). */
function pupilBranch(branchId: number) {
  return branchId === 1
    ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }
    : { branchId };
}

// ── Profil ─────────────────────────────────────────────────────────────

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

async function loadPupilDoc(db: Db, pupilId: number): Promise<PupilDoc> {
  const p = (await db.collection("pupils").findOne({ id: pupilId }, { projection: PUPIL_FIELDS })) as unknown as PupilDoc | null;
  if (!p) throw new GamError(404, "O'quvchi topilmadi");
  return p;
}

export async function studentProfile(db: Db, actor: GamActor, pupilId: number) {
  const p = await loadPupilDoc(db, pupilId);
  if (!(await canSeePupil(db, actor, p))) throw new GamError(404, "O'quvchi topilmadi");
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [settings, names, wallet, sys, allReasons, groupDocs] = await Promise.all([
    loadSettings(db),
    branchNames(db),
    db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1, earnedTotal: 1 } }),
    systemReasonMap(db),
    listReasons(db),
    db
      .collection("groups")
      .find({ studentIds: pupilId, status: "active" }, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 } })
      .toArray(),
  ]);
  const frozen = isFrozenStatus(p.status);
  const grade = gradeOf(p);
  const earned = Number(wallet?.earnedTotal) || 0;
  const li = levelIndexOf(earned, settings.levels);
  const groups = groupDocs.map((g) => toGamGroup(g as unknown as Group)).sort((a, b) => a.label.localeCompare(b.label, "uz"));

  const [marks, exams, todayTx] = await Promise.all([
    db
      .collection("attendance")
      .find(
        { pupilId, groupId: { $in: groups.map((g) => g.id) }, ...(settings.startDate ? { date: { $gte: settings.startDate } } : { date: today }) },
        { projection: { _id: 0, groupId: 1, date: 1, status: 1 } },
      )
      .sort({ date: 1 })
      .toArray(),
    db
      .collection("group_exams")
      .find({ groupId: { $in: groups.map((g) => g.id) }, month: { $in: [prevMonth(month), month] } }, { projection: { _id: 0, id: 1, groupId: 1, month: 1, students: 1 } })
      .sort({ id: 1 })
      .toArray(),
    db.collection(GAM.tx).find({ pupilId, date: today, status: "active" }, { projection: { _id: 0 } }).toArray() as unknown as Promise<CoinTransaction[]>,
  ]);

  const pct = (groupId: number, m: string): number | null => {
    let v: number | null = null;
    for (const e of exams) {
      if (Number(e.groupId) !== groupId || e.month !== m) continue;
      const s = (e.students as { pupilId: number; pct: number }[] | undefined)?.find((x) => Number(x.pupilId) === pupilId);
      if (s && Number.isFinite(Number(s.pct))) v = Math.floor(Number(s.pct));
    }
    return v;
  };

  const groupRows = [];
  for (const g of groups) {
    const rk = await groupRanking(db, g, month);
    const me = rk.find((r) => r.pupilId === pupilId);
    const gm = marks.filter((m) => Number(m.groupId) === g.id).map((m) => ({ date: String(m.date), status: String(m.status) }));
    const run = settings.startDate ? streakRun(gm, settings.streakLessons).run : 0;
    const todayAtt = gamAttOf(gm.find((m) => m.date === today)?.status);
    groupRows.push({
      id: g.id,
      label: g.label,
      points: me?.points ?? 0,
      rank: me?.rank ?? null,
      total: rk.length,
      streak: { run, next: settings.streakLessons - (run % settings.streakLessons) },
      exam: { prev: pct(g.id, prevMonth(month)), cur: pct(g.id, month) },
      absentToday: isAbsentAtt(todayAtt),
    });
  }
  const best = [...groupRows].sort((a, b) => b.streak.run - a.streak.run)[0] ?? null;

  const inBranch = actor.role === "director" || (actor.role === "branch_admin" && actor.branchIds.includes(branchOf(p)));
  const on = settings.enabled && !!settings.startDate;
  const reasons = reasonsForRole(allReasons, actor.role).map((r) => ({
    id: r.id,
    name: r.name,
    direction: r.direction,
    amountMin: r.amountMin ?? 1,
    amountMax: r.amountMax ?? r.amountMin ?? 1,
    perDayLimit: r.perDayLimit,
    noteRequired: r.noteRequired || r.direction < 0,
  }));
  const reasonUse: Record<number, number> = {};
  for (const t of todayTx) if (t.type === "reason" && t.reasonId !== null) reasonUse[t.reasonId] = (reasonUse[t.reasonId] ?? 0) + 1;
  const deducted = -todayTx
    .filter((t) => t.amount < 0 && (t.type === "homework_missed" || t.type === "reason"))
    .reduce((a, t) => a + t.amount, 0);

  return {
    enabled: on,
    role: actor.role,
    today,
    month,
    pupil: {
      id: p.id,
      name: pupilName(p),
      grade,
      toifa: toifaOf(grade, p.category, settings.kidsMaxGrade),
      branchName: names.get(branchOf(p)) ?? "",
      frozen,
    },
    wallet: { balance: Number(wallet?.balance) || 0, earnedTotal: earned },
    levels: settings.levels,
    levelIndex: li,
    streakOn: sys.get("streak")?.isActive === true,
    streakBonus: settings.streakBonusCoins,
    bestStreak: best ? { run: best.streak.run, next: best.streak.next, group: best.label } : null,
    groups: groupRows,
    actions: {
      reason: on && inBranch && !frozen && reasons.length > 0,
      referral: on && inBranch && !frozen && sys.get("referral")?.isActive === true,
    },
    referralBonus: settings.referralBonusCoins,
    badges: await badgeBoard(db, pupilId, settings.levels),
    reasons,
    reasonUse,
    deducted,
    dailyLimit: settings.dailyDeductionLimit,
    objectionDays: settings.objectionDays,
  };
}

// ── Tanga tarixi (TZ 5.4) ──────────────────────────────────────────────

export type HistoryFilter = "all" | "month" | "plus" | "minus" | "shop" | "cancelled";
export const HISTORY_FILTERS: HistoryFilter[] = ["all", "month", "plus", "minus", "shop", "cancelled"];

export interface HistoryRow {
  id: number;
  date: string;
  type: string;
  label: string;
  note: string;
  groupId: number | null;
  groupLabel: string | null;
  amount: number;
  applied: number;
  status: "active" | "cancelled";
  cancelNote: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  createdByName: string;
  /** Qator amali (huquqqa qarab, TZ 5.4). */
  action: "cancel" | "excuse" | "unexcuse" | "expired" | "return" | null;
  /** Xarid qatori — «Qaytarish» oynasi uchun. */
  order: { id: number; itemName: string; priceCoins: number; givenDate: string; kind: "item" | "service" | "discount" } | null;
}

const PAGE = 12;

export async function studentHistory(
  db: Db,
  actor: GamActor,
  pupilId: number,
  filter: HistoryFilter,
  offset: number,
): Promise<{ rows: HistoryRow[]; total: number }> {
  const p = await loadPupilDoc(db, pupilId);
  if (!(await canSeePupil(db, actor, p))) throw new GamError(404, "O'quvchi topilmadi");
  const settings = await loadSettings(db);
  const today = uzDateIso();
  const q: Record<string, unknown> = { pupilId };
  if (filter === "month") q.date = monthRange(today.slice(0, 7));
  if (filter === "plus") Object.assign(q, { amount: { $gt: 0 }, type: { $ne: "shop" } });
  if (filter === "minus") Object.assign(q, { amount: { $lt: 0 }, type: { $ne: "shop" } });
  if (filter === "shop") q.type = "shop";
  if (filter === "cancelled") q.status = "cancelled";

  const col = db.collection(GAM.tx);
  const [total, docs, wallet] = await Promise.all([
    col.countDocuments(q),
    col.find(q, { projection: { _id: 0 } }).sort({ date: -1, id: -1 }).skip(Math.max(0, offset)).limit(PAGE).toArray() as unknown as Promise<CoinTransaction[]>,
    db.collection(GAM.wallets).findOne({ pupilId }, { projection: { _id: 0, balance: 1 } }),
  ]);
  const balance = Number(wallet?.balance) || 0;
  const frozen = isFrozenStatus(p.status);

  // Guruh nomlari va davomat qatorlari uchun joriy holat.
  const groupIds = [...new Set(docs.map((t) => t.groupId).filter((x): x is number => x !== null))];
  const gdocs = groupIds.length
    ? await db.collection("groups").find({ id: { $in: groupIds } }, { projection: { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1 } }).toArray()
    : [];
  const gById = new Map(gdocs.map((g) => [Number(g.id), g]));
  const attKeys = docs.filter((t) => (t.type === "attendance" || t.type === "absence") && t.groupId !== null);
  const marks = attKeys.length
    ? await db
        .collection("attendance")
        .find({ pupilId, $or: attKeys.map((t) => ({ groupId: t.groupId, date: t.date })) }, { projection: { _id: 0, groupId: 1, date: 1, status: 1 } })
        .toArray()
    : [];
  const markOf = (g: number, d: string) => marks.find((m) => Number(m.groupId) === g && m.date === d)?.status as string | undefined;
  // «Sababsizga qaytarish» faqat shu darsning ENG OXIRGI davomat yozuvida.
  const latest = new Map<string, number>();
  if (attKeys.length) {
    const all = await col
      .find({ pupilId, type: { $in: ["attendance", "absence"] }, $or: attKeys.map((t) => ({ groupId: t.groupId, date: t.date })) }, { projection: { _id: 0, id: 1, groupId: 1, date: 1 } })
      .toArray();
    for (const t of all) {
      const k = `${t.groupId}|${t.date}`;
      latest.set(k, Math.max(latest.get(k) ?? 0, Number(t.id)));
    }
  }

  // Xaridlar: yozuv → buyurtma (qaytarish huquqi buyurtmadan, TZ 4.15).
  const shopTx = docs.filter((t) => t.type === "shop").map((t) => t.id);
  const orders = shopTx.length
    ? await db.collection(GAM.shopOrders).find({ transactionId: { $in: shopTx } }, { projection: { _id: 0 } }).toArray()
    : [];
  const orderByTx = new Map(orders.map((o) => [Number(o.transactionId), o]));
  const discIds = orders.map((o) => o.discountId).filter((x) => x !== null && x !== undefined).map(Number);
  const discStatus = new Map(
    (discIds.length ? await db.collection(GAM.discounts).find({ id: { $in: discIds } }, { projection: { _id: 0, id: 1, status: 1 } }).toArray() : []).map((d) => [
      Number(d.id),
      String(d.status),
    ]),
  );

  const rows = docs.map((t): HistoryRow => {
    const g = t.groupId !== null ? gById.get(t.groupId) : undefined;
    const o = t.type === "shop" ? orderByTx.get(t.id) : undefined;
    let action: HistoryRow["action"] = null;
    if (o && settings.enabled) {
      const disc = o.discountId !== null && o.discountId !== undefined ? Number(o.discountId) : null;
      const ok = canReturnOrder(
        actor,
        { status: String(o.status), discountId: disc, branchId: Number(o.branchId), givenDate: String(o.givenDate) },
        today,
        disc !== null ? discStatus.get(disc) ?? null : null,
      );
      if (ok) action = "return";
    }
    if ((t.type === "attendance" || t.type === "absence") && t.groupId !== null && g) {
      if (!frozen && settings.enabled) {
        const st = markOf(t.groupId, t.date);
        const gg = { teacher: String(g.teacher ?? ""), branchId: branchOf(g) };
        const may = attendanceEditDenial(actor, gg, t.date, settings, today) === null && groupInActorScope(actor, gg);
        if (!may) {
          if (actor.role === "branch_admin" && t.status === "active" && t.type === "absence" && st === "sababsiz") action = "expired";
        } else if (t.status === "active" && t.type === "absence" && st === "sababsiz") {
          action = "excuse";
        } else if (t.status === "cancelled" && t.type === "absence" && st === "sababli" && latest.get(`${t.groupId}|${t.date}`) === t.id) {
          action = "unexcuse";
        }
      }
    } else if (t.type !== "shop" && t.status === "active" && settings.enabled) {
      const deny = cancelDenial(actor, t, { balance, pupilBranchId: branchOf(p), frozen, settings }, today);
      // Tanga sarflangan bo'lsa ham tugma turadi: oyna admin/ustozga sababini
      // yozadi va amalni o'chiq qoldiradi, direktorga farqni kechirishni
      // ko'rsatadi (TZ 4.11.4).
      if (!deny || deny.kind === "spent") action = "cancel";
      else if (
        actor.role === "branch_admin" &&
        actor.branchIds.includes(branchOf(p)) &&
        t.amount < 0 &&
        (t.type === "homework_missed" || t.type === "reason") &&
        daysBetween(t.date, today) > settings.objectionDays
      ) {
        action = "expired";
      }
    }
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      label: txLabel(t),
      note: t.note,
      groupId: t.groupId,
      groupLabel: g ? groupLabel(g as unknown as Group) : null,
      amount: t.amount,
      applied: t.applied,
      status: t.status,
      cancelNote: t.cancelNote ?? null,
      cancelledByName: t.cancelledByName ?? null,
      cancelledAt: t.cancelledAt ? uzDateIso(new Date(t.cancelledAt)) : null,
      createdByName: t.createdByName,
      action,
      order: o ? { id: Number(o.id), itemName: String(o.itemName), priceCoins: Number(o.priceCoins), givenDate: String(o.givenDate), kind: o.kind } : null,
    };
  });
  return { rows, total };
}


// ── O'quvchi kartasidagi «Coin tarixi» tabi ────────────────────────────
// CRM o'quvchi profili (/student-edit/:id) dagi jadval: har yozuv bilan
// «avvalgi / yangi balans» — yozuv YARATILGAN paytdagi hamyon holati.
// Balans voqealardan qayta tiklanadi: yaratilish (+applied, createdAt) va
// bekor qilinish (+reversed, cancelledAt) vaqt tartibida.

export interface LedgerRow {
  id: number;
  createdByName: string;
  label: string;
  type: string;
  amount: number;
  applied: number;
  before: number;
  after: number;
  createdAt: string;
  note: string;
  status: "active" | "cancelled";
  cancelNote: string | null;
}

export async function coinLedger(db: Db, actor: GamActor, pupilId: number): Promise<LedgerRow[]> {
  const p = await loadPupilDoc(db, pupilId);
  if (!(await canSeePupil(db, actor, p))) throw new GamError(404, "O'quvchi topilmadi");
  const txs = (await db.collection(GAM.tx).find({ pupilId }, { projection: { _id: 0 } }).toArray()) as unknown as CoinTransaction[];
  const events: { at: string; order: number; delta: number; txId: number | null }[] = [];
  for (const t of txs) {
    events.push({ at: t.createdAt, order: 0, delta: t.applied, txId: t.id });
    if (t.status === "cancelled" && t.cancelledAt) events.push({ at: t.cancelledAt, order: 1, delta: Number(t.reversed) || 0, txId: null });
  }
  events.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order || (a.txId ?? 0) - (b.txId ?? 0));
  const before = new Map<number, number>();
  let bal = 0;
  for (const e of events) {
    if (e.txId !== null) before.set(e.txId, bal);
    bal += e.delta;
  }
  return txs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    .map((t) => ({
      id: t.id,
      createdByName: t.createdByName,
      label: txLabel(t),
      type: t.type,
      amount: t.amount,
      applied: t.applied,
      before: before.get(t.id) ?? 0,
      after: (before.get(t.id) ?? 0) + t.applied,
      createdAt: t.createdAt,
      note: t.note,
      status: t.status,
      cancelNote: t.cancelNote ?? null,
    }));
}
