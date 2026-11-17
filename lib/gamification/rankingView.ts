import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { badgesCol } from "./badges";
import { computeCompetition } from "./competition";
import { GAM } from "./db";
import { shiftMonth } from "./exams";
import { groupRanking } from "./ranking";
import { levelIndexOf } from "./rules";
import { actorGroups, branchNames } from "./scope";
import { loadSettings } from "./settings";
import { gradeOf } from "./students";

// GAMIFIKATSIYA → REYTING (TZ 4.3, 5.2): guruh ichida, joriy oy yoki jami.
// O'quvchilarga top-5 (o'rni ≤ 5 — tenglar bilan 5 dan ko'p bo'lishi mumkin)
// va o'z o'rni ko'rinadi — ustun «O'quvchilarga» shuni aytadi.

export async function rankingView(db: Db, actor: GamActor, groupIdParam: number | null, period: "month" | "all") {
  const settings = await loadSettings(db);
  const month = uzDateIso().slice(0, 7);
  const [groups, names] = await Promise.all([actorGroups(db, actor), branchNames(db)]);
  const base = {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    month,
    period,
    groups: groups.map((g) => ({ id: g.id, label: g.label, branchName: names.get(g.branchId) ?? "" })),
  };
  if (!groups.length) return { ...base, group: null, rows: [] };
  const g = groups.find((x) => x.id === groupIdParam) ?? groups[0];
  const today = uzDateIso();
  const prevM = shiftMonth(month, -1);
  const rk = await groupRanking(db, g, period === "month" ? month : null);
  const ids = rk.map((r) => r.pupilId);
  // Yangi versiya (33-qism): «Bugun» ustuni, o'tgan oy yakuni (uchlik + «Oy o'quvchisi») va
  // guruhning filial musobaqasidagi o'rni.
  const [pupils, wallets, todaySums, prevRk, som, comp] = await Promise.all([
    db.collection("pupils").find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, grade: 1 } }).toArray(),
    db.collection(GAM.wallets).find({ pupilId: { $in: ids } }, { projection: { _id: 0, pupilId: 1, balance: 1, earnedTotal: 1 } }).toArray(),
    db
      .collection(GAM.tx)
      .aggregate<{ _id: number; s: number }>([
        { $match: { groupId: g.id, pupilId: { $in: ids }, date: today, status: "active", type: { $ne: "shop" } } },
        { $group: { _id: "$pupilId", s: { $sum: "$amount" } } },
      ])
      .toArray(),
    groupRanking(db, g, prevM),
    badgesCol(db).find({ code: "student_of_month", month: prevM, groupId: g.id, revokedAt: null }, { projection: { _id: 0, pupilId: 1 } }).toArray(),
    computeCompetition(db, month, [g.branchId]),
  ]);
  const gradeBy = new Map(pupils.map((p) => [Number(p.id), gradeOf(p)]));
  const walletBy = new Map(wallets.map((w) => [Number(w.pupilId), w]));
  const todayBy = new Map(todaySums.map((x) => [Number(x._id), x.s]));
  const somIds = new Set(som.map((b) => Number(b.pupilId)));
  const list = comp.get(g.branchId) ?? [];
  const mine = list.find((x) => x.id === g.id) ?? null;
  const leader = list.find((x) => x.id !== g.id && x.rank === 1) ?? list.find((x) => x.id !== g.id) ?? null;
  return {
    ...base,
    today,
    group: { id: g.id, label: g.label, branchName: names.get(g.branchId) ?? "", members: rk.length },
    prevMonth: {
      month: prevM,
      top: prevRk
        .filter((r) => r.points > 0 && r.rank <= 3)
        .slice(0, 3)
        .map((r) => ({ pupilId: r.pupilId, name: r.name, points: r.points, rank: r.rank, studentOfMonth: somIds.has(r.pupilId) })),
    },
    competition: mine
      ? {
          rank: mine.rank,
          avg: mine.avg,
          groups: list.length,
          other: leader ? { label: leader.label, avg: leader.avg, rank: leader.rank } : null,
        }
      : null,
    rows: rk.map((r) => {
      const w = walletBy.get(r.pupilId);
      const li = levelIndexOf(Number(w?.earnedTotal) || 0, settings.levels);
      return {
        ...r,
        grade: gradeBy.get(r.pupilId) ?? null,
        levelPosition: li + 1,
        levelName: settings.levels[li]?.name ?? "",
        balance: Number(w?.balance) || 0,
        today: todayBy.get(r.pupilId) ?? 0,
      };
    }),
  };
}
