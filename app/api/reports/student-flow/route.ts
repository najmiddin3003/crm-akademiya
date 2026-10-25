import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeStudentFlow, shiftMonthKey } from "@/lib/reportStudents";
import { ISO_MONTH, reportBranchIds } from "@/lib/reportScope";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/student-flow — Hisobotlar → «Kelgan va ketgan» (15-qism, 25.10.2026).
//   ?from=YYYY-MM&to=YYYY-MM   oylar (sukut — oxirgi 6 oy, joriy oy bilan)
//   ?branch=all|<id>           filial (sukut — ruxsat etilgan hammasi)
//   ?course=<nom>              kurs
// Hisob qoidasi — lib/reportStudents.ts. Ruxsat — «O'quvchilar oqimi» (/sales-sources),
// lib/apiPermissions.generated.ts. Faqat o'qiydi.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const today = uzDateIso();
  const cur = today.slice(0, 7);
  const from = sp.get("from") || shiftMonthKey(cur, -5);
  const to = sp.get("to") || cur;
  if (!ISO_MONTH.test(from) || !ISO_MONTH.test(to)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri oy (YYYY-MM kutilgan)" }, { status: 400 });
  }
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });

  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });

  const db = await ensureIndexes();
  const report = await computeStudentFlow(db, br.ids, { from, to, course: sp.get("course") || undefined, today });
  return NextResponse.json({ ok: true, branch: br.branch, from, to, ...report });
}
