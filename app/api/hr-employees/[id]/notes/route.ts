import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { EMPLOYEE_NOTE_MAX, type EmployeeNote } from "@/lib/employeeNotes";
import { toUz } from "@/lib/uzTime";

// Xodim profili → "Eslatma". MongoDB `employee_notes`.
// Tuzilishi app/api/groups/[id]/notes/route.ts bilan bir xil.

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function parseEmpId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// GET /api/hr-employees/:id/notes — eskisidan yangisiga (chat kabi).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employeeId = parseEmpId(id);
  if (employeeId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const rows = await db.collection("employee_notes").find({ employeeId }).sort({ id: 1 }).toArray();
  const notes = rows.map(({ _id, ...rest }) => rest as unknown as EmployeeNote);
  return NextResponse.json({ ok: true, notes });
}

// POST /api/hr-employees/:id/notes — { text } yangi xabar qo'shadi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employeeId = parseEmpId(id);
  if (employeeId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Xabar bo'sh" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const emp = await db.collection("hr_employees").findOne({ id: employeeId });
  if (!emp) {
    return NextResponse.json({ ok: false, error: "Xodim topilmadi" }, { status: 404 });
  }

  const col = db.collection("employee_notes");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const me = await getCurrentUser();

  const note: EmployeeNote = {
    id: (last[0]?.id ?? 0) + 1,
    employeeId,
    text: text.slice(0, EMPLOYEE_NOTE_MAX),
    author: me?.fullName || "Noma'lum",
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...note });
  return NextResponse.json({ ok: true, note });
}

// DELETE /api/hr-employees/:id/notes?noteId=5
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employeeId = parseEmpId(id);
  if (employeeId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const noteId = Number(new URL(req.url).searchParams.get("noteId"));
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ ok: false, error: "Xabar tanlanmagan" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("employee_notes").deleteOne({ id: noteId, employeeId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Xabar topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
