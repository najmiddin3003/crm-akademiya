import type { Db } from "mongodb";
import { AI } from "./db";
import { uzDateIso } from "@/lib/uzTime";

// Sozlamalar → MohirAI (38-qism): rollar ro'yxati (Rahbar + `roles`), har rolda nechta xodim, joriy oyda savollar
// (rol bo'yicha, `ai_usage`) va amallar (`ai_actions`: tasdiqlangan / bekor qilingan, eng ko'p turlar).

export const AI_ACTION_LABELS: Record<string, { label: string; hint: string }> = {
  task: { label: "Topshiriq berish", hint: "kimga, muddat va ro'yxat" },
  lead: { label: "Lid qo'shish", hint: "telefonni xodim o'zi yozadi" },
  stage: { label: "Lid bosqichi", hint: "voronkada keyingi bosqichga" },
  kirim: { label: "Kirim", hint: "o'quvchi va oy bo'yicha" },
  chiqim: { label: "Chiqim", hint: "rol huquqiga qarab" },
  transfer: { label: "Kassaga ko'chirish", hint: "kassalar orasida" },
  comment: { label: "O'quvchiga izoh", hint: "o'quvchi tarixiga yoziladi" },
  pupil: { label: "O'quvchi qo'shish", hint: "yangi o'quvchi kartasi" },
  membership: { label: "Guruhga qo'shish", hint: "o'quvchini guruhga" },
  attendance: { label: "Davomat", hint: "darsga belgi qo'yish" },
  status: { label: "O'quvchi holati", hint: "aktiv, muzlatilgan, arxiv" },
};

export async function aiAdminOverview(db: Db) {
  const month = uzDateIso().slice(0, 7);
  const [roles, emps, users, usage, acts] = await Promise.all([
    db.collection("roles").find({}, { projection: { _id: 0, key: 1, name: 1 } }).toArray(),
    db.collection("hr_employees").find({ archived: { $ne: true } }, { projection: { _id: 0, id: 1, turi: 1 } }).toArray(),
    db.collection("users").find({ status: "active" }, { projection: { _id: 1, role: 1, hrEmployeeId: 1 } }).toArray(),
    db.collection(AI.usage).aggregate([{ $match: { day: { $gte: `${month}-01`, $lte: `${month}-31` } } }, { $group: { _id: "$userId", n: { $sum: "$count" } } }]).toArray(),
    db.collection(AI.actions).aggregate([{ $match: { createdAt: { $gte: new Date(`${month}-01T00:00:00+05:00`) } } }, { $group: { _id: { s: "$status", k: "$kind" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const turiOf = new Map(emps.map((e) => [Number(e.id), String(e.turi ?? "staff")]));
  const roleOfUser = new Map(users.map((u) => [String(u._id), u.role === "admin" ? "admin" : turiOf.get(Number(u.hrEmployeeId)) ?? "staff"]));
  const count = (k: string) => (k === "admin" ? users.filter((u) => u.role === "admin").length : emps.filter((e) => String(e.turi ?? "staff") === k).length);
  const list = [{ key: "admin", name: "Rahbar" }, ...roles.map((r) => ({ key: String(r.key), name: String(r.name ?? r.key) }))];
  const byRole = new Map<string, number>();
  for (const u of usage) {
    const k = roleOfUser.get(String(u._id)) ?? "staff";
    byRole.set(k, (byRole.get(k) ?? 0) + Number(u.n));
  }
  const kinds = new Map<string, number>();
  for (const a of acts) if (a._id.s === "done") kinds.set(a._id.k, (kinds.get(a._id.k) ?? 0) + a.n);
  return {
    month,
    roles: list.map((r) => ({ ...r, people: count(r.key), questions: byRole.get(r.key) ?? 0 })),
    questions: [...byRole.values()].reduce((a, b) => a + b, 0),
    done: acts.filter((a) => a._id.s === "done").reduce((s, a) => s + a.n, 0),
    cancelled: acts.filter((a) => a._id.s === "cancelled").reduce((s, a) => s + a.n, 0),
    topKinds: [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => AI_ACTION_LABELS[k]?.label ?? k),
    actionKinds: Object.entries(AI_ACTION_LABELS).map(([key, v]) => ({ key, ...v })),
  };
}
