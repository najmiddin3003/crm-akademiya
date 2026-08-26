import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { KIND_LABEL, loadSyncConfig, syncConfigIssues } from "@/lib/sync/config";
import { flushPending } from "@/lib/sync/dispatch";
import { listProblems, outboxCounts, resetBackoff } from "@/lib/sync/outbox";
import { runSyncCycle } from "@/lib/sync/run";
import { latestRuns } from "@/lib/sync/runs";
import { checkBot } from "@/lib/sync/telegram";

// Moliya → Sinxronizatsiya sahifasining backend'i.
//
//   GET  /api/sync           — holat: sozlamalar, navbat, oxirgi tekshiruvlar
//   POST /api/sync {action}  — "retry" | "reconcile" | "test"
//
// Bu route'lar CRM ichida, ya'ni faqat tizimga kirgan foydalanuvchi
// uchun. Middleware `api/` yo'llarini tekshirmaydi (middleware.ts dagi
// matcher), shuning uchun ruxsat SHU YERDA tekshiriladi.

export const runtime = "nodejs";
export const maxDuration = 60;

const RESERVE_MS = 12_000;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401 });

  const db = await ensureIndexes();
  const cfg = loadSyncConfig();

  const [counts, problems, runs] = await Promise.all([
    outboxCounts(db),
    listProblems(db, 50),
    latestRuns(db, 10),
  ]);

  return NextResponse.json({
    ok: true,
    // MAXFIY QIYMATLAR QAYTARILMAYDI — faqat "sozlangan/sozlanmagan"
    // holati va nima yetishmayotgani.
    config: {
      enabled: cfg.enabled,
      issues: syncConfigIssues(cfg),
      targets: {
        payment: {
          label: KIND_LABEL.payment,
          sheetReady: Boolean(cfg.targets.payment.spreadsheetId),
          telegramReady: Boolean(cfg.targets.payment.chatId),
          tabName: cfg.targets.payment.tabName,
        },
        salary: {
          label: KIND_LABEL.salary,
          sheetReady: Boolean(cfg.targets.salary.spreadsheetId),
          telegramReady: Boolean(cfg.targets.salary.chatId),
          tabName: cfg.targets.salary.tabName,
        },
      },
    },
    counts,
    problems,
    runs,
  });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401 });

  let action = "";
  try {
    const body = (await req.json()) as { action?: string };
    action = String(body.action ?? "");
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();

  // "Qayta yuborish" — navbatdagi kutish vaqtlarini bekor qilib, darhol
  // uriniladi. Foydalanuvchi tugmani bosgan ekan, 6 soat kutishning
  // ma'nosi yo'q.
  if (action === "retry") {
    await resetBackoff(db);
    const flush = await flushPending(db, { limit: 200, deadline: Date.now() + 40_000 });
    return NextResponse.json({ ok: true, flush });
  }

  // "To'liq tekshirish" — cron kutmasdan, xuddi o'sha sikl.
  if (action === "reconcile") {
    try {
      const result = await runSyncCycle("manual", maxDuration * 1000 - RESERVE_MS);
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "noma'lum xato" },
        { status: 500 },
      );
    }
  }

  // "Ulanishni tekshirish" — bot tirikmi, token to'g'rimi.
  if (action === "test") {
    const bot = await checkBot(loadSyncConfig());
    return NextResponse.json({ ok: true, bot });
  }

  return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
}
