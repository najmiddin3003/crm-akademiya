import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope, withBranch, withPupilBranch } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { uzStamp } from "@/lib/uzTime";
import { onExamSaved } from "@/lib/gamification/exams";
import {
  groupAvgPct,
  groupExamMonth,
  imPct,
  sanitizeGroupExam,
  type GroupExam,
  type GroupExamStudent,
  type MonthlyExam,
} from "@/lib/imtihon";

// Imtihon → Sarhisob — "Natija qo'shish" paneli backend'i (MongoDB `group_exams`).
//
// Bitta hujjat = bitta guruhning bitta imtihoni (sarhisob): fan, ustoz,
// guruh, oy, sana, savollar soni va har bir o'quvchining to'g'ri javoblari.
// Sarhisob tabi (/imtihon) shu ro'yxatni ko'rsatadi.
//
// FILIAL BO'YICHA KESILADI: guruh joriy filialda bo'lishi shart (aks holda
// 404), yozuvga ham shu filial yoziladi va GET faqat shu filialnikini
// qaytaradi — guruhlar ro'yxati bilan bir xil qamrov (lib/groupScope.ts).

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const rows = (await db
    .collection("group_exams")
    .find(withBranch({}, scope), { projection: { _id: 0 } })
    .sort({ date: -1, id: -1 })
    .toArray()) as unknown as GroupExam[];
  // `month` 21.09.2026 da qo'shildi — undan oldingi hujjatlarda yo'q,
  // mijoz doim to'ldirilgan holda olsin.
  const exams = rows.map((r) => ({ ...r, month: groupExamMonth(r) }));
  return NextResponse.json({ ok: true, exams });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const checked = sanitizeGroupExam(body);
  if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });
  const input = checked.input;

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();

  const group = await db.collection<Group>("groups").findOne(withBranch({ id: input.groupId }, scope));
  if (!group) return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });

  // O'quvchilar ism/telefoni BAZADAN olinadi (mijoz yuborgani emas) —
  // guruh o'quvchilari ro'yxati bilan bir xil qamrov (app/api/groups/[id]/students).
  const ids = input.students.map((s) => s.pupilId);
  const pupils = await db
    .collection<Pupil>("pupils")
    .find(withPupilBranch({ id: { $in: ids } }, scope), { projection: { id: 1, firstName: 1, lastName: 1, phone: 1 } })
    .toArray();
  const byId = new Map(pupils.map((p) => [p.id, p]));
  const students: GroupExamStudent[] = [];
  for (const s of input.students) {
    const p = byId.get(s.pupilId);
    if (!p) continue; // o'chirilgan yoki boshqa filialning o'quvchisi
    students.push({
      pupilId: p.id,
      name: pupilFullName(p),
      phone: p.phone ?? "",
      correct: s.correct,
      pct: imPct(s.correct, input.total),
    });
  }
  if (students.length === 0) {
    return NextResponse.json({ ok: false, error: "Tanlangan o'quvchilar topilmadi" }, { status: 400 });
  }

  const col = db.collection("group_exams");
  const [last, createdBy] = await Promise.all([
    col.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray(),
    currentAuthorName(),
  ]);
  const exam: GroupExam = {
    id: (Number(last[0]?.id) || 0) + 1,
    date: input.date,
    month: input.month,
    course: input.course,
    teacher: input.teacher,
    groupId: group.id,
    groupName: group.name ?? "",
    groupLabel: groupLabel(group),
    level: group.level ?? "",
    branchId: branchForInsert(scope),
    total: input.total,
    students,
    studentCount: students.length,
    avgPct: groupAvgPct(students),
    createdAt: uzStamp(),
    createdBy,
  };
  await col.insertOne({ ...exam });

  // GAMIFIKATSIYA (TZ 4.8): natija saqlangani = guruh–oy yopildi →
  // Sarhisob va o'sish tangalari (lib/gamification/exams.ts). Xatosi
  // natija saqlanishini yiqitmaydi — logga yoziladi.
  try {
    await onExamSaved(db, group.id, input.month);
  } catch (e) {
    console.error("[gamification] Sarhisob hodisasi", { groupId: group.id, month: input.month }, e);
  }

  // `monthly_exams` GA KO'CHIRISH. CRM'da bu jadvalning o'z sahifasi endi
  // yo'q ("Oylik imtihon" tabi 21.09.2026 da Sarhisobga almashdi), lekin
  // O'QUVCHILAR BOTI o'quvchining natijalarini shu kolleksiyadan ism
  // bo'yicha o'qiydi (lib/studentBot/data.ts → loadExams), shu bois
  // ko'chirish qoladi. Kalit va yangilash qoidasi app/api/imtihon/monthly
  // bilan bir xil: (o'quvchi + fan + oy) mavjud bo'lsa yangilanadi, aks
  // holda qo'shiladi. Oy — sarhisobning oyi (sananing oyi emas).
  const monthly = db.collection("monthly_exams");
  const month = input.month;
  const existing = (await monthly
    .find({ month }, { projection: { _id: 0, id: 1, student: 1, subject: 1 } })
    .toArray()) as unknown as Pick<MonthlyExam, "id" | "student" | "subject">[];
  const lastMonthly = await monthly.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
  let nextMonthlyId = (Number(lastMonthly[0]?.id) || 0) + 1;
  const subjectLc = input.course.toLowerCase();
  for (const s of students) {
    const nameLc = s.name.toLowerCase();
    const ex = existing.find((r) => r.student.toLowerCase() === nameLc && r.subject.toLowerCase() === subjectLc);
    const set: Partial<MonthlyExam> = { total: input.total, correct: s.correct, pct: s.pct };
    if (exam.level) set.level = exam.level;
    if (ex) {
      await monthly.updateOne({ id: ex.id }, { $set: set });
    } else {
      const rec: MonthlyExam = {
        id: nextMonthlyId++,
        student: s.name,
        subject: input.course,
        level: exam.level,
        month,
        total: input.total,
        correct: s.correct,
        pct: s.pct,
      };
      await monthly.insertOne({ ...rec });
      existing.push(rec);
    }
  }

  return NextResponse.json({ ok: true, exam });
}
