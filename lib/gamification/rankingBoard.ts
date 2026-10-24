import type { Db } from "mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { GAM } from "./db";
import { shiftMonth } from "./exams";
import { monthRange, pupilName } from "./ranking";
import { actorGroups, branchNames } from "./scope";
import { loadSettings } from "./settings";
import { courseLevel, pupilGroupLabels } from "./shopRequests";
import { isFrozenStatus } from "./wallet";

// REYTING — YANGI VERSIYA (rasm «Reyting · oylik va umumiy», 24.10.2026).
//
// Ikki xil reyting (rasmdagi «Qanday hisoblanadi»):
//   • Oylik — shu oy olingan tangalar (ayirilganlari hisobga olinadi; do'kon xaridi
//     kirmaydi), har oyning 1-sanasida noldan;
//   • Umumiy — o'quvchining hozirgi tanga balansi (sovg'a olganda kamayadi).
// Teng tangalilar bir xil o'rin oladi (1, 2, 2, 4). Doira — xodimning guruhlari
// navbardagi filialda (scope.ts → actorGroups: direktor/admin — filial, ustoz — o'z
// guruhlari); «Guruh: Hammasi» — o'quvchining hamma tangalari, guruh tanlansa — shu
// guruhdagi tangalar (eski guruh reytingi qoidasi, ranking.ts). Muzlatilganlar chiqmaydi.
// «O'tgan oylar g'oliblari» — oldingi 3 oyning eng ko'p tanga olgani (0 dan katta bo'lsa).

export interface BoardRow {
  pupilId: number;
  name: string;
  grade: number | null;
  groupLabel: string;
  /** Shu oy olingan tangalar. */
  month: number;
  /** Hozirgi balans. */
  balance: number;
  /** Tanlangan reyting bo'yicha qiymat (oylik — `month`, umumiy — `balance`). */
  points: number;
  rank: number;
}

export async function rankingBoard(db: Db, actor: GamActor, opts: { period: "month" | "all"; groupId: number | null }) {
  const settings = await loadSettings(db);
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const [groups, names, scope] = await Promise.all([actorGroups(db, actor), branchNames(db), getBranchScope().catch(() => null)]);
  const docs = groups.length
    ? await db.collection("groups").find({ id: { $in: groups.map((g) => g.id) } }, { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1 } }).toArray()
    : [];
  const docBy = new Map(docs.map((d) => [Number(d.id), d]));
  const sel = opts.groupId !== null ? (groups.find((g) => g.id === opts.groupId) ?? null) : null;
  const pool = sel ? [sel] : groups;

  const base = {
    enabled: settings.enabled && !!settings.startDate,
    role: actor.role,
    period: opts.period,
    month,
    today,
    branchName: scope ? (names.get(scope.branchId) ?? "") : "",
    groups: groups.map((g) => {
      const d = docBy.get(g.id);
      const label = d ? courseLevel(d) : g.label;
      const num = d ? String(d.name ?? "").trim() : "";
      return { id: g.id, label: num && !label.endsWith(`${num}-guruh`) ? `${label} · ${num}` : label };
    }),
    groupId: sel?.id ?? null,
  };

  const memberIds = [...new Set(pool.flatMap((g) => g.studentIds))];
  if (!memberIds.length) return { ...base, rows: [] as BoardRow[], winners: [] };
  const pupils = (
    await db
      .collection("pupils")
      .find({ id: { $in: memberIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, grade: 1 } })
      .toArray()
  ).filter((p) => !isFrozenStatus(p.status));
  const ids = pupils.map((p) => Number(p.id));

  const sumBy = async (m: string) => {
    const match: Record<string, unknown> = { pupilId: { $in: ids }, status: "active", type: { $ne: "shop" }, date: monthRange(m) };
    if (sel) match.groupId = sel.id;
    const rows = await db
      .collection(GAM.tx)
      .aggregate<{ _id: number; s: number }>([{ $match: match }, { $group: { _id: "$pupilId", s: { $sum: "$amount" } } }])
      .toArray();
    return new Map(rows.map((r) => [Number(r._id), r.s]));
  };

  const [monthSums, wallets, labels] = await Promise.all([
    sumBy(month),
    db
      .collection(GAM.wallets)
      .find({ pupilId: { $in: ids } }, { projection: { _id: 0, pupilId: 1, balance: 1 } })
      .toArray()
      .then((rows) => new Map(rows.map((w) => [Number(w.pupilId), Number(w.balance) || 0]))),
    pupilGroupLabels(db, ids),
  ]);

  const rows: BoardRow[] = pupils
    .map((p) => {
      const pid = Number(p.id);
      const m = monthSums.get(pid) ?? 0;
      const b = wallets.get(pid) ?? 0;
      const g = Number(p.grade);
      return {
        pupilId: pid,
        name: pupilName(p),
        grade: Number.isInteger(g) && g >= 1 && g <= 11 ? g : null,
        groupLabel: labels.get(pid) ?? "",
        month: m,
        balance: b,
        points: opts.period === "month" ? m : b,
        rank: 0,
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "uz"));
  for (const r of rows) r.rank = 1 + rows.filter((x) => x.points > r.points).length;

  // O'tgan 3 oy g'oliblari (o'sha oydagi eng ko'p tanga; 0 — g'olib yo'q).
  const nameBy = new Map(rows.map((r) => [r.pupilId, r.name]));
  const winners: { month: string; pupilId: number; name: string; points: number }[] = [];
  for (let k = 1; k <= 3; k += 1) {
    const m = shiftMonth(month, -k);
    const sums = await sumBy(m);
    let best: { pid: number; s: number } | null = null;
    for (const [pid, s] of sums) {
      if (s <= 0) continue;
      if (!best || s > best.s || (s === best.s && (nameBy.get(pid) ?? "").localeCompare(nameBy.get(best.pid) ?? "", "uz") < 0)) best = { pid, s };
    }
    if (best) winners.push({ month: m, pupilId: best.pid, name: nameBy.get(best.pid) ?? `#${best.pid}`, points: best.s });
  }

  return { ...base, rows, winners };
}
