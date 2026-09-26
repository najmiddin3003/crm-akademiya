import { NextResponse } from "next/server";
import { handleError, withActor } from "@/lib/gamification/http";
import { listStudents } from "@/lib/gamification/students";

// GET /api/gamification/students — Gamifikatsiya → O'quvchilar (TZ 5.3): xodim
// doirasidagi o'quvchilar — toifa, filial, guruhlar, daraja, balans, holat.
// Qidiruv va saralash mijozda (ro'yxat bitta filial ichida — bir necha yuz qator).

export async function GET() {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const rows = await listStudents(ctx.db, ctx.actor);
    return NextResponse.json({ ok: true, rows, role: ctx.actor.role });
  } catch (e) {
    return handleError(e);
  }
}
