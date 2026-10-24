import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { rankingBoard } from "@/lib/gamification/rankingBoard";

// GET /api/gamification/ranking/board?period=month|all&groupId=… — yangi versiyadagi Reyting
// (24.10.2026): navbardagi filial bo'yicha (guruh tanlansa — shu guruh), oylik yoki umumiy
// (balans), o'tgan oylar g'oliblari. Eski guruh reytingi — /api/gamification/ranking.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const sp = new URL(req.url).searchParams;
    const raw = sp.get("groupId");
    const groupId = raw ? Number(raw) : null;
    const period = sp.get("period") === "all" ? "all" : "month";
    const view = await rankingBoard(ctx.db, ctx.actor, { period, groupId: Number.isFinite(groupId) ? groupId : null });
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return handleError(e);
  }
}
