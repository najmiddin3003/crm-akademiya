import { NextResponse } from "next/server";
import { listNews, saveNews, type NewsInput } from "@/lib/cabinetNews";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";

// Sotuv va marketing → Yangiliklar va hikoyalar (36-qism, lib/cabinetNews.ts).
//   GET ?branch — ro'yxat (holat, ko'rdi / jami); POST — qo'shish, tahrirlash, o'chirish (`delete: true`).
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json(await listNews(db, c.br.ids));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => null)) as NewsInput | null;
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  if (b.audience?.branchId && !c.scope.isAdmin && !c.scope.allowed.includes(Number(b.audience.branchId))) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });
  const db = await ensureIndexes();
  const r = await saveNews(db, b, await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
