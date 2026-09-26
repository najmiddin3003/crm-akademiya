import { NextResponse } from "next/server";
import { activeToken, assertLinkManager, getOrCreateToken, listTelegramLinks, regenerateToken } from "@/lib/gamification/access";
import { fail, handleError, withActor } from "@/lib/gamification/http";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import { studentBotUsername } from "@/lib/studentBot/api";

// GET  /api/gamification/students/:id/access-token — joriy o'quvchi havolasi (yo'q
//      bo'lsa `token: null`, YARATILMAYDI) va bog'langan Telegram akkauntlar (TZ 5.4).
// POST /api/gamification/students/:id/access-token — havola yo'q bo'lsa yaratadi;
//      bor bo'lsa «Qayta yaratish»: eski havola va barcha Telegram bog'lanishlari
//      darhol bekor (TZ 6.14, audit — `regenerate`).
// Filial admini (o'z filiali) va direktor. To'liq manzilni mijoz o'z
// domenidan quradi (`/me/{token}`) — server orqasidagi host ishonchsiz.

type Params = { params: Promise<{ id: string }> };

async function view(db: Parameters<typeof listTelegramLinks>[0], token: string | null, pupilId: number) {
  const bot = token ? await studentBotUsername(loadStudentBotConfig()).catch(() => "") : "";
  return {
    token,
    path: token ? `/me/${token}` : null,
    telegramUrl: token && bot ? `https://t.me/${bot}?start=${token}` : null,
    links: await listTelegramLinks(db, pupilId),
  };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const pupilId = Number((await params).id);
    if (!Number.isFinite(pupilId)) return fail(400, "Noto'g'ri so'rov");
    await assertLinkManager(ctx.db, ctx.actor, pupilId);
    const t = await activeToken(ctx.db, pupilId);
    return NextResponse.json({ ok: true, ...(await view(ctx.db, t?.token ?? null, pupilId)) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const pupilId = Number((await params).id);
    if (!Number.isFinite(pupilId)) return fail(400, "Noto'g'ri so'rov");
    await assertLinkManager(ctx.db, ctx.actor, pupilId);
    if (!(await activeToken(ctx.db, pupilId))) {
      const t = await getOrCreateToken(ctx.db, ctx.actor, pupilId);
      return NextResponse.json({ ok: true, created: true, revokedLinks: 0, ...(await view(ctx.db, t.token, pupilId)) });
    }
    const { token, revokedLinks } = await regenerateToken(ctx.db, ctx.actor, pupilId);
    return NextResponse.json({ ok: true, created: false, revokedLinks, ...(await view(ctx.db, token.token, pupilId)) });
  } catch (e) {
    return handleError(e);
  }
}
