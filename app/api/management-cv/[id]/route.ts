import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isCvStatus, type CvApplication } from "@/lib/managementCv";
import type { HrEmployee } from "@/lib/hrEmployees";

// PATCH /api/management-cv/:id — arizaning holatini o'zgartiradi.
// `status: "accepted"` bo'lsa — referensdagi `cvHire()` kabi nomzod
// Boshqaruv → Xodimlar ro'yxatiga (`hr_employees`) ham qo'shiladi.

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Anketadagi yo'nalishni Xodimlar ro'yxatidagi `turi` ga o'giradi. */
function positionToTuri(position: string): string {
  if (position === "O'qituvchi") return "teacher";
  if (position === "Administrator") return "admin";
  return "moderator";
}

async function hire(
  db: Awaited<ReturnType<typeof ensureIndexes>>,
  cv: CvApplication,
): Promise<HrEmployee> {
  const col = db.collection("hr_employees");
  const [last] = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = ((last?.id as number) ?? 0) + 1;
  const isTeacher = cv.position === "O'qituvchi";

  const employee: HrEmployee = {
    id: nextId,
    name: cv.name,
    // Referensdagi taxmin: ismi "a" bilan tugasa — ayol. Xodim kartasida
    // qo'lda tuzatish mumkin.
    gender: /a$/i.test(cv.name.split(" ")[0] || "") ? "female" : "male",
    aktivOq: 0,
    groups: 0,
    turi: positionToTuri(cv.position),
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
    photoUrl: "",
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

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
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
    employee = await hire(db, current);
    set.hiredEmpId = employee.id;
  }

  await col.updateOne({ id: cvId }, { $set: set });
  const application: CvApplication = { ...current, ...set } as CvApplication;
  // `_id`/`ord` mijozga chiqmasin.
  delete (application as unknown as Record<string, unknown>)._id;
  delete (application as unknown as Record<string, unknown>).ord;

  return NextResponse.json({ ok: true, application, employee });
}
