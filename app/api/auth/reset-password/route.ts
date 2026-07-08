import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isValidPassword, isValidPhone, verifyCode, hashSecret, normalizePhone } from "@/lib/invite";

// POST /api/auth/reset-password  { phone, code, new_password }
// forgot-password bilan yuborilgan kodni tekshirib, active foydalanuvchiga
// yangi parol o'rnatadi.
export async function POST(req: Request) {
  let body: { phone?: string; code?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
  }
  if (!body.code) {
    return NextResponse.json({ ok: false, error: "Kod kiritilmagan" }, { status: 400 });
  }
  if (!isValidPassword(body.new_password)) {
    return NextResponse.json({ ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone!);
  const db = await ensureIndexes();
  const users = db.collection("users");
  const user = await users.findOne({ phone });

  if (!user || user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Bu raqam uchun parolni tiklab bo'lmaydi" }, { status: 400 });
  }

  const v = await verifyCode(phone, body.code, "reset");
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  }

  const passwordHash = await hashSecret(body.new_password!);
  await users.updateOne({ _id: user._id }, { $set: { passwordHash, passwordUpdatedAt: new Date() } });

  return NextResponse.json({ ok: true });
}
