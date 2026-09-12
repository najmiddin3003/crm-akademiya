import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { BRANCH_TOPIC_FIELDS, parseLeadTopicId, type ManagementBranch } from "@/lib/managementBranches";

// PATCH /api/branches/:id — filialni tahrirlaydi.
//
// `leadTopicId` / `paymentTopicId` — filial lidlari va to'lovlari
// tushadigan Telegram topiklari (lib/leadNotify.ts, lib/sync/dispatch.ts).
// Bo'sh/null kelsa maydon OLIB TASHLANADI ($unset): `null` qoldirilsa ham
// ishlaydi, lekin hujjatda "topik yo'q" degan ma'noda ikki xil ko'rinish
// (maydon yo'q / null) yurmasin.
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
  const unset: Record<string, 1> = {};
  for (const field of BRANCH_TOPIC_FIELDS) {
    if (!(field in body)) continue;
    const topic = parseLeadTopicId(body[field]);
    if (!topic.ok) return NextResponse.json({ ok: false, error: topic.error }, { status: 400 });
    if (topic.value === null) unset[field] = 1;
    else set[field] = topic.value;
  }
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("branches").findOneAndUpdate(
    { id: branchId },
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
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
