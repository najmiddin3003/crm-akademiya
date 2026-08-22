import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Survey } from "@/lib/surveys";

// Sotuv va marketing → Marketing (so'rovnomalar) backend'i
// (MongoDB `surveys`). Demo seed YO'Q — manbalarni foydalanuvchi qo'shadi.
// Keyingi kod: mavjud "s26" ko'rinishidagi kodlarning eng kattasidan +1.
function nextCode(existing: string[]): string {
  const max = existing.reduce((acc, c) => {
    const n = Number(c.replace(/^\D+/, ""));
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `s${max + 1}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("surveys");
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const surveys = rows.map(({ _id, ...rest }) => rest as unknown as Survey);
  return NextResponse.json({ ok: true, surveys });
}

export async function POST(req: Request) {
  let body: Partial<Survey>;
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
  const col = db.collection("surveys");
  const all = await col.find({}).toArray();
  const nextId = all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;

  const survey: Survey = {
    id: nextId,
    title,
    image: (body.image || "").trim(),
    code: (body.code || "").trim() || nextCode(all.map((r) => String(r.code || ""))),
  };
  await col.insertOne({ ...survey });
  return NextResponse.json({ ok: true, survey });
}
