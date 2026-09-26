import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { addActivity } from "@/lib/gamification/lesson";

// POST /api/gamification/activity — {groupId, pupilId, coins} — darsdagi faollik
// (TZ 4.7.4, 9): bir bosishda 1…activityMaxPerClick, guruhga darsda jami limit.

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const groupId = Number(body?.groupId);
    const pupilId = Number(body?.pupilId);
    const coins = Number(body?.coins);
    if (!Number.isFinite(groupId) || !Number.isFinite(pupilId) || !Number.isFinite(coins)) return fail(400, "Noto'g'ri so'rov");
    const res = await addActivity(ctx.db, ctx.actor, { groupId, pupilId, coins });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
