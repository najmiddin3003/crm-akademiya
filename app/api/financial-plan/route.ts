import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { cashFlow, expensePlan, profitAndLoss, revenuePlan } from "@/lib/financialPlan";
import { uzDateIso } from "@/lib/uzTime";

// Moliya → Moliyaviy reja (32-qism, lib/financialPlan.ts). Faqat o'qish.
// GET ?tab=revenue|expense|flow|pnl&month=YYYY-MM&branch=all|<id>

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const cur = uzDateIso().slice(0, 7);
  const raw = sp.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= cur ? raw : cur;
  const b = Number(sp.get("branch"));
  const only = Number.isFinite(b) && scope.allowed.includes(b) ? b : null;
  const db = await ensureIndexes();
  switch (sp.get("tab")) {
    case "expense":
      return NextResponse.json(await expensePlan(db, month, only));
    case "flow":
      return NextResponse.json(await cashFlow(db, scope, month, only));
    case "pnl":
      return NextResponse.json(await profitAndLoss(db, scope, month, only));
    default:
      return NextResponse.json(await revenuePlan(db, scope, month, only));
  }
}
