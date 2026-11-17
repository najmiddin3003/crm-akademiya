import type { Db, Document } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { createdIso, reachedStep, type LeadLike } from "@/lib/financeAnalytics";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { holatOf } from "@/lib/leadHolat";

// HISOBOTLAR (35-qism) — LIDLAR ASOSIDAGI IKKI HISOBOT.
//
// «SOTUV VORONKASI» (rasm «Sotuv voronkasi»): davrda yozilgan lidlar besh bosqichda —
//   0 Lid yozildi → 1 Bog'lanildi → 2 Birinchi darsga yozildi → 3 Birinchi darsga keldi → 4 Birinchi to'lov.
//   Bosqich: lid yetib borgan eng yuqori holat (lib/financeAnalytics.ts → reachedStep, tarix hisobga olinadi);
//   «keldi» — birinchi dars natijasi KELDI/GURUHGA_QOSHILDI yoki guruhga qo'shilgan; «to'lov» — lid aylangan
//   o'quvchining kamida bitta kirimi (bekor qilinmagan). Rad etilgan lid — o'zi to'xtagan bosqichda «yopildi»,
//   sababi `radSabab`. Rad etilmagan va oxirigacha yetmagan — «jarayonda».
// «ADMINISTRATORLAR SAMARADORLIGI» (rasm «Administratorlar samaradorligi»): o'sha bosqichlar lid admini
//   (`orders.moderator`) bo'yicha; birinchi javob — lid yozilgandan birinchi holat o'zgarishigacha (holat tarixi
//   bo'lsa); «1-oyda ketdi» — shu lidlardan o'quvchi bo'lib, birinchi guruhidan 31 kun ichida chiqqanlar;
//   «lidsiz qo'shilgan» — davrda guruhga qo'shilgan, lekin lidi yo'q o'quvchilar.

export const STAGE_LABELS = ["Lid yozildi", "Bog'lanildi", "Birinchi darsga yozildi", "Birinchi darsga keldi", "Birinchi to'lov"] as const;
const CAME = ["KELDI", "GURUHGA_QOSHILDI"];

export interface LeadRow {
  id: number;
  name: string;
  date: string;
  hm: string;
  source: string;
  course: string;
  branchId: number;
  admin: string;
  stage: number;
  rad: boolean;
  radSabab: string;
  pupilId: number | null;
  firstResponseMin: number | null;
}

interface Ctx {
  leads: LeadRow[];
  paidPupils: Set<number>;
}

function stampMs(date: string, hm: string): number {
  return Date.parse(`${date}T${hm || "00:00"}:00Z`);
}
function eventMs(at: unknown): number | null {
  const s = String(at ?? "");
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(s);
  if (m) return stampMs(m[1], m[2]);
  const d = /^(\d{2})\.(\d{2})\.(\d{4}) \| (\d{2}:\d{2})/.exec(s);
  return d ? stampMs(`${d[3]}-${d[2]}-${d[1]}`, d[4]) : null;
}

async function loadLeads(db: Db, branchIds: number[], from: string, to: string): Promise<Ctx> {
  const docs = await db
    .collection("orders")
    .find(branchInCondition(branchIds), {
      projection: { _id: 0, id: 1, name: 1, createdAt: 1, source: 1, course: 1, yonalish: 1, branchId: 1, moderator: 1, holat: 1, status: 1, leadStatus: 1, firstLesson: 1, firstLessonStatus: 1, groupId: 1, stage: 1, radSabab: 1, holatTarix: 1, pupilId: 1 },
    })
    .toArray();
  const inRange = docs.filter((o) => {
    const d = createdIso(o.createdAt);
    return d && d >= from && d <= to;
  });
  const pupilIds = inRange.map((o) => Number(o.pupilId)).filter((x) => Number.isFinite(x) && x > 0);
  const paid = pupilIds.length
    ? await db.collection("transaction_entries").distinct("pupilId", { txType: "payIn", status: { $ne: "cancelled" }, pupilId: { $in: pupilIds } })
    : [];
  const paidPupils = new Set(paid.map(Number));
  const leads: LeadRow[] = inRange.map((o) => {
    const date = createdIso(o.createdAt);
    const hm = /\| (\d{2}:\d{2})/.exec(String(o.createdAt ?? ""))?.[1] ?? "";
    const reached = reachedStep(o as unknown as LeadLike);
    const pid = Number.isFinite(Number(o.pupilId)) && Number(o.pupilId) > 0 ? Number(o.pupilId) : null;
    const came = CAME.includes(String(o.firstLessonStatus ?? "")) || reached >= 3;
    let stage = reached >= 2 ? 2 : reached;
    if (came) stage = 3;
    if (pid !== null && paidPupils.has(pid)) stage = 4;
    const events = ((o.holatTarix ?? []) as Document[]).filter((e) => e.kind === "holat");
    const first = events.length ? eventMs(events[0].at) : null;
    const created = date ? stampMs(date, hm) : null;
    return {
      id: Number(o.id),
      name: String(o.name ?? ""),
      date,
      hm,
      source: String(o.source || "Noma'lum").trim() || "Noma'lum",
      course: String(o.course || o.yonalish || "Kurs tanlanmagan").trim(),
      branchId: Number(o.branchId) || 1,
      admin: String(o.moderator || "").trim() || "Biriktirilmagan",
      stage,
      rad: holatOf(o as never) === "rad",
      radSabab: String(o.radSabab ?? "").trim(),
      pupilId: pid,
      firstResponseMin: first !== null && created !== null && first >= created ? Math.round((first - created) / 60000) : null,
    };
  });
  return { leads, paidPupils };
}

export interface FunnelStage {
  label: string;
  count: number;
  closed: number;
  waiting: number;
}
export interface FunnelCut {
  key: string;
  counts: [number, number, number, number, number];
}
export interface FunnelReport {
  from: string;
  to: string;
  total: number;
  stages: FunnelStage[];
  waiting: { stage: number; count: number }[];
  reasons: { reason: string; count: number; beforeLesson: number; topSource: string; topSourceN: number }[];
  closed: number;
  cuts: { source: FunnelCut[]; branch: FunnelCut[]; admin: FunnelCut[]; course: FunnelCut[] };
  branchNames: Record<number, string>;
}

function cut(leads: LeadRow[], keyOf: (l: LeadRow) => string): FunnelCut[] {
  const m = new Map<string, FunnelCut>();
  for (const l of leads) {
    const k = keyOf(l);
    const c = m.get(k) ?? { key: k, counts: [0, 0, 0, 0, 0] };
    for (let i = 0; i <= l.stage; i++) c.counts[i] += 1;
    m.set(k, c);
  }
  return [...m.values()].sort((a, b) => b.counts[0] - a.counts[0]);
}

export async function computeFunnel(db: Db, branchIds: number[], from: string, to: string, f: { source?: string; course?: string; admin?: string }): Promise<FunnelReport> {
  const { leads: all } = await loadLeads(db, branchIds, from, to);
  const leads = all.filter((l) => (!f.source || l.source === f.source) && (!f.course || l.course === f.course) && (!f.admin || l.admin === f.admin));
  const stages: FunnelStage[] = STAGE_LABELS.map((label, i) => ({
    label,
    count: leads.filter((l) => l.stage >= i).length,
    closed: leads.filter((l) => l.rad && l.stage === i).length,
    waiting: leads.filter((l) => !l.rad && l.stage === i).length,
  }));
  const rad = leads.filter((l) => l.rad);
  const byReason = new Map<string, LeadRow[]>();
  for (const l of rad) {
    const k = l.radSabab || "Sabab yozilmagan";
    byReason.set(k, [...(byReason.get(k) ?? []), l]);
  }
  const reasons = [...byReason.entries()]
    .map(([reason, ls]) => {
      const src = new Map<string, number>();
      for (const l of ls) src.set(l.source, (src.get(l.source) ?? 0) + 1);
      const top = [...src.entries()].sort((a, b) => b[1] - a[1])[0];
      return { reason, count: ls.length, beforeLesson: ls.filter((l) => l.stage < 3).length, topSource: top?.[0] ?? "", topSourceN: top?.[1] ?? 0 };
    })
    .sort((a, b) => b.count - a.count);
  const branches = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  return {
    from,
    to,
    total: leads.length,
    stages,
    waiting: [0, 1, 2, 3].map((stage) => ({ stage, count: stages[stage].waiting })),
    reasons,
    closed: rad.length,
    cuts: {
      source: cut(leads, (l) => l.source),
      branch: cut(leads, (l) => String(l.branchId)),
      admin: cut(leads, (l) => l.admin),
      course: cut(leads, (l) => l.course),
    },
    branchNames: Object.fromEntries(branches.map((b) => [Number(b.id), String(b.name)])),
  };
}

export interface AdminRow {
  admin: string;
  counts: [number, number, number, number, number];
  avgResponse: number | null;
  buckets: [number, number, number];
  firstMonthLeft: number;
}
export interface AdminReport {
  from: string;
  to: string;
  rows: AdminRow[];
  total: AdminRow;
  noLead: number;
  evening: { count: number; converted: number; dayConv: number | null };
}

export async function computeAdminPerf(db: Db, branchIds: number[], from: string, to: string, course?: string): Promise<AdminReport> {
  const { leads: all } = await loadLeads(db, branchIds, from, to);
  const leads = all.filter((l) => !course || l.course === course);
  const pupilIds = leads.map((l) => l.pupilId).filter((x): x is number => x !== null);
  const mems = pupilIds.length ? await db.collection(GROUP_MEMBERSHIPS).find({ pupilId: { $in: pupilIds } }, { projection: { _id: 0, pupilId: 1, joinedAt: 1, leftAt: 1 } }).sort({ joinedAt: 1 }).toArray() : [];
  const leftEarly = new Set<number>();
  for (const pid of pupilIds) {
    const m = mems.find((x) => Number(x.pupilId) === pid);
    if (m?.joinedAt && m.leftAt && (Date.parse(String(m.leftAt)) - Date.parse(String(m.joinedAt))) / 86_400_000 <= 31) leftEarly.add(pid);
  }
  const build = (admin: string, ls: LeadRow[]): AdminRow => {
    const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const l of ls) for (let i = 0; i <= l.stage; i++) counts[i] += 1;
    const resp = ls.map((l) => l.firstResponseMin).filter((x): x is number => x !== null);
    return {
      admin,
      counts,
      avgResponse: resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null,
      buckets: [resp.filter((x) => x <= 15).length, resp.filter((x) => x > 15 && x <= 60).length, resp.filter((x) => x > 60).length],
      firstMonthLeft: ls.filter((l) => l.pupilId !== null && leftEarly.has(l.pupilId)).length,
    };
  };
  const byAdmin = new Map<string, LeadRow[]>();
  for (const l of leads) byAdmin.set(l.admin, [...(byAdmin.get(l.admin) ?? []), l]);
  const rows = [...byAdmin.entries()].map(([a, ls]) => build(a, ls)).sort((a, b) => b.counts[0] - a.counts[0]);

  // Lidsiz: davrda guruhga qo'shilgan, lekin hech bir lidi yo'q o'quvchilar.
  const groups = await db.collection("groups").find(branchInCondition(branchIds), { projection: { _id: 0, id: 1 } }).toArray();
  const joined = await db.collection(GROUP_MEMBERSHIPS).distinct("pupilId", { groupId: { $in: groups.map((g) => Number(g.id)) }, joinedAt: { $gte: from, $lte: to } });
  const withLead = new Set((await db.collection("orders").distinct("pupilId", { pupilId: { $in: joined } })).map(Number));
  const evening = leads.filter((l) => l.hm >= "18:00");
  const day = leads.filter((l) => l.hm && l.hm < "18:00");
  return {
    from,
    to,
    rows,
    total: build("Jami", leads),
    noLead: joined.filter((p) => !withLead.has(Number(p))).length,
    evening: { count: evening.length, converted: evening.filter((l) => l.stage === 4).length, dayConv: day.length ? Math.round((day.filter((l) => l.stage === 4).length / day.length) * 100) : null },
  };
}
