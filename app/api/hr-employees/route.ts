import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { EMPLOYEES_DATA } from "@/constants/employees";
import type { HrEmployee } from "@/lib/hrEmployees";
import {
  isValidPhone,
  issueCode,
  generateToken,
  activationMessage,
  sendSms,
  normalizePhone,
  INVITE_TTL_MS,
} from "@/lib/invite";

// Boshqaruv → Xodimlar backend'i (MongoDB `hr_employees`).
// Kolleksiya bo'sh bo'lsa — 49 ta demo xodimni bir marta seed qilamiz.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(EMPLOYEES_DATA)));
  }
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("hr_employees");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  // `archDate` ("Sana" ustuni) keyin qo'shilgan — eski hujjatlarda yo'q,
  // shuning uchun bo'sh satrga to'ldiramiz (jadval `undefined` olmasligi uchun).
  const employees = rows.map(({ _id, ...rest }) => ({ archDate: "", ...rest }) as unknown as HrEmployee);
  return NextResponse.json({ ok: true, employees });
}

// Xodim qo'shilganda faollashtirish taklifi (users + 72 soatlik token + SMS)
// app/api/employees/route.ts dagi bilan bir xil naqsh — farqi shu: bu yerda
// alohida `employees` yozuvi yaratilmaydi, `users.hrEmployeeId` bevosita
// `hr_employees.id`ga ishora qiladi (activate/verify-token/resend-invite
// faqat `users`ga qaraydi, shuning uchun bu farq ularga ta'sir qilmaydi).
export async function POST(req: Request) {
  let body: Partial<HrEmployee>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Ism va familiyani kiriting" }, { status: 400 });
  }
  if (!isValidPhone(body.phone)) {
    return NextResponse.json({ ok: false, error: "Telefon raqami noto'g'ri" }, { status: 400 });
  }
  const phone = normalizePhone(body.phone!);

  const db = await ensureIndexes();

  const existingUser = await db.collection("users").findOne({ phone });
  if (existingUser) {
    return NextResponse.json({ ok: false, error: "Bu telefon raqami allaqachon ro'yxatdan o'tgan" }, { status: 409 });
  }

  const col = db.collection("hr_employees");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const employee: HrEmployee = {
    id: nextId,
    name,
    gender: body.gender || "",
    aktivOq: 0,
    groups: 0,
    turi: body.turi || "",
    filial: body.filial || "Akademiya",
    phone,
    kurs: body.kurs || "",
    created: fmtNow(new Date()),
    lastActive: "",
    archReason: "",
    archDate: "",
    email: body.email || "",
  };
  await col.insertOne({ ...employee });

  const now = new Date();
  const token = generateToken();
  await db.collection("users").insertOne({
    phone,
    hrEmployeeId: nextId,
    fullName: name,
    role: employee.turi || "employee",
    status: "invited",
    passwordHash: null,
    invite: { token, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) },
    createdAt: now,
    activatedAt: null,
  });

  // Taklif kodini yaratamiz (rate-limit ichida) va SMS yuboramiz. SMS
  // muvaffaqiyatsiz bo'lsa ham xodim ro'yxatda qoladi — frontend smsSent
  // bayrog'iga qarab tegishli xabar ko'rsatadi.
  const code = await issueCode(phone, "activate");
  let smsSent = false;
  let smsSimulated = false;
  if (code.ok && code.code) {
    const sms = await sendSms(phone, activationMessage(token, code.code));
    smsSent = sms.ok;
    smsSimulated = Boolean(sms.simulated);
    if (!sms.ok) {
      console.error("[hr-employees] SMS yuborilmadi:", sms.error, sms.raw);
    }
  }

  return NextResponse.json({ ok: true, employee, smsSent, smsSimulated });
}
