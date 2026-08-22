import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Transaction } from "@/lib/transactions";

// Moliya → Moliya analitikasi backend'i (MongoDB `transactions`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Demo seed
// YO'Q — kolleksiya bo'sh bo'lsa analitika ham bo'sh qoladi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("transactions");
  const rows = await col.find({}).sort({ date: 1, id: 1 }).toArray();
  const transactions = rows.map(({ _id, ...rest }) => rest as unknown as Transaction);
  return NextResponse.json({ ok: true, transactions });
}
