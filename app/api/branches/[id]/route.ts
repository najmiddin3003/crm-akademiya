import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { ManagementBranch } from "@/lib/managementBranches";

// PATCH /api/branches/:id — filialni tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branchId = Number(id);
  if (!Number.isFinite(branchId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<ManagementBranch>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Filial nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.location === "string") set.location = body.location.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("branches").findOneAndUpdate(
    { id: branchId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Filial topilmadi" }, { status: 404 });
  }
  const { _id, ...branch } = res;
  return NextResponse.json({ ok: true, branch: branch as unknown as ManagementBranch });
}

// DELETE /api/branches/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branchId = Number(id);
  if (!Number.isFinite(branchId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("branches").deleteOne({ id: branchId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Filial topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
