import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch } from "@/lib/branchScope";
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

/**
 * Parol xeshlari HECH QACHON klientga chiqmaydi. "Parol o'rnatilganmi"
 * degan holatni /api/pupils/:id/password aytadi.
 */
function stripSecrets(doc: Record<string, unknown>) {
  const { _id, studentPasswordHash, parentPasswordHash, ...rest } = doc;
  void _id; void studentPasswordHash; void parentPasswordHash;
  return rest;
}

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bitta o'quvchining filtri — JORIY FILIAL ICHIDA.
 *
 * Ro'yxat filial bo'yicha kesilgach (app/api/pupils/route.ts), bu route
 * kesilmasa qamrov qog'ozda qolardi: ro'yxatda ko'rinmaydigan o'quvchini
 * `/api/pupils/16700` deb to'g'ridan-to'g'ri o'qish ham, PATCH bilan
 * o'zgartirish ham, DELETE bilan o'chirish ham mumkin bo'lardi.
 *
 * Boshqa filialning o'quvchisi "topilmadi" (404) bo'ladi — "ruxsat yo'q"
 * emas: mavjudligini ham bildirmaslik kerak.
 *
 * `null` — tizimga kirilmagan (chaqiruvchi 401 qaytaradi).
 */
async function scopedFilter(pupilId: number) {
  const scope = await getBranchScope();
  return scope ? withBranch({ id: pupilId }, scope) : null;
}

/** Har safar YANGI javob: `NextResponse` ning tanasi bir marta o'qiladi. */
const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const where = await scopedFilter(pupilId);
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const doc = await db.collection("pupils").findOne(where);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, pupil: stripSecrets(doc) as unknown as Pupil });
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

  if (Number.isFinite(Number(body.debtLimit))) set.debtLimit = Number(body.debtLimit);
  if (Array.isArray(body.addresses)) {
    // Faqat kutilgan shakl saqlanadi — klient yuborgan boshqa maydonlar tushib qoladi.
    set.addresses = (body.addresses as Record<string, unknown>[]).map((x, i) => ({
      id: Number(x.id) || i + 1,
      name: String(x.name ?? "").trim(),
      type: String(x.type ?? "").trim(),
    })).filter((x) => x.name);
  }

  if (typeof set.firstName === "string" && !set.firstName) {
    return NextResponse.json({ ok: false, error: "Ism majburiy" }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const where = await scopedFilter(pupilId);
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const res = await db.collection("pupils").findOneAndUpdate(
    where,
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, pupil: stripSecrets(res) as unknown as Pupil });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = parseId(id);
  if (pupilId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const where = await scopedFilter(pupilId);
  if (!where) return notLoggedIn();
  const db = await ensureIndexes();
  const res = await db.collection("pupils").deleteOne(where);
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
