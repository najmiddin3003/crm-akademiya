import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { computeAttendanceTeachers } from "@/lib/reportAttendanceTeachers";
import { ISO_DAY, reportBranchIds } from "@/lib/reportScope";
import { canOpenReport, REPORT_BY_SLUG } from "@/lib/reportsCatalog";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/attendance-teachers — Hisobotlar → Davomat → «O'qituvchilar bo'yicha»
// (27-qism, 14.11.2026; avval 15-qism): davomat dars tugagach o'z vaqtida belgilanyaptimi —
// filial → o'qituvchi: darslar, vaqtida, kechikib, belgilanmagan, guruhlarida qatnashish.
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (sukut — shu oy boshidan bugungacha; `to` bugundan oshmaydi)
//   ?branch=all|<id>                 (hovuz — bitta filial, lib/reportScope.ts)
// Hisob — lib/reportAttendanceTeachers.ts (darslar va qatnashish — lib/reportAttendance.ts,
// «Guruhlar bo'yicha» bilan bir xil).
//
// RUXSAT shu yerda — hisobot sahifasi bilan bir xil (lib/reportsCatalog.ts, `canOpenReport`):
// «Davomat qilinmagan guruhlar» yoki «Davomat analitikasi». Qamrov — xodimning filiallari.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const report = REPORT_BY_SLUG["davomat-oqituvchilar"];
  if (!report || !canOpenReport(report, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const today = uzDateIso();
  const from = sp.get("from") || `${today.slice(0, 7)}-01`;
  const to = sp.get("to") || today;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });

  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });

  const db = await ensureIndexes();
  const r = await computeAttendanceTeachers(db, br.ids, { from, to, today });
  return NextResponse.json({ ok: true, branch: br.branch, ...r });
}
