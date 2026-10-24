import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { rejectRequest } from "@/lib/gamification/shopRequests";

// POST /api/gamification/shop/requests/reject — {pupilId, itemId, reason}: so'rovni rad
// etish (sababi majburiy; o'quvchi kabinetida ko'radi, tanga joyida qoladi).

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const itemId = Number(body?.itemId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(itemId)) return fail(400, "Noto'g'ri so'rov");
    const res = await rejectRequest(ctx.db, ctx.actor, { pupilId, itemId, reason: String(body?.reason ?? "") });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
