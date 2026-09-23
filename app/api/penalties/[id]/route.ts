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
  // Topshiriqlar bo'limidan tushgan jarima (bajarilmagan topshiriq) shu
  // yerda bekor qilinmaydi: u yerdagi jarima "kuchda" qolib, bu yozuv
  // bekor bo'lsa, ikki bo'lim bir-biriga zid bo'lib qolardi va keyingi
  // qayta hisoblash (lib/staffTasksServer.ts → syncFinePenalties) uni
  // baribir tiklardi.
  const current = await db.collection("penalties").findOne({ id: penaltyId }, { projection: { _id: 0, source: 1 } });
  if (current?.source?.kind === "staff_task") {
    return NextResponse.json(
      { ok: false, error: "Bu jarima Topshiriqlar bo'limidan tushgan — uni Topshiriqlar → Jarimalar tabida bekor qiling" },
      { status: 409 },
    );
  }
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
