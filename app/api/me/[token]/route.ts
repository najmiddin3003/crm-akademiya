import { NextResponse } from "next/server";
import { pupilIdByToken } from "@/lib/gamification/access";
import { gamDb } from "@/lib/gamification/db";
import { fail, handleError } from "@/lib/gamification/http";
import { studentPageData, studentPageHistory } from "@/lib/gamification/studentPage";
import { HISTORY_FILTERS, type HistoryFilter } from "@/lib/gamification/students";
import { studentBotUsername } from "@/lib/studentBot/api";
import { loadStudentBotConfig } from "@/lib/studentBot/config";

// GET /api/me/:token — o'quvchi sahifasi, SHAXSIY HAVOLA orqali (TZ 5.8, 9).
// Sessiyasiz ochiq (PUBLIC_API): kalit — havoladagi tasodifiy token, u faqat
// SHU o'quvchini ochadi. `?part=history&filter=&offset=` — tarixning keyingi
// sahifasi. Javobda «Telegramda ochish» havolasi (`t.me/{bot}?start={token}`).

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const db = await gamDb();
    const pupilId = await pupilIdByToken(db, token);
    if (pupilId === null) return fail(404, "Havola eskirgan yoki noto'g'ri — filial adminidan yangi havola so'rang.");
    const sp = new URL(req.url).searchParams;
    if (sp.get("part") === "history") {
      const f = sp.get("filter") as HistoryFilter;
      const filter: HistoryFilter = HISTORY_FILTERS.includes(f) ? f : "all";
      const offset = Math.max(0, Number(sp.get("offset")) || 0);
      return NextResponse.json({ ok: true, history: await studentPageHistory(db, pupilId, filter, offset) });
    }
    const bot = await studentBotUsername(loadStudentBotConfig()).catch(() => "");
    return NextResponse.json({ ok: true, ...(await studentPageData(db, pupilId)), telegramUrl: bot ? `https://t.me/${bot}?start=${token}` : null });
  } catch (e) {
    return handleError(e);
  }
}
