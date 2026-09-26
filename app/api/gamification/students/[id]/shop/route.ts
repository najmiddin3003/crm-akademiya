import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { pupilShopInfo } from "@/lib/gamification/shop";

// GET /api/gamification/students/:id/shop — profil: istaklari va sotib olganlari (TZ 5.4).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const res = await pupilShopInfo(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
