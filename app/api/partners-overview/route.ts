import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { partnersPage } from "@/lib/partnersPage";

// Sozlamalar → Moliya → Hamkorlar va 3-shaxslar (39-qism, lib/partnersPage.ts) — faqat direktor, faqat o'qish.
// Qo'shish — umumiy /api/settings-lists (kind=partners | third-persons).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await partnersPage(db, scope));
}
