import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { loadSyncConfig } from "@/lib/sync/config";
import { answerCallback, editMessage } from "@/lib/sync/telegram";
import { leadKeyboard, leadStatusOption, parseLeadCallback } from "@/lib/leadStatus";
import { leadMessage } from "@/lib/leadNotify";
import { uzStamp } from "@/lib/uzTime";
import type { Order } from "@/lib/ordersData";

// POST /api/telegram/webhook — Telegram tugmalari (callback_query).
//
// NIMA UCHUN: "Lidlar" topigidagi har bir xabar tagida to'rtta status
// tugmasi turadi (lib/leadStatus.ts). Bosilganda Telegram shu manzilga
// yangilanish yuboradi; biz statusni bazaga yozamiz va xabarning o'zini
// tahrirlab, "Status:" qatorini yangilaymiz.
//
// SESSIYASIZ OCHIQ — chaqiruvchi Telegram serveri, uning cookie'si yo'q.
// Himoya `setWebhook` dagi `secret_token` bilan: Telegram uni HAR BIR
// so'rovda `X-Telegram-Bot-Api-Secret-Token` sarlavhasida qaytaradi
// (app/api/sync/cron dagi CRON_SECRET bilan bir xil qolip). Kalit
// sozlanmagan bo'lsa endpoint OCHIQ QOLMAYDI — hamma so'rov rad etiladi.
//
// Webhook'ni ro'yxatdan o'tkazish: `node scripts/set-telegram-webhook.mjs`.

export const runtime = "nodejs";

/** Vaqt bo'yicha xavfsiz solishtirish (cron route'idagi bilan bir xil sabab). */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface CallbackQuery {
  id: string;
  data?: string;
  from?: { first_name?: string; last_name?: string; username?: string };
  message?: { message_id: number; chat?: { id: number | string } };
}

/** Tugmani bosgan odamning ko'rinadigan ismi — jurnalga va bazaga. */
function senderName(from: CallbackQuery["from"]): string {
  const full = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
  return full || (from?.username ? `@${from.username}` : "");
}

/** Filial nomi — xabar qayta chizilganda kerak (lib/leadNotify.ts dagidek). */
async function branchNameOf(db: Db, branchId: unknown): Promise<string> {
  if (typeof branchId !== "number") return "";
  const row = await db.collection("branches").findOne({ id: branchId }, { projection: { _id: 0, name: 1 } });
  return typeof row?.name === "string" ? row.name : "";
}

export async function POST(req: Request) {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const provided = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { callback_query?: CallbackQuery };
  try {
    update = await req.json();
  } catch {
    // Buzuq tana — 200 qaytaramiz, aks holda Telegram uni ABADIY qayta
    // yuboraveradi. Tuzatadigan narsa bizda yo'q.
    return NextResponse.json({ ok: true });
  }

  const cq = update.callback_query;
  // Boshqa turdagi yangilanishlar (xabar, a'zo qo'shilishi …) e'tiborsiz.
  // `allowed_updates` da faqat callback_query so'ralgan, lekin eski
  // webhook sozlamasi qolgan bo'lishi mumkin.
  if (!cq?.id) return NextResponse.json({ ok: true });

  const cfg = loadSyncConfig();
  const parsed = parseLeadCallback(cq.data);
  if (!parsed) {
    await answerCallback(cfg, cq.id, "Tugma tanilmadi");
    return NextResponse.json({ ok: true });
  }

  // BUTUN ISH `try` ICHIDA: bu yerdan otilgan xato 500 bo'lib qaytardi va
  // Telegram o'sha tugmani qayta-qayta yuboraverardi.
  try {
    const db = await ensureIndexes();
    const col = db.collection("orders");
    const order = (await col.findOne({ id: parsed.orderId })) as (Order & { branchId?: number }) | null;
    if (!order) {
      await answerCallback(cfg, cq.id, "Lid topilmadi — CRM'dan o'chirilgan bo'lishi mumkin");
      return NextResponse.json({ ok: true });
    }

    const by = senderName(cq.from);
    await col.updateOne(
      { id: parsed.orderId },
      { $set: { leadStatus: parsed.key, leadStatusAt: uzStamp(), leadStatusBy: by } },
    );

    // Xabar BAZADAGI joriy holatdan qayta yig'iladi (eski matnni
    // tahrirlashga urinmaymiz): lid CRM'da o'zgargan bo'lsa, guruhdagi
    // xabar ham shu bosishda yangilanadi.
    //
    // ALOHIDA `try`: status ALLAQACHON bazada. Tahrirlash yiqilsa (xabar
    // juda eski, guruhdan o'chirilgan, botning huquqi olingan) bosgan
    // odamga "saqlanmadi" deyish YOLG'ON bo'lardi — u qayta bosib,
    // muammoni boshqa joydan qidirardi.
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    if (chatId !== undefined && messageId !== undefined) {
      try {
        const fresh = { ...order, leadStatus: parsed.key } as Order;
        await editMessage(
          cfg,
          String(chatId),
          messageId,
          leadMessage(fresh, await branchNameOf(db, order.branchId)),
          // Tugmalar qoldiriladi — status keyin ham o'zgartirilishi mumkin.
          leadKeyboard(parsed.orderId),
        );
      } catch (e) {
        console.error("[telegram-webhook] xabar tahrirlanmadi:", e instanceof Error ? e.message : e);
      }
    }

    const opt = leadStatusOption(parsed.key);
    await answerCallback(cfg, cq.id, opt ? `${opt.emoji} ${opt.label}` : "Saqlandi");
  } catch (e) {
    // Bu yerga faqat BAZA yiqilganda tushiladi — status yozilmagan.
    console.error("[telegram-webhook]", e instanceof Error ? e.message : e);
    await answerCallback(cfg, cq.id, "Saqlanmadi — birozdan keyin qayta urinib ko'ring");
  }

  // Telegram uchun DOIM 200: xato bo'lsa ham qayta yuborilmasin.
  return NextResponse.json({ ok: true });
}
