import type { Db } from "mongodb";
import { toUz, uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import {
  activeLessonTxs,
  attendanceEditDenial,
  gamActiveFor,
  gamAttOf,
  isAbsentAtt,
  onAttendanceChanged,
  streakRun,
  toTxActor,
  type GamAtt,
} from "./attendance";
import { GAM, withLock } from "./db";
import { getReason, listReasons, systemReasonMap } from "./reasons";
import { cancelDenial } from "./rights";
import { actorGroup, actorGroups, branchNames, isOwnGroup, type GamGroup } from "./scope";
import { loadSettings } from "./settings";
import type { CoinReason, CoinTransaction, GamSettings, GamRole } from "./types";
import { GamError, isFrozenStatus, withWallet, type LevelUp, type WalletSession } from "./wallet";

// «TANGA BERISH» — DARS JURNALI (TZ 5.1, 4.5.4–4.5.7, 4.7, 4.9, 4.10).
//
// Belgilar faqat BUGUNGI dars uchun (Asia/Tashkent) va faqat davomat
// saqlangandan keyin. Uy vazifasi va faollikni ustoz (o'z guruhi) va
// direktor qo'yadi; filial admini — faqat «Sababli» va o'ziga ruxsat
// etilgan sabablar. Hamma tekshiruv SHU YERDA (serverda) — UI faqat
// natijani ko'rsatadi.

export interface OpResult {
  txId: number | null;
  amount: number;
  applied: number;
  balance: number;
  levelUp: LevelUp | null;
}

function requireOn(settings: GamSettings): void {
  if (!settings.enabled || !settings.startDate) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
}

async function loadGroupFor(db: Db, actor: GamActor, groupId: number, pupilId: number): Promise<GamGroup> {
  const g = await actorGroup(db, actor, groupId);
  if (!g) throw new GamError(404, "Guruh topilmadi");
  if (!g.studentIds.includes(pupilId)) throw new GamError(422, "O'quvchi bu guruhda emas");
  return g;
}

/** Uy vazifasi va faollik: ustoz (o'z guruhi) yoki direktor (TZ 3). */
function requireTeach(actor: GamActor, g: GamGroup): void {
  if (actor.role === "director" || isOwnGroup(actor, g)) return;
  throw new GamError(403, "Uy vazifasi va faollikni guruh ustozi yoki direktor belgilaydi");
}

async function todayAtt(db: Db, groupId: number, pupilId: number, date: string): Promise<GamAtt | null> {
  const m = await db.collection("attendance").findOne({ groupId, pupilId, date }, { projection: { _id: 0, status: 1 } });
  return gamAttOf(m?.status as string | undefined);
}

/** Bugun qo'lda ayirilgan jami (TZ 4.10): faol ✗ va ayiriladigan sabablar, |amount| — applied emas. */
async function deductedToday(db: Db, pupilId: number, date: string): Promise<number> {
  const [r] = await db
    .collection(GAM.tx)
    .aggregate<{ s: number }>([
      { $match: { pupilId, date, status: "active", amount: { $lt: 0 }, type: { $in: ["homework_missed", "reason"] } } },
      { $group: { _id: null, s: { $sum: "$amount" } } },
    ])
    .toArray();
  return -(r?.s ?? 0);
}

function limitError(name: string, used: number, limit: number): GamError {
  const left = Math.max(0, limit - used);
  return left > 0
    ? new GamError(422, `Kunlik ayirish limiti: ${name} dan bugun yana ${left} tangagacha ayirish mumkin`)
    : new GamError(422, `Bugungi ayirish limiti tugagan (${used}/${limit})`);
}

function result(tx: CoinTransaction | null, w: WalletSession): Omit<OpResult, "levelUp"> {
  return { txId: tx?.id ?? null, amount: tx?.amount ?? 0, applied: tx?.applied ?? 0, balance: w.balance };
}

// ── Uy vazifasi (TZ 4.7.2) ─────────────────────────────────────────────

export type HomeworkValue = "done" | "missed" | "clear";

export async function setHomework(
  db: Db,
  actor: GamActor,
  input: { groupId: number; pupilId: number; value: HomeworkValue; undoOf?: number | null },
): Promise<OpResult & { removed: "done" | "missed" | null; prev: "done" | "missed" | null }> {
  const settings = await loadSettings(db);
  requireOn(settings);
  const today = uzDateIso();
  const g = await loadGroupFor(db, actor, input.groupId, input.pupilId);
  requireTeach(actor, g);
  const reasons = await systemReasonMap(db);
  const code = input.value === "done" ? "homework_done" : input.value === "missed" ? "homework_missed" : null;
  if (code && !reasons.get(code)?.isActive) throw new GamError(422, "Bu tizim sababi to'xtatilgan");

  const att = await todayAtt(db, g.id, input.pupilId, today);
  if (!att) throw new GamError(422, "Avval davomatni saqlang");
  if (isAbsentAtt(att)) throw new GamError(422, "Darsda yo'q o'quvchiga uy vazifasi belgisi qo'yilmaydi");

  const { result: r, levelUp } = await withWallet(db, input.pupilId, async (w) => {
    if (w.pupil.frozen) throw new GamError(422, "Ketgan o'quvchiga tanga yozilmaydi");
    const txActor = toTxActor(actor);
    const forgive = actor.role === "director";
    const lesson = await activeLessonTxs(db, w.pupil.id, g.id, today);
    const cur = lesson.find((t) => t.type === "homework_done" || t.type === "homework_missed") ?? null;
    const prev: "done" | "missed" | null = cur ? (cur.amount > 0 ? "done" : "missed") : null;

    if (cur) {
      const deny = cancelDenial(actor, cur, { balance: w.balance, pupilBranchId: w.pupil.branchId, frozen: w.pupil.frozen, settings }, today);
      if (deny?.kind === "spent") throw new GamError(403, "O'quvchi bu tangalarni sarflagan — belgini direktor o'zgartiradi");
      if (deny) {
        const by = cur.createdByName;
        throw new GamError(403, `Bu belgini ${by} qo'ygan — uni o'zi (shu kuni) yoki direktor o'zgartiradi`);
      }
    }

    // Aynan shu tugma qayta bosildi (yoki «clear») — belgi olib tashlanadi.
    if (input.value === "clear" || input.value === prev) {
      if (cur) await w.cancel(cur, "Belgi olib tashlandi", txActor, forgive);
      return { ...result(null, w), removed: prev, prev };
    }

    const amount = input.value === "done" ? settings.homeworkDoneCoins : -settings.homeworkMissedPenalty;
    if (amount < 0) {
      const used = await deductedToday(db, w.pupil.id, today);
      if (used - amount > settings.dailyDeductionLimit) throw limitError(w.pupil.name, used, settings.dailyDeductionLimit);
    }
    if (cur) await w.cancel(cur, "Belgi o'zgartirildi", txActor, forgive);
    const reason = reasons.get(code!)!;
    const tx = await w.add({
      groupId: g.id,
      date: today,
      type: code!,
      reasonId: reason.id,
      reasonName: reason.name,
      amount,
      note: input.value === "done" ? "Bajardi" : "Bajarmadi",
      actor: txActor,
      uniqKey: `hw:${g.id}:${w.pupil.id}:${today}`,
    });
    return { ...result(tx, w), removed: null, prev };
  });
  return { ...r, levelUp };
}

// ── Faollik (TZ 4.7.4) ────────────────────────────────────────────────

export async function addActivity(
  db: Db,
  actor: GamActor,
  input: { groupId: number; pupilId: number; coins: number },
): Promise<OpResult & { used: number; limit: number }> {
  const settings = await loadSettings(db);
  requireOn(settings);
  const today = uzDateIso();
  const g = await loadGroupFor(db, actor, input.groupId, input.pupilId);
  requireTeach(actor, g);
  const reasons = await systemReasonMap(db);
  const reason = reasons.get("activity");
  if (!reason?.isActive) throw new GamError(422, "Bu tizim sababi to'xtatilgan");
  const max = settings.activityMaxPerClick;
  if (!Number.isInteger(input.coins) || input.coins < 1 || input.coins > max) {
    throw new GamError(422, `«Faollik» 1–${max} oralig'ida butun son bo'lsin`);
  }
  const att = await todayAtt(db, g.id, input.pupilId, today);
  if (!att) throw new GamError(422, "Avval davomatni saqlang");
  if (isAbsentAtt(att)) throw new GamError(422, "Darsda yo'q o'quvchiga faollik tangasi berilmaydi");

  const limit = settings.activityGroupLimitPerLesson;
  const { result: r, levelUp } = await withWallet(db, input.pupilId, async (w) => {
    if (w.pupil.frozen) throw new GamError(422, "Ketgan o'quvchiga tanga yozilmaydi");
    // Guruhning dars limiti bir nechta o'quvchiga umumiy — (guruh, kun)
    // bo'yicha qulf hamyon qulfidan KEYIN olinadi (TZ 4.1.8, tartib doim bir xil).
    return withLock(db, `lesson:${g.id}:${today}`, async () => {
      const [u] = await db
        .collection(GAM.tx)
        .aggregate<{ s: number }>([
          { $match: { groupId: g.id, date: today, type: "activity", status: "active" } },
          { $group: { _id: null, s: { $sum: "$amount" } } },
        ])
        .toArray();
      const used = u?.s ?? 0;
      if (used + input.coins > limit) {
        const left = Math.max(0, limit - used);
        throw new GamError(422, `Guruh limiti: bu darsda faollik uchun jami ${limit} tanga. Qoldi: ${left}`);
      }
      const tx = await w.add({
        groupId: g.id,
        date: today,
        type: "activity",
        reasonId: reason.id,
        reasonName: reason.name,
        amount: input.coins,
        note: "Darsdagi faollik",
        actor: toTxActor(actor),
      });
      return { ...result(tx, w), used: used + input.coins, limit };
    });
  });
  return { ...r, levelUp };
}

// ── Qo'shimcha sabab bo'yicha tanga (TZ 4.9.2–4.9.3) ──────────────────

/** Rolga ruxsat etilgan faol qo'shimcha sabablar (direktor — hammasi). */
export function reasonsForRole(all: CoinReason[], role: GamRole): CoinReason[] {
  return all.filter(
    (r) =>
      !r.isSystem &&
      r.isActive &&
      !r.deletedAt &&
      (role === "director" ||
        r.allowedRoles === "both" ||
        (role === "teacher" && r.allowedRoles === "teacher") ||
        (role === "branch_admin" && r.allowedRoles === "branch_admin")),
  );
}

export async function giveByReason(
  db: Db,
  actor: GamActor,
  input: { pupilId: number; groupId: number | null; reasonId: number; amount: number; note: string; from: "lesson" | "profile" },
): Promise<OpResult & { reasonName: string; direction: 1 | -1 }> {
  const settings = await loadSettings(db);
  requireOn(settings);
  const today = uzDateIso();
  const reason = await getReason(db, input.reasonId);
  if (!reason || reason.isSystem) throw new GamError(404, "Sabab topilmadi");
  if (!reasonsForRole([reason], actor.role).length) {
    throw new GamError(403, reason.isActive ? "Bu sabab sizning rolingiz uchun emas" : "Bu sabab to'xtatilgan");
  }

  let g: GamGroup | null = null;
  if (input.groupId !== null) {
    g = await loadGroupFor(db, actor, input.groupId, input.pupilId);
  } else if (actor.role === "teacher") {
    // «Guruhsiz» — faqat profildan (admin va direktor, TZ 3).
    throw new GamError(403, "Guruhsiz tangani filial admini yoki direktor yozadi");
  }

  const min = reason.amountMin ?? 1;
  const max = reason.amountMax ?? min;
  const note = String(input.note ?? "").trim().slice(0, 500);
  if ((reason.noteRequired || reason.direction < 0) && !note) throw new GamError(422, "Izoh yozish majburiy");

  if (reason.direction < 0 && g) {
    const att = await todayAtt(db, g.id, input.pupilId, today);
    if (isAbsentAtt(att)) {
      if (input.from === "profile") {
        const pupil = await db.collection("pupils").findOne({ id: input.pupilId }, { projection: { _id: 0, firstName: 1, lastName: 1 } });
        const name = `${String(pupil?.firstName ?? "").trim()} ${String(pupil?.lastName ?? "").trim()}`.trim();
        const group = g.label;
        throw new GamError(422, `${name} bugun «${group}» darsida yo'q — bu guruh bo'yicha tanga ayirilmaydi`);
      }
      throw new GamError(422, "Darsda yo'q o'quvchidan tanga ayirilmaydi");
    }
  }

  const { result: r, levelUp } = await withWallet(db, input.pupilId, async (w) => {
    if (w.pupil.frozen) throw new GamError(422, "Ketgan o'quvchiga tanga yozilmaydi");
    if (!g && actor.role === "branch_admin" && !actor.branchIds.includes(w.pupil.branchId)) {
      throw new GamError(403, "O'quvchi sizning filialingizda emas");
    }
    if (reason.perDayLimit > 0) {
      const n = await db.collection(GAM.tx).countDocuments({ pupilId: w.pupil.id, reasonId: reason.id, date: today, status: "active" });
      if (n >= reason.perDayLimit) {
        const limit = reason.perDayLimit;
        throw new GamError(422, `Bu sabab bo'yicha bir o'quvchiga kuniga ${limit} martadan ko'p bo'lmaydi`);
      }
    }
    let hi = max;
    if (reason.direction < 0) {
      const used = await deductedToday(db, w.pupil.id, today);
      hi = Math.min(max, settings.dailyDeductionLimit - used);
      if (hi < min || input.amount > hi) throw limitError(w.pupil.name, used, settings.dailyDeductionLimit);
    }
    if (!Number.isInteger(input.amount) || input.amount < min || input.amount > hi) {
      throw new GamError(422, `«Miqdor» ${min}–${hi} oralig'ida butun son bo'lsin`);
    }
    const tx = await w.add({
      groupId: g?.id ?? null,
      date: today,
      type: "reason",
      reasonId: reason.id,
      reasonName: reason.name,
      amount: reason.direction * input.amount,
      note,
      actor: toTxActor(actor),
    });
    return result(tx, w);
  });
  return { ...r, levelUp, reasonName: reason.name, direction: reason.direction };
}

// ── «Ortga» (TZ 5.0) ───────────────────────────────────────────────────

/**
 * Xato bosilgan amalni qaytarish: yozuv «Xato bosildi — qaytarildi»
 * bilan bekor qilinadi. Uy vazifasi almashtirilgan bo'lsa `restore` —
 * avvalgi belgi tiklanadi. Server buni oddiy amal kabi tekshiradi
 * (tanga sarflangan bo'lsa ustoz va admin uchun rad etiladi).
 */
export async function undoTx(
  db: Db,
  actor: GamActor,
  input: { txId: number; restore: "done" | "missed" | null },
): Promise<OpResult> {
  const settings = await loadSettings(db);
  requireOn(settings);
  const today = uzDateIso();
  const found = (await db.collection(GAM.tx).findOne({ id: input.txId }, { projection: { _id: 0 } })) as unknown as CoinTransaction | null;
  if (!found) throw new GamError(404, "Yozuv topilmadi");
  if (found.date !== today || (found.createdByUserId !== actor.userId && actor.role !== "director")) {
    throw new GamError(403, "Faqat o'zingizning bugungi amalingizni qaytara olasiz");
  }
  const reasons = await systemReasonMap(db);

  const { result: r, levelUp } = await withWallet(db, found.pupilId, async (w) => {
    const tx = (await db.collection(GAM.tx).findOne({ id: input.txId }, { projection: { _id: 0 } })) as unknown as CoinTransaction;
    if (tx.status !== "active") throw new GamError(409, "Yozuv allaqachon bekor qilingan");
    const deny = cancelDenial(actor, tx, { balance: w.balance, pupilBranchId: w.pupil.branchId, frozen: w.pupil.frozen, settings }, today);
    if (deny) throw new GamError(403, deny.message);
    await w.cancel(tx, "Xato bosildi — qaytarildi", toTxActor(actor), actor.role === "director");

    // Almashtirishdan keyingi «Ortga» avvalgi belgini tiklaydi (TZ 4.7.2).
    let restored: CoinTransaction | null = null;
    const isHw = tx.type === "homework_done" || tx.type === "homework_missed";
    if (input.restore && isHw && tx.groupId !== null) {
      const code = input.restore === "done" ? "homework_done" : "homework_missed";
      const reason = reasons.get(code);
      const att = await todayAtt(db, tx.groupId, tx.pupilId, today);
      if (reason?.isActive && att && !isAbsentAtt(att)) {
        const amount = input.restore === "done" ? settings.homeworkDoneCoins : -settings.homeworkMissedPenalty;
        const used = amount < 0 ? await deductedToday(db, tx.pupilId, today) : 0;
        if (amount > 0 || used - amount <= settings.dailyDeductionLimit) {
          restored = await w.add({
            groupId: tx.groupId,
            date: today,
            type: code,
            reasonId: reason.id,
            reasonName: reason.name,
            amount,
            note: input.restore === "done" ? "Bajardi" : "Bajarmadi",
            actor: toTxActor(actor),
            uniqKey: `hw:${tx.groupId}:${tx.pupilId}:${today}`,
          });
        }
      }
    }
    return result(restored, w);
  });
  return { ...r, levelUp };
}

// ── «Sababli qilish» / «Sababsizga qaytarish» (TZ 4.5.4–4.5.5) ─────────

export async function excuseAttendance(
  db: Db,
  actor: GamActor,
  authorName: string,
  input: { groupId: number; pupilId: number; date: string; action: "excuse" | "unexcuse" },
): Promise<{ refunded: number; charged: number; balance: number | null }> {
  const settings = await loadSettings(db);
  requireOn(settings);
  if (!gamActiveFor(settings, input.date)) throw new GamError(422, "Bu sana gamifikatsiya boshlanishidan oldin");
  const g = await loadGroupFor(db, actor, input.groupId, input.pupilId);
  const deny = attendanceEditDenial(actor, g, input.date, settings);
  if (deny) throw new GamError(403, deny);
  const pupil = await db.collection("pupils").findOne({ id: input.pupilId }, { projection: { _id: 0, status: 1 } });
  if (!pupil) throw new GamError(404, "O'quvchi topilmadi");
  if (isFrozenStatus(pupil.status)) throw new GamError(422, "Ketgan o'quvchiga tanga yozilmaydi");

  const from = input.action === "excuse" ? "sababsiz" : "sababli";
  const to = input.action === "excuse" ? "sababli" : "sababsiz";
  const key = { groupId: g.id, pupilId: input.pupilId, date: input.date };
  // Holat shu orada boshqa xodim tomonidan o'zgartirilgan bo'lsa — to'qnashuv.
  const res = await db
    .collection("attendance")
    .updateOne({ ...key, status: from }, { $set: { status: to, reason: null, note: null } });
  if (res.modifiedCount !== 1) throw new GamError(409, "Davomat holati o'zgargan — sahifani yangilang");
  await writeAttendanceHistory(db, { ...key, status: to }, authorName);

  const out = await onAttendanceChanged(db, { ...key, before: from, after: to, staff: toTxActor(actor) });
  const wallet = await db.collection(GAM.wallets).findOne({ pupilId: input.pupilId }, { projection: { _id: 0, balance: 1 } });
  return {
    refunded: out?.refunded ?? 0,
    charged: out?.created ? -out.created.applied : 0,
    balance: wallet ? Number(wallet.balance) : null,
  };
}

/** Davomat tarixiga yozuv (Guruh → Davomat → «Tarixi»), route bilan bir xil shakl. */
async function writeAttendanceHistory(
  db: Db,
  m: { groupId: number; pupilId: number; date: string; status: string },
  author: string,
): Promise<void> {
  const d = toUz(new Date());
  const p = (n: number) => String(n).padStart(2, "0");
  const col = db.collection("attendance_history");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  await col.insertOne({
    id: (last[0]?.id ?? 0) + 1,
    author,
    createdAt: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`,
    ...m,
    grade: null,
    reason: null,
    note: null,
  });
}

// ── Dars jurnali ko'rinishi (GET) ──────────────────────────────────────

export interface LessonRow {
  pupilId: number;
  name: string;
  balance: number;
  streak: { run: number; next: number };
  att: GamAtt | null;
  attAmount: number;
  homework: { value: "done" | "missed"; amount: number; by: string; txId: number; lock: string | null; lockShort: string | null } | null;
  activity: number;
  deducted: number;
  today: number;
  /** Bugun shu o'quvchida ishlatilgan sabablar: reasonId → marta. */
  reasonUse: Record<number, number>;
  exam: { prev: number | null; cur: number | null };
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}
function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

export async function lessonView(db: Db, actor: GamActor, groupIdParam: number | null) {
  const settings = await loadSettings(db);
  const today = uzDateIso();
  const [groups, names, allReasons, sys] = await Promise.all([
    actorGroups(db, actor),
    branchNames(db),
    listReasons(db),
    systemReasonMap(db),
  ]);
  const sysOn = Object.fromEntries([...sys.entries()].map(([k, r]) => [k, r.isActive])) as Record<string, boolean>;
  const reasons = reasonsForRole(allReasons, actor.role).map((r) => ({
    id: r.id,
    name: r.name,
    direction: r.direction,
    amountMin: r.amountMin ?? 1,
    amountMax: r.amountMax ?? r.amountMin ?? 1,
    perDayLimit: r.perDayLimit,
    noteRequired: r.noteRequired || r.direction < 0,
  }));
  const base = {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    today,
    settings: {
      homeworkDoneCoins: settings.homeworkDoneCoins,
      homeworkMissedPenalty: settings.homeworkMissedPenalty,
      activityMaxPerClick: settings.activityMaxPerClick,
      activityGroupLimitPerLesson: settings.activityGroupLimitPerLesson,
      absencePenaltyCoins: settings.absencePenaltyCoins,
      dailyDeductionLimit: settings.dailyDeductionLimit,
      objectionDays: settings.objectionDays,
      growthThresholdPp: settings.growthThresholdPp,
      streakLessons: settings.streakLessons,
      streakBonusCoins: settings.streakBonusCoins,
    },
    sys: sysOn,
    reasons,
    groups: groups.map((g) => ({ id: g.id, label: g.label, branchName: names.get(g.branchId) ?? "" })),
  };
  if (!groups.length) return { ...base, group: null, rows: [] as LessonRow[], canTeach: false, canExcuse: false, activityUsed: 0, examMonths: null };

  const g = groups.find((x) => x.id === groupIdParam) ?? groups[0];
  const canTeach = actor.role === "director" || isOwnGroup(actor, g);
  const canExcuse = attendanceEditDenial(actor, g, today, settings) === null;

  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: g.studentIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, branchId: 1 } })
    .toArray();
  const active = pupils
    .filter((p) => !isFrozenStatus(p.status))
    .map((p) => ({
      id: Number(p.id),
      name: `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim() || `#${p.id}`,
      branchId: Number.isFinite(Number(p.branchId)) && p.branchId !== null ? Number(p.branchId) : 1,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz"));
  const ids = active.map((p) => p.id);

  const curM = monthOf(today);
  const prevM = prevMonth(curM);
  const [marks, txs, wallets, exams] = await Promise.all([
    db
      .collection("attendance")
      .find(
        { groupId: g.id, pupilId: { $in: ids }, ...(settings.startDate ? { date: { $gte: settings.startDate } } : { date: today }) },
        { projection: { _id: 0, pupilId: 1, date: 1, status: 1 } },
      )
      .sort({ date: 1 })
      .toArray(),
    db.collection(GAM.tx).find({ pupilId: { $in: ids }, date: today, status: "active" }, { projection: { _id: 0 } }).toArray(),
    db.collection(GAM.wallets).find({ pupilId: { $in: ids } }, { projection: { _id: 0, pupilId: 1, balance: 1 } }).toArray(),
    db
      .collection("group_exams")
      .find({ groupId: g.id, month: { $in: [prevM, curM] } }, { projection: { _id: 0, id: 1, month: 1, students: 1 } })
      .sort({ id: 1 })
      .toArray(),
  ]);

  const balanceOf = new Map(wallets.map((w) => [Number(w.pupilId), Number(w.balance) || 0]));
  const marksBy = new Map<number, { date: string; status: string }[]>();
  for (const m of marks) {
    const arr = marksBy.get(Number(m.pupilId)) ?? [];
    arr.push({ date: String(m.date), status: String(m.status) });
    marksBy.set(Number(m.pupilId), arr);
  }
  // Sarhisob: oy bo'yicha eng oxirgi natija (bir oyda bir nechta kiritilgan bo'lsa).
  const pctOf = (month: string, pupilId: number): number | null => {
    let v: number | null = null;
    for (const e of exams) {
      if (e.month !== month) continue;
      const s = (e.students as { pupilId: number; pct: number }[] | undefined)?.find((x) => Number(x.pupilId) === pupilId);
      if (s && Number.isFinite(Number(s.pct))) v = Math.floor(Number(s.pct));
    }
    return v;
  };

  const tx = txs as unknown as CoinTransaction[];
  let activityUsed = 0;
  for (const t of tx) if (t.groupId === g.id && t.type === "activity") activityUsed += t.amount;

  const rows: LessonRow[] = active.map((p) => {
    const mine = tx.filter((t) => t.pupilId === p.id);
    const here = mine.filter((t) => t.groupId === g.id);
    const pMarks = marksBy.get(p.id) ?? [];
    const todayMark = pMarks.find((m) => m.date === today);
    const attTx = here.find((t) => t.type === "attendance" || t.type === "absence");
    const hw = here.find((t) => t.type === "homework_done" || t.type === "homework_missed");
    const balance = balanceOf.get(p.id) ?? 0;
    let lock: string | null = null;
    let lockShort: string | null = null;
    if (hw && canTeach) {
      const deny = cancelDenial(actor, hw, { balance, pupilBranchId: p.branchId, frozen: false, settings }, today);
      if (deny?.kind === "spent") {
        lock = "O'quvchi bu tangalarni sarflagan — belgini direktor o'zgartiradi";
        lockShort = "tanga sarflangan";
      } else if (deny) {
        const by = hw.createdByName;
        lock = `Bu belgini ${by} qo'ygan — uni o'zi (shu kuni) yoki direktor o'zgartiradi`;
        lockShort = by;
      }
    }
    const st = streakRun(pMarks, settings.streakLessons);
    const reasonUse: Record<number, number> = {};
    for (const t of mine) if (t.type === "reason" && t.reasonId !== null) reasonUse[t.reasonId] = (reasonUse[t.reasonId] ?? 0) + 1;
    return {
      pupilId: p.id,
      name: p.name,
      balance,
      streak: { run: settings.startDate ? st.run : 0, next: settings.streakLessons - ((settings.startDate ? st.run : 0) % settings.streakLessons) },
      att: gamAttOf(todayMark?.status),
      attAmount: attTx?.amount ?? 0,
      homework: hw
        ? { value: hw.amount > 0 ? "done" : "missed", amount: hw.amount, by: hw.createdByName, txId: hw.id, lock, lockShort }
        : null,
      activity: here.filter((t) => t.type === "activity").reduce((a, t) => a + t.amount, 0),
      deducted: -mine
        .filter((t) => t.amount < 0 && (t.type === "homework_missed" || t.type === "reason"))
        .reduce((a, t) => a + t.amount, 0),
      today: here.filter((t) => t.type !== "shop").reduce((a, t) => a + t.amount, 0),
      reasonUse,
      exam: { prev: pctOf(prevM, p.id), cur: pctOf(curM, p.id) },
    };
  });

  return {
    ...base,
    group: { id: g.id, label: g.label, branchName: names.get(g.branchId) ?? "", teacher: g.teacher },
    canTeach,
    canExcuse,
    activityUsed,
    examMonths: { prev: prevM, cur: curM },
    rows,
  };
}
