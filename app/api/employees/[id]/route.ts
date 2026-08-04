import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { isValidPassword, isValidPhone, setPasswordFields, normalizePhone } from "@/lib/invite";

const EDITABLE_STATUSES = ["active", "frozen", "blocked"] as const;
type EditableStatus = (typeof EDITABLE_STATUSES)[number];

interface PatchBody {
  fullName?: string;
  phone?: string;
  position?: string;
  status?: EditableStatus;
  new_password?: string;
}

// PATCH /api/employees/:id
// Admin xodim ma'lumotlarini tahrirlaydi (F.I.Sh./telefon/lavozim),
// holatini o'zgartiradi (active/frozen/blocked) va/yoki yangi parol
// o'rnatadi. Faqat body'da kelgan maydonlar yangilanadi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const employees = db.collection("employees");
  const users = db.collection("users");

  const employee = await employees.findOne({ _id: new ObjectId(id) });
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  const employeeSet: Record<string, unknown> = {};
  const userSet: Record<string, unknown> = {};
  let unsetInvite = false;

  if (body.fullName !== undefined) {
    const fullName = body.fullName.trim();
    if (!fullName) {
      return NextResponse.json({ ok: false, error: "F.I.Sh. bo'sh bo'lishi mumkin emas" }, { status: 400 });
    }
    employeeSet.fullName = fullName;
    userSet.fullName = fullName;
  }

  if (body.phone !== undefined) {
    if (!isValidPhone(body.phone)) {
      return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
    }
    const phone = normalizePhone(body.phone);
    if (phone !== employee.phone) {
      const clash = await users.findOne({ phone });
      if (clash) {
        return NextResponse.json({ ok: false, error: "Bu telefon raqami allaqachon band" }, { status: 409 });
      }
    }
    employeeSet.phone = phone;
    userSet.phone = phone;
  }

  if (body.position !== undefined) employeeSet.position = body.position.trim() || null;

  if (body.status !== undefined) {
    if (!EDITABLE_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: "Noto'g'ri holat" }, { status: 400 });
    }
    userSet.status = body.status;
    userSet.statusUpdatedAt = new Date();
  }

  if (body.new_password !== undefined) {
    if (!isValidPassword(body.new_password)) {
      return NextResponse.json({ ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
    }
    const { passwordHash, passwordEnc } = await setPasswordFields(body.new_password);
    userSet.passwordHash = passwordHash;
    userSet.passwordEnc = passwordEnc;
    userSet.passwordUpdatedAt = new Date();
    // Admin to'g'ridan-to'g'ri parol o'rnatsa, taklif hali faollashtirilmagan
    // bo'lsa ham hisob shu zahoti ishlatishga tayyor bo'ladi.
    if (body.status === undefined) {
      userSet.status = "active";
      unsetInvite = true;
    }
  }

  if (Object.keys(employeeSet).length > 0) {
    await employees.updateOne({ _id: employee._id }, { $set: employeeSet });
  }
  if (Object.keys(userSet).length > 0) {
    const update: Record<string, unknown> = { $set: userSet };
    if (unsetInvite) update.$unset = { invite: "" };
    await users.updateOne({ employeeId: employee._id }, update);
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/employees/:id — xodim va unga bog'liq user hisobini butunlay o'chiradi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const employee = await db.collection("employees").findOne({ _id: new ObjectId(id) });
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  await db.collection("users").deleteOne({ employeeId: employee._id });
  await db.collection("employees").deleteOne({ _id: employee._id });

  return NextResponse.json({ ok: true });
}
