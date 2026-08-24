import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// Buyurtma izohlari (megafon/"Izoh yozish" oynasi — OrderMessagePanel).
//
// Ilgari izohlar FAQAT React holatida yashardi (OrdersContext.messagesByOrder):
// "Izoh qo'shildi" toasti chiqardi, lekin hech qayerga yozilmasdi va sahifa
// yangilanishi bilan yo'qolardi. Buyurtma esa haqiqiy MongoDB hujjati —
// shuning uchun izohlar o'sha hujjatning `comments` massivida saqlanadi
// (alohida kolleksiya emas: izoh buyurtmadan tashqarida ma'noga ega emas va
// bu yo'l yangi indeks talab qilmaydi — `orders` allaqachon `id` bo'yicha
// qidiriladi).

/**
 * Kolleksiyaning shu route uchun kerakli qismi. Terilgan (typed) kolleksiya
 * kerak: aks holda mongodb drayveri `$push` ning maydonini massiv deb bilmaydi
 * (app/api/offline-courses/[id]/levels/route.ts dagi bilan bir xil sabab).
 */
interface OrderDoc {
  id: number;
  comments?: OrderComment[];
}

export interface OrderComment {
  text: string;
  /** "HH:mm" — panelda xabar ostida ko'rsatiladi. */
  time: string;
  /** "YYYY-MM-DD" — vaqtdan farqli o'laroq panelda ko'rsatilmaydi, ammo
   *  keyinchalik saralash/hisobot uchun kerak bo'ladi. */
  date: string;
}

function parseOrderId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

// GET /api/orders/:id/comments — bitta buyurtmaning izohlari.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = parseOrderId(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const order = await db.collection<OrderDoc>("orders").findOne({ id: orderId }, { projection: { comments: 1 } });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  const comments = Array.isArray(order.comments) ? order.comments : [];
  return NextResponse.json({ ok: true, comments });
}

// POST /api/orders/:id/comments — { text } → izohni qo'shadi.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = parseOrderId(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Izoh matnini kiriting" }, { status: 400 });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const comment: OrderComment = {
    text,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  };

  const db = await ensureIndexes();
  const res = await db.collection<OrderDoc>("orders").updateOne(
    { id: orderId },
    { $push: { comments: comment } },
  );
  if (res.matchedCount === 0) {
    return NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, comment });
}
