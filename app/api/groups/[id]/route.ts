import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Group } from "@/lib/groups";

// GET /api/groups/:id — bitta guruh (detail sahifasi uchun).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const row = await db.collection("groups").findOne({ id: groupId });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = row;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// PATCH /api/groups/:id — guruh maydonlarini qisman yangilaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Group>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const { id: _ignore, ...set } = body as Partial<Group> & { _id?: unknown };
  delete (set as { _id?: unknown })._id;

  const db = await ensureIndexes();
  const res = await db.collection("groups").findOneAndUpdate(
    { id: groupId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...group } = res;
  return NextResponse.json({ ok: true, group: group as unknown as Group });
}

// DELETE /api/groups/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("groups").deleteOne({ id: groupId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
