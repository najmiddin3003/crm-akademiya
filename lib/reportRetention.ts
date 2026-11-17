import type { Db } from "mongodb";
import { branchInCondition, type BranchScope } from "@/lib/branchScope";
import { computeDebtors } from "@/lib/debtors";
import { GROUP_MEMBERSHIPS } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { pupilFullName } from "@/lib/pupilsData";
import { uzDateIso } from "@/lib/uzTime";

// HISOBOTLAR (35-qism) — GURUH A'ZOLIGI ASOSIDAGI IKKI HISOBOT.
//
// «KETISH SABABLARI» (rasm «Ketish sabablari»): davrda guruhdan chiqqan o'quvchilar (`group_memberships.leftAt`).
//   Guruh tugagan/arxivlangan kuni chiqqanlar — «bitirdi», ular kirmaydi. Sabab — o'quvchi arxivga o'tganda
//   yozilgan `statusReason` («Narx — chegirma so'radi»: « — » gacha — sabab, keyini — izoh), arxivda bo'lmasa
//   «Sabab yozilmagan». Qarz — qarzdorlar hisobidan (bugungi holat). «Qaytib keldi» — keyinroq yana guruhga
//   qo'shilgan.
// «O'QITUVCHILAR SAMARADORLIGI» (rasm «O'qituvchilar samaradorligi»): har ustoz guruhlarida davr boshida,
//   qo'shilgan, ketgan, bitirgan, muzlatilgan va davr oxirida. Saqlab qolish = 1 − ketgan ÷ (boshida + qo'shilgan);
//   bitirgan va muzlatilganlar ketgan hisoblanmaydi.

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const near = (a: string | null | undefined, b: string, n = 3) => !!a && Math.abs(days(a.slice(0, 10), b)) <= n;

interface GroupDoc {
  id: number;
  name: string;
  course: string;
  level?: string;
  teacher: string;
  branchId?: number;
  status?: string;
  endDate?: string;
  archivedAt?: string;
}
interface MemDoc {
  groupId: number;
  pupilId: number;
  joinedAt: string | null;
  leftAt: string | null;
}

async function base(db: Db, branchIds: number[]) {
  const groups = (await db
    .collection("groups")
    .find(branchInCondition(branchIds), { projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1, status: 1, endDate: 1, archivedAt: 1 } })
    .toArray()) as unknown as GroupDoc[];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const mems = (await db
    .collection(GROUP_MEMBERSHIPS)
    .find({ groupId: { $in: groups.map((g) => g.id) } }, { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1, leftAt: 1 } })
    .toArray()) as unknown as MemDoc[];
  const pupils = await db
    .collection("pupils")
    .find({ id: { $in: [...new Set(mems.map((m) => m.pupilId))] } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, status: 1, statusReason: 1, statusChangedAt: 1, branchId: 1 } })
    .toArray();
  const pupilById = new Map(pupils.map((p) => [Number(p.id), p]));
  const branches = await db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
  const bName = new Map(branches.map((b) => [Number(b.id), String(b.name)]));
  return { groups, byId, mems, pupilById, bName };
}

/** Guruh shu kuni tugaganmi (bitirish). */
function groupEndedAt(g: GroupDoc | undefined, iso: string): boolean {
  if (!g) return false;
  return near(g.archivedAt, iso) || (!!g.endDate && g.endDate <= iso) || (g.status === "archived" && !g.archivedAt);
}

export interface LeaveRow {
  pupilId: number;
  name: string;
  leftAt: string;
  months: number;
  group: string;
  course: string;
  teacher: string;
  branch: string;
  debt: number;
  reason: string;
  comment: string;
  returned: boolean;
}
export interface LeaveReport {
  from: string;
  to: string;
  rows: LeaveRow[];
  reasons: { reason: string; count: number }[];
  when: { first: number; second: number; later: number };
  courses: { course: string; left: number; pct: number }[];
  courses_all: string[];
  teachers: string[];
}

export async function computeLeaveReasons(db: Db, scope: BranchScope, branchIds: number[], from: string, to: string, f: { course?: string; teacher?: string }): Promise<LeaveReport> {
  const { byId, mems, pupilById, bName } = await base(db, branchIds);
  const debtByPupil = new Map<number, number>();
  for (const b of [...new Set(branchIds)]) {
    const today = uzDateIso();
    const rep = await computeDebtors(db, { ...scope, branchId: b }, to < today ? to : today);
    for (const r of rep.rows) if (r.debt > 0) debtByPupil.set(r.id, r.debt);
  }
  const rows: LeaveRow[] = [];
  for (const m of mems) {
    if (!m.leftAt || m.leftAt < from || m.leftAt > to) continue;
    const g = byId.get(m.groupId);
    if (!g || groupEndedAt(g, m.leftAt)) continue;
    if ((f.course && g.course !== f.course) || (f.teacher && g.teacher !== f.teacher)) continue;
    const p = pupilById.get(m.pupilId);
    const archivedNow = p?.status === "Arxiv" && near(String(p.statusChangedAt ?? ""), m.leftAt, 10);
    const [reason, ...rest] = (archivedNow ? String(p?.statusReason ?? "") : "").split(" — ");
    const later = mems.some((x) => x.pupilId === m.pupilId && x.joinedAt && x.joinedAt > m.leftAt!);
    rows.push({
      pupilId: m.pupilId,
      name: p ? pupilFullName(p as never) : `#${m.pupilId}`,
      leftAt: m.leftAt,
      months: m.joinedAt ? Math.max(0, days(m.joinedAt, m.leftAt)) / 30 : 0,
      group: groupLabel(g as never),
      course: g.course,
      teacher: g.teacher,
      branch: bName.get(Number(g.branchId) || 1) ?? "",
      debt: debtByPupil.get(m.pupilId) ?? 0,
      reason: reason.trim() || (p?.status === "Aktiv" ? "Boshqa guruhda davom etyapti" : "Sabab yozilmagan"),
      comment: rest.join(" — ").trim(),
      returned: later,
    });
  }
  rows.sort((a, b) => b.leftAt.localeCompare(a.leftAt));
  const rc = new Map<string, number>();
  for (const r of rows) rc.set(r.reason, (rc.get(r.reason) ?? 0) + 1);
  const cc = new Map<string, number>();
  for (const r of rows) cc.set(r.course, (cc.get(r.course) ?? 0) + 1);
  const courseBase = (course: string) => new Set(mems.filter((m) => byId.get(m.groupId)?.course === course && (!m.joinedAt || m.joinedAt <= to) && (!m.leftAt || m.leftAt >= from)).map((m) => m.pupilId)).size;
  return {
    from,
    to,
    rows,
    reasons: [...rc.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    when: { first: rows.filter((r) => r.months <= 1.05).length, second: rows.filter((r) => r.months > 1.05 && r.months <= 3.1).length, later: rows.filter((r) => r.months > 3.1).length },
    courses: [...cc.entries()].map(([course, left]) => ({ course, left, pct: Math.round((left / Math.max(1, courseBase(course))) * 100) })).sort((a, b) => b.left - a.left),
    courses_all: [...new Set([...byId.values()].map((g) => g.course).filter(Boolean))].sort(),
    teachers: [...new Set([...byId.values()].map((g) => g.teacher).filter(Boolean))].sort(),
  };
}

export interface TeacherPerfRow {
  teacher: string;
  sub: string;
  groups: number;
  start: number;
  joined: number;
  left: number;
  finished: number;
  frozen: number;
  end: number;
  retention: number | null;
}
export interface TeacherPerfReport {
  from: string;
  to: string;
  rows: TeacherPerfRow[];
  total: TeacherPerfRow;
  courses: string[];
}

export async function computeTeacherPerf(db: Db, branchIds: number[], from: string, to: string, course?: string): Promise<TeacherPerfReport> {
  const { groups, byId, mems, pupilById } = await base(db, branchIds);
  const active = (m: MemDoc, at: string) => (!m.joinedAt || m.joinedAt <= at) && (!m.leftAt || m.leftAt > at);
  const make = (teacher: string, gs: GroupDoc[]): TeacherPerfRow => {
    const ids = new Set(gs.map((g) => g.id));
    const my = mems.filter((m) => ids.has(m.groupId));
    let left = 0;
    let finished = 0;
    let frozen = 0;
    for (const m of my) {
      if (!m.leftAt || m.leftAt < from || m.leftAt > to) continue;
      const p = pupilById.get(m.pupilId);
      if (groupEndedAt(byId.get(m.groupId), m.leftAt)) finished += 1;
      else if (p?.status === "Muzlatilgan" && near(String(p.statusChangedAt ?? ""), m.leftAt, 10)) frozen += 1;
      else left += 1;
    }
    const start = my.filter((m) => active(m, from)).length;
    const joined = my.filter((m) => m.joinedAt && m.joinedAt > from && m.joinedAt <= to).length;
    const levels = [...new Set(gs.map((g) => [g.course, g.level].filter(Boolean).join(" · ")))];
    return {
      teacher,
      sub: levels.slice(0, 3).join(", "),
      groups: gs.filter((g) => my.some((m) => m.groupId === g.id && active(m, to))).length,
      start,
      joined,
      left,
      finished,
      frozen,
      end: my.filter((m) => active(m, to)).length,
      retention: start + joined ? Math.round((1 - left / (start + joined)) * 100) : null,
    };
  };
  const byTeacher = new Map<string, GroupDoc[]>();
  for (const g of groups) {
    if (!g.teacher || (course && g.course !== course)) continue;
    byTeacher.set(g.teacher, [...(byTeacher.get(g.teacher) ?? []), g]);
  }
  const rows = [...byTeacher.entries()].map(([t, gs]) => make(t, gs)).filter((r) => r.start + r.joined + r.end > 0).sort((a, b) => b.end - a.end);
  const total = make("Jami", groups.filter((g) => g.teacher && (!course || g.course === course)));
  return { from, to, rows, total, courses: [...new Set(groups.map((g) => g.course).filter(Boolean))].sort() };
}
