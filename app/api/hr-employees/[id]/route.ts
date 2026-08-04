import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";

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
  return NextResponse.json({ ok: true, employee: employee as unknown as HrEmployee });
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
  // id/_id ni tashqaridan o'zgartirishga yo'l qo'ymaymiz.
  const { id: _ignore, ...set } = body as Partial<HrEmployee> & { _id?: unknown };
  delete (set as { _id?: unknown })._id;

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
