import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { branchForInsert, getBranchScope, withBranch } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { groupLabel, type Group } from "@/lib/groups";
import { uzStamp } from "@/lib/uzTime";
import { onExamSaved } from "@/lib/gamification/exams";
import { buildExamStudents, mirrorKeysOf, syncMonthlyMirror } from "@/lib/groupExamsServer";
import { withLinkKey } from "@/lib/groupResultsLink";
import {
  GROUPLESS_GROUP_ID,
  GROUPLESS_LABEL,
  groupAvgPct,
  groupExamMonth,
  isGroupless,
  sanitizeGroupExam,
  type GroupExam,
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
//
// GURUHSIZ RO'YXAT (01.11.2026, `groupless: true` → groupId 0, lib/imtihon.ts): guruh va
// ustozsiz; o'quvchilar shu filial bazasidan, guruhga qo'shilmaydi; tanga berilmaydi.

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
  // mijoz doim to'ldirilgan holda olsin. `linkKey` — «Havolani nusxalash» (guruh natijalari
  // sahifasi /natijalar/<kalit>, lib/groupResultsLink.ts) uchun, bazada yo'q.
  const exams = rows.map((r) => withLinkKey({ ...r, month: groupExamMonth(r) }));
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

  // GURUHSIZ RO'YXAT (groupId 0, lib/imtihon.ts) — guruh qidirilmaydi; o'quvchilar baribir shu
  // filial bazasidan (buildExamStudents), guruhga qo'shilmaydi.
  let groupPart: Pick<GroupExam, "groupId" | "groupName" | "groupLabel" | "level">;
  if (input.groupId === GROUPLESS_GROUP_ID) {
    groupPart = { groupId: GROUPLESS_GROUP_ID, groupName: "", groupLabel: GROUPLESS_LABEL, level: "" };
  } else {
    const group = await db.collection<Group>("groups").findOne(withBranch({ id: input.groupId }, scope));
    if (!group) return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
    groupPart = { groupId: group.id, groupName: group.name ?? "", groupLabel: groupLabel(group), level: group.level ?? "" };
  }

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
    ...groupPart,
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
  // natija saqlanishini yiqitmaydi — logga yoziladi. Guruhsiz ro'yxatga tanga yo'q.
  if (!isGroupless(exam)) {
    try {
      await onExamSaved(db, exam.groupId, input.month);
    } catch (e) {
      console.error("[gamification] Sarhisob hodisasi", { groupId: exam.groupId, month: input.month }, e);
    }
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

  return NextResponse.json({ ok: true, exam: withLinkKey(exam) });
}
