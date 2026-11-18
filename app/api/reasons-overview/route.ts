import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { hasSectionPermission } from "@/lib/permissions";
import { reasonsPage } from "@/lib/reasonsPage";

// Sozlamalar → O'quv → Sabablar (40-qism, lib/reasonsPage.ts) — faqat o'qish; qo'shish/tahrir — /api/settings-lists.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (me.role !== "admin" && !hasSectionPermission("/settings-academic", me.permissions)) return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await reasonsPage(db));
}
