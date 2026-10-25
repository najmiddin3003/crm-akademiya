import type { Db } from "mongodb";
import { branchInCondition } from "@/lib/branchScope";
import { GROUP_MEMBERSHIPS, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";

// HISOBOTLAR → «KELGAN VA KETGAN» va «FAOL O'QUVCHILAR» (yangi versiya, 15-qism,
// 25.10.2026) — server hisobi. Route'lar: app/api/reports/student-flow,
// app/api/reports/active-students.
//
// «FAOL O'QUVCHI» — shu kuni guruhda o'qiyotgan o'quvchi: arxivlanmagan guruhda ochiq
// a'zoligi bor (`group_memberships`: joinedAt ≤ kun < leftAt). Bosh sahifadagi
// «Aktiv o'quvchilar» kartasi BOSHQA narsani sanaydi — `pupils.status = "Aktiv"`
// (guruhsiz eski yozuvlar ham, ko'zguda 5 050 ta, guruhda esa ~800). Hisobotlarda
// guruh bo'yicha olinadi, chunki «Faol o'quvchilar» kurs, guruh va o'qituvchi
// kesimida — guruhsiz o'quvchini hech qaysi kursga qo'yib bo'lmaydi.
//
// KELGAN / KETGAN — oy oxiridagi holatlar farqi (joriy oyda — bugungi):
//   kelgan(M) = M oxirida o'qiyotgan, M−1 oxirida o'qimagan o'quvchilar,
//   ketgan(M) = M−1 oxirida o'qigan, M oxirida o'qimayotganlar.
// Shu bois sof o'sish = kelgan − ketgan = faol(M) − faol(M−1) — jadvaldagi «Oy oxirida
// faol» ustuni bilan doim mos (rasmdagidek). Oy ichida kelib, shu oyning o'zida ketgan
// o'quvchi sanalmaydi; boshqa guruhga o'tkazilgan — ketgan emas.
//
// TARIX CHEGARASI: a'zolik yozuvlari 20.09.2026 dan yuritiladi (birinchi yozuv —
// `backfill`, qo'shilgan sanasi noma'lum). Undan oldingi kun uchun ro'yxatni tiklab
// bo'lmaydi: o'sha oy oxirining holati «noma'lum» (null), keyingi oyning
// kelgan/ketgani ham. Backfill a'zoligi tarix boshidan boshlangan deb olinadi.
// Arxivlangan guruh arxiv kunidan (yo'q bo'lsa — umuman) hisobga kirmaydi.

interface GroupDoc {
  id: number;
  name?: string;
  course?: string;
  level?: string;
  teacher?: string;
  branchId?: number | null;
  status?: string;
  archivedAt?: string | null;
}

type MemberDoc = Pick<GroupMembership, "groupId" | "pupilId" | "joinedAt" | "leftAt"> & { createdAt?: unknown };

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();
/** Guruh nomi (lib/groups.ts → groupLabel) — maydonlari bo'sh bo'lishi mumkin. */
const labelOfGroup = (g: GroupDoc) => groupLabel({ id: g.id, name: String(g.name ?? ""), course: String(g.course ?? "") });

/** "YYYY-MM" → oyning oxirgi kuni ("YYYY-MM-DD"). */
export function monthEndIso(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM" ± n oy. */
export function shiftMonthKey(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Oylar ro'yxati (ikkala chegara ham kiradi), ko'pi bilan 36 ta. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 36; m = shiftMonthKey(m, 1)) out.push(m);
  return out;
}

/** Timestamp (ISO yoki Date) → Toshkent kuni ("YYYY-MM-DD"); o'qib bo'lmasa null. */
function tashkentDay(v: unknown): string | null {
  const d = v instanceof Date ? v : typeof v === "string" ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

interface Loaded {
  groups: GroupDoc[];
  groupById: Map<number, GroupDoc>;
  memberships: MemberDoc[];
  /** A'zolik tarixining boshlanishi ("YYYY-MM-DD"); yozuv yo'q — bugun. */
  historyStart: string;
}

async function load(db: Db, branchIds: readonly number[], today: string): Promise<Loaded> {
  const groups = await db
    .collection<GroupDoc>("groups")
    .find(branchInCondition(branchIds), {
      projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1, status: 1, archivedAt: 1 },
    })
    .toArray();
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const [memberships, first] = await Promise.all([
    groups.length
      ? db
          .collection<MemberDoc>(GROUP_MEMBERSHIPS)
          .find({ groupId: { $in: groups.map((g) => g.id) } }, { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1, leftAt: 1 } })
          .toArray()
      : Promise.resolve([] as MemberDoc[]),
    // Tarix boshi — BUTUN kolleksiya bo'yicha (filialdan qat'i nazar): yozuv yuritish
    // hammasida bir kunda boshlangan.
    db.collection<MemberDoc>(GROUP_MEMBERSHIPS).find({}, { projection: { _id: 0, createdAt: 1 } }).sort({ _id: 1 }).limit(1).toArray(),
  ]);
  const historyStart = tashkentDay(first[0]?.createdAt) ?? today;
  return { groups, groupById, memberships, historyStart };
}

/** Shu kun oxirida o'qiyotgan o'quvchilar (yuqoridagi qoida). */
function activeAt(L: Loaded, day: string, groupOk: (g: GroupDoc) => boolean): Map<number, Set<number>> {
  // o'quvchi → shu kuni a'zo bo'lgan guruhlari
  const out = new Map<number, Set<number>>();
  for (const m of L.memberships) {
    const g = L.groupById.get(m.groupId);
    if (!g || !groupOk(g)) continue;
    const start = isoDateOrNull(m.joinedAt) ?? L.historyStart;
    if (start > day) continue;
    const left = isoDateOrNull(m.leftAt);
    if (left !== null && left <= day) continue;
    if ((g.status || "") === "archive") {
      const arch = isoDateOrNull(g.archivedAt);
      if (arch === null || arch <= day) continue;
    }
    let set = out.get(m.pupilId);
    if (!set) out.set(m.pupilId, (set = new Set()));
    set.add(g.id);
  }
  return out;
}

const courseFilter = (course: string | undefined) => {
  const key = norm(course);
  return key ? (g: GroupDoc) => norm(g.course) === key : () => true;
};

function courseNames(groups: GroupDoc[]): string[] {
  const seen = new Map<string, string>();
  for (const g of groups) {
    const name = String(g.course ?? "").trim();
    if (name && !seen.has(norm(name))) seen.set(norm(name), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/* ───────────────────────── Kelgan va ketgan ───────────────────────── */

export interface FlowMonth {
  /** "YYYY-MM" */
  month: string;
  /** Hisob kuni — oy oxiri yoki (joriy oyda) bugun. */
  endDate: string;
  /** Oy hali tugamagan. */
  partial: boolean;
  /** null — tarix boshlanmagan (noma'lum). */
  came: number | null;
  left: number | null;
  net: number | null;
  activeEnd: number | null;
}

export interface StudentFlowReport {
  asOf: string;
  historyStart: string;
  months: FlowMonth[];
  totals: { came: number; left: number; net: number };
  activeNow: number;
  /** O'tgan oy oxiridagi faollar (taqqoslash uchun); noma'lum — null. */
  activePrevEnd: number | null;
  prevMonth: string;
  courses: string[];
}

export async function computeStudentFlow(
  db: Db,
  branchIds: readonly number[],
  opts: { from: string; to: string; course?: string; today: string },
): Promise<StudentFlowReport> {
  const L = await load(db, branchIds, opts.today);
  const ok = courseFilter(opts.course);
  const curMonth = opts.today.slice(0, 7);
  const to = opts.to > curMonth ? curMonth : opts.to;
  const list = monthsBetween(opts.from > to ? to : opts.from, to);

  const known = (day: string) => day >= L.historyStart;
  const snap = new Map<string, Set<number> | null>();
  const snapshot = (day: string): Set<number> | null => {
    if (!known(day)) return null;
    if (!snap.has(day)) snap.set(day, new Set(activeAt(L, day, ok).keys()));
    return snap.get(day) ?? null;
  };
  const endOf = (month: string) => {
    const end = monthEndIso(month);
    return end > opts.today ? opts.today : end;
  };

  const months: FlowMonth[] = list.map((month) => {
    const endDate = endOf(month);
    const cur = snapshot(endDate);
    const prev = snapshot(monthEndIso(shiftMonthKey(month, -1)));
    let came: number | null = null;
    let left: number | null = null;
    if (cur && prev) {
      came = 0;
      left = 0;
      for (const p of cur) if (!prev.has(p)) came += 1;
      for (const p of prev) if (!cur.has(p)) left += 1;
    }
    return {
      month,
      endDate,
      partial: month === curMonth && endDate < monthEndIso(month),
      came,
      left,
      net: came === null || left === null ? null : came - left,
      activeEnd: cur ? cur.size : null,
    };
  });

  const totals = months.reduce(
    (t, m) => ({ came: t.came + (m.came ?? 0), left: t.left + (m.left ?? 0), net: t.net + (m.net ?? 0) }),
    { came: 0, left: 0, net: 0 },
  );
  const prevMonth = shiftMonthKey(curMonth, -1);
  const prevEnd = snapshot(monthEndIso(prevMonth));
  return {
    asOf: opts.today,
    historyStart: L.historyStart,
    months,
    totals,
    activeNow: snapshot(opts.today)?.size ?? 0,
    activePrevEnd: prevEnd ? prevEnd.size : null,
    prevMonth,
    courses: courseNames(L.groups.filter((g) => (g.status || "") !== "archive")),
  };
}

/* ───────────────────────── Faol o'quvchilar ───────────────────────── */

export interface ActiveGroupRow {
  id: number;
  label: string;
  course: string;
  level: string;
  teacher: string;
  branchId: number;
  status: string;
  students: number;
}

export interface ActiveStudentsReport {
  asOf: string;
  historyStart: string;
  /** Guruhda o'qiyotgan o'quvchilar (bir nechta guruhdagisi bir marta). */
  students: number;
  /** Ikki va undan ko'p guruhda o'qiyotganlar. */
  multiGroup: number;
  groups: ActiveGroupRow[];
  /** Kurs → shu kursdagi o'quvchilar (takrorsiz). */
  byCourse: { course: string; groups: number; students: number; teachers: number }[];
  /** O'qituvchi → uning guruhlaridagi o'quvchilar (takrorsiz). */
  byTeacher: { teacher: string; groups: number; students: number; courses: string[] }[];
  courses: string[];
}

export async function computeActiveStudents(db: Db, branchIds: readonly number[], opts: { course?: string; today: string }): Promise<ActiveStudentsReport> {
  const L = await load(db, branchIds, opts.today);
  const ok = courseFilter(opts.course);
  const live = (g: GroupDoc) => (g.status || "") !== "archive" && ok(g);
  const active = activeAt(L, opts.today, live);

  const perGroup = new Map<number, Set<number>>();
  for (const [pupil, groups] of active) {
    for (const gid of groups) {
      let set = perGroup.get(gid);
      if (!set) perGroup.set(gid, (set = new Set()));
      set.add(pupil);
    }
  }

  const groups: ActiveGroupRow[] = L.groups
    .filter(live)
    .map((g) => ({
      id: g.id,
      label: labelOfGroup(g),
      course: String(g.course ?? "").trim(),
      level: String(g.level ?? "").trim(),
      teacher: String(g.teacher ?? "").trim(),
      branchId: Number(g.branchId) || 1,
      status: g.status || "active",
      students: perGroup.get(g.id)?.size ?? 0,
    }))
    .sort((a, b) => b.students - a.students || a.label.localeCompare(b.label));

  const courseMap = new Map<string, { course: string; groups: number; pupils: Set<number>; teachers: Set<string> }>();
  const teacherMap = new Map<string, { teacher: string; groups: number; pupils: Set<number>; courses: Set<string> }>();
  for (const g of groups) {
    const pupils = perGroup.get(g.id) ?? new Set<number>();
    const ck = norm(g.course) || "—";
    let c = courseMap.get(ck);
    if (!c) courseMap.set(ck, (c = { course: g.course || "—", groups: 0, pupils: new Set(), teachers: new Set() }));
    c.groups += 1;
    for (const p of pupils) c.pupils.add(p);
    if (g.teacher) c.teachers.add(norm(g.teacher));

    const tk = norm(g.teacher) || "—";
    let t = teacherMap.get(tk);
    if (!t) teacherMap.set(tk, (t = { teacher: g.teacher || "—", groups: 0, pupils: new Set(), courses: new Set() }));
    t.groups += 1;
    for (const p of pupils) t.pupils.add(p);
    if (g.course) t.courses.add(g.course);
  }

  let multiGroup = 0;
  for (const set of active.values()) if (set.size > 1) multiGroup += 1;

  return {
    asOf: opts.today,
    historyStart: L.historyStart,
    students: active.size,
    multiGroup,
    groups,
    byCourse: [...courseMap.values()]
      .map((c) => ({ course: c.course, groups: c.groups, students: c.pupils.size, teachers: c.teachers.size }))
      .sort((a, b) => b.students - a.students || a.course.localeCompare(b.course)),
    byTeacher: [...teacherMap.values()]
      .map((t) => ({ teacher: t.teacher, groups: t.groups, students: t.pupils.size, courses: [...t.courses].sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.students - a.students || a.teacher.localeCompare(b.teacher)),
    courses: courseNames(L.groups.filter((g) => (g.status || "") !== "archive")),
  };
}
