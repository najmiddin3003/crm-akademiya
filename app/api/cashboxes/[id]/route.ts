import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, type Cashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";
import { getCurrentEmployee } from "@/lib/currentEmployee";

/**
 * Kassani BOSHQARISH faqat administratorga tegishli.
 *
 * NIMA NOTO'G'RI EDI: bu route'larda umuman tekshiruv yo'q edi — ya'ni
 * `/finance-cash` ruxsati tekkan HAR KIM istalgan kassani tahrirlashi,
 * o'chirishi yoki bosh kassa qilishi mumkin edi. Eng og'iri: PATCH
 * `moderator` maydonini ham o'zgartiradi, ya'ni kassir istalgan kassani
 * O'ZIGA biriktirib, uning butun pul daftarini ochib olardi (GET
 * ro'yxati aynan `moderator` bo'yicha kesiladi).
 *
 * Sahifada tugmalar endi adminlardan boshqasiga ko'rsatilmaydi, lekin
 * himoya SHU YERDA: tugmani yashirish so'rovni to'g'ridan-to'g'ri
 * yuborishga to'sqinlik qilmaydi.
 */
async function requireAdmin(): Promise<NextResponse | null> {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!me.isAdmin) {
    return NextResponse.json({ ok: false, error: "Bu amal faqat administrator uchun" }, { status: 403 });
  }
  return null;
}

// PATCH /api/cashboxes/:id — kassani tahrirlaydi (Ism/Moderator/Onlayn
// to'lov/Arxiv). FAQAT ADMIN.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<Cashbox>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ ok: false, error: "Kassa nomini kiriting" }, { status: 400 });
    set.name = name;
  }
  if (typeof body.moderator === "string") set.moderator = body.moderator.trim();
  if (typeof body.onlinePayment === "boolean") set.onlinePayment = body.onlinePayment;
  if (typeof body.archived === "boolean") set.archived = body.archived;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();

  // Bitta moderator — bitta kassa (POST yo'lidagi bilan bir xil qoida).
  if (typeof set.moderator === "string" && set.moderator) {
    const taken = await db.collection("cashboxes").findOne({
      moderator: set.moderator,
      id: { $ne: cashboxId },
    });
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `${set.moderator} allaqachon "${taken.name}" kassasiga biriktirilgan` },
        { status: 400 },
      );
    }
  }

  const res = await db.collection("cashboxes").findOneAndUpdate(
    { id: cashboxId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }
  const { _id, ...cashbox } = res;
  return NextResponse.json({ ok: true, cashbox: normalizeCashbox(cashbox, await loadPaymentMethodKeys(db)) });
}

// DELETE /api/cashboxes/:id — kassani o'chiradi. FAQAT ADMIN.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const cashboxId = Number(id);
  if (!Number.isFinite(cashboxId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("cashboxes").deleteOne({ id: cashboxId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
