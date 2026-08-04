import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Story } from "@/lib/stories";

// PATCH /api/stories/:id — hikoyani tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Story>;
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
  if (typeof body.file === "string") set.file = body.file.trim();
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("stories").findOneAndUpdate(
    { id: storyId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Hikoya topilmadi" }, { status: 404 });
  }
  const { _id, ...story } = res;
  return NextResponse.json({ ok: true, story: story as unknown as Story });
}

// DELETE /api/stories/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storyId = Number(id);
  if (!Number.isFinite(storyId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("stories").deleteOne({ id: storyId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Hikoya topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
