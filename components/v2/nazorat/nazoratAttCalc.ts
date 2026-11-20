import type { DateRange } from "@/components/ui/DateRangePicker";
import { groupWeekdays, parsePeriod, type AttendanceStatus } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import { dateToIso, isoToDate, isoToLabel, type AttendanceMarkRow } from "@/components/nazorat/useNazoratAttendance";

// YANGI VERSIYA — NAZORAT → «DAVOMAT ANALITIKASI» va «DAVOMAT QILINMAGAN GURUHLAR» (28-qism, rasmsiz) hisobi.
//
// Hisob eski sahifalardan AYNAN NUSXA (components/nazorat/NazoratDavomatAnalyticsPage.tsx va
// NazoratMissedGroupsPage.tsx): manba ham o'sha — useNazoratAttendance (GET /api/groups + GET /api/attendance).
// Eski sahifadagi hisob o'zgarsa — bu yerda ham birga o'zgartiriladi (versiyani almashtirgan xodim aynan
// o'sha sonlarni ko'rishi kerak).

/** Grafikdagi qatorlar — davomat holatlarining o'zi. `csv` — eski CSV sarlavhasi (fayl eskisi bilan bir xil). */
export const NAZORAT_ATT_SERIES: { status: AttendanceStatus; label: string; csv: string; bar: string }[] = [
  { status: "keldi", label: "Keldi", csv: "Kelgan o'quvchilar", bar: "bg-v2-success" },
  { status: "kechikdi", label: "Kechikdi", csv: "Kechikib kelganlar", bar: "bg-v2-warning" },
  { status: "birinchi", label: "Birinchi dars", csv: "Birinchi darsga kelganlar", bar: "bg-v2-info" },
  { status: "sababli", label: "Sababli", csv: "Sababli o'quvchilar", bar: "bg-v2-text-3" },
  { status: "sababsiz", label: "Sababsiz", csv: "Sababsiz o'quvchilar", bar: "bg-v2-danger" },
];

export interface NazoratAttDay {
  /** "YYYY-MM-DD" */
  iso: string;
  /** "24.08.2026" — CSV dagi ko'rinish */
  label: string;
  /** NAZORAT_ATT_SERIES tartibidagi sonlar. */
  vals: number[];
}

export function nazoratAttStartOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Kunma-kun belgilar soni — faqat ko'rinadigan guruhlarning HAQIQIY belgilari (eskisi: `days`). */
export function nazoratAttDays(marks: readonly AttendanceMarkRow[], visibleGroupIds: ReadonlySet<number>, range: DateRange, holati: string): NazoratAttDay[] {
  const start = range.start ?? nazoratAttStartOfMonth(new Date());
  const end = range.end ?? new Date();

  const perDay = new Map<string, number[]>();
  for (const m of marks) {
    if (!visibleGroupIds.has(m.groupId)) continue;
    if (holati && m.status !== holati) continue;
    const idx = NAZORAT_ATT_SERIES.findIndex((s) => s.status === m.status);
    if (idx < 0) continue;
    let vals = perDay.get(m.date);
    if (!vals) {
      vals = NAZORAT_ATT_SERIES.map(() => 0);
      perDay.set(m.date, vals);
    }
    vals[idx] += 1;
  }

  const out: NazoratAttDay[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur.getTime() <= last.getTime()) {
    const iso = dateToIso(cur);
    out.push({ iso, label: isoToLabel(iso), vals: perDay.get(iso) ?? NAZORAT_ATT_SERIES.map(() => 0) });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ───────────────────────── Davomat qilinmagan guruhlar ───────────────────────── */

export interface NazoratAttMissed {
  key: string;
  groupId: number;
  groupName: string;
  /** Faqat ko'rinish uchun (fan nuqtasi, sarlavha) — hisobga ta'sir qilmaydi. */
  course: string;
  level: string;
  time: string;
  /** "YYYY-MM-DD" */
  date: string;
  teacher: string;
}

interface BoundedGroup {
  group: Group;
  start: Date;
  end: Date | null;
}

/** Guruhning faoliyat muddati — avval startDate/endDate, bo'lmasa `period` satri. */
function groupBounds(g: Group): { start: Date | null; end: Date | null } {
  const p = parsePeriod(g.period);
  return {
    start: g.startDate ? isoToDate(g.startDate) : p.start,
    end: g.endDate ? isoToDate(g.endDate) : p.end,
  };
}

/** Boshlanish sanasi ANIQ guruhlar baholanadi; chegarasi yo'qlar — alohida (ular haqida da'vo qilinmaydi). */
export function nazoratAttSplitGroups(groups: readonly Group[]): { bounded: BoundedGroup[]; unbounded: Group[] } {
  const bounded: BoundedGroup[] = [];
  const unbounded: Group[] = [];
  for (const g of groups) {
    const bb = groupBounds(g);
    if (bb.start) bounded.push({ group: g, start: bb.start, end: bb.end });
    else unbounded.push(g);
  }
  return { bounded, unbounded };
}

/** "sana|groupId" — o'sha darsda kamida bitta belgi qo'yilgan. */
export function nazoratAttMarkedKeys(marks: readonly AttendanceMarkRow[]): Set<string> {
  const set = new Set<string>();
  for (const m of marks) set.add(`${m.date}|${m.groupId}`);
  return set;
}

/** Jadval bo'yicha dars kuni, guruh faoliyat muddatida, bugungacha, belgisi yo'q — eng yangi kun tepada. */
export function nazoratAttMissedLessons(bounded: readonly BoundedGroup[], markedKeys: ReadonlySet<string>, range: DateRange): NazoratAttMissed[] {
  const start = range.start ?? nazoratAttStartOfMonth(new Date());
  const end = range.end ?? new Date();
  const todayIso = dateToIso(new Date());

  const out: NazoratAttMissed[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur.getTime() <= last.getTime()) {
    const iso = dateToIso(cur);
    if (iso <= todayIso) {
      const weekday = cur.getDay();
      for (const { group: g, start: gStart, end: gEnd } of bounded) {
        if (!groupWeekdays(g.day).includes(weekday)) continue;
        if (cur < gStart) continue;
        if (gEnd && cur > gEnd) continue;
        if (markedKeys.has(`${iso}|${g.id}`)) continue;
        out.push({ key: `${g.id}-${iso}`, groupId: g.id, groupName: g.name, course: g.course, level: g.level, time: g.time, date: iso, teacher: g.teacher });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.groupName.localeCompare(b.groupName)));
}
