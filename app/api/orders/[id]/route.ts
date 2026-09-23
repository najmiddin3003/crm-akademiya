import { NextResponse, after } from "next/server";
import type { Document } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { withLeadScope } from "@/lib/leadScope";
import { HOLAT_CONFLICT, SERVER_MANAGED_ORDER_FIELDS, legacyHolatSync } from "@/lib/leadHolatServer";
import { refreshLeadMessage } from "@/lib/leadNotify";
import type { Order } from "@/lib/ordersData";

// PATCH /api/orders/:id — qisman $set yangilanish (tasks/[id]/route.ts bilan
// bir xil naqsh). Chaqiruvchi (OrdersContext) to'liq forma qiymatlarini
// avval applyOrderValues() bilan mavjud buyurtmaga qo'shib (merge qilib)
// keyin shu yerga yuboradi — shuning uchun bu yerda faqat generic $set kifoya,
// "studentName" kabi forma-maydon nomlarini Order maydonlariga moslashtirish
// shart emas.
//
// LID HOLATI (23.09.2026): holat, tarix, Telegram belgisi va izohlar tanadan
// YOZILMAYDI — ularni o'z yo'llari yuritadi (lib/leadHolatServer.ts →
// SERVER_MANAGED_ORDER_FIELDS). Eski sahifa holatga ta'sir qiladigan maydonni
// o'zgartirsa (guruhga yozdi, rad etdi …) holat ham shu yozuvda moslanadi.
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  // `branchId` so'rov tanasi orqali O'ZGARTIRILMAYDI. Bu yerda `$set: body`
  // umumiy — ya'ni klient yuborgan har qanday maydon yoziladi. Endi
  // `branchId` xavfsizlik chegarasi bo'lgani uchun, uni tana orqali
  // o'zgartirishga ruxsat berilsa, lidni jimgina boshqa filialga
  // ko'chirib yuborish mumkin bo'lardi.
  const patch: Record<string, unknown> = { ...body };
  for (const k of SERVER_MANAGED_ORDER_FIELDS) delete patch[k];

  const author = await currentAuthorName();
  const db = await ensureIndexes();
  const col = db.collection("orders");
  // Filtr qamrov bilan kesiladi: boshqa filialning lidini id'sini bilib
  // turib ham tahrirlab bo'lmaydi (o'quvchi profilidagi bilan bir xil qoida).
  //
  // Qamrov RO'YXAT bilan AYNAN bir xil (`withLeadScope`): aks holda
  // ro'yxatda ko'rinib turgan lid ochilganda yoki holati o'zgartirilganda
  // "Buyurtma topilmadi" berardi — ayniqsa "Birinchi darsga yozilganlar"
  // sahifasida, u aynan shu lidlarni PATCH qiladi.
  const filter = withLeadScope({ id: orderId }, scope, author);
  const current = (await col.findOne(filter, { projection: { _id: 0 } })) as unknown as Order | null;
  if (!current) {
    return NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  const sync = legacyHolatSync(current, patch as Partial<Order>, author || "CRM");
  const update: Document = { $set: { ...patch, ...sync.set } };
  const unset = Object.fromEntries(Object.keys(sync.unset).filter((k) => !(k in update.$set)).map((k) => [k, ""]));
  if (Object.keys(unset).length) update.$unset = unset;
  if (sync.push) update.$push = sync.push;
  if (!Object.keys(update.$set).length && !update.$unset) {
    return NextResponse.json({ ok: true, order: current });
  }

  const res = await col.findOneAndUpdate(sync.guard ? { $and: [filter, sync.guard] } : filter, update, {
    returnDocument: "after",
    projection: { _id: 0 },
  });
  if (!res) {
    return sync.guard
      ? NextResponse.json({ ok: false, error: HOLAT_CONFLICT }, { status: 409 })
      : NextResponse.json({ ok: false, error: "Buyurtma topilmadi" }, { status: 404 });
  }

  // Guruhdagi xabar ham yangilansin (ism, kurs, holat …) — javobdan keyin.
  if (current.tgMessage) after(() => refreshLeadMessage(db, orderId));
  return NextResponse.json({ ok: true, order: res });
}
