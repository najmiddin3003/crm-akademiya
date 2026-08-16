import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";

// Sozlamalar → "Profil".
// GET /api/profile — joriy foydalanuvchining o'z ma'lumotlari
// PUT /api/profile — { fullName } faqat ismni yangilaydi
//
// Telefon raqam login identifikatori, shuning uchun bu yerdan
// o'zgartirilmaydi; rol ham faqat admin tomonidan beriladi.

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: { fullName: me.fullName, phone: me.phone, role: me.role },
  });
}

export async function PUT(req: Request) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  // Tanani ehtiyotkorlik bilan o'qiymiz: `null` yoki satr bo'lmagan qiymat
  // kelsa ham 500 emas, quyidagi 400 javobi qaytishi kerak.
  const raw = (body as { fullName?: unknown } | null)?.fullName;
  const fullName = typeof raw === "string" ? raw.trim() : "";
  if (fullName.length < 2) {
    return NextResponse.json({ ok: false, error: "To'liq ismni kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await db.collection("users").updateOne(
    { _id: new ObjectId(me.id) },
    { $set: { fullName } },
  );

  return NextResponse.json({ ok: true });
}
