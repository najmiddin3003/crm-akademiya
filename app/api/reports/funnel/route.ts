import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeFunnel } from "@/lib/reportLeads";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/funnel — Hisobotlar → «Sotuv voronkasi» (35-qism, lib/reportLeads.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeFunnel(db, c.br.ids, c.from, c.to, { source: c.sp.get("source") || undefined, course: c.sp.get("course") || undefined, admin: c.sp.get("admin") || undefined })) });
}
