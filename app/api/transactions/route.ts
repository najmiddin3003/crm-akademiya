import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { buildJuly2026Transactions } from "@/constants/transactions";
import type { Transaction } from "@/lib/transactions";

// Moliya → Moliya analitikasi backend'i (MongoDB `transactions`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Bo'sh
// bo'lsa Iyul 2026 uchun deterministik generatsiya qilingan tranzaksiyalarni
// bir marta seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(buildJuly2026Transactions())));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("transactions");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ date: 1, id: 1 }).toArray();
  const transactions = rows.map(({ _id, ...rest }) => rest as unknown as Transaction);
  return NextResponse.json({ ok: true, transactions });
}
