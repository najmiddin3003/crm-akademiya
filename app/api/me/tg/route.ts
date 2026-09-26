import { NextResponse } from "next/server";
import { gamDb } from "@/lib/gamification/db";
import { fail, handleError } from "@/lib/gamification/http";
import { pickPupil, tgPupils } from "@/lib/gamification/meAuth";
import { pupilBrief, studentPageData, studentPageHistory } from "@/lib/gamification/studentPage";
import { HISTORY_FILTERS, type HistoryFilter } from "@/lib/gamification/students";

// GET /api/me/tg?pupilId= — o'quvchi sahifasi, TELEGRAM MINI APP orqali (TZ 5.8, 9).
// `X-Telegram-Init-Data` sarlavhasi bot tokeni bilan tekshiriladi; o'quvchi
// shu akkauntga bog'langanlar ichidan tanlanadi (lib/gamification/meAuth.ts).
// Javob /api/me/:token bilan bir xil + `students` (farzand tanlovi uchun).

export async function GET(req: Request) {
  try {
    const db = await gamDb();
    const auth = await tgPupils(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) return fail(auth.status, auth.error);
    const sp = new URL(req.url).searchParams;
    const pupilId = pickPupil(auth, sp.get("pupilId"));
    if (pupilId === null) return fail(403, "Bu o'quvchi sizning Telegram akkauntingizga bog'lanmagan");
    if (sp.get("part") === "history") {
      const f = sp.get("filter") as HistoryFilter;
      const filter: HistoryFilter = HISTORY_FILTERS.includes(f) ? f : "all";
      const offset = Math.max(0, Number(sp.get("offset")) || 0);
      return NextResponse.json({ ok: true, history: await studentPageHistory(db, pupilId, filter, offset) });
    }
    const students = [];
    for (const id of auth.pupilIds) students.push(await pupilBrief(db, id).catch(() => null));
    return NextResponse.json({ ok: true, ...(await studentPageData(db, pupilId)), students: students.filter(Boolean), telegramUrl: null });
  } catch (e) {
    return handleError(e);
  }
}
