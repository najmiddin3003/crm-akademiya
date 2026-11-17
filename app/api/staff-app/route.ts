import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { saveStaffApp, staffAppPage } from "@/lib/staffAppSettings";

// Sozlamalar → Xodim ilovasi (38-qism, lib/staffAppSettings.ts) — faqat direktor.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await staffAppPage(db, scope.allowed));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveStaffApp(db, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
