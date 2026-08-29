import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { buildPupilFromValues, type NewPupilValues, type Pupil } from "@/lib/pupilsData";

// GET /api/pupils — "O'quvchi qo'shish" orqali qo'shilgan haqiqiy o'quvchilar
// ro'yxati (constants/index.js'dagi statik demo STUDENTS'dan ajratilgan).
//
// `?light=1` — FAQAT ism va telefon. Ro'yxatda 6 700 dan ortiq o'quvchi bor
// va to'liq hujjatlar ~3.6 MB keladi. Tanlov ro'yxatlari (masalan topshiriq
// oynasidagi "kimga") uchun bu maydonlar yetarli, qolgani esa bekorga
// tashiladigan yuk edi.
const LIGHT_PROJECTION = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 };

export async function GET(req: Request) {
  const light = new URL(req.url).searchParams.get("light") === "1";
  const db = await ensureIndexes();
  const rows = await db.collection("pupils")
    .find({}, light ? { projection: LIGHT_PROJECTION } : {})
    .sort({ id: -1 })
    .toArray();
  // Parol xeshlari hech qachon klientga chiqmaydi.
  const pupils: Pupil[] = rows.map(({ _id, studentPasswordHash, parentPasswordHash, ...rest }) => {
    void _id; void studentPasswordHash; void parentPasswordHash;
    return rest as Pupil;
  });
  return NextResponse.json({ ok: true, pupils });
}

// POST /api/pupils — AddStudentModal'dan "Saqlash" bosilganda yangi o'quvchi
// yaratadi (id avtomatik oshiriladi, orders/route.ts'dagi bilan bir xil usul).
export async function POST(req: Request) {
  let body: NewPupilValues;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!body.firstName?.trim()) {
    return NextResponse.json({ ok: false, error: "Ism majburiy" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("pupils");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const pupil = buildPupilFromValues(nextId, body);
  // insertOne mutates its argument to add _id — insert a copy so the
  // returned `pupil` stays clean (same gotcha as app/api/orders/route.ts).
  await col.insertOne({ ...pupil });

  return NextResponse.json({ ok: true, pupil });
}
