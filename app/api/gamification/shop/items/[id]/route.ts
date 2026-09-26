import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { deleteItem, updateItem } from "@/lib/gamification/shop";

// PUT /api/gamification/shop/items/:id — tahrirlash (chegirmada faqat narx, foiz,
// «kimlar uchun»). DELETE — yumshoq o'chirish (chegirma o'chirilmaydi). Faqat direktor.

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    const body = await readJson(req);
    if (!Number.isFinite(id) || !body) return fail(400, "Noto'g'ri so'rov");
    const res = await updateItem(ctx.db, ctx.actor, id, body);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri id");
    const res = await deleteItem(ctx.db, ctx.actor, id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
