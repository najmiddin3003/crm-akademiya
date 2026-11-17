import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { saveStudentApp, studentAppPage } from "@/lib/studentAppSettings";

// Sozlamalar → O'quvchi ilovasi (38-qism, lib/studentAppSettings.ts) — faqat direktor.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await studentAppPage(db));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveStudentApp(db, b, await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
