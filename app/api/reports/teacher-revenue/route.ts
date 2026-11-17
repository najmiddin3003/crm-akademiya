import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeTeacherRevenue } from "@/lib/reportResources";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/teacher-revenue — Hisobotlar → «Ustozlar tushumi» (35-qism, lib/reportResources.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeTeacherRevenue(db, c.br.ids, c.month)) });
}
