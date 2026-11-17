import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { authStudentWeb } from "@/lib/studentBot/webapp";
import { myRatings, submitRating } from "@/lib/lessonRatings";

// O'quvchi kabineti → «Darsni baholash» (34-qism). Kirish — Telegram `initData` (faol o'quvchi).
//   POST {initData, action: "list"}                                         — oxirgi baholarim;
//   POST {initData, action: "submit", groupId, date, stars, tags, comment} — baho (kelgan darsiga, bir marta).
// Mantiq — lib/lessonRatings.ts.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const auth = await authStudentWeb(db, typeof body.initData === "string" ? body.initData : "");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const pupilId = auth.user.activePupilId;

  if (body.action === "submit") {
    const groupId = Number(body.groupId);
    const date = String(body.date ?? "");
    if (!Number.isFinite(groupId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
    const res = await submitRating(db, pupilId, {
      groupId,
      date,
      stars: Number(body.stars),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      comment: typeof body.comment === "string" ? body.comment : "",
    });
    return NextResponse.json(res, { status: res.ok ? 200 : res.status });
  }
  return NextResponse.json({ ok: true, ...(await myRatings(db, pupilId)) });
}
