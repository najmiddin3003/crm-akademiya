import { NextResponse } from "next/server";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";
import { salesPlan, saveTargets } from "@/lib/salesTargets";

// Sotuv va marketing → Savdo plani (36-qism, lib/salesTargets.ts).
//   GET ?month&branch — rejalar va bajarilish; POST {month, targets: {admin: son}, alsoNext} — joriy filial rejasi.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json(await salesPlan(db, c.scope, c.br.ids, c.month));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => ({}))) as { month?: string; targets?: Record<string, number>; alsoNext?: boolean };
  if (!/^\d{4}-\d{2}$/.test(String(b.month)) || !b.targets || typeof b.targets !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  return NextResponse.json(await saveTargets(db, c.scope.branchId, String(b.month), b.targets, !!b.alsoNext, await currentAuthorName()));
}
