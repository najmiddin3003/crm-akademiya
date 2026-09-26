import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { giveGift } from "@/lib/gamification/shop";

// POST /api/gamification/shop/orders — {pupilId, itemId}: sovg'a berish (xarid,
// TZ 4.14) — filial admini (o'z filiali) yoki direktor. Balans, toifa, ombor,
// byudjet serverda tekshiriladi.

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const itemId = Number(body?.itemId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(itemId)) return fail(400, "Noto'g'ri so'rov");
    const res = await giveGift(ctx.db, ctx.actor, { pupilId, itemId });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
