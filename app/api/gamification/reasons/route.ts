import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { createReason, listReasons } from "@/lib/gamification/reasons";

// GET  /api/gamification/reasons — tizim va qo'shimcha sabablar (o'chirilmaganlar).
// POST /api/gamification/reasons — qo'shimcha sabab qo'shish (faqat direktor, TZ 4.9).

export async function GET() {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    return NextResponse.json({ ok: true, reasons: await listReasons(ctx.db) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    if (!body) return fail(400, "Noto'g'ri so'rov");
    const res = await createReason(ctx.db, ctx.actor, body);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res);
  } catch (e) {
    return handleError(e);
  }
}
