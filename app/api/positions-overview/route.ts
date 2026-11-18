import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { positionsPage } from "@/lib/positionsPage";

// Sozlamalar → Moliya → Lavozim va stavkalar (40-qism, lib/positionsPage.ts) — faqat direktor, faqat o'qish.
// Qo'shish/tahrir — /api/settings-lists (kind=degrees-manager | degrees-teacher).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await positionsPage(db));
}
