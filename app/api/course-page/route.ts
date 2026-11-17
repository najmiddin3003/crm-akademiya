import { NextResponse } from "next/server";
import { coursePage, saveBook } from "@/lib/coursePage";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";

// O'quv bo'limi → Kurslar → kurs sahifasi (36-qism, lib/coursePage.ts).
//   GET ?id&branch — kurs sahifasi; POST — kitob qo'shish / tahrirlash / o'chirish.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  const r = await coursePage(db, Number(c.sp.get("id")), c.br.ids, c.scope.branchId);
  return r ? NextResponse.json(r) : NextResponse.json({ ok: false, error: "Kurs topilmadi" }, { status: 404 });
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveBook(db, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
