import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { discountOptionsView } from "@/lib/gamification/shop";

// GET /api/gamification/shop/discount-options?pupilId=… — «Sovg'a berish»
// oynasida to'lovga chegirma tanlanganda: o'quvchining faol kurslari, har
// birining oylik narxi, chegirma summasi va berib bo'lmasa sababi
// (TZ 4.16.2–4.16.5). Filial admini (o'z filiali) va direktor.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const pupilId = Number(new URL(req.url).searchParams.get("pupilId"));
    if (!Number.isFinite(pupilId)) return fail(400, "Noto'g'ri so'rov");
    return NextResponse.json({ ok: true, ...(await discountOptionsView(ctx.db, ctx.actor, pupilId)) });
  } catch (e) {
    return handleError(e);
  }
}
