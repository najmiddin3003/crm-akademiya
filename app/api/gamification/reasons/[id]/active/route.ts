import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { setReasonActive } from "@/lib/gamification/reasons";

// PATCH /api/gamification/reasons/:id/active — yoqish/to'xtatish (direktor).
// Tizim sababi to'xtatilsa keyingi hodisalarda yozuv yaratilmaydi, o'tgan
// yozuvlar o'zgarmaydi (TZ 4.4). «Uzluksiz davomat bonusi» qayta yoqilsa —
// yangi qoida shu paytdan (TZ 4.6.5).

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return fail(400, "Noto'g'ri id");
    const body = await readJson(req);
    if (!body || typeof body.isActive !== "boolean") return fail(400, "Noto'g'ri so'rov");
    const res = await setReasonActive(ctx.db, ctx.actor, id, body.isActive);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res);
  } catch (e) {
    return handleError(e);
  }
}
