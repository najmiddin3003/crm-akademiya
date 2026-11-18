import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { leadSettingsStats } from "@/lib/leadSettingsStats";
import { ensureIndexes } from "@/lib/mongodb";

// Sozlamalar → Lid sozlamalari (40-qism, lib/leadSettingsStats.ts) — shu oy lidlarda qiymatlar soni. Faqat direktor.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await leadSettingsStats(db));
}
