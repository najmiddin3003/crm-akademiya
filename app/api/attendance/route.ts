import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { AttendanceMark } from "@/lib/attendance";

// GET /api/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// BUTUN `attendance` kolleksiyasi bo'yicha belgilar. Nazorat bo'limidagi
// uchta sahifa (Davomat, Davomat analitikasi, Davomat qilinmagan guruhlar)
// hamma guruhning belgilariga birdan qaraydi.
//
// NEGA QO'SHILDI: bunday route yo'q edi, faqat GET /api/groups/:id/attendance
// bor edi. Shuning uchun components/nazorat/useNazoratAttendance.ts har bir
// guruh uchun ALOHIDA so'rov yuborardi — bazada 91 ta guruh bor, ya'ni
// sahifa har ochilganda 91 ta HTTP so'rovi, har biri o'zining
// `ensureIndexes()` va Atlas round-trip'i bilan. Brauzer bitta domenga
// 6 tadan ortiq ulanish ochmaydi, ya'ni ular ~16 to'lqinga bo'linib
// ketardi.
//
// Guruh bo'yicha ajratish klientda qoladi (`marks` da `groupId` bor) —
// shakl GET /api/groups/:id/attendance bilan AYNAN bir xil, shu bois
// sahifalarda hisob mantiqi o'zgarmaydi.
//
// `from`/`to` ixtiyoriy: bugun kolleksiya kichik va sahifalar baribir
// hammasini so'raydi, lekin ma'lumot ko'paygach chaqiruvchi oynani
// toraytira olsin.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }

  const filter: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, string> = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    filter.date = range;
  }

  const db = await ensureIndexes();
  const rows = await db.collection<AttendanceMark>("attendance").find(filter).toArray();
  const marks = rows.map(({ groupId, pupilId, date, status, grade, reason, note }) => ({
    groupId,
    pupilId,
    date,
    status,
    grade: grade ?? null,
    reason: reason ?? null,
    note: note ?? null,
  }));
  return NextResponse.json({ ok: true, marks });
}
