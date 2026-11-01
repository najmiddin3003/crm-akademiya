import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope, withBranch } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { groupLabel, type Group } from "@/lib/groups";
import { uzStamp } from "@/lib/uzTime";
import { onExamSaved } from "@/lib/gamification/exams";
import { buildExamStudents, mirrorKeysOf, syncMonthlyMirror } from "@/lib/groupExamsServer";
import { groupAvgPct, groupExamMonth, sanitizeGroupExam, type GroupExam } from "@/lib/imtihon";

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
  // `branchId` — «Ochiq havolani nusxalash» tugmasi uchun (/natijalar?filial=…, lib/publicResults.ts).
  return NextResponse.json({ ok: true, exams, branchId: scope.branchId });
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

  // O'quvchilar ism/telefoni BAZADAN olinadi (mijoz yuborgani emas) — lib/groupExamsServer.ts.
  const students = await buildExamStudents(db, scope, input);
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
  // ko'chirish qoladi. Kalit — (o'quvchi + fan + oy), oy — sarhisobning oyi;
  // qoida tahrir/o'chirish bilan bitta (lib/groupExamsServer.ts → syncMonthlyMirror).
  // Xatosi saqlangan natijani yiqitmaydi — logga yoziladi.
  try {
    await syncMonthlyMirror(db, mirrorKeysOf(exam));
  } catch (e) {
    console.error("[imtihon] monthly_exams ko'zgusi", { examId: exam.id }, e);
  }

  return NextResponse.json({ ok: true, exam });
}
