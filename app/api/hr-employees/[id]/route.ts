import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizeAssignments, type HrEmployee } from "@/lib/hrEmployees";

// GET /api/hr-employees/:id — bitta xodim (profil sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const row = await db.collection("hr_employees").findOne({ id: empId });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  const { _id, ...employee } = row;
  // `archDate` keyin qo'shilgan — eski hujjatlarda yo'q. Ro'yxat route'i
  // (app/api/hr-employees/route.ts) uni bo'sh satrga to'ldiradi; profil
  // ham xuddi shunday qilsin, aks holda tip `string` deganda `undefined`
  // qaytadi.
  return NextResponse.json({ ok: true, employee: { archDate: "", ...employee } as unknown as HrEmployee });
}

// PATCH /api/hr-employees/:id — xodim maydonlarini qisman yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<HrEmployee>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  // Faqat ruxsat etilgan maydonlar yoziladi. Ilgari bu yerda mijoz yuborgan
  // JSON to'g'ridan-to'g'ri $set qilinardi — `salary` satr ko'rinishida
  // kelib qolsa, oylik yig'indisi qo'shilish o'rniga birikib ketardi va
  // o'sha qiymat kassadagi chiqim chegarasini boshqargan bo'lardi.
  const set: Record<string, unknown> = {};
  for (const k of ["name", "gender", "turi", "filial", "phone", "kurs", "email", "degree", "photoUrl", "archReason", "archDate", "lastActive", "percent"] as const) {
    if (typeof body[k] === "string") set[k] = body[k];
  }
  for (const k of ["aktivOq", "groups"] as const) {
    if (Number.isFinite(Number(body[k]))) set[k] = Number(body[k]);
  }
  // Ish haqi — POST bilan bir xil tozalagichdan o'tadi (lib/hrEmployees.ts).
  if (body.branchAssignments !== undefined) {
    set.branchAssignments = sanitizeAssignments(body.branchAssignments);
  }

  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("hr_employees").findOneAndUpdate(
    { id: empId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  const { _id, ...employee } = res;
  return NextResponse.json({ ok: true, employee: employee as unknown as HrEmployee });
}

// DELETE /api/hr-employees/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empId = Number(id);
  if (!Number.isFinite(empId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("hr_employees").deleteOne({ id: empId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
