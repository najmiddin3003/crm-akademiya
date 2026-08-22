import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Story } from "@/lib/stories";

// Sotuv va marketing → Hikoya backend'i (MongoDB `stories`).
function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("stories");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const stories = rows.map(({ _id, ...rest }) => rest as unknown as Story);
  return NextResponse.json({ ok: true, stories });
}

export async function POST(req: Request) {
  let body: Partial<Story>;
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
  const col = db.collection("stories");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const story: Story = {
    id: nextId,
    image: (body.image || "").trim(),
    title,
    file: (body.file || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...story });
  return NextResponse.json({ ok: true, story });
}
