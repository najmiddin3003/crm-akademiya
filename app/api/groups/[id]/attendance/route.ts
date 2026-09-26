import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { notifyAttendance } from "@/lib/studentBot/notify";
import { groupScopeFilter } from "@/lib/groupScope";
import type { Group } from "@/lib/groups";
import { toUz } from "@/lib/uzTime";
import { attendanceGuard, onAttendanceChanged, type AttendanceEvent } from "@/lib/gamification/attendance";
import { loadSettings } from "@/lib/gamification/settings";
import {
  ABSENCE_REASONS,
  ATTENDANCE_OPTIONS,
  type AttendanceGrade,
  type AttendanceHistoryEntry,
  type AttendanceMark,
  type AttendanceStatus,
} from "@/lib/attendance";

/** "15.08.2026 | 00:22" — loyihadagi boshqa sanalar bilan bir xil format. */
function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Guruh davomati. MongoDB kolleksiyasi: `attendance`.
// Bitta yozuv = bitta o'quvchining bitta darsdagi belgisi:
//   { groupId, pupilId, date: "2026-08-03", status: "keldi" }
// Kalit — (groupId, pupilId, date) uchligi (lib/mongodb.ts da unique indeks).

const VALID = new Set<string>(ATTENDANCE_OPTIONS.map((o) => o.key));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseGroupId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * GAMIFIKATSIYA HODISASI (lib/gamification/attendance.ts): holat o'zgarsa
 * tanga yozuvi va seriya qayta hisoblanadi. Javobdan OLDIN kutiladi — dars
 * jurnali darhol to'g'ri holatni ko'rsin. Xato davomatni yiqitmaydi: belgi
 * allaqachon saqlangan, xato logga yoziladi.
 */
async function gamEvent(db: Parameters<typeof onAttendanceChanged>[0], e: AttendanceEvent): Promise<void> {
  try {
    await onAttendanceChanged(db, e);
  } catch (err) {
    console.error("[gamification] davomat hodisasi", { groupId: e.groupId, pupilId: e.pupilId, date: e.date }, err);
  }
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

  const pupilId = Number(body.pupilId);
  const date = String(body.date ?? "");
  const status = body.status ?? null;

  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi tanlanmagan" }, { status: 400 });
  }
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
  }
  if (status !== null && !VALID.has(status)) {
    return NextResponse.json({ ok: false, error: "Davomat holati noto'g'ri" }, { status: 400 });
  }

  // Baho ixtiyoriy, lekin berilsa 1..5 butun son bo'lishi shart.
  let grade: AttendanceGrade | null = null;
  if (body.grade !== undefined && body.grade !== null) {
    const g = Number(body.grade);
    if (!Number.isInteger(g) || g < 1 || g > 5) {
      return NextResponse.json({ ok: false, error: "Baho 1 dan 5 gacha bo'lishi kerak" }, { status: 400 });
    }
    grade = g as AttendanceGrade;
  }
  // Sabab faqat ro'yxatdagilardan bo'lsin — erkin matn `note` ga yoziladi.
  const reason = body.reason ? String(body.reason) : null;
  if (reason !== null && !ABSENCE_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: "Sabab ro'yxatdan tanlanishi kerak" }, { status: 400 });
  }
  const note = body.note ? String(body.note).slice(0, 2000) : null;

  // Guruh JORIY FILIALDA bo'lishi shart (lib/groupScope.ts) — aks holda
  // boshqa filial guruhiga davomat qo'yib bo'lardi.
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

  const key = { groupId, pupilId, date };
  const col = db.collection<AttendanceMark>("attendance");

  // GAMIFIKATSIYA YOQILGAN bo'lsa (TZ 7) davomat HOLATINI o'zgartirish
  // cheklanadi: ustoz — o'z guruhi, faqat dars kuni; filial admini — o'z
  // filiali, e'tiroz muddati ichida; direktor — istalgan sana. Faqat holat
  // o'zgarganda — baho yoki izohni har doim o'zgartirish mumkin (tangaga
  // ta'sir qilmaydi). Modul o'chiq bo'lsa hech narsa o'zgarmaydi.
  const guard = await attendanceGuard(db, group as Group & { branchId?: number }, date);
  if (guard.active && guard.denial) {
    const existing = await col.findOne(key, { projection: { _id: 0, status: 1 } });
    if ((existing?.status ?? null) !== status) {
      return NextResponse.json({ ok: false, error: guard.denial }, { status: 403 });
    }
  }

  // Har bir o'zgarish tarixga yoziladi ("Tarixi" bo'limi) — eskisi o'chmaydi.
  const me = await getCurrentUser();
  const writeHistory = async (entry: Omit<AttendanceHistoryEntry, "id" | "author" | "createdAt">) => {
    const col = db.collection("attendance_history");
    const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
    await col.insertOne({
      id: (last[0]?.id ?? 0) + 1,
      author: me?.fullName || "Noma'lum",
      createdAt: fmtNow(new Date()),
      ...entry,
    });
  };

  if (status === null) {
    const prev = await col.findOneAndDelete(key);
    await writeHistory({ ...key, status: null, grade: null, reason: null, note: null });
    if (guard.active) await gamEvent(db, { ...key, before: prev?.status ?? null, after: null, staff: guard.staff });
    return NextResponse.json({ ok: true, mark: null });
  }
  // Sabab/izoh faqat "sababli" holatida saqlanadi — boshqa holatga o'tilganda
  // eski sabab qolib ketmasligi kerak.
  const mark: AttendanceMark = {
    ...key,
    status,
    grade,
    reason: status === "sababli" ? reason : null,
    note: status === "sababli" ? note : null,
  };
  // `before` — o'zgarishdan OLDINGI holat, atomik (gamifikatsiya hodisasi uchun).
  const prev = await col.findOneAndUpdate(key, { $set: mark }, { upsert: true, returnDocument: "before" });
  await writeHistory({
    ...key,
    status,
    grade,
    reason: mark.reason ?? null,
    note: mark.note ?? null,
  });
  if (guard.active) await gamEvent(db, { ...key, before: prev?.status ?? null, after: status, staff: guard.staff });

  // O'QUVCHILAR BOTI — "davomat belgilandi" xabari.
  //
  // `after` ichida: javob ustozga YUBORILGANDAN KEYIN ishlaydi, ya'ni
  // Telegram sekin javob bersa ham davomat jadvali kutib turmaydi. Bir
  // darsda 15-20 o'quvchi belgilanadi va har biri alohida so'rov —
  // ularning hech biri sekinlashmasligi kerak.
  //
  // BELGI O'CHIRILGANDA (status === null) yuborilmaydi — yuqoridagi
  // shox alohida qaytadi. "Davomatingiz o'chirildi" degan xabar
  // o'quvchiga hech narsa bermaydi, faqat xavotir uyg'otadi.
  //
  // `notifyAttendance` o'zi hech qachon otmaydi va sozlama o'chiq
  // bo'lsa jimgina qaytadi (lib/studentBot/notify.ts).
  after(() =>
    notifyAttendance(db, {
      pupilId,
      date,
      status,
      grade,
      reason: mark.reason ?? null,
      groupName: group.name || String(group.id),
    }),
  );

  return NextResponse.json({ ok: true, mark });
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
  for (const e of events) await gamEvent(db, e);
  return NextResponse.json({ ok: true, deleted: res.deletedCount });
}
