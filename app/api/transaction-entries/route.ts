import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { TRANSACTION_ENTRY_SEED } from "@/constants/transactionEntries";
import type { TransactionEntry } from "@/lib/transactionEntries";

// Moliya → Tranzaksiyalar backend'i (MongoDB `transaction_entries`, faqat
// o'qish uchun — bu sahifada qo'shish/tahrirlash/o'chirish yo'q). Bo'sh
// bo'lsa demo tranzaksiyalarni (foydalanuvchi bilan kelishilgan yengil
// qamrov — ~28 ta) bir marta seed qiladi.
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(TRANSACTION_ENTRY_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("transaction_entries");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const entries = rows.map(({ _id, ...rest }) => rest as unknown as TransactionEntry);
  return NextResponse.json({ ok: true, entries });
}
