import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch, type BranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { uzStamp } from "@/lib/uzTime";
import { onExamSaved } from "@/lib/gamification/exams";
import { buildExamStudents, mirrorKeysOf, syncMonthlyMirror, type MirrorKey } from "@/lib/groupExamsServer";
import { groupAvgPct, groupExamMonth, sanitizeGroupExam, type GroupExam } from "@/lib/imtihon";

// IMTIHON → SARHISOB: BITTA SARHISOBNI TAHRIRLASH, ARXIVLASH, O'CHIRISH (01.11.2026,
// foydalanuvchi: «edit/delete/archive ham bo'lishi kerak»). Qo'shish —
// app/api/imtihon/group (POST); qoidalar o'sha bilan bir xil (lib/groupExamsServer.ts).
//
//   PUT    — natijalarni qayta saqlaydi: sana, oy, fan, ustoz, savollar soni va o'quvchilar
//            (yuborilmagan — natijasi o'chirilgan — o'quvchi sarhisobdan chiqadi). GURUH
//            O'ZGARMAYDI (boshqa guruh — boshqa o'quvchilar; noto'g'ri guruhga kiritilgan
//            bo'lsa — o'chirib, qaytadan). Guruh nomi/bosqichi kiritilgandagidek qoladi.
//   PATCH  — `{ archived: boolean }`: arxivga / arxivdan (faqat ko'rinish, GroupExam.archived).
//   DELETE — butunlay o'chiradi.
//
// PUT va DELETE dan keyin (POST dagidek, xatosi amalni yiqitmaydi): guruh–oy tangalari
// qayta moslanadi (lib/gamification/exams.ts — natijasi qolmagan o'quvchining tangasi
// bekor bo'ladi; oy o'zgarsa — eski va yangi oy) va o'quvchilar boti ko'zgusi
// (`monthly_exams`) eski va yangi kalitlar bo'yicha. FILIAL bo'yicha kesiladi — faqat
// joriy filial ro'yxatidagi sarhisob (GET bilan bir xil qamrov), aks holda 404.

type Ctx = { params: Promise<{ id: string }> };

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
const notFound = () => NextResponse.json({ ok: false, error: "Sarhisob topilmadi" }, { status: 404 });
const badRequest = () => NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });

/** Joriy filialdagi sarhisob (`month` to'ldirilgan — eski hujjatlarda yo'q). */
async function findOwn(db: Db, scope: BranchScope, rawId: string): Promise<GroupExam | null> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const doc = (await db.collection("group_exams").findOne(withBranch({ id }, scope), { projection: { _id: 0 } })) as unknown as GroupExam | null;
  return doc ? { ...doc, month: groupExamMonth(doc) } : null;
}

/** Tangalar va bot ko'zgusi — xatosi amalni yiqitmaydi, logga yoziladi. */
async function afterChange(db: Db, groupId: number, months: string[], keys: MirrorKey[]): Promise<void> {
  for (const month of new Set(months)) {
    try {
      await onExamSaved(db, groupId, month);
    } catch (e) {
      console.error("[gamification] Sarhisob hodisasi", { groupId, month }, e);
    }
  }
  try {
    await syncMonthlyMirror(db, keys);
  } catch (e) {
    console.error("[imtihon] monthly_exams ko'zgusi", { groupId, months }, e);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  const checked = sanitizeGroupExam(body);
  if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });
  const input = checked.input;

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const exam = await findOwn(db, scope, id);
  if (!exam) return notFound();
  if (input.groupId !== exam.groupId) {
    return NextResponse.json({ ok: false, error: "Sarhisobning guruhini o'zgartirib bo'lmaydi" }, { status: 400 });
  }

  const students = await buildExamStudents(db, scope, input, exam.students);
  if (students.length === 0) {
    return NextResponse.json({ ok: false, error: "Tanlangan o'quvchilar topilmadi" }, { status: 400 });
  }

  const set = {
    date: input.date,
    month: input.month,
    course: input.course,
    teacher: input.teacher,
    total: input.total,
    students,
    studentCount: students.length,
    avgPct: groupAvgPct(students),
    updatedAt: uzStamp(),
    updatedBy: await currentAuthorName(),
  };
  const res = await db.collection("group_exams").updateOne({ id: exam.id }, { $set: set });
  if (res.matchedCount === 0) return notFound();
  const next: GroupExam = { ...exam, ...set };

  await afterChange(db, exam.groupId, [exam.month, next.month], [...mirrorKeysOf(exam), ...mirrorKeysOf(next)]);
  return NextResponse.json({ ok: true, exam: next });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest();
  }
  const archived = body && typeof body === "object" ? (body as Record<string, unknown>).archived : undefined;
  if (typeof archived !== "boolean") return badRequest();

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const exam = await findOwn(db, scope, id);
  if (!exam) return notFound();

  const col = db.collection("group_exams");
  if (archived) {
    const mark = { archived: true, archivedAt: uzStamp(), archivedBy: await currentAuthorName() };
    await col.updateOne({ id: exam.id }, { $set: mark });
    return NextResponse.json({ ok: true, exam: { ...exam, ...mark } });
  }
  await col.updateOne({ id: exam.id }, { $unset: { archived: "", archivedAt: "", archivedBy: "" } });
  const next: GroupExam = { ...exam };
  delete next.archived;
  delete next.archivedAt;
  delete next.archivedBy;
  return NextResponse.json({ ok: true, exam: next });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const exam = await findOwn(db, scope, id);
  if (!exam) return notFound();

  const res = await db.collection("group_exams").deleteOne({ id: exam.id });
  if (res.deletedCount === 0) return notFound();

  await afterChange(db, exam.groupId, [exam.month], mirrorKeysOf(exam));
  return NextResponse.json({ ok: true });
}
