import { NextResponse, after } from "next/server";
import { healMissingAddresses } from "@/lib/attendanceCheck";
import { ensureIndexes } from "@/lib/mongodb";
import type { TurnstileIoRecord } from "@/lib/turnstileIo";

// Nazorat → Turniket kirish-chiqish analitikasi backend'i
// (MongoDB `turnstile_io`). Demo seed YO'Q — yozuvlar turniket
// qurilmasidan kelgan ma'lumotdan paydo bo'ladi.

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("turnstile_io");
  const rows = await col.find({}).sort({ date: -1, id: 1 }).toArray();
  const records = rows.map(({ _id, ...rest }) => rest as unknown as TurnstileIoRecord);
  // QR yozuvlarida manzili yo'q joylashuv — fonda to'ldiriladi (keyingi ochishda ko'rinadi).
  healMissingAddresses(db, records, after);
  return NextResponse.json({ ok: true, records });
}
