import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isStudentBotReady, loadStudentBotConfig } from "@/lib/studentBot/config";
import { handleStudentUpdate, type TelegramUpdate } from "@/lib/studentBot/router";

// POST /api/telegram/student — O'QUVCHILAR botining webhook'i.
//
// XODIMLAR BOTINIKIDAN ALOHIDA (`/api/telegram/webhook`) — ataylab.
// U yerda `allowed_updates: ["callback_query"]`, ya'ni ichki guruhlarga
// yozadigan bot begona odamning xabarini umuman ko'rmaydi. Bu yerda esa
// `message` KERAK, chunki o'quvchi telefon raqamini yuboradi. Ikkalasini
// bitta route'ga qo'shish o'sha chegarani buzardi.
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

/** Vaqt bo'yicha xavfsiz solishtirish (cron va xodimlar webhook'i bilan bir xil sabab). */
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

  // Token yo'q yoki modul o'chirilgan — 200 qaytaramiz. 500 bo'lsa
  // Telegram navbatni to'ldirib, o'sha yangilanishlarni soatlab qayta
  // yuboraverardi.
  if (!isStudentBotReady(cfg)) return NextResponse.json({ ok: true });

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    // Buzuq tana — tuzatadigan narsa bizda yo'q.
    return NextResponse.json({ ok: true });
  }

  const db = await ensureIndexes();
  // `handleStudentUpdate` o'zi hech qachon otmaydi (router.ts).
  await handleStudentUpdate(db, cfg, update);

  // Telegram uchun DOIM 200.
  return NextResponse.json({ ok: true });
}
