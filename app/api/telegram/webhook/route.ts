import { timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import type { Db } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { loadSyncConfig, type SyncConfig } from "@/lib/sync/config";
import { answerCallback, editMessage } from "@/lib/sync/telegram";
import { leadKeyboard, leadStatusOption, parseLeadCallback } from "@/lib/leadStatus";
import { buildLeadMessage } from "@/lib/leadNotify";
import { canTransition, holatFromTelegram, holatMeta, holatOf } from "@/lib/leadHolat";
import { applyHolatChange, recordTelegramPress } from "@/lib/leadHolatServer";
import type { Order } from "@/lib/ordersData";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { handleStaffUpdate, type TelegramUpdate } from "@/lib/staffBot/router";

// POST /api/telegram/webhook — xodimlar botining (@akademiya_crm_bot)
// webhook'i. IKKI OQIM bitta manzilda:
//
//   1) "Lidlar" topigidagi status tugmalari (`lead:…`, lib/leadStatus.ts):
//      bosilganda status bazaga yoziladi va xabarning "Status:" qatori
//      tahrirlanadi — 07.09.2026 dan beri;
//   2) kassir bilan SHAXSIY yozishma — to'lov kiritish, kassa holati
//      (lib/staffBot/*) — 18.09.2026 dan. Shu sabab `allowed_updates` ga
//      `message` qo'shildi (scripts/set-telegram-webhook.mjs). Guruh
//      xabarlari ham kela boshlaydi — router ularni darhol tashlaydi.
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

/**
 * Lid status tugmasi — bazaga yozish va xabarni yangilash.
 *
 * 23.09.2026 dan tugma Lidlar sahifasidagi HOLATNI yuritadi ("bitta
 * ma'lumot"): 🟢 → Sinov darsiga yozildi, 🕒/💳 → Bog'lanildi, ❌ → Rad
 * etdi. O'tish qoidasi CRM bilan bir xil (`canTransition`): guruhga
 * qo'shilgan lidni tugma bilan ortga qaytarib bo'lmaydi — bosgan odamga
 * sababi aytiladi, bazaga hech narsa yozilmaydi.
 */
async function handleLeadCallback(
  db: Db,
  cfg: SyncConfig,
  cq: CallbackQuery,
  parsed: NonNullable<ReturnType<typeof parseLeadCallback>>,
): Promise<void> {
  // BUTUN ISH `try` ICHIDA: bu yerdan otilgan xato 500 bo'lib qaytardi va
  // Telegram o'sha tugmani qayta-qayta yuboraverardi.
  try {
    const col = db.collection("orders");
    const order = (await col.findOne({ id: parsed.orderId }, { projection: { _id: 0 } })) as unknown as Order | null;
    if (!order) {
      await answerCallback(cfg, cq.id, "Lid topilmadi — CRM'dan o'chirilgan bo'lishi mumkin");
      return;
    }

    const by = senderName(cq.from) || "Telegram";
    const opt = leadStatusOption(parsed.key);
    const label = opt ? `${opt.emoji} ${opt.label}` : "";
    const from = holatOf(order);
    const to = holatFromTelegram(parsed.key);

    let fresh: Order = order;
    let answer = label || "Saqlandi";
    if (to && to !== from && canTransition(from, to)) {
      const r = await applyHolatChange(db, { id: order.id }, order, {
        to,
        by,
        via: "telegram",
        telegram: { key: parsed.key, label },
      });
      if (r.ok) fresh = r.order;
      else answer = r.error;
    } else if (to && to === from) {
      // Holat o'sha — faqat tugmaning aniq javobi (keyinroq ↔ to'lov).
      if (order.leadStatus !== parsed.key) fresh = (await recordTelegramPress(db, order, parsed.key, label, by)) ?? order;
    } else {
      answer = `Holat o'zgarmadi: lid «${holatMeta(from).nom}» bosqichida. O'zgartirish — CRM'dagi Lidlar sahifasida`;
    }

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
      // Eski lid (xabari saqlanmagan) — shu bosishdan keyin CRM'dagi
      // o'zgarishlar ham shu xabarga yetib borsin.
      if (!fresh.tgMessage) {
        await col.updateOne({ id: order.id, tgMessage: { $exists: false } }, { $set: { tgMessage: { chatId: String(chatId), messageId } } });
      }
      try {
        await editMessage(
          cfg,
          String(chatId),
          messageId,
          await buildLeadMessage(db, fresh),
          // Tugmalar qoldiriladi — status keyin ham o'zgartirilishi mumkin.
          leadKeyboard(parsed.orderId),
        );
      } catch (e) {
        console.error("[telegram-webhook] xabar tahrirlanmadi:", e instanceof Error ? e.message : e);
      }
    }

    await answerCallback(cfg, cq.id, answer);
  } catch (e) {
    // Bu yerga faqat BAZA yiqilganda tushiladi — status yozilmagan.
    console.error("[telegram-webhook]", e instanceof Error ? e.message : e);
    await answerCallback(cfg, cq.id, "Saqlanmadi — birozdan keyin qayta urinib ko'ring");
  }
}

export async function POST(req: Request) {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const provided = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate & { callback_query?: CallbackQuery };
  try {
    update = await req.json();
  } catch {
    // Buzuq tana — 200 qaytaramiz, aks holda Telegram uni ABADIY qayta
    // yuboraveradi. Tuzatadigan narsa bizda yo'q.
    return NextResponse.json({ ok: true });
  }

  const cq = update.callback_query;
  const parsed = cq?.id ? parseLeadCallback(cq.data) : null;

  // BAZA ULANISHI HAM `try` ICHIDA — yiqilsa ham Telegram'ga 200.
  try {
    const db = await ensureIndexes();

    if (cq?.id && parsed) {
      // 1) Lid status tugmasi.
      await handleLeadCallback(db, loadSyncConfig(), cq, parsed);
    } else {
      // 2) Qolgan hammasi — xodimlar boti (shaxsiy xabar, `s:` tugmalar).
      // Router o'zi hech qachon otmaydi va guruh xabarlarini tashlaydi.
      // `after` — to'lov yozilgach Sheets/Telegram navbati javobdan KEYIN
      // yuriladi (lib/cashboxAdjust.ts → defer).
      const cfg = loadStaffBotConfig();
      if (isStaffBotReady(cfg)) await handleStaffUpdate(db, cfg, update, after);
    }
  } catch (e) {
    console.error("[telegram-webhook]", e instanceof Error ? e.message : e);
  }

  // Telegram uchun DOIM 200: xato bo'lsa ham qayta yuborilmasin.
  return NextResponse.json({ ok: true });
}
