import { NextResponse } from "next/server";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { HISTORY_FILTERS, studentHistory, type HistoryFilter } from "@/lib/gamification/students";

// GET /api/gamification/students/:id/transactions?filter=all&offset=0 — tanga
// tarixi (TZ 5.4, 9): filtrlar all | month | plus | minus | shop | cancelled,
// 12 tadan. Har qatorda huquqqa qarab amal: bekor qilish, «Sababli qilish»,
// «Sababsizga qaytarish» yoki «e'tiroz muddati o'tgan».

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    const sp = new URL(req.url).searchParams;
    const filter = (sp.get("filter") || "all") as HistoryFilter;
    const offset = Math.max(0, Number(sp.get("offset")) || 0);
    if (!Number.isFinite(id) || !HISTORY_FILTERS.includes(filter)) return fail(400, "Noto'g'ri so'rov");
    const res = await studentHistory(ctx.db, ctx.actor, id, filter, offset);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
