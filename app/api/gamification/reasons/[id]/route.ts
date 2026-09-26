import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { deleteReason, updateReason } from "@/lib/gamification/reasons";

// PUT    /api/gamification/reasons/:id — qo'shimcha sababni tahrirlash (direktor).
// DELETE /api/gamification/reasons/:id — yumshoq o'chirish (direktor); tizim
//   sabablari o'chirilmaydi, tarixdagi yozuvlar nom nusxasi bilan qoladi.

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return fail(400, "Noto'g'ri id");
    const body = await readJson(req);
    if (!body) return fail(400, "Noto'g'ri so'rov");
    const res = await updateReason(ctx.db, ctx.actor, id, body);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await withActor({ director: true });
    if (ctx instanceof NextResponse) return ctx;
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return fail(400, "Noto'g'ri id");
    const res = await deleteReason(ctx.db, ctx.actor, id);
    if (!res.ok) return fail(res.status, res.error);
    return NextResponse.json(res);
  } catch (e) {
    return handleError(e);
  }
}
