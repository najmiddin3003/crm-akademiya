import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { giveByReason } from "@/lib/gamification/lesson";

// POST /api/gamification/transactions — qo'shimcha sabab bo'yicha tanga (TZ 4.9, 9):
// {pupilId, groupId | null, reasonId, amount, note, from: "lesson" | "profile"}.
// `amount` — MUSBAT son, ishora sababning yo'nalishidan olinadi.

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const pupilId = Number(body?.pupilId);
    const reasonId = Number(body?.reasonId);
    const groupId = body?.groupId === null || body?.groupId === undefined || body?.groupId === "" ? null : Number(body.groupId);
    // Qat'iy butun son: "1e3", "5.0", manfiy — rad etiladi (TZ 10).
    const rawAmount = String(body?.amount ?? "").trim();
    const amount = /^\d+$/.test(rawAmount) ? Number(rawAmount) : NaN;
    const from = body?.from === "profile" ? "profile" : "lesson";
    if (!Number.isFinite(pupilId) || !Number.isFinite(reasonId) || (groupId !== null && !Number.isFinite(groupId))) {
      return fail(400, "Noto'g'ri so'rov");
    }
    const res = await giveByReason(ctx.db, ctx.actor, {
      pupilId,
      groupId,
      reasonId,
      amount,
      note: String(body?.note ?? ""),
      from,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
