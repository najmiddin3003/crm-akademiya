import type { Db } from "mongodb";
import { loadDiscountRules } from "@/lib/discountRules";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { computeExceptions } from "@/lib/priceExceptions";
import { uzDateIso } from "@/lib/uzTime";

// Sozlamalar → Chegirmalar sahifasi ma'lumoti (39-qism): qoidalar (lib/discountRules.ts), shu oy berilgan imtiyozlar
// va tasdiq kutayotganlar (lib/priceExceptions.ts → computeExceptions), avtomatik chegirmalar yoqilsa kimga mos
// kelishi (faqat sanaladi — hech narsa qo'llanmaydi):
//   • ikki kurs — bir vaqtda 2+ faol guruhda o'qiyotganlar (`group_memberships`, leftAt yo'q);
//   • aka-uka — ona telefoni bir xil 2+ faol o'quvchi (`pupils.motherPhone`), ikkinchi va keyingi farzandlar.
export async function discountSettingsPage(db: Db, branchIds: number[]) {
  const month = uzDateIso().slice(0, 7);
  const [rules, report, multi, families, log] = await Promise.all([
    loadDiscountRules(db),
    computeExceptions(db, branchIds, month, { isAdmin: true }),
    db
      .collection(GROUP_MEMBERSHIPS)
      .aggregate<{ n: number }>([{ $match: { leftAt: null } }, { $group: { _id: "$pupilId", g: { $addToSet: "$groupId" } } }, { $match: { "g.1": { $exists: true } } }, { $count: "n" }])
      .toArray(),
    db
      .collection("pupils")
      .aggregate<{ n: number }>([
        { $match: { status: { $ne: "Arxiv" }, motherPhone: { $nin: [null, ""] } } },
        { $group: { _id: "$motherPhone", c: { $sum: 1 } } },
        { $match: { c: { $gte: 2 } } },
        { $group: { _id: null, n: { $sum: { $subtract: ["$c", 1] } } } },
      ])
      .toArray(),
    db.collection("feature_log").find({ scope: "discount_rules" }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(5).toArray(),
  ]);
  const pupils = new Set(report.rows.filter((r) => r.status !== "rejected" && r.status !== "pending").map((r) => r.pupilName)).size;
  return {
    ok: true as const,
    month,
    rules,
    total: report.total,
    pupils,
    kpi: report.kpi,
    pending: report.pending.slice(0, 3).map((p) => ({ id: p.id, pupilName: p.pupilName, type: p.type, amount: p.amount, basePrice: p.basePrice, percent: p.percent, createdBy: p.createdBy, createdAt: p.createdAt })),
    pendingCount: report.pending.length,
    preview: { twoCourses: multi[0]?.n ?? 0, sibling: families[0]?.n ?? 0 },
    log: log.map((l) => ({ text: String(l.text), by: String(l.by ?? ""), at: String(l.at) })),
  };
}
