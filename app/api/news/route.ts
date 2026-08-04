import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { NEWS_SEED } from "@/constants/news";
import type { NewsItem } from "@/lib/news";

// Sotuv va marketing → Yangiliklar backend'i (MongoDB `news`).
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(NEWS_SEED)));
  }
}

// Referensdagi format: "DD-MM-YYYY | HH:mm"
function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("news");
  await seedIfEmpty(col);
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
