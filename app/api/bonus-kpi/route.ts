import { NextResponse } from "next/server";
import { bonusKpiPage, saveBonusKpi } from "@/lib/bonusKpi";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";

// Sozlamalar → Moliya → Bonus va KPI (39-qism, lib/bonusKpi.ts) — faqat direktor.
//   GET — qoidalar va shu oy sotuv bonusi (hozircha); POST {field, on?, amount?} — bitta qoidani o'zgartirish.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await bonusKpiPage(db, scope, scope.allowed));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveBonusKpi(db, b, await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
