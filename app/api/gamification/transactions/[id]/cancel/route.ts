import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { cancelTx } from "@/lib/gamification/storno";

// POST /api/gamification/transactions/:id/cancel — {note}: yozuvni bekor qilish
// (storno, TZ 4.11). Yozuv o'chmaydi — «bekor qilindi» bo'ladi, izoh majburiy.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const body = (await readJson(req)) ?? {};
    const res = await cancelTx(ctx.db, ctx.actor, id, body.note);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
