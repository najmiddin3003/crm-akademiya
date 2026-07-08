import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { issueCode, generateToken, activationMessage, sendSms, INVITE_TTL_MS } from "@/lib/invite";

// POST /api/auth/resend-invite  { employee_id }  yoki  { phone }
// Taklif kodi yetib bormasa/eskirsa qayta yuboradi. Faqat status='invited'
// foydalanuvchilar uchun ishlaydi. Yangi 72 soatlik token beriladi.
// employee_id — admin uchun; phone — faollashtirish sahifasidagi "Qayta yuborish".
export async function POST(req: Request) {
  let body: { employee_id?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const users = db.collection("users");

  let user = null;
  if (body.employee_id && ObjectId.isValid(body.employee_id)) {
    user = await users.findOne({ employeeId: new ObjectId(body.employee_id) });
  } else if (body.phone) {
    const { normalizePhone } = await import("@/lib/eskiz");
    user = await users.findOne({ phone: normalizePhone(body.phone) });
  } else {
    return NextResponse.json({ ok: false, error: "employee_id yoki phone kerak" }, { status: 400 });
  }

  // Xavfsizlik: mavjud emasligini oshkor qilmaslik uchun invited bo'lmaganda
  // ham "ok" qaytaramiz (lekin hech narsa yubormaymiz).
  if (!user || user.status !== "invited") {
    return NextResponse.json({ ok: true });
  }

  const phone: string = user.phone;
  const code = await issueCode(phone, "activate");
  if (!code.ok) {
    return NextResponse.json({ ok: false, error: code.error }, { status: 429 });
  }

  const token = generateToken();
  await users.updateOne(
    { _id: user._id },
    { $set: { invite: { token, expiresAt: new Date(Date.now() + INVITE_TTL_MS) } } }
  );

  const sms = await sendSms(phone, activationMessage(token, code.code!));
  return NextResponse.json({ ok: true, smsSent: sms.ok, smsSimulated: Boolean(sms.simulated) });
}
