import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeAdminPerf } from "@/lib/reportLeads";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/admins — Hisobotlar → «Administratorlar samaradorligi» (35-qism, lib/reportLeads.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeAdminPerf(db, c.br.ids, c.from, c.to, c.sp.get("course") || undefined)) });
}
