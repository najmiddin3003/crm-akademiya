import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { coinLedger } from "@/lib/gamification/students";

// GET /api/gamification/students/:id/ledger — O'quvchi kartasidagi «Coin
// tarixi» tabi: har yozuv va o'sha paytdagi avvalgi/yangi balans.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const rows = await coinLedger(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return handleError(e);
  }
}
