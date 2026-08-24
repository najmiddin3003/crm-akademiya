import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/pupils/:id/activity — o'quvchi profilidagi "Harakatlar tarixi"
// tabi uchun audit jurnali (MongoDB `pupil_activity`).
//
// ILGARI NIMA NOTO'G'RI EDI: tab hech qanday so'rov yubormasdan UCHTA
// QATTIQ YOZILGAN qatorni ("Birinchi to'lov", "paidAt", "Balans" —
// qurilma nomi esa har doim `"Windows", chrome`) haqiqiy audit izi
// sifatida ko'rsatardi. Bu fakt da'vosi edi: bazada bunday yozuv umuman
// yo'q va u yerda nima bo'lganini hech kim qayd qilmagan.
//
// Jurnal FAQAT O'QISH uchun (GET). Yozuvni tizimning o'zi qo'yishi kerak:
// masalan PATCH /api/pupils/:id o'zgargan har bir maydon uchun shu
// kolleksiyaga bitta hujjat yozsa. Hozircha hech bir route bu yerga
// yozmaydi, shuning uchun ro'yxat bo'sh qaytadi — bu HALOL bo'sh holat,
// o'ylab topilgan qator emas.
//
// Hujjat ko'rinishi (yozish qo'shilganda shu shakl kutiladi):
//   { id, pupilId, field, from, to, staff, kind, device, date, time }

interface PupilActivityRow {
  id: number;
  pupilId: number;
  /** Qaysi maydon o'zgardi ("Ism", "Balans", ...). */
  field: string;
  from: string;
  to: string;
  /** O'zgartirgan xodim. */
  staff: string;
  /** Xodim turi ("Moderator", "Tizim", ...). */
  kind: string;
  /** Qurilma nomi — brauzer/OS. */
  device: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  time: string;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = Number(id);
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const rows = await db
    .collection("pupil_activity")
    .find({ pupilId })
    .sort({ date: -1, time: -1, id: -1 })
    .toArray();

  const entries = rows.map((row) => {
    const { _id, ...rest } = row;
    void _id; // mijozga MongoDB ichki id'si chiqmaydi
    return rest as unknown as PupilActivityRow;
  });
  return NextResponse.json({ ok: true, entries });
}
