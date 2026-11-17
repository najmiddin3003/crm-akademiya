import { NextResponse } from "next/server";
import { markSeen } from "@/lib/cabinetNews";
import { ensureIndexes } from "@/lib/mongodb";
import { activeLink } from "@/lib/studentBot/users";
import { authStudentWeb } from "@/lib/studentBot/webapp";

// POST /api/student-web/seen {initData, ids} — kabinetda yangilik/hikoya ko'rildi (36-qism, lib/cabinetNews.ts).
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { initData?: unknown; ids?: unknown };
  const db = await ensureIndexes();
  const auth = await authStudentWeb(db, typeof b.initData === "string" ? b.initData : "");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  await markSeen(db, ids, auth.user.activePupilId, activeLink(auth.user)?.role ?? "student");
  return NextResponse.json({ ok: true });
}
