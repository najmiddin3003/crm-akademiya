import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { GAM } from "./db";
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
  const rk = await groupRanking(db, g, period === "month" ? month : null);
  const ids = rk.map((r) => r.pupilId);
  const [pupils, wallets] = await Promise.all([
    db.collection("pupils").find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, grade: 1 } }).toArray(),
    db.collection(GAM.wallets).find({ pupilId: { $in: ids } }, { projection: { _id: 0, pupilId: 1, balance: 1, earnedTotal: 1 } }).toArray(),
  ]);
  const gradeBy = new Map(pupils.map((p) => [Number(p.id), gradeOf(p)]));
  const walletBy = new Map(wallets.map((w) => [Number(w.pupilId), w]));
  return {
    ...base,
    group: { id: g.id, label: g.label, branchName: names.get(g.branchId) ?? "" },
    rows: rk.map((r) => {
      const w = walletBy.get(r.pupilId);
      const li = levelIndexOf(Number(w?.earnedTotal) || 0, settings.levels);
      return {
        ...r,
        grade: gradeBy.get(r.pupilId) ?? null,
        levelPosition: li + 1,
        levelName: settings.levels[li]?.name ?? "",
        balance: Number(w?.balance) || 0,
      };
    }),
  };
}
