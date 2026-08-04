import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { SURVEY_SEED } from "@/constants/surveys";
import type { Survey } from "@/lib/surveys";

// Sotuv va marketing → Marketing (so'rovnomalar) backend'i
// (MongoDB `surveys`). Bo'sh bo'lsa 4 ta demo manbani seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(SURVEY_SEED)));
  }
}

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
  await seedIfEmpty(col);
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
