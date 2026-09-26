import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { giveGift } from "@/lib/gamification/shop";

// POST /api/gamification/shop/orders — {pupilId, itemId, groupId?}: sovg'a
// berish (xarid, TZ 4.14) — filial admini (o'z filiali) yoki direktor. Balans,
// toifa, ombor, byudjet serverda tekshiriladi. `groupId` — to'lovga chegirmada
// qaysi kurs to'loviga (TZ 4.16.2).

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const itemId = Number(body?.itemId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(itemId)) return fail(400, "Noto'g'ri so'rov");
    const groupId = body?.groupId === undefined || body?.groupId === null ? null : Number(body.groupId);
    const res = await giveGift(ctx.db, ctx.actor, { pupilId, itemId, groupId });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
