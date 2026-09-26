import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { closeMonth } from "@/lib/gamification/competition";

// POST /api/gamification/month-close — {month}: «Oyni yakunlash» (TZ 4.20.4, 9) —
// faqat direktor. Oy tugamagan → 422, allaqachon yakunlangan → 409.

export async function POST(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const month = String(body?.month ?? "");
    if (!/^\d{4}-\d{2}$/.test(month)) return fail(400, "Noto'g'ri oy");
    const res = await closeMonth(ctx.db, month, ctx.actor);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
