import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/transaction-entries/students — tranzaksiyalarda uchraydigan
// TAKRORLANMAS o'quvchi ismlari (Moliya → Tranzaksiyalar sahifasidagi
// "O'quvchi" filtri uchun).
//
// Ilgari bu ro'yxat butun jadvalni (25 569 qator, ~11 MB) yuklab, klientda
// `new Set(...)` bilan chiqarilardi. Bu yerda Mongo `distinct` bajaradi —
// 3 357 ism, ~73 KB.
export async function GET() {
  const db = await ensureIndexes();
  const names = await db.collection("transaction_entries")
    .distinct("studentName", { studentName: { $nin: ["", null] } });
  names.sort();
  return NextResponse.json({ ok: true, students: names });
}
