import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { groupScopeFilter } from "@/lib/groupScope";
import type { Group } from "@/lib/groups";
import { attendanceGuard, type AttendanceEvent } from "@/lib/gamification/attendance";
import { loadSettings } from "@/lib/gamification/settings";
import { attendanceGamEvent, saveAttendanceMark } from "@/lib/attendanceWrite";
import type { AttendanceMark, AttendanceStatus } from "@/lib/attendance";

// Guruh davomati. MongoDB kolleksiyasi: `attendance`.
// Bitta yozuv = bitta o'quvchining bitta darsdagi belgisi:
//   { groupId, pupilId, date: "2026-08-03", status: "keldi" }
// Kalit — (groupId, pupilId, date) uchligi (lib/mongodb.ts da unique indeks).
// Belgini yozish mantiqi — lib/attendanceWrite.ts (08.10.2026 dan; AI
// yordamchi ham o'shani chaqiradi).

function parseGroupId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// GET /api/groups/:id/attendance?year=2026&month=8
// Tanlangan oydagi barcha belgilarni qaytaradi. year/month berilmasa —
// guruhning butun davomati.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseGroupId(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));

  const filter: Record<string, unknown> = { groupId };
  if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
    // "2026-08" bilan boshlanadigan sanalar — indeksdan foydalanadi.
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    filter.date = { $gte: `${prefix}-01`, $lte: `${prefix}-31` };
  }

  const db = await ensureIndexes();
  const rows = await db.collection<AttendanceMark>("attendance").find(filter).toArray();
  const marks = rows.map(({ groupId: g, pupilId, date, status, grade, reason, note }) => ({
    groupId: g,
    pupilId,
    date,
    status,
    grade: grade ?? null,
    reason: reason ?? null,
    note: note ?? null,
  }));
  return NextResponse.json({ ok: true, marks });
}

// POST /api/groups/:id/attendance
// Bitta belgini saqlaydi: { pupilId, date, status }.
// `status: null` yuborilsa — belgi o'chiriladi (doiracha yana bo'sh bo'ladi).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = parseGroupId(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: {
    pupilId?: number;
    date?: string;
    status?: AttendanceStatus | null;
    grade?: number | null;
    reason?: string | null;
    note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  // Tekshiruv va yozish — lib/attendanceWrite.ts (AI yordamchi ham shuni
  // chaqiradi): holat, baho, sabab; guruh JORIY FILIALDA va o'quvchi shu
  // guruhda bo'lishi; gamifikatsiya cheklovi; tarix; o'quvchilar botiga
  // xabar (`after` ichida — javob ustozga ketgandan keyin).
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const me = await getCurrentUser();
  const db = await ensureIndexes();
  const out = await saveAttendanceMark(
    db,
    scope,
    {
      groupId,
      pupilId: Number(body.pupilId),
      date: String(body.date ?? ""),
      status: body.status ?? null,
      grade: body.grade,
      reason: body.reason,
      note: body.note,
    },
    me?.fullName || "",
    { defer: (fn) => after(fn) },
  );
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, mark: out.mark });
}

// DELETE /api/groups/:id/attendance?pupilId=123
// "Davomatni bekor qilish" tugmasi — o'quvchining shu guruhda tanlangan oyga
// (year/month berilsa) yoki umuman barcha belgilarini o'chiradi.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const filter: Record<string, unknown> = { groupId, pupilId };
  if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    filter.date = { $gte: `${prefix}-01`, $lte: `${prefix}-31` };
  }

  const db = await ensureIndexes();
  const col = db.collection<AttendanceMark>("attendance");

  // GAMIFIKATSIYA (TZ 7, 8): o'chiriladigan belgilar ichida modul
  // qamraydigan darslar bo'lsa — har biri uchun huquq tekshiriladi va
  // o'chirilgach «Davomat o'chirildi» hodisasi yuboriladi. Modul o'chiq
  // bo'lsa bu blok umuman ishlamaydi — eski xatti-harakat aynan saqlanadi.
  const gamOn = (await loadSettings(db)).enabled;
  const doomed = gamOn ? await col.find(filter, { projection: { _id: 0, date: 1, status: 1 } }).toArray() : [];
  const events: AttendanceEvent[] = [];
  if (doomed.length > 0) {
    const where = await groupScopeFilter<Group>({ id: groupId });
    if (!where) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
    const group = await db.collection<Group>("groups").findOne(where);
    if (!group) return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
    for (const m of doomed) {
      const guard = await attendanceGuard(db, group as Group & { branchId?: number }, m.date);
      if (!guard.active) continue;
      if (guard.denial) return NextResponse.json({ ok: false, error: guard.denial }, { status: 403 });
      events.push({ groupId, pupilId, date: m.date, before: m.status, after: null, staff: guard.staff });
    }
  }

  const res = await col.deleteMany(filter);
  for (const e of events) await attendanceGamEvent(db, e);
  return NextResponse.json({ ok: true, deleted: res.deletedCount });
}
