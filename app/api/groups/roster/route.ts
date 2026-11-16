import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { buildGroupRoster } from "@/lib/groupRoster";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/groups/roster — Guruh → Guruh o'quvchilari (yangi versiya, 31-qism): har guruh a'zolari,
// qo'shilgan kuni, joriy oy davomati, sig'im. Hisob — lib/groupRoster.ts. Filial — navbar filiali.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const today = uzDateIso();
  const db = await ensureIndexes();
  return NextResponse.json(await buildGroupRoster(db, scope, today.slice(0, 7), today));
}
