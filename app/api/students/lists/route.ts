import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { buildStudentLists } from "@/lib/studentLists";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/students/lists — O'quvchilar bo'limining yangi sahifalari (30-qism) uchun yig'ma
// ro'yxat: har bir o'quvchi guruhlari, joriy oy to'lov holati, ota-ona kabineti, taklif va
// manzili bilan. Hisob va manbalar — lib/studentLists.ts. Filial — navbar filiali.

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  const payload = await buildStudentLists(db, scope, uzDateIso());
  return NextResponse.json(payload);
}
