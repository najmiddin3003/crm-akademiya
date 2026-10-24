import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { markHandedOver } from "@/lib/gamification/shopRequests";

// POST /api/gamification/shop/orders/:id/handover — «Topshirildi»: so'rovdan tasdiqlangan
// sovg'a o'quvchiga qo'lda berildi (filial admini — o'z filiali, direktor).

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const orderId = Number((await params).id);
    if (!Number.isFinite(orderId)) return fail(400, "Noto'g'ri id");
    return NextResponse.json({ ok: true, ...(await markHandedOver(ctx.db, ctx.actor, orderId)) });
  } catch (e) {
    return handleError(e);
  }
}
