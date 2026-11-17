import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { listStudents, walletSummary } from "@/lib/gamification/students";

// GET /api/gamification/students — Gamifikatsiya → O'quvchilar (TZ 5.3): xodim
// doirasidagi o'quvchilar — toifa, filial, guruhlar, daraja, balans, holat.
// Qidiruv va saralash mijozda (ro'yxat bitta filial ichida — bir necha yuz qator).

export async function GET(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const rows = await listStudents(ctx.db, ctx.actor);
    // `?summary=1` — yangi versiyadagi «Hamyonlar» kartalari (33-qism).
    const summary = new URL(req.url).searchParams.get("summary") === "1" ? await walletSummary(ctx.db, rows) : undefined;
    return NextResponse.json({ ok: true, rows, role: ctx.actor.role, summary });
  } catch (e) {
    return handleError(e);
  }
}
