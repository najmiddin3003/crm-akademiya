import type { Db } from "mongodb";
import { UB } from "@/lib/uzbmbServer";

// O'QUVCHI KABINETI → NATIJALAR → «UzBMB» (44-qism, rasm «Kabinet · UzBMB»). O'quvchining test natijalari
// (me.exams.uzbmb) uchun taqqoslash: shu testdagi GURUH o'rtachasi va o'rni, FILIAL (testning filiali) o'rtachasi,
// test raqami va sanasi. Testsiz eski yozuvlar (testId yo'q) — taqqoslashsiz qoladi.

export interface UzbmbStat {
  examId: number;
  testNo: number | null;
  testName: string;
  date: string;
  groupAvg: number | null;
  branchAvg: number | null;
  rank: number | null;
  groupSize: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (a: number[]) => (a.length ? r1(a.reduce((x, y) => x + y, 0) / a.length) : null);

export async function uzbmbStats(db: Db, exams: { id: number; testId?: number; groupId?: number; total: number; date?: string }[]): Promise<UzbmbStat[]> {
  const withTest = exams.filter((e) => Number.isFinite(Number(e.testId)));
  if (!withTest.length) return [];
  const testIds = [...new Set(withTest.map((e) => Number(e.testId)))];
  const [tests, peers] = await Promise.all([
    db.collection(UB.tests).find({ id: { $in: testIds } }, { projection: { _id: 0, id: 1, no: 1, name: 1, date: 1 } }).toArray(),
    db.collection(UB.results).find({ testId: { $in: testIds }, complete: { $ne: false } }, { projection: { _id: 0, testId: 1, groupId: 1, total: 1 } }).toArray(),
  ]);
  return withTest.map((e) => {
    const t = tests.find((x) => Number(x.id) === Number(e.testId));
    const all = peers.filter((p) => Number(p.testId) === Number(e.testId));
    const grp = all.filter((p) => Number(p.groupId) === Number(e.groupId));
    return {
      examId: Number(e.id),
      testNo: t ? Number(t.no) || null : null,
      testName: String(t?.name ?? ""),
      date: String(t?.date ?? e.date ?? ""),
      groupAvg: grp.length > 1 ? avg(grp.map((p) => Number(p.total) || 0)) : null,
      branchAvg: all.length > 1 ? avg(all.map((p) => Number(p.total) || 0)) : null,
      rank: grp.length > 1 ? 1 + grp.filter((p) => (Number(p.total) || 0) > e.total).length : null,
      groupSize: grp.length,
    };
  });
}
