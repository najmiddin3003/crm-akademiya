import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { createItem } from "@/lib/gamification/shop";

// POST /api/gamification/shop/items — yangi sovg'a (TZ 4.13) — faqat direktor.

export async function POST(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    if (!body) return fail(400, "Noto'g'ri so'rov");
    const res = await createItem(ctx.db, ctx.actor, body);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
