import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { cancelPreview } from "@/lib/gamification/storno";

// GET /api/gamification/transactions/:id/cancel-preview — bekor qilish oynasi
// uchun (TZ 4.11.4, 9): ruxsat, balans X → Y, kechiriladigan qism, daraja.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const res = await cancelPreview(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
