import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { sanitizePermissions } from "@/lib/permissions";
import { ensureRoles, type Role } from "@/lib/roles";

// PATCH /api/roles/:id — rolning IZOHI va RUXSATLARINI yangilaydi.
//
// Nomi va kaliti o'zgarmaydi: rollar tizimning qat'iy qismi va nomi
// `hr_employees.turi` bilan bog'langan (lib/roles.ts). O'chirish ham yo'q.
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

  const set: Record<string, unknown> = {};
  if (typeof body.description === "string") set.description = body.description.trim();
  // Ko'rinadigan bo'limlar. `null` — cheklovni olib tashlash; massiv —
  // aynan shu bo'limlar (noma'lum kalitlar tashlanadi).
  if (body.permissions !== undefined) {
    set.permissions = body.permissions === null ? null : sanitizePermissions(body.permissions);
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  // Yozuvlar mavjudligiga kafolat — bo'sh bazada ham PATCH ishlasin.
  await ensureRoles(db);

  const res = await db.collection("roles").findOneAndUpdate(
    { id: roleId, key: { $exists: true } },
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
