import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { eskizConfigured, sendSms } from "@/lib/eskiz";
import type { SmsMessage } from "@/lib/smsMessages";

// Sotuv va marketing → Xabarlar ro'yhati backend'i (MongoDB `sms_messages`).
// Demo seed YO'Q: yozuvlar faqat SMS yuborilganda paydo bo'ladi.

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("sms_messages");
  const rows = await col.find({}).sort({ date: -1, id: -1 }).toArray();
  const messages = rows.map(({ _id, ...rest }) => rest as unknown as SmsMessage);
  return NextResponse.json({ ok: true, messages });
}

// POST /api/sms-messages — { phone, text, recipientName?, moderator? }
// SMS'ni Eskiz orqali yuboradi va natijani shu jurnalga yozadi.
//
// ESKIZ_EMAIL/ESKIZ_PASSWORD o'rnatilmagan bo'lsa lib/eskiz.ts real yubormaydi:
// matnni server konsoliga chiqaradi va simulated=true qaytaradi — oqim baribir
// oxirigacha ishlaydi va jurnalga tushadi.
export async function POST(req: Request) {
  let body: { phone?: string; text?: string; recipientName?: string; moderator?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const phone = (body.phone || "").trim();
  const text = (body.text || "").trim();
  if (!phone) {
    return NextResponse.json({ ok: false, error: "Telefon raqam yo'q" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "Xabar matnini kiriting" }, { status: 400 });
  }

  const result = await sendSms(phone, text);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const db = await ensureIndexes();
  const col = db.collection("sms_messages");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const message: SmsMessage = {
    id: (last[0]?.id ?? 0) + 1,
    recipientName: (body.recipientName || "").trim(),
    text,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    moderator: (body.moderator || "").trim(),
    status: result.ok ? "Qabul qilindi" : "Yuborilmadi",
    kind: "manual",
  };
  await col.insertOne({ ...message });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || "SMS yuborilmadi", message },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    message,
    // true bo'lsa SMS real jo'natilmagan (Eskiz sozlanmagan) — klient shuni
    // foydalanuvchiga ochiq aytadi.
    simulated: Boolean(result.simulated) || !eskizConfigured(),
  });
}
