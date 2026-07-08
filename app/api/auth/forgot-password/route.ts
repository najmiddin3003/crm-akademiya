import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isValidPhone, issueCode, resetMessage, sendSms, normalizePhone } from "@/lib/invite";

// POST /api/auth/forgot-password  { phone }
// Parolni unutgan (status='active') foydalanuvchiga SMS orqali tiklash kodi
// yuboradi. Xuddi taklif oqimidagi kabi mexanizm (issueCode/verifyCode).
export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone!);
  const db = await ensureIndexes();
  const user = await db.collection("users").findOne({ phone });

  // Raqam mavjudligini oshkor qilmaymiz — har doim "ok". Kod faqat active
  // foydalanuvchiga yuboriladi.
  if (user && user.status === "active") {
    const code = await issueCode(phone, "reset");
    if (code.ok && code.code) {
      const sms = await sendSms(phone, resetMessage(code.code));
      return NextResponse.json({ ok: true, smsSent: sms.ok, smsSimulated: Boolean(sms.simulated) });
    }
    if (!code.ok) {
      return NextResponse.json({ ok: false, error: code.error }, { status: 429 });
    }
  }

  return NextResponse.json({ ok: true });
}
