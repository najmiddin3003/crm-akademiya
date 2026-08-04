import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Survey } from "@/lib/surveys";

// PATCH /api/surveys/:id — so'rovnomani tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surveyId = Number(id);
  if (!Number.isFinite(surveyId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Survey>;
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
  if (typeof body.image === "string") set.image = body.image.trim();
  if (typeof body.code === "string") {
    const code = body.code.trim();
    if (!code) return NextResponse.json({ ok: false, error: "Kodni kiriting" }, { status: 400 });
    set.code = code;
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("surveys").findOneAndUpdate(
    { id: surveyId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "So'rovnoma topilmadi" }, { status: 404 });
  }
  const { _id, ...survey } = res;
  return NextResponse.json({ ok: true, survey: survey as unknown as Survey });
}

// DELETE /api/surveys/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surveyId = Number(id);
  if (!Number.isFinite(surveyId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("surveys").deleteOne({ id: surveyId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "So'rovnoma topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
