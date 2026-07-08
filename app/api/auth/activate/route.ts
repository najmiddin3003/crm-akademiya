import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isValidPassword, verifyCode, hashSecret, normalizePhone } from "@/lib/invite";

// POST /api/auth/activate
// Ikki xil kirish: { token, new_password }  YOKI  { phone, code, new_password }.
// Muvaffaqiyatda: parol o'rnatiladi (bcrypt), status='active', taklif tokeni
// bir martalik bo'lgani uchun o'chiriladi.
export async function POST(req: Request) {
  let body: { token?: string; phone?: string; code?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const { token, code } = body;
  const newPassword = body.new_password;

  if (!isValidPassword(newPassword)) {
    return NextResponse.json({ ok: false, error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const users = db.collection("users");

  // 1-usul: token orqali
  let user = null;
  if (token) {
    user = await users.findOne({ "invite.token": token.trim() });
    if (!user || user.status !== "invited") {
      return NextResponse.json({ ok: false, error: "Havola yaroqsiz yoki ishlatilgan" }, { status: 400 });
    }
    if (!user.invite?.expiresAt || new Date(user.invite.expiresAt) < new Date()) {
      return NextResponse.json({ ok: false, error: "Havola muddati tugagan" }, { status: 400 });
    }
  }
  // 2-usul: telefon + SMS kod orqali
  else if (body.phone && code) {
    const phone = normalizePhone(body.phone);
    user = await users.findOne({ phone });
    if (!user || user.status !== "invited") {
      return NextResponse.json({ ok: false, error: "Bu raqam faollashtirishga yaroqsiz" }, { status: 400 });
    }
    const v = await verifyCode(phone, code, "activate");
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Token yoki telefon+kod kerak" }, { status: 400 });
  }

  const passwordHash = await hashSecret(newPassword!);
  await users.updateOne(
    { _id: user._id },
    {
      $set: { status: "active", passwordHash, activatedAt: new Date() },
      $unset: { invite: "" }, // token bir martalik — o'chiramiz
    }
  );

  return NextResponse.json({ ok: true });
}
