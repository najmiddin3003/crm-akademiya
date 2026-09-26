import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { saveLevels } from "@/lib/gamification/settings";

// PUT /api/gamification/levels — faqat direktor. `?preview=1` — saqlamasdan
// ta'sirni qaytaradi: nechta o'quvchining darajasi pasayadi/ko'tariladi
// ({down, up}) — oynada tasdiqlash so'raladi (TZ 4.2.5).

export async function PUT(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    if (!body) return fail(400, "Noto'g'ri so'rov");
    const preview = new URL(req.url).searchParams.get("preview") === "1";
    const res = await saveLevels(ctx.db, ctx.actor, body.levels, preview);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res);
  } catch (e) {
    return handleError(e);
  }
}
