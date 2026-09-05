import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranchOrUnassigned } from "@/lib/branchScope";
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

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  // `branchId` so'rov tanasi orqali O'ZGARTIRILMAYDI. Bu yerda `$set: body`
  // umumiy — ya'ni klient yuborgan har qanday maydon yoziladi. Endi
  // `branchId` xavfsizlik chegarasi bo'lgani uchun, uni tana orqali
  // o'zgartirishga ruxsat berilsa, lidni jimgina boshqa filialga
  // ko'chirib yuborish mumkin bo'lardi.
  const { branchId, ...patch } = body as Partial<Order> & { branchId?: unknown };
  void branchId;

  const db = await ensureIndexes();
  // Filtr qamrov bilan kesiladi: boshqa filialning lidini id'sini bilib
  // turib ham tahrirlab bo'lmaydi (o'quvchi profilidagi bilan bir xil qoida).
  //
  // Qamrov RO'YXAT bilan bir xil bo'lishi shart (`withBranchOrUnassigned`):
  // aks holda filiali belgilanmagan eski lid ro'yxatda ko'rinib, ochilganda
  // yoki holati o'zgartirilganda "Buyurtma topilmadi" berardi — ayniqsa
  // "Birinchi darsga yozilganlar" sahifasida, u aynan shu lidlarni PATCH
  // qiladi.
  const res = await db.collection("orders").findOneAndUpdate(
    withBranchOrUnassigned({ id: orderId }, scope),
    { $set: patch },
    { returnDocument: "after" },
  );

  if (!res) {
    return NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  const { _id, ...order } = res;
  return NextResponse.json({ ok: true, order });
}
