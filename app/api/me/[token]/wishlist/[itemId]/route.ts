import { NextResponse } from "next/server";
import { pupilIdByToken } from "@/lib/gamification/access";
import { gamDb } from "@/lib/gamification/db";
import { fail, handleError } from "@/lib/gamification/http";
import { setWish } from "@/lib/gamification/studentPage";

// POST / DELETE /api/me/:token/wishlist/:itemId — istak qo'shish / olib tashlash
// (TZ 4.18.1, 9). Havola faqat shu amalga ruxsat beradi.

type Params = { params: Promise<{ token: string; itemId: string }> };

async function handle(paramsP: Params["params"], on: boolean) {
  try {
    const { token, itemId } = await paramsP;
    const db = await gamDb();
    const pupilId = await pupilIdByToken(db, token);
    if (pupilId === null) return fail(404, "Havola eskirgan yoki noto'g'ri — filial adminidan yangi havola so'rang.");
    const id = Number(itemId);
    if (!Number.isFinite(id)) return fail(400, "Noto'g'ri so'rov");
    return NextResponse.json({ ok: true, ...(await setWish(db, pupilId, id, on)) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(_req: Request, { params }: Params) {
  return handle(params, true);
}

export async function DELETE(_req: Request, { params }: Params) {
  return handle(params, false);
}
