import type { Db } from "mongodb";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → LIDLAR → «LID SOZLAMALARI» (40-qism) — ro'yxat qiymatlari shu oy necha marta tanlangani:
// fan/kurs (`orders.course`), yo'nalish (`yonalish`), qulay vaqt (`qulayVaqt`), sinf (`sinf`), rad sababi (`radSabab`).
// Lid yaratilgan kun — `created` («DD.MM.YYYY | HH:mm»; eski import yozuvlarida `createdAt`).
// O'quvchi turlari — O'quv bo'limi → Kategoriya (`edu_categories`), o'quvchilar soni `pupils.category` bo'yicha.

type Count = Record<string, number>;
const tally = (rows: Record<string, unknown>[], key: string): Count => {
  const out: Count = {};
  for (const r of rows) {
    const v = String(r[key] ?? "").trim();
    if (v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
};

export async function leadSettingsStats(db: Db) {
  const today = uzDateIso();
  const mm = `${today.slice(5, 7)}\\.${today.slice(0, 4)}`;
  const re = new RegExp(`^\\d\\d\\.${mm}`);
  const [orders, cats, pupils] = await Promise.all([
    db
      .collection("orders")
      .find({ $or: [{ created: re }, { createdAt: re }] }, { projection: { _id: 0, course: 1, yonalish: 1, qulayVaqt: 1, sinf: 1, radSabab: 1, holat: 1 } })
      .toArray(),
    db.collection("edu_categories").find({}, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
    db.collection("pupils").aggregate<{ _id: string; n: number }>([{ $match: { status: { $ne: "Arxiv" } } }, { $group: { _id: "$category", n: { $sum: 1 } } }]).toArray(),
  ]);
  const byCat = new Map(pupils.map((p) => [String(p._id ?? ""), p.n]));
  return {
    ok: true as const,
    month: today.slice(0, 7),
    leads: orders.length,
    course: tally(orders, "course"),
    yonalish: tally(orders, "yonalish"),
    vaqt: tally(orders, "qulayVaqt"),
    sinf: tally(orders, "sinf"),
    rad: tally(orders.filter((o) => o.holat === "rad"), "radSabab"),
    categories: cats.map((c) => ({ name: String(c.name ?? ""), pupils: byCat.get(String(c.name ?? "")) ?? 0 })),
    noCategory: pupils.filter((p) => !p._id).reduce((a, p) => a + p.n, 0),
  };
}
