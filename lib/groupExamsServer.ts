import type { Db } from "mongodb";
import { withPupilBranch, type BranchScope } from "@/lib/branchScope";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import {
  groupExamMonth,
  imPct,
  type GroupExam,
  type GroupExamInput,
  type GroupExamStudent,
  type MonthlyExam,
} from "@/lib/imtihon";

// IMTIHON → SARHISOB: SERVER YORDAMCHILARI — qo'shish (app/api/imtihon/group POST) va
// tahrirlash/o'chirish (app/api/imtihon/group/[id], 01.11.2026) bir xil qoida bilan
// ishlasin: o'quvchi ismi/telefoni bazadan, o'quvchilar boti ko'zgusi (`monthly_exams`)
// bitta qoida bilan moslanadi.

/**
 * Sarhisobdagi o'quvchilar: ism/telefon BAZADAN (mijoz yuborgani emas) — guruh
 * o'quvchilari ro'yxati bilan bir xil qamrov (app/api/groups/[id]/students). Bazada
 * topilmagan o'quvchi (o'chirilgan yoki boshqa filialda) tashlab ketiladi; TAHRIRDA
 * (`keep` — sarhisobning hozirgi o'quvchilari) uning eski yozuvidagi ism/telefon qoladi —
 * guruhdan chiqib ketgan o'quvchining natijasini ham tuzatsa bo'ladi.
 */
export async function buildExamStudents(
  db: Db,
  scope: BranchScope,
  input: Pick<GroupExamInput, "total" | "students">,
  keep: GroupExamStudent[] = [],
): Promise<GroupExamStudent[]> {
  const ids = input.students.map((s) => s.pupilId);
  const pupils = await db
    .collection<Pupil>("pupils")
    .find(withPupilBranch({ id: { $in: ids } }, scope), { projection: { id: 1, firstName: 1, lastName: 1, phone: 1 } })
    .toArray();
  const byId = new Map(pupils.map((p) => [p.id, p]));
  const old = new Map(keep.map((s) => [s.pupilId, s]));
  const out: GroupExamStudent[] = [];
  for (const s of input.students) {
    const p = byId.get(s.pupilId);
    const was = old.get(s.pupilId);
    if (!p && !was) continue;
    out.push({
      pupilId: s.pupilId,
      name: p ? pupilFullName(p) : (was?.name ?? ""),
      phone: p ? (p.phone ?? "") : (was?.phone ?? ""),
      correct: s.correct,
      pct: imPct(s.correct, input.total),
    });
  }
  return out;
}

/** Ko'zgu kaliti — o'quvchi (ism) + fan + oy (app/api/imtihon/monthly dagi qoida). */
export interface MirrorKey {
  name: string;
  course: string;
  month: string;
}

export function mirrorKeysOf(exam: Pick<GroupExam, "course" | "date" | "students"> & { month?: string }): MirrorKey[] {
  const month = groupExamMonth(exam);
  return (exam.students ?? []).map((s) => ({ name: s.name, course: exam.course, month }));
}

const lc = (s: unknown) => String(s ?? "").trim().toLowerCase();
const keyOf = (name: unknown, course: unknown) => JSON.stringify([lc(name), lc(course)]);

/**
 * `monthly_exams` (o'quvchilar boti o'quvchi natijasini shundan ISM bo'yicha o'qiydi —
 * lib/studentBot/data.ts) berilgan kalitlar bo'yicha `group_exams` ga moslanadi: shu oy
 * va fan bo'yicha shu o'quvchi bor ENG OXIRGI (id bo'yicha) sarhisob natijasi yoziladi
 * (yo'q bo'lsa qo'shiladi), hech bir sarhisobda qolmagan bo'lsa — qator o'chiriladi.
 * Arxivdagi sarhisob ham hisoblanadi (arxiv — faqat ko'rinish). Qo'shishda yangi
 * sarhisob eng oxirgisi bo'lgani uchun natija avvalgi «yozib qo'yish» bilan bir xil.
 */
export async function syncMonthlyMirror(db: Db, keys: MirrorKey[]): Promise<void> {
  const byMonth = new Map<string, Set<string>>();
  for (const k of keys) {
    if (!/^\d{4}-\d{2}$/.test(k.month) || !lc(k.name) || !lc(k.course)) continue;
    const set = byMonth.get(k.month) ?? new Set<string>();
    set.add(keyOf(k.name, k.course));
    byMonth.set(k.month, set);
  }
  if (!byMonth.size) return;

  const monthly = db.collection("monthly_exams");
  const last = await monthly.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  let nextId = (Number(last[0]?.id) || 0) + 1;

  for (const [month, wanted] of byMonth) {
    // 21.09.2026 gacha yozilgan hujjatlarda `month` yo'q — sananing oyi (groupExamMonth).
    const exams = (await db
      .collection("group_exams")
      .find(
        { $or: [{ month }, { month: { $in: [null, ""] }, date: { $regex: `^${month}-` } }] },
        { projection: { _id: 0, id: 1, course: 1, level: 1, total: 1, students: 1 } },
      )
      .sort({ id: 1 })
      .toArray()) as unknown as Pick<GroupExam, "id" | "course" | "level" | "total" | "students">[];
    const latest = new Map<string, { exam: (typeof exams)[number]; s: GroupExamStudent }>();
    for (const e of exams) for (const s of e.students ?? []) latest.set(keyOf(s.name, e.course), { exam: e, s });

    const rows = (await monthly
      .find({ month }, { projection: { _id: 0, id: 1, student: 1, subject: 1 } })
      .toArray()) as unknown as Pick<MonthlyExam, "id" | "student" | "subject">[];

    for (const key of wanted) {
      const row = rows.find((r) => keyOf(r.student, r.subject) === key);
      const hit = latest.get(key);
      if (!hit) {
        if (row) await monthly.deleteOne({ id: row.id });
        continue;
      }
      const set: Partial<MonthlyExam> = { total: hit.exam.total, correct: hit.s.correct, pct: hit.s.pct };
      if (hit.exam.level) set.level = hit.exam.level;
      if (row) {
        await monthly.updateOne({ id: row.id }, { $set: set });
      } else {
        const rec: MonthlyExam = {
          id: nextId++,
          student: hit.s.name,
          subject: hit.exam.course,
          level: hit.exam.level ?? "",
          month,
          total: hit.exam.total,
          correct: hit.s.correct,
          pct: hit.s.pct,
        };
        await monthly.insertOne({ ...rec });
        rows.push(rec);
      }
    }
  }
}
