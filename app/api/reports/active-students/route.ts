import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeActiveStudents } from "@/lib/reportStudents";
import { reportBranchIds } from "@/lib/reportScope";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/active-students — Hisobotlar → «Faol o'quvchilar» (15-qism, 25.10.2026):
// bugun guruhda o'qiyotganlar kurs, guruh va o'qituvchi bo'yicha.
//   ?branch=all|<id>   filial (sukut — ruxsat etilgan hammasi)
//   ?course=<nom>      kurs
// Hisob qoidasi — lib/reportStudents.ts. Ruxsat — Aktiv o'quvchilar yoki Guruhlar
// (lib/apiPermissions.generated.ts). Faqat o'qiydi.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });

  const db = await ensureIndexes();
  const report = await computeActiveStudents(db, br.ids, { course: sp.get("course") || undefined, today: uzDateIso() });
  return NextResponse.json({ ok: true, branch: br.branch, ...report });
}
