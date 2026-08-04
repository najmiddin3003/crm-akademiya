import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { NewsItem } from "@/lib/news";

// PATCH /api/news/:id — yangilikni tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<NewsItem>;
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
  if (typeof body.content === "string") set.content = body.content.trim();
  if (typeof body.image === "string") set.image = body.image.trim();
  if (body.views !== undefined) set.views = Number(body.views) || 0;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("news").findOneAndUpdate(
    { id: newsId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Yangilik topilmadi" }, { status: 404 });
  }
  const { _id, ...item } = res;
  return NextResponse.json({ ok: true, item: item as unknown as NewsItem });
}

// DELETE /api/news/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("news").deleteOne({ id: newsId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Yangilik topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
