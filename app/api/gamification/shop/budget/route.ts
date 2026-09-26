import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { budgetsView, setBudget } from "@/lib/gamification/shop";

// GET /api/gamification/shop/budget — Sozlamalar → «Filiallar va byudjet» jadvali (direktor).
export async function GET() {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    return NextResponse.json({ ok: true, ...(await budgetsView(ctx.db)) });
  } catch (e) {
    return handleError(e);
  }
}

// PUT /api/gamification/shop/budget — {branchId, monthlyLimitSom}: filialning oylik
// sovg'a byudjeti (TZ 4.17) — faqat direktor. Bo'sh — cheklanmagan.

export async function PUT(req: Request) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const branchId = Number(body?.branchId);
    if (!Number.isFinite(branchId)) return fail(400, "Noto'g'ri so'rov");
    const res = await setBudget(ctx.db, ctx.actor, branchId, body?.monthlyLimitSom);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
