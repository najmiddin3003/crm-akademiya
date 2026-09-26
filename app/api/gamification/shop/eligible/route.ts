import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { loadSettings } from "@/lib/gamification/settings";
import { eligiblePupils } from "@/lib/gamification/shop";

// GET /api/gamification/shop/eligible?itemId=…&branchId=… — «Sovg'a berish»
// oynasidagi o'quvchilar (TZ 4.14.2): balans, ♥ istagani, berib bo'lmasa sababi.

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    if (ctx.actor.role === "teacher") return fail(403, "Sovg'ani filial admini yoki direktor beradi");
    const sp = new URL(req.url).searchParams;
    const itemId = Number(sp.get("itemId"));
    const b = sp.get("branchId");
    const branchId = b ? Number(b) : null;
    if (!Number.isFinite(itemId)) return fail(400, "Noto'g'ri so'rov");
    const rows = await eligiblePupils(ctx.db, ctx.actor, itemId, Number.isFinite(branchId) ? branchId : null);
    const { kidsMaxGrade } = await loadSettings(ctx.db);
    return NextResponse.json({ ok: true, rows, kidsMaxGrade });
  } catch (e) {
    return handleError(e);
  }
}
