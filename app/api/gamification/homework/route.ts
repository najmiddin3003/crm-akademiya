import { NextResponse } from "next/server";
import { fail, handleError, readJson, withActor } from "@/lib/gamification/http";
import { setHomework, type HomeworkValue } from "@/lib/gamification/lesson";

// POST /api/gamification/homework — {groupId, pupilId, value: "done" | "missed" | "clear"}
// Uy vazifasi belgisi bugungi dars uchun (TZ 4.7.2, 9). Aynan shu belgini
// qayta yuborish uni olib tashlaydi; ✓ ↔ ✗ almashtirishda eskisi bekor qilinadi.

const VALUES = new Set<HomeworkValue>(["done", "missed", "clear"]);

export async function POST(req: Request) {
  try {
    const ctx = await withActor();
    if (ctx instanceof NextResponse) return ctx;
    const body = await readJson(req);
    const groupId = Number(body?.groupId);
    const pupilId = Number(body?.pupilId);
    const value = String(body?.value ?? "") as HomeworkValue;
    if (!Number.isFinite(groupId) || !Number.isFinite(pupilId) || !VALUES.has(value)) return fail(400, "Noto'g'ri so'rov");
    const res = await setHomework(ctx.db, ctx.actor, { groupId, pupilId, value });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return handleError(e);
  }
}
