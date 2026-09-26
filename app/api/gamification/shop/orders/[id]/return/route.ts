import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { returnGift } from "@/lib/gamification/shop";

// POST /api/gamification/shop/orders/:id/return — {note}: sovg'ani qaytarish
// (TZ 4.15): admin — o'z filialida shu kuni berilganni, direktor — istalganini.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const orderId = Number((await params).id);
    const body = (await readJson(req)) ?? {};
    if (!Number.isFinite(orderId)) return fail(400, "Noto'g'ri id");
    const res = await returnGift(ctx.db, ctx.actor, { orderId, note: String(body.note ?? "") });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
