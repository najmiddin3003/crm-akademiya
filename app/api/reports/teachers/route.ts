import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeTeacherPerf } from "@/lib/reportRetention";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/teachers — Hisobotlar → «O'qituvchilar samaradorligi» (35-qism, lib/reportRetention.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeTeacherPerf(db, c.br.ids, c.from, c.to, c.sp.get("course") || undefined)) });
}
