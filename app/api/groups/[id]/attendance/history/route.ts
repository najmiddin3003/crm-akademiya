import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { AttendanceHistoryEntry } from "@/lib/attendance";

// GET /api/groups/:id/attendance/history?pupilId=1&date=2026-08-03
// Bitta katakcha bo'yicha o'zgarishlar tarixi — eng yangisidan eskisiga.
// Davomat ro'yxatidagi "Tarixi" bo'limi shundan o'qiydi.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const pupilId = Number(url.searchParams.get("pupilId"));
  const date = String(url.searchParams.get("date") ?? "");
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi tanlanmagan" }, { status: 400 });
  }
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const rows = await db
    .collection("attendance_history")
    .find({ groupId, pupilId, date })
    .sort({ id: -1 })
    .toArray();
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as AttendanceHistoryEntry);
  return NextResponse.json({ ok: true, entries });
}
