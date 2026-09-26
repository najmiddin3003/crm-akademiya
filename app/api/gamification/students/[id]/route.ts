import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { studentProfile } from "@/lib/gamification/students";

// GET /api/gamification/students/:id — o'quvchi profili (TZ 5.4): hamyon,
// daraja, seriya (guruhlar bo'yicha), guruhlardagi o'rni, amallar huquqi.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const profile = await studentProfile(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, ...profile });
  } catch (e) {
    return handleError(e);
  }
}
