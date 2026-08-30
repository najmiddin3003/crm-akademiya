import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { buildPupilFromValues, type NewPupilValues, type Pupil } from "@/lib/pupilsData";

// GET /api/pupils — "O'quvchi qo'shish" orqali qo'shilgan haqiqiy o'quvchilar
// ro'yxati (constants/index.js'dagi statik demo STUDENTS'dan ajratilgan).
//
// RO'YXAT JAVOBI TO'LIQ HUJJAT EMAS. `pupils` da 6 732 yozuv bor va to'liq
// hujjatlar ~3.6 MB keladi, ammo ro'yxat sahifalari hujjatning atigi bir
// qismini o'qiydi. Shuning uchun ikkita rejim bor (o'lchangan):
//
//   ?light=1  → { id, firstName, lastName, phone }        544 KB /  506 ms
//   standart  → MEDIUM_PROJECTION (23 maydon)           2 727 KB / 1610 ms
//   (ilgari standart to'liq hujjat edi)                 3 654 KB / 2189 ms
//
// Profil sahifalariga TO'LIQ hujjat kerak — ular GET /api/pupils/:id dan
// bitta hujjatni oladi, shuning uchun bu qisqartirish ularga tegmaydi.
const LIGHT_PROJECTION = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 };

// Standart rejim — ro'yxat sahifalari HAQIQATDA o'qiydigan maydonlar. Yangi
// maydon kerak bo'lsa shu ro'yxatga qo'shilsin, aks holda u klientda
// `undefined` bo'lib keladi.
const MEDIUM_PROJECTION = {
  _id: 0,
  // studentRowFromPupil (lib/studentsData.ts) — `students`/`names`/`byName`
  // ni ishlatadigan HAR BIR joy shu 13 tasini talab qiladi.
  id: 1, firstName: 1, lastName: 1, phone: 1,
  balance: 1, coin: 1, createdAt: 1, moderator: 1, source: 1, category: 1,
  status: 1, statusReason: 1, statusChangedAt: 1,
  // "To'lov sanasi" ustuni — ActiveStudentsPage (StudentRow'da yo'q).
  paymentDate: 1,
  // Tug'ilgan kunlar, ota-onalar jadvali, buyurtma kartasidagi yosh.
  birthDate: 1,
  // Ota-onalar sahifasi (lib/parentsData.ts) va SmsModal.
  fatherName: 1, fatherPhone: 1, fatherWork: 1,
  motherName: 1, motherPhone: 1, motherWork: 1,
  // O'quvchilar manzillari sahifasi — `addresses` massiv sifatida kerak.
  address: 1, addresses: 1,
};

export async function GET(req: Request) {
  const light = new URL(req.url).searchParams.get("light") === "1";
  const db = await ensureIndexes();
  const rows = await db.collection("pupils")
    .find({}, { projection: light ? LIGHT_PROJECTION : MEDIUM_PROJECTION })
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
