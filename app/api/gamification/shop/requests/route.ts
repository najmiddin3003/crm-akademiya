import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { requestsView } from "@/lib/gamification/shopRequests";

// GET /api/gamification/shop/requests — yangi versiyadagi Do'kon · So'rovlar (24.10.2026):
// tangasi yetgan istaklar (so'rovlar), «Topshirish kutilmoqda», kutayotgan istaklar soni.
// Filial admini — o'z filiali, direktor — navbardagi filial; ustozga — bo'sh.

export async function GET() {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    return NextResponse.json({ ok: true, ...(await requestsView(ctx.db, ctx.actor)) });
  } catch (e) {
    return handleError(e);
  }
}
