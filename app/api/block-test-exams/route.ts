import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { BlockTestExam } from "@/lib/blockTestExams";

// Blok testlar backend'i (MongoDB `block_test_exams`).
function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toIdArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return input.map((v) => Number(v)).filter((v) => Number.isFinite(v));
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("block_test_exams");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const exams = rows.map(({ _id, ...rest }) => rest as unknown as BlockTestExam);
  return NextResponse.json({ ok: true, exams });
}

export async function POST(req: Request) {
  let body: Partial<BlockTestExam>;
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
  const col = db.collection("block_test_exams");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const typeId = body.typeId !== undefined && body.typeId !== null ? Number(body.typeId) : null;
  const responsibleEmployeeId = body.responsibleEmployeeId !== undefined && body.responsibleEmployeeId !== null ? Number(body.responsibleEmployeeId) : null;

  const exam: BlockTestExam = {
    id: nextId,
    name,
    typeId: Number.isFinite(typeId as number) ? typeId : null,
    date: (body.date || "").trim(),
    startTime: (body.startTime || "").trim(),
    durationMinutes: parseInt(String(body.durationMinutes ?? ""), 10) || 0,
    groupIds: toIdArray(body.groupIds),
    responsibleEmployeeId: Number.isFinite(responsibleEmployeeId as number) ? responsibleEmployeeId : null,
    comment: (body.comment || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...exam });
  return NextResponse.json({ ok: true, exam });
}
