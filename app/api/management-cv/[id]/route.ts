import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { CV_NOTE_MAX, cvFromRow, isCvStatus, type CvApplication } from "@/lib/managementCv";
import type { HrEmployee } from "@/lib/hrEmployees";
import { toUz } from "@/lib/uzTime";
import { getBranchScope } from "@/lib/branchScope";
import { requireAdmin } from "@/lib/adminOnly";

// PATCH /api/management-cv/:id — arizaning holatini o'zgartiradi.
// `status: "accepted"` bo'lsa — referensdagi `cvHire()` kabi nomzod
// Boshqaruv → Xodimlar ro'yxatiga (`hr_employees`) ham qo'shiladi.
// `{ adminNote }` — admin izohi (faqat admin, `saveAdminNote`).

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Anketadagi yo'nalishni Xodimlar ro'yxatidagi `turi` ga o'giradi.
 * Eski anketa: "O'qituvchi" / "Administrator" / boshqalar. Yangi (19.09.2026)
 * anketadagi vakansiyalar: "Fan o'qituvchisi", "Assistent o'qituvchi" →
 * o'qituvchi; "Administrator", "Filial rahbari", "HR menejer",
 * "Buxgalter / kassir", "IT administrator" → admin; qolgani (sotuv,
 * marketing, texnik xizmat) → moderator.
 */
function positionToTuri(position: string): string {
  const p = position.toLowerCase();
  if (/o['ʻ’]qituvchi/.test(p)) return "teacher";
  if (/administrator|rahbari|\bhr\b|buxgalter|kassir/.test(p)) return "admin";
  return "moderator";
}

function isTeacherPosition(position: string): boolean {
  return positionToTuri(position) === "teacher";
}

async function hire(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  cv: CvApplication,
  /**
   * Yangi xodim QAYSI FILIALGA tushadi — arizani tasdiqlayotgan odamning
   * joriy filiali.
   *
   * NIMA UCHUN MAJBURIY PARAMETR (ixtiyoriy emas): filialsiz yaratilgan
   * xodim hech bir filial ro'yxatida ko'rinmaydi — ariza "tasdiqlandi"
   * bo'lardi-yu, odam tizimda yo'qolib ketardi. Majburiy parametr bu
   * yo'lni ochiq qoldirmaydi.
   */
  branchId: number,
): Promise<HrEmployee> {
  const col = db.collection("hr_employees");
  const [last] = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = ((last?.id as number) ?? 0) + 1;
  const isTeacher = isTeacherPosition(cv.position);

  const employee: HrEmployee = {
    id: nextId,
    name: cv.name,
    // Referensdagi taxmin: ismi "a" bilan tugasa — ayol. Xodim kartasida
    // qo'lda tuzatish mumkin.
    gender: /a$/i.test(cv.name.split(" ")[0] || "") ? "female" : "male",
    aktivOq: 0,
    groups: 0,
    turi: positionToTuri(cv.position),
    branchIds: [branchId],
    payrollBranchId: branchId,
    filial: "Akademiya",
    phone: cv.phone,
    kurs: isTeacher && cv.subject && cv.subject !== "-" ? cv.subject : "",
    created: fmtNow(new Date()),
    lastActive: "",
    archReason: "",
    archDate: "",
    email: "",
    percent: isTeacher ? "40" : "",
    degree: "",
    // Yangi anketada nomzod rasmi bor — xodim kartasiga o'tadi.
    photoUrl: cv.photoUrl || "",
    branchAssignments: [],
  };
  await col.insertOne({ ...employee });
  return employee;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cvId = Number(id);
  if (!Number.isFinite(cvId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { status?: unknown; adminNote?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (body.adminNote !== undefined) return saveAdminNote(cvId, body.adminNote);
  if (!isCvStatus(body.status)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri holat" }, { status: 400 });
  }
  const status = body.status;

  const db = await ensureIndexes();
  const col = db.collection("cv_applications");
  const row = await col.findOne({ id: cvId });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Ariza topilmadi" }, { status: 404 });
  }
  const current = row as unknown as CvApplication;

  const set: Record<string, unknown> = { status };
  let employee: HrEmployee | null = null;

  // "Ishga olish" faqat bir marta — takror bosilsa yangi xodim yaratilmaydi.
  if (status === "accepted" && current.status !== "accepted") {
    const scope = await getBranchScope();
    if (!scope) {
      return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
    }
    // Nomzod aniq filialni tanlagan bo'lsa — o'sha; "qaysi filial bo'lsa
    // ham" yoki eski ariza — tasdiqlayotgan odamning joriy filiali.
    employee = await hire(db, current, current.branchId ?? scope.branchId);
    set.hiredEmpId = employee.id;
  }

  await col.updateOne({ id: cvId }, { $set: set });
  // `_id`/`ord` mijozga chiqmaydi; admin izohi — faqat adminga.
  const application = cvFromRow({ ...row, ...set }, !!(await requireAdmin()));

  return NextResponse.json({ ok: true, application, employee });
}

/**
 * Admin izohi (27.09.2026) — faqat `users.role === "admin"`. Bo'sh matn
 * izohni o'chiradi. Kim va qachon yozgani ham saqlanadi.
 */
async function saveAdminNote(cvId: number, raw: unknown) {
  const me = await requireAdmin();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Izohni faqat admin yozadi" }, { status: 403 });
  }
  if (typeof raw !== "string") {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const note = raw.trim();
  if (note.length > CV_NOTE_MAX) {
    return NextResponse.json({ ok: false, error: "Izoh juda uzun" }, { status: 422 });
  }

  const db = await ensureIndexes();
  const update = note
    ? { $set: { adminNote: note, adminNoteBy: me.fullName, adminNoteAt: new Date().toISOString() } }
    : { $unset: { adminNote: "", adminNoteBy: "", adminNoteAt: "" } };
  const row = await db.collection("cv_applications").findOneAndUpdate({ id: cvId }, update, { returnDocument: "after" });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Ariza topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, application: cvFromRow(row as unknown as Record<string, unknown>, true) });
}
