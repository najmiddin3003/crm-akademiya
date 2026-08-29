import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizePermissions } from "@/lib/permissions";
import { ensureRoles, isRoleKey, type Role } from "@/lib/roles";

// PATCH /api/roles/:id — rolni tahrirlaydi.
//
// O'rnatilgan rolda (teacher/moderator) NOMI o'zgarmaydi: u
// `hr_employees.turi` ga bog'langan va jadvalda lavozim sifatida
// ko'rsatiladi. Qo'lda qo'shilgan rolda nomi ham tahrirlanadi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isFinite(roleId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Role>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await ensureRoles(db);

  const existing = await db.collection("roles").findOne({ id: roleId }, { projection: { key: 1 } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Rol topilmadi" }, { status: 404 });
  }
  const builtIn = isRoleKey(existing.key);

  const set: Record<string, unknown> = {};
  if (!builtIn && typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Rol nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.description === "string") set.description = body.description.trim();
  // Ko'rinadigan bo'limlar. `null` — cheklovni olib tashlash; massiv —
  // aynan shu bo'limlar (noma'lum kalitlar tashlanadi).
  if (body.permissions !== undefined) {
    set.permissions = body.permissions === null ? null : sanitizePermissions(body.permissions);
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const res = await db.collection("roles").findOneAndUpdate(
    { id: roleId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Rol topilmadi" }, { status: 404 });
  }
  const { _id, ...role } = res;
  void _id;
  return NextResponse.json({ ok: true, role: role as unknown as Role });
}

// DELETE /api/roles/:id — faqat qo'lda qo'shilgan rolni o'chiradi.
// O'rnatilganlari o'chirilsa, o'sha lavozimdagi xodimlar jimgina
// cheklovsiz bo'lib qolardi.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isFinite(roleId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const existing = await db.collection("roles").findOne({ id: roleId }, { projection: { key: 1 } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Rol topilmadi" }, { status: 404 });
  }
  if (isRoleKey(existing.key)) {
    return NextResponse.json(
      { ok: false, error: "O'rnatilgan lavozimni o'chirib bo'lmaydi" },
      { status: 400 },
    );
  }
  await db.collection("roles").deleteOne({ id: roleId });
  return NextResponse.json({ ok: true });
}
