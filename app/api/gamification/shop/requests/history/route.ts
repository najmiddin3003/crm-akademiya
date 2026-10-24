import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { requestsHistory } from "@/lib/gamification/shopRequests";

// GET /api/gamification/shop/requests/history?days=90 — topshirilgan / berilgan, qaytarilgan
// xaridlar va rad etilgan so'rovlar (yangi versiyadagi Do'kon · «Tarix»).

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const raw = Number(new URL(req.url).searchParams.get("days"));
    const days = Number.isInteger(raw) && raw >= 1 && raw <= 366 ? raw : 90;
    return NextResponse.json({ ok: true, ...(await requestsHistory(ctx.db, ctx.actor, days)) });
  } catch (e) {
    return handleError(e);
  }
}
