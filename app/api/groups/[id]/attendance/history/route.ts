import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { AttendanceHistoryEntry } from "@/lib/attendance";

// GET /api/groups/:id/attendance/history — davomat o'zgarishlari tarixi,
// eng yangisidan eskisiga. Ikki xil chaqiriladi:
//
//   ?pupilId=1&date=2026-08-03  — BITTA katakcha bo'yicha. Davomat
//                                 jadvalidagi "Tarixi" oynasi shuni oladi.
//   ?from=2026-08-01&to=2026-08-31 — butun GURUH bo'yicha oraliq. Guruh
//                                 tafsilotidagi "Guruh tarixi" tabi shuni
//                                 oladi; ilgari bunday rejim yo'q edi va
//                                 tab har bir o'quvchi×kun uchun alohida
//                                 so'rov yuborishga majbur bo'lardi
//                                 (yuzlab so'rov, guruh katta bo'lsa esa
//                                 umuman ko'rsatolmasdi).
//
// Oraliq rejimida guruhdan CHIQARILGAN o'quvchilarning yozuvlari ham
// qaytadi — ular tarixning bir qismi va yo'qolmasligi kerak.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bir so'rovda qaytadigan eng ko'p yozuv (jadval baribir sahifalanadi). */
const RANGE_LIMIT = 2000;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("attendance_history");
  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "");
  const to = String(url.searchParams.get("to") ?? "");

  // Oraliq rejimi — pupilId/date berilmaganda.
  if (!url.searchParams.has("pupilId") && !url.searchParams.has("date")) {
    const filter: Record<string, unknown> = { groupId };
    if (from || to) {
      if (from && !ISO_DATE.test(from)) {
        return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
      }
      if (to && !ISO_DATE.test(to)) {
        return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
      }
      // Sanalar "YYYY-MM-DD" — leksikografik solishtirish sana bo'yicha to'g'ri.
      filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    }
    const rows = await col.find(filter).sort({ id: -1 }).limit(RANGE_LIMIT).toArray();
    const entries = rows.map(({ _id, ...rest }) => rest as unknown as AttendanceHistoryEntry);
    return NextResponse.json({ ok: true, entries, truncated: entries.length === RANGE_LIMIT });
  }

  const pupilId = Number(url.searchParams.get("pupilId"));
  const date = String(url.searchParams.get("date") ?? "");
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "O'quvchi tanlanmagan" }, { status: 400 });
  }
  if (!ISO_DATE.test(date)) {
    return NextResponse.json({ ok: false, error: "Sana formati noto'g'ri" }, { status: 400 });
  }

  const rows = await col.find({ groupId, pupilId, date }).sort({ id: -1 }).toArray();
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as AttendanceHistoryEntry);
  return NextResponse.json({ ok: true, entries });
}
