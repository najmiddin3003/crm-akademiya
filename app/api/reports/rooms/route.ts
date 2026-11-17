import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeRooms } from "@/lib/reportResources";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/rooms — Hisobotlar → «Xonalar bandligi» (35-qism, lib/reportResources.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeRooms(db, c.br.ids)) });
}
