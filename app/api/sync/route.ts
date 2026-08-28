import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { KIND_LABEL, kindNotifiesTelegram, loadSyncConfig, SYNC_KINDS, syncConfigIssues } from "@/lib/sync/config";
import { flushPending } from "@/lib/sync/dispatch";
import { listProblems, outboxCounts, resetBackoff } from "@/lib/sync/outbox";
import { runSyncCycle } from "@/lib/sync/run";
import { digestLines, digestMessages, digestPeriodFor } from "@/lib/sync/salaryDigest";
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
      // Oqimlar ro'yxati bitta manbadan (SYNC_KINDS) — yangi oqim
      // qo'shilganda bu yerni tahrirlash esdan chiqmasin uchun.
      targets: Object.fromEntries(
        SYNC_KINDS.map((kind) => [
          kind,
          {
            label: KIND_LABEL[kind],
            sheetReady: Boolean(cfg.targets[kind].spreadsheetId),
            // Xarajat/ko'chirmada `chatId` doim bo'sh — ular guruhga
            // ketmaydi, sahifada ham shunday ko'rinadi.
            telegramReady: Boolean(cfg.targets[kind].chatId),
            telegramUsed: kindNotifiesTelegram(kind),
            // Oyliklar guruhga HAR BIR YOZUV uchun emas, oyda ikki marta
            // xulosa bo'lib boradi (lib/sync/salaryDigest.ts). Busiz
            // sahifada "Telegram: kerak emas" chiqib, oylik guruhga
            // umuman ketmaydigandek ko'rinardi.
            telegramNote:
              kind === "salary" ? "oyda 2 marta — xulosa"
              : kindNotifiesTelegram(kind) ? ""
              : "kerak emas",
            // Guruh id MAXFIY emas, lekin uni ham chiqarishning hojati
            // yo'q — sahifada faqat topic raqami ko'rinsa yetadi, chunki
            // eng ko'p adashiladigan joy shu.
            threadId: cfg.targets[kind].threadId,
            tabName: cfg.targets[kind].tabName,
          },
        ]),
      ),
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

  // Oyliklar xulosasini YUBORMASDAN ko'rish. Xulosa oyda atigi ikki
  // marta ketadi, ya'ni xato bo'lsa keyingi imkoniyat ikki hafta keyin
  // — shuning uchun oldindan ko'rish kerak. Kun tekshiruvi ham,
  // takrorlanmaslik belgisi ham chetlab o'tiladi: hech narsa
  // yuborilmaydi va bazaga yozilmaydi.
  if (action === "digest-preview") {
    const at = new Date(Date.now() + 5 * 3_600_000); // Toshkent vaqti
    const data = await digestLines(db, at);
    const period = digestPeriodFor() ?? {
      key: "(bugun xulosa kuni emas)",
      label: "hozirgi holat",
      at,
    };
    return NextResponse.json({
      ok: true,
      period: period.key,
      teachers: data.teachers.length,
      others: data.others.length,
      messages: digestMessages(period, data),
    });
  }

  return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
}
