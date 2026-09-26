import { NextResponse } from "next/server";
import { assertLinkManager, listTelegramLinks, unlinkTelegram } from "@/lib/gamification/access";
import { fail, handleError, withActor } from "@/lib/gamification/http";

// DELETE /api/gamification/students/:id/telegram-links/:linkId — «Uzish»: bitta
// Telegram akkauntni o'quvchidan uzadi (TZ 5.4, 6.16). Filial admini (o'z
// filiali) va direktor. Javobda yangilangan ro'yxat.

type Params = { params: Promise<{ id: string; linkId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const p = await params;
    const pupilId = Number(p.id);
    const linkId = Number(p.linkId);
    if (!Number.isFinite(pupilId) || !Number.isFinite(linkId)) return fail(400, "Noto'g'ri so'rov");
    await assertLinkManager(ctx.db, ctx.actor, pupilId);
    await unlinkTelegram(ctx.db, ctx.actor, pupilId, linkId);
    return NextResponse.json({ ok: true, links: await listTelegramLinks(ctx.db, pupilId) });
  } catch (e) {
    return handleError(e);
  }
}
