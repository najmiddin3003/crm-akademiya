import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { shopView } from "@/lib/gamification/shop";

// GET /api/gamification/shop?branchId=… — Do'kon (TZ 5.5, xodim ko'rinishi):
// katalog, byudjet kartasi, «O'quvchilar istaklari», joriy oyda berilganlar.
// Ombor — admin/direktorga, dona tannarxi — faqat direktorga.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const b = new URL(req.url).searchParams.get("branchId");
    const branchId = b ? Number(b) : null;
    const view = await shopView(ctx.db, ctx.actor, Number.isFinite(branchId) ? branchId : null);
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return handleError(e);
  }
}
