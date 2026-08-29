import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { NewsItem } from "@/lib/news";
import { toUz } from "@/lib/uzTime";

// Sotuv va marketing → Yangiliklar backend'i (MongoDB `news`).
// Referensdagi format: "DD-MM-YYYY | HH:mm"
function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("news");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const items = rows.map(({ _id, ...rest }) => rest as unknown as NewsItem);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  let body: Partial<NewsItem>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "Sarlavhani kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("news");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const item: NewsItem = {
    id: nextId,
    image: (body.image || "").trim(),
    title,
    content: (body.content || "").trim(),
    views: 0,
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...item });
  return NextResponse.json({ ok: true, item });
}
