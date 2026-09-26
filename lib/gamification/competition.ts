import type { Db, Document } from "mongodb";
import type { Group } from "@/lib/groups";
import { MONTHS } from "@/lib/i18n";
import { uzDateIso } from "@/lib/uzTime";
import { writeAudit, type GamActor } from "./actor";
import { badgesCol } from "./badges";
import { GAM, gamDb, isDupKey, withLock } from "./db";
import { expireDiscounts } from "./discounts";
import { lastDayOf, shiftMonth } from "./exams";
import { groupRanking, monthRange } from "./ranking";
import { branchNames, isOwnGroup, toGamGroup } from "./scope";
import { loadSettings } from "./settings";
import { levelIndexOf } from "./rules";
import { GamError, isFrozenStatus, withWallet } from "./wallet";

// GURUHLAR MUSOBAQASI va OY YAKUNI (TZ 4.20, 5.6, 6.13, 8).
//
// Musobaqa har filial ICHIDA. Guruh o'rtachasi = faol (muzlatilmagan)
// a'zolarning shu oydagi reyting tangalari yig'indisi / ularning soni,
// yarmidan yuqoriga yaxlitlanadi (34,5 → 35); o'rin shu bo'yicha, tenglar
// teng. Faol o'quvchisi yo'q guruh ko'rsatilmaydi.
//
// Oy yakuni BIR MARTA: M+1 ning `monthCloseDay`-kuni tungi cron'da
// (/api/sync/cron, Toshkent 03:00 — TZ dagi 00:10 o'rniga, cron bitta)
// yoki oldinroq direktor tugmasi bilan. Natija `monthly_results` da
// muzlatiladi — keyingi storno/Sarhisob uni o'zgartirmaydi. Qayta — 409.

export const roundHalfUp = (x: number) => Math.floor(x + 0.5);

const monthName = (m: string) => MONTHS.uz[Number(m.slice(5, 7)) - 1] ?? m;

export interface CompGroup {
  id: number;
  label: string;
  teacher: string;
  members: number;
  total: number;
  avg: number;
  rank: number;
}

const GROUP_FIELDS = { _id: 0, id: 1, name: 1, course: 1, teacher: 1, branchId: 1, studentIds: 1, status: 1 } as const;

/** Filial(lar) bo'yicha oy musobaqasi — hisob paytidagi tarkib bilan. */
export async function computeCompetition(db: Db, month: string, branchIds: number[] | null): Promise<Map<number, CompGroup[]>> {
  const where: Document = { status: "active" };
  const rows = await db.collection("groups").find(where, { projection: GROUP_FIELDS }).toArray();
  const groups = rows.map((r) => toGamGroup(r as unknown as Group)).filter((g) => !branchIds || branchIds.includes(g.branchId));
  const allIds = [...new Set(groups.flatMap((g) => g.studentIds))];
  const pupils = await db.collection("pupils").find({ id: { $in: allIds } }, { projection: { _id: 0, id: 1, status: 1 } }).toArray();
  const active = new Set(pupils.filter((p) => !isFrozenStatus(p.status)).map((p) => Number(p.id)));
  const sums = await db
    .collection(GAM.tx)
    .aggregate<{ _id: { g: number; p: number }; s: number }>([
      { $match: { groupId: { $in: groups.map((g) => g.id) }, date: monthRange(month), status: "active", type: { $ne: "shop" } } },
      { $group: { _id: { g: "$groupId", p: "$pupilId" }, s: { $sum: "$amount" } } },
    ])
    .toArray();
  const by = new Map(sums.map((x) => [`${x._id.g}|${x._id.p}`, x.s]));

  const out = new Map<number, CompGroup[]>();
  for (const g of groups) {
    const members = g.studentIds.filter((id) => active.has(id));
    if (!members.length) continue;
    const total = members.reduce((a, id) => a + (by.get(`${g.id}|${id}`) ?? 0), 0);
    const list = out.get(g.branchId) ?? [];
    list.push({ id: g.id, label: g.label, teacher: g.teacher, members: members.length, total, avg: roundHalfUp(total / members.length), rank: 0 });
    out.set(g.branchId, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => b.avg - a.avg || a.label.localeCompare(b.label, "uz"));
    for (const r of list) r.rank = 1 + list.filter((x) => x.avg > r.avg).length;
  }
  return out;
}

export async function isMonthClosed(db: Db, month: string): Promise<boolean> {
  return (await db.collection(GAM.monthly).countDocuments({ month }, { limit: 1 })) > 0;
}

/** Filiallar — xodim doirasida (TZ 5.6): direktor — hammasi, admin — o'ziniki, ustoz — guruhlari bor filiallar. */
async function scopeBranches(db: Db, actor: GamActor): Promise<number[] | null> {
  if (actor.role === "director") return null;
  if (actor.role === "branch_admin") return actor.branchIds;
  const rows = await db.collection("groups").find({ status: "active" }, { projection: { _id: 0, teacher: 1, branchId: 1 } }).toArray();
  return [...new Set(rows.filter((g) => isOwnGroup(actor, { teacher: String(g.teacher ?? "") })).map((g) => toGamGroup(g as unknown as Group).branchId))];
}

export async function competitionView(db: Db, actor: GamActor, month: string | null, branchFilter: number | null) {
  const settings = await loadSettings(db);
  const today = uzDateIso();
  const cur = today.slice(0, 7);
  const m = month && /^\d{4}-\d{2}$/.test(month) && month <= cur ? month : cur;
  const allowed = await scopeBranches(db, actor);
  const names = await branchNames(db);
  const ids = (allowed ?? [...names.keys()]).filter((b) => branchFilter === null || b === branchFilter);
  const comp = await computeCompetition(db, m, ids);
  const prev = shiftMonth(m, -1);
  const winners = await db
    .collection(GAM.monthly)
    .find({ month: prev, winner: true, branchId: { $in: ids } }, { projection: { _id: 0, branchId: 1, groupLabel: 1 } })
    .toArray();
  const prevClosed = await isMonthClosed(db, shiftMonth(cur, -1));
  const closedThis = m < cur ? await isMonthClosed(db, m) : false;
  return {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    month: m,
    currentMonth: cur,
    monthCloseDay: settings.monthCloseDay,
    closed: closedThis,
    // «Oyni yakunlash» — faqat direktor, o'tgan oy hali yakunlanmagan bo'lsa (TZ 4.20.4).
    canClose: actor.role === "director" && settings.enabled && !!settings.startDate && !prevClosed && lastDayOf(shiftMonth(cur, -1)) >= settings.startDate,
    closeMonth: shiftMonth(cur, -1),
    branchOptions: (allowed ?? [...names.keys()]).map((b) => ({ id: b, name: names.get(b) ?? `#${b}` })),
    branches: ids
      .map((b) => ({
        id: b,
        name: names.get(b) ?? `#${b}`,
        groups: comp.get(b) ?? [],
        lastWinners: winners.filter((w) => Number(w.branchId) === b).map((w) => String(w.groupLabel ?? "")),
      }))
      .filter((b) => b.groups.length > 0 || b.lastWinners.length > 0),
  };
}

// ── Oy yakuni ──────────────────────────────────────────────────────────

/** «Aniq vaqt» (TZ 4.19): oyda ≥ 8 dars (sabablisiz) va hammasida «keldi» — barcha guruhlar jamlanib. */
async function onTimePupils(db: Db, month: string, since: string): Promise<number[]> {
  const range = monthRange(month);
  const rows = await db
    .collection("attendance")
    .aggregate<{ _id: number; total: number; onTime: number }>([
      { $match: { date: { $gte: range.$gte > since ? range.$gte : since, $lte: range.$lte }, status: { $ne: "sababli" } } },
      {
        $group: {
          _id: "$pupilId",
          total: { $sum: 1 },
          onTime: { $sum: { $cond: [{ $in: ["$status", ["keldi", "birinchi"]] }, 1, 0] } },
        },
      },
      { $match: { total: { $gte: 8 } } },
    ])
    .toArray();
  return rows.filter((r) => r.onTime === r.total).map((r) => Number(r._id));
}

export async function closeMonth(db: Db, month: string, actor: GamActor | null) {
  await gamDb();
  const settings = await loadSettings(db);
  if (!settings.enabled || !settings.startDate) throw new GamError(409, "Gamifikatsiya moduli o'chiq");
  if (!/^\d{4}-\d{2}$/.test(month)) throw new GamError(400, "Noto'g'ri oy");
  const name = monthName(month);
  if (month >= uzDateIso().slice(0, 7)) throw new GamError(422, `${name} oyi hali tugamagan`);
  if (lastDayOf(month) < settings.startDate) throw new GamError(422, "Bu oy gamifikatsiya boshlanishidan oldin");
  const since = settings.startDate;

  return withLock(db, `month-close:${month}`, async () => {
    if (await isMonthClosed(db, month)) throw new GamError(409, `${name} oyi allaqachon yakunlangan`);
    const now = new Date().toISOString();
    const by = actor?.name ?? "Tizim";
    const comp = await computeCompetition(db, month, null);
    const col = db.collection(GAM.monthly);
    let groups = 0;
    let winners = 0;
    try {
      for (const [branchId, list] of comp) {
        for (const g of list) {
          // G'olib — 1-o'rin VA o'rtacha > 0: hamma guruh 0 da teng bo'lsa
          // hech kim g'olib emas («Oy o'quvchisi» dagi «reyting tangasi > 0» kabi).
          const winner = g.rank === 1 && g.avg > 0;
          await col.insertOne({
            month, groupId: g.id, branchId, groupLabel: g.label, teacher: g.teacher, members: g.members,
            total: g.total, avg: g.avg, rank: g.rank, winner, closedAt: now, closedByName: by,
          });
          groups++;
          if (winner) winners++;
        }
      }
      // Guruhsiz oy ham «yakunlandi» deb belgilansin (qayta urinish 409 bo'lsin).
      if (groups === 0) await col.insertOne({ month, groupId: null, marker: true, closedAt: now, closedByName: by });
    } catch (e) {
      if (isDupKey(e)) throw new GamError(409, `${name} oyi allaqachon yakunlangan`);
      throw e;
    }

    // «Oy o'quvchisi» — har guruhda 1-o'rin (reyting tangasi > 0; tenglar hammasi).
    const bcol = badgesCol(db);
    let som = 0;
    const gdocs = await db.collection("groups").find({ id: { $in: [...comp.values()].flat().map((g) => g.id) } }, { projection: GROUP_FIELDS }).toArray();
    for (const gd of gdocs) {
      const g = toGamGroup(gd as unknown as Group);
      const rk = await groupRanking(db, g, month);
      for (const r of rk.filter((x) => x.rank === 1 && x.points > 0)) {
        try {
          await bcol.insertOne({ pupilId: r.pupilId, code: "student_of_month", month, groupId: g.id, earnedAt: now, revokedAt: null });
          som++;
        } catch (e) {
          if (!isDupKey(e)) throw e;
        }
      }
    }
    // «Aniq vaqt» — shu oy uchun (keyin o'zgarmaydi).
    let onTime = 0;
    const frozen = new Set(
      (await db.collection("pupils").find({ status: { $in: ["Muzlatilgan", "Arxiv"] } }, { projection: { _id: 0, id: 1 } }).toArray()).map((p) => Number(p.id)),
    );
    for (const pupilId of await onTimePupils(db, month, since)) {
      if (frozen.has(pupilId)) continue;
      const res = await bcol.updateOne(
        { pupilId, code: "on_time", month: null, groupId: null },
        { $set: { revokedAt: null }, $setOnInsert: { pupilId, code: "on_time", month: null, groupId: null, earnedAt: now } },
        { upsert: true },
      );
      if (res.upsertedCount || res.modifiedCount) onTime++;
    }
    await writeAudit(db, actor, GAM.monthly, month, "close", null, { groups, winners, studentsOfMonth: som, onTime });
    return { month, groups, winners, studentsOfMonth: som, onTime };
  });
}

// ── Tungi ish (TZ 8) ──────────────────────────────────────────────────

/**
 * /api/sync/cron dan (Toshkent 03:00): (1) oy yakuni vaqti kelgan bo'lsa —
 * o'tgan oyni yakunlaydi; (2) hamyon keshini yozuvlardan qayta hisoblab
 * solishtiradi, farqni tuzatadi va sanaydi. Modul o'chiq bo'lsa — hech narsa.
 */
export async function runGamificationNightly(db: Db) {
  const settings = await loadSettings(db);
  // Muddati o'tgan chegirma — tanga qaytadi (TZ 4.16.6). Modul o'chiq
  // bo'lsa ham: bu yangi tanga emas, o'quvchining o'z tangasi qaytishi.
  const discounts = await expireDiscounts(db).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  if (!settings.enabled || !settings.startDate) return { skipped: "o'chiq", discounts };
  await gamDb();
  const today = uzDateIso();
  const prev = shiftMonth(today.slice(0, 7), -1);
  let closed: unknown = null;
  if (Number(today.slice(8, 10)) >= settings.monthCloseDay && lastDayOf(prev) >= settings.startDate && !(await isMonthClosed(db, prev))) {
    closed = await closeMonth(db, prev, null).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  }
  const agg = await db
    .collection(GAM.tx)
    .aggregate<{ _id: number; applied: number; reversed: number; earned: number }>([
      {
        $group: {
          _id: "$pupilId",
          applied: { $sum: "$applied" },
          reversed: { $sum: { $ifNull: ["$reversed", 0] } },
          earned: {
            $sum: { $cond: [{ $and: [{ $gt: ["$amount", 0] }, { $ne: ["$type", "shop"] }, { $eq: ["$status", "active"] }] }, "$amount", 0] },
          },
        },
      },
    ])
    .toArray();
  const wallets = new Map(
    (await db.collection(GAM.wallets).find({}, { projection: { _id: 0, pupilId: 1, balance: 1, earnedTotal: 1, levelPosition: 1 } }).toArray()).map((w) => [
      Number(w.pupilId),
      w,
    ]),
  );
  let fixed = 0;
  for (const r of agg) {
    const bal = r.applied + r.reversed;
    const w = wallets.get(Number(r._id));
    const lvl = levelIndexOf(r.earned, settings.levels) + 1;
    if (!w || w.balance !== bal || w.earnedTotal !== r.earned || w.levelPosition !== lvl) {
      console.warn("[gamification] hamyon keshi farq qildi — tuzatildi", { pupilId: r._id, cache: w ?? null, real: { bal, earned: r.earned } });
      // Qulf ostida qayta hisoblash (withWallet keshni yozuvlardan yozadi).
      await withWallet(db, Number(r._id), async () => null).catch((e) => console.error("[gamification] kesh tuzatish", r._id, e));
      fixed++;
    }
  }
  return { closed, checked: agg.length, fixed, discounts };
}

