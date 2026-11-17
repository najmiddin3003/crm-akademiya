import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { teacherRatings } from "@/lib/lessonRatings";
import { uzDateIso } from "@/lib/uzTime";

// Nazorat → Ustozlar reytingi (34-qism). GET ?month=YYYY-MM&branchId&course — o'quvchilar dars bahosi
// ustozlar bo'yicha (lib/lessonRatings.ts). O'quvchi ismi qaytmaydi.

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const raw = sp.get("month") ?? "";
  const cur = uzDateIso().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= cur ? raw : cur;
  const b = Number(sp.get("branchId"));
  const branchIds = Number.isFinite(b) && scope.allowed.includes(b) ? [b] : scope.allowed;
  const db = await ensureIndexes();
  return NextResponse.json(await teacherRatings(db, { month, branchIds, course: sp.get("course") ?? "" }));
}
