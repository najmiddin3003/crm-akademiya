import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Pupil } from "@/lib/pupilsData";

// Bitta o'quvchi (MongoDB `pupils`) — O'quvchi profili sahifasi uchun
// (/student-edit/:id → components/students/StudentEditPage.tsx).
//
// Ilgari bu route umuman yo'q edi: profil sahifasidagi "Saqlash" va
// "O'chirish" tugmalari hech qanday so'rov yubormasdi.

/** PATCH orqali o'zgartirishga RUXSAT ETILGAN maydonlar. */
const EDITABLE = [
  "firstName", "lastName", "phone", "extraPhone", "category", "birthDate",
  "email", "tags", "lessonTime", "paymentDate", "language", "survey",
  "targetUniversity", "fatherName", "fatherPhone", "fatherWork",
  "motherName", "motherPhone", "motherWork", "address", "studyPlace", "note",
  "moderator", "source",
] as const;

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const doc = await db.collection("pupils").findOne({ id: pupilId });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  const { _id, ...pupil } = doc;
  return NextResponse.json({ ok: true, pupil: pupil as unknown as Pupil });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  // Faqat ruxsat etilgan maydonlar — id/balance/coin kabilarni forma
  // orqali o'zgartirib bo'lmaydi.
  const set: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) set[key] = typeof body[key] === "string" ? (body[key] as string).trim() : body[key];
  }

  if (typeof set.firstName === "string" && !set.firstName) {
    return NextResponse.json({ ok: false, error: "Ism majburiy" }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("pupils").findOneAndUpdate(
    { id: pupilId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  const { _id, ...pupil } = res;
  return NextResponse.json({ ok: true, pupil: pupil as unknown as Pupil });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("pupils").deleteOne({ id: pupilId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  // O'quvchi guruhlardan ham chiqariladi — aks holda guruh ro'yxatida
  // mavjud bo'lmagan id qolib ketadi.
  await db
    .collection<{ studentIds?: number[] }>("groups")
    .updateMany({ studentIds: pupilId }, { $pull: { studentIds: pupilId } });
  return NextResponse.json({ ok: true });
}
