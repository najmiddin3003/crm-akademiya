import { timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { dispatchBotUpdate } from "@/lib/botDispatch";
import { ensureIndexes } from "@/lib/mongodb";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import type { TelegramUpdate } from "@/lib/studentBot/router";

// POST /api/telegram/student — @tizimli_akademiya_bot webhook'i.
//
// 29.09–17.10.2026 bu bot O'QUVCHILAR va XODIMLAR uchun bitta edi:
// yangilanish lib/botDispatch.ts da o'quvchilar (lib/studentBot) yoki
// xodimlar (lib/staffBot) tomoniga ajratiladi. 17.10.2026 dan xodimlar
// @akademiya_crm_bot da (lib/staffBot/config.ts → `STAFF_BOT_HOST`) — xodim
// tomoniga tushgan yangilanishga o'sha botga havola beriladi.
//
// DIQQAT (17.10.2026): bu botga ManyChat ulangan — webhook ManyChat'da, ya'ni
// bu route hozir hech narsa olmaydi. scripts/set-student-bot-webhook.mjs ni
// yurgizish webhook'ni CRM'ga qaytarib, ManyChat'ni UZADI.
//
// SESSIYASIZ OCHIQ — chaqiruvchi Telegram serveri, uning cookie'si yo'q.
// Himoya `setWebhook` dagi `secret_token` bilan: Telegram uni HAR BIR
// so'rovda `X-Telegram-Bot-Api-Secret-Token` sarlavhasida qaytaradi.
// Kalit sozlanmagan bo'lsa endpoint OCHIQ QOLMAYDI — hamma so'rov rad
// etiladi.
//
// Route `lib/apiPermissions.generated.ts` dagi PUBLIC_API ro'yxatiga
// QO'SHILGAN bo'lishi SHART. Aks holda proxy.ts uni sessiya talab
// qiladigan route deb hisoblaydi va Telegram'ning har bir so'rovi 401
// bo'ladi (scripts/gen-api-permissions.mjs → PUBLIC).
//
// Webhook'ni ro'yxatdan o'tkazish: `node scripts/set-student-bot-webhook.mjs`.

export const runtime = "nodejs";

/** Vaqt bo'yicha xavfsiz solishtirish (cron va guruh boti webhook'i bilan bir xil sabab). */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const cfg = loadStudentBotConfig();

  const provided = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!cfg.webhookSecret || !secretMatches(provided, cfg.webhookSecret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Token yo'q — 200 qaytaramiz. 500 bo'lsa Telegram navbatni to'ldirib,
  // o'sha yangilanishlarni soatlab qayta yuboraverardi. (`STUDENT_BOT_ENABLED`
  // faqat o'quvchilar oqimini o'chiradi — handleStudentUpdate o'zi tekshiradi.)
  if (!cfg.token) return NextResponse.json({ ok: true });

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    // Buzuq tana — tuzatadigan narsa bizda yo'q.
    return NextResponse.json({ ok: true });
  }

  // BAZA ULANISHI HAM `try` ICHIDA — yiqilsa ham Telegram'ga 200.
  try {
    const db = await ensureIndexes();
    // `after` — xodim to'lov yozganda Sheets/Telegram navbati javobdan KEYIN
    // yuriladi (lib/cashboxAdjust.ts → defer). Dispatch o'zi hech qachon otmaydi.
    await dispatchBotUpdate(db, update, after);
  } catch (e) {
    console.error("[telegram-student]", e instanceof Error ? e.message : e);
  }

  // Telegram uchun DOIM 200.
  return NextResponse.json({ ok: true });
}
