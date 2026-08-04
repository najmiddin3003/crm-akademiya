import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";

// GET /api/groups/:id/students — guruhga qo'shilgan o'quvchilar (pupils).
// group.studentIds (pupils.id) bo'yicha pupils kolleksiyasiga join qiladi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne({ id: groupId });
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const ids = group.studentIds ?? [];
  const rows = ids.length ? await db.collection("pupils").find({ id: { $in: ids } }).toArray() : [];
  // studentIds tartibini saqlaymiz (qo'shilgan tartibda).
  const byId = new Map(rows.map((r) => [r.id, r]));
  const students = ids
    .map((pid) => byId.get(pid))
    .filter(Boolean)
    .map((r) => {
      const { _id, ...rest } = r as Record<string, unknown>;
      return rest as unknown as Pupil;
    });
  return NextResponse.json({ ok: true, students });
}

// POST /api/groups/:id/students — { pupilId } o'quvchini guruhga qo'shadi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: { pupilId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const pupilId = Number(body.pupilId);
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const pupil = await db.collection("pupils").findOne({ id: pupilId });
  if (!pupil) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  const res = await db.collection<Group>("groups").updateOne(
    { id: groupId },
    { $addToSet: { studentIds: pupilId } },
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...student } = pupil;
  return NextResponse.json({ ok: true, student: student as unknown as Pupil });
}
