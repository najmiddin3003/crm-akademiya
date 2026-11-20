import type { DateRange } from "@/components/ui/DateRangePicker";
import type { Group } from "@/lib/groups";

// «O'QUV MARKAZGA ISHLAB BERILGAN» (/reports-served) — HISOB, React'siz. Eski sahifa
// (components/reports/ServedReportPage.tsx) dagi hisobning AYNAN nusxasi: o'sha ism
// normallashtirish, o'sha `studentIds` sanog'i, o'sha «o'qituvchisi ko'rsatilmagan» qoidasi, o'sha
// tartib. Biri o'zgarsa — ikkinchisi ham (finReportsCalc.ts bilan bir xil kelishuv). Izohlar — eski
// faylda (nega `g.students` emas, nega `teacherName` bo'sh bo'lsa «—»).

/** /api/transaction-entries/served-summary javobidagi qator. */
export interface ServedSummaryRow {
  teacherName: string;
  amount: number;
}

export interface ServedTeacherRow {
  name: string;
  groups: number;
  students: number;
  /** null — to'lovlarda o'qituvchi umuman ko'rsatilmagan, hisoblab bo'lmaydi. */
  earned: number | null;
}

export interface ServedReport {
  rows: ServedTeacherRow[];
  /** Jadvaldagi qatorlar yig'indisi; null — taqsimlab bo'lmaydi. */
  total: number | null;
  /** O'qituvchisi ko'rsatilmagan kirim — jadvalga tushmaydi. */
  unattributedTotal: number;
  hasAttribution: boolean;
  /** O'qituvchi tanlovisiz jami (ulush ustuni uchun). */
  allTotal: number | null;
}

export const servedNameKey = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Guruhdagi o'quvchilar soni — `studentIds` uzunligi (eski fayldagi rosterSize izohi). */
export const servedRosterSize = (g: Group): number => g.studentIds?.length ?? 0;

/** Standart oraliq — joriy oy. */
export function servedCurrentMonth(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
  };
}

export function servedIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildServedReport(servedRows: ServedSummaryRow[], groups: Group[], teacher: string): ServedReport {
  const attributed = servedRows.filter((r) => servedNameKey(r.teacherName) !== "");
  const hasAttribution = attributed.length > 0;

  const earnedByTeacher = new Map<string, number>();
  for (const r of attributed) {
    const k = servedNameKey(r.teacherName);
    earnedByTeacher.set(k, (earnedByTeacher.get(k) ?? 0) + (r.amount || 0));
  }

  const unattributedTotal = servedRows.filter((r) => servedNameKey(r.teacherName) === "").reduce((s, r) => s + (r.amount || 0), 0);

  const byKey = new Map<string, ServedTeacherRow>();
  const take = (name: string) => {
    const k = servedNameKey(name);
    if (!byKey.has(k)) byKey.set(k, { name: name.trim(), groups: 0, students: 0, earned: hasAttribution ? 0 : null });
    return byKey.get(k)!;
  };

  for (const g of groups) {
    const name = String(g.teacher ?? "").trim();
    if (!name) continue;
    const row = take(name);
    row.groups += 1;
    row.students += servedRosterSize(g);
  }
  for (const r of attributed) take(String(r.teacherName ?? ""));

  for (const [k, row] of byKey) {
    if (hasAttribution) row.earned = earnedByTeacher.get(k) ?? 0;
  }

  const everyone = Array.from(byKey.values());
  const rows = everyone
    .filter((r) => !teacher || servedNameKey(r.name) === servedNameKey(teacher))
    .sort((a, b) => (b.earned ?? 0) - (a.earned ?? 0) || a.name.localeCompare(b.name));

  const total = hasAttribution ? rows.reduce((s, r) => s + (r.earned ?? 0), 0) : null;
  const allTotal = hasAttribution ? everyone.reduce((s, r) => s + (r.earned ?? 0), 0) : null;

  return { rows, total, unattributedTotal, hasAttribution, allTotal };
}
