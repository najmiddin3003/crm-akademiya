import { NextResponse } from "next/server";
import { gamDb } from "@/lib/gamification/db";
import { fail, handleError } from "@/lib/gamification/http";
import { pickPupil, tgPupils } from "@/lib/gamification/meAuth";
import { setWish } from "@/lib/gamification/studentPage";

// POST / DELETE /api/me/tg/wishlist/:itemId?pupilId= — Mini App'dan istak
// qo'shish / olib tashlash (TZ 9). Kirish — /api/me/tg bilan bir xil.

type Params = { params: Promise<{ itemId: string }> };

async function handle(req: Request, paramsP: Params["params"], on: boolean) {
  try {
    const db = await gamDb();
    const auth = await tgPupils(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return fail(auth.status, auth.error);
    const pupilId = pickPupil(auth, new URL(req.url).searchParams.get("pupilId"));
    if (pupilId === null) return fail(403, "Bu o'quvchi sizning Telegram akkauntingizga bog'lanmagan");
    const id = Number((await paramsP).itemId);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri so'rov");
    return NextResponse.json({ ok: true, ...(await setWish(db, pupilId, id, on)) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  return handle(req, params, true);
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, params, false);
}
