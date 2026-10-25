import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { pupilHistory } from "@/lib/uzbmbServer";

// GET /api/imtihon/uzbmb/pupils/:id — o'quvchining UzBMB testlari (joriy filial testlari, yangisi
// birinchi) — natijalar jadvalida o'quvchi bosilganda o'ng kartada (12-qism).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, history: await pupilHistory(db, scope, Number(id)) });
}
