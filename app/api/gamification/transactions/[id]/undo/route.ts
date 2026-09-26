import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { undoTx } from "@/lib/gamification/lesson";

// POST /api/gamification/transactions/:id/undo — «Ortga» (TZ 5.0): xato bosilgan
// amal «Xato bosildi — qaytarildi» bilan bekor qilinadi. Uy vazifasi
// almashtirilgan bo'lsa `{restore: "done" | "missed"}` — avvalgi belgi tiklanadi.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const txId = Number((await params).id);
    if (!Number.isFinite(txId)) return fail(400, "Noto'g'ri id");
    const body = (await readJson(req)) ?? {};
    const restore = body.restore === "done" || body.restore === "missed" ? body.restore : null;
    const res = await undoTx(ctx.db, ctx.actor, { txId, restore });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
