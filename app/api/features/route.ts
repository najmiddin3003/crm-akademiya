import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { featuresPage, setFeature } from "@/lib/features";
import { getGamActor } from "@/lib/gamification/actor";
import { ensureIndexes } from "@/lib/mongodb";

// Sozlamalar → Funksiyalar (37-qism, lib/features.ts) — faqat direktor (administrator).
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await featuresPage(db));
}

export async function POST(req: Request) {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const b = (await req.json().catch(() => null)) as { key?: string; on?: boolean } | null;
  if (!b?.key) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const actor = await getGamActor(db);
  if (!actor) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const r = await setFeature(db, b.key, !!b.on, actor);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
