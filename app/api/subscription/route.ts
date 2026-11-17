import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { requestExtension, subscriptionPage } from "@/lib/subscription";

// Sozlamalar → Obuna va to'lov (37-qism, lib/subscription.ts) — faqat direktor.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await subscriptionPage(db));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { months?: number } | null;
  const db = await ensureIndexes();
  const r = await requestExtension(db, Number(b?.months), await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
