import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Order } from "@/lib/ordersData";

// PATCH /api/orders/:id — qisman $set yangilanish (tasks/[id]/route.ts bilan
// bir xil naqsh). Chaqiruvchi (OrdersContext) to'liq forma qiymatlarini
// avval applyOrderValues() bilan mavjud buyurtmaga qo'shib (merge qilib)
// keyin shu yerga yuboradi — shuning uchun bu yerda faqat generic $set kifoya,
// "studentName" kabi forma-maydon nomlarini Order maydonlariga moslashtirish
// shart emas.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: Partial<Order>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("orders").findOneAndUpdate(
    { id: orderId },
    { $set: body },
    { returnDocument: "after" },
  );

  if (!res) {
    return NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  const { _id, ...order } = res;
  return NextResponse.json({ ok: true, order });
}
