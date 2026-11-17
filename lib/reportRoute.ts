import { NextResponse } from "next/server";
import { getBranchScope, type BranchScope } from "@/lib/branchScope";
import { ISO_DAY, ISO_MONTH, reportBranchIds, type ReportBranch } from "@/lib/reportScope";
import { uzDateIso } from "@/lib/uzTime";

// 35-qism hisobot API'lari uchun umumiy kirish: sessiya, filial (`?branch=all|<id>`), kunlar oralig'i
// (`?from&to` — "YYYY-MM-DD", sukut — oy boshidan bugungacha) yoki oy (`?month=YYYY-MM`, sukut — joriy oy).

export type RouteCtx = { scope: BranchScope; br: ReportBranch; sp: URLSearchParams; from: string; to: string; month: string };

export async function reportCtx(req: Request): Promise<RouteCtx | NextResponse> {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });
  const today = uzDateIso();
  const from = ISO_DAY.test(sp.get("from") ?? "") ? sp.get("from")! : `${today.slice(0, 7)}-01`;
  const to = ISO_DAY.test(sp.get("to") ?? "") ? sp.get("to")! : today;
  if (from > to) return NextResponse.json({ ok: false, error: "Sana oralig'i noto'g'ri" }, { status: 400 });
  const month = ISO_MONTH.test(sp.get("month") ?? "") ? sp.get("month")! : today.slice(0, 7);
  return { scope, br, sp, from, to, month };
}
