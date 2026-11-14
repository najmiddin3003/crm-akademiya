import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeAttendance } from "@/lib/reportAttendance";
import { ISO_DAY, reportBranchIds } from "@/lib/reportScope";
import { canOpenReport, REPORT_BY_SLUG } from "@/lib/reportsCatalog";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/attendance-groups — Hisobotlar → Davomat → «Guruhlar bo'yicha» (15-qism,
// 25.10.2026; 27-qism, 14.11.2026): qatnashish foizi va qoldirilgan darslar.
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (sukut — shu oy boshidan bugungacha)
//   ?branch=all|<id>  ?course=<nom>
// Hisob — lib/reportAttendance.ts. 27-qism qo'shimchalari (eski maydonlar o'zgarmagan):
//   groups[].streak2 — guruhda ketma-ket 2+ «sababsiz» qoldirgan hozirgi a'zolar;
//   streaks          — o'sha o'quvchilar (ism, darslar, izoh, ota-ona telefoni);
//   branches         — { id, name } (jadvaldagi filial qatorlari nomi).
//
// RUXSAT shu yerda — hisobot sahifasi bilan bir xil (lib/reportsCatalog.ts, `canOpenReport`:
// «Davomat analitikasi»). Javobda o'quvchi ismi va telefoni bor — ruxsatsiz ochilmasin.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const report = REPORT_BY_SLUG["davomat-guruhlar"];
  if (!report || !canOpenReport(report, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }
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
  const [r, branches] = await Promise.all([
    computeAttendance(db, br.ids, { from, to, course: sp.get("course") || undefined, today, streaks: true }),
    db.collection("branches").find({ id: { $in: br.ids } }, { projection: { _id: 0, id: 1, name: 1 } }).sort({ id: 1 }).toArray(),
  ]);
  return NextResponse.json({
    ok: true,
    branch: br.branch,
    from: r.from,
    to: r.to,
    historyStart: r.historyStart,
    groups: r.groups,
    totals: r.totals,
    courses: r.courses,
    streaks: r.streaks ?? [],
    branches: branches.map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
  });
}
