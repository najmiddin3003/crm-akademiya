import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch } from "@/lib/branchScope";
import { groupScopeFilter } from "@/lib/groupScope";
import type { Group } from "@/lib/groups";
import type { Pupil } from "@/lib/pupilsData";

// FILIAL QAMROVI IKKALA TOMONDA: guruh ham, o'quvchi ham JORIY filialda
// bo'lishi shart. Faqat guruh kesilsa, moderator boshqa filialning
// o'quvchisini o'z guruhiga qo'shib, uni shu yo'l bilan ko'rib olardi —
// o'quvchilar ro'yxati kesilgani bekor bo'lardi.
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

// GET /api/groups/:id/students — guruhga qo'shilgan o'quvchilar (pupils).
// group.studentIds (pupils.id) bo'yicha pupils kolleksiyasiga join qiladi.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne(withBranch({ id: groupId }, scope));
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const ids = group.studentIds ?? [];
  const rows = ids.length
    ? await db.collection("pupils").find(withBranch({ id: { $in: ids } }, scope)).toArray()
    : [];
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

  const scope = await getBranchScope();
  if (!scope) return notLoggedIn();
  const db = await ensureIndexes();
  const pupil = await db.collection("pupils").findOne(withBranch({ id: pupilId }, scope));
  if (!pupil) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  const res = await db.collection<Group>("groups").updateOne(
    withBranch({ id: groupId }, scope),
    { $addToSet: { studentIds: pupilId } },
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  const { _id, ...student } = pupil;
  return NextResponse.json({ ok: true, student: student as unknown as Pupil });
}

// DELETE /api/groups/:id/students?pupilId=11 — o'quvchini guruhdan chiqaradi.
//
// Ilgari bunday endpoint yo'q edi: guruhga qo'shish bor edi, chiqarish esa
// faqat o'quvchining o'zini o'chirish orqali bo'lardi.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const pupilId = Number(new URL(req.url).searchParams.get("pupilId"));
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchini tanlang" }, { status: 400 });
  }

  const where = await groupScopeFilter<{ id: number; studentIds?: number[] }>({ id: groupId });
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const res = await db
    .collection<{ id: number; studentIds?: number[] }>("groups")
    .updateOne(where, { $pull: { studentIds: pupilId } });
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, removed: res.modifiedCount > 0 });
}
