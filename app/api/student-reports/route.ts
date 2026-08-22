import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";

// Hisobotlar bo'limidagi o'quvchi to'lov/davomat hisobotlarining backend'i.
//
// Bitta route, `?kind=` bilan — beshta hisobot ham bir xil shaklga ega
// (kichik, faqat o'qish uchun ro'yxat) va ularni alohida route'larga
// bo'lish faqat takrorlanadigan kod berardi.
//
// Demo seed YO'Q — hisobotlar faqat bazadagi haqiqiy yozuvlardan quriladi.

const KINDS = {
  unpaid: "unpaid_students",
  "price-diff": "price_differences",
  "cancelled-payments": "cancelled_payments",
  discounts: "student_discounts",
  "cancelled-attendance": "cancelled_attendance",
  "leave-reasons": "leave_reasons",
} as const;

type Kind = keyof typeof KINDS;

async function loadRows(db: Db, kind: Kind) {
  const col = db.collection(KINDS[kind]);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  return rows.map(({ _id, ...rest }) => rest);
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") as Kind | null;
  if (!kind || !(kind in KINDS)) {
    return NextResponse.json(
      { ok: false, error: `Noto'g'ri "kind" — ruxsat etilganlar: ${Object.keys(KINDS).join(", ")}` },
      { status: 400 },
    );
  }
  const db = await ensureIndexes();
  const rows = await loadRows(db, kind);
  return NextResponse.json({ ok: true, rows });
}
