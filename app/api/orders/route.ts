import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { buildOrderFromValues, type NewOrderValues, type Order } from "@/lib/ordersData";

// GET /api/orders — buyurtmalar ro'yxati, faqat bazadagi haqiqiy yozuvlar
// (demo/urug' ma'lumotlar bilan avtomatik to'ldirish endi yo'q — kolleksiya
// bo'sh bo'lsa, ro'yxat ham bo'sh qaytadi).
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("orders");
  const rows = await col.find({}).sort({ id: -1 }).toArray();
  const orders: Order[] = rows.map(({ _id, ...rest }) => rest as Order);
  return NextResponse.json({ ok: true, orders });
}

// POST /api/orders — AddOrderModal'dan "Saqlash" bosilganda yangi buyurtma
// yaratadi (id avtomatik oshiriladi, tasks/route.ts'dagi bilan bir xil usul).
export async function POST(req: Request) {
  let body: NewOrderValues;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  if (!body.studentName || !body.course || !body.lessonDay) {
    return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("orders");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const order = buildOrderFromValues(nextId, body);
  // insertOne mutates its argument to add _id — insert a copy so the
  // returned `order` (and whatever the client stores from it) stays clean.
  await col.insertOne({ ...order });

  return NextResponse.json({ ok: true, order });
}
