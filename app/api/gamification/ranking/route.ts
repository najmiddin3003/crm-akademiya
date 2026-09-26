import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { rankingView } from "@/lib/gamification/rankingView";

// GET /api/gamification/ranking?groupId=…&period=month|all — guruh reytingi
// (TZ 4.3, 5.2, 9): o'rin (teng o'rinlar bilan), daraja, reyting tangasi, balans.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const sp = new URL(req.url).searchParams;
    const raw = sp.get("groupId");
    const groupId = raw ? Number(raw) : null;
    const period = sp.get("period") === "all" ? "all" : "month";
    const view = await rankingView(ctx.db, ctx.actor, Number.isFinite(groupId) ? groupId : null, period);
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return handleError(e);
  }
}
