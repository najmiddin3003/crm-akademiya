import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Role } from "@/lib/roles";

// PATCH /api/roles/:id — rolni tahrirlaydi.
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
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Rol nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.description === "string") set.description = body.description.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("roles").findOneAndUpdate(
    { id: roleId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Rol topilmadi" }, { status: 404 });
  }
  const { _id, ...role } = res;
  return NextResponse.json({ ok: true, role: role as unknown as Role });
}

// DELETE /api/roles/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isFinite(roleId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("roles").deleteOne({ id: roleId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Rol topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
