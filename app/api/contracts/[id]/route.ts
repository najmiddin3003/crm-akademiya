import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Contract } from "@/lib/contracts";

// PATCH /api/contracts/:id — shartnoma andozasini tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Contract>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ ok: false, error: "Sarlavhani kiriting" }, { status: 400 });
    set.title = title;
  }
  if (typeof body.type === "string") set.type = body.type;
  if (typeof body.content === "string") set.content = body.content;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("contracts").findOneAndUpdate(
    { id: contractId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Shartnoma topilmadi" }, { status: 404 });
  }
  const { _id, ...contract } = res;
  return NextResponse.json({ ok: true, contract: contract as unknown as Contract });
}

// DELETE /api/contracts/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contractId = Number(id);
  if (!Number.isFinite(contractId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("contracts").deleteOne({ id: contractId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Shartnoma topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
