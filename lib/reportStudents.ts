import type { Db } from "mongodb";
import { branchInCondition, type BranchScope } from "@/lib/branchScope";
import { normalizeCourseCategory } from "@/lib/courseCategories";
import { GROUP_MEMBERSHIPS, isoDateOrNull, type GroupMembership } from "@/lib/groupMembership";
import { groupLabel } from "@/lib/groups";
import { loadPayStatus, loadRoomCapacity, poolKey } from "@/lib/reportActiveSeats";

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
  /** Xona nomi — «Faol o'quvchilar» sig'imi uchun. */
  room?: string;
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
      projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1, status: 1, archivedAt: 1, room: 1 },
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
//
// 27-qism (rasmlar 47–50, 14.11.2026): tanlangan KUN holatiga — kurs (kategoriya bo'yicha
// guruhlangan), guruh (filial → guruh) va o'qituvchi (filial → o'qituvchi) kesimida.
//
// O'RIN — (o'quvchi, guruh) juftligi: shu kuni guruhda ochiq a'zolik. Jadvallardagi
// «O'quvchilar» va «Jami» — o'rinlar (ikki guruhdagi bola ikki marta), «Faol o'quvchilar»
// kartasi esa takrorsiz o'quvchilar — «Kelgan va ketgan» bilan bir xil (yuqoridagi qoida).
// Sig'im ham o'rin bo'yicha: guruhdagi har o'quvchi xonadan bitta o'rin egallaydi.
//
// +/− (oy ustuni) — «Kelgan va ketgan» qoidasi har qator ichida: o'tgan oy oxirida shu
// qatorda (kurs, guruh, filial, o'qituvchi, kategoriya) yo'q edi, hozir bor — «+»; aksincha
// — «−». Shu bois kurs qatorlari yig'indisi «Jami»dan farq qilishi mumkin: bir kursdan
// boshqasiga o'tgan bola kurslarda +1/−1, jami bo'yicha esa ketgan emas.
//
// To'lov holati va sig'im — lib/reportActiveSeats.ts.

export interface ActiveCounts {
  /** O'rinlar (o'quvchi × guruh). */
  seats: number;
  /** Faol guruhlar (o'quvchisi bor yoki bugun ochiq). */
  groups: number;
  /** Oy boshidan beri qatorga qo'shilgan / chiqqan o'quvchilar; tarix yo'q — null. */
  came: number | null;
  left: number | null;
  paid: number;
  debt: number;
  notDue: number;
  /** Narxi/jadvali noma'lum guruhdagi qarzsiz o'rinlar — to'lov holati taxminiy (hisob 0). */
  unknownPrice: number;
  /** Sig'imi ma'lum guruhlar: jami sig'im (yo'q — null), ulardagi o'rinlar, bo'sh o'rinlar. */
  capacity: number | null;
  capSeats: number;
  free: number;
  /** Sig'imi noma'lum faol guruhlar. */
  noCapGroups: number;
}

export interface ActiveGroupRow extends ActiveCounts {
  id: number;
  /** Guruh nomi (kod, «MATH») — bo'sh bo'lishi mumkin. */
  name: string;
  /** «Matematika (MATH-guruh)» — lib/groups.ts → groupLabel. */
  label: string;
  course: string;
  category: string;
  level: string;
  teacher: string;
  /** Hovuz vakili (1+2 → 1). */
  branchId: number;
  /** Hisob kunida guruh yo'q (arxivlangan) — faqat «−» uchun ko'rsatiladi. */
  gone: boolean;
}

export interface ActiveCourseRow extends ActiveCounts {
  course: string;
  category: string;
}

export interface ActiveCategoryRow extends ActiveCounts {
  /** "" — kategoriyasiz. */
  category: string;
  courses: number;
}

export interface ActiveBranchRow extends ActiveCounts {
  branchId: number;
  name: string;
  teachers: number;
}

export interface ActiveTeacherRow extends ActiveCounts {
  teacher: string;
  branchId: number;
  courses: string[];
}

export interface ActiveStudentsReport {
  /** Hisob kuni. */
  asOf: string;
  /** Hisob kuni bugun bo'lsa — hisob vaqti («18:40»), aks holda null (kun oxiri). */
  time: string | null;
  today: string;
  historyStart: string;
  /** Hisob oyi ("YYYY-MM") va o'tgan oy oxiri (taqqoslash kuni). */
  month: string;
  prevEnd: string;
  /** Takrorsiz faol o'quvchilar (= «Kelgan va ketgan»). */
  students: number;
  /** O'tgan oy oxiridagi faollar; tarix yo'q — null. */
  studentsPrev: number | null;
  /** Bir nechta guruhdagi o'quvchilar. */
  multiGroup: number;
  /** Oy boshidan beri kun sayin faollar (kichik grafik). */
  spark: number[];
  /** Jami qatori (`came`/`left` — takrorsiz o'quvchilar bo'yicha). */
  totals: ActiveCounts;
  debtors: {
    /** Qarzdor faol o'quvchilar (takrorsiz). */
    students: number;
    /** Qarzdor o'rinlar. */
    seats: number;
    /** Ikki va undan ko'p o'rnida qarzdor bo'lganlar. */
    multi: number;
    /** Qarzdorlar hisobotidagi jami (guruhdan chiqqanlari ham). */
    inReport: number;
  };
  categories: ActiveCategoryRow[];
  courses: ActiveCourseRow[];
  branches: ActiveBranchRow[];
  groups: ActiveGroupRow[];
  teachers: ActiveTeacherRow[];
  /** Filtr tanlovi: ishlatilgan kategoriyalar; kategoriyasiz kurs bormi. */
  categoryOptions: string[];
  hasUncategorized: boolean;
}

/** Kategoriya filtridagi «Kategoriyasiz» qiymati. */
export const NO_CATEGORY = "-";

const PREFERRED_CATEGORIES = ["chet tillari", "fanlar", "arab tili"];
function categoryOrder(a: string, b: string): number {
  if (!a !== !b) return a ? -1 : 1;
  const ia = PREFERRED_CATEGORIES.indexOf(norm(a));
  const ib = PREFERRED_CATEGORIES.indexOf(norm(b));
  if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return a.localeCompare(b);
}

function emptyCounts(): ActiveCounts {
  return { seats: 0, groups: 0, came: 0, left: 0, paid: 0, debt: 0, notDue: 0, unknownPrice: 0, capacity: null, capSeats: 0, free: 0, noCapGroups: 0 };
}

/** Bir guruh hissasini yig'indiga qo'shadi (`came`/`left` alohida hisoblanadi). */
function addGroup(to: ActiveCounts, g: ActiveCounts) {
  to.seats += g.seats;
  to.groups += g.groups;
  to.paid += g.paid;
  to.debt += g.debt;
  to.notDue += g.notDue;
  to.unknownPrice += g.unknownPrice;
  if (g.capacity !== null) to.capacity = (to.capacity ?? 0) + g.capacity;
  to.capSeats += g.capSeats;
  to.free += g.free;
  to.noCapGroups += g.noCapGroups;
}

/** Ikki holat orasida qatorga kelgan / ketgan o'quvchilar. */
function flowOf(cur: Set<number>, prev: Set<number> | null): { came: number | null; left: number | null } {
  if (!prev) return { came: null, left: null };
  let came = 0;
  let left = 0;
  for (const p of cur) if (!prev.has(p)) came += 1;
  for (const p of prev) if (!cur.has(p)) left += 1;
  return { came, left };
}

/** Kun ro'yxati (ikkala chegara ham kiradi). */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < 62; i += 1) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > to) break;
    out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export async function computeActiveStudents(
  db: Db,
  branchIds: readonly number[],
  opts: { date: string; today: string; time?: string; category?: string; scope: BranchScope },
): Promise<ActiveStudentsReport> {
  const pools = [...new Set(branchIds.map(poolKey))].sort((a, b) => a - b);
  const [L, courseDocs, branchDocs, capOf] = await Promise.all([
    load(db, branchIds, opts.today),
    db.collection("offline_courses").find({}, { projection: { _id: 0, name: 1, category: 1 } }).toArray(),
    db.collection("branches").find({ id: { $in: pools } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    loadRoomCapacity(db),
  ]);

  // Hisob kuni: bugundan keyin emas, tarix boshidan oldin emas.
  let asOf = opts.date > opts.today ? opts.today : opts.date;
  if (asOf < L.historyStart) asOf = L.historyStart;
  const monthKey = asOf.slice(0, 7);
  const prevEnd = monthEndIso(shiftMonthKey(monthKey, -1));
  const prevKnown = prevEnd >= L.historyStart;
  const pay = await loadPayStatus(db, opts.scope, pools, asOf, monthEndIso(monthKey));

  // Kurs → kategoriya (offline_courses.category; bo'sh — kategoriyasiz).
  const catByCourse = new Map<string, string>();
  for (const c of courseDocs) catByCourse.set(norm(String(c.name ?? "")), normalizeCourseCategory(c.category));
  const categoryOf = (g: GroupDoc) => catByCourse.get(norm(g.course)) ?? "";
  const catFilter = normalizeCourseCategory(opts.category);
  const ok = (g: GroupDoc) => {
    if (!catFilter) return true;
    const c = categoryOf(g);
    return catFilter === NO_CATEGORY ? c === "" : norm(c) === norm(catFilter);
  };

  const cur = activeAt(L, asOf, ok);
  const prev = prevKnown ? activeAt(L, prevEnd, ok) : null;

  // Guruh → o'quvchilar (hisob kuni va o'tgan oy oxiri).
  const invert = (m: Map<number, Set<number>>) => {
    const out = new Map<number, Set<number>>();
    for (const [pupil, groups] of m) {
      for (const gid of groups) {
        let set = out.get(gid);
        if (!set) out.set(gid, (set = new Set()));
        set.add(pupil);
      }
    }
    return out;
  };
  const curByGroup = invert(cur);
  const prevByGroup = prev ? invert(prev) : null;
  const isToday = asOf === opts.today;

  // Guruh qatorlari.
  const groupRows: ActiveGroupRow[] = [];
  const groupPupils = new Map<number, { cur: Set<number>; prev: Set<number> | null }>();
  for (const g of L.groups) {
    if (!ok(g)) continue;
    const pupils = curByGroup.get(g.id) ?? new Set<number>();
    const before = prevByGroup ? (prevByGroup.get(g.id) ?? new Set<number>()) : null;
    const liveNow = isToday && (g.status || "") !== "archive";
    const alive = pupils.size > 0 || liveNow;
    if (!alive && !(before && before.size > 0)) continue;
    const branchId = poolKey(Number(g.branchId) || 1);
    const row: ActiveGroupRow = {
      ...emptyCounts(),
      id: g.id,
      name: String(g.name ?? "").trim(),
      label: labelOfGroup(g),
      course: String(g.course ?? "").trim(),
      category: categoryOf(g),
      level: String(g.level ?? "").trim(),
      teacher: String(g.teacher ?? "").trim(),
      branchId,
      gone: !alive,
      seats: pupils.size,
      groups: alive ? 1 : 0,
      ...flowOf(pupils, before),
    };
    for (const p of pupils) {
      const s = pay.of(branchId, p, g.id);
      row[s.pay] += 1;
      if (s.unknown) row.unknownPrice += 1;
    }
    if (alive) {
      const cap = capOf(g);
      if (cap === null) row.noCapGroups = 1;
      else {
        row.capacity = cap;
        row.capSeats = pupils.size;
        row.free = Math.max(0, cap - pupils.size);
      }
    }
    groupRows.push(row);
    groupPupils.set(g.id, { cur: pupils, prev: before });
  }
  groupRows.sort((a, b) => Number(a.gone) - Number(b.gone) || b.seats - a.seats || a.label.localeCompare(b.label));

  // Yig'indilar: kalit bo'yicha guruhlar yig'iladi, +/− esa qatordagi takrorsiz o'quvchilardan.
  function rollup<K>(keyOf: (g: ActiveGroupRow) => string, init: (g: ActiveGroupRow) => K) {
    const map = new Map<string, { row: K & ActiveCounts; cur: Set<number>; prev: Set<number> | null }>();
    for (const g of groupRows) {
      const key = keyOf(g);
      let e = map.get(key);
      if (!e) map.set(key, (e = { row: { ...init(g), ...emptyCounts() }, cur: new Set(), prev: prevKnown ? new Set() : null }));
      addGroup(e.row, g);
      const pp = groupPupils.get(g.id);
      if (pp) {
        for (const p of pp.cur) e.cur.add(p);
        if (e.prev && pp.prev) for (const p of pp.prev) e.prev.add(p);
      }
    }
    return [...map.values()].map((e) => Object.assign(e.row, flowOf(e.cur, e.prev)));
  }

  const courses = rollup(
    (g) => norm(g.course) || "—",
    (g) => ({ course: g.course || "—", category: g.category }),
  ).sort((a, b) => categoryOrder(a.category, b.category) || b.seats - a.seats || a.course.localeCompare(b.course));

  const categories = rollup(
    (g) => norm(g.category),
    (g) => ({ category: g.category, courses: 0 }),
  ).sort((a, b) => categoryOrder(a.category, b.category));
  for (const c of categories) c.courses = courses.filter((x) => norm(x.category) === norm(c.category) && x.groups > 0).length;

  const branchName = new Map(branchDocs.map((b) => [Number(b.id), String(b.name ?? "").trim()]));
  const teacherKey = (g: ActiveGroupRow) => `${g.branchId}|${norm(g.teacher)}`;
  const coursesByTeacher = new Map<string, Map<string, string>>();
  for (const g of groupRows) {
    if (!g.course) continue;
    let m = coursesByTeacher.get(teacherKey(g));
    if (!m) coursesByTeacher.set(teacherKey(g), (m = new Map()));
    m.set(norm(g.course), g.course);
  }
  const teachers = rollup(teacherKey, (g) => ({
    teacher: g.teacher || "—",
    branchId: g.branchId,
    courses: [...(coursesByTeacher.get(teacherKey(g))?.values() ?? [])].sort((a, b) => a.localeCompare(b)),
  }));
  teachers.sort((a, b) => a.branchId - b.branchId || b.seats - a.seats || a.teacher.localeCompare(b.teacher));

  const branches = rollup(
    (g) => String(g.branchId),
    (g) => ({ branchId: g.branchId, name: branchName.get(g.branchId) || `#${g.branchId}`, teachers: 0 }),
  ).sort((a, b) => a.branchId - b.branchId);
  for (const b of branches) b.teachers = teachers.filter((t) => t.branchId === b.branchId && t.groups > 0).length;

  // Jami: o'rinlar — guruhlar yig'indisi, +/− — takrorsiz o'quvchilar («Kelgan va ketgan»).
  const totals = emptyCounts();
  for (const g of groupRows) addGroup(totals, g);
  const allCur = new Set(cur.keys());
  const allPrev = prev ? new Set(prev.keys()) : null;
  Object.assign(totals, flowOf(allCur, allPrev));

  // Qarzdorlar: takrorsiz o'quvchi va o'rin.
  const debtSeats = new Map<number, number>();
  for (const g of groupRows) {
    const pp = groupPupils.get(g.id);
    if (!pp) continue;
    for (const p of pp.cur) if (pay.of(g.branchId, p, g.id).pay === "debt") debtSeats.set(p, (debtSeats.get(p) ?? 0) + 1);
  }
  let debtMulti = 0;
  let debtSeatSum = 0;
  for (const n of debtSeats.values()) {
    debtSeatSum += n;
    if (n > 1) debtMulti += 1;
  }

  let multiGroup = 0;
  for (const set of cur.values()) if (set.size > 1) multiGroup += 1;

  // Kichik grafik: oy boshidan (yoki tarix boshidan) hisob kunigacha.
  const sparkFrom = `${monthKey}-01` < L.historyStart ? L.historyStart : `${monthKey}-01`;
  const spark = daysBetween(sparkFrom, asOf).map((d) => (d === asOf ? cur.size : activeAt(L, d, ok).size));

  // Filtr tanlovi — filtrsiz, hozir ochiq guruhlar kurslaridan.
  const usedCats = new Map<string, string>();
  let hasUncategorized = false;
  for (const g of L.groups) {
    if ((g.status || "") === "archive") continue;
    const c = categoryOf(g);
    if (c) usedCats.set(norm(c), c);
    else hasUncategorized = true;
  }

  return {
    asOf,
    time: isToday ? (opts.time ?? null) : null,
    today: opts.today,
    historyStart: L.historyStart,
    month: monthKey,
    prevEnd,
    students: cur.size,
    studentsPrev: prev ? prev.size : null,
    multiGroup,
    spark,
    totals,
    debtors: { students: debtSeats.size, seats: debtSeatSum, multi: debtMulti, inReport: pay.reportDebtors },
    categories,
    courses,
    branches,
    groups: groupRows,
    teachers,
    categoryOptions: [...usedCats.values()].sort(categoryOrder),
    hasUncategorized,
  };
}
