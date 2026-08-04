import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Room } from "@/lib/rooms";

// PATCH /api/rooms/:id — xonani yangilaydi (Xonalar → tahrirlash).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Room>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (body.capacity !== undefined) set.capacity = parseInt(String(body.capacity), 10) || 0;
  if (typeof body.note === "string") set.note = body.note.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("rooms").findOneAndUpdate(
    { id: roomId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }
  const { _id, ...room } = res;
  return NextResponse.json({ ok: true, room: room as unknown as Room });
}

// DELETE /api/rooms/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("rooms").deleteOne({ id: roomId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xona topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
