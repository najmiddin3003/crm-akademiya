import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SupportRecord } from "@/lib/supportAnalytics";

// Nazorat → Support analitikasi backend'i (MongoDB `support_analytics`).
// Demo seed YO'Q — kolleksiya bo'sh bo'lsa ro'yxat ham bo'sh qaytadi.

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("support_analytics");
  const rows = await col.find({}).sort({ date: -1, id: -1 }).toArray();
  const records = rows.map(({ _id, ...rest }) => rest as unknown as SupportRecord);
  return NextResponse.json({ ok: true, records });
}
