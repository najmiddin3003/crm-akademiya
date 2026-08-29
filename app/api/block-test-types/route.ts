import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { BlockTestType, BlockTestSubject } from "@/lib/blockTestTypes";
import { toUz } from "@/lib/uzTime";

// Blok test turlari backend'i (MongoDB `block_test_types`).
function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function normalizeSubjects(input: unknown): BlockTestSubject[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((s) => ({
      subject: String((s as Partial<BlockTestSubject>)?.subject || "").trim(),
      questionsCount: parseInt(String((s as Partial<BlockTestSubject>)?.questionsCount ?? ""), 10) || 0,
      pointsPerCorrect: parseFloat(String((s as Partial<BlockTestSubject>)?.pointsPerCorrect ?? "")) || 0,
    }))
    .filter((s) => s.subject);
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("block_test_types");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const types = rows.map(({ _id, ...rest }) => rest as unknown as BlockTestType);
  return NextResponse.json({ ok: true, types });
}

export async function POST(req: Request) {
  let body: Partial<BlockTestType>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("block_test_types");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const type: BlockTestType = {
    id: nextId,
    name,
    code: `BT-${String(nextId).padStart(4, "0")}`,
    kind: (body.kind || "").trim(),
    durationMinutes: parseInt(String(body.durationMinutes ?? ""), 10) || 0,
    subjects: normalizeSubjects(body.subjects),
    active: body.active !== false,
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...type });
  return NextResponse.json({ ok: true, type });
}
