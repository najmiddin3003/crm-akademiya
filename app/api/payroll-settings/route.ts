import { NextResponse } from "next/server";
import { getBranchScope, payrollBuilding } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { payrollSettingsPage } from "@/lib/payrollSettings";

// Sozlamalar → Moliya → Oylik va soliq (39-qism, lib/payrollSettings.ts) — faqat direktor, faqat o'qish.
// `?building=` — oylik binosi (Oylik chiqarish bilan bir xil), `?example=` — misol uchun xodim id.
export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const building = payrollBuilding(scope, params.get("building"));
  if (building === null) return NextResponse.json({ ok: false, error: "Bu bino sizga biriktirilmagan" }, { status: 403 });
  const ex = Number(params.get("example"));
  const db = await ensureIndexes();
  return NextResponse.json(await payrollSettingsPage(db, building, Number.isInteger(ex) && ex > 0 ? ex : undefined));
}
