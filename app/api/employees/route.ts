import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import {
  isValidPhone,
  issueCode,
  generateToken,
  activationMessage,
  sendSms,
  normalizePhone,
  INVITE_TTL_MS,
} from "@/lib/invite";

// GET /api/employees
// Admin xodimlar ro'yxatini holati (invited/active/blocked) bilan ko'radi.
export async function GET() {
  const db = await ensureIndexes();
  const rows = await db
    .collection("employees")
    .aggregate([
      { $sort: { createdAt: -1 } },
      { $lookup: { from: "users", localField: "_id", foreignField: "employeeId", as: "user" } },
      {
        $project: {
          fullName: 1,
          phone: 1,
          position: 1,
          createdAt: 1,
          status: { $ifNull: [{ $arrayElemAt: ["$user.status", 0] }, "invited"] },
        },
      },
    ])
    .toArray();

  const employees = rows.map((r) => ({
    id: r._id.toString(),
    fullName: r.fullName,
    phone: r.phone,
    position: r.position || null,
    status: r.status as string,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ ok: true, employees });
}

// POST /api/employees
// Admin yangi xodim qo'shadi: employees yozuvi + users(status='invited', parolsiz)
// + 72 soatlik taklif tokeni + SMS (havola + kod) yuboriladi.
//
// DIQQAT: hozircha admin sessiyasi/autentifikatsiyasi yo'q — backend ulanganda
// bu endpointni admin roli bilan himoyalash kerak (TODO).
export async function POST(req: Request) {
  let body: { fullName?: string; phone?: string; position?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const fullName = (body.fullName || "").trim();
  const position = (body.position || "").trim();

  if (!fullName) {
    return NextResponse.json({ ok: false, error: "Xodim F.I.Sh. kiritilishi shart" }, { status: 400 });
  }
  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone!);
  const db = await ensureIndexes();

  const existing = await db.collection("users").findOne({ phone });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" }, { status: 409 });
  }

  const now = new Date();
  const employee = {
    fullName,
    phone,
    position: position || null,
    createdAt: now,
  };
  const empRes = await db.collection("employees").insertOne(employee);

  const token = generateToken();
  const userRes = await db.collection("users").insertOne({
    phone,
    employeeId: empRes.insertedId,
    fullName,
    role: "employee",
    status: "invited",
    passwordHash: null,
    invite: { token, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
    createdAt: now,
    activatedAt: null,
  });
  await db.collection("employees").updateOne({ _id: empRes.insertedId }, { $set: { userId: userRes.insertedId } });

  // Taklif kodini yaratamiz (rate-limit ichida) va SMS yuboramiz.
  const code = await issueCode(phone, "activate");
  let smsSent = false;
  let smsSimulated = false;
  if (code.ok && code.code) {
    const sms = await sendSms(phone, activationMessage(token, code.code));
    smsSent = sms.ok;
    smsSimulated = Boolean(sms.simulated);
    if (!sms.ok) {
      console.error("[employees] SMS yuborilmadi:", sms.error, sms.raw);
    }
  }

  return NextResponse.json({
    ok: true,
    employeeId: empRes.insertedId.toString(),
    userId: userRes.insertedId.toString(),
    smsSent,
    smsSimulated,
  });
}
