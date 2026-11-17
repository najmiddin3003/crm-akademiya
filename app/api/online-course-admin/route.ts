import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { onlineCourses, saveOnlineCourse } from "@/lib/onlineCourseAdmin";

// O'quv bo'limi → Onlayn kurslar, yangi versiya (36-qism, lib/onlineCourseAdmin.ts).
//   GET — kurslar, tuzilma va statistika; POST {id, modules?, teacher?, audience?, published?}.
export async function GET() {
  if (!(await getBranchScope())) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  return NextResponse.json(await onlineCourses(db));
}

export async function POST(req: Request) {
  if (!(await getBranchScope())) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveOnlineCourse(db, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
