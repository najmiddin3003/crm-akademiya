import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { approveRequest } from "@/lib/gamification/shopRequests";

// POST /api/gamification/shop/requests/approve — {pupilId, itemId, groupId?}: so'rovni
// tasdiqlash = sovg'a berish (tanga ayiriladi, ombor −1); buyum/xizmat «Topshirish
// kutilmoqda» ga tushadi. `groupId` — to'lovga chegirmada kurs.

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const itemId = Number(body?.itemId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(itemId)) return fail(400, "Noto'g'ri so'rov");
    const groupId = body?.groupId === undefined || body?.groupId === null ? null : Number(body.groupId);
    const res = await approveRequest(ctx.db, ctx.actor, { pupilId, itemId, groupId });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
