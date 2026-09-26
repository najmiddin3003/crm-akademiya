import type { Db, Document } from "mongodb";
import { GAM } from "./db";
import { isFrozenStatus } from "./wallet";

// GURUH REYTINGI (TZ 4.3).
//
// Reyting tangasi = shu guruhdagi FAOL yozuvlarning so'ralgan miqdori
// (`amount`) yig'indisi — xarid kirmaydi, balansdan mustaqil (ayirish
// balans 0 bo'lsa ham reytingda ko'rinadi). Guruhsiz yozuvlar kirmaydi.
// Muzlatilgan (ketgan) o'quvchi ko'rsatilmaydi. Teng tangalilar teng o'rin
// oladi (1, 2, 2, 4) va ism bo'yicha joylashadi.

export interface RankRow {
  pupilId: number;
  name: string;
  points: number;
  rank: number;
}

export function pupilName(p: { firstName?: unknown; lastName?: unknown; id?: unknown } | Document): string {
  return `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim() || `#${p.id}`;
}

/** "2026-09" → shu oy chegaralari bo'yicha sana filtri. */
export function monthRange(month: string): { $gte: string; $lte: string } {
  return { $gte: `${month}-01`, $lte: `${month}-31` };
}

/**
 * Guruh reytingi. `month` — "YYYY-MM" (joriy oy) yoki null (jami).
 * A'zolar — guruhning HOZIRGI tarkibi (`studentIds`), muzlatilganlarsiz.
 */
export async function groupRanking(
  db: Db,
  g: { id: number; studentIds: number[] },
  month: string | null,
): Promise<RankRow[]> {
  if (!g.studentIds.length) return [];
  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: g.studentIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1 } })
    .toArray();
  const active = pupils.filter((p) => !isFrozenStatus(p.status));
  const ids = active.map((p) => Number(p.id));
  const match: Record<string, unknown> = { groupId: g.id, pupilId: { $in: ids }, status: "active", type: { $ne: "shop" } };
  if (month) match.date = monthRange(month);
  const sums = await db
    .collection(GAM.tx)
    .aggregate<{ _id: number; s: number }>([{ $match: match }, { $group: { _id: "$pupilId", s: { $sum: "$amount" } } }])
    .toArray();
  const by = new Map(sums.map((x) => [Number(x._id), x.s]));
  const rows = active
    .map((p) => ({ pupilId: Number(p.id), name: pupilName(p), points: by.get(Number(p.id)) ?? 0, rank: 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "uz"));
  for (const r of rows) r.rank = 1 + rows.filter((x) => x.points > r.points).length;
  return rows;
}
