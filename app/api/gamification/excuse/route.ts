import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { excuseAttendance } from "@/lib/gamification/lesson";

// POST /api/gamification/excuse — {groupId, pupilId, date, action: "excuse" | "unexcuse"}
// «Sababli qilish» / «Sababsizga qaytarish» (TZ 4.5.4–4.5.5, 9). Davomat
// bo'limidagi o'zgarish bilan BIR XIL servis (lib/gamification/attendance.ts):
// ayirilgan (applied) tanga qaytadi yoki −N qayta yoziladi, seriya qayta hisoblanadi.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const groupId = Number(body?.groupId);
    const pupilId = Number(body?.pupilId);
    const date = String(body?.date ?? "");
    const action = body?.action === "unexcuse" ? "unexcuse" : body?.action === "excuse" ? "excuse" : null;
    if (!Number.isFinite(groupId) || !Number.isFinite(pupilId) || !ISO.test(date) || !action) return fail(400, "Noto'g'ri so'rov");
    const res = await excuseAttendance(ctx.db, ctx.actor, ctx.actor.name, { groupId, pupilId, date, action });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
