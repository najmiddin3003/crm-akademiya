import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { groupScopeFilter } from "@/lib/groupScope";
import type { Group } from "@/lib/groups";
import type { GroupNote } from "@/lib/groupNotes";
import { toUz } from "@/lib/uzTime";

// Guruh → Davomat → "Izoh" ustunidagi xabar oynasi.
// MongoDB kolleksiyasi: `group_notes`. Bitta yozuv = o'quvchiga yozilgan
// bitta xabar. Referensda bu o'ngdan chiqadigan panel: tepasida o'quvchi
// ismi, pastida "Izoh qoldirish" input.

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseGroupId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// GET /api/groups/:id/notes?pupilId=123 — o'quvchiga yozilgan xabarlar
// (eskisidan yangisiga — chat kabi).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseGroupId(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const pupilId = Number(url.searchParams.get("pupilId"));
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi tanlanmagan" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const rows = await db.collection("group_notes").find({ groupId, pupilId }).sort({ id: 1 }).toArray();
  const notes = rows.map(({ _id, ...rest }) => rest as unknown as GroupNote);
  return NextResponse.json({ ok: true, notes });
}

// POST /api/groups/:id/notes — { pupilId, text } yangi xabar qo'shadi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseGroupId(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { pupilId?: number; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const pupilId = Number(body.pupilId);
  const text = (body.text || "").trim();
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi tanlanmagan" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "Xabar bo'sh" }, { status: 400 });
  }

  // Guruh JORIY FILIALDA bo'lishi shart (lib/groupScope.ts).
  const where = await groupScopeFilter<Group>({ id: groupId });
  if (!where) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne(where);
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  if (!(group.studentIds ?? []).includes(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi bu guruhda emas" }, { status: 400 });
  }

  const col = db.collection("group_notes");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const note: GroupNote = {
    id: (last[0]?.id ?? 0) + 1,
    groupId,
    pupilId,
    text: text.slice(0, 2000),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...note });
  return NextResponse.json({ ok: true, note });
}

// DELETE /api/groups/:id/notes?noteId=5 — xabarni o'chirish.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseGroupId(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const url = new URL(req.url);
  const noteId = Number(url.searchParams.get("noteId"));
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ ok: false, error: "Xabar tanlanmagan" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("group_notes").deleteOne({ groupId, id: noteId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xabar topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
