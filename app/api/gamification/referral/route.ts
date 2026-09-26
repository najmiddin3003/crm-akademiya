import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { giveReferral } from "@/lib/gamification/referral";

// POST /api/gamification/referral — {pupilId, leadId}: «Do'st olib keldi»
// bonusini tasdiqlash (TZ 4.12) — filial admini yoki direktor.

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const leadId = Number(body?.leadId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(leadId)) return fail(400, "Noto'g'ri so'rov");
    const res = await giveReferral(ctx.db, ctx.actor, { pupilId, leadId });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
