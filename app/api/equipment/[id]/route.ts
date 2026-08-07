import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Equipment } from "@/lib/equipment";

// PATCH /api/equipment/:id — jihozni yangilaydi (Jihozlar → tahrirlash).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipmentId = Number(id);
  if (!Number.isFinite(equipmentId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Equipment>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") set.name = body.name.trim();
  if (typeof body.inventoryCode === "string" && body.inventoryCode.trim()) set.inventoryCode = body.inventoryCode.trim();
  if (body.price !== undefined) set.price = parseFloat(String(body.price)) || 0;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("equipment").findOneAndUpdate(
    { id: equipmentId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Jihoz topilmadi" }, { status: 404 });
  }
  const { _id, ...equipment } = res;
  return NextResponse.json({ ok: true, equipment: equipment as unknown as Equipment });
}

// DELETE /api/equipment/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const equipmentId = Number(id);
  if (!Number.isFinite(equipmentId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("equipment").deleteOne({ id: equipmentId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Jihoz topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
