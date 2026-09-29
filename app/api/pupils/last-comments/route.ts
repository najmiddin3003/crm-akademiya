import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import { lastCommentsFor } from "@/lib/pupilComments";

// GET /api/pupils/last-comments?ids=1,2,3 — har o'quvchining eng oxirgi izohi
// (guruh sahifasidagi «Oxirgi izoh» ustuni, lib/pupilComments.ts). Faqat
// JORIY FILIAL QAMROVIDAGI o'quvchilar — qolgan id'lar jimgina tashlanadi.

const MAX_IDS = 500;

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const ids = [...new Set(
    (new URL(req.url).searchParams.get("ids") || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0),
  )].slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ ok: true, last: {} });

  const db = await ensureIndexes();
  const allowed = await db
    .collection("pupils")
    .find(withPupilBranch({ id: { $in: ids } }, scope), { projection: { _id: 0, id: 1 } })
    .toArray();
  const last = await lastCommentsFor(db, allowed.map((p) => Number(p.id)));
  return NextResponse.json({ ok: true, last }, { headers: { "Cache-Control": "private, no-store" } });
}
