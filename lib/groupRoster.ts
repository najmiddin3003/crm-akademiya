import type { Db } from "mongodb";
import { withBranch, type BranchScope } from "@/lib/branchScope";
import { GROUP_MEMBERSHIPS, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import type { AttendanceStatus } from "@/lib/attendance";

// GURUH O'QUVCHILARI (yangi versiya, 31-qism) — har guruh a'zolari, qo'shilgan kuni va oylik
// davomati. O'quvchining ismi, holati va balansi klientda /api/students/lists dan qo'shiladi
// (bitta pul qoidasi).
//
//   • a'zolar — ochiq `group_memberships`; a'zoligi yozilmagan eski bog'lanish (`groups.studentIds`)
//     ham olinadi (qo'shilgan kuni noma'lum);
//   • «2 / 2 dars» — shu oyda guruhda davomat qilingan kunlar (o'quvchi qo'shilgandan keyingilari)
//     va ulardan nechtasida keldi (keldi / kechikdi / birinchi dars);
//   • «qo'shilgandan beri kelmagan» — qo'shilgandan keyin davomat bo'lgan, lekin bir marta ham kelmagan;
//   • sig'im — guruhning o'zida (`capacity`, Yangi guruh oynasi) yoki xonaniki.

export interface RosterMember {
  pupilId: number;
  joinedAt: string | null;
  /** Shu oyda (qo'shilgandan keyin) davomat qilingan darslar. */
  held: number;
  /** Ulardan kelgani. */
  came: number;
  /** Qo'shilgandan beri davomat bo'lgan, lekin bir marta ham kelmagan. */
  neverCame: boolean;
}

export interface RosterGroup {
  id: number;
  name: string;
  course: string;
  level: string;
  teacher: string;
  day: string;
  time: string;
  room: string;
  status: string;
  /** Guruh sig'imi (o'rin); kiritilmagan — null. */
  capacity: number | null;
  /** Xona sig'imi; xona topilmasa — null. */
  roomCapacity: number | null;
  members: RosterMember[];
}

export interface RosterPayload {
  ok: true;
  month: string;
  groups: RosterGroup[];
}

const CAME: AttendanceStatus[] = ["keldi", "kechikdi", "birinchi"];
/** "YYYY-MM-DD" dan 183 kun oldingi sana. */
function sixMonthsBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 183);
  return d.toISOString().slice(0, 10);
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim();

export async function buildGroupRoster(db: Db, scope: BranchScope, month: string, today: string): Promise<RosterPayload> {
  const groups = await db
    .collection("groups")
    .find(withBranch({ status: { $nin: ["archive", "archived"] } }, scope), {
      projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, day: 1, time: 1, room: 1, status: 1, capacity: 1, studentIds: 1, branchId: 1 },
    })
    .sort({ id: 1 })
    .toArray();
  const ids = groups.map((g) => Number(g.id));
  const [memberships, rooms, marks] = await Promise.all([
    db
      .collection<GroupMembership>(GROUP_MEMBERSHIPS)
      .find({ groupId: { $in: ids }, $or: [{ leftAt: null }, { leftAt: "" }, { leftAt: { $exists: false } }] }, { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1 } })
      .toArray(),
    db.collection("rooms").find({}, { projection: { _id: 0, name: 1, capacity: 1, branchId: 1 } }).toArray(),
    // Shu oy (bugungacha) — darslar sanasi va kelganlar; «qo'shilgandan beri kelmagan» uchun o'tgan
    // oylar ham kerak — oxirgi ~6 oy olinadi (indeks: groupId + date), butun tarix emas.
    db
      .collection("attendance")
      .find({ groupId: { $in: ids }, date: { $gte: sixMonthsBefore(today), $lte: today } }, { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1, status: 1 } })
      .toArray(),
  ]);

  // Guruh → davomat qilingan kunlar; (guruh, o'quvchi) → kelgan kunlar.
  const heldDays = new Map<number, Set<string>>();
  const cameDays = new Map<string, Set<string>>();
  for (const m of marks) {
    const gid = Number(m.groupId);
    const day = s(m.date).slice(0, 10);
    if (!day) continue;
    let set = heldDays.get(gid);
    if (!set) heldDays.set(gid, (set = new Set()));
    set.add(day);
    if (CAME.includes(m.status as AttendanceStatus)) {
      const key = `${gid}:${Number(m.pupilId)}`;
      let c = cameDays.get(key);
      if (!c) cameDays.set(key, (c = new Set()));
      c.add(day);
    }
  }

  const memByGroup = new Map<number, Map<number, string | null>>();
  for (const m of memberships) {
    let mm = memByGroup.get(m.groupId);
    if (!mm) memByGroup.set(m.groupId, (mm = new Map()));
    const prev = mm.get(m.pupilId);
    const j = isoDateOrNull(m.joinedAt);
    if (prev === undefined || (j && (!prev || j < prev))) mm.set(m.pupilId, j);
  }

  const roomCap = (name: string, branchId: unknown): number | null => {
    const key = name.replace(/\s*-?\s*xona$/i, "").trim().toLowerCase();
    if (!key) return null;
    const bid = Number(branchId) || 1;
    const hit = rooms.find(
      (r) => s(r.name).replace(/\s*-?\s*xona$/i, "").trim().toLowerCase() === key && (Number(r.branchId) || 1) === bid,
    );
    const cap = Number(hit?.capacity);
    return Number.isFinite(cap) && cap > 0 ? cap : null;
  };

  const out: RosterGroup[] = groups.map((g) => {
    const gid = Number(g.id);
    const mm = new Map(memByGroup.get(gid) ?? []);
    for (const pid of (g.studentIds as number[] | undefined) ?? []) if (!mm.has(Number(pid))) mm.set(Number(pid), null);
    const days = [...(heldDays.get(gid) ?? [])].sort();
    const members: RosterMember[] = [...mm.entries()].map(([pupilId, joinedAt]) => {
      const since = days.filter((d) => !joinedAt || d >= joinedAt);
      const inMonth = since.filter((d) => d.startsWith(month));
      const came = cameDays.get(`${gid}:${pupilId}`) ?? new Set<string>();
      return {
        pupilId,
        joinedAt,
        held: inMonth.length,
        came: inMonth.filter((d) => came.has(d)).length,
        neverCame: since.length > 0 && !since.some((d) => came.has(d)),
      };
    });
    const cap = Number(g.capacity);
    return {
      id: gid,
      name: s(g.name) || String(gid),
      course: s(g.course),
      level: s(g.level),
      teacher: s(g.teacher),
      day: s(g.day),
      time: s(g.time),
      room: s(g.room),
      status: s(g.status) || "active",
      capacity: Number.isFinite(cap) && cap > 0 ? cap : null,
      roomCapacity: roomCap(s(g.room), g.branchId),
      members,
    };
  });

  return { ok: true, month, groups: out };
}
