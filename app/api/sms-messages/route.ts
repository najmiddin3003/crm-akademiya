import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SmsMessage } from "@/lib/smsMessages";

// Sotuv va marketing → Xabarlar ro'yhati backend'i (MongoDB `sms_messages`).
// Sof jurnal — faqat GET. Demo seed YO'Q: yozuvlar faqat haqiqiy SMS
// yuborilganda paydo bo'ladi.

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("sms_messages");
  const rows = await col.find({}).sort({ date: -1, id: -1 }).toArray();
  const messages = rows.map(({ _id, ...rest }) => rest as unknown as SmsMessage);
  return NextResponse.json({ ok: true, messages });
}
