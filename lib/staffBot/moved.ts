import { answerCallbackQuery, callTelegram, editHtml, type InlineKeyboard } from "@/lib/telegramApi";
import { legacyStaffBotToken, STAFF_START_PARAM, staffBotUsername } from "@/lib/staffBot/config";
import { isStaffCallback } from "@/lib/staffBot/keyboards";
import type { TelegramUpdate } from "@/lib/staffBot/router";

// ESKI XODIMLAR BOTI (@akademiya_crm_bot) — 29.09.2026 dan faqat GURUH boti
// (to'lov/oylik/lid xabarlari, lid tugmalari). Xodimlar @tizimli_akademiya_bot
// ga ko'chdi (lib/staffBot/config.ts). Bu yerga eski botga SHAXSIY yozgan
// xodim yoki eski menyu xabaridagi tugma keladi — jim qolinmaydi, yangi botga
// havola beriladi (aks holda xodim "bot ishlamay qoldi" deb o'ylardi).
//
// Eski menyudagi «👤 Profilim»/«📷 Ishga keldim» (Mini App) tugmalari bu
// yerga kelmaydi — ular sahifani ochadi, u yerda lib/staffBot/webapp.ts
// eski bot imzosini tanib, xuddi shu gapni aytadi.
//
// HECH QACHON OTMAYDI: chaqiruvchi webhook Telegram'ga doim 200 qaytaradi.

function movedView(): string {
  return [
    "🔀 <b>Xodimlar boti ko'chdi</b>",
    "",
    `Profilingiz, «📷 Ishga keldim» va kassa amallari endi <b>@${staffBotUsername()}</b> da.`,
    "Pastdagi tugmani bosing, so'ng botda «Start» ni bosing.",
    "",
    "<i>Bu bot endi faqat guruhlarga xabar yozadi.</i>",
  ].join("\n");
}

function movedKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [{ text: `➡️ @${staffBotUsername()} ni ochish`, url: `https://t.me/${staffBotUsername()}?start=${STAFF_START_PARAM}` }],
    ],
  };
}

/** Eski botga kelgan shaxsiy xabar yoki eski menyu tugmasi — yangi botga yo'naltirish. */
export async function redirectToNewBot(update: TelegramUpdate): Promise<void> {
  const token = legacyStaffBotToken();
  if (!token) return;
  try {
    const cq = update.callback_query;
    if (cq) {
      // Faqat eski xodim menyusi tugmalari (`s:`); boshqasi — javobsiz qolmasin.
      if (!isStaffCallback(cq.data) || cq.message?.chat?.type !== "private") {
        await answerCallbackQuery(token, cq.id, "");
        return;
      }
      await answerCallbackQuery(token, cq.id, `Bot ko'chdi — @${staffBotUsername()}`);
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      if (chatId !== undefined && messageId !== undefined) {
        // Eski menyu joyida yo'naltirishga aylanadi — eski tugmalar ham yo'qoladi.
        await editHtml(token, String(chatId), messageId, movedView(), movedKeyboard()).catch((e) => {
          console.error("[staff-bot-moved] tahrirlanmadi:", e instanceof Error ? e.message : e);
        });
      }
      return;
    }

    const msg = update.message;
    if (!msg?.chat || msg.chat.type !== "private") return; // guruhda jim
    if ((msg.from as { is_bot?: boolean } | undefined)?.is_bot) return;
    await callTelegram(token, "sendMessage", {
      chat_id: msg.chat.id,
      text: movedView(),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: movedKeyboard(),
    });
  } catch (e) {
    console.error("[staff-bot-moved]", e instanceof Error ? e.message : e);
  }
}
