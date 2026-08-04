import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// PATCH /api/penalties/:id — "Bekor qilish": yozuv o'chirilmaydi, faqat
// status="cancelled" + (ixtiyoriy) sababi belgilanadi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const penaltyId = Number(id);
  if (!Number.isFinite(penaltyId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("penalties").findOneAndUpdate(
    { id: penaltyId },
    { $set: { status: "cancelled", reason: (body.reason || "").trim() } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Jarima topilmadi" }, { status: 404 });
  }
  const { _id, ...penalty } = res;
  return NextResponse.json({ ok: true, penalty });
}
