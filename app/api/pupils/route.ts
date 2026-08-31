import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { buildPupilFromValues, PUPIL_EXTRA_FIELDS, type NewPupilValues, type Pupil } from "@/lib/pupilsData";

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

// Standart rejim — studentRowFromPupil (lib/studentsData.ts) talab
// qiladigan asosiy 13 maydon. `students`/`names`/`byName` ni ishlatadigan
// HAR BIR joy shulardan iborat.
//
// Ilgari bu yerda yana o'nta maydon bor edi (to'lov sanasi, tug'ilgan sana,
// oltita ota-ona maydoni, ikkita manzil). Ular 13 ta sahifadan 4 tasiga
// kerak, lekin HAMMASIGA tashilardi — 6 732 hujjatda 1.02 MB ortiqcha,
// ustiga ularning aksariyati bazada BO'SH satr. Endi `?extra=` bilan.
const BASE_PROJECTION = {
  _id: 0,
  id: 1, firstName: 1, lastName: 1, phone: 1,
  balance: 1, coin: 1, createdAt: 1, moderator: 1, source: 1, category: 1,
  status: 1, statusReason: 1, statusChangedAt: 1,
};

// Kim qaysi qo'shimchani so'raydi (oq ro'yxat lib/pupilsData.ts da):
//   birthDate                      -> Tug'ilgan kunlar, Ota-onalar
//   paymentDate                    -> Aktiv o'quvchilar ("To'lov sanasi")
//   address, addresses             -> O'quvchilar manzillari
//   father*/mother*                -> Ota-onalar, SmsModal
const EXTRA_ALLOWED = new Set<string>(PUPIL_EXTRA_FIELDS);

// GET /api/pupils
//   ?light=1        — faqat id/ism/telefon
//   ?extra=a,b      — asosiy to'plam USTIGA qo'shimcha maydonlar
//   ?status=Aktiv   — holat bo'yicha filtr (Aktiv o'quvchilar sahifasi
//                     6 732 tadan 4 276 tasini, Arxiv esa 2 456 tasini
//                     ko'rsatadi — qolganini tashish bekor)
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const light = sp.get("light") === "1";

  let projection: Record<string, number> = light ? LIGHT_PROJECTION : BASE_PROJECTION;
  const extraRaw = sp.get("extra");
  if (extraRaw && !light) {
    const extra = extraRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const bad = extra.filter((f) => !EXTRA_ALLOWED.has(f));
    if (bad.length) {
      return NextResponse.json(
        { ok: false, error: `Noto'g'ri extra: ${bad.join(", ")}` },
        { status: 400 },
      );
    }
    projection = { ...projection, ...Object.fromEntries(extra.map((f) => [f, 1])) };
  }

  const filter: Record<string, unknown> = {};
  const status = sp.get("status");
  if (status) filter.status = status;

  const db = await ensureIndexes();
  const rows = await db.collection("pupils")
    .find(filter, { projection })
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
