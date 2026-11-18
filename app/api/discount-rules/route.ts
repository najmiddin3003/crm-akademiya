import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { saveDiscountRules } from "@/lib/discountRules";
import { discountSettingsPage } from "@/lib/discountSettingsPage";
import { ensureIndexes } from "@/lib/mongodb";

// Sozlamalar → Moliya → Chegirmalar (39-qism, lib/discountRules.ts) — faqat direktor.
//   GET — qoidalar, shu oy imtiyozlari, tasdiq kutayotganlar; POST {field, on?, value?} — bitta qoidani o'zgartirish.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await discountSettingsPage(db, scope.allowed));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveDiscountRules(db, b, await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
