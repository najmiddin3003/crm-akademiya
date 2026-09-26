import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { lessonView } from "@/lib/gamification/lesson";

// GET /api/gamification/lesson?groupId=… — «Tanga berish» dars jurnali (TZ 5.1, 9):
// xodim doirasidagi guruhlar, tanlangan guruhning bugungi darsi — davomat
// holati, uy vazifasi belgisi (kim qo'ygani, o'zgartirish mumkinmi),
// faollik, bugun ayirilgani, bugungi yig'indi, seriya, Sarhisob foizlari.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const raw = new URL(req.url).searchParams.get("groupId");
    const groupId = raw ? Number(raw) : null;
    const view = await lessonView(ctx.db, ctx.actor, Number.isFinite(groupId) ? groupId : null);
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return handleError(e);
  }
}
