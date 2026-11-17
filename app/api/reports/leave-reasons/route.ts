import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { computeLeaveReasons } from "@/lib/reportRetention";
import { reportCtx } from "@/lib/reportRoute";

// GET /api/reports/leave-reasons — Hisobotlar → «Ketish sabablari» (35-qism, lib/reportRetention.ts). Faqat o'qiydi.
// ?branch=all|<id>, ?from&to (YYYY-MM-DD) yoki ?month (YYYY-MM). Ruxsat — eski hisobot sahifasi (apiPermissions).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, branch: c.br.branch, ...(await computeLeaveReasons(db, c.scope, c.br.ids, c.from, c.to, { course: c.sp.get("course") || undefined, teacher: c.sp.get("teacher") || undefined })) });
}
