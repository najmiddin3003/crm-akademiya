import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeAttendance } from "@/lib/reportAttendance";
import { ISO_DAY, reportBranchIds } from "@/lib/reportScope";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/attendance-teachers — Hisobotlar → Davomat → «O'qituvchilar bo'yicha»
// (15-qism, 25.10.2026): rejadagi darslar, davomati belgilangani va belgilanmagani (dars
// jurnali), o'quvchilar qatnashishi — o'qituvchi kesimida.
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (sukut — shu oy boshidan bugungacha)
//   ?branch=all|<id>  ?course=<nom>
// Hisob — lib/reportAttendance.ts. Ruxsat — Davomat qilinmagan guruhlar yoki Davomat
// analitikasi (lib/apiPermissions.generated.ts).
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const today = uzDateIso();
  const from = sp.get("from") || `${today.slice(0, 7)}-01`;
  const to = sp.get("to") || today;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });

  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });

  const db = await ensureIndexes();
  const r = await computeAttendance(db, br.ids, { from, to, course: sp.get("course") || undefined, today });
  // Guruh qatorlari — o'qituvchi ichida ochiladigan ro'yxat uchun (nomi, darslar, jurnal).
  const groups = r.groups.map((g) => ({ id: g.id, label: g.label, course: g.course, level: g.level, teacher: g.teacher, scheduled: g.scheduled, marked: g.marked, unmarked: g.unmarked, lastMarked: g.lastMarked, noSchedule: g.noSchedule }));
  return NextResponse.json({ ok: true, branch: br.branch, from: r.from, to: r.to, historyStart: r.historyStart, teachers: r.teachers, groups, totals: r.totals, courses: r.courses });
}
