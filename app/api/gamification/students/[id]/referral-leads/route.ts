import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { referralLeads } from "@/lib/gamification/referral";

// GET /api/gamification/students/:id/referral-leads — «Do'st olib keldi»
// oynasi (TZ 4.12, 9): o'quvchi tavsiya qilgan lidlar va har birining holati.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const res = await referralLeads(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
