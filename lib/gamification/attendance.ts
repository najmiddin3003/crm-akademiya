import type { Db } from "mongodb";
import type { AttendanceStatus } from "@/lib/attendance";
import { uzDateIso } from "@/lib/uzTime";
import { getGamActor, type GamActor } from "./actor";
import { GAM, gamDb } from "./db";
import { systemReasonMap } from "./reasons";
import { isOwnGroup, type GamGroup } from "./scope";
import { loadSettings } from "./settings";
import type { CoinReason, CoinTransaction, GamSettings, SystemReasonCode } from "./types";
import { systemActor, withWallet, type TxActor, type WalletSession } from "./wallet";

// DAVOMAT → TANGA (TZ 4.5, 4.6, 7, 8).
//
// Manba — mavjud Davomat bo'limi (`attendance`: groupId, pupilId, date,
// status). Gamifikatsiya o'z holatlari bilan ishlaydi:
//   keldi, birinchi → «keldi» (vaqtida)   → attendance +5
//   kechikdi        → «kechikdi»          → attendance +2
//   sababsiz        → «kelmadi»           → absence −10
//   sababli         → «sababli»           → yozuv yo'q
// Har o'quvchi–dars uchun ko'pi bilan BITTA faol davomat yozuvi (uniqKey).
// Holat o'zgarsa eskisi bekor qilinadi, yangisi yoziladi, seriya qayta
// hisoblanadi. Hodisa FAQAT holat o'zgarganda ishlaydi — baho yoki izoh
// o'zgarishi tanga yozmaydi.
//
// Hammasi o'quvchi hamyonining qulfi ostida (wallet.ts → withWallet).

export type GamAtt = "keldi" | "kechikdi" | "kelmadi" | "sababli";

export function gamAttOf(s: AttendanceStatus | string | null | undefined): GamAtt | null {
  switch (s) {
    case "keldi":
    case "birinchi":
      return "keldi";
    case "kechikdi":
      return "kechikdi";
    case "sababsiz":
      return "kelmadi";
    case "sababli":
      return "sababli";
    default:
      return null;
  }
}

/** Darsda yo'q (TZ 4.5.7): uy vazifasi, faollik va ayiriladigan sabab qo'llanmaydi. */
export const isAbsentAtt = (s: GamAtt | null) => s === "kelmadi" || s === "sababli";

/** Modul yoqilgan va sana boshlanish kunidan keyin — faqat shunda tanga yoziladi va TZ 7 cheklovlari ishlaydi. */
export function gamActiveFor(settings: GamSettings, date: string): boolean {
  return settings.enabled && !!settings.startDate && date >= settings.startDate;
}

/** Ikki ISO sana orasidagi kalendar kunlar (b − a). */
export function daysBetween(a: string, b: string): number {
  const d = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((d(b) - d(a)) / 86_400_000);
}

export function toTxActor(actor: GamActor): TxActor {
  return { userId: actor.userId, name: actor.name, role: actor.role };
}

/** Avtomatik yozuvlar muallifi (TZ 6.4). */
export const DAVOMAT_AUTO = systemActor("Davomat (avto)");
/** Tizim bekor qilganda (qayta hisob) — `cancelledByUserId` null. */
export const SYSTEM = systemActor("Tizim");

/**
 * DAVOMATNI O'ZGARTIRISH HUQUQI — TZ 7 (Davomat bo'limining o'ziga ham) va
 * «Sababli qilish» / «Sababsizga qaytarish» (TZ 3, 4.5.4):
 *   • ustoz — o'z guruhi, faqat dars kuni;
 *   • filial admini — guruh o'z filialida, e'tiroz muddati ichida;
 *   • direktor — istalgan sana.
 * Gamifikatsiyada roli yo'q boshqa xodim — admin qoidasi bilan (filial
 * tekshiruvisiz: uni navbardagi filial qamrovi allaqachon kesgan).
 * Kelgusi dars sanasiga (direktordan boshqa) belgi qo'yilmaydi.
 * `null` — ruxsat bor.
 */
export function attendanceEditDenial(
  actor: GamActor | null,
  g: Pick<GamGroup, "teacher" | "branchId">,
  date: string,
  settings: GamSettings,
  today = uzDateIso(),
): string | null {
  if (actor?.role === "director") return null;
  if (date > today) return "Kelgusi dars uchun davomat belgilanmaydi";
  if (actor?.role === "teacher") {
    if (!isOwnGroup(actor, g)) return "Bu guruhning davomatini guruh ustozi, filial admini yoki direktor belgilaydi";
    if (date !== today) return "Ustoz davomatni faqat dars kuni o'zgartiradi — keyin filial admini yoki direktorga murojaat qiling";
    return null;
  }
  if (actor?.role === "branch_admin" && !actor.branchIds.includes(g.branchId)) {
    return "Guruh sizning filialingizda emas";
  }
  if (daysBetween(date, today) > settings.objectionDays) {
    const days = settings.objectionDays;
    return `E'tiroz muddati (${days} kun) o'tgan — bu darsning davomatini direktor o'zgartiradi`;
  }
  return null;
}

/** Shu darsning faol yozuvlari (davomat, uy vazifasi, faollik). */
export async function activeLessonTxs(db: Db, pupilId: number, groupId: number, date: string): Promise<CoinTransaction[]> {
  return (await db
    .collection(GAM.tx)
    .find(
      { pupilId, groupId, date, status: "active", type: { $in: ["attendance", "absence", "homework_done", "homework_missed", "activity"] } },
      { projection: { _id: 0 } },
    )
    .toArray()) as unknown as CoinTransaction[];
}

type Reasons = Map<SystemReasonCode, CoinReason>;
const on = (reasons: Reasons, code: SystemReasonCode) => reasons.get(code)?.isActive === true;

interface AttCtx {
  db: Db;
  settings: GamSettings;
  reasons: Reasons;
  groupId: number;
  date: string;
  before: GamAtt | null;
  after: GamAtt | null;
  /** Amalni bajargan xodim — «Sababli deb belgilandi» / qayta belgilashda yozuvga tushadi. */
  staff: TxActor | null;
}

export interface AttOutcome {
  /** «Sababli qilish» da haqiqatda qaytgan tanga (applied, TZ 4.5.4). */
  refunded: number;
  /** Yangi yozuv (masalan qayta belgilangan −10). */
  created: CoinTransaction | null;
}

/** Holat o'zgarishini hamyonga qo'llaydi (qulf ostida). */
async function applyAttendance(w: WalletSession, c: AttCtx): Promise<AttOutcome> {
  const out: AttOutcome = { refunded: 0, created: null };
  const txs = await activeLessonTxs(c.db, w.pupil.id, c.groupId, c.date);
  const cur = txs.find((t) => t.type === "attendance" || t.type === "absence") ?? null;

  if (cur) {
    const excused = c.after === "sababli" && cur.type === "absence";
    const note = excused ? "Sababli deb belgilandi" : c.after === null ? "Davomat o'chirildi" : "Davomat o'zgardi";
    const r = await w.cancel(cur, note, excused && c.staff ? c.staff : SYSTEM, true);
    if (excused) out.refunded = r.reversed;
  }

  let want: { code: SystemReasonCode; amount: number; note: string } | null = null;
  if (c.after === "keldi" && on(c.reasons, "attendance")) want = { code: "attendance", amount: c.settings.attendanceOnTimeCoins, note: "Keldi" };
  if (c.after === "kechikdi" && on(c.reasons, "attendance")) want = { code: "attendance", amount: c.settings.attendanceLateCoins, note: "Kechikdi" };
  if (c.after === "kelmadi" && on(c.reasons, "absence")) want = { code: "absence", amount: -c.settings.absencePenaltyCoins, note: "Kelmadi" };
  // Miqdor 0 — yozuv yaratilmaydi (TZ 4.4); seriya baribir manbadan hisoblanadi.
  if (want && want.amount !== 0) {
    const reMarked = c.before === "sababli" && c.after === "kelmadi";
    const reason = c.reasons.get(want.code)!;
    out.created = await w.add({
      groupId: c.groupId,
      date: c.date,
      type: want.code,
      reasonId: reason.id,
      reasonName: reason.name,
      amount: want.amount,
      note: reMarked ? "Sababsiz kelmadi (qayta belgilandi)" : want.note,
      actor: reMarked && c.staff ? c.staff : DAVOMAT_AUTO,
      uniqKey: `att:${c.groupId}:${w.pupil.id}:${c.date}`,
      attStatus: c.after as "keldi" | "kechikdi" | "kelmadi",
    });
  }

  // Darsda yo'q bo'lib qoldi — shu darsning ✓/✗ va faolligi bekor (TZ 4.5.3).
  if (isAbsentAtt(c.after)) {
    for (const t of txs) {
      if (t.type === "homework_done" || t.type === "homework_missed" || t.type === "activity") {
        await w.cancel(t, "Davomat o'zgardi", SYSTEM, true);
      }
    }
  }
  return out;
}

/** Joriy seriya: ketma-ket kelgan darslar (TZ 4.6.1) va har N ga yetgan dars sanalari. */
export function streakRun(
  marks: { date: string; status: string }[],
  n: number,
): { run: number; milestones: { date: string; run: number }[] } {
  let run = 0;
  const milestones: { date: string; run: number }[] = [];
  for (const m of marks) {
    const st = gamAttOf(m.status);
    if (st === null || st === "sababli") continue; // na qo'shadi, na uzadi
    if (st === "kelmadi") {
      run = 0;
      continue;
    }
    run++;
    if (run % n === 0) milestones.push({ date: m.date, run });
  }
  return { run, milestones };
}

/**
 * Seriya bonuslari SONINI moslashtirish (TZ 4.6.4–4.6.5, psevdokod o'sha
 * yerda): yetishmasa — yoziladi (sanasi seriyani N ga yetkazgan dars
 * sanasi), ortiqcha bo'lsa — eng oxirgilari «Seriya qayta hisoblandi».
 * Mavjud bonuslarning sanasi o'zgartirilmaydi. Qoida o'zgargan bo'lsa
 * (`streakRuleChangedAt`), undan oldingi bonuslar hisobga kirmaydi va
 * orqaga qarab bonus berilmaydi.
 */
async function reconcileStreak(w: WalletSession, c: Pick<AttCtx, "db" | "settings" | "reasons" | "groupId">): Promise<void> {
  const reason = c.reasons.get("streak");
  if (!reason?.isActive || w.pupil.frozen || !c.settings.startDate) return;
  const n = c.settings.streakLessons;
  const changed = c.settings.streakRuleChangedAt;
  const since = changed ? uzDateIso(new Date(changed)) : c.settings.startDate;

  const marks = await c.db
    .collection("attendance")
    .find({ groupId: c.groupId, pupilId: w.pupil.id, date: { $gte: c.settings.startDate } }, { projection: { _id: 0, date: 1, status: 1 } })
    .sort({ date: 1 })
    .toArray();
  const mine = (await c.db
    .collection(GAM.tx)
    .find({ pupilId: w.pupil.id, groupId: c.groupId, type: "streak", status: "active" }, { projection: { _id: 0 } })
    .toArray()) as unknown as CoinTransaction[];

  const old = new Set(mine.filter((t) => changed && t.createdAt <= changed).map((t) => t.date));
  const awarded = mine
    .filter((t) => !changed || t.createdAt > changed)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const due = streakRun(marks as unknown as { date: string; status: string }[], n).milestones.filter(
    (m) => m.date >= since && !old.has(m.date),
  );

  for (let i = awarded.length; i < due.length; i++) {
    await w.add({
      groupId: c.groupId,
      date: due[i].date,
      type: "streak",
      reasonId: reason.id,
      reasonName: reason.name,
      amount: c.settings.streakBonusCoins,
      note: `${due[i].run} dars ketma-ket keldi`,
      actor: DAVOMAT_AUTO,
    });
  }
  for (const t of awarded.slice(due.length).reverse()) {
    await w.cancel(t, "Seriya qayta hisoblandi", SYSTEM, true);
  }
}

export interface AttendanceEvent {
  groupId: number;
  pupilId: number;
  date: string;
  before: AttendanceStatus | string | null;
  after: AttendanceStatus | string | null;
  staff: TxActor | null;
}

/**
 * Davomat saqlangandan / o'chirilgandan KEYIN chaqiriladi (Davomat bo'limi
 * ham, «Sababli qilish» ham — natija bir xil, TZ 7). Modul o'chiq, sana
 * boshlanishdan oldin, holat o'zgarmagan yoki o'quvchi muzlatilgan bo'lsa —
 * hech narsa qilmaydi.
 */
export async function onAttendanceChanged(db: Db, e: AttendanceEvent): Promise<AttOutcome | null> {
  const before = gamAttOf(e.before);
  const after = gamAttOf(e.after);
  if (before === after) return null;
  const settings = await loadSettings(db);
  if (!gamActiveFor(settings, e.date)) return null;
  // Chaqiruvchi (davomat route'i) oddiy `ensureIndexes()` bazasi bilan keladi —
  // gamifikatsiya unique indekslari yozuvdan OLDIN turishi shart (db.ts).
  await gamDb();
  const reasons = await systemReasonMap(db);
  const { result } = await withWallet(db, e.pupilId, async (w) => {
    if (w.pupil.frozen) return null; // TZ 4.21: davomat hodisalari o'tkazib yuboriladi
    const ctx: AttCtx = { db, settings, reasons, groupId: e.groupId, date: e.date, before, after, staff: e.staff };
    const out = await applyAttendance(w, ctx);
    await reconcileStreak(w, ctx);
    return out;
  });
  return result;
}

/**
 * Davomat route'i uchun (app/api/groups/[id]/attendance): modul yoqilgan va
 * sana boshlanishdan keyin bo'lsa — joriy xodimning holatni o'zgartirish
 * huquqi (TZ 7). `active: false` — gamifikatsiya bu darsga tegmaydi.
 */
export async function attendanceGuard(
  db: Db,
  group: { teacher?: unknown; branchId?: unknown },
  date: string,
): Promise<{ active: boolean; denial: string | null; staff: TxActor | null }> {
  const settings = await loadSettings(db);
  if (!gamActiveFor(settings, date)) return { active: false, denial: null, staff: null };
  const actor = await getGamActor(db);
  const g = {
    teacher: String(group.teacher ?? "").trim(),
    branchId: Number.isFinite(Number(group.branchId)) && group.branchId !== null ? Number(group.branchId) : 1,
  };
  return { active: true, denial: attendanceEditDenial(actor, g, date, settings), staff: actor ? toTxActor(actor) : null };
}
