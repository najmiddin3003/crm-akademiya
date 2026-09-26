import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { competitionView } from "@/lib/gamification/competition";

// GET /api/gamification/competition?month=YYYY-MM&branchId=… — guruhlar
// musobaqasi (TZ 4.20, 5.6, 9): har filial alohida, guruh o'rtachasi bo'yicha.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const sp = new URL(req.url).searchParams;
    const b = sp.get("branchId");
    const branchId = b ? Number(b) : null;
    const view = await competitionView(ctx.db, ctx.actor, sp.get("month"), Number.isFinite(branchId) ? branchId : null);
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return handleError(e);
  }
}
