import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee, ownsCashbox } from "@/lib/currentEmployee";

// GET /api/transaction-entries/notes?cashboxId=<n>
//
// Kassa oynasidagi "Izoh" maydoni uchun TAVSIYALAR — shu kassada ilgari
// yozilgan izohlar. Kassir bir xil izohni kunda o'nlab marta qo'lda
// yozadi ("Sentabr oyi uchun", "Qarzdan yopildi"), va bir harf farq bilan
// yozilgan matn keyin filtrda alohida qiymat bo'lib chiqadi.
//
// TEZ-TEZ ISHLATILGANI BIRINCHI — `distinct` emas, guruhlash. `distinct`
// alifbo tartibida qaytaradi va kassada 18 000 dan ortiq yozuv bo'lgani
// uchun ro'yxat boshida tasodifiy matnlar turardi; kassirga esa aynan
// o'zi tez-tez yozadigan bir nechtasi kerak.
//
// KASSA KESIMIDA — ATAYLAB. Boshqa kassaning izohlarida o'quvchi ismi,
// summa va shaxsiy izohlar bo'lishi mumkin; ular bu yerdan oshkor
// bo'lmasligi kerak. Qamrov qoidasi qo'shni `facets` route'i bilan bir xil.

/** Ro'yxat uzunligi — tavsiya bo'lib qolsin, katalogga aylanmasin. */
const LIMIT = 200;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("cashboxId");
  const cashboxId = Number(raw);
  if (!raw || !Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "cashboxId kerak" }, { status: 400 });
  }

  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  if (!me.isAdmin && !(await ownsCashbox(db, me.name, cashboxId))) {
    return NextResponse.json({ ok: false, error: "Bu kassa sizga biriktirilmagan" }, { status: 403 });
  }

  const rows = await db
    .collection("transaction_entries")
    .aggregate([
      { $match: { cashboxId, note: { $nin: ["", null] } } },
      { $group: { _id: "$note", n: { $sum: 1 } } },
      { $sort: { n: -1, _id: 1 } },
      { $limit: LIMIT },
    ])
    .toArray();

  const notes = rows
    .map((r) => String(r._id ?? "").trim())
    .filter((s) => s.length > 0);

  return NextResponse.json({ ok: true, notes });
}
