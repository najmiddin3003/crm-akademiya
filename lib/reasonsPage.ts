import type { Db } from "mongodb";
import { ABSENCE_REASONS } from "@/lib/attendance";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → O'QUV → «SABABLAR» (40-qism, rasm «Sozlamalar · Sabablar»). Ro'yxat — `settings_reasons` (eski tab
// bilan umumiy, /api/settings-lists?kind=reasons). Har sabab qayerda tanlanadi va qancha ishlatilgan (3 oy):
//   • Ketdi — o'quvchi holatini Arxiv/Muzlatilgan qilishda (`pupils.statusReason`, « — » gacha qismi);
//   • Bekor qilindi — eski buyurtma oynasida rad etish (`orders.note` dagi «Rad etish sababi: …»);
//   • Davomat — davomatda «sababli» belgilanganda (`attendance.reason`).
// Tur ro'yxati bo'sh bo'lsa o'sha joylar o'z standart ro'yxatini ishlatadi — sahifa ularni «standart» deb ko'rsatadi.

export const REASON_TYPES = ["Ketdi", "Bekor qilindi", "Davomat"] as const;
export type ReasonType = (typeof REASON_TYPES)[number];

/** Tur bo'sh bo'lganda ishlatiladigan standart ro'yxatlar (tegishli oynalardagidek). */
export const REASON_DEFAULTS: Record<ReasonType, string[]> = {
  Ketdi: [],
  "Bekor qilindi": ["Uyidagilar ruxsat bermabdi", "Boshqa o'quv markaziga boradigan bo'libdi", "Telefoni noto'g'ri ekan"],
  Davomat: ABSENCE_REASONS.filter((r) => r !== "Boshqa"),
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function reasonsPage(db: Db) {
  const today = uzDateIso();
  const d = new Date(`${today}T00:00:00Z`);
  const since = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  const [items, left, absences, rejected] = await Promise.all([
    db.collection(SETTINGS_LIST_KINDS.reasons).find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray(),
    db.collection("pupils").find({ status: { $ne: "Aktiv" }, statusChangedAt: { $gte: since } }, { projection: { _id: 0, statusReason: 1 } }).toArray(),
    db
      .collection("attendance")
      .aggregate<{ _id: string; n: number }>([{ $match: { date: { $gte: since }, reason: { $nin: [null, ""] } } }, { $group: { _id: "$reason", n: { $sum: 1 } } }])
      .toArray(),
    db.collection("orders").find({ note: { $regex: "Rad etish sababi: " } }, { projection: { _id: 0, note: 1 } }).toArray(),
  ]);
  const leftBy = new Map<string, number>();
  for (const p of left) {
    const k = String(p.statusReason ?? "").split(" — ")[0].trim();
    leftBy.set(k, (leftBy.get(k) ?? 0) + 1);
  }
  const absBy = new Map(absences.map((a) => [String(a._id), a.n]));
  const rejCount = (name: string) => rejected.filter((o) => new RegExp(`Rad etish sababi: ${esc(name)}(\\s·|$)`).test(String(o.note))).length;
  const countOf = (type: ReasonType, name: string) => (type === "Ketdi" ? (leftBy.get(name) ?? 0) : type === "Davomat" ? (absBy.get(name) ?? 0) : rejCount(name));

  const rows = items
    .filter((i) => REASON_TYPES.includes(i.type as ReasonType))
    .map((i) => ({ id: Number(i.id), name: String(i.name ?? ""), type: i.type as ReasonType, count: countOf(i.type as ReasonType, String(i.name ?? "")), system: !!i.system }));
  const named = new Set(rows.filter((r) => r.type === "Ketdi").map((r) => r.name));
  const ketdiWithout = [...leftBy.entries()].filter(([k]) => !named.has(k)).reduce((a, [, n]) => a + n, 0);
  return {
    ok: true as const,
    since,
    rows,
    // «Ketdi» uchun standart ro'yxat yo'q (sabab qo'lda yoziladi) — o'rniga oxirgi 3 oyda eng ko'p yozilganlar taklif qilinadi.
    defaults: Object.fromEntries(
      REASON_TYPES.map((t) => [
        t,
        rows.some((r) => r.type === t)
          ? []
          : t === "Ketdi"
            ? [...leftBy.entries()].filter(([k]) => k).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => ({ name, count }))
            : REASON_DEFAULTS[t].map((name) => ({ name, count: countOf(t, name) })),
      ]),
    ) as Record<ReasonType, { name: string; count: number }[]>,
    ketdiOther: ketdiWithout,
  };
}
